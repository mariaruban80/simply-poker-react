import { io } from 'socket.io-client';
import { randomUUID } from 'node:crypto';

const target = (process.env.TARGET_URL || process.argv[2] || '').replace(/\/$/, '');
if (!target || !/^https?:\/\//i.test(target)) {
  console.error('Usage: TARGET_URL=https://your-app.example node scripts/live-load-test.mjs');
  process.exit(2);
}

// Keep the live check deliberately small for the Render Free instance.\nconst stages = [5, 10];
const timeoutMs = 120_000;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function percentile(values, p) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.ceil(p * sorted.length) - 1)];
}

function waitFor(socket, eventName, predicate = () => true, timeout = timeoutMs) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      socket.off(eventName, handler);
      reject(new Error(`Timed out waiting for ${eventName}`));
    }, timeout);
    const handler = (payload) => {
      if (!predicate(payload)) return;
      clearTimeout(timer);
      socket.off(eventName, handler);
      resolve(payload);
    };
    socket.on(eventName, handler);
  });
}

function waitForAck(socket, eventName, payload) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`No acknowledgement for ${eventName}`)), timeoutMs);
    socket.emit(eventName, payload, (result) => {
      clearTimeout(timer);
      resolve(result);
    });
  });
}

async function runStage(participantCount) {
  const roomId = `load-check-${Date.now()}-${randomUUID().slice(0, 8)}-${participantCount}`;
  const clients = [];
  const connectTimes = [];
  const operationTimes = [];
  const storyId = `load-story-${randomUUID()}`;

  try {
    for (let i = 0; i < participantCount; i += 1) {
      const name = `Load Tester ${participantCount}-${i + 1}`;
      const socket = io(target, {
        transports: ['websocket'],
        reconnection: false,
        timeout: timeoutMs,
        forceNew: true,
      });
      clients.push({ socket, name });
      const started = Date.now();
      await waitFor(socket, 'connect');
      connectTimes.push(Date.now() - started);

      const role = await waitForAck(socket, 'joinSession', {
        sessionId: roomId,
        requestedHost: i === 0,
        name,
      });
      if (Boolean(role?.isHost) !== (i === 0)) {
        throw new Error(`Unexpected role for ${name}: ${JSON.stringify(role)}`);
      }
      socket.emit('joinRoom', { roomId, userName: name });
      // Ramp clients gently to avoid a single connection burst on the Free instance.
      await sleep(150);
    }

    const host = clients[0].socket;
    const ticket = { id: storyId, idDisplay: 'LOAD-TEST', text: 'Temporary load-test story', points: '?' };

    const ticketWaits = clients.map(({ socket }) =>
      waitFor(socket, 'addTicket', (payload) => payload?.ticketData?.id === storyId));
    const ticketStart = Date.now();
    host.emit('addTicket', ticket);
    await Promise.all(ticketWaits);
    operationTimes.push(Date.now() - ticketStart);

    // Each participant casts one vote; every connected client must receive every vote.
    for (let i = 0; i < clients.length; i += 1) {
      const { socket, name } = clients[i];
      const voteWaits = clients.map(({ socket: receiver }) =>
        waitFor(receiver, 'voteUpdate', (payload) =>
          payload?.storyId === storyId && payload?.userId === socket.id));
      const voteStart = Date.now();
      socket.emit('castVote', {
        storyId,
        vote: String([1, 2, 3, 5, 8, 13, 20, 21, 34, 40][i] || 5),
        userName: name,
        targetUserId: socket.id,
      });
      await Promise.all(voteWaits);
      operationTimes.push(Date.now() - voteStart);
    }

    const revealWaits = clients.map(({ socket }) =>
      waitFor(socket, 'votesRevealed', (payload) => payload?.storyId === storyId));
    const revealStart = Date.now();
    host.emit('revealVotes', { storyId });
    const reveals = await Promise.all(revealWaits);
    operationTimes.push(Date.now() - revealStart);
    if (reveals.some((payload) => !payload || payload.points === '?')) {
      throw new Error('Vote reveal did not return a calculated estimate to every participant.');
    }

    return {
      participants: participantCount,
      connected: clients.length,
      connectionP50Ms: Math.round(percentile(connectTimes, 0.50)),
      connectionP95Ms: Math.round(percentile(connectTimes, 0.95)),
      eventP50Ms: Math.round(percentile(operationTimes, 0.50)),
      eventP95Ms: Math.round(percentile(operationTimes, 0.95)),
      result: 'PASS',
    };
  } finally {
    for (const { socket } of clients) socket.disconnect();
    // Allow the server to process disconnect cleanup before the next stage.
    await sleep(500);
  }
}

console.log(`Target: ${target}`);
console.log('Test: staged Socket.IO clients; isolated temporary rooms; add story, cast votes, reveal votes.');
console.log('No production user data is read or modified.');

const results = [];
for (const count of stages) {
  console.log(`\\nStarting ${count}-participant stage...`);
  try {
    const result = await runStage(count);
    results.push(result);
    console.log(JSON.stringify(result));
  } catch (error) {
    console.error(`FAIL at ${count} participants: ${error?.stack || error}`);
    results.push({ participants: count, result: 'FAIL', error: String(error?.message || error) });
    break;
  }
}

console.log('\\nSUMMARY');
console.table(results);
if (results.length !== stages.length || results.some((item) => item.result !== 'PASS')) {
  process.exitCode = 1;
}
