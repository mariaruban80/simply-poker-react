import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { CheckCircle2, Copy, Eye, Pencil, Plus, RotateCcw, Spade, Trash2, Users, Wifi, WifiOff } from 'lucide-react';
import { connectToRoom } from '../services/roomSocket.js';
import DataImportExport from '../components/DataImportExport.jsx';
import { ProfileMenu, SessionTimer, FeedbackWidget } from '../components/SessionTools.jsx';

const scales = {
  fibonacci: ['0', '1', '2', '3', '5', '8', '13', '21'],
  shortFib: ['0', '½', '1', '2', '3'],
  tshirt: ['XXS', 'XS', 'S', 'M', 'L', 'XL', 'XXL'],
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
  const [hostRequestBusy, setHostRequestBusy] = useState(false);
  const [storySearch, setStorySearch] = useState('');
  const [allowMemberManage, setAllowMemberManage] = useState(sessionStorage.getItem('allowMemberManage') === 'true');

  const active = tickets[selectedStory];
  const activeStoryIdRef = useRef(active?.id);
  activeStoryIdRef.current = active?.id;
  const cards = useMemo(() => scales[votingSystem] || scales.fibonacci, [votingSystem]);
  const revealed = Boolean(active && revealedStories[active.id]);
  const votes = active ? (votesPerStory[active.id] || {}) : {};
  const canManage = isHost || allowMemberManage;

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
          setStoryPoints(payload.storyPoints || {});
          if (payload.votingSystem) {
            setVotingSystem(payload.votingSystem);
            sessionStorage.setItem('votingSystem', payload.votingSystem);
          }
          setAllowMemberManage(Boolean(payload.allowMemberManage));
          sessionStorage.setItem('allowMemberManage', String(Boolean(payload.allowMemberManage)));
          const idx = Math.max(0, Math.min(Number(payload.selectedIndex) || 0, (payload.tickets || []).length - 1));
          setSelectedStory(idx);
          setSelectedVote(null);
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
        if (type === 'storySelected') {
          setSelectedStory(Math.max(0, Number(payload.storyIndex) || 0));
          setSelectedVote(null);
        }
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
          if (activeStoryIdRef.current === payload.storyId) setSelectedVote(payload.vote);
        }
        if (type === 'votesRevealed' && payload.storyId) {
          setRevealedStories((old) => ({ ...old, [payload.storyId]: true }));
        }
        if (type === 'votesReset' && payload.storyId) {
          setRevealedStories((old) => ({ ...old, [payload.storyId]: false }));
          setVotesPerStory((old) => ({ ...old, [payload.storyId]: {} }));
          if (activeStoryIdRef.current === payload.storyId) setSelectedVote(null);
        }
        if (type === 'sessionPermissionsUpdate') {
          setAllowMemberManage(Boolean(payload.allowMemberManage));
          sessionStorage.setItem('allowMemberManage', String(Boolean(payload.allowMemberManage)));
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
          setIsHost(false);
          sessionStorage.setItem('isHost', 'false');
          setNotice('Host access is available. You can request to become the host.');
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

  function importStories(importedStories) {
    if (!canManage || !Array.isArray(importedStories)) return;
    const existing = new Set(tickets.map((ticket) => ticket.id));
    const fresh = importedStories.filter((ticket) => ticket?.id && !existing.has(ticket.id));
    if (!fresh.length) {
      setNotice('All selected stories are already in this session.');
      return;
    }
    fresh.forEach((ticket) => window.roomSocket?.emit('addTicket', ticket));
    setTickets((old) => [...old, ...fresh]);
    setNotice(`Added ${fresh.length} stories to the session.`);
  }

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

  function requestHost() {
    const socket = window.roomSocket;
    if (!socket?.connected || hostRequestBusy) {
      setNotice('You must be connected to request host access.');
      return;
    }
    setHostRequestBusy(true);
    socket.emit('requestHost', { sessionId: roomId }, (response = {}) => {
      setHostRequestBusy(false);
      if (!response.allowed) setNotice(response.reason || 'Host access could not be granted.');
      else {
        setIsHost(true);
        sessionStorage.setItem('isHost', 'true');
        setNotice('You are now the session host.');
      }
    });
  }

  function releaseHost() {
    if (!isHost) return;
    window.roomSocket?.emit('releaseHost', { sessionId: roomId });
    setIsHost(false);
    sessionStorage.setItem('isHost', 'false');
    setNotice('You have released host access.');
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
  const voteFrequency = Object.values(votes).reduce((counts, value) => {
    const key = String(value);
    counts[key] = (counts[key] || 0) + 1;
    return counts;
  }, {});
  const mostCommonVote = Object.entries(voteFrequency).sort((a, b) => b[1] - a[1])[0]?.[0] || '—';
  const numericVotes = Object.values(votes).map((value) => value === '½' ? 0.5 : Number(value)).filter(Number.isFinite);
  const averageVote = numericVotes.length
    ? (numericVotes.reduce((sum, value) => sum + value, 0) / numericVotes.length).toFixed(1)
    : '—';
  const agreement = Object.keys(votes).length
    ? Math.round((Math.max(0, ...Object.values(voteFrequency)) / Object.keys(votes).length) * 100)
    : 0;

  return <div className="legacy-session">
    <header className="legacy-header">
      <a className="legacy-logo" href="/"><img src="/assets/about/spade_1.png" alt=""/> <span>Simply Poker</span></a>
      <div className="legacy-nav"><span className={`legacy-connection ${connected?'online':'offline'}`}>{connected?<Wifi size={13}/>:<WifiOff size={13}/>} {status}</span><button className="legacy-invite" onClick={copy}><Copy size={15}/> Invite Others</button><div className="legacy-user"><span className="legacy-avatar">{(userName||'U').slice(0,1).toUpperCase()}</span>{userName||'User'}</div><SessionTimer/><ProfileMenu userName={userName} isHost={isHost} onNotice={setNotice} onLeave={()=>{sessionStorage.clear();navigate('/');}}/></div>
    </header>
    <div className="legacy-session-toolbar"><div className="legacy-room-label"><small>ROOM</small><strong>{roomId}</strong></div><div className="legacy-toolbar-actions">{isHost?<button onClick={releaseHost}>Release host</button>:<button onClick={requestHost} disabled={hostRequestBusy||!connected}>{hostRequestBusy?'Requesting…':'Become host'}</button>}<DataImportExport canManage={canManage} tickets={tickets} votesPerStory={votesPerStory} revealedStories={revealedStories} onImportStories={importStories} onNotice={setNotice}/></div></div>
    {notice&&<div className="legacy-notice" role="status">{notice}</div>}
    <main className="legacy-workspace">
      <aside className="legacy-sidebar"><h3>Current Members <span>{users.length}</span></h3><div className="legacy-members">{users.map((p,i)=><div className={`legacy-member ${votes[p.id]!==undefined?'voted':''}`} key={p.id||i}><span className="legacy-member-avatar">{(p.name||'?').slice(0,1).toUpperCase()}</span><span className="legacy-member-name">{p.name||'Member'}{p.id===window.roomSocket?.id?' (You)':''}</span><span className="legacy-member-vote">{revealed?String(votes[p.id]??''):(votes[p.id]!==undefined?'✓':'')}</span></div>)}{!users.length&&<p className="legacy-muted">Waiting for participants…</p>}</div>
      {isHost&&<div className="legacy-controls"><button onClick={reveal} disabled={!active||revealed}>Reveal Votes</button><button onClick={reset} disabled={!active}>Reset Votes</button><label><input type="checkbox" checked={allowMemberManage} onChange={e=>{const value=e.target.checked;setAllowMemberManage(value);sessionStorage.setItem('allowMemberManage',String(value));window.roomSocket?.emit('setSessionPermissions',{allowMemberManage:value});}}/> Allow members to manage stories</label></div>}
      <div className="legacy-session-id"><small>SESSION ID</small><strong>{roomId}</strong><button onClick={copy}><Copy size={13}/> Copy invite link</button></div></aside>
      <section className="legacy-main">
        <div className="legacy-current-story"><div className="legacy-current-heading"><span>CURRENT STORY</span><span>{active?`Story ${selectedStory+1} of ${tickets.length}`:'No story selected'}</span></div>{active?<><h2>{active.idDisplay&&<b>{active.idDisplay}: </b>}{active.text||active.title||'Untitled story'}</h2>{active.descriptionDisplay&&<p>{active.descriptionDisplay}</p>}<div className="legacy-story-points">Story points: <strong>{storyPoints[active.id]??active.points??'?'}</strong></div>{canManage&&<div className="legacy-story-tools"><button onClick={()=>{setEditingId(active.id);setEditingText(active.text||'');}}><Pencil size={14}/> Edit</button><button onClick={()=>deleteStory(active)}><Trash2 size={14}/> Delete</button><label>Points <input defaultValue={storyPoints[active.id]??active.points??'?'} onBlur={e=>updatePoints(active,e.target.value)} onKeyDown={e=>{if(e.key==='Enter')e.currentTarget.blur();}}/></label></div>}{editingId===active.id&&<div className="legacy-edit"><input value={editingText} onChange={e=>setEditingText(e.target.value)} onKeyDown={e=>{if(e.key==='Enter')saveEdit(active);if(e.key==='Escape')setEditingId(null);}}/><button onClick={()=>saveEdit(active)}>Save</button><button onClick={()=>setEditingId(null)}>Cancel</button></div>}</>:<div className="legacy-empty">No stories available. Please add stories to start voting.</div>}</div>
        <div className="legacy-user-circle"><div className="legacy-table-members">{users.map((p,i)=><div className="legacy-table-person" key={p.id||i}><span className={`legacy-table-avatar ${votes[p.id]!==undefined?'has-voted':''}`}>{(p.name||'?').slice(0,1).toUpperCase()}</span><span className="legacy-table-name">{p.name||'Member'}</span><span className="legacy-table-vote">{revealed?String(votes[p.id]??'—'):(votes[p.id]!==undefined?'✓':'…')}</span></div>)}</div></div>
        <section className="legacy-planning-cards"><h3>Planning Cards</h3><div className="legacy-cards">{isHost&&<select value={votingSystem} onChange={e=>changeScale(e.target.value)}><option value="fibonacci">Fibonacci</option><option value="shortFib">Short Fibonacci</option><option value="tshirt">T-Shirt sizes</option><option value="tshirtNum">T-Shirt + numbers</option><option value="custom">Custom</option></select>}{cards.map(card=><button key={card} className={`legacy-card ${selectedVote===card?'selected':''}`} onClick={()=>vote(card)} disabled={!active||revealed}>{card}</button>)}</div>{selectedVote!==null&&<small className="legacy-vote-confirmation">Your vote has been submitted</small>}</section>
        {revealed&&<section className="legacy-results"><h3>Voting results</h3><div className="legacy-result-stats"><span>Votes <b>{visibleVotes.length}</b></span><span>Most common <b>{mostCommonVote}</b></span><span>Average <b>{averageVote}</b></span><span>Agreement <b>{agreement}%</b></span></div><div className="legacy-result-votes">{visibleVotes.map(v=><span key={v.id}>{v.name}: <b>{String(v.value)}</b></span>)}</div></section>}
      </section>
      <aside className="legacy-rightbar"><div className="legacy-search"><input type="search" value={storySearch} onChange={e=>setStorySearch(e.target.value)} placeholder="Search and filter tickets…"/><span>⌕</span></div>{canManage&&<button className="legacy-add-ticket" onClick={()=>{setEditingId('new');setEditingText('');}}><span>+</span> ADD TICKET</button>}{editingId==='new'&&<form className="legacy-new-ticket" onSubmit={e=>{e.preventDefault();const value=editingText.trim();if(!value)return;const ticketData={id:`story_${Date.now()}_${Math.random().toString(36).slice(2,7)}`,text:value,points:'?'};window.roomSocket?.emit('addTicket',ticketData);setTickets(old=>[...old,ticketData]);setEditingText('');setEditingId(null);}}><input autoFocus value={editingText} onChange={e=>setEditingText(e.target.value)} placeholder="Ticket title"/><button>Add</button><button type="button" onClick={()=>setEditingId(null)}>×</button></form>}<div className="legacy-story-list">{tickets.map((ticket,index)=>({ticket,index})).filter(({ticket})=>`${ticket.text||ticket.title||''} ${ticket.idDisplay||''}`.toLowerCase().includes(storySearch.toLowerCase())).map(({ticket,index})=><article key={ticket.id} className={`legacy-story-card ${index===selectedStory?'active':''}`} onClick={()=>selectStory(index)} onKeyDown={e=>{if(e.key==='Enter')selectStory(index);}} role="button" tabIndex={0}>{ticket.idDisplay&&<span className="legacy-story-id">{ticket.idDisplay}</span>}<div className="legacy-story-title">{ticket.text||ticket.title||'Untitled story'}</div><div className="legacy-story-meta"><span>👥 {Object.keys(votesPerStory[ticket.id]||{}).length} votes</span><strong>{storyPoints[ticket.id]??ticket.points??'?'}</strong></div>{canManage&&<div className="legacy-card-actions"><button onClick={e=>{e.stopPropagation();setEditingId(ticket.id);setEditingText(ticket.text||'');}} aria-label="Edit"><Pencil size={13}/></button><button onClick={e=>{e.stopPropagation();deleteStory(ticket);}} aria-label="Delete"><Trash2 size={13}/></button></div>}</article>)}{!tickets.length&&<p className="legacy-muted">No stories have been added yet.</p>}</div><div className="legacy-navigation"><button onClick={()=>selectStory(selectedStory-1)} disabled={selectedStory<=0}>Previous Story</button><button onClick={()=>selectStory(selectedStory+1)} disabled={selectedStory>=tickets.length-1}>Next Story</button></div></aside>
    </main><FeedbackWidget/>
  </div>;
}
