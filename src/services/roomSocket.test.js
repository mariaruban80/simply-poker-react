import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { mockSocket } = vi.hoisted(() => ({
  mockSocket: {
    connected: false,
    id: 'socket-test-1',
    handlers: {},
    emitted: [],
    on(event, handler) { this.handlers[event] = handler; return this; },
    emit(event, payload, callback) {
      this.emitted.push({ event, payload });
      if (event === 'joinSession' && callback) callback({ isHost: true });
      return this;
    },
    disconnect() { this.disconnected = true; },
    trigger(event, payload) { this.handlers[event]?.(payload); },
  },
}));

vi.mock('socket.io-client', () => ({
  io: vi.fn(() => mockSocket),
}));

import { connectToRoom } from './roomSocket.js';

afterEach(() => {
  globalThis.sessionStorage?.clear();
  if (globalThis.window) delete globalThis.window.roomSocket;
  mockSocket.handlers = {};
  mockSocket.emitted = [];
  mockSocket.connected = false;
  mockSocket.disconnected = false;
  vi.unstubAllGlobals();
});

describe('room socket session lifecycle protocol', () => {
  beforeEach(() => {
    const values = new Map();
    vi.stubGlobal('sessionStorage', {
      getItem: (key) => values.has(key) ? values.get(key) : null,
      setItem: (key, value) => values.set(key, String(value)),
      clear: () => values.clear(),
    });
    vi.stubGlobal('window', {});
  });

  it('joins the existing server session protocol and requests a full state resync', () => {
    sessionStorage.setItem('requestedHost', 'true');
    const onEvent = vi.fn();
    const connection = connectToRoom({
      roomId: 'room-123',
      userName: 'Alex',
      onStatus: vi.fn(),
      onEvent,
    });

    mockSocket.connected = true;
    mockSocket.trigger('connect');

    expect(mockSocket.emitted[0]).toEqual({
      event: 'joinSession',
      payload: { sessionId: 'room-123', requestedHost: true, name: 'Alex' },
    });
    expect(mockSocket.emitted.map((item) => item.event)).toEqual([
      'joinSession',
      'joinRoom',
      'requestAllTickets',
      'requestFullStateResync',
    ]);
    expect(sessionStorage.getItem('isHost')).toBe('true');
    expect(onEvent).toHaveBeenCalledWith('joinSessionResult', { isHost: true });
    connection.disconnect();
    expect(mockSocket.disconnected).toBe(true);
  });

  it('forwards host transfer, release, and disconnect lifecycle events', () => {
    const onEvent = vi.fn();
    connectToRoom({ roomId: 'room-123', userName: 'Alex', onEvent, onStatus: vi.fn() });

    mockSocket.trigger('hostChanged', { hostId: 'socket-test-1', userName: 'Alex' });
    mockSocket.trigger('hostReleased', { userName: 'Alex' });
    mockSocket.trigger('hostLeft', {});

    expect(onEvent).toHaveBeenNthCalledWith(1, 'hostChanged', { hostId: 'socket-test-1', userName: 'Alex' });
    expect(onEvent).toHaveBeenNthCalledWith(2, 'hostReleased', { userName: 'Alex' });
    expect(onEvent).toHaveBeenNthCalledWith(3, 'hostLeft', {});
  });

  it('forwards vote, reveal, and reset events for the session UI', () => {
    const onEvent = vi.fn();
    connectToRoom({ roomId: 'room-123', userName: 'Alex', onEvent, onStatus: vi.fn() });

    mockSocket.trigger('voteUpdate', { storyId: 'story-1', userId: 'socket-test-1', vote: '5' });
    mockSocket.trigger('votesRevealed', { storyId: 'story-1' });
    mockSocket.trigger('votesReset', { storyId: 'story-1' });

    expect(onEvent).toHaveBeenNthCalledWith(1, 'voteUpdate', {
      storyId: 'story-1', userId: 'socket-test-1', vote: '5',
    });
    expect(onEvent).toHaveBeenNthCalledWith(2, 'votesRevealed', { storyId: 'story-1' });
    expect(onEvent).toHaveBeenNthCalledWith(3, 'votesReset', { storyId: 'story-1' });
  });

  it('does not emit the unsupported requestCurrentStory event', () => {
    connectToRoom({ roomId: 'room-123', userName: 'Alex', onEvent: vi.fn(), onStatus: vi.fn() });
    mockSocket.connected = true;
    mockSocket.trigger('connect');

    expect(mockSocket.emitted.some((item) => item.event === 'requestCurrentStory')).toBe(false);
  });
});
