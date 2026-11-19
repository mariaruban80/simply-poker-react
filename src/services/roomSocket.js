import { io } from 'socket.io-client';

export function connectToRoom({ roomId, userName, onStatus, onEvent }) {
  const socket = io({
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionAttempts: 10,
    reconnectionDelay: 1000,
  });
  window.roomSocket = socket;

  const events = [
    'userList', 'allTickets', 'resyncState', 'addTicket', 'updateTicket',
    'deleteStory', 'storySelected', 'storyVotes', 'voteUpdate', 'votesUpdate',
    'votesRevealed', 'votesReset', 'restoreUserVote', 'votingSystemUpdate',
    'storyPointsUpdate', 'hostChanged', 'hostLeft', 'hostReleased', 'syncCSVData',
    'exportData', 'error',
  ];

  socket.on('connect', () => {
    onStatus?.(true, 'Connected');
    socket.emit('joinRoom', { roomId, userName });
    socket.emit('requestAllTickets');
    socket.emit('requestFullStateResync');
    socket.emit('requestCurrentStory');
  });
  socket.on('disconnect', () => onStatus?.(false, 'Disconnected'));
  socket.on('connect_error', () => onStatus?.(false, 'Connection issue'));
  events.forEach((eventName) => socket.on(eventName, (payload) => onEvent?.(eventName, payload || {})));

  return {
    disconnect: () => {
      socket.disconnect();
      if (window.roomSocket === socket) delete window.roomSocket;
    },
  };
}
