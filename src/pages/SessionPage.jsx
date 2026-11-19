import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Copy, Eye, Pencil, Plus, RotateCcw, Spade, Trash2, Users, Wifi, WifiOff } from 'lucide-react';
import { connectToRoom } from '../services/roomSocket.js';

const scales = {
  fibonacci: ['0', '1', '2', '3', '5', '8', '13', '20', '40', '100', '?', '☕'],
  shortFib: ['0', '1', '2', '3', '5', '8', '13', '?', '☕'],
  tshirt: ['XS', 'S', 'M', 'L', 'XL', 'XXL', '?', '☕'],
  tshirtNum: ['XS (1)', 'S (2)', 'M (3)', 'L (5)', 'XL (8)', 'XXL (13)'],
  custom: ['?', '☕', '∞'],
};

const normaliseTickets = (value) => Array.isArray(value) ? value.filter((ticket) => ticket?.id) : [];

export default function SessionPage() {
  const { roomId } = useParams();
  const navigate = useNavigate();
  const userName = sessionStorage.getItem('userName') || '';
  const [isHost, setIsHost] = useState(sessionStorage.getItem('isHost') === 'true');
  const [connected, setConnected] = useState(false);
  const [status, setStatus] = useState('Connecting…');
  const [users, setUsers] = useState([]);
  const [tickets, setTickets] = useState([]);
  const [selectedStory, setSelectedStory] = useState(0);
  const [selectedVote, setSelectedVote] = useState(null);
  const [votesPerStory, setVotesPerStory] = useState({});
  const [revealedStories, setRevealedStories] = useState({});
  const [newTicket, setNewTicket] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [editingText, setEditingText] = useState('');
  const [votingSystem, setVotingSystem] = useState(sessionStorage.getItem('votingSystem') || 'fibonacci');
  const [storyPoints, setStoryPoints] = useState({});
  const [notice, setNotice] = useState('');

  const active = tickets[selectedStory];
  const cards = useMemo(() => scales[votingSystem] || scales.fibonacci, [votingSystem]);
  const revealed = Boolean(active && revealedStories[active.id]);
  const votes = active ? (votesPerStory[active.id] || {}) : {};
  const canManage = isHost || sessionStorage.getItem('allowMemberManage') === 'true';

  const selectStory = useCallback((index, broadcast = true) => {
    if (index < 0 || index >= tickets.length) return;
    setSelectedStory(index);
    setSelectedVote(null);
    const storyId = tickets[index]?.id;
    if (storyId && window.roomSocket?.connected) {
      if (broadcast) window.roomSocket.emit('storySelected', { storyIndex: index });
      window.roomSocket.emit('requestStoryVotes', { storyId });
    }
  }, [tickets]);

  useEffect(() => {
    if (!userName) { navigate('/'); return undefined; }
    const connection = connectToRoom({
      roomId,
      userName,
      onStatus: (ok, message) => { setConnected(ok); setStatus(message); },
      onEvent: (type, payload) => {
        if (type === 'userList') setUsers(Array.isArray(payload) ? payload : []);
        if (type === 'joinSessionResult') {
          setIsHost(Boolean(payload.isHost));
          sessionStorage.setItem('isHost', String(Boolean(payload.isHost)));
        }
        if (type === 'allTickets') setTickets(normaliseTickets(payload.tickets));
        if (type === 'resyncState') {
          setTickets(normaliseTickets(payload.tickets));
          setVotesPerStory(payload.votesPerStory || {});
          setRevealedStories(payload.votesRevealed || {});
          const idx = Math.max(0, Math.min(Number(payload.selectedIndex) || 0, (payload.tickets || []).length - 1));
          setSelectedStory(idx);
        }
        if (type === 'addTicket' && payload.ticketData) {
          setTickets((old) => old.some((item) => item.id === payload.ticketData.id) ? old : [...old, payload.ticketData]);
        }
        if (type === 'updateTicket' && payload.ticketData) {
          setTickets((old) => old.map((item) => item.id === payload.ticketData.id ? payload.ticketData : item));
        }
        if (type === 'deleteStory') {
          setTickets((old) => {
            const next = old.filter((item) => item.id !== payload.storyId);
            setSelectedStory((index) => Math.max(0, Math.min(index, next.length - 1)));
            return next;
          });
          setVotesPerStory((old) => { const next = { ...old }; delete next[payload.storyId]; return next; });
          setRevealedStories((old) => { const next = { ...old }; delete next[payload.storyId]; return next; });
        }
        if (type === 'storySelected') setSelectedStory(Math.max(0, Number(payload.storyIndex) || 0));
        if (type === 'storyVotes' && payload.storyId) {
          setVotesPerStory((old) => ({ ...old, [payload.storyId]: payload.votes || {} }));
        }
        if (type === 'votesUpdate') setVotesPerStory(payload || {});
        if (type === 'voteUpdate' && payload.storyId) {
          setVotesPerStory((old) => ({
            ...old,
            [payload.storyId]: { ...(old[payload.storyId] || {}), [payload.userId]: payload.vote },
          }));
        }
        if (type === 'restoreUserVote' && payload.storyId) {
          setSelectedVote(payload.vote);
        }
        if (type === 'votesRevealed' && payload.storyId) {
          setRevealedStories((old) => ({ ...old, [payload.storyId]: true }));
        }
        if (type === 'votesReset' && payload.storyId) {
          setRevealedStories((old) => ({ ...old, [payload.storyId]: false }));
          setVotesPerStory((old) => ({ ...old, [payload.storyId]: {} }));
          setSelectedVote(null);
        }
        if (type === 'votingSystemUpdate' && payload.votingSystem) {
          setVotingSystem(payload.votingSystem);
          sessionStorage.setItem('votingSystem', payload.votingSystem);
        }
        if (type === 'storyPointsUpdate' && payload.storyId) {
          setStoryPoints((old) => ({ ...old, [payload.storyId]: payload.points }));
        }
        if (type === 'hostChanged') {
          const nowHost = payload.hostId === window.roomSocket?.id;
          setIsHost(nowHost);
          sessionStorage.setItem('isHost', String(nowHost));
        }
        if (type === 'hostLeft' || type === 'hostReleased') {
          setNotice('The session host has left or released host access.');
        }
      },
    });
    return () => connection.disconnect();
  }, [roomId, userName, navigate]);

  useEffect(() => {
    if (active?.id && window.roomSocket?.connected) {
      window.roomSocket.emit('requestStoryVotes', { storyId: active.id });
    }
  }, [active?.id]);

  function addStory(event) {
    event.preventDefault();
    const text = newTicket.trim();
    if (!text || !canManage) return;
    const ticketData = { id: `story_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`, text, points: '?' };
    window.roomSocket?.emit('addTicket', ticketData);
    setTickets((old) => old.some((item) => item.id === ticketData.id) ? old : [...old, ticketData]);
    setNewTicket('');
    setNotice('Story added.');
  }

  function vote(value) {
    if (!active || revealed) return;
    setSelectedVote(value);
    window.roomSocket?.emit('castVote', { storyId: active.id, vote: value, userName, targetUserId: window.roomSocket?.id });
  }

  function reveal() {
    if (!active || !isHost) return;
    window.roomSocket?.emit('revealVotes', { storyId: active.id });
    setRevealedStories((old) => ({ ...old, [active.id]: true }));
  }

  function reset() {
    if (!active || !isHost) return;
    window.roomSocket?.emit('resetVotes', { storyId: active.id });
    setRevealedStories((old) => ({ ...old, [active.id]: false }));
    setVotesPerStory((old) => ({ ...old, [active.id]: {} }));
    setSelectedVote(null);
  }

  function saveEdit(ticket) {
    const text = editingText.trim();
    if (!text) return;
    const updated = { ...ticket, text };
    window.roomSocket?.emit('updateTicket', updated);
    setTickets((old) => old.map((item) => item.id === ticket.id ? updated : item));
    setEditingId(null);
    setEditingText('');
  }

  function deleteStory(ticket) {
    if (!window.confirm(`Delete “${ticket.text || ticket.id}” from this session?`)) return;
    window.roomSocket?.emit('deleteStory', { storyId: ticket.id });
    setTickets((old) => old.filter((item) => item.id !== ticket.id));
    setSelectedStory((index) => Math.max(0, Math.min(index, tickets.length - 2)));
  }

  function updatePoints(ticket, value) {
    const points = value.trim() || '?';
    window.roomSocket?.emit('updateStoryPoints', { storyId: ticket.id, points });
    setStoryPoints((old) => ({ ...old, [ticket.id]: points }));
  }

  function changeScale(value) {
    setVotingSystem(value);
    sessionStorage.setItem('votingSystem', value);
    window.roomSocket?.emit('votingSystemSelected', { roomId, votingSystem: value });
  }

  async function copy() {
    const link = `${window.location.origin}/session/${roomId}`;
    try { await navigator.clipboard.writeText(link); setNotice('Invite link copied.'); }
    catch { setNotice(`Share session ID: ${roomId}`); }
  }

  const visibleVotes = Object.entries(votes).map(([id, value]) => {
    const member = users.find((person) => person.id === id);
    return { id, name: member?.name || 'Participant', value };
  });

  return (
    <div className="room-shell">
      <header className="room-header">
        <a className="brand" href="/"><span className="brand-mark"><Spade size={20} fill="currentColor" /></span>Simply Poker</a>
        <div className="room-meta">
          <span className={`connection-pill ${connected ? '' : 'offline'}`}>{connected ? <Wifi size={14} /> : <WifiOff size={14} />} {status}</span>
          <span className="room-code">Room: <b>{roomId}</b></span>
          <button className="icon-button" onClick={copy} aria-label="Copy invite link"><Copy size={17} /></button>
          <button className="text-button" onClick={() => navigate('/')}>Leave</button>
        </div>
      </header>
      <main className="room-layout">
        <aside className="room-sidebar">
          <div className="side-heading"><Users size={18} /><h3>Team members</h3><span>{users.length}</span></div>
          <ul className="member-list">{users.map((person, index) => (
            <li key={person.id || index}><span className="avatar">{(person.name || '?').slice(0, 1).toUpperCase()}</span><span>{person.name || 'Member'}</span>{person.id === window.roomSocket?.id && <small>YOU</small>}</li>
          ))}</ul>
          <div className="sidebar-room-id"><small>SESSION ID</small><strong>{roomId}</strong><button onClick={copy}><Copy size={13} /> Copy invite</button></div>
        </aside>
        <section className="room-main">
          <div className="room-title-row"><div><p className="eyebrow">ESTIMATION SESSION</p><h1>{sessionStorage.getItem('sessionName') || 'Team planning'}</h1></div><span className="status-label">{active ? `Story ${selectedStory + 1} of ${tickets.length}` : 'Waiting for stories'}</span></div>
          {notice && <p className="status-label" role="status">{notice}</p>}
          <section className="story-panel">
            <div className="panel-label">CURRENT STORY</div>
            {active ? <>
              {editingId === active.id ? <div className="add-story-form"><input value={editingText} onChange={(event) => setEditingText(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') saveEdit(active); if (event.key === 'Escape') setEditingId(null); }} autoFocus /><button onClick={() => saveEdit(active)}>Save</button><button type="button" onClick={() => setEditingId(null)}>Cancel</button></div> : <><h2>{active.idDisplay ? <span>{active.idDisplay}: </span> : null}{active.text || active.title || 'Untitled story'}</h2>{active.descriptionDisplay && <p>{active.descriptionDisplay}</p>}</>}
              <div className="status-label">Story points: <b>{storyPoints[active.id] ?? active.points ?? '?'}</b></div>
              {canManage && <div className="story-navigation"><button onClick={() => { setEditingId(active.id); setEditingText(active.text || ''); }}><Pencil size={14} /> Edit story</button><button onClick={() => deleteStory(active)}><Trash2 size={14} /> Delete story</button></div>}
              {canManage && <div className="story-navigation"><label>Points <input aria-label="Story points" defaultValue={storyPoints[active.id] ?? active.points ?? '?'} onBlur={(event) => updatePoints(active, event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') event.currentTarget.blur(); }} /></label></div>}
            </> : <div className="empty-state"><div className="empty-icon"><Spade size={25} /></div><h2>No stories added yet</h2><p>{canManage ? 'Add a story to start estimating with your team.' : 'Waiting for the host to add a story.'}</p></div>}
            {tickets.length > 0 && <div className="story-navigation"><button disabled={selectedStory === 0} onClick={() => selectStory(selectedStory - 1)}>Previous</button><button disabled={selectedStory >= tickets.length - 1} onClick={() => selectStory(selectedStory + 1)}>Next story</button></div>}
          </section>
          {canManage && <form className="add-story-form" onSubmit={addStory}><input value={newTicket} onChange={(event) => setNewTicket(event.target.value)} placeholder="Add a story or ticket title…" aria-label="New story title" /><button type="submit"><Plus size={15} /> Add story</button></form>}
          <section className="voting-panel">
            <div className="voting-heading"><div><h2>Your estimate</h2><p>{revealed ? 'Voting is revealed. Reset to vote again.' : 'Choose a card that reflects the effort involved.'}</p></div>{selectedVote !== null && <span className="vote-confirmation">Vote submitted</span>}</div>
            {isHost && <label className="status-label">Voting scale <select value={votingSystem} onChange={(event) => changeScale(event.target.value)}><option value="fibonacci">Fibonacci</option><option value="shortFib">Short Fibonacci</option><option value="tshirt">T-Shirt sizes</option><option value="tshirtNum">T-Shirt + numbers</option><option value="custom">Custom</option></select></label>}
            <div className="voting-cards">{cards.map((card) => <button key={card} className={`vote-card ${selectedVote === card ? 'chosen' : ''}`} onClick={() => vote(card)} disabled={!active || revealed}>{card}</button>)}</div>
          </section>
          {isHost && <div className="host-actions"><button className="action-secondary" onClick={reset}><RotateCcw size={16} /> Reset votes</button><button className="action-primary" onClick={reveal}><Eye size={16} /> Reveal votes</button></div>}
          {revealed && <section className="results-panel"><h3>Voting results</h3><div className="result-chips">{visibleVotes.map((item) => <span key={item.id}>{item.name}: <b>{String(item.value)}</b></span>)}</div></section>}
        </section>
      </main>
    </div>
  );
}
