import { useEffect, useState } from 'react';
import { Clock3, Languages, LogOut, MessageSquare, Settings, UserRound, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const languages = [
  ['en','🇺🇸','English'],['es','🇪🇸','Español'],['fr','🇫🇷','Français'],['de','🇩🇪','Deutsch'],
  ['it','🇮🇹','Italiano'],['pt','🇵🇹','Português'],['ru','🇷🇺','Русский'],['ja','🇯🇵','日本語'],
  ['ko','🇰🇷','한국어'],['zh','🇨🇳','中文'],['ar','🇸🇦','العربية'],['hi','🇮🇳','हिन्दी'],
  ['nl','🇳🇱','Nederlands'],['sv','🇸🇪','Svenska'],['da','🇩🇰','Dansk'],['no','🇳🇴','Norsk'],
  ['fi','🇫🇮','Suomi'],['pl','🇵🇱','Polski'],['tr','🇹🇷','Türkçe'],['th','🇹🇭','ไทย'],
];

export function ProfileMenu({ isHost, onNotice }) {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [modal, setModal] = useState('');
  const [language, setLanguage] = useState(localStorage.getItem('selectedLanguage') || 'en');
  const [email, setEmail] = useState(sessionStorage.getItem('userEmail') || '');
  const [feedback, setFeedback] = useState('');
  const [emoji, setEmoji] = useState('');
  const [sending, setSending] = useState(false);
  const name = sessionStorage.getItem('userName') || 'User';

  async function submitFeedback(event) {
    event.preventDefault();
    if (!feedback.trim()) return;
    setSending(true);
    try {
      const response = await fetch('/api/feedback', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ emoji, feedback: feedback.trim(), email: email.trim() }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Unable to send feedback.');
      onNotice?.('Thank you for your feedback.');
      setModal('');
      setFeedback('');
      setEmoji('');
    } catch (error) {
      onNotice?.(error.message || 'Feedback could not be sent. Please try again.');
    } finally { setSending(false); }
  }

  function saveLanguage() {
    localStorage.setItem('selectedLanguage', language);
    onNotice?.('Language preference saved. Interface translation is not yet enabled in this React migration.');
    setModal('');
  }

  function logout() {
    sessionStorage.clear();
    navigate('/about');
  }

  return <div className="profile-area">
    <button className="profile-trigger" onClick={() => setOpen((value) => !value)} aria-expanded={open}>
      <span className="profile-avatar">{name.slice(0,1).toUpperCase()}</span><span className="profile-trigger-name">{name}</span><span aria-hidden="true">⌄</span>
    </button>
    {open && <><button className="profile-dismiss" aria-label="Close profile menu" onClick={() => setOpen(false)} />
      <div className="profile-dropdown">
        <div className="profile-summary"><span className="profile-avatar large">{name.slice(0,1).toUpperCase()}</span><div><b>{name}</b><small>{email || (isHost ? 'Session host' : 'Session participant')}</small></div></div>
        <button onClick={() => { setOpen(false); setModal('language'); }}><Languages size={16}/> Language preferences</button>
        <button onClick={() => { setOpen(false); setModal('feedback'); }}><MessageSquare size={16}/> Send feedback</button>
        <button onClick={() => { setOpen(false); navigate('/about'); }}><Settings size={16}/> About &amp; help</button>
        <button className="profile-logout" onClick={logout}><LogOut size={16}/> Leave session</button>
      </div>
    </>}
    {modal === 'language' && <div className="utility-backdrop" onMouseDown={(e) => e.target === e.currentTarget && setModal('')}><section className="utility-modal" role="dialog" aria-modal="true" aria-labelledby="language-title"><header><div><p className="eyebrow">PREFERENCES</p><h2 id="language-title">Language preferences</h2></div><button className="utility-close" onClick={() => setModal('')} aria-label="Close"><X/></button></header><p className="utility-copy">Choose your preferred language. Your selection is saved in this browser. Full interface translation is not yet connected in the React version.</p><div className="language-grid">{languages.map(([code,flag,label]) => <label key={code} className={language === code ? 'language-choice selected' : 'language-choice'}><input type="radio" name="language" value={code} checked={language === code} onChange={() => setLanguage(code)}/><span>{flag}</span><span>{label}</span></label>)}</div><div className="utility-actions"><button className="utility-secondary" onClick={() => setModal('')}>Cancel</button><button className="utility-primary" onClick={saveLanguage}>Save preference</button></div></section></div>}
    {modal === 'feedback' && <div className="utility-backdrop" onMouseDown={(e) => e.target === e.currentTarget && setModal('')}><section className="utility-modal feedback-modal" role="dialog" aria-modal="true" aria-labelledby="feedback-title"><header><div><p className="eyebrow">HELP US IMPROVE</p><h2 id="feedback-title">Share your feedback</h2></div><button className="utility-close" onClick={() => setModal('')} aria-label="Close"><X/></button></header><p className="utility-copy">How was your experience using Simply Poker?</p><div className="feedback-emojis">{['😞','😐','🙂','😊','🤩'].map((value) => <button type="button" key={value} className={emoji === value ? 'selected' : ''} onClick={() => setEmoji(value)} aria-label={value}>{value}</button>)}</div><form onSubmit={submitFeedback}><label>Your feedback<textarea rows="4" value={feedback} onChange={(e) => setFeedback(e.target.value)} placeholder="Tell us what worked well or what we could improve…" /></label><label>Email (optional)<input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@example.com"/></label><div className="utility-actions"><button type="button" className="utility-secondary" onClick={() => setModal('')}>Cancel</button><button className="utility-primary" disabled={sending || (!feedback.trim() && !emoji)}>{sending ? 'Sending…' : 'Submit feedback'}</button></div></form></section></div>}
  </div>;
}

export function SessionTimer({ onNotice }) {
  const [duration, setDuration] = useState(10);
  const [remaining, setRemaining] = useState(600);
  const [running, setRunning] = useState(false);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    if (!running) return undefined;
    const timer = window.setInterval(() => setRemaining((value) => {
      if (value <= 1) { window.clearInterval(timer); setRunning(false); onNotice?.('Session timer finished.'); return 0; }
      return value - 1;
    }), 1000);
    return () => window.clearInterval(timer);
  }, [running, onNotice]);
  const formatted = `${String(Math.floor(remaining / 60)).padStart(2,'0')}:${String(remaining % 60).padStart(2,'0')}`;
  function choose(value) { setDuration(value); setRemaining(value * 60); setRunning(false); }
  return <div className="timer-area"><button className="icon-button timer-trigger" onClick={() => setVisible((value) => !value)} aria-label="Session timer"><Clock3 size={17}/><span>Timer</span></button>{visible && <div className="timer-popover"><div className="timer-popover-head"><b>Session timer</b><button onClick={() => setVisible(false)} aria-label="Close timer">×</button></div><div className="timer-display">{formatted}</div><label>Duration<select value={duration} onChange={(e) => choose(Number(e.target.value))}>{[5,10,15,30,60].map((n) => <option value={n} key={n}>{n} minutes</option>)}</select></label><div className="timer-actions"><button onClick={() => setRunning((value) => !value)} disabled={remaining === 0}>{running ? 'Pause' : 'Start'}</button><button onClick={() => {setRunning(false);setRemaining(duration * 60);}}>Reset</button></div></div>}</div>;
}
