import { useEffect, useRef } from 'react';
import { Bold, Italic, Underline, List, ListOrdered, Link2, Eraser } from 'lucide-react';

const allowed = new Set(['B','STRONG','I','EM','U','P','BR','UL','OL','LI','BLOCKQUOTE','A']);

export function sanitiseRichText(value='') {
  if (typeof value !== 'string' || !value) return '';
  if (typeof DOMParser === 'undefined') return value.replace(/<script[\s\S]*?<\/script>/gi,'').replace(/\son\w+\s*=\s*(['"]).*?\1/gi,'');
  const doc = new DOMParser().parseFromString(value, 'text/html');
  const clean = (node) => {
    [...node.childNodes].forEach(child => {
      if (child.nodeType === 1) {
        if (!allowed.has(child.tagName)) {
          child.replaceWith(...child.childNodes);
        } else {
          [...child.attributes].forEach(attr => child.removeAttribute(attr.name));
          clean(child);
        }
      } else if (child.nodeType !== 3) child.remove();
    });
  };
  clean(doc.body);
  return doc.body.innerHTML;
}

export default function RichTextEditor({ value='', onChange, placeholder='Write a description…' }) {
  const editor=useRef(null);
  const last=useRef(value);
  useEffect(()=>{
    const next=sanitiseRichText(value);
    if(editor.current && next!==last.current && editor.current.innerHTML!==next) editor.current.innerHTML=next;
    last.current=next;
  },[value]);
  function command(cmd,arg=null){
    editor.current?.focus();
    if(cmd==='createLink'){
      const url=window.prompt('Enter link URL');
      if(url && /^https?:\/\//i.test(url)) document.execCommand(cmd,false,url);
      else if(url) window.alert('Please enter a link beginning with https:// or http://');
    } else document.execCommand(cmd,false,arg);
    if(editor.current){last.current=editor.current.innerHTML;onChange?.(sanitiseRichText(last.current));}
  }
  return <div className="legacy-rich-editor">
    <div className="legacy-rich-toolbar" role="toolbar" aria-label="Text formatting">
      <button type="button" title="Bold" aria-label="Bold" onMouseDown={e=>e.preventDefault()} onClick={()=>command('bold')}><Bold size={15}/></button>
      <button type="button" title="Italic" aria-label="Italic" onMouseDown={e=>e.preventDefault()} onClick={()=>command('italic')}><Italic size={15}/></button>
      <button type="button" title="Underline" aria-label="Underline" onMouseDown={e=>e.preventDefault()} onClick={()=>command('underline')}><Underline size={15}/></button>
      <span/>
      <button type="button" title="Bulleted list" aria-label="Bulleted list" onMouseDown={e=>e.preventDefault()} onClick={()=>command('insertUnorderedList')}><List size={15}/></button>
      <button type="button" title="Numbered list" aria-label="Numbered list" onMouseDown={e=>e.preventDefault()} onClick={()=>command('insertOrderedList')}><ListOrdered size={15}/></button>
      <button type="button" title="Insert link" aria-label="Insert link" onMouseDown={e=>e.preventDefault()} onClick={()=>command('createLink')}><Link2 size={15}/></button>
      <button type="button" title="Clear formatting" aria-label="Clear formatting" onMouseDown={e=>e.preventDefault()} onClick={()=>command('removeFormat')}><Eraser size={15}/></button>
    </div>
    <div ref={editor} className="legacy-rich-content" contentEditable suppressContentEditableWarning role="textbox" aria-multiline="true" data-placeholder={placeholder}
      onInput={e=>{const html=sanitiseRichText(e.currentTarget.innerHTML);last.current=html;onChange?.(html);}}
      onBlur={e=>{const html=sanitiseRichText(e.currentTarget.innerHTML);e.currentTarget.innerHTML=html;last.current=html;onChange?.(html);}}/>
  </div>;
}
