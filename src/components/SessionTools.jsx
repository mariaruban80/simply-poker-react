import { useEffect, useRef, useState } from 'react';
import { Clock3, MessageSquareText, UserCircle, X, Languages, ShieldCheck, Upload, Download, Link2, LogOut } from 'lucide-react';

const LANGUAGES = [
  ['en','English','🇬🇧'],['es','Español','🇪🇸'],['fr','Français','🇫🇷'],['de','Deutsch','🇩🇪'],['it','Italiano','🇮🇹'],
  ['pt','Português','🇵🇹'],['ru','Русский','🇷🇺'],['ja','日本語','🇯🇵'],['ko','한국어','🇰🇷'],['zh','中文','🇨🇳'],
  ['ar','العربية','🇸🇦'],['hi','हिन्दी','🇮🇳'],['nl','Nederlands','🇳🇱'],['sv','Svenska','🇸🇪'],['da','Dansk','🇩🇰'],
  ['no','Norsk','🇳🇴'],['fi','Suomi','🇫🇮'],['pl','Polski','🇵🇱'],['tr','Türkçe','🇹🇷'],['th','ไทย','🇹🇭']
];

const originalText = new WeakMap();
const originalPlaceholder = new WeakMap();

async function translateOne(value, language) {
  if (!value || language === 'en') return value;
  try {
    const response = await fetch('https://api.mymemory.translated.net/get?q=' + encodeURIComponent(value) + '&langpair=en|' + language);
    const data = await response.json();
    const translated = data?.responseData?.translatedText;
    return translated && !/MYMEMORY WARNING/i.test(translated) ? translated : value;
  } catch { return value; }
}

async function applyInterfaceLanguage(language) {
  const root = document.querySelector('.legacy-session');
  if (!root) return;
  const excluded = '.no-translate,.legacy-user,.legacy-member-name,.legacy-table-name,.legacy-story-title,.legacy-current-story h2,.legacy-current-story p,input,textarea,select,option,script,style,[contenteditable="true"]';
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const nodes = [];
  while (walker.nextNode()) {
    const node = walker.currentNode;
    const parent = node.parentElement;
    const value = node.nodeValue?.trim();
    if (!value || !parent || parent.closest(excluded)) continue;
    nodes.push(node);
  }
  const placeholders = [...root.querySelectorAll('input[placeholder],textarea[placeholder]')].filter(el => !el.closest(excluded));
  if (language === 'en') {
    nodes.forEach(node => { if (originalText.has(node)) node.nodeValue = originalText.get(node); });
    placeholders.forEach(el => { if (originalPlaceholder.has(el)) el.placeholder = originalPlaceholder.get(el); });
    return;
  }
  const tasks = nodes.map(async node => {
    if (!originalText.has(node)) originalText.set(node,node.nodeValue);
    const translated = await translateOne(originalText.get(node),language);
    if (translated) node.nodeValue = translated;
  });
  const placeholderTasks = placeholders.map(async el => {
    if (!originalPlaceholder.has(el)) originalPlaceholder.set(el,el.placeholder);
    const translated = await translateOne(originalPlaceholder.get(el),language);
    if (translated) el.placeholder = translated;
  });
  for (let i=0;i<tasks.length;i+=8) await Promise.all(tasks.slice(i,i+8));
  for (let i=0;i<placeholderTasks.length;i+=8) await Promise.all(placeholderTasks.slice(i,i+8));
}

