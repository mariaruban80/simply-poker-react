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
  events.forEach((eventName) => socket.on(eventName, (payload) => onEvent?.(eventName, payload || {})));

  const joinSession = () => {
    const requestedHost = sessionStorage.getItem('requestedHost') === 'true'
      || sessionStorage.getItem('isRoomCreator') === 'true';
    socket.emit('joinSession', { sessionId: roomId, requestedHost, name: userName }, (response = {}) => {
      sessionStorage.setItem('isHost', String(Boolean(response.isHost)));
      onEvent?.('joinSessionResult', response);
      socket.emit('joinRoom', { roomId, userName });
      socket.emit('requestAllTickets');
      socket.emit('requestFullStateResync');
      socket.emit('requestCurrentStory');
    });
  };

  socket.on('connect', () => {
    onStatus?.(true, 'Connected');
    joinSession();
  });
  socket.on('disconnect', () => onStatus?.(false, 'Disconnected'));
  socket.on('connect_error', () => onStatus?.(false, 'Connection issue'));

  return {
    disconnect: () => {
      socket.disconnect();
      if (window.roomSocket === socket) delete window.roomSocket;
    },
  };
}
