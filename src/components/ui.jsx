// ─── UI Primitives ────────────────────────────────────────────────────────────
import { useState, useEffect } from "react";
import { cn } from "../lib/format";
import { onSupaStatus, checkSupaConnection, _supaConnected } from "../lib/supabase";

// ─── DB Status Indicator ──────────────────────────────────────────────────────
export function DbStatusDot(){
  const [status,setStatus]=useState(null);
  const [err,setErr]=useState('');
  useEffect(()=>{
    const unsub=onSupaStatus((ok,e)=>{setStatus(ok);setErr(e);});
    // Initial check after a short delay so session can restore from localStorage
    const t1=setTimeout(()=>checkSupaConnection(),400);
    // Retry once more after 3s in case auth was slow
    const t2=setTimeout(()=>{ if(_supaConnected!==true) checkSupaConnection(); },3000);
    return ()=>{ unsub(); clearTimeout(t1); clearTimeout(t2); };
  },[]);
  const color = status===null?'#888':status?'#22c55e':'#ef4444';
  const label = status===null?'Checking…':status?'Connected':'DB error';
  return (
    <div title={err||label} style={{display:'flex',alignItems:'center',flexShrink:0}}>
      <div style={{width:8,height:8,borderRadius:'50%',background:color,boxShadow:`0 0 6px ${color}`}}/>
    </div>
  );
}

export const Btn = ({children,onClick,disabled,variant='primary',size='md',className='',...p})=>{
  const base='inline-flex items-center gap-1.5 font-medium rounded transition-all select-none';
  const sizes={sm:'text-xs px-3 py-1.5',md:'text-sm px-4 py-2'};
  const variants={
    primary:'bg-fg text-bg hover:opacity-90 disabled:opacity-50',
    outline:'border border-border bg-transparent text-fg hover:bg-muted disabled:opacity-50',
    ghost:'bg-transparent text-muted-fg hover:bg-muted hover:text-fg',
    destructive:'bg-destructive text-white hover:opacity-90',
  };
  return <button onClick={onClick} disabled={disabled} className={cn(base,sizes[size],variants[variant],className)} style={{cursor:disabled?'not-allowed':'pointer',...variantStyle(variant)}} {...p}>{children}</button>;
};
export function variantStyle(v){
  if(v==='primary') return {background:'var(--fg)',color:'var(--bg)'};
  if(v==='destructive') return {background:'var(--destructive)',color:'#fff'};
  return {};
}

export const Input=({className='',...p})=>(
  <input className={cn('w-full px-3 py-2 rounded border text-sm outline-none transition-colors',className)}
    style={{background:'var(--card)',borderColor:'var(--border)',color:'var(--fg)'}}
    {...p}/>
);
export const Textarea=({className='',...p})=>(
  <textarea className={cn('w-full px-3 py-2 rounded border text-sm outline-none resize-none',className)}
    style={{background:'var(--card)',borderColor:'var(--border)',color:'var(--fg)'}}
    {...p}/>
);
export const Select=({children,className='',...p})=>(
  <select className={cn('w-full px-3 py-2 rounded border text-sm outline-none',className)}
    style={{background:'var(--card)',borderColor:'var(--border)',color:'var(--fg)'}}
    {...p}>{children}</select>
);
export const Label=({children,className=''})=>(
  <span className={cn('block text-xs font-medium mb-1',className)} style={{color:'var(--muted-fg)'}}>{children}</span>
);
export const Card=({children,className='',onClick,style,onMouseEnter,onMouseLeave})=>(
  <div className={cn('rounded-xl',className)} onClick={onClick} onMouseEnter={onMouseEnter} onMouseLeave={onMouseLeave} style={{background:'var(--card)',border:'1px solid var(--border)',boxShadow:'var(--shadow)',...style}}>{children}</div>
);
export const Badge=({children,color=''})=>(
  <span className={cn('text-xs font-medium px-2 py-0.5 rounded-full',color)}>{children}</span>
);
export const Skeleton=({className=''})=>(
  <div className={cn('rounded animate-pulse',className)} style={{background:'var(--muted)',opacity:0.4}}/>
);

// Modal wrapper
export function Modal({open,onClose,title,children,maxW='max-w-md'}){
  if(!open) return null;
  return (
    <div style={{position:'fixed',inset:0,zIndex:200,display:'flex',alignItems:'center',justifyContent:'center',background:'rgba(0,0,0,0.4)',padding:16}}>
      <div style={{background:'var(--card)',borderRadius:12,border:'1px solid var(--border)',width:'100%',maxWidth:480,maxHeight:'90vh',overflowY:'auto',boxShadow:'0 8px 32px rgba(0,0,0,.2)'}}>
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'16px 20px',borderBottom:'1px solid var(--border)'}}>
          <span style={{fontWeight:600,fontSize:15}}>{title}</span>
          <button onClick={onClose} style={{background:'none',border:'none',cursor:'pointer',color:'var(--muted-fg)',fontSize:18,lineHeight:1}}>×</button>
        </div>
        <div style={{padding:20}}>{children}</div>
      </div>
    </div>
  );
}

export function ConfirmDialog({open,onClose,onConfirm,title,desc}){
  if(!open) return null;
  return (
    <div style={{position:'fixed',inset:0,zIndex:300,display:'flex',alignItems:'center',justifyContent:'center',background:'rgba(0,0,0,0.4)'}}>
      <div style={{background:'var(--card)',borderRadius:12,border:'1px solid var(--border)',padding:24,maxWidth:400,width:'90%'}}>
        <p style={{fontWeight:600,marginBottom:8}}>{title}</p>
        <p style={{fontSize:13,color:'var(--muted-fg)',marginBottom:20}}>{desc}</p>
        <div style={{display:'flex',gap:8,justifyContent:'flex-end'}}>
          <Btn variant='outline' onClick={onClose}>Cancel</Btn>
          <Btn variant='destructive' onClick={()=>{onConfirm();onClose();}}>Delete</Btn>
        </div>
      </div>
    </div>
  );
}

export function Toast({msg,onDone}){
  useEffect(()=>{const t=setTimeout(onDone,2500);return()=>clearTimeout(t);},[]);
  return <div style={{position:'fixed',bottom:24,right:24,zIndex:999,background:'var(--fg)',color:'var(--bg)',padding:'10px 18px',borderRadius:8,fontSize:13,fontWeight:500,boxShadow:'0 4px 16px rgba(0,0,0,.25)'}}>{msg}</div>;
}
