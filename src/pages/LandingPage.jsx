import { useEffect, useRef, useState } from 'react';
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
  const diagramRef = useRef(null);
  const [diagramSize, setDiagramSize] = useState(380);
  const [mode, setMode] = useState('create');
  const [name, setName] = useState(sessionStorage.getItem('userName') || '');
  const [sessionName, setSessionName] = useState('');
  const [roomId, setRoomId] = useState('');
  const [scale, setScale] = useState('fibonacci');
  const [allowManage, setAllowManage] = useState(false);
  const [requestHost, setRequestHost] = useState(false);
  const [selectedMember, setSelectedMember] = useState(null);
  const [visibleEstimate, setVisibleEstimate] = useState('none');
  const [error, setError] = useState('');
  const [pulse, setPulse] = useState(false);

  useEffect(() => {
    const element = diagramRef.current;
    if (!element) return undefined;
    const measure = () => {
      const width = element.getBoundingClientRect().width;
      if (width > 0) setDiagramSize(width);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const timers = [];
    const playMember = (index) => {
      setSelectedMember(index);
      setVisibleEstimate(index);
    };
    timers.push(setTimeout(() => playMember(0), 1000));
    timers.push(setTimeout(() => playMember(2), 1800));
    timers.push(setTimeout(() => playMember(4), 2600));
    timers.push(setTimeout(() => {
      setVisibleEstimate('all');
      setPulse(true);
      timers.push(setTimeout(() => setPulse(false), 600));
    }, 3600));
    return () => timers.forEach(clearTimeout);
  }, []);

  function submit(event) {
    event.preventDefault();
    setError('');
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

  const radius = diagramSize / 2 - 30;
  const lineLength = radius - 30;
  const bubbleRadius = radius / 1.5;

  function selectMember(index) {
    setSelectedMember(index);
    setVisibleEstimate(index);
  }

  function revealAll() {
    setVisibleEstimate('all');
    setPulse(true);
    window.setTimeout(() => setPulse(false), 600);
  }

  return (
    <div id="landing-page">
      <header>
        <div className="logo">
          <img src="/assets/about/spade_1.png" alt="Simply Poker" />
          <span className="logo-text">Simply Poker</span>
        </div>
        <div className="header-buttons">
          <a href="/" className="button home-button"><i className="fas fa-home" aria-hidden="true" /> HOME</a>
          <button type="button" id="newSessionBtn" className="button primary-button" onClick={() => { setMode('create'); setError(''); }}>
            <i className="fas fa-plus" aria-hidden="true" /> NEW SESSION
          </button>
          <button type="button" id="joinSessionBtn" className="button secondary-button" onClick={() => { setMode('join'); setError(''); }}>
            <i className="fas fa-sign-in-alt" aria-hidden="true" /> JOIN SESSION
          </button>
        </div>
      </header>

      <main>
        <div className="content-container">
          <section className="visual-container">
            <h2 className="concept-title">Collaborative Estimation</h2>
            <span className="purple-underline" />
            <div className="agile-visualization" id="agileVisualization">
              <div className="collaboration-diagram" ref={diagramRef}>
                {members.map((member, index) => (
                  <button
                    key={member.name}
                    type="button"
                    className={`team-member${selectedMember === index ? ' member-selected' : ''}`}
                    data-estimate={member.estimate}
                    onClick={() => selectMember(index)}
                    aria-label={`${member.name}, estimate ${member.estimate}`}
                  >
                    {member.name}
                  </button>
                ))}
                {members.map((member, index) => {
                  const angle = index * (360 / members.length) * Math.PI / 180;
                  const bubbleX = Math.cos(angle) * bubbleRadius;
                  const bubbleY = Math.sin(angle) * bubbleRadius;
                  return (
                    <div key={`diagram-decoration-${member.name}`}>
                      <div className="connection-line" style={{ width: `${lineLength}px`, transform: `rotate(${angle}rad)` }} />
                      <div
                        className={`estimate-bubble${visibleEstimate === 'all' || visibleEstimate === index ? ' is-visible' : ''}`}
                        style={{ left: `calc(50% + ${bubbleX}px - 20px)`, top: `calc(50% + ${bubbleY}px - 15px)`, transitionDelay: visibleEstimate === 'all' ? `${index * 100}ms` : '0ms' }}
                        aria-hidden={visibleEstimate !== 'all' && visibleEstimate !== index}
                      >
                        {member.estimate}
                      </div>
                    </div>
                  );
                })}
                <button type="button" className={`central-node${pulse ? ' is-pulsing' : ''}`} onClick={revealAll}>
                  Planning<br />Poker
                </button>
              </div>
              <p className="feature-text">Create a <span>collaborative environment</span> where team members can estimate together in real-time</p>
            </div>
          </section>

          <section className="forms-container">
            {mode === 'create' ? (
              <div className="session-box" id="createSessionBox">
                <h2>Create new session<span className="green-underline" /></h2>
                <form onSubmit={submit}>
                  <div className="form-group">
                    <label htmlFor="sessionNameInput">Session name *</label>
                    <input id="sessionNameInput" type="text" value={sessionName} onChange={e => setSessionName(e.target.value)} placeholder="Give your session a memorable name" maxLength={80} />
                  </div>
                  <div className="form-group">
                    <label htmlFor="createNameInput">Your name *</label>
                    <input id="createNameInput" type="text" value={name} onChange={e => setName(e.target.value)} placeholder="How should we call you?" maxLength={40} />
                  </div>
                  <div className="scale-options">
                    <h3>Choose your estimation scale:</h3>
                    {scales.map(([value, label]) => (
                      <div className="radio-group" key={value}>
                        <input type="radio" name="scale" id={value} value={value} checked={scale === value} onChange={() => setScale(value)} />
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
              <div className="session-box" id="joinSessionBox">
                <h2>Join a Session<span className="green-underline" /></h2>
                <form onSubmit={submit}>
                  <div className="form-group">
                    <label htmlFor="sessionIdInput">Session ID *</label>
                    <input id="sessionIdInput" type="text" value={roomId} onChange={e => setRoomId(e.target.value)} placeholder="Enter the session ID you received" />
                  </div>
                  <div className="form-group">
                    <label htmlFor="joinNameInput">Your name *</label>
                    <input id="joinNameInput" type="text" value={name} onChange={e => setName(e.target.value)} placeholder="How should we call you?" maxLength={40} />
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