export function ProfileMenu({ userName, isHost, onLeave, onNotice, onToggleHost }) {
  const [open,setOpen]=useState(false);
  const menuRef=useRef(null);
  const [language,setLanguage]=useState('en');
  const [pendingLanguage,setPendingLanguage]=useState('en');
  const [showLanguages,setShowLanguages]=useState(false);
  const [translating,setTranslating]=useState(false);
  useEffect(()=>{localStorage.setItem('selectedLanguage','en');setLanguage('en');setPendingLanguage('en');},[]);
  useEffect(()=>{if(!open)return undefined;const outside=(event)=>{if(!menuRef.current?.contains(event.target))setOpen(false);};const key=(event)=>{if(event.key==='Escape')setOpen(false);};document.addEventListener('pointerdown',outside);document.addEventListener('keydown',key);return()=>{document.removeEventListener('pointerdown',outside);document.removeEventListener('keydown',key);};},[open]);
  async function applyLanguage(){
    setTranslating(true);
    try {
      await applyInterfaceLanguage(pendingLanguage);
      setLanguage(pendingLanguage);
      localStorage.setItem('selectedLanguage',pendingLanguage);
      setShowLanguages(false);
      onNotice?.(pendingLanguage==='en'?'Interface language set to English.':`Interface translated to ${LANGUAGES.find(x=>x[0]===pendingLanguage)?.[1]||pendingLanguage}. Some wording may depend on the translation service.`);
    } catch { onNotice?.('Translation could not be completed. Please try again.'); }
    finally { setTranslating(false); }
  }
  return <div className="profile-tools" ref={menuRef}>
    <button className="profile-trigger" onClick={()=>setOpen(v=>!v)} aria-expanded={open} aria-label={`Profile menu for ${userName||'User'}`}><span className="legacy-avatar">{(userName||'U').slice(0,1).toUpperCase()}</span><span className="profile-trigger-name">{userName||'User'}</span><span className="profile-trigger-chevron">⌄</span></button>
    {open&&<div className="profile-dropdown">
      <div className="profile-menu-heading"><span className="profile-menu-avatar">{(userName||'U').slice(0,1).toUpperCase()}</span><span><strong>{userName||'User'}</strong><small>{isHost?'Session host':'Session participant'}</small></span></div>
      <button className="profile-menu-item" onClick={()=>setShowLanguages(v=>!v)}><Languages size={16}/><span>Change language</span><small>{LANGUAGES.find(x=>x[0]===language)?.[1]||'English'}</small></button>
      <button className="profile-menu-item" onClick={()=>{onToggleHost?.();setOpen(false);}}><ShieldCheck size={16}/><span>{isHost?'Release host':'Request host access'}</span><small className={isHost?'profile-status-on':'profile-status-off'}>{isHost?'Host':'Participant'}</small></button>
      {isHost&&<>
        <button className="profile-menu-item" onClick={()=>{setOpen(false);window.dispatchEvent(new CustomEvent('simply-poker:data-action',{detail:'csv'}));}}><Upload size={16}/><span>Import from CSV</span></button>
        <button className="profile-menu-item" onClick={()=>{setOpen(false);window.dispatchEvent(new CustomEvent('simply-poker:data-action',{detail:'jira'}));}}><Link2 size={16}/><span>Import from JIRA</span></button>
        <button className="profile-menu-item" onClick={()=>{setOpen(false);window.dispatchEvent(new CustomEvent('simply-poker:data-action',{detail:'export'}));}}><Download size={16}/><span>Export to CSV</span></button>
      </>}
      {showLanguages&&<div className="language-modal-inline" role="dialog" aria-label="Choose language">
        <div className="language-modal-heading"><strong>Choose your language</strong><button type="button" onClick={()=>setShowLanguages(false)} aria-label="Close"><X size={16}/></button></div>
        <div className="language-options">{LANGUAGES.map(([code,label,flag])=><button type="button" key={code} className={pendingLanguage===code?'selected':''} onClick={()=>setPendingLanguage(code)}><span>{flag}</span><span>{label}</span><small>{code.toUpperCase()}</small></button>)}</div>
        <button className="language-apply" disabled={translating} onClick={applyLanguage}>{translating?'Translating…':'Apply language'}</button>
      </div>}
      <button className="profile-menu-item profile-leave" onClick={onLeave}><LogOut size={16}/><span>Leave session</span></button>
    </div>}
  </div>;
}

export function SessionTimer({ onNotice }) {
  const [open,setOpen]=useState(false);
  const [minutes,setMinutes]=useState(10);
  const [seconds,setSeconds]=useState(600);
  const [running,setRunning]=useState(false);
  useEffect(()=>{if(!running)return undefined;const id=window.setInterval(()=>setSeconds(s=>{if(s<=1){setRunning(false);onNotice?.('Session timer finished.');return 0;}return s-1;}),1000);return()=>window.clearInterval(id);},[running,onNotice]);
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
