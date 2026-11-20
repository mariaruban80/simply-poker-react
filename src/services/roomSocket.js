import { io } from 'socket.io-client';

export function connectToRoom({ roomId, userName, onStatus, onEvent }) {
  const socket = io({
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionAttempts: 10,
    reconnectionDelay: 1000,
  });
  window.roomSocket = socket;
  const roomKey = (key) => `simplyPoker:${roomId}:${key}`;

  const events = [
    'userList', 'allTickets', 'resyncState', 'addTicket', 'updateTicket',
    'deleteStory', 'storySelected', 'storyVotes', 'voteUpdate', 'votesUpdate',
    'votesRevealed', 'votesReset', 'restoreUserVote', 'votingSystemUpdate',
    'storyPointsUpdate', 'hostChanged', 'hostLeft', 'hostReleased', 'syncCSVData',
    'exportData', 'sessionPermissionsUpdate', 'error',
  ];
  events.forEach((eventName) => socket.on(eventName, (payload) => onEvent?.(eventName, payload || {})));

  const joinSession = () => {
    const requestedHost = sessionStorage.getItem(roomKey('requestedHost')) === 'true';
    socket.emit('joinSession', { sessionId: roomId, requestedHost, name: userName }, (response = {}) => {
      sessionStorage.setItem(roomKey('isHost'), String(Boolean(response.isHost)));
      onEvent?.('joinSessionResult', response);
      if (response.votingSystem) {
        sessionStorage.setItem(roomKey('votingSystem'), response.votingSystem);
        onEvent?.('votingSystemUpdate', { votingSystem: response.votingSystem });
      }
      if (response.allowMemberManage !== null && response.allowMemberManage !== undefined) {
        sessionStorage.setItem(roomKey('allowMemberManage'), String(Boolean(response.allowMemberManage)));
        onEvent?.('sessionPermissionsUpdate', { allowMemberManage: Boolean(response.allowMemberManage) });
      }
      socket.emit('joinRoom', { roomId, userName });
      socket.emit('requestAllTickets');
      socket.emit('requestFullStateResync');
      if (response.isHost && !response.votingSystem) {
        socket.emit('votingSystemSelected', {
          roomId,
          votingSystem: sessionStorage.getItem(roomKey('votingSystem')) || 'fibonacci',
        });
      }
      if (response.isHost && sessionStorage.getItem(roomKey('allowMemberManage')) === 'true' && response.allowMemberManage !== true) {
        socket.emit('setSessionPermissions', { allowMemberManage: true });
      }
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
