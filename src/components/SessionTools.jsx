import { useEffect, useState } from 'react';
import { Clock3, MessageSquareText, UserCircle, X } from 'lucide-react';

const LANGUAGES = [
  ['en','English'],['es','Español'],['fr','Français'],['de','Deutsch'],['it','Italiano'],['pt','Português'],
  ['ru','Русский'],['ja','日本語'],['ko','한국어'],['zh','中文'],['ar','العربية'],['hi','हिन्दी'],
  ['nl','Nederlands'],['sv','Svenska'],['da','Dansk'],['no','Norsk'],['fi','Suomi'],['pl','Polski'],['tr','Türkçe'],['th','ไทย']
];

export function ProfileMenu({ userName, isHost, onLeave }) {
  const [open,setOpen]=useState(false);
  const [language,setLanguage]=useState(localStorage.getItem('selectedLanguage')||'en');
  const [showLanguages,setShowLanguages]=useState(false);
  function changeLanguage(value){setLanguage(value);localStorage.setItem('selectedLanguage',value);setShowLanguages(false);}
  return <div className="profile-tools">
    <button className="profile-trigger" onClick={()=>setOpen(v=>!v)} aria-expanded={open}><UserCircle size={19}/><span>{userName||'User'}</span></button>
    {open&&<div className="profile-dropdown">
      <strong>{userName||'User'}</strong><small>{isHost?'Session host':'Session participant'}</small>
      <button onClick={()=>setShowLanguages(v=>!v)}>Language preference <span>{LANGUAGES.find(x=>x[0]===language)?.[1]||'English'}</span></button>
      {showLanguages&&<div className="language-options">{LANGUAGES.map(([code,label])=><button key={code} className={language===code?'selected':''} onClick={()=>changeLanguage(code)}>{label}</button>)}</div>}
      <button className="profile-leave" onClick={onLeave}>Leave session</button>
    </div>}
  </div>;
}

export function SessionTimer() {
  const [open,setOpen]=useState(false);
  const [minutes,setMinutes]=useState(10);
  const [seconds,setSeconds]=useState(600);
  const [running,setRunning]=useState(false);
  useEffect(()=>{if(!running)return undefined;const id=window.setInterval(()=>setSeconds(s=>{if(s<=1){setRunning(false);return 0;}return s-1;}),1000);return()=>window.clearInterval(id);},[running]);
  function start(){if(seconds===0)setSeconds(minutes*60);setRunning(true);}
  function reset(){setRunning(false);setSeconds(minutes*60);}
  const display=`${Math.floor(seconds/60).toString().padStart(2,'0')}:${(seconds%60).toString().padStart(2,'0')}`;
  return <div className="session-timer-wrap"><button className="timer-trigger" onClick={()=>setOpen(v=>!v)}><Clock3 size={15}/> Timer</button>{open&&<div className="timer-popover"><div className="timer-top"><strong>Session timer</strong><button onClick={()=>setOpen(false)} aria-label="Close timer"><X size={16}/></button></div><div className="timer-display">{display}</div><label>Duration<select value={minutes} disabled={running} onChange={e=>{setMinutes(Number(e.target.value));setSeconds(Number(e.target.value)*60);}}>{[5,10,15,30,60].map(n=><option value={n} key={n}>{n} minutes</option>)}</select></label><div className="timer-actions"><button onClick={running?()=>setRunning(false):start}>{running?'Pause':seconds===minutes*60?'Start':'Resume'}</button><button onClick={reset}>Reset</button></div>{seconds===0&&<small role="status">Time is up.</small>}</div>}</div>;
}

export function FeedbackWidget() {
  const [open,setOpen]=useState(false),[emoji,setEmoji]=useState(''),[message,setMessage]=useState(''),[email,setEmail]=useState(''),[status,setStatus]=useState(''),[busy,setBusy]=useState(false);
  async function submit(){if(!emoji&&!message.trim()){setStatus('Please select an emoji or write feedback.');return;}setBusy(true);setStatus('');try{const r=await fetch('/api/feedback',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({emoji,feedback:message,email})});const data=await r.json().catch(()=>({}));if(!r.ok)throw new Error(data.error||'Could not send feedback.');setStatus('Thank you for your feedback.');setMessage('');setEmoji('');}catch(e){setStatus(e.message||'Something went wrong.');}finally{setBusy(false);}}
  return <><button className="feedback-fab" onClick={()=>setOpen(true)}><MessageSquareText size={16}/> Feedback</button>{open&&<div className="data-modal-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)setOpen(false);}}><section className="data-modal feedback-modal" role="dialog" aria-modal="true" aria-labelledby="feedback-title"><header className="data-modal-header"><h2 id="feedback-title">Share your feedback</h2><button className="data-modal-close" onClick={()=>setOpen(false)}><X size={18}/></button></header><div className="data-modal-body"><p className="data-help">How was your experience using Simply Poker?</p><div className="feedback-emojis">{['😞','😐','🙂','😊','😍'].map(x=><button className={emoji===x?'chosen':''} key={x} onClick={()=>setEmoji(x)}>{x}</button>)}</div><label className="feedback-label">Your feedback<textarea rows="4" value={message} onChange={e=>setMessage(e.target.value)} placeholder="Tell us what worked well or what we could improve…"/></label><label className="feedback-label">Email (optional)<input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@example.com"/></label>{status&&<p className="data-help" role="status">{status}</p>}<div className="data-modal-actions"><button className="data-secondary" onClick={()=>setOpen(false)}>Close</button><button className="data-primary" disabled={busy} onClick={submit}>{busy?'Sending…':'Send feedback'}</button></div></div></section></div>}</>;
}
