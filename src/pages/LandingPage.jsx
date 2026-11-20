import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import '../landing.css';

const scales = [
  ['fibonacci', 'Fibonacci (0, 1, 2, 3, 5, 8, 13, 21...)'],
  ['shortFib', 'Short Fibonacci (0, ½, 1, 2, 3...)'],
  ['tshirt', 'T-Shirt Sizes (XXS, XS, S, M...)'],
  ['tshirtNum', 'T-Shirt & Numbers'],
  ['custom', 'Custom'],
];

const members = [
  { name: 'TM1', estimate: '3' }, { name: 'TM2', estimate: '5' },
  { name: 'TM3', estimate: '8' }, { name: 'TM4', estimate: '5' },
  { name: 'TM5', estimate: '3' }, { name: 'TM6', estimate: '5' },
  { name: 'TM7', estimate: '8' }, { name: 'TM8', estimate: '3' },
];

export default function LandingPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState('create');
  const [name, setName] = useState(sessionStorage.getItem('userName') || '');
  const [sessionName, setSessionName] = useState('');
  const [roomId, setRoomId] = useState('');
  const [scale, setScale] = useState('fibonacci');
  const [allowManage, setAllowManage] = useState(false);
  const [requestHost, setRequestHost] = useState(false);
  const [selectedMember, setSelectedMember] = useState(0);
  const [showAll, setShowAll] = useState(false);
  const [error, setError] = useState('');
  const [pulse, setPulse] = useState(false);
  useEffect(() => {
    const steps = [0, 2, 4, 'all'];
    const ids = steps.map((step, i) => setTimeout(() => {
      if (step === 'all') { setShowAll(true); setSelectedMember(4); setPulse(true); setTimeout(() => setPulse(false), 650); }
      else { setSelectedMember(step); setShowAll(false); }
    }, 1000 + i * 800));
    return () => ids.forEach(clearTimeout);
  }, []);

  function submit(event) {
    event.preventDefault();
    if (!name.trim()) return setError('Please enter your name.');
    if (mode === 'create' && !sessionName.trim()) return setError('Please enter a session name.');
    if (mode === 'join' && !roomId.trim()) return setError('Please enter a session ID.');

    sessionStorage.setItem('userName', name.trim());
    if (mode === 'create') {
      const id = crypto.randomUUID().replaceAll('-', '').slice(0, 8);
      sessionStorage.setItem('sessionName', sessionName.trim());
      sessionStorage.setItem('votingSystem', scale);
      sessionStorage.setItem('allowMemberManage', String(allowManage));
      sessionStorage.setItem('isHost', 'true');
      sessionStorage.setItem('isRoomCreator', 'true');
      navigate('/session/' + id);
    } else {
      sessionStorage.setItem('requestedHost', String(requestHost));
      sessionStorage.setItem('isRoomCreator', 'false');
      sessionStorage.setItem('isHost', 'false');
      navigate('/session/' + encodeURIComponent(roomId.trim()));
    }
  }

  return (
    <div className="legacy-landing">
      <header className="legacy-header">
        <div className="logo">
          <img src="/assets/about/spade_1.png" alt="Simply Poker" />
          <span className="logo-text">Simply Poker</span>
        </div>
        <div className="header-buttons">
          <a href="/" className="button home-button"><i className="fas fa-home" /> HOME</a>
          <button type="button" className="button primary-button" onClick={() => { setMode('create'); setError(''); }}>
            <i className="fas fa-plus" /> NEW SESSION
          </button>
          <button type="button" className="button secondary-button" onClick={() => { setMode('join'); setError(''); }}>
            <i className="fas fa-sign-in-alt" /> JOIN SESSION
          </button>
        </div>
      </header>

      <main className="legacy-main">
        <div className="content-container">
          <section className="visual-container">
            <h2 className="concept-title">Collaborative Estimation</h2>
            <span className="purple-underline" />
            <div className="agile-visualization">
              <div className="collaboration-diagram">
                {members.map((member, index) => {
                  const angle = (index * 45 - 90) * Math.PI / 180;
                  const radius = 160;
                  return (
                    <div key={member.name}>
                      <div className="connection-line" style={{ width: '130px', transform: `rotate(${angle}rad)` }} />
                      {showAll && <div className="estimate-bubble visible" style={{ transitionDelay: `${index * 100}ms`, left: `calc(50% + ${Math.cos(angle) * 105}px - 20px)`, top: `calc(50% + ${Math.sin(angle) * 105}px - 15px)` }}>{member.estimate}</div>}
                      <button type="button" className={`team-member ${selectedMember === index ? 'member-selected' : ''}`}
                        style={{ left: `calc(50% + ${Math.cos(angle) * radius}px - 30px)`, top: `calc(50% + ${Math.sin(angle) * radius}px - 30px)` }}
                        onClick={() => { setSelectedMember(index); setShowAll(false); }} aria-label={`${member.name}, estimate ${member.estimate}`}>
                        {member.name}
                      </button>
                    </div>
                  );
                })}
                {!showAll && <div className="estimate-bubble visible selected-estimate" style={{ left: `calc(50% + ${Math.cos((selectedMember * 45 - 90) * Math.PI / 180) * 105}px - 20px)`, top: `calc(50% + ${Math.sin((selectedMember * 45 - 90) * Math.PI / 180) * 105}px - 15px)` }}>{members[selectedMember].estimate}</div>}
                <button type="button" className={`central-node ${pulse ? 'pulse' : ''}`} onClick={() => { setShowAll(value => !value); setSelectedMember(0); setPulse(true); setTimeout(() => setPulse(false), 650); }}>Planning<br />Poker</button>
              </div>
              <p className="feature-text">Create a <span>collaborative environment</span> where team members can estimate together in real-time</p>
            </div>
          </section>

          <section className="forms-container">
            {mode === 'create' ? (
              <div className="session-box">
                <h2>Create new session<span className="green-underline" /></h2>
                <form onSubmit={submit}>
                  <div className="form-group">
                    <label htmlFor="sessionNameInput">Session name *</label>
                    <input id="sessionNameInput" value={sessionName} onChange={e => setSessionName(e.target.value)} placeholder="Give your session a memorable name" maxLength={80} />
                  </div>
                  <div className="form-group">
                    <label htmlFor="createNameInput">Your name *</label>
                    <input id="createNameInput" value={name} onChange={e => setName(e.target.value)} placeholder="How should we call you?" maxLength={40} />
                  </div>
                  <div className="scale-options">
                    <h3>Choose your estimation scale:</h3>
                    {scales.map(([value, label]) => (
                      <div className="radio-group" key={value}>
                        <input type="radio" name="scale" id={value} checked={scale === value} onChange={() => setScale(value)} />
                        <label htmlFor={value}>{label}</label>
                      </div>
                    ))}
                  </div>
                  <div className="checkbox-container">
                    <input type="checkbox" id="allowManage" checked={allowManage} onChange={e => setAllowManage(e.target.checked)} />
                    <label htmlFor="allowManage">Allow members to manage session</label>
                  </div>
                  {error && <p className="legacy-form-error" role="alert">{error}</p>}
                  <button className="action-button" type="submit">Start new session</button>
                </form>
              </div>
            ) : (
              <div className="session-box">
                <h2>Join a Session<span className="green-underline" /></h2>
                <form onSubmit={submit}>
                  <div className="form-group">
                    <label htmlFor="sessionIdInput">Session ID *</label>
                    <input id="sessionIdInput" value={roomId} onChange={e => setRoomId(e.target.value)} placeholder="Enter the session ID you received" />
                  </div>
                  <div className="form-group">
                    <label htmlFor="joinNameInput">Your name *</label>
                    <input id="joinNameInput" value={name} onChange={e => setName(e.target.value)} placeholder="How should we call you?" maxLength={40} />
                  </div>
                  <div className="checkbox-container">
                    <input type="checkbox" id="allowJoinAsHost" checked={requestHost} onChange={e => setRequestHost(e.target.checked)} />
                    <label htmlFor="allowJoinAsHost">Allow members to Join a session as Host</label>
                  </div>
                  {error && <p className="legacy-form-error" role="alert">{error}</p>}
                  <button className="action-button" type="submit">Join session</button>
                </form>
              </div>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}
