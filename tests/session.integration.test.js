import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import net from 'node:net';
import { io } from 'socket.io-client';

let server;
let baseUrl;
let host;
let guest;

async function freePort() {
  const probe = net.createServer();
  await new Promise((resolve, reject) => probe.listen(0, '127.0.0.1', resolve).once('error', reject));
  const { port } = probe.address();
  await new Promise((resolve) => probe.close(resolve));
  return port;
}

async function waitForServer(url) {
  const deadline = Date.now() + 15000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch { /* server is still starting */ }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error('Test server did not become ready within 15 seconds.');
}

function waitForEvent(socket, eventName, predicate = () => true, timeoutMs = 8000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      socket.off(eventName, handler);
      reject(new Error(`Timed out waiting for Socket.IO event: ${eventName}`));
    }, timeoutMs);
    function handler(payload) {
      if (!predicate(payload)) return;
      clearTimeout(timer);
      socket.off(eventName, handler);
      resolve(payload);
    }
    socket.on(eventName, handler);
  });
}

function expectNoEvent(socket, eventName, action, timeoutMs = 250) {
  return new Promise((resolve, reject) => {
    const handler = () => {
      clearTimeout(timer);
      socket.off(eventName, handler);
      reject(new Error(`Unexpected Socket.IO event: ${eventName}`));
    };
    const timer = setTimeout(() => {
      socket.off(eventName, handler);
      resolve();
    }, timeoutMs);
    socket.on(eventName, handler);
    action();
  });
}

function emitAck(socket, eventName, payload) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`No acknowledgement for ${eventName}`)), 8000);
    socket.emit(eventName, payload, (response) => {
      clearTimeout(timer);
      resolve(response);
    });
  });
}

async function connectClient(url) {
  const socket = io(url, { transports: ['websocket'], reconnection: false, timeout: 5000 });
  await waitForEvent(socket, 'connect', () => true, 8000);
  return socket;
}

before(async () => {
  const port = await freePort();
  baseUrl = `http://127.0.0.1:${port}`;
  server = spawn(process.execPath, ['server.js'], {
    cwd: process.cwd(),
    env: { ...process.env, PORT: String(port) },
    stdio: 'ignore',
  });
  await waitForServer(baseUrl);
});

after(() => {
  host?.disconnect();
  guest?.disconnect();
  server?.kill('SIGTERM');
});

test('two participants can join, share stories, vote, reveal, reset and transfer host', async () => {
  const roomId = `e2e-${Date.now()}`;
  host = await connectClient(baseUrl);
  guest = await connectClient(baseUrl);

  const hostRole = await emitAck(host, 'joinSession', {
    sessionId: roomId, requestedHost: true, name: 'Host Tester',
  });
  assert.equal(hostRole.isHost, true);
  host.emit('joinRoom', { roomId, userName: 'Host Tester' });

  const guestRole = await emitAck(guest, 'joinSession', {
    sessionId: roomId, requestedHost: false, name: 'Guest Tester',
  });
  assert.equal(guestRole.isHost, false);
  guest.emit('joinRoom', { roomId, userName: 'Guest Tester' });

  const initialState = waitForEvent(guest, 'resyncState');
  guest.emit('requestFullStateResync');
  const state = await initialState;
  assert.deepEqual(state.tickets, []);

  const blockedStory = { id: 'story-e2e-blocked', text: 'Should not be added by a guest', points: '?' };
  await expectNoEvent(guest, 'addTicket', () => guest.emit('addTicket', blockedStory));

  const permissionUpdate = waitForEvent(guest, 'sessionPermissionsUpdate');
  host.emit('setSessionPermissions', { allowMemberManage: true });
  assert.equal((await permissionUpdate).allowMemberManage, true);

  const story = { id: 'story-e2e-1', text: 'Integration test story', points: '?' };
  const storyAdded = waitForEvent(host, 'addTicket', (payload) => payload.ticketData?.id === story.id);
  guest.emit('addTicket', story);
  assert.equal((await storyAdded).ticketData.text, story.text);

  const pointsUpdated = waitForEvent(guest, 'storyPointsUpdate', (payload) => payload.storyId === story.id);
  guest.emit('updateStoryPoints', { storyId: story.id, points: '8' });
  assert.equal((await pointsUpdated).points, '8');

  const restoredState = waitForEvent(guest, 'resyncState');
  guest.emit('requestFullStateResync');
  const stateAfterPoints = await restoredState;
  assert.equal(stateAfterPoints.storyPoints[story.id], '8');

  const voteReceived = waitForEvent(host, 'voteUpdate', (payload) => payload.storyId === story.id);
  guest.emit('castVote', {
    storyId: story.id, vote: '5', userName: 'Guest Tester', targetUserId: guest.id,
  });
  assert.equal((await voteReceived).vote, '5');

  await expectNoEvent(guest, 'votesRevealed', () => guest.emit('revealVotes', { storyId: story.id }));
  const revealed = waitForEvent(guest, 'votesRevealed', (payload) => payload.storyId === story.id);
  host.emit('revealVotes', { storyId: story.id });
  assert.equal((await revealed).storyId, story.id);

  const reset = waitForEvent(guest, 'votesReset', (payload) => payload.storyId === story.id);
  host.emit('resetVotes', { storyId: story.id });
  assert.equal((await reset).storyId, story.id);

  const released = waitForEvent(guest, 'hostReleased');
  host.emit('releaseHost', { sessionId: roomId });
  await released;

  const hostChanged = waitForEvent(host, 'hostChanged', (payload) => payload.hostId === guest.id);
  const promotion = await emitAck(guest, 'requestHost', { sessionId: roomId });
  assert.equal(promotion.allowed, true);
  assert.equal((await hostChanged).hostId, guest.id);
});
