
import { useState, useEffect, useCallback, useRef } from "react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  LineChart, Line,
} from "recharts";
import {
  LayoutDashboard, Kanban, UserRound, Activity, FileText,
  Plus, Search, Pencil, Trash2, Globe, Building2, Phone, Mail,
  MapPin, Star, CalendarDays, StickyNote, CheckSquare, DollarSign,
  TrendingUp, Percent, Layers, ArrowRight,
  ChevronRight, ChevronDown, Archive as ArchiveIcon, Receipt, BarChart2,
} from "lucide-react";

// ─── Theme / CSS variables ───────────────────────────────────────────────────
const STYLE = `
  @import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap');
  :root {
    --bg: #ede9de;
    --fg: #2e3557;
    --card: #ede9de;
    --border: #d6d1c3;
    --muted: #c8c2b2;
    --muted-fg: #757575;
    --primary: #d4a96a;
    --primary-fg: #0a0a0a;
    --destructive: #ef4444;
    --radius: 0.25rem;
    --shadow: 0 1px 4px rgba(0,0,0,.15);
  }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Montserrat', sans-serif; background: var(--bg); color: var(--fg); font-size: 14px; }
  input, select, textarea { font-family: inherit; font-size: 13px; }
  button { cursor: pointer; font-family: inherit; }
  ::-webkit-scrollbar { width: 5px; height: 5px; }
  ::-webkit-scrollbar-track { background: var(--bg); }
  ::-webkit-scrollbar-thumb { background: var(--muted); border-radius: 9px; }
`;

// ─── Utility ──────────────────────────────────────────────────────────────────
const cn = (...cls) => cls.filter(Boolean).join(" ");
const fmtCAD = n => (n ?? 0).toLocaleString("en-CA", { style: "currency", currency: "CAD" });
const fmtUSD = n => `$${(n ?? 0).toLocaleString()}`;



// ─── Supabase client ──────────────────────────────────────────────────────────
const SUPA_URL = 'https://cyzvmcmlpnozwrqifrdt.supabase.co';
const SUPA_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN5enZtY21scG5vendycWlmcmR0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg2Mzk1MzEsImV4cCI6MjA5NDIxNTUzMX0.IeZRx5xcPddSQcL77vhKjOgAKFi8bKpj3dMfajHpV3c';

// ─── Auth state ──────────────────────────────────────────────────────────────
let _session = null; // { access_token, user }
const _authListeners = new Set();
function onAuthChange(fn){ _authListeners.add(fn); return ()=>_authListeners.delete(fn); }
function setSession(s){ _session = s; _authListeners.forEach(fn=>fn(s)); }

function supaHeaders(){
  const token = _session?.access_token || SUPA_KEY;
  return {
    'apikey': SUPA_KEY,
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
    'Prefer': 'return=representation',
  };
}

async function supaFetch(path, method='GET', body=null){
  const opts = { method, headers: supaHeaders() };
  if(body) opts.body = JSON.stringify(body);
  const res = await fetch(SUPA_URL + path, opts);
  if(!res.ok){
    const err = await res.text();
    throw new Error(`Supabase ${method} ${path}: ${res.status} ${err.slice(0,120)}`);
  }
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

// ─── Auth helpers ─────────────────────────────────────────────────────────────
async function signIn(email, password){
  const res = await fetch(`${SUPA_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { 'apikey': SUPA_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const data = await res.json();
  if(!res.ok) throw new Error(data.error_description || data.msg || 'Login failed');
  const session = { access_token: data.access_token, refresh_token: data.refresh_token, user: data.user };
  setSession(session);
  localStorage.setItem('kp_session', JSON.stringify(session));
  return session;
}

async function signUp(email, password){
  const res = await fetch(`${SUPA_URL}/auth/v1/signup`, {
    method: 'POST',
    headers: { 'apikey': SUPA_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const data = await res.json();
  if(!res.ok) throw new Error(data.error_description || data.msg || 'Signup failed');
  if(data.access_token){
    const session = { access_token: data.access_token, refresh_token: data.refresh_token, user: data.user };
    setSession(session);
    localStorage.setItem('kp_session', JSON.stringify(session));
    return session;
  }
  return data; // email confirmation required
}

async function signOut(){
  try{
    await fetch(`${SUPA_URL}/auth/v1/logout`, {
      method: 'POST',
      headers: supaHeaders(),
    });
  }catch(e){}
  localStorage.removeItem('kp_session');
  setSession(null);
}

async function refreshSession(refreshToken){
  try{
    const res = await fetch(`${SUPA_URL}/auth/v1/token?grant_type=refresh_token`, {
      method: 'POST',
      headers: { 'apikey': SUPA_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: refreshToken }),
    });
    const data = await res.json();
    if(res.ok && data.access_token){
      const session = { access_token: data.access_token, refresh_token: data.refresh_token, user: data.user };
      setSession(session);
      localStorage.setItem('kp_session', JSON.stringify(session));
      return session;
    }
  }catch(e){}
  return null;
}

// Restore session on load
(async function initAuth(){
  try{
    // In Claude artifact environment, bypass login with a mock session
    const isArtifact = window.location.href.includes('claude.ai') ||
      window.location.href === 'about:srcdoc' ||
      window.parent !== window;
    if(isArtifact && !_session){
      setSession({access_token: SUPA_KEY, refresh_token: null, user:{id:'artifact-user',email:'demo@kingdompainting.ca'}});
      return;
    }
    const stored = localStorage.getItem('kp_session');
    if(stored){
      const s = JSON.parse(stored);
      const fresh = await refreshSession(s.refresh_token);
      if(!fresh) setSession(s);
    }
  }catch(e){}
})();

// ─── Connection status hook ───────────────────────────────────────────────────
let _supaConnected = null; // null=unknown, true=ok, false=error
let _supaError = '';
const _supaListeners = new Set();
function onSupaStatus(fn){ _supaListeners.add(fn); return ()=>_supaListeners.delete(fn); }
function setSupaStatus(ok, err=''){
  _supaConnected = ok; _supaError = err;
  _supaListeners.forEach(fn=>fn(ok,err));
}

async function checkSupaConnection(){
  try{
    // Use the PostgREST OpenAPI route — always returns 200 with a valid API key, no RLS
    const res = await fetch(`${SUPA_URL}/rest/v1/`, {
      headers:{ 'apikey': SUPA_KEY, 'Authorization': `Bearer ${SUPA_KEY}` }
    });
    // 200 = server reachable, 400-range = still reachable (just RLS/auth), 0/network error = down
    if(res.status < 500){
      setSupaStatus(true);
      return true;
    }
    throw new Error(`HTTP ${res.status}`);
  }catch(e){
    // If it's a CORS/network error, still try the deals endpoint with current session
    try{
      await supaFetch('/rest/v1/deals?select=id&limit=1');
      setSupaStatus(true);
      return true;
    }catch(e2){
      // 403 from RLS (not a network error) still means server is reachable
      if(e2.message.includes('403')||e2.message.includes('401')){
        setSupaStatus(true);
        return true;
      }
      setSupaStatus(false, e2.message);
      return false;
    }
  }
}

// ─── In-memory fallback cache (used as local state between Supabase calls) ────
let DB = { clients:[], contacts:[], deals:[], activities:[], estimates:[] };
function genId(){ return Math.random().toString(36).slice(2,10); }
function now(){ return new Date().toISOString(); }

// ─── API — Supabase-backed, falls back to in-memory if table missing ──────────
const api = {
  // ── Contacts ──
  getContacts: (search='')=>{
    let c=DB.contacts;
    if(search){const q=search.toLowerCase();c=c.filter(x=>x.fullName?.toLowerCase().includes(q)||x.email?.toLowerCase().includes(q));}
    return c.slice().sort((a,b)=>(a.fullName||'').localeCompare(b.fullName||''));
  },
  loadContacts: async()=>{
    try{
      const rows = await supaFetch('/rest/v1/contacts?select=*&order=created_at.desc');
      DB.contacts = (rows||[]).slice().sort((a,b)=>(a.fullName||'').localeCompare(b.fullName||''));
    }catch(e){ console.warn('contacts load:',e.message); }
    return DB.contacts;
  },
  saveContact: async(data,id)=>{
    const uid = _session?.user?.id;
    try{
      if(id){
        DB.contacts=DB.contacts.map(c=>c.id===id?{...c,...data}:c);
        await supaFetch(`/rest/v1/contacts?id=eq.${id}`,'PATCH',data);
        return id;
      }else{
        const newContact={id:genId(),created_at:now(),...data,user_id:uid};
        const [row]=await supaFetch('/rest/v1/contacts','POST',newContact)||[];
        if(row) DB.contacts=[row,...DB.contacts];
        else DB.contacts=[newContact,...DB.contacts];
        DB.contacts.sort((a,b)=>(a.fullName||'').localeCompare(b.fullName||''));
        return (row||newContact).id;
      }
    }catch(e){ console.warn('saveContact:',e.message);
      if(id){ DB.contacts=DB.contacts.map(c=>c.id===id?{...c,...data}:c); return id; }
      const nid=genId(); DB.contacts.push({id:nid,created_at:now(),...data}); return nid;
    }
  },
  deleteContact: async(id)=>{
    try{ await supaFetch(`/rest/v1/contacts?id=eq.${id}`,'DELETE'); }catch(e){ console.warn(e); }
    DB.contacts=DB.contacts.filter(c=>c.id!==id);
  },

  // ── Deals ──
  getDeals: (stage=null)=>{
    let d=DB.deals;
    if(stage) d=d.filter(x=>x.stage===stage);
    return d;
  },
  loadDeals: async()=>{
    try{
      const rows = await supaFetch('/rest/v1/deals?select=*&order=created_at.desc');
      DB.deals = (rows||[]).map(r=>({...r,
        invoicePaid: r.invoicePaid ?? r.invoicepaid ?? 0,
        labels: r.labels || [],
        rooms: (r.rooms||[]).map(rm=>({...rm,
        wallCoats:+(rm.wallCoats||2),ceilCoats:+(rm.ceilCoats||2),
        baseCoats:+(rm.baseCoats||2),crownCoats:+(rm.crownCoats||2),
        dfCoats:+(rm.dfCoats||2),winCoats:+(rm.winCoats||2),doorCoats:+(rm.doorCoats||2),
      })),
        progress: r.progress || 0,
        contactFreeText: r.contactFreeText || '',
      }));
    }catch(e){ console.warn('deals load:',e.message); }
    return DB.deals;
  },
  saveDeal: async(data,id)=>{
    const uid = _session?.user?.id;
    // Remove client-only keys that don't exist as DB columns
    const {contactId:_cid, ...dbData} = data;
    try{
      if(id){
        const existing = DB.deals.find(d=>d.id===id)||{};
        const merged = {...existing,...data};
        DB.deals=DB.deals.map(d=>d.id===id?merged:d);
        await supaFetch(`/rest/v1/deals?id=eq.${id}`,'PATCH',dbData);
        DB.deals=DB.deals.map(d=>d.id===id?{...merged,...data}:d);
        return id;
      }else{
        const newDeal={id:genId(),created_at:now(),...dbData,user_id:uid};
        const [row]=await supaFetch('/rest/v1/deals','POST',newDeal)||[];
        if(row) DB.deals=[row,...DB.deals];
        else DB.deals=[newDeal,...DB.deals];
        return (row||newDeal).id;
      }
    }catch(e){ console.warn('saveDeal:',e.message);
      if(id){ DB.deals=DB.deals.map(d=>d.id===id?{...d,...data}:d); return id; }
      const nid=genId(); const nd={id:nid,created_at:now(),...dbData}; DB.deals.push(nd); return nid;
    }
  },
  deleteDeal: async(id)=>{
    try{ await supaFetch(`/rest/v1/deals?id=eq.${id}`,'DELETE'); }catch(e){ console.warn(e); }
    DB.deals=DB.deals.filter(d=>d.id!==id);
  },

  // ── Activities ──
  getActivities: ()=>DB.activities.slice().sort((a,b)=>(!a.date&&!b.date?0:!a.date?1:!b.date?-1:new Date(b.date)-new Date(a.date))),
  loadActivities: async()=>{
    try{
      const rows=await supaFetch('/rest/v1/activities?select=*&order=date.desc');
      DB.activities=rows||[];
    }catch(e){ console.warn('activities load:',e.message); }
    return DB.activities;
  },
  saveActivity: async(data,id)=>{
    try{
      if(id){
        await supaFetch(`/rest/v1/activities?id=eq.${id}`,'PATCH',data);
        DB.activities=DB.activities.map(a=>a.id===id?{...a,...data}:a);
        return id;
      }else{
        const [row]=await supaFetch('/rest/v1/activities','POST',{id:genId(),...data})||[];
        if(row) DB.activities=[row,...DB.activities];
        return row?.id;
      }
    }catch(e){ console.warn('saveActivity:',e.message);
      if(id){ DB.activities=DB.activities.map(a=>a.id===id?{...a,...data}:a); return id; }
      const nid=genId(); DB.activities.push({id:nid,...data}); return nid;
    }
  },
  deleteActivity: async(id)=>{
    try{ await supaFetch(`/rest/v1/activities?id=eq.${id}`,'DELETE'); }catch(e){ console.warn(e); }
    DB.activities=DB.activities.filter(a=>a.id!==id);
  },

  // ── Dashboard (computed from local cache) ──
  getDashboard: ()=>{
    const deals=DB.deals;
    const STAGES=['Lead','Proposal','Scheduled','Completed','Archive'];
    const dealsByStage=STAGES.map(s=>({stage:s,count:deals.filter(d=>d.stage===s).length}));
    const activeDeals=deals.filter(d=>d.stage!=='Completed'&&d.stage!=='Archive');
    const pipelineValue=activeDeals.reduce((s,d)=>s+(d.value||0),0);
    const closedWonValue=deals.filter(d=>d.stage==='Completed').reduce((s,d)=>s+(d.value||0),0);
    const closedDeals=deals.filter(d=>d.stage==='Completed'||d.stage==='Archive');
    const winRate=closedDeals.length>0?(deals.filter(d=>d.stage==='Completed').length/closedDeals.length)*100:0;
    const now2=new Date(); const months=[];
    for(let i=5;i>=0;i--){const d=new Date(now2);d.setMonth(d.getMonth()-i);months.push({month:d.toLocaleString('en',{month:'short'}),projects:deals.filter(d2=>{if(!d2.created_at)return false;const dc=new Date(d2.created_at);return dc.getFullYear()===d.getFullYear()&&dc.getMonth()===d.getMonth();}).length,grossProfit:deals.filter(d2=>{if(!d2.created_at)return false;const dc=new Date(d2.created_at);return dc.getFullYear()===d.getFullYear()&&dc.getMonth()===d.getMonth()&&d2.stage==='Completed';}).reduce((s,d2)=>s+(d2.value||0),0)});}
    const LEAD_SOURCES=['Referral','Repeat','Google','Site','Home Depot','MBT'];
    const leadSourceCounts=LEAD_SOURCES.map(source=>({source,count:deals.filter(d=>d.leadSource===source).length}));
    const totalLeads=deals.filter(d=>d.leadSource).length;
    const recentActivities=DB.activities.slice(0,8);
    return {totalDeals:deals.length,pipelineValue,closedWonValue,dealsByStage,recentActivities,winRate,monthlyStats:months,leadSourceCounts,totalLeads};
  },

  // ── Legacy sync wrappers (so existing call-sites that don't await still work) ──
  getClients: ()=>DB.clients,
  saveClient: async(data,id)=>{
    try{
      if(id){ await supaFetch(`/rest/v1/clients?id=eq.${id}`,'PATCH',data); DB.clients=DB.clients.map(c=>c.id===id?{...c,...data}:c); return id; }
      const [row]=await supaFetch('/rest/v1/clients','POST',{id:genId(),created_at:now(),...data})||[];
      if(row) DB.clients=[row,...DB.clients]; return row?.id;
    }catch(e){ console.warn(e);
      if(id){ DB.clients=DB.clients.map(c=>c.id===id?{...c,...data}:c); return id; }
      const nid=genId(); DB.clients.push({id:nid,...data}); return nid;
    }
  },
  deleteClient: async(id)=>{ try{ await supaFetch(`/rest/v1/clients?id=eq.${id}`,'DELETE'); }catch(e){} DB.clients=DB.clients.filter(c=>c.id!==id); },
};

// ─── DB Status Indicator ──────────────────────────────────────────────────────
function DbStatusDot(){
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

// ─── Bootstrap: load all data from Supabase on startup ───────────────────────
async function bootstrapDB(){
  await Promise.all([api.loadContacts(), api.loadDeals(), api.loadActivities()]);
  setSupaStatus(true); // Data loaded successfully → mark as connected
}

// ─── UI Primitives ────────────────────────────────────────────────────────────
const Btn = ({children,onClick,disabled,variant='primary',size='md',className='',...p})=>{
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
function variantStyle(v){
  if(v==='primary') return {background:'var(--fg)',color:'var(--bg)'};
  if(v==='destructive') return {background:'var(--destructive)',color:'#fff'};
  return {};
}

const Input=({className='',...p})=>(
  <input className={cn('w-full px-3 py-2 rounded border text-sm outline-none transition-colors',className)}
    style={{background:'var(--card)',borderColor:'var(--border)',color:'var(--fg)'}}
    {...p}/>
);
const Textarea=({className='',...p})=>(
  <textarea className={cn('w-full px-3 py-2 rounded border text-sm outline-none resize-none',className)}
    style={{background:'var(--card)',borderColor:'var(--border)',color:'var(--fg)'}}
    {...p}/>
);
const Select=({children,className='',...p})=>(
  <select className={cn('w-full px-3 py-2 rounded border text-sm outline-none',className)}
    style={{background:'var(--card)',borderColor:'var(--border)',color:'var(--fg)'}}
    {...p}>{children}</select>
);
const Label=({children,className=''})=>(
  <span className={cn('block text-xs font-medium mb-1',className)} style={{color:'var(--muted-fg)'}}>{children}</span>
);
const Card=({children,className='',onClick,style,onMouseEnter,onMouseLeave})=>(
  <div className={cn('rounded-xl',className)} onClick={onClick} onMouseEnter={onMouseEnter} onMouseLeave={onMouseLeave} style={{background:'var(--card)',border:'1px solid var(--border)',boxShadow:'var(--shadow)',...style}}>{children}</div>
);
const Badge=({children,color=''})=>(
  <span className={cn('text-xs font-medium px-2 py-0.5 rounded-full',color)}>{children}</span>
);
const Skeleton=({className=''})=>(
  <div className={cn('rounded animate-pulse',className)} style={{background:'var(--muted)',opacity:0.4}}/>
);

// Modal wrapper
function Modal({open,onClose,title,children,maxW='max-w-md'}){
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

function ConfirmDialog({open,onClose,onConfirm,title,desc}){
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

function Toast({msg,onDone}){
  useEffect(()=>{const t=setTimeout(onDone,2500);return()=>clearTimeout(t);},[]);
  return <div style={{position:'fixed',bottom:24,right:24,zIndex:999,background:'var(--fg)',color:'var(--bg)',padding:'10px 18px',borderRadius:8,fontSize:13,fontWeight:500,boxShadow:'0 4px 16px rgba(0,0,0,.25)'}}>{msg}</div>;
}

// ─── STATUS COLORS ────────────────────────────────────────────────────────────
const CLIENT_STATUS={Active:'#dcfce7 text-green-700',Prospect:'#dbeafe text-blue-700',Inactive:'#f3f4f6 text-gray-600',Churned:'#fee2e2 text-red-700'};
const STAGE_COLORS={Lead:'bg-gray-100 text-gray-600',Proposal:'bg-blue-100 text-blue-700',Scheduled:'bg-purple-100 text-purple-700',Completed:'bg-green-100 text-green-700',Archive:'bg-amber-100 text-amber-700'};
const LABEL_COLORS={
  Residential: {bg:'#dbeafe',color:'#1d4ed8'},
  Commercial:  {bg:'#ffedd5',color:'#ea580c'},
  Exterior:    {bg:'#d1fae5',color:'#065f46'},
  Lost:        {bg:'#fee2e2',color:'#dc2626'},
};
const TYPE_COLORS={Call:'bg-blue-100 text-blue-700',Email:'bg-purple-100 text-purple-700',Meeting:'bg-green-100 text-green-700',Note:'bg-gray-100 text-gray-600',Task:'bg-orange-100 text-orange-700'};
const LEAD_COLORS={
  Referral:  {bg:'#ede9fe',color:'#7c3aed'},
  Repeat:    {bg:'#dbeafe',color:'#1d4ed8'},
  Google:    {bg:'#fee2e2',color:'#dc2626'},
  Site:      {bg:'#fef9c3',color:'#a16207'},
  'Home Depot':{bg:'#ffedd5',color:'#ea580c'},
  MBT:       {bg:'#ccfbf1',color:'#0f766e'},
};
const STAGES=['Lead','Proposal','Scheduled','Completed','Archive'];
const LEAD_SOURCES=['Referral','Repeat','Google','Site','Home Depot','MBT'];

// ─── MODALS ───────────────────────────────────────────────────────────────────
function ClientModal({open,onClose,client,onSaved}){
  const [f,setF]=useState({companyName:'',status:'Prospect',industry:'',website:'',address:'',phone:'',email:'',notes:''});
  useEffect(()=>{if(client)setF({companyName:client.companyName||'',status:client.status||'Prospect',industry:client.industry||'',website:client.website||'',address:client.address||'',phone:client.phone||'',email:client.email||'',notes:client.notes||''});else setF({companyName:'',status:'Prospect',industry:'',website:'',address:'',phone:'',email:'',notes:''});},[client,open]);
  const save=()=>{api.saveClient(f,client?.id);onSaved();onClose();};
  const row=(label,key,type='text',ph='')=>(
    <div style={{marginBottom:12}}>
      <Label>{label}</Label>
      <Input type={type} value={f[key]} onChange={e=>setF(x=>({...x,[key]:e.target.value}))} placeholder={ph}/>
    </div>
  );
  return (
    <Modal open={open} onClose={onClose} title={client?'Edit Client':'New Client'}>
      {row('Company / Client Name','companyName','text','Company name')}
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12,marginBottom:12}}>
        <div><Label>Status</Label><Select value={f.status} onChange={e=>setF(x=>({...x,status:e.target.value}))}>{['Active','Prospect','Inactive','Churned'].map(s=><option key={s}>{s}</option>)}</Select></div>
        <div>{row('Industry','industry','text','Industry')}</div>
      </div>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12,marginBottom:12}}>
        <div>{row('Phone','phone','tel','+1 (555) 000-0000')}</div>
        <div>{row('Email','email','email','email@company.com')}</div>
      </div>
      {row('Website','website','text','https://')}
      {row('Address','address','text','Address')}
      <div style={{marginBottom:12}}><Label>Notes</Label><Textarea value={f.notes} onChange={e=>setF(x=>({...x,notes:e.target.value}))} rows={3} placeholder='Notes...'/></div>
      <div style={{display:'flex',gap:8,justifyContent:'flex-end',marginTop:8}}>
        <Btn variant='outline' onClick={onClose}>Cancel</Btn>
        <Btn onClick={save} disabled={!f.companyName}>Save Client</Btn>
      </div>
    </Modal>
  );
}

function ContactModal({open,onClose,contact,clients,onSaved,allDeals,allContacts}){
  const [f,setF]=useState({fullName:'',email:'',phone:'',jobTitle:'',client:'',notes:'',address:''});
  useEffect(()=>{if(contact)setF({fullName:contact.fullName||'',email:contact.email||'',phone:contact.phone||'',jobTitle:contact.jobTitle||'',client:(Array.isArray(contact.client)?contact.client[0]:contact.client)||'',notes:contact.notes||'',address:contact.address||''});else setF({fullName:'',email:'',phone:'',jobTitle:'',client:'',notes:'',address:''});},[contact,open]);
  const save=async()=>{await api.saveContact({...f,client:f.client||undefined},contact?.id);onSaved();onClose();};

  // Referrals: deals where referralName === this contact's id
  const deals=allDeals||[];
  const contacts=allContacts||[];
  const referralDeals=contact?deals.filter(d=>(d.referralName||d.referralContactId)===contact.id):[];
  // For each referral deal, get the client contact name
  const referralItems=referralDeals.map(d=>{
    const c=contacts.find(x=>x.id===(d.contact||d.contactId));
    return {dealName:d.dealName||'Unnamed project',clientName:c?.fullName||d.contactFreeText||'—'};
  });
  // All deals for this contact (any stage, for display)
  const allContactDeals=contact?allDeals.filter(d=>
    (d.contact||d.contactId)===contact.id
  ).sort((a,b)=>new Date(b.created_at||0)-new Date(a.created_at||0)):[];
  // Repeat projects: same logic as contact card — Scheduled/Completed/Archive only, no Lost, 2+ deals required
  const contactDeals=contact?allDeals.filter(d=>
    (d.contact||d.contactId)===contact.id &&
    ['Scheduled','Completed','Archive'].includes(d.stage) &&
    !(d.labels||[]).includes('Lost')
  ):[];
  const repeatDeals=contactDeals.length>=2?contactDeals.slice(1):[];

  const STAGE_PILL={
    Lead:{bg:'#e8eaf6',color:'#3949ab'},
    Proposal:{bg:'#e3f2fd',color:'#1565c0'},
    Scheduled:{bg:'#f3e5f5',color:'#7b1fa2'},
    Completed:{bg:'#e8f5e9',color:'#2e7d32'},
    Archive:{bg:'#fff3e0',color:'#e65100'},
  };

  return (
    <Modal open={open} onClose={onClose} title={contact?'Edit Contact':'New Contact'}>
      <div style={{marginBottom:12}}><Label>Full Name</Label><input value={f.fullName} onChange={e=>setF(x=>({...x,fullName:e.target.value}))} placeholder='Full name' style={{background:'var(--card)',color:'var(--fg)',fontFamily:'inherit',fontSize:13,padding:'6px 10px',borderRadius:6,border:'1px solid var(--border)',width:'100%',outline:'none',boxSizing:'border-box'}}/></div>
      <div style={{marginBottom:12}}><Label>Address</Label><input value={f.address} onChange={e=>setF(x=>({...x,address:e.target.value}))} placeholder='123 Main St' style={{background:'var(--card)',color:'var(--fg)',fontFamily:'inherit',fontSize:13,padding:'6px 10px',borderRadius:6,border:'1px solid var(--border)',width:'100%',outline:'none',boxSizing:'border-box'}}/></div>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12,marginBottom:12}}>
        <div><Label>Phone</Label><input value={f.phone} onChange={e=>{
          const digits=e.target.value.replace(/\D/g,'').slice(0,10);
          let fmt='';
          if(digits.length===0) fmt='';
          else if(digits.length<=3) fmt=`(${digits}`;
          else if(digits.length<=6) fmt=`(${digits.slice(0,3)}) ${digits.slice(3)}`;
          else fmt=`(${digits.slice(0,3)}) ${digits.slice(3,6)}-${digits.slice(6)}`;
          setF(x=>({...x,phone:fmt}));
        }} placeholder='(416) 555-0000' maxLength={14} style={{background:'var(--card)',color:'var(--fg)',fontFamily:'inherit',fontSize:13,padding:'6px 10px',borderRadius:6,border:'1px solid var(--border)',width:'100%',outline:'none',boxSizing:'border-box'}}/></div>
        <div><Label>Email</Label><input type='email' value={f.email} onChange={e=>setF(x=>({...x,email:e.target.value}))} placeholder='email@company.com' style={{background:'var(--card)',color:'var(--fg)',fontFamily:'inherit',fontSize:13,padding:'6px 10px',borderRadius:6,border:'1px solid var(--border)',width:'100%',outline:'none',boxSizing:'border-box'}}/></div>
      </div>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12,marginBottom:12}}>
        <div><Label>Job Title</Label><input value={f.jobTitle} onChange={e=>setF(x=>({...x,jobTitle:e.target.value}))} placeholder='Job title' style={{background:'var(--card)',color:'var(--fg)',fontFamily:'inherit',fontSize:13,padding:'6px 10px',borderRadius:6,border:'1px solid var(--border)',width:'100%',outline:'none',boxSizing:'border-box'}}/></div>
        <div><Label>Company</Label><input value={f.client} onChange={e=>setF(x=>({...x,client:e.target.value}))} placeholder='Company name' style={{background:'var(--card)',color:'var(--fg)',fontFamily:'inherit',fontSize:13,padding:'6px 10px',borderRadius:6,border:'1px solid var(--border)',width:'100%',outline:'none',boxSizing:'border-box'}}/></div>
      </div>

      {/* All Projects */}
      {allContactDeals.length>0&&(
        <div style={{marginBottom:12,padding:'10px 12px',background:'var(--muted)',borderRadius:8,border:'1px solid var(--border)'}}>
          <p style={{fontSize:11,fontWeight:700,textTransform:'uppercase',letterSpacing:'0.05em',color:'var(--fg)',marginBottom:8,display:'flex',alignItems:'center',justifyContent:'space-between'}}>
            <span>Projects ({allContactDeals.length})</span>
          </p>
          <div style={{display:'flex',flexDirection:'column',gap:4}}>
            {allContactDeals.map((d,i)=>{
              const pill=STAGE_PILL[d.stage]||{bg:'#f0f0f0',color:'#555'};
              const val=d.value?'$'+parseFloat(d.value).toLocaleString('en-CA',{minimumFractionDigits:0,maximumFractionDigits:0}):'';
              return(
                <div key={i} style={{display:'flex',alignItems:'center',justifyContent:'space-between',fontSize:12,padding:'5px 8px',background:'var(--card)',borderRadius:6,gap:8}}>
                  <span style={{fontWeight:500,flex:1,minWidth:0,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{d.dealName||'Unnamed'}</span>
                  <div style={{display:'flex',alignItems:'center',gap:6,flexShrink:0}}>
                    {val&&<span style={{color:'var(--primary)',fontWeight:600,fontSize:11}}>{val}</span>}
                    <span style={{fontSize:9,fontWeight:700,padding:'2px 6px',borderRadius:10,background:pill.bg,color:pill.color,textTransform:'uppercase',letterSpacing:'0.05em'}}>{d.stage}</span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Repeats & Referrals below */}
          {(repeatDeals.length>0||referralItems.length>0)&&(
            <div style={{marginTop:10,paddingTop:10,borderTop:'1px solid var(--border)'}}>
              {repeatDeals.length>0&&(
                <div style={{marginBottom:referralItems.length>0?8:0}}>
                  <p style={{fontSize:11,fontWeight:700,textTransform:'uppercase',letterSpacing:'0.05em',color:'#6366f1',marginBottom:5,display:'flex',alignItems:'center',gap:4}}>↩ Repeats ({repeatDeals.length})</p>
                  <div style={{display:'flex',flexDirection:'column',gap:3}}>
                    {repeatDeals.map((d,i)=>(
                      <div key={i} style={{fontSize:11,padding:'3px 8px',background:'rgba(99,102,241,0.06)',borderRadius:5,color:'var(--muted-fg)'}}>
                        {d.dealName||'Unnamed'}
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {referralItems.length>0&&(
                <div>
                  <p style={{fontSize:11,fontWeight:700,textTransform:'uppercase',letterSpacing:'0.05em',color:'var(--primary)',marginBottom:5,display:'flex',alignItems:'center',gap:4}}><Star size={10}/>Referrals ({referralItems.length})</p>
                  <div style={{display:'flex',flexDirection:'column',gap:3}}>
                    {referralItems.map((r,i)=>(
                      <div key={i} style={{display:'flex',justifyContent:'space-between',fontSize:11,padding:'3px 8px',background:'rgba(212,169,106,0.08)',borderRadius:5}}>
                        <span style={{fontWeight:500}}>{r.clientName}</span>
                        <span style={{color:'var(--muted-fg)'}}>{r.dealName}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      <div style={{marginBottom:12}}><Label>Notes</Label><textarea value={f.notes} onChange={e=>setF(x=>({...x,notes:e.target.value}))} rows={3} placeholder='Notes...' style={{background:'var(--card)',color:'var(--fg)',fontFamily:'inherit',fontSize:13,padding:'6px 10px',borderRadius:6,border:'1px solid var(--border)',width:'100%',outline:'none',boxSizing:'border-box',resize:'vertical'}}/></div>
      <div style={{display:'flex',gap:8,justifyContent:'flex-end'}}>
        <button onClick={onClose} style={{display:'flex',alignItems:'center',gap:6,padding:'6px 14px',border:'1px solid var(--border)',borderRadius:6,background:'var(--card)',color:'var(--fg)',fontSize:12,fontWeight:500,cursor:'pointer'}}>Cancel</button>
        <button onClick={save} disabled={!f.fullName} style={{display:'flex',alignItems:'center',gap:6,padding:'6px 14px',border:'1px solid var(--primary)',borderRadius:6,background:'var(--primary)',color:'#fff',fontSize:12,fontWeight:600,cursor:!f.fullName?'not-allowed':'pointer',opacity:!f.fullName?0.6:1}}>Save Contact</button>
      </div>
    </Modal>
  );
}

// ─── Google Calendar helpers (called from DealModal & Pipeline) ───────────────
// Google Calendar REST API via MCP proxy
// These work when Google Calendar is connected in Claude settings
// ── Google Calendar OAuth ──────────────────────────────────────────────────────
const GCAL_API='https://www.googleapis.com/calendar/v3';
const GCAL_SCOPE='https://www.googleapis.com/auth/calendar';
const GCAL_CLIENT_ID='679479647573-mlt9c1ngee00f0fildru0mbda9gdi78p.apps.googleusercontent.com';

function gcalGetToken(){ return localStorage.getItem('kp_gcal_token'); }
function gcalSetToken(t){ localStorage.setItem('kp_gcal_token',t); }
function gcalClearToken(){ localStorage.removeItem('kp_gcal_token'); }

function gcalSignIn(){
  return new Promise((resolve,reject)=>{
    if(!GCAL_CLIENT_ID){reject(new Error('NO_CLIENT_ID'));return;}
    const doFlow=()=>{
      window.google.accounts.oauth2.initTokenClient({
        client_id:GCAL_CLIENT_ID, scope:GCAL_SCOPE,
        callback:(resp)=>{ if(resp.error){reject(new Error(resp.error));return;} gcalSetToken(resp.access_token); resolve(resp.access_token); },
      }).requestAccessToken({prompt:''});
    };
    if(window.google?.accounts?.oauth2){doFlow();return;}
    const sc=document.createElement('script');
    sc.src='https://accounts.google.com/gsi/client';
    sc.onload=doFlow;
    sc.onerror=()=>reject(new Error('GIS load failed'));
    document.head.appendChild(sc);
  });
}

async function gcalAuthFetch(url, opts={}){
  let token=gcalGetToken();
  if(!token) token=await gcalSignIn();
  const r=await fetch(url,{...opts,headers:{...opts.headers,Authorization:`Bearer ${token}`}});
  if(r.status===401){gcalClearToken();token=await gcalSignIn();return fetch(url,{...opts,headers:{...opts.headers,Authorization:`Bearer ${token}`}});}
  return r;
}

async function gcalFetchEvents(timeMin, timeMax){
  const url=`${GCAL_API}/calendars/primary/events?timeMin=${encodeURIComponent(timeMin)}&timeMax=${encodeURIComponent(timeMax)}&singleEvents=true&orderBy=startTime&maxResults=50`;
  return gcalAuthFetch(url);
}

async function gcalCreateEvent(title, dateStr, startTime, endTime, address, notes){
  try{
    const tz=Intl.DateTimeFormat().resolvedOptions().timeZone;
    const r=await gcalAuthFetch(`${GCAL_API}/calendars/primary/events`,{
      method:'POST', headers:{'Content-Type':'application/json'},
      body:JSON.stringify({summary:title,location:address||'',description:notes||'',
        start:{dateTime:`${dateStr}T${startTime||'09:00'}:00`,timeZone:tz},
        end:{dateTime:`${dateStr}T${endTime||'17:00'}:00`,timeZone:tz}})
    });
    if(!r.ok) return null;
    const d=await r.json(); return d.id||null;
  }catch(e){ return null; }
}

async function gcalCreateProjectEvent(title, startDate, startTime, endDate, endTime, address, notes){
  if(!startDate) return null;
  return gcalCreateEvent(title, startDate, startTime||'09:00', endDate||startDate, endTime||'17:00', address, notes);
}

async function gcalDeleteEvent(eventId){
  if(!eventId) return;
  try{ await gcalAuthFetch(`${GCAL_API}/calendars/primary/events/${encodeURIComponent(eventId)}`,{method:'DELETE'}); }catch(e){}
}

// Generate all dates between two date strings inclusive
function dateRange(startDate, endDate){
  if(!startDate) return [];
  const dates=[];
  const cur=new Date(startDate+'T12:00:00');
  const end=new Date((endDate||startDate)+'T12:00:00');
  while(cur<=end){
    dates.push(cur.toISOString().slice(0,10));
    cur.setDate(cur.getDate()+1);
  }
  return dates;
}

function fmtDateLabel(dateStr){
  return new Date(dateStr+'T12:00:00').toLocaleDateString('en-CA',{weekday:'short',month:'short',day:'numeric'});
}

function ContactCombobox({contacts,value,freeText,onChange}){
  const selected=contacts.find(c=>c.id===value);
  const [query,setQuery]=useState('');
  const [open,setOpen]=useState(false);
  const ref=useRef(null);

  useEffect(()=>{
    const handler=e=>{if(ref.current&&!ref.current.contains(e.target))setOpen(false);};
    document.addEventListener('mousedown',handler);
    return()=>document.removeEventListener('mousedown',handler);
  },[]);

  const displayVal=open?query:(selected?.fullName||selected?.email||freeText||'');
  const filtered=query.trim()===''
    ?contacts
    :contacts.filter(c=>(c.fullName||c.email||'').toLowerCase().includes(query.toLowerCase()));
  const inp={width:'100%',padding:'8px 10px',border:'1px solid var(--border)',borderRadius:6,
    background:'var(--card)',color:'var(--fg)',fontSize:13,outline:'none'};

  return(
    <div ref={ref} style={{position:'relative'}}>
      <input
        style={{...inp,paddingRight:28}}
        value={displayVal}
        placeholder='Search or type client name…'
        onFocus={()=>{setQuery('');setOpen(true);}}
        onChange={e=>{setQuery(e.target.value);setOpen(true);}}
        onBlur={e=>{
          // If typed text doesn't match a contact, save as free text
          setTimeout(()=>{
            if(!open) return;
            const q=query.trim();
            if(q && !contacts.find(c=>(c.fullName||'').toLowerCase()===q.toLowerCase())){
              onChange('',q);
            }
            setOpen(false);
          },150);
        }}
      />
      {(value||freeText)&&!open&&(
        <button onClick={()=>{onChange('','');setQuery('');}}
          style={{position:'absolute',right:6,top:'50%',transform:'translateY(-50%)',background:'none',border:'none',cursor:'pointer',color:'var(--muted-fg)',fontSize:16,lineHeight:1}}>×</button>
      )}
      {open&&(
        <div style={{position:'absolute',zIndex:999,top:'calc(100% + 4px)',left:0,right:0,
          background:'var(--card)',border:'1px solid var(--border)',borderRadius:8,
          boxShadow:'0 8px 24px rgba(0,0,0,.12)',maxHeight:220,overflowY:'auto'}}>
          <div onMouseDown={e=>{e.preventDefault();onChange('','');setOpen(false);setQuery('');}}
            style={{padding:'8px 12px',fontSize:13,color:'var(--muted-fg)',cursor:'pointer',borderBottom:'1px solid var(--border)'}}
            onMouseEnter={e=>e.currentTarget.style.background='var(--muted)'}
            onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
            None
          </div>
          {/* Free-text option when query doesn't match any contact */}
          {query.trim()&&!contacts.find(c=>(c.fullName||'').toLowerCase()===query.trim().toLowerCase())&&(
            <div onMouseDown={e=>{e.preventDefault();onChange('',query.trim());setOpen(false);setQuery('');}}
              style={{padding:'8px 12px',fontSize:13,cursor:'pointer',borderBottom:'1px solid var(--border)',
                color:'var(--primary)',fontStyle:'italic'}}
              onMouseEnter={e=>e.currentTarget.style.background='var(--muted)'}
              onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
              Use "{query.trim()}" (one-time client)
            </div>
          )}
          {filtered.length===0&&<div style={{padding:'10px 12px',fontSize:13,color:'var(--muted-fg)'}}>No contacts found</div>}
          {filtered.map(c=>(
            <div key={c.id}
              onMouseDown={e=>{e.preventDefault();onChange(c.id,'');setOpen(false);setQuery('');}}
              style={{padding:'8px 12px',fontSize:13,cursor:'pointer',
                background:c.id===value?'rgba(212,169,106,0.12)':'transparent',
                fontWeight:c.id===value?600:400}}
              onMouseEnter={e=>e.currentTarget.style.background='var(--muted)'}
              onMouseLeave={e=>e.currentTarget.style.background=c.id===value?'rgba(212,169,106,0.12)':'transparent'}>
              {c.fullName||c.email||'Unnamed'}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function DealModal({open,onClose,deal,contacts,onSaved,defaultStage='Lead'}){
  const blank={dealName:'',value:'',description:'',contactId:'',referralContactId:'',labels:[],leadSource:'',
    startDate:'',startTime:'09:00',endDate:'',endTime:'17:00',
    scheduleDays:[], // [{date, startTime, endTime, calEventId}]
    address:'',notes:'',rooms:[],progress:0,contactFreeText:'',quote_html:'',contract_html:'',change_order_html:'',invoice_html:'',contract_signed_html:'',contract_signed_at:'',quote_date:''};
  const [f,setF]=useState(blank);
  const [syncing,setSyncing]=useState(false);

  useEffect(()=>{
    if(deal) setF({
      dealName:deal.dealName||'',value:deal.value?.toString()||'',description:deal.description||'',
      contactId:(Array.isArray(deal.contact)?deal.contact[0]:deal.contact)||deal.contactId||'',
      referralContactId:deal.referralName||'',labels:deal.labels||[],leadSource:deal.leadSource||'',
      startDate:deal.startDate||'',startTime:deal.startTime||'09:00',
      endDate:deal.endDate||'',endTime:deal.endTime||'17:00',
      scheduleDays:deal.scheduleDays||[],address:deal.address||'',notes:deal.notes||'',
      rooms:deal.rooms||[],progress:deal.progress||0,contactFreeText:deal.contactFreeText||'',
      quote_html:deal.quote_html||'',contract_html:deal.contract_html||'',change_order_html:deal.change_order_html||'',
      invoice_html:deal.invoice_html||'',contract_signed_html:deal.contract_signed_html||'',contract_signed_at:deal.contract_signed_at||'',
      quote_date:deal.quote_date||''
    });
    else setF(blank);
  },[deal,open]);

  // Whenever startDate/endDate change, rebuild scheduleDays preserving existing per-day times
  const rebuildDays=(sd,st,ed,et,existingDays)=>{
    const dates=dateRange(sd,ed);
    return dates.map(date=>{
      const existing=existingDays.find(d=>d.date===date);
      return existing||{date,startTime:st||'09:00',endTime:et||'17:00',calEventId:null};
    });
  };

  const handleStartDate=v=>setF(x=>{
    const newDays=rebuildDays(v,x.startTime,x.endDate||v,x.endTime,x.scheduleDays);
    return{...x,startDate:v,scheduleDays:newDays};
  });
  const handleEndDate=v=>setF(x=>{
    const newDays=rebuildDays(x.startDate,x.startTime,v,x.endTime,x.scheduleDays);
    return{...x,endDate:v,scheduleDays:newDays};
  });
  const handleStartTime=v=>setF(x=>({
    ...x,startTime:v,
    // Only update days that still had the old default start time
    scheduleDays:x.scheduleDays.map(d=>d.startTime===x.startTime?{...d,startTime:v}:d)
  }));
  const handleEndTime=v=>setF(x=>({
    ...x,endTime:v,
    // Only update days that still had the old default end time
    scheduleDays:x.scheduleDays.map(d=>d.endTime===x.endTime?{...d,endTime:v}:d)
  }));

  const removeDayLocal=(date)=>setF(x=>({...x,scheduleDays:x.scheduleDays.filter(d=>d.date!==date)}));
  const updateDayTime=(date,key,val)=>setF(x=>({...x,scheduleDays:x.scheduleDays.map(d=>d.date===date?{...d,[key]:val}:d)}));

  const toggleLabel=l=>setF(x=>({...x,labels:x.labels.includes(l)?x.labels.filter(v=>v!==l):[...x.labels,l]}));

  const save=async()=>{
    setSyncing(true);
    const existingDays=(deal?.scheduleDays||[]);
    const existingDates=new Set(existingDays.map(d=>d.date));
    const newDates=new Set(f.scheduleDays.map(d=>d.date));

    // Delete GCal events for removed days
    const removed=existingDays.filter(d=>!newDates.has(d.date));
    for(const d of removed){ if(d.calEventId) await gcalDeleteEvent(d.calEventId); }

    const contactName=contacts.find(c=>c.id===f.contactId)?.fullName||'';
    const gcalTitle=f.dealName+(contactName?` - ${contactName}`:'');
    const notesTxt=f.description||f.notes||'';
    const titleOrAddrChanged = deal && (f.dealName!==deal.dealName || f.address!==(deal.address||''));

    // Create/update GCal events for scheduled days
    const finalDays=[];
    for(const day of f.scheduleDays){
      const existing=existingDays.find(d=>d.date===day.date);
      const isNew=!existingDates.has(day.date);
      const timesChanged=existing&&(day.startTime!==existing.startTime||day.endTime!==existing.endTime);

      if(isNew){
        // Brand new day — create event
        const eid=await gcalCreateEvent(gcalTitle,day.date,day.startTime,day.endTime,f.address,notesTxt);
        finalDays.push({...day,calEventId:eid});
      } else if((timesChanged||titleOrAddrChanged)&&existing?.calEventId){
        // Times or title/address changed — delete and recreate
        await gcalDeleteEvent(existing.calEventId);
        const eid=await gcalCreateEvent(gcalTitle,day.date,day.startTime,day.endTime,f.address,notesTxt);
        finalDays.push({...day,calEventId:eid});
      } else {
        // No change — keep existing calEventId
        finalDays.push({...day,calEventId:existing?.calEventId||null});
      }
    }

    // Project-level spanning event (start date → end date)
    let projectCalEventId=deal?.projectCalEventId||null;
    if(!deal&&f.startDate){
      projectCalEventId=await gcalCreateProjectEvent(gcalTitle,f.startDate,f.startTime,f.endDate,f.endTime,f.address,notesTxt);
    } else if(deal&&f.startDate&&(
      f.startDate!==deal.startDate||f.endDate!==deal.endDate||
      f.startTime!==deal.startTime||f.endTime!==deal.endTime||
      f.dealName!==deal.dealName||f.address!==deal.address
    )){
      if(projectCalEventId) await gcalDeleteEvent(projectCalEventId);
      projectCalEventId=await gcalCreateProjectEvent(gcalTitle,f.startDate,f.startTime,f.endDate,f.endTime,f.address,notesTxt);
    }

    // Auto-archive if Lost label is selected
    const isLost = f.labels.includes('Lost');
    const stage = isLost ? 'Archive' : (deal?.stage||defaultStage);

    await api.saveDeal({
      dealName:f.dealName,stage,
      value:f.value?parseFloat(f.value):undefined,
      description:f.description||null,
      contact:f.contactId||null,contactFreeText:f.contactFreeText||null,referralName:f.referralContactId||undefined,
      labels:f.labels.length?f.labels:undefined,leadSource:f.leadSource||undefined,
      startDate:f.startDate||undefined,startTime:f.startTime||undefined,
      endDate:f.endDate||undefined,endTime:f.endTime||undefined,
      scheduleDays:finalDays,address:f.address||null,notes:f.notes||null,
      rooms:f.rooms||undefined,progress:f.progress||0,
      quote_date:f.quote_date||undefined,
      quote_html:f.quote_html||null,
      contract_html:f.contract_html||null,
      change_order_html:f.change_order_html||null,
      invoice_html:f.invoice_html||null,
      contract_signed_html:f.contract_signed_html||null,
      contract_signed_at:f.contract_signed_at||null,
      projectCalEventId:projectCalEventId||undefined,
    },deal?.id);
    setSyncing(false);
    onSaved();onClose();
  };

  const LABEL_OPTIONS=[
    {v:'Residential', bg:'#dbeafe',color:'#1d4ed8'},
    {v:'Commercial',  bg:'#ffedd5',color:'#ea580c'},
    {v:'Exterior',    bg:'#d1fae5',color:'#065f46'},
    {v:'Lost',        bg:'#fee2e2',color:'#dc2626'},
  ];
  const inp={background:'var(--card)',color:'var(--fg)',fontFamily:'inherit',fontSize:13,padding:'6px 10px',borderRadius:6,border:'1px solid var(--border)',width:'100%'};

  return (
    <Modal open={open} onClose={onClose} title={deal?'Edit Project':'New Project'}>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12,marginBottom:12}}>
        <div><Label>Project Name</Label><input value={f.dealName} onChange={e=>setF(x=>({...x,dealName:e.target.value}))} placeholder='Project name' style={inp}/></div>
        <div><Label>Contact</Label>
          <ContactCombobox contacts={contacts} value={f.contactId} freeText={f.contactFreeText||''} onChange={(id,txt)=>setF(x=>({...x,contactId:id,contactFreeText:txt||''}))} /></div>
      </div>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12,marginBottom:12}}>
        <div><Label>Value ($)</Label><input type='number' value={f.value} onChange={e=>setF(x=>({...x,value:e.target.value}))} placeholder='0' style={inp}/></div>
        <div><Label>Quote Date</Label><input type='date' value={f.quote_date||''} onChange={e=>setF(x=>({...x,quote_date:e.target.value}))} style={inp}/></div>
      </div>
      <div style={{marginBottom:12}}><Label>Address (for calendar events)</Label><input value={f.address} onChange={e=>setF(x=>({...x,address:e.target.value}))} placeholder='Job site address' style={inp}/></div>
      {/* Schedule — start row + end row each with date / start time / end time */}
      <div style={{marginBottom:12,padding:12,background:'rgba(212,169,106,0.08)',borderRadius:8,border:'1px solid rgba(212,169,106,0.2)'}}>
        <p style={{fontSize:10,fontWeight:600,textTransform:'uppercase',letterSpacing:'0.06em',color:'var(--muted-fg)',marginBottom:10,display:'flex',alignItems:'center',gap:5}}><CalendarDays size={11}/>Schedule</p>
        {/* Start row */}
        <p style={{fontSize:10,color:'var(--primary)',fontWeight:600,marginBottom:4,textTransform:'uppercase',letterSpacing:'0.04em'}}>Start</p>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:8,marginBottom:10}}>
          <div><Label>Date</Label><input type='date' value={f.startDate} onChange={e=>handleStartDate(e.target.value)} style={inp}/></div>
          <div><Label>Start Time</Label><input type='time' value={f.startTime} onChange={e=>handleStartTime(e.target.value)} style={inp}/></div>
          <div><Label>End Time</Label><input type='time' value={f.endTime} onChange={e=>handleEndTime(e.target.value)} style={inp}/></div>
        </div>
        {/* End row — date only, times applied from above */}
        <p style={{fontSize:10,color:'var(--primary)',fontWeight:600,marginBottom:4,textTransform:'uppercase',letterSpacing:'0.04em'}}>End</p>
        <div style={{display:'grid',gridTemplateColumns:'1fr',gap:8}}>
          <div><Label>Date</Label><input type='date' value={f.endDate} onChange={e=>handleEndDate(e.target.value)} style={inp}/></div>
        </div>
        {/* Generated day list */}
        {f.scheduleDays.length>0&&(
          <div style={{marginTop:10,borderTop:'1px solid rgba(212,169,106,0.3)',paddingTop:10}}>
            <p style={{fontSize:10,fontWeight:600,color:'var(--muted-fg)',textTransform:'uppercase',letterSpacing:'0.05em',marginBottom:6}}>Scheduled days ({f.scheduleDays.length}) — click to edit time</p>
            <div style={{display:'flex',flexDirection:'column',gap:5,maxHeight:280,overflowY:'auto',paddingRight:4}}>
              {f.scheduleDays.map(day=>(
                <DayRow key={day.date} day={day} onRemove={()=>removeDayLocal(day.date)} onUpdate={(k,v)=>updateDayTime(day.date,k,v)} inp={inp}/>
              ))}
            </div>
          </div>
        )}
      </div>
      <div style={{marginBottom:12}}>
        <Label>Labels</Label>
        <div style={{display:'flex',gap:8}}>
          {LABEL_OPTIONS.map(({v,bg,color})=>{
            const active=f.labels.includes(v);
            return <button key={v} onClick={()=>toggleLabel(v)} style={{flex:1,fontSize:11,fontWeight:600,padding:'6px 4px',borderRadius:20,border:'2px solid '+(active?color:'transparent'),background:active?bg:'var(--muted)',color:active?color:'var(--muted-fg)',cursor:'pointer',transition:'all .15s',opacity:active?1:0.65}}>{v}</button>;
          })}
        </div>
      </div>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12,marginBottom:12}}>
        <div><Label>Lead Source</Label><select value={f.leadSource||'__none'} onChange={e=>setF(x=>({...x,leadSource:e.target.value==='__none'?'':e.target.value}))} style={{background:'var(--card)',color:'var(--fg)',fontFamily:'inherit',fontSize:13,padding:'6px 10px',borderRadius:6,border:'1px solid var(--border)',width:'100%',outline:'none'}}><option value='__none'>None</option>{LEAD_SOURCES.map(s=><option key={s}>{s}</option>)}</select></div>
        <div><Label>Referral Contact</Label><select value={f.referralContactId||'__none'} onChange={e=>setF(x=>({...x,referralContactId:e.target.value==='__none'?'':e.target.value}))} style={{background:'var(--card)',color:'var(--fg)',fontFamily:'inherit',fontSize:13,padding:'6px 10px',borderRadius:6,border:'1px solid var(--border)',width:'100%',outline:'none'}}><option value='__none'>None</option>{contacts.map(c=><option key={c.id} value={c.id}>{c.fullName}</option>)}</select></div>
      </div>
      <div style={{marginBottom:12}}><Label>Description / Notes (shows in calendar)</Label><textarea value={f.description} onChange={e=>setF(x=>({...x,description:e.target.value}))} rows={3} placeholder='Project details...' style={{background:'var(--card)',color:'var(--fg)',fontFamily:'inherit',fontSize:13,padding:'8px 10px',borderRadius:6,border:'1px solid var(--border)',width:'100%',outline:'none',resize:'vertical',boxSizing:'border-box'}}/></div>
      {/* Rooms / Progress — pushed from Estimates page */}
      {f.rooms&&f.rooms.length>0&&(
        <div style={{marginBottom:12,padding:12,background:'rgba(212,169,106,0.06)',borderRadius:8,border:'1px solid rgba(212,169,106,0.2)'}}>
          <p style={{fontSize:10,fontWeight:700,textTransform:'uppercase',letterSpacing:'0.07em',color:'var(--primary)',marginBottom:10,display:'flex',alignItems:'center',gap:6}}>
            <CheckSquare size={11}/>Progress
          </p>
          <div style={{display:'flex',flexDirection:'column',gap:6,marginBottom:10}}>
            {f.rooms.map((room,ri)=>(
              <div key={ri} style={{display:'flex',alignItems:'flex-start',gap:8,padding:'6px 8px',background:'var(--card)',borderRadius:6,border:'1px solid var(--border)'}}>
                <input type='checkbox' checked={!!room.done} onChange={e=>{
                  const nr=[...f.rooms];nr[ri]={...nr[ri],done:e.target.checked};
                  const totalSqft=nr.reduce((s,r)=>s+(r.sqft||1),0);
                  const doneSqft=nr.filter(r=>r.done).reduce((s,r)=>s+(r.sqft||1),0);
                  const pct=totalSqft>0?Math.round(doneSqft/totalSqft*100):0;
                  setF(x=>({...x,rooms:nr,progress:pct}));
                }} style={{marginTop:2,accentColor:'var(--primary)',width:14,height:14,flexShrink:0}}/>
                <div style={{flex:1}}>
                  <div style={{fontSize:13,fontWeight:600,color:'var(--fg)',display:'flex',alignItems:'center',gap:6}}>
                    {room.name||'Unnamed Room'}
                    {room.sqft?<span style={{fontSize:10,color:'var(--primary)',fontWeight:500}}>{room.sqft} sqft</span>:null}
                  </div>
                  {room.surfaces&&room.surfaces.length>0&&(
                    <div style={{fontSize:11,color:'var(--muted-fg)',marginTop:2,lineHeight:1.6}}>
                      {room.surfaces.map((s,si)=><span key={si} style={{marginRight:8}}>{s.label}: <b>{s.coats}</b></span>)}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
          <div>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:4}}>
              <span style={{fontSize:11,color:'var(--muted-fg)',fontWeight:500}}>Progress</span>
              <span style={{fontSize:11,fontWeight:700,color:'var(--primary)'}}>{f.progress||0}%</span>
            </div>
            <div style={{height:6,background:'var(--border)',borderRadius:9,overflow:'hidden'}}>
              <div style={{height:'100%',background:'var(--primary)',borderRadius:9,width:`${f.progress||0}%`,transition:'width .3s'}}/>
            </div>
          </div>
        </div>
      )}
      {/* Documents pushed from Estimates */}
      {(f.quote_html||f.contract_html||f.change_order_html||f.invoice_html)&&(
        <div style={{marginBottom:12,padding:10,background:'var(--muted)',borderRadius:8,border:'1px solid var(--border)'}}>
          <p style={{fontSize:10,fontWeight:700,textTransform:'uppercase',letterSpacing:'0.07em',color:'var(--fg)',marginBottom:8}}>📄 Documents</p>
          <div style={{display:'flex',flexDirection:'column',gap:6}}>
            {[
              {key:'quote_html',label:'Quote',icon:'📄'},
              {key:'contract_html',label:'Contract',icon:'📋'},
              {key:'change_order_html',label:'Change Order',icon:'📝'},
              {key:'invoice_html',label:'Invoice',icon:'🧾'},
            ].filter(d=>f[d.key]).map(d=>{
              const isSigned=d.key==='contract_html'&&!!f.contract_signed_html;
              return (
              <div key={d.key} style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'4px 8px',background:isSigned?'rgba(34,197,94,0.08)':'rgba(212,169,106,0.12)',borderRadius:6,border:isSigned?'1px solid rgba(34,197,94,0.25)':'1px solid transparent'}}>
                <span style={{fontSize:12,fontWeight:600,color:isSigned?'#16a34a':'var(--primary)',display:'flex',alignItems:'center',gap:5}}>
                  {d.icon} {d.label}
                  {isSigned&&<span title={f.contract_signed_at?`Signed ${new Date(f.contract_signed_at).toLocaleDateString()}`:'Signed'} style={{fontSize:13}}>✅</span>}
                </span>
                <div style={{display:'flex',gap:6,alignItems:'center'}}>
                  {isSigned&&(
                    <button onClick={()=>{const w=window.open('','_blank');if(w){w.document.write(f.contract_signed_html);w.document.close();setTimeout(()=>w.print(),500);}}} style={{fontSize:11,padding:'2px 8px',borderRadius:5,border:'1px solid #16a34a',background:'transparent',color:'#16a34a',cursor:'pointer',fontWeight:600}}>⬇ Download</button>
                  )}
                  <button onClick={async()=>{
                    if(!window.confirm(`Delete ${d.label}?`))return;
                    setF(x=>({...x,[d.key]:null}));
                    await api.saveDeal({[d.key]:null},f.id);
                    DB.deals=DB.deals.map(x=>x.id===f.id?{...x,[d.key]:null}:x);
                  }} style={{fontSize:11,padding:'2px 8px',borderRadius:5,border:'1px solid var(--border)',background:'var(--card)',color:'var(--muted-fg)',cursor:'pointer',fontWeight:500}}>
                    🗑 Delete
                  </button>
                </div>
              </div>
              );
            })}
            {f.contract_signed_html&&(
              <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'4px 8px',background:'rgba(34,197,94,0.08)',borderRadius:6}}>
                <span style={{fontSize:12,fontWeight:600,color:'#16a34a'}}>✅ Signed Contract</span>
                <div style={{display:'flex',gap:6}}>
                  <button onClick={()=>{const w=window.open('','_blank');if(w){w.document.write(f.contract_signed_html);w.document.close();setTimeout(()=>w.print(),500);}}} style={{fontSize:11,padding:'2px 8px',borderRadius:5,border:'1px solid #16a34a',background:'transparent',color:'#16a34a',cursor:'pointer',fontWeight:600}}>⬇ Download</button>
                  <button onClick={async()=>{
                    if(!window.confirm('Delete signed contract?'))return;
                    setF(x=>({...x,contract_signed_html:'',contract_signed_at:''}));
                    await api.saveDeal({contract_signed_html:null,contract_signed_at:null},f.id);
                    DB.deals=DB.deals.map(x=>x.id===f.id?{...x,contract_signed_html:null,contract_signed_at:null}:x);
                  }} style={{fontSize:11,padding:'2px 8px',borderRadius:5,border:'1px solid var(--border)',background:'var(--card)',color:'var(--muted-fg)',cursor:'pointer',fontWeight:500}}>🗑 Delete</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
      <div style={{display:'flex',gap:8,justifyContent:'flex-end'}}>
        <button onClick={onClose} style={{display:'flex',alignItems:'center',gap:6,padding:'6px 14px',border:'1px solid var(--border)',borderRadius:6,background:'var(--card)',color:'var(--fg)',fontSize:12,fontWeight:500,cursor:'pointer'}}>Cancel</button>
        <button onClick={save} disabled={!f.dealName||syncing} style={{display:'flex',alignItems:'center',gap:6,padding:'6px 14px',border:'1px solid var(--primary)',borderRadius:6,background:'var(--primary)',color:'#fff',fontSize:12,fontWeight:600,cursor:(!f.dealName||syncing)?'not-allowed':'pointer',opacity:(!f.dealName||syncing)?0.6:1}}>{syncing?'Syncing…':'Save Project'}</button>
      </div>
    </Modal>
  );
}

// Inline day row with expandable time editor
function DayRow({day,onRemove,onUpdate,inp}){
  const [expanded,setExpanded]=useState(false);
  return(
    <div style={{background:'rgba(255,255,255,0.7)',border:'1px solid rgba(212,169,106,0.25)',borderRadius:6,overflow:'hidden',flexShrink:0}}>
      <div style={{display:'flex',alignItems:'center',gap:8,padding:'6px 8px',cursor:'pointer',minHeight:34}} onClick={()=>setExpanded(e=>!e)}>
        <CalendarDays size={10} style={{color:'var(--primary)',flexShrink:0}}/>
        <span style={{fontSize:11,fontWeight:500,flex:1,whiteSpace:'nowrap'}}>{fmtDateLabel(day.date)}</span>
        <span style={{fontSize:10,color:'var(--muted-fg)',whiteSpace:'nowrap'}}>{day.startTime} – {day.endTime}</span>
        <button onClick={e=>{e.stopPropagation();onRemove();}} style={{background:'none',border:'none',cursor:'pointer',color:'var(--destructive)',fontSize:14,lineHeight:1,padding:'0 2px',flexShrink:0}}>×</button>
      </div>
      {expanded&&(
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,padding:'10px 10px 12px',borderTop:'1px solid rgba(212,169,106,0.2)',background:'rgba(212,169,106,0.04)'}}>
          <div><Label>Start time</Label><input type='time' value={day.startTime} onChange={e=>onUpdate('startTime',e.target.value)} style={{...inp,width:'100%',padding:'7px 10px',fontSize:13}}/></div>
          <div><Label>End time</Label><input type='time' value={day.endTime} onChange={e=>onUpdate('endTime',e.target.value)} style={{...inp,width:'100%',padding:'7px 10px',fontSize:13}}/></div>
        </div>
      )}
    </div>
  );
}

// ─── Google Tasks helpers ─────────────────────────────────────────────────────
async function gtasksCall(prompt){
  try{
    const resp = await fetch('https://api.anthropic.com/v1/messages',{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({
        model:'claude-sonnet-4-20250514',max_tokens:600,
        system:'You are a Google Tasks assistant. Perform the requested operation and return ONLY a JSON object with the result. No markdown, no explanation.',
        messages:[{role:'user',content:prompt}],
        mcp_servers:[{type:'url',url:'https://tasks.googleapis.com/mcp',name:'google-tasks'}]
      })
    });
    if(!resp.ok) return null;
    const data = await resp.json();
    if(data.error) return null;
    const text = (data.content||[]).filter(b=>b.type==='text').map(b=>b.text).join('').trim();
    try{ return JSON.parse(text); }catch{ return {raw:text}; }
  }catch(e){ console.warn('Google Tasks error:',e.message); return null; }
}

async function gtasksCreate(task){
  // task: {title, notes, due} — due is ISO datetime string
  const due = task.due ? new Date(task.due).toISOString() : null;
  return gtasksCall(
    `Create a Google Task with title: "${task.title}"${task.notes?`, notes: "${task.notes}"`:''}${due?`, due date: "${due}"`:''}. Return JSON: {taskId, title, status}`
  );
}

async function gtasksComplete(taskId){
  return gtasksCall(`Mark Google Task with ID "${taskId}" as completed. Return JSON: {taskId, status}`);
}

async function gtasksDelete(taskId){
  return gtasksCall(`Delete Google Task with ID "${taskId}". Return JSON: {deleted: true}`);
}

async function gtasksUpdate(taskId, task){
  const due = task.due ? new Date(task.due).toISOString() : null;
  return gtasksCall(
    `Update Google Task ID "${taskId}": title="${task.title}"${task.notes?`, notes="${task.notes}"`:''}${due?`, due="${due}"`:''}. Return JSON: {taskId, title}`
  );
}

// ─── Task Modal ───────────────────────────────────────────────────────────────
function TaskModal({open,onClose,task,contacts,deals,onSaved}){
  const blank={title:'',details:'',dueDate:'',dueTime:'',contactId:'',dealId:'',priority:'none',completed:false,subtasks:[]};
  const [f,setF]=useState(blank);
  const [saving,setSaving]=useState(false);
  const [newSub,setNewSub]=useState('');

  useEffect(()=>{
    if(task) setF({
      title:task.title||'',details:task.details||'',
      dueDate:task.dueDate||'',dueTime:task.dueTime||'',
      contactId:task.contactId||'',dealId:task.dealId||'',
      priority:task.priority||'none',completed:task.completed||false,
      subtasks:task.subtasks||[]
    });
    else setF(blank);
    setNewSub('');
  },[task,open]);

  const addSub=()=>{
    const t=newSub.trim();
    if(!t)return;
    setF(x=>({...x,subtasks:[...x.subtasks,{title:t,completed:false}]}));
    setNewSub('');
  };
  const toggleSub=i=>setF(x=>({...x,subtasks:x.subtasks.map((s,j)=>j===i?{...s,completed:!s.completed}:s)}));
  const removeSub=i=>setF(x=>({...x,subtasks:x.subtasks.filter((_,j)=>j!==i)}));

  const save=async()=>{
    setSaving(true);
    const due = f.dueDate ? `${f.dueDate}T${f.dueTime||'09:00'}:00` : null;
    const taskData={title:f.title,details:f.details,dueDate:f.dueDate,dueTime:f.dueTime,
      contactId:f.contactId,dealId:f.dealId,priority:f.priority,completed:f.completed,
      subtasks:f.subtasks};

    let gtaskId = task?.gtaskId || null;
    try{
      if(task?.id){
        if(gtaskId) await gtasksUpdate(gtaskId,{title:f.title,notes:f.details,due});
        await api.saveActivity({...taskData,gtaskId},task.id);
      } else {
        const result = await gtasksCreate({title:f.title,notes:f.details,due});
        gtaskId = result?.taskId || null;
        await api.saveActivity({...taskData,type:'Task',gtaskId});
      }
    }catch(e){ console.warn(e); }
    setSaving(false);
    onSaved(); onClose();
  };

  const doneCount=f.subtasks.filter(s=>s.completed).length;

  return (
    <Modal open={open} onClose={onClose} title={task?'Edit Task':'New Task'}>
      <div style={{marginBottom:12}}><Label>Task Title</Label><Input value={f.title} onChange={e=>setF(x=>({...x,title:e.target.value}))} placeholder='What needs to be done?'/></div>
      <div style={{marginBottom:12}}><Label>Details / Notes</Label><Textarea value={f.details} onChange={e=>setF(x=>({...x,details:e.target.value}))} rows={3} placeholder='Add details, instructions, or notes…'/></div>

      {/* Subtasks */}
      <div style={{marginBottom:12}}>
        <Label>Subtasks{f.subtasks.length>0&&<span style={{color:'var(--muted-fg)',fontWeight:400,marginLeft:6}}>{doneCount}/{f.subtasks.length}</span>}</Label>
        {f.subtasks.map((s,i)=>(
          <div key={i} style={{display:'flex',alignItems:'center',gap:8,padding:'5px 0',borderBottom:'1px solid var(--border)'}}>
            <input type='checkbox' checked={s.completed} onChange={()=>toggleSub(i)}
              style={{cursor:'pointer',accentColor:'var(--primary)',flexShrink:0}}/>
            <span style={{flex:1,fontSize:13,textDecoration:s.completed?'line-through':'none',color:s.completed?'var(--muted-fg)':'var(--fg)'}}>{s.title}</span>
            <button onClick={()=>removeSub(i)} style={{background:'none',border:'none',cursor:'pointer',color:'var(--muted-fg)',fontSize:15,padding:'0 2px',lineHeight:1}}>×</button>
          </div>
        ))}
        <div style={{display:'flex',gap:6,marginTop:6}}>
          <Input value={newSub} onChange={e=>setNewSub(e.target.value)}
            onKeyDown={e=>e.key==='Enter'&&(e.preventDefault(),addSub())}
            placeholder='Add subtask…' style={{flex:1,fontSize:12}}/>
          <Btn onClick={addSub} disabled={!newSub.trim()} style={{padding:'6px 12px',fontSize:12}}>Add</Btn>
        </div>
      </div>

      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12,marginBottom:12}}>
        <div><Label>Due Date</Label><Input type='date' value={f.dueDate} onChange={e=>setF(x=>({...x,dueDate:e.target.value}))}/></div>
        <div><Label>Due Time</Label><Input type='time' value={f.dueTime} onChange={e=>setF(x=>({...x,dueTime:e.target.value}))}/></div>
      </div>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12,marginBottom:12}}>
        <div><Label>Contact</Label>
          <Select value={f.contactId||'__none'} onChange={e=>setF(x=>({...x,contactId:e.target.value==='__none'?'':e.target.value}))}>
            <option value='__none'>None</option>
            {contacts.map(c=><option key={c.id} value={c.id}>{c.fullName||c.email||'Unnamed'}</option>)}
          </Select>
        </div>
        <div><Label>Project</Label>
          <Select value={f.dealId||'__none'} onChange={e=>setF(x=>({...x,dealId:e.target.value==='__none'?'':e.target.value}))}>
            <option value='__none'>None</option>
            {deals.map(d=><option key={d.id} value={d.id}>{d.dealName}</option>)}
          </Select>
        </div>
      </div>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12,marginBottom:12}}>
        <div><Label>Priority</Label>
          <Select value={f.priority} onChange={e=>setF(x=>({...x,priority:e.target.value}))}>
            {['none','low','medium','high'].map(p=><option key={p} value={p}>{p.charAt(0).toUpperCase()+p.slice(1)}</option>)}
          </Select>
        </div>
        <div style={{display:'flex',alignItems:'flex-end',paddingBottom:2}}>
          <label style={{display:'flex',alignItems:'center',gap:8,cursor:'pointer',fontSize:13}}>
            <input type='checkbox' checked={f.completed} onChange={e=>setF(x=>({...x,completed:e.target.checked}))} style={{cursor:'pointer'}}/>
            Mark as completed
          </label>
        </div>
      </div>
      <div style={{display:'flex',gap:8,justifyContent:'flex-end'}}>
        <Btn variant='outline' onClick={onClose}>Cancel</Btn>
        <Btn onClick={save} disabled={!f.title||saving}>{saving?'Saving…':'Save Task'}</Btn>
      </div>
    </Modal>
  );
}

// ─── Tasks Dashboard Widget ───────────────────────────────────────────────────
function TasksWidget(){
  const [tasks,setTasks]=useState([]);
  const [loading,setLoading]=useState(true);
  const [modal,setModal]=useState(false);
  const [edit,setEdit]=useState(null);
  const [contacts]=useState(()=>api.getContacts());
  const [deals,setDeals]=useState(()=>api.getDeals());

  const load=async()=>{
    await api.loadActivities();
    const all=api.getActivities();
    setTasks(all.filter(t=>!t.completed));
    setDeals(api.getDeals());
    setLoading(false);
  };

  // Load on mount, then refresh every 10s to catch new tasks
  useEffect(()=>{
    load();
    const interval=setInterval(load, 10000);
    return ()=>clearInterval(interval);
  },[]);

  const toggle=async(e,t)=>{
    e.stopPropagation();
    if(t.gtaskId) await gtasksComplete(t.gtaskId);
    await api.saveActivity({completed:true},t.id);
    load();
  };

  const openEdit=t=>{setEdit(t);setModal(true);};
  const openNew=()=>{setEdit(null);setModal(true);};

  const PRIORITY_DOT={high:'#ef4444',medium:'#f59e0b',low:'#3b82f6',none:'transparent'};

  return (
    <Card style={{display:'flex',flexDirection:'column',minHeight:0}}>
      <div style={{padding:'10px 14px 8px',display:'flex',justifyContent:'space-between',alignItems:'center',borderBottom:'1px solid var(--border)'}}>
        <span style={{fontWeight:600,fontSize:12,display:'flex',alignItems:'center',gap:6}}><CheckSquare size={13} style={{color:'var(--primary)'}}/>Pending Tasks</span>
        <button onClick={openNew} style={{background:'none',border:'none',cursor:'pointer',color:'var(--primary)',fontSize:11,fontWeight:500,display:'flex',alignItems:'center',gap:3}}><Plus size={11}/>Add</button>
      </div>
      <div style={{padding:'6px 0',overflowY:'auto',flex:1}}>
        {loading&&<p style={{padding:'12px 14px',fontSize:12,color:'var(--muted-fg)'}}>Loading…</p>}
        {!loading&&tasks.length===0&&<p style={{padding:'12px 14px',fontSize:12,color:'var(--muted-fg)'}}>No pending tasks.</p>}
        {tasks.map(t=>{
          const dealName=deals.find(d=>d.id===t.deal)?.dealName||'';
          const subs=t.subtasks||[];
          const doneSubs=subs.filter(s=>s.completed).length;
          const toggleSubInline=async(e,subIdx)=>{
            e.stopPropagation();
            const updated=subs.map((s,i)=>i===subIdx?{...s,completed:!s.completed}:s);
            await api.saveActivity({subtasks:updated},t.id);
            load();
          };
          return (
            <div key={t.id} onClick={()=>openEdit(t)}
              style={{borderBottom:'1px solid var(--border)',cursor:'pointer',transition:'background 0.1s'}}
              onMouseEnter={e=>e.currentTarget.style.background='var(--muted)'}
              onMouseLeave={e=>e.currentTarget.style.background=''}>
              {/* Task row */}
              <div style={{display:'flex',alignItems:'flex-start',gap:8,padding:'7px 14px'}}>
                <input type='checkbox' checked={false} onChange={e=>toggle(e,t)} onClick={e=>e.stopPropagation()} style={{marginTop:2,cursor:'pointer',accentColor:'var(--primary)',flexShrink:0}}/>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{display:'flex',alignItems:'center',gap:6}}>
                    <p style={{fontSize:12,fontWeight:500,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis',flex:1}}>{t.title}</p>
                    {subs.length>0&&<span style={{fontSize:10,color:'var(--muted-fg)',flexShrink:0,background:'var(--muted)',borderRadius:4,padding:'1px 5px'}}>{doneSubs}/{subs.length}</span>}
                  </div>
                  {dealName&&<p style={{fontSize:10,color:'var(--muted-fg)',marginTop:1}}>{dealName}</p>}
                  {t.dueDate&&<p style={{fontSize:10,color:new Date(`${t.dueDate}T${t.dueTime||'23:59'}`)<new Date()?'var(--destructive)':'var(--muted-fg)',marginTop:1}}><CalendarDays size={9} style={{display:'inline',verticalAlign:'middle',marginRight:2}}/>{t.dueDate}{t.dueTime?` ${t.dueTime}`:''}</p>}
                </div>
                {t.priority&&t.priority!=='none'&&<div style={{width:6,height:6,borderRadius:'50%',background:PRIORITY_DOT[t.priority],flexShrink:0,marginTop:4}}/>}
              </div>
              {/* Subtask rows */}
              {subs.length>0&&(
                <div style={{paddingLeft:38,paddingBottom:6,paddingRight:14}}>
                  {subs.map((s,i)=>(
                    <div key={i} onClick={e=>e.stopPropagation()}
                      style={{display:'flex',alignItems:'center',gap:6,padding:'3px 0'}}>
                      <input type='checkbox' checked={s.completed} onChange={e=>toggleSubInline(e,i)}
                        style={{cursor:'pointer',accentColor:'var(--primary)',flexShrink:0}}/>
                      <span style={{fontSize:11,color:s.completed?'var(--muted-fg)':'var(--fg)',textDecoration:s.completed?'line-through':'none'}}>{s.title}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
      <TaskModal open={modal} onClose={()=>setModal(false)} task={edit} contacts={contacts} deals={deals}
        onSaved={async()=>{await api.loadActivities();load();}}/>
    </Card>
  );
}

// ─── Google Calendar Week Widget ─────────────────────────────────────────────

function CalendarWeekWidget(){
  const [events,setEvents]=useState([]);
  const [error,setError]=useState(null);
  const [loading,setLoading]=useState(true);
  const [needsAuth,setNeedsAuth]=useState(false);

  const load=useCallback(async(forceAuth=false)=>{
    setLoading(true);
    setError(null);
    setNeedsAuth(false);
    try{
      if(!GCAL_CLIENT_ID){
        // No client ID configured — show setup message
        setNeedsAuth(true);
        setEvents([]);
        return;
      }
      const now=new Date();
      const startOfDay=new Date(now); startOfDay.setHours(0,0,0,0);
      const endOfWeek=new Date(startOfDay); endOfWeek.setDate(endOfWeek.getDate()+7);
      const resp=await gcalFetchEvents(startOfDay.toISOString(), endOfWeek.toISOString());
      if(!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const data=await resp.json();
      setEvents((data.items||[]).map(ev=>({
        title:ev.summary||'(No title)',
        start:ev.start?.dateTime||ev.start?.date||'',
        end:ev.end?.dateTime||ev.end?.date||'',
        allDay:!ev.start?.dateTime,
        location:ev.location||null,
      })));
    }catch(e){
      if(e.message==='NO_CLIENT_ID'||e.message==='popup_closed_by_user'||e.message==='access_denied'){
        setNeedsAuth(true);
      } else {
        setError(e.message||'Could not load calendar');
      }
      setEvents([]);
    }finally{
      setLoading(false);
    }
  },[]);

  useEffect(()=>{ load(); },[load]);

  const signIn=async()=>{
    setLoading(true);
    setNeedsAuth(false);
    await load(true);
  };

  const today=new Date();
  today.setHours(0,0,0,0);
  const days=[];
  for(let i=0;i<7;i++){const d=new Date(today);d.setDate(d.getDate()+i);days.push(d);}

  const eventsForDay=day=>events.filter(ev=>{
    const st=new Date(ev.start);
    return st.getFullYear()===day.getFullYear()&&st.getMonth()===day.getMonth()&&st.getDate()===day.getDate();
  }).sort((a,b)=>new Date(a.start)-new Date(b.start));

  const fmtTime=iso=>new Date(iso).toLocaleTimeString('en-CA',{hour:'numeric',minute:'2-digit',hour12:true});
  const isToday=d=>{const t=new Date();return d.getDate()===t.getDate()&&d.getMonth()===t.getMonth()&&d.getFullYear()===t.getFullYear();};
  const DAY_COLORS=['#e8f0fe','#fce8f3','#e6f4ea','#fef3e2','#f3e8fd','#e8f5fe','#fff8e1'];
  const DOT_COLORS=['#4285f4','#e91e8c','#34a853','#f4a400','#9c27b0','#00acc1','#f9a825'];

  return (
    <Card style={{display:'flex',flexDirection:'column',minHeight:0,overflow:'hidden'}}>
      <div style={{padding:'10px 14px 6px',display:'flex',alignItems:'center',justifyContent:'space-between',flexShrink:0}}>
        <span style={{fontWeight:600,fontSize:13,display:'flex',alignItems:'center',gap:6}}><CalendarDays size={14} style={{color:'var(--primary)'}}/>This Week</span>
        {loading&&<span style={{fontSize:10,color:'var(--muted-fg)'}}>Loading…</span>}
        {!loading&&!error&&!needsAuth&&<span style={{fontSize:10,color:'var(--muted-fg)',display:'flex',alignItems:'center',gap:6}}>
          {events.length} event{events.length!==1?'s':''}
          <button onClick={()=>load()} style={{background:'none',border:'none',cursor:'pointer',color:'var(--muted-fg)',fontSize:10,padding:0}}>↻</button>
          <button onClick={()=>{gcalClearToken();load();}} style={{background:'none',border:'none',cursor:'pointer',color:'var(--muted-fg)',fontSize:10,padding:0}}>Sign out</button>
        </span>}
        {!loading&&error&&<button onClick={()=>load()} style={{fontSize:10,color:'var(--primary)',background:'none',border:'none',cursor:'pointer',textDecoration:'underline'}}>Retry</button>}
      </div>
      <div style={{overflowY:'auto',flex:1,padding:'0 6px 8px'}}>
        {needsAuth&&(
          <div style={{padding:'20px 14px',textAlign:'center'}}>
            <CalendarDays size={28} style={{color:'var(--muted)',margin:'0 auto 10px',display:'block'}}/>
            <p style={{fontSize:12,fontWeight:600,marginBottom:6}}>Connect Google Calendar</p>
            <p style={{fontSize:11,color:'var(--muted-fg)',marginBottom:12,lineHeight:1.5}}>
              {GCAL_CLIENT_ID?'Sign in to see your events this week.':'Google Calendar requires a Client ID to be configured.'}
            </p>
            {GCAL_CLIENT_ID&&(
              <button onClick={signIn} style={{background:'var(--primary)',color:'#fff',border:'none',borderRadius:6,padding:'8px 16px',fontSize:12,fontWeight:600,cursor:'pointer',display:'inline-flex',alignItems:'center',gap:6}}>
                <svg width="14" height="14" viewBox="0 0 24 24"><path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/><path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
                Sign in with Google
              </button>
            )}
          </div>
        )}
        {error&&!needsAuth&&(
          <div style={{padding:'16px 14px',fontSize:11,color:'var(--muted-fg)',textAlign:'center'}}>
            <p style={{fontWeight:600,marginBottom:4,color:'var(--fg)'}}>Calendar error</p>
            <p style={{fontSize:10}}>{error}</p>
          </div>
        )}
        {!needsAuth&&!error&&days.map((day,di)=>{
          const dayEvents=eventsForDay(day);
          const todayStyle=isToday(day);
          return(
            <div key={di} style={{marginBottom:4}}>
              <div style={{display:'flex',alignItems:'center',gap:8,padding:'4px 8px',borderRadius:6,background:todayStyle?'rgba(212,169,106,0.12)':'transparent'}}>
                <div style={{flexShrink:0,width:52}}>
                  <p style={{fontSize:10,fontWeight:todayStyle?700:500,color:todayStyle?'var(--primary)':'var(--muted-fg)',textTransform:'uppercase',letterSpacing:'0.04em'}}>{day.toLocaleDateString('en-CA',{weekday:'short'})}</p>
                  <p style={{fontSize:13,fontWeight:todayStyle?700:400,color:todayStyle?'var(--primary)':'var(--fg)'}}>{day.getDate()}</p>
                </div>
                <div style={{flex:1,minWidth:0}}>
                  {loading&&<div style={{height:12,width:'55%',background:'var(--muted)',borderRadius:4,opacity:0.3}}/>}
                  {!loading&&dayEvents.length===0&&<p style={{fontSize:11,color:'var(--muted-fg)',fontStyle:'italic'}}>No events</p>}
                  {dayEvents.map((ev,ei)=>(
                    <div key={ei} style={{display:'flex',alignItems:'baseline',gap:6,marginBottom:2,background:DAY_COLORS[di%DAY_COLORS.length],borderRadius:5,padding:'3px 8px',borderLeft:`3px solid ${DOT_COLORS[di%DOT_COLORS.length]}`}}>
                      <span style={{fontSize:10,color:DOT_COLORS[di%DOT_COLORS.length],fontWeight:600,flexShrink:0,minWidth:70}}>{ev.allDay?'All day':fmtTime(ev.start)}</span>
                      <span style={{fontSize:11,fontWeight:500,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',color:'#2e3557'}}>{ev.title}</span>
                    </div>
                  ))}
                </div>
              </div>
              {di<6&&<div style={{height:1,background:'var(--border)',margin:'2px 8px'}}/>}
            </div>
          );
        })}
      </div>
    </Card>
  );
}

// ─── PAGES ────────────────────────────────────────────────────────────────────
function Dashboard({toast}){
  const [,forceUpdate]=useState(0);
  useEffect(()=>{ api.loadDeals().then(()=>forceUpdate(n=>n+1)); },[]);
  const d = api.getDashboard();
  const deals = api.getDeals();
  const contacts = api.getContacts();

  // Scheduled projects stats
  const scheduledDeals = deals.filter(d=>d.stage==='Scheduled');
  const scheduledValue = scheduledDeals.reduce((s,d)=>s+(d.value||0),0);

  // Invoice stats — same filter as InvoicePage: Scheduled + Completed + Archive, no Lost label
  const invoiceDeals = deals.filter(d=>
    ['Scheduled','Completed','Archive'].includes(d.stage) &&
    !(d.labels||[]).includes('Lost')
  );
  const outstandingDeals = invoiceDeals.filter(d=>Math.max(0,(parseFloat(d.value)||0)-(parseFloat(d.invoicePaid)||0))>0);
  const outstandingCount = outstandingDeals.length;
  const outstandingAmt = outstandingDeals.reduce((s,d)=>s+Math.max(0,(parseFloat(d.value)||0)-(parseFloat(d.invoicePaid)||0)),0);

  // Financials stats — same filter as Financials page: Scheduled + Completed + Archive, no Lost
  const revenueDeals = deals.filter(d=>['Scheduled','Completed','Archive'].includes(d.stage)&&!(d.labels||[]).includes('Lost'));
  const totalRevenue = revenueDeals.reduce((s,d)=>s+(parseFloat(d.value)||0),0);
  const totalProfit = revenueDeals.reduce((s,d)=>s+((parseFloat(d.value)||0)-(parseFloat(d.materials)||0)-(parseFloat(d.wages)||0)),0);
  const totalProjects = revenueDeals.length;

  // Lost deals — Archive stage with Lost label
  const lostDeals = deals.filter(d=>d.stage==='Archive'&&(d.labels||[]).includes('Lost'));
  const totalLost = lostDeals.length;
  const totalLostValue = lostDeals.reduce((s,d)=>s+(parseFloat(d.value)||0),0);

  // Conversion Rate: clients with $0 outstanding / Scheduled→Archive deals
  const paidOffDeals = invoiceDeals.filter(d=>(parseFloat(d.value)||0)>0 && Math.max(0,(parseFloat(d.value)||0)-(parseFloat(d.invoicePaid)||0))===0);
  const allPipelineDeals = deals.filter(d=>['Scheduled','Completed','Archive'].includes(d.stage)); // Scheduled→Archive only
  const conversionRate = allPipelineDeals.length>0 ? (paidOffDeals.length/allPipelineDeals.length)*100 : 0;

  // Profit Margin: (gross profit / revenue) * 100
  const profitMargin = totalRevenue>0 ? (totalProfit/totalRevenue)*100 : 0;

  const StatCard=({label,value,color='var(--primary)'})=>(
    <Card style={{padding:'14px 18px'}}>
      <p style={{fontSize:10,fontWeight:700,textTransform:'uppercase',letterSpacing:'0.06em',color:'var(--muted-fg)',marginBottom:4}}>{label}</p>
      <p style={{fontSize:26,fontWeight:700,color,lineHeight:1}}>{value}</p>
    </Card>
  );

  return (
    <div style={{padding:'14px 18px',height:'100%',display:'flex',flexDirection:'column',gap:10,overflow:'hidden'}}>
      <div style={{flexShrink:0}}>
        <h1 style={{fontSize:17,fontWeight:700}}>Dashboard</h1>
      </div>
      <div style={{flex:1,overflowY:'auto',display:'flex',flexDirection:'column',gap:10,minHeight:0}}>

        {/* Row 1 — Calendar + Tasks */}
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,minHeight:280}}>
          <CalendarWeekWidget/>
          <TasksWidget/>
        </div>

        {/* Row 2 — Proposals + Scheduled Projects */}
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>

          <Card style={{display:'flex',flexDirection:'column'}}>
            <div style={{padding:'10px 14px 8px',borderBottom:'1px solid var(--border)',display:'flex',alignItems:'center',justifyContent:'space-between'}}>
              <span style={{fontWeight:600,fontSize:12,display:'flex',alignItems:'center',gap:6}}><FileText size={13} style={{color:'var(--primary)'}}/>Proposals</span>
              <span style={{fontSize:11,fontWeight:700,color:'var(--primary)'}}>{deals.filter(d=>d.stage==='Proposal').length} proposal{deals.filter(d=>d.stage==='Proposal').length!==1?'s':''}</span>
            </div>
            <div style={{padding:'8px 0',flex:1,overflowY:'auto'}}>
              {deals.filter(d=>d.stage==='Proposal').length===0&&<p style={{padding:'16px 14px',fontSize:12,color:'var(--muted-fg)'}}>No proposals yet.</p>}
              {deals.filter(d=>d.stage==='Proposal').map(deal=>{
                const contactName=contacts.find(c=>c.id===(deal.contact||deal.contactId))?.fullName||'';
                return(
                  <div key={deal.id} style={{padding:'7px 14px',borderBottom:'1px solid var(--border)',display:'flex',justifyContent:'space-between',alignItems:'flex-start',gap:8}}>
                    <div style={{minWidth:0}}>
                      <p style={{fontSize:12,fontWeight:600,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{deal.dealName}</p>
                      {contactName&&<p style={{fontSize:10,color:'var(--muted-fg)',marginTop:1}}>{contactName}</p>}
                    </div>
                    <span style={{fontSize:12,fontWeight:700,color:'var(--primary)',flexShrink:0}}>{fmtUSD(deal.value||0)}</span>
                  </div>
                );
              })}
            </div>
            {deals.filter(d=>d.stage==='Proposal').length>0&&(
              <div style={{padding:'8px 14px',borderTop:'1px solid var(--border)',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                <span style={{fontSize:11,color:'var(--muted-fg)'}}>Total value</span>
                <span style={{fontSize:13,fontWeight:700}}>{fmtUSD(deals.filter(d=>d.stage==='Proposal').reduce((s,d)=>s+(parseFloat(d.value)||0),0))}</span>
              </div>
            )}
          </Card>

          <Card style={{display:'flex',flexDirection:'column'}}>
            <div style={{padding:'10px 14px 8px',borderBottom:'1px solid var(--border)',display:'flex',alignItems:'center',justifyContent:'space-between'}}>
              <span style={{fontWeight:600,fontSize:12,display:'flex',alignItems:'center',gap:6}}><CalendarDays size={13} style={{color:'var(--primary)'}}/>Scheduled Projects</span>
              <span style={{fontSize:11,fontWeight:700,color:'var(--primary)'}}>{scheduledDeals.length} project{scheduledDeals.length!==1?'s':''}</span>
            </div>
            <div style={{padding:'8px 0',flex:1,overflowY:'auto'}}>
              {scheduledDeals.length===0&&<p style={{padding:'16px 14px',fontSize:12,color:'var(--muted-fg)'}}>No scheduled projects.</p>}
              {scheduledDeals.map(deal=>{
                const days=deal.scheduleDays||[];
                const nextDay=days.find(d=>new Date(d.date)>=new Date());
                return(
                  <div key={deal.id} style={{padding:'7px 14px',borderBottom:'1px solid var(--border)',display:'flex',justifyContent:'space-between',alignItems:'flex-start',gap:8}}>
                    <div style={{minWidth:0}}>
                      <p style={{fontSize:12,fontWeight:600,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{deal.dealName}</p>
                      {nextDay&&<p style={{fontSize:10,color:'var(--muted-fg)',marginTop:1}}>{nextDay.date} · {nextDay.startTime}–{nextDay.endTime}</p>}
                    </div>
                    <span style={{fontSize:12,fontWeight:700,color:'var(--primary)',flexShrink:0}}>{fmtUSD(deal.value||0)}</span>
                  </div>
                );
              })}
            </div>
            {scheduledDeals.length>0&&(
              <div style={{padding:'8px 14px',borderTop:'1px solid var(--border)',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                <span style={{fontSize:11,color:'var(--muted-fg)'}}>Total value</span>
                <span style={{fontSize:13,fontWeight:700}}>{fmtUSD(scheduledValue)}</span>
              </div>
            )}
          </Card>

        </div>

        {/* Row 3 — Invoice cards */}
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,flexShrink:0}}>
          <StatCard label='Outstanding Invoices' value={outstandingCount}/>
          <StatCard label='Outstanding Amount' value={fmtUSD(outstandingAmt)} color='#ef4444'/>
        </div>

        {/* Row 4 — Financials summary */}
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:10,flexShrink:0}}>
          <StatCard label='Total Revenue' value={fmtUSD(totalRevenue)}/>
          <StatCard label='Total Profit' value={fmtUSD(totalProfit)} color={totalProfit>=0?'#22c55e':'#ef4444'}/>
          <StatCard label='Profit Margin' value={profitMargin.toFixed(1)+'%'} color={profitMargin>=0?'#22c55e':'#ef4444'}/>
        </div>

        {/* Row 5 — Conversion Rate + Avg Project Value */}
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,flexShrink:0}}>
          <StatCard label='Conversion Rate' value={conversionRate.toFixed(1)+'%'} color='var(--primary)'/>
          <StatCard label='Avg Project Value' value={fmtUSD(allPipelineDeals.length>0?totalRevenue/allPipelineDeals.length:0)} color='var(--primary)'/>
        </div>

        {/* Row 6 — Leads by Source */}
        <div style={{background:'var(--card)',border:'1px solid var(--border)',borderRadius:10,padding:'14px 16px',flexShrink:0}}>
          <p style={{fontSize:11,fontWeight:700,textTransform:'uppercase',letterSpacing:'0.06em',color:'var(--muted-fg)',marginBottom:12}}>Leads by Source</p>
          <div style={{display:'flex',flexDirection:'column',gap:8}}>
            {LEAD_SOURCES.map(source=>{
              const srcDeals=deals.filter(d=>['Scheduled','Completed','Archive'].includes(d.stage));
              const count=srcDeals.filter(d=>d.leadSource===source).length;
              const total=srcDeals.filter(d=>d.leadSource).length||1;
              const pct=Math.round((count/total)*100);
              return (
                <div key={source} style={{display:'flex',alignItems:'center',gap:8}}>
                  <span style={{fontSize:11,fontWeight:700,width:84,textAlign:'center',flexShrink:0,padding:'2px 10px',borderRadius:20,background:(LEAD_COLORS[source]||{bg:'#f3f4f6'}).bg,color:(LEAD_COLORS[source]||{color:'#374151'}).color}}>{source}</span>
                  <div style={{flex:1,height:8,background:'var(--muted)',borderRadius:9,overflow:'hidden'}}>
                    <div style={{height:'100%',background:'var(--primary)',borderRadius:9,width:`${pct}%`,transition:'width .4s'}}/>
                  </div>
                  <span style={{fontSize:11,fontWeight:700,color:'var(--primary)',width:24,textAlign:'right'}}>{count}</span>
                  <span style={{fontSize:10,color:'var(--muted-fg)',width:32,textAlign:'right'}}>{pct}%</span>
                </div>
              );
            })}
            {deals.filter(d=>['Scheduled','Completed','Archive'].includes(d.stage)&&d.leadSource).length===0&&(
              <p style={{fontSize:12,color:'var(--muted-fg)'}}>No lead sources assigned yet.</p>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}

function Pipeline({showToast}){
  const [deals,setDeals]=useState(()=>api.getDeals());
  const [contacts,setContacts]=useState(()=>api.getContacts());
  const [modalOpen,setModalOpen]=useState(false);
  const [editDeal,setEditDeal]=useState(null);
  const [defaultStage,setDefaultStage]=useState('Lead');
  const [confirm,setConfirm]=useState(null);
  const [dragId,setDragId]=useState(null);
  const [dragOver,setDragOver]=useState(null);
  const [showArchive,setShowArchive]=useState(false);

  const load=()=>{setDeals(api.getDeals());setContacts(api.getContacts());};
  useEffect(()=>{
    api.loadDeals().then(()=>load());
    api.loadContacts().then(()=>setContacts(api.getContacts()));
  },[]);
  const contactName=deal=>{const cid=Array.isArray(deal.contact)?deal.contact[0]:deal.contact;return contacts.find(c=>c.id===cid)?.fullName||deal.contactFreeText||'';};
  const refName=deal=>{if(!deal.referralName)return '';return contacts.find(c=>c.id===deal.referralName)?.fullName||'';};

  const advance=async deal=>{
    const idx=STAGES.indexOf(deal.stage||'Lead');
    if(idx<STAGES.length-1){
      await api.saveDeal({stage:STAGES[idx+1]},deal.id);
      showToast(`Moved to ${STAGES[idx+1]}`);
      load();
    }
  };

  const removeDay=async(deal,date)=>{
    const day=(deal.scheduleDays||[]).find(d=>d.date===date);
    if(day?.calEventId) await gcalDeleteEvent(day.calEventId);
    const newDays=(deal.scheduleDays||[]).filter(d=>d.date!==date);
    await api.saveDeal({scheduleDays:newDays},deal.id);
    load();
    showToast('Day removed');
  };

  // Drag handlers
  const onDragStart=(e,id)=>{
    setDragId(id);
    e.dataTransfer.effectAllowed='move';
    e.dataTransfer.setData('text/plain',id);
  };
  const onDragEnd=()=>{setDragId(null);setDragOver(null);};
  const onDragOver=(e,stage)=>{e.preventDefault();e.dataTransfer.dropEffect='move';setDragOver(stage);};
  const onDragLeave=()=>setDragOver(null);
  const onDrop=async(e,stage)=>{
    e.preventDefault();
    const id=e.dataTransfer.getData('text/plain')||dragId;
    setDragId(null);setDragOver(null);
    if(!id)return;
    const deal=api.getDeals().find(d=>d.id===id);
    if(!deal||deal.stage===stage)return;
    await api.saveDeal({stage},id);
    showToast(`Moved to ${stage}`);
    load();
  };

  return (
    <div style={{padding:20,display:'flex',flexDirection:'column',height:'100%',overflow:'hidden'}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16}}>
        <div>
          <h1 style={{fontSize:20,fontWeight:700}}>Pipeline</h1>
        </div>
        <div style={{display:'flex',gap:8,alignItems:'center'}}>
          <button onClick={()=>setShowArchive(v=>!v)}
            style={{display:'flex',alignItems:'center',gap:6,padding:'6px 12px',border:'1px solid var(--border)',borderRadius:6,background:showArchive?'var(--primary)':'var(--card)',color:showArchive?'#fff':'var(--fg)',fontSize:12,fontWeight:500,cursor:'pointer',transition:'all 0.15s'}}>
            <ArchiveIcon size={13}/>Archive{showArchive?' (on)':''}
          </button>
          <button onClick={()=>{setEditDeal(null);setDefaultStage('Lead');setModalOpen(true);}} style={{display:'flex',alignItems:'center',gap:6,padding:'6px 12px',border:'1px solid var(--border)',borderRadius:6,background:'var(--card)',color:'var(--fg)',fontSize:12,fontWeight:500,cursor:'pointer',transition:'all 0.15s'}}><Plus size={13}/>New Project</button>
        </div>
      </div>
      <div style={{display:'flex',gap:16,overflowX:'auto',flex:1,paddingBottom:12,scrollSnapType:'x mandatory',WebkitOverflowScrolling:'touch'}}>
        {STAGES.filter(s=>showArchive||s!=='Archive').map(stage=>{
          const sd=deals.filter(d=>d.stage===stage).sort((a,b)=>{
            const ta=new Date(a.startDate||a.created_at||0).getTime();
            const tb=new Date(b.startDate||b.created_at||0).getTime();
            return tb-ta; // latest first
          });
          const sv=sd.reduce((s,d)=>s+(d.value||0),0);
          const isLast=stage===STAGES[STAGES.length-1];
          const isTarget=dragOver===stage&&dragId&&api.getDeals().find(d=>d.id===dragId)?.stage!==stage;
          return (
            <div key={stage}
              style={{flexShrink:0,width:300,display:'flex',flexDirection:'column',scrollSnapAlign:'start'}}
              onDragOver={e=>onDragOver(e,stage)}
              onDragLeave={onDragLeave}
              onDrop={e=>onDrop(e,stage)}
            >
              {/* Column header — no + button */}
              <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:8,padding:'0 2px'}}>
                <span className={cn('text-xs font-semibold px-2.5 py-1 rounded-full',STAGE_COLORS[stage])} style={{display:'flex',alignItems:'center',gap:4}}>{stage==='Archive'?<><ArchiveIcon size={10}/> Archive</>:stage}</span>
                <span style={{fontSize:12,color:'var(--muted-fg)',fontWeight:500}}>{sd.length} card{sd.length!==1?'s':''}</span>
                {sv>0&&<span style={{fontSize:11,color:'var(--muted-fg)',marginLeft:'auto'}}>{fmtUSD(sv)}</span>}
              </div>
              {/* Cards */}
              <div style={{flex:1,display:'flex',flexDirection:'column',gap:10,overflowY:'auto',borderRadius:10,padding:isTarget?8:0,border:isTarget?'2px dashed rgba(212,169,106,0.6)':'2px solid transparent',background:isTarget?'rgba(212,169,106,0.07)':'transparent',transition:'all 0.15s',minHeight:80}}>
                {sd.map(deal=>{
                  const dragging=dragId===deal.id;
                  return (
                    <div key={deal.id}
                      draggable
                      onDragStart={e=>onDragStart(e,deal.id)}
                      onDragEnd={onDragEnd}
                      onClick={()=>{if(!dragging){setEditDeal(deal);setModalOpen(true);}}}
                      style={{background:'var(--card)',border:'1px solid var(--border)',borderRadius:12,padding:16,boxShadow:dragging?'none':'0 2px 8px rgba(0,0,0,.07)',cursor:'grab',opacity:dragging?0.35:1,transform:dragging?'scale(0.97)':'none',transition:'opacity 0.15s,transform 0.15s,box-shadow 0.15s',userSelect:'none'}}
                      onMouseEnter={e=>{if(!dragging){e.currentTarget.style.boxShadow='0 4px 18px rgba(0,0,0,.13)';e.currentTarget.style.transform='translateY(-2px)';}}}
                      onMouseLeave={e=>{if(!dragging){e.currentTarget.style.boxShadow='0 2px 8px rgba(0,0,0,.07)';e.currentTarget.style.transform='';}}}
                    >
                      {/* Labels + lead source */}
                      {(deal.labels?.length>0||deal.leadSource)&&(
                        <div style={{display:'flex',flexWrap:'wrap',gap:5,marginBottom:10}}>
                          {(deal.labels||[]).map(l=><span key={l} style={{fontSize:11,fontWeight:600,padding:'2px 9px',borderRadius:20,background:(LABEL_COLORS[l]||{bg:'#f3f4f6'}).bg,color:(LABEL_COLORS[l]||{color:'#374151'}).color}}>{l}</span>)}
                          {deal.leadSource&&<span style={{fontSize:11,fontWeight:700,padding:'2px 9px',borderRadius:20,background:(LEAD_COLORS[deal.leadSource]||{bg:'#f3f4f6'}).bg,color:(LEAD_COLORS[deal.leadSource]||{color:'#374151'}).color,letterSpacing:'0.01em'}}>{deal.leadSource}</span>}
                        </div>
                      )}
                      {/* Title + delete */}
                      <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',gap:6,marginBottom:8}}>
                        <p style={{fontSize:15,fontWeight:600,lineHeight:1.35,color:'var(--fg)'}}>{deal.dealName}</p>
                        <button onClick={e=>{e.stopPropagation();setConfirm({id:deal.id,name:deal.dealName,deal});}}
                          style={{background:'none',border:'none',cursor:'pointer',padding:4,borderRadius:6,color:'var(--destructive)',flexShrink:0,opacity:0.4}}
                          onMouseEnter={e=>e.currentTarget.style.opacity=1} onMouseLeave={e=>e.currentTarget.style.opacity=0.4}>
                          <Trash2 size={13}/>
                        </button>
                      </div>
                      {/* Contact */}
                      {(contactName(deal)||deal.contactFreeText)&&(
                        <p style={{fontSize:12,color:'var(--muted-fg)',marginBottom:5,display:'flex',alignItems:'center',gap:5}}>
                          <UserRound size={11} style={{flexShrink:0}}/>{contactName(deal)||deal.contactFreeText}
                        </p>
                      )}
                      {/* Address */}
                      {deal.address&&(
                        <p style={{fontSize:12,color:'var(--muted-fg)',marginBottom:5,display:'flex',alignItems:'center',gap:5}}>
                          <MapPin size={11} style={{flexShrink:0}}/>{deal.address}
                        </p>
                      )}
                      {/* Progress bar */}
                      {deal.rooms&&deal.rooms.length>0&&(
                        <div style={{marginBottom:8}}>
                          <div style={{display:'flex',justifyContent:'space-between',marginBottom:3}}>
                            <span style={{fontSize:10,color:'var(--muted-fg)',fontWeight:500}}>{deal.rooms.filter(r=>r.done).length}/{deal.rooms.length} rooms</span>
                            <span style={{fontSize:10,fontWeight:700,color:'var(--primary)'}}>{deal.progress||0}%</span>
                          </div>
                          <div style={{height:5,background:'var(--border)',borderRadius:9,overflow:'hidden'}}>
                            <div style={{height:'100%',background:'var(--primary)',borderRadius:9,width:`${deal.progress||0}%`,transition:'width .3s'}}/>
                          </div>
                        </div>
                      )}
                      {/* Value + ref */}
                      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginTop:10,paddingTop:8,borderTop:'1px solid var(--border)'}}>
                        <div>
                          <span style={{fontSize:16,fontWeight:700,color:'var(--fg)'}}>{deal.value!=null?fmtUSD(deal.value):''}</span>
                          {deal.quote_date&&<span style={{fontSize:10,color:'var(--muted-fg)',marginLeft:6}}>{new Date(deal.quote_date+'T12:00:00').toLocaleDateString('en-CA',{month:'short',day:'numeric',year:'numeric'})}</span>}
                        </div>
                        {refName(deal)&&<span style={{fontSize:11,color:'var(--primary)'}}>Ref: {refName(deal)}</span>}
                      </div>
                      {/* Advance */}
                      {!isLast&&(
                        <button onClick={e=>{e.stopPropagation();advance(deal);}}
                          style={{marginTop:10,width:'100%',display:'flex',alignItems:'center',justifyContent:'center',gap:4,fontSize:12,fontWeight:500,color:'var(--muted-fg)',background:'var(--muted)',border:'none',borderRadius:8,padding:'7px 0',cursor:'pointer',transition:'background 0.15s'}}
                          onMouseEnter={e=>e.currentTarget.style.background='var(--border)'}
                          onMouseLeave={e=>e.currentTarget.style.background='var(--muted)'}>
                          <ArrowRight size={12}/>Move to {STAGES[STAGES.indexOf(stage)+1]}
                        </button>
                      )}
                    </div>
                  );
                })}
                {sd.length===0&&!isTarget&&(
                  <div style={{textAlign:'center',padding:'32px 0',fontSize:12,color:'var(--muted-fg)',fontStyle:'italic',opacity:0.5}}>Drop here</div>
                )}
              </div>
            </div>
          );
        })}
      </div>
      <DealModal open={modalOpen} onClose={()=>setModalOpen(false)} deal={editDeal} contacts={contacts}
        onSaved={async()=>{
          const isNew = !editDeal;
          showToast(editDeal?'Project updated':'Project created');
          await api.loadDeals();
          load();
          if(isNew){
            // Get the freshly saved deal (most recently created)
            const newDeal = api.getDeals().sort((a,b)=>new Date(b.created_at)-new Date(a.created_at))[0];
            const dealName = newDeal?.dealName||'';
            const dealId = newDeal?.id||'';
            const cid = Array.isArray(newDeal?.contact)?newDeal.contact[0]:newDeal?.contact||'';
            // Create one task with project name + 2 subtasks
            await api.saveActivity({
              title: dealName||'New Project',
              type: 'Task',
              completed: false,
              deal: dealId,
              client: cid,
              notes: '',
              date: null,
              subtasks: [
                {title:'Buy Paint', completed:false},
                {title:'Google Review', completed:false},
              ],
            });
            await api.loadActivities();
          }
        }}
        defaultStage={defaultStage}/>
      <ConfirmDialog open={!!confirm} onClose={()=>setConfirm(null)} onConfirm={async()=>{
        const days=(confirm?.deal?.scheduleDays||[]);
        for(const d of days){if(d.calEventId) await gcalDeleteEvent(d.calEventId);}
        if(confirm?.deal?.projectCalEventId) await gcalDeleteEvent(confirm.deal.projectCalEventId);
        await api.deleteDeal(confirm.id);load();showToast('Project deleted');
      }} title='Delete Project' desc={`Delete "${confirm?.name}"? This will also remove all calendar events.`}/>
    </div>
  );
}


function Clients({showToast}){
  const [clients,setClients]=useState(()=>api.getClients());
  const [search,setSearch]=useState('');
  const [modal,setModal]=useState(false);
  const [edit,setEdit]=useState(null);
  const [confirm,setConfirm]=useState(null);
  const load=()=>setClients(api.getClients(search));
  useEffect(()=>load(),[search]);
  const STATUS_BG={Active:'#dcfce7',Prospect:'#dbeafe',Inactive:'#f3f4f6',Churned:'#fee2e2'};
  const STATUS_TEXT={Active:'#15803d',Prospect:'#1d4ed8',Inactive:'#6b7280',Churned:'#b91c1c'};
  return (
    <div style={{padding:24,overflowY:'auto',height:'100%'}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:20}}>
        <div><h1 style={{fontSize:22,fontWeight:700}}>Clients</h1><p style={{fontSize:13,color:'var(--muted-fg)',marginTop:2}}>{clients.length} companies</p></div>
        <Btn onClick={()=>{setEdit(null);setModal(true);}}><Plus size={14}/>Add Client</Btn>
      </div>
      <div style={{position:'relative',marginBottom:16}}>
        <Search size={14} style={{position:'absolute',left:10,top:'50%',transform:'translateY(-50%)',color:'var(--muted-fg)'}}/>
        <Input style={{paddingLeft:32}} placeholder='Search clients...' value={search} onChange={e=>setSearch(e.target.value)}/>
      </div>
      <Card>
        <table style={{width:'100%',borderCollapse:'collapse'}}>
          <thead>
            <tr style={{borderBottom:'1px solid var(--border)'}}>
              {['Client/Company','Status','Industry','Contact Info','Website',''].map(h=>(
                <th key={h} style={{textAlign:'left',padding:'10px 16px',fontSize:11,fontWeight:600,textTransform:'uppercase',letterSpacing:'0.05em',color:'var(--muted-fg)'}}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {clients.length===0&&<tr><td colSpan={6} style={{textAlign:'center',padding:'32px 0',color:'var(--muted-fg)',fontSize:13}}>No clients yet. Add your first client above.</td></tr>}
            {clients.map((client,i)=>(
              <tr key={client.id} style={{borderTop:i>0?'1px solid var(--border)':'none'}}>
                <td style={{padding:'12px 16px'}}>
                  <div style={{display:'flex',gap:10,alignItems:'center'}}>
                    <div style={{width:32,height:32,borderRadius:8,background:'rgba(212,169,106,0.15)',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
                      <Building2 size={15} style={{color:'var(--primary)'}}/>
                    </div>
                    <div>
                      <p style={{fontSize:13,fontWeight:500}}>{client.companyName}</p>
                      {client.address&&<p style={{fontSize:11,color:'var(--muted-fg)'}}>{client.address}</p>}
                    </div>
                  </div>
                </td>
                <td style={{padding:'12px 16px'}}>
                  {client.status&&<span style={{fontSize:11,fontWeight:500,padding:'2px 8px',borderRadius:999,background:STATUS_BG[client.status]||'#f3f4f6',color:STATUS_TEXT[client.status]||'#6b7280'}}>{client.status}</span>}
                </td>
                <td style={{padding:'12px 16px',fontSize:13,color:'var(--muted-fg)'}}>{client.industry||'—'}</td>
                <td style={{padding:'12px 16px'}}>
                  <div style={{display:'flex',flexDirection:'column',gap:2}}>
                    {client.phone&&<span style={{fontSize:12,color:'var(--muted-fg)',display:'flex',gap:4,alignItems:'center'}}><Phone size={11}/>{client.phone}</span>}
                    {client.email&&<span style={{fontSize:12,color:'var(--muted-fg)',display:'flex',gap:4,alignItems:'center'}}><Mail size={11}/>{client.email}</span>}
                  </div>
                </td>
                <td style={{padding:'12px 16px'}}>
                  {client.website&&<a href={client.website} target='_blank' rel='noreferrer' style={{fontSize:12,color:'var(--primary)',display:'flex',gap:4,alignItems:'center'}}><Globe size={11}/>Visit</a>}
                </td>
                <td style={{padding:'12px 16px'}}>
                  <div style={{display:'flex',gap:4}}>
                    <button onClick={()=>{setEdit(client);setModal(true);}} style={{background:'none',border:'none',cursor:'pointer',padding:4,borderRadius:4,color:'var(--muted-fg)'}}><Pencil size={13}/></button>
                    <button onClick={()=>setConfirm({id:client.id,name:client.companyName})} style={{background:'none',border:'none',cursor:'pointer',padding:4,borderRadius:4,color:'var(--destructive)'}}><Trash2 size={13}/></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
      <ClientModal open={modal} onClose={()=>setModal(false)} client={edit} onSaved={()=>{load();showToast(edit?'Client updated':'Client created');}}/>
      <ConfirmDialog open={!!confirm} onClose={()=>setConfirm(null)} onConfirm={()=>{api.deleteClient(confirm.id);load();showToast('Client deleted');}} title='Delete Client' desc={`Delete "${confirm?.name}"?`}/>
    </div>
  );
}

function Contacts({showToast}){
  const [contacts,setContacts]=useState(()=>api.getContacts());
  const [clients,setClients]=useState(()=>api.getClients());
  const [deals,setDeals]=useState(()=>api.getDeals());
  const [search,setSearch]=useState('');
  const [modal,setModal]=useState(false);
  const [edit,setEdit]=useState(null);
  const [confirm,setConfirm]=useState(null);
  const load=()=>{setContacts(api.getContacts(search));setClients(api.getClients());setDeals(api.getDeals());};
  useEffect(()=>load(),[search]);

  const initials=name=>name?.split(' ').map(n=>n[0]).join('').toUpperCase().slice(0,2)||'?';

  // referralName = id of the contact who referred this deal
  const getReferrals=contact=>deals.filter(d=>(d.referralName||d.referralContactId)===contact.id);
  // contact field on deals matches the contact id — all deals for this contact
  const getContactDeals=contact=>deals.filter(d=>
    (d.contactId===contact.id||d.contact===contact.id||d.contacts?.includes?.(contact.id)) &&
    ['Scheduled','Completed','Archive'].includes(d.stage) &&
    !(d.labels||[]).includes('Lost')
  );
  // Badge only shows when 2+ qualifying deals exist (at least 1 return visit)
  const getRepeats=contact=>{const all=getContactDeals(contact);return all.length>=2?all.slice(1):[]};

  return (
    <div style={{padding:24,overflowY:'auto',height:'100%'}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:20}}>
        <div><h1 style={{fontSize:22,fontWeight:700}}>Contacts</h1><p style={{fontSize:13,color:'var(--muted-fg)',marginTop:2}}>{contacts.length} contacts</p></div>
        <button onClick={()=>{setEdit(null);setModal(true);}} style={{display:'flex',alignItems:'center',gap:6,padding:'6px 12px',border:'1px solid var(--border)',borderRadius:6,background:'var(--card)',color:'var(--fg)',fontSize:12,fontWeight:500,cursor:'pointer',transition:'all 0.15s'}}><Plus size={13}/>Add Contact</button>
      </div>
      <div style={{position:'relative',marginBottom:16}}>
        <Search size={14} style={{position:'absolute',left:10,top:'50%',transform:'translateY(-50%)',color:'var(--muted-fg)'}}/>
        <input placeholder='Search contacts...' value={search} onChange={e=>setSearch(e.target.value)} style={{background:'var(--card)',color:'var(--fg)',fontFamily:'inherit',fontSize:13,padding:'6px 10px',borderRadius:6,border:'1px solid var(--border)',width:'100%',outline:'none',boxSizing:'border-box',paddingLeft:32}}/>
      </div>
      <div style={{display:'flex',flexDirection:'column',gap:10}}>
        {contacts.length===0&&<div style={{textAlign:'center',padding:'48px 0',fontSize:13,color:'var(--muted-fg)',border:'2px dashed var(--border)',borderRadius:12}}>No contacts yet.</div>}
        {contacts.map(contact=>{
          const referrals=getReferrals(contact);
          const repeats=getRepeats(contact);
          const hasReferrals=referrals.length>0;
          const hasRepeats=repeats.length>0;
          return (
            <Card key={contact.id}
              onClick={()=>{setEdit(contact);setModal(true);}}
              style={{cursor:'pointer',transition:'box-shadow 0.15s,transform 0.15s'}}
              onMouseEnter={e=>{e.currentTarget.style.boxShadow='0 4px 18px rgba(0,0,0,.13)';e.currentTarget.style.transform='translateY(-1px)';}}
              onMouseLeave={e=>{e.currentTarget.style.boxShadow='';e.currentTarget.style.transform='';}}>
              <div style={{display:'flex',gap:12,alignItems:'stretch',padding:'14px'}}>
                {/* Avatar */}
                <div style={{width:42,height:42,borderRadius:'50%',background:'rgba(212,169,106,0.2)',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,fontSize:14,fontWeight:700,color:'var(--primary)'}}>{initials(contact.fullName)}</div>
                <div style={{flex:1,minWidth:0,display:'flex',flexDirection:'column',gap:4}}>
                  {/* Top row: name + badges + delete */}
                  <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',gap:8}}>
                    <div style={{minWidth:0,flex:1}}>
                      <div style={{display:'flex',alignItems:'center',gap:6,flexWrap:'wrap'}}>
                        <p style={{fontSize:14,fontWeight:600,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{contact.fullName}</p>
                        {hasRepeats&&(
                          <span title={`${repeats.length} repeat project${repeats.length!==1?'s':''}`}
                            style={{display:'inline-flex',alignItems:'center',gap:3,fontSize:10,fontWeight:700,padding:'2px 8px',borderRadius:20,letterSpacing:'0.04em',flexShrink:0,background:'#dbeafe',color:'#1d4ed8'}}>
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></svg>
                            Repeat ×{repeats.length}
                          </span>
                        )}
                        {hasReferrals&&(
                          <span title={referrals.map(d=>{const c=contacts.find(x=>x.id===(d.contact||d.contactId));return c?.fullName||d.contactFreeText||'—';}).join(', ')}
                            style={{display:'inline-flex',alignItems:'center',gap:3,fontSize:10,fontWeight:700,padding:'2px 8px',borderRadius:20,letterSpacing:'0.04em',flexShrink:0,background:'#ede9fe',color:'#7c3aed'}}>
                            <Star size={9} fill="currentColor"/>
                            Referral ×{referrals.length}
                          </span>
                        )}
                      </div>
                      {contact.jobTitle&&<p style={{fontSize:11,color:'var(--muted-fg)',marginTop:1}}>{contact.jobTitle}</p>}
                      {contact.client&&<p style={{fontSize:11,color:'var(--muted-fg)',marginTop:1}}>{contact.client}</p>}
                      {hasReferrals&&<p style={{fontSize:11,color:'var(--muted-fg)',marginTop:2}}>
                        Referred: {referrals.map(d=>{const c=contacts.find(x=>x.id===(d.contact||d.contactId));return c?.fullName||d.contactFreeText||'One-time client';}).join(', ')}
                      </p>}
                    </div>
                    <button onClick={e=>{e.stopPropagation();setConfirm({id:contact.id,name:contact.fullName});}}
                      style={{background:'none',border:'none',cursor:'pointer',padding:4,borderRadius:4,color:'var(--muted-fg)',opacity:0.4,flexShrink:0}}
                      onMouseEnter={e=>{e.stopPropagation();e.currentTarget.style.opacity=1;e.currentTarget.style.color='var(--destructive)';}}
                      onMouseLeave={e=>{e.currentTarget.style.opacity=0.4;e.currentTarget.style.color='var(--muted-fg)';}}>
                      <Trash2 size={13}/>
                    </button>
                  </div>
                  {/* Contact details */}
                  <div style={{display:'flex',gap:12,flexWrap:'wrap'}}>
                    {contact.email&&<span style={{fontSize:11,color:'var(--muted-fg)',display:'flex',gap:3,alignItems:'center'}}><Mail size={10}/>{contact.email}</span>}
                    {contact.phone&&<span style={{fontSize:11,color:'var(--muted-fg)',display:'flex',gap:3,alignItems:'center'}}><Phone size={10}/>{contact.phone}</span>}
                    {contact.address&&<span style={{fontSize:11,color:'var(--muted-fg)',display:'flex',gap:3,alignItems:'center'}}><MapPin size={10}/>{contact.address}</span>}
                  </div>
                </div>
              </div>
            </Card>
          );
        })}
      </div>
      <ContactModal open={modal} onClose={()=>setModal(false)} contact={edit} clients={clients} allDeals={deals} allContacts={contacts} onSaved={()=>{load();showToast(edit?'Contact updated':'Contact created');}}/>
      <ConfirmDialog open={!!confirm} onClose={()=>setConfirm(null)} onConfirm={()=>{api.deleteContact(confirm.id);load();showToast('Contact deleted');}} title='Delete Contact' desc={`Delete "${confirm?.name}"?`}/>
    </div>
  );
}

function Tasks({showToast}){
  const [tasks,setTasks]=useState(()=>api.getActivities());
  const [contacts,setContacts]=useState(()=>api.getContacts());
  const [deals,setDeals]=useState(()=>api.getDeals());
  const [modal,setModal]=useState(false);
  const [edit,setEdit]=useState(null);
  const [confirm,setConfirm]=useState(null);
  const [filter,setFilter]=useState('all'); // all | pending | completed

  const load=()=>{setTasks(api.getActivities());setContacts(api.getContacts());setDeals(api.getDeals());};

  const contactName=t=>{const c=contacts.find(x=>x.id===t.contactId);return c?.fullName||'';};
  const dealName=t=>{const d=deals.find(x=>x.id===t.dealId);return d?.dealName||'';};

  const toggle=async t=>{
    const newCompleted=!t.completed;
    if(newCompleted&&t.gtaskId) await gtasksComplete(t.gtaskId);
    await api.saveActivity({completed:newCompleted},t.id);
    load(); showToast(newCompleted?'Task completed!':'Task reopened');
  };

  const deleteTask=async t=>{
    if(t.gtaskId) await gtasksDelete(t.gtaskId);
    await api.deleteActivity(t.id);
    load(); showToast('Task deleted');
  };

  const PRIORITY_COLORS={high:'bg-red-100 text-red-700',medium:'bg-yellow-100 text-yellow-700',low:'bg-blue-100 text-blue-700',none:''};

  const filtered=tasks.filter(t=>{
    if(filter==='pending') return !t.completed;
    if(filter==='completed') return t.completed;
    return true;
  });

  const pending=tasks.filter(t=>!t.completed).length;

  return (
    <div style={{padding:24,overflowY:'auto',height:'100%'}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:20}}>
        <div>
          <h1 style={{fontSize:22,fontWeight:700}}>Tasks</h1>
          <p style={{fontSize:13,color:'var(--muted-fg)',marginTop:2}}>{pending} pending · {tasks.length} total</p>
        </div>
        <Btn onClick={()=>{setEdit(null);setModal(true);}}><Plus size={14}/>New Task</Btn>
      </div>

      {/* Filter tabs */}
      <div style={{display:'flex',gap:4,marginBottom:16}}>
        {['all','pending','completed'].map(f=>(
          <button key={f} onClick={()=>setFilter(f)} style={{padding:'5px 14px',borderRadius:20,border:'1px solid var(--border)',background:filter===f?'var(--fg)':'transparent',color:filter===f?'#DCB47E':'var(--muted-fg)',fontSize:12,fontWeight:500,cursor:'pointer',textTransform:'capitalize',transition:'all 0.15s'}}>
            {f}
          </button>
        ))}
      </div>

      <div style={{display:'flex',flexDirection:'column',gap:8}}>
        {filtered.length===0&&(
          <div style={{textAlign:'center',padding:'48px 0',fontSize:13,color:'var(--muted-fg)'}}>
            {filter==='all'?'No tasks yet. Create your first task above.':filter==='pending'?'No pending tasks.':'No completed tasks.'}
          </div>
        )}
        {filtered.map(t=>(
          <Card key={t.id}>
            <div style={{display:'flex',gap:12,alignItems:'flex-start',opacity:t.completed?0.55:1}}>
              {/* Checkbox */}
              <div style={{paddingTop:2}}>
                <input type='checkbox' checked={!!t.completed} onChange={()=>toggle(t)}
                  style={{width:18,height:18,cursor:'pointer',accentColor:'var(--primary)'}}/>
              </div>
              {/* Content */}
              <div style={{flex:1,minWidth:0}}>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',gap:8}}>
                  <div style={{flex:1}}>
                    <p style={{fontSize:14,fontWeight:500,textDecoration:t.completed?'line-through':'none',lineHeight:1.3}}>{t.title}</p>
                    {/* Meta row */}
                    <div style={{display:'flex',gap:8,marginTop:5,flexWrap:'wrap',alignItems:'center'}}>
                      {t.priority&&t.priority!=='none'&&(
                        <span className={cn('text-xs font-medium px-2 py-0.5 rounded-full',PRIORITY_COLORS[t.priority])}>{t.priority}</span>
                      )}
                      {t.dueDate&&(
                        <span style={{fontSize:11,color:(!t.completed&&new Date(`${t.dueDate}T${t.dueTime||'23:59'}`))<new Date()?'var(--destructive)':'var(--muted-fg)',display:'flex',alignItems:'center',gap:3}}>
                          <CalendarDays size={10}/>{t.dueDate}{t.dueTime?` ${t.dueTime}`:''}
                        </span>
                      )}
                      {contactName(t)&&<span style={{fontSize:11,color:'var(--muted-fg)'}}>{contactName(t)}</span>}
                      {dealName(t)&&<span style={{fontSize:11,color:'var(--muted-fg)'}}>· {dealName(t)}</span>}
                      {t.gtaskId&&<span style={{fontSize:10,color:'var(--primary)',background:'rgba(212,169,106,0.1)',padding:'1px 6px',borderRadius:10}}>Google Tasks ✓</span>}
                    </div>
                    {/* Details */}
                    {t.details&&<p style={{fontSize:12,color:'var(--muted-fg)',marginTop:6,lineHeight:1.5,whiteSpace:'pre-wrap'}}>{t.details}</p>}
                  </div>
                  {/* Actions */}
                  <div style={{display:'flex',gap:4,flexShrink:0}}>
                    <button onClick={()=>{setEdit(t);setModal(true);}} style={{background:'none',border:'none',cursor:'pointer',padding:4,color:'var(--muted-fg)',borderRadius:4}} onMouseEnter={e=>e.currentTarget.style.color='var(--fg)'} onMouseLeave={e=>e.currentTarget.style.color='var(--muted-fg)'}><Pencil size={12}/></button>
                    <button onClick={()=>setConfirm(t)} style={{background:'none',border:'none',cursor:'pointer',padding:4,color:'var(--muted-fg)',borderRadius:4}} onMouseEnter={e=>e.currentTarget.style.color='var(--destructive)'} onMouseLeave={e=>e.currentTarget.style.color='var(--muted-fg)'}><Trash2 size={12}/></button>
                  </div>
                </div>
              </div>
            </div>
          </Card>
        ))}
      </div>

      <TaskModal open={modal} onClose={()=>setModal(false)} task={edit} contacts={contacts} deals={deals}
        onSaved={async()=>{await api.loadActivities();load();showToast(edit?'Task updated':'Task created in Google Tasks');}}/>
      <ConfirmDialog open={!!confirm} onClose={()=>setConfirm(null)}
        onConfirm={async()=>{await deleteTask(confirm);setConfirm(null);}}
        title='Delete Task' desc={`Delete "${confirm?.title}"? This will also remove it from Google Tasks.`}/>
    </div>
  );
}



// ─── ROOM CARD ────────────────────────────────────────────────────────────────
function RoomCard({room,settings,onChange,onRemove}){
  const [open,setOpen]=useState(true);
  const [paintOpen,setPaintOpen]=useState(false);
  const calc=calcRoom(room,settings);
  const u=patch=>onChange({...room,...patch});
  const up=patch=>u({paint:{...room.paint,...patch}});
  const uprep=patch=>u({prep:{...room.prep,...patch}});
  const S=({label,field,sub})=>(
    <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'4px 0'}}>
      <label style={{fontSize:12,display:'flex',gap:6,alignItems:'center'}}>
        <input type='checkbox' checked={room[field].enabled} onChange={e=>u({[field]:{...room[field],enabled:e.target.checked}})}/>
        {label}
      </label>
      {room[field].enabled&&<select value={room[field].coats} onChange={e=>u({[field]:{...room[field],coats:+e.target.value}})} style={{fontSize:11,padding:'2px 6px',border:'1px solid var(--border)',borderRadius:4,background:'var(--card)'}}>
        <option value={1}>1 coat</option><option value={2}>2 coats</option><option value={3}>3 coats</option>
      </select>}
    </div>
  );
  const PREP_ITEMS=[{k:'furniture',l:'Move furniture'},{k:'plastic',l:'Cover w/ plastic'},{k:'outlets',l:'Remove outlets'},{k:'drywall',l:'Drywall repairs'},{k:'caulking',l:'Caulking'},{k:'cleanup',l:'Clean up'}];
  const PaintRow=({label,prod,colour,sheen,products,colours,onProd,onColour,onSheen})=>(
    <div style={{marginBottom:10}}>
      <p style={{fontSize:11,fontWeight:500,color:'var(--muted-fg)',marginBottom:4}}>{label}</p>
      <div style={{display:'grid',gridTemplateColumns:'2fr 2fr 1fr',gap:6}}>
        <select value={prod} onChange={e=>onProd(e.target.value)} style={{fontSize:11,padding:'4px 6px',border:'1px solid var(--border)',borderRadius:4,background:'var(--card)'}}><option value=''>— Product —</option>{products.map(p=><option key={p} value={p}>{p}</option>)}</select>
        <select value={colour} onChange={e=>onColour(e.target.value)} style={{fontSize:11,padding:'4px 6px',border:'1px solid var(--border)',borderRadius:4,background:'var(--card)'}}><option value=''>— Colour —</option>{colours.map(c=><option key={c} value={c}>{c}</option>)}</select>
        <select value={sheen} onChange={e=>onSheen(e.target.value)} style={{fontSize:11,padding:'4px 6px',border:'1px solid var(--border)',borderRadius:4,background:'var(--card)'}}><option value=''>— Sheen —</option>{SHEENS.map(s=><option key={s} value={s}>{s}</option>)}</select>
      </div>
    </div>
  );
  return (
    <div style={{border:'1px solid var(--border)',borderRadius:12,marginBottom:12,overflow:'hidden',background:'var(--card)',boxShadow:'var(--shadow)'}}>
      <div onClick={()=>setOpen(!open)} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'12px 16px',cursor:'pointer',userSelect:'none'}}>
        <div style={{display:'flex',gap:8,alignItems:'center'}}>
          <ChevronRight size={14} style={{color:'var(--muted-fg)',transform:open?'rotate(90deg)':'none',transition:'transform 0.2s'}}/>
          <input type='text' value={room.name} onClick={e=>e.stopPropagation()} onChange={e=>u({name:e.target.value})} placeholder='Room name' style={{fontWeight:600,fontSize:13,background:'transparent',border:'none',outline:'none',color:'var(--fg)',width:160}}/>
        </div>
        <div style={{display:'flex',gap:10,alignItems:'center'}}>
          <span style={{fontSize:11,background:'rgba(212,169,106,0.15)',color:'var(--primary)',padding:'3px 10px',borderRadius:999,fontWeight:500}}>{fmtCAD(calc.cost)}</span>
          <button onClick={e=>{e.stopPropagation();onRemove();}} style={{background:'none',border:'none',cursor:'pointer',color:'var(--destructive)',padding:3}}><Trash2 size={13}/></button>
        </div>
      </div>
      {open&&(
        <div style={{borderTop:'1px solid var(--border)'}}>
          <div style={{padding:'14px 16px',borderBottom:'1px solid rgba(0,0,0,0.05)'}}>
            <p style={{fontSize:10,fontWeight:600,textTransform:'uppercase',letterSpacing:'0.05em',color:'var(--muted-fg)',marginBottom:10}}>Dimensions</p>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:10}}>
              {[['Length (ft)','length'],['Width (ft)','width'],['Height (ft)','height']].map(([l,k])=>(
                <div key={k}><Label>{l}</Label><Input type='number' value={room[k]||''} onChange={e=>u({[k]:+e.target.value})} style={{padding:'6px 10px'}}/></div>
              ))}
            </div>
            <div style={{marginTop:8,display:'flex',gap:8,alignItems:'center'}}>
              <input type='checkbox' id={`irr-${room.id}`} checked={room.irregular} onChange={e=>u({irregular:e.target.checked})}/>
              <label htmlFor={`irr-${room.id}`} style={{fontSize:12,cursor:'pointer'}}>Irregular shape</label>
              {room.irregular&&<Input type='number' value={room.irregularSqft||''} onChange={e=>u({irregularSqft:+e.target.value})} placeholder='Wall sqft' style={{width:100,padding:'4px 8px',fontSize:11}}/>}
            </div>
            {!room.irregular&&calc.wallSqft>0&&<p style={{fontSize:11,color:'var(--muted-fg)',marginTop:6}}>Walls: ~{Math.round(calc.wallSqft)} sqft · Ceiling: ~{Math.round(calc.ceilSqft)} sqft</p>}
          </div>
          <div style={{padding:'14px 16px',borderBottom:'1px solid rgba(0,0,0,0.05)'}}>
            <p style={{fontSize:10,fontWeight:600,textTransform:'uppercase',letterSpacing:'0.05em',color:'var(--muted-fg)',marginBottom:8}}>Surfaces</p>
            <S label='Walls' field='walls'/><S label='Ceiling' field='ceiling'/>
            <S label='Baseboards' field='baseboards'/><S label='Crown Moulding' field='crown'/>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginTop:6}}>
              <div>
                <label style={{fontSize:12}}>Doors</label>
                <div style={{display:'flex',gap:6,marginTop:4,alignItems:'center'}}>
                  <Input type='number' value={room.doors.count||''} onChange={e=>u({doors:{...room.doors,count:+e.target.value}})} style={{width:50,padding:'4px 8px',fontSize:11}}/>
                  <select value={room.doors.coats} onChange={e=>u({doors:{...room.doors,coats:+e.target.value}})} style={{fontSize:11,padding:'4px 6px',border:'1px solid var(--border)',borderRadius:4,background:'var(--card)'}}><option value={1}>1 coat</option><option value={2}>2 coats</option><option value={3}>3 coats</option></select>
                </div>
              </div>
              <div>
                <label style={{fontSize:12}}>Windows</label>
                <div style={{display:'flex',gap:6,marginTop:4,alignItems:'center'}}>
                  <Input type='number' value={room.windows.count||''} onChange={e=>u({windows:{...room.windows,count:+e.target.value}})} style={{width:50,padding:'4px 8px',fontSize:11}}/>
                  <select value={room.windows.coats} onChange={e=>u({windows:{...room.windows,coats:+e.target.value}})} style={{fontSize:11,padding:'4px 6px',border:'1px solid var(--border)',borderRadius:4,background:'var(--card)'}}><option value={1}>1 coat</option><option value={2}>2 coats</option><option value={3}>3 coats</option></select>
                </div>
              </div>
            </div>
          </div>
          <div style={{padding:'14px 16px',borderBottom:'1px solid rgba(0,0,0,0.05)'}}>
            <p style={{fontSize:10,fontWeight:600,textTransform:'uppercase',letterSpacing:'0.05em',color:'var(--muted-fg)',marginBottom:8}}>Prep Work</p>
            <div style={{display:'flex',gap:6,alignItems:'center',marginBottom:8}}>
              <Label>Prep hours</Label>
              <Input type='number' value={room.prepHrs||''} onChange={e=>u({prepHrs:+e.target.value})} style={{width:60,padding:'4px 8px',fontSize:11,marginLeft:8}}/>
            </div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:4}}>
              {PREP_ITEMS.map(({k,l})=>(
                <label key={k} style={{display:'flex',gap:6,alignItems:'center',fontSize:12,cursor:'pointer'}}>
                  <input type='checkbox' checked={room.prep[k]} onChange={e=>uprep({[k]:e.target.checked})}/>{l}
                </label>
              ))}
            </div>
          </div>
          <div style={{padding:'14px 16px'}}>
            <button onClick={()=>setPaintOpen(!paintOpen)} style={{display:'flex',gap:6,alignItems:'center',background:'none',border:'none',cursor:'pointer',fontSize:10,fontWeight:600,textTransform:'uppercase',letterSpacing:'0.05em',color:'var(--muted-fg)',marginBottom:8}}>
              <ChevronDown size={13} style={{transform:paintOpen?'none':'rotate(-90deg)',transition:'transform 0.2s'}}/>Paint Selections
            </button>
            {paintOpen&&(
              <>
                {room.walls.enabled&&<PaintRow label='Walls' prod={room.paint.wallProduct} colour={room.paint.wallColour} sheen={room.paint.wallSheen} products={WALL_PAINTS} colours={COLOURS} onProd={v=>up({wallProduct:v})} onColour={v=>up({wallColour:v})} onSheen={v=>up({wallSheen:v})}/>}
                {room.ceiling.enabled&&<PaintRow label='Ceiling' prod={room.paint.ceilProduct} colour={room.paint.ceilColour} sheen={room.paint.ceilSheen} products={CEILING_PAINTS} colours={CEILING_COLOURS} onProd={v=>up({ceilProduct:v})} onColour={v=>up({ceilColour:v})} onSheen={v=>up({ceilSheen:v})}/>}
                {(room.baseboards.enabled||room.doors.count>0||room.crown.enabled)&&<PaintRow label='Trim / Doors' prod={room.paint.trimProduct} colour={room.paint.trimColour} sheen={room.paint.trimSheen} products={TRIM_PAINTS} colours={COLOURS} onProd={v=>up({trimProduct:v})} onColour={v=>up({trimColour:v})} onSheen={v=>up({trimSheen:v})}/>}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── ESTIMATE BUILDER ─────────────────────────────────────────────────────────
function EstimateBuilder({id,onBack,showToast}){
  const isNew=id==='new';
  const [tab,setTab]=useState('cover');
  const [title,setTitle]=useState('New Estimate');
  const [clientId,setClientId]=useState('');
  const [status,setStatus]=useState('Draft');
  const [date,setDate]=useState(new Date().toISOString().split('T')[0]);
  const [notes,setNotes]=useState('');
  const [rooms,setRooms]=useState([newRoom('1',1)]);
  const [settings,setSettings]=useState(DEFAULT_SETTINGS);
  const [clients]=useState(()=>api.getClients());
  const [saving,setSaving]=useState(false);
  const [currentId,setCurrentId]=useState(isNew?null:id);

  useEffect(()=>{
    if(!isNew&&id){
      const e=api.getEstimate(id);
      if(!e){onBack();return;}
      setTitle(e.estimateTitle||'');setClientId(e.clientId||'');setStatus(e.status||'Draft');
      setDate(e.date||new Date().toISOString().split('T')[0]);setNotes(e.notes||'');
      if(e.hourlyRate) setSettings(s=>({...s,hourlyRate:e.hourlyRate}));
      if(e.roomsJson){try{setRooms(JSON.parse(e.roomsJson));}catch{}}
    }
  },[id]);

  const totals=calcTotals(rooms,settings);
  const addRoom=useCallback(()=>setRooms(prev=>[...prev,newRoom(Date.now().toString(),prev.length+1)]),[]);
  const updateRoom=useCallback((idx,r)=>setRooms(prev=>prev.map((x,i)=>i===idx?r:x)),[]);
  const removeRoom=useCallback(idx=>setRooms(prev=>prev.filter((_,i)=>i!==idx)),[]);

  const save=async()=>{
    if(!title.trim()){showToast('Please enter an estimate title');return;}
    setSaving(true);
    const savedId=api.saveEstimate({estimateTitle:title,clientId:clientId||undefined,status,date,subtotal:totals.discounted,tax:totals.taxAmt,total:totals.total,hourlyRate:settings.hourlyRate,roomsJson:JSON.stringify(rooms),notes},currentId);
    if(isNew)setCurrentId(savedId);
    showToast(isNew&&!currentId?'Estimate created!':'Estimate saved!');
    setSaving(false);
  };

  const TABS=[{k:'cover',l:'Cover'},{k:'rooms',l:`Rooms (${rooms.length})`},{k:'breakdown',l:'Breakdown'}];
  const client=clients.find(c=>c.id===clientId);
  const formattedDate=date?new Date(date+'T12:00:00').toLocaleDateString('en-CA',{year:'numeric',month:'long',day:'numeric'}):'—';

  // Aggregate surface+paint data for breakdown
  const totalWalls=rooms.reduce((s,r)=>s+calcRoom(r,settings).wallSqft,0);
  const totalCeil=rooms.reduce((s,r)=>s+calcRoom(r,settings).ceilSqft,0);
  const totalTrimLF=rooms.reduce((s,r)=>s+calcRoom(r,settings).perimLF,0);
  const totalDoors=rooms.reduce((s,r)=>s+r.doors.count,0);
  const totalHrs=rooms.reduce((s,r)=>s+calcRoom(r,settings).totalHrs,0);
  const estDays=Math.ceil(totalHrs/8);

  return (
    <div style={{display:'flex',flexDirection:'column',height:'100%',overflow:'hidden'}}>
      <div style={{background:'var(--fg)',color:'var(--bg)',padding:'10px 20px',display:'flex',justifyContent:'space-between',alignItems:'center',flexShrink:0}}>
        <div style={{display:'flex',gap:10,alignItems:'center'}}>
          <button onClick={onBack} style={{background:'none',border:'none',cursor:'pointer',color:'rgba(237,233,222,0.6)',display:'flex',gap:4,alignItems:'center',fontSize:12}}>
            <ArrowLeft size={13}/>Estimates
          </button>
          <span style={{color:'rgba(237,233,222,0.3)'}}>|</span>
          <span style={{fontSize:13,fontWeight:500}}>{title||'Untitled'}</span>
        </div>
        <button onClick={save} disabled={saving} style={{background:'transparent',border:'1px solid rgba(237,233,222,0.3)',color:'var(--bg)',cursor:'pointer',borderRadius:6,padding:'5px 12px',fontSize:12,display:'flex',gap:6,alignItems:'center'}}>
          {saving?<Loader2 size={13} className='animate-spin'/>:<Save size={13}/>}{saving?'Saving…':'Save Estimate'}
        </button>
      </div>
      <div style={{background:'var(--fg)',borderBottom:'1px solid rgba(237,233,222,0.1)',padding:'0 20px',display:'flex',gap:2,flexShrink:0}}>
        {TABS.map(t=>(
          <button key={t.k} onClick={()=>setTab(t.k)} style={{background:'none',border:'none',cursor:'pointer',padding:'8px 14px',fontSize:12,fontWeight:500,color:tab===t.k?'var(--bg)':'rgba(237,233,222,0.5)',borderBottom:tab===t.k?'2px solid var(--primary)':'2px solid transparent'}}>
            {t.l}
          </button>
        ))}
      </div>
      <div style={{flex:1,overflowY:'auto'}}>
        {tab==='cover'&&(
          <div style={{maxWidth:900,margin:'0 auto',padding:'24px 24px',display:'grid',gridTemplateColumns:'1fr 1fr',gap:24}}>
            <Card className='overflow-hidden'>
              <div style={{background:'var(--fg)',color:'var(--bg)',textAlign:'center',padding:'6px 16px',fontSize:10,fontWeight:600,textTransform:'uppercase',letterSpacing:'0.15em'}}>Proposal Preview</div>
              <div style={{display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',padding:'40px 32px',minHeight:420,textAlign:'center'}}>
                <div style={{width:56,height:56,borderRadius:'50%',background:'rgba(212,169,106,0.15)',display:'flex',alignItems:'center',justifyContent:'center',marginBottom:16}}>
                  <span style={{fontWeight:700,fontSize:18,color:'var(--primary)'}}>KP</span>
                </div>
                <p style={{fontSize:10,fontWeight:600,letterSpacing:'0.2em',color:'var(--primary)',textTransform:'uppercase',marginBottom:12}}>Kingdom Painting Inc.</p>
                <h2 style={{fontSize:26,fontWeight:300,marginBottom:12}}>Bid Proposal</h2>
                <div style={{width:32,height:2,background:'var(--primary)',marginBottom:24}}/>
                <p style={{fontSize:10,textTransform:'uppercase',letterSpacing:'0.15em',color:'var(--muted-fg)',marginBottom:8}}>Prepared For</p>
                <p style={{fontSize:18,fontWeight:500}}>{client?.companyName||'—'}</p>
                {client?.email&&<p style={{fontSize:13,color:'var(--primary)',marginTop:4}}>{client.email}</p>}
                <div style={{marginTop:24,paddingTop:24,borderTop:'1px solid var(--border)',width:'100%'}}>
                  <p style={{fontSize:11,color:'var(--muted-fg)'}}>{formattedDate}</p>
                  <p style={{fontSize:13,fontWeight:500,marginTop:4}}>{title}</p>
                </div>
              </div>
            </Card>
            <div style={{display:'flex',flexDirection:'column',gap:16}}>
              <Card className='p-5'>
                <p style={{fontSize:10,fontWeight:600,textTransform:'uppercase',letterSpacing:'0.05em',color:'var(--muted-fg)',marginBottom:16}}>Project Information</p>
                <div style={{marginBottom:12}}><Label>Estimate Title</Label><Input value={title} onChange={e=>setTitle(e.target.value)} placeholder='e.g. Full Interior Repaint'/></div>
                <div style={{marginBottom:12}}><Label>Client</Label><Select value={clientId||'none'} onChange={e=>setClientId(e.target.value==='none'?'':e.target.value)}><option value='none'>No client</option>{clients.map(c=><option key={c.id} value={c.id}>{c.companyName}</option>)}</Select></div>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:12}}>
                  <div><Label>Status</Label><Select value={status} onChange={e=>setStatus(e.target.value)}>{['Draft','Sent','Approved','Declined'].map(s=><option key={s}>{s}</option>)}</Select></div>
                  <div><Label>Date</Label><Input type='date' value={date} onChange={e=>setDate(e.target.value)}/></div>
                </div>
                <div><Label>Notes / Scope</Label><Textarea value={notes} onChange={e=>setNotes(e.target.value)} rows={3} placeholder='Scope of work...'/></div>
              </Card>
              <Card className='p-5'>
                <p style={{fontSize:10,fontWeight:600,textTransform:'uppercase',letterSpacing:'0.05em',color:'var(--muted-fg)',marginBottom:12}}>Pricing Settings</p>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
                  <div><Label>Hourly Rate ($)</Label><Input type='number' value={settings.hourlyRate} onChange={e=>setSettings(s=>({...s,hourlyRate:+e.target.value}))}/></div>
                  <div><Label>Labour Buffer</Label><Input type='number' step='0.05' value={settings.labourBuffer} onChange={e=>setSettings(s=>({...s,labourBuffer:+e.target.value}))}/></div>
                  <div><Label>Tax Rate (%)</Label><Input type='number' value={settings.taxRate} onChange={e=>setSettings(s=>({...s,taxRate:+e.target.value}))}/></div>
                  <div><Label>Discount ($)</Label><Input type='number' value={settings.discount} onChange={e=>setSettings(s=>({...s,discount:+e.target.value}))}/></div>
                </div>
              </Card>
            </div>
          </div>
        )}
        {tab==='rooms'&&(
          <div style={{maxWidth:800,margin:'0 auto',padding:24}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16}}>
              <p style={{fontSize:13,color:'var(--muted-fg)'}}>{rooms.length} room{rooms.length!==1?'s':''} · {fmtCAD(totals.labourSubtotal)} subtotal</p>
              <Btn onClick={addRoom} size='sm'><Plus size={13}/>Add Room</Btn>
            </div>
            {rooms.map((room,i)=><RoomCard key={room.id} room={room} settings={settings} onChange={r=>updateRoom(i,r)} onRemove={()=>removeRoom(i)}/>)}
          </div>
        )}
        {tab==='breakdown'&&(
          <div style={{maxWidth:900,margin:'0 auto',padding:24}}>
            <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:10,marginBottom:16}}>
              {[['Total Walls',`${Math.round(totalWalls)} sqft`],['Total Ceiling',`${Math.round(totalCeil)} sqft`],['Total Trim',`${Math.round(totalTrimLF)} lf`],['Total Doors',totalDoors]].map(([l,v])=>(
                <Card key={l} className='p-4'><p style={{fontSize:10,textTransform:'uppercase',letterSpacing:'0.05em',color:'var(--muted-fg)'}}>{l}</p><p style={{fontSize:22,fontWeight:300,marginTop:4,fontFamily:'monospace'}}>{v}</p></Card>
              ))}
            </div>
            <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:10,marginBottom:16}}>
              {[['Total Hours',totalHrs.toFixed(1)],['Est. Days',`${estDays} day${estDays!==1?'s':''}`],['Active Rooms',rooms.length],['Labour Cost',fmtCAD(totals.labourSubtotal)]].map(([l,v])=>(
                <Card key={l} className='p-4'><p style={{fontSize:10,textTransform:'uppercase',letterSpacing:'0.05em',color:'var(--muted-fg)'}}>{l}</p><p style={{fontSize:22,fontWeight:300,marginTop:4,fontFamily:'monospace',color:l==='Labour Cost'?'var(--primary)':'var(--fg)'}}>{v}</p></Card>
              ))}
            </div>
            <Card className='overflow-hidden mb-4'>
              <div style={{padding:'12px 16px',borderBottom:'1px solid var(--border)'}}><p style={{fontSize:10,fontWeight:600,textTransform:'uppercase',letterSpacing:'0.05em',color:'var(--muted-fg)'}}>Per-Room Labour Breakdown</p></div>
              <div style={{overflowX:'auto'}}>
                <table style={{width:'100%',borderCollapse:'collapse',fontSize:12}}>
                  <thead><tr style={{background:'var(--fg)',color:'var(--bg)'}}>{['Surface','Area','Coats','Rate','Hours','Cost'].map(h=><th key={h} style={{padding:'8px 14px',textAlign:h==='Surface'?'left':'right',fontWeight:400,fontSize:11}}>{h}</th>)}</tr></thead>
                  <tbody>
                    {rooms.map(room=>{
                      const lines=calcRoomLines(room,settings);
                      const roomCost=lines.reduce((s,l)=>s+l.cost,0);
                      return lines.length>0?(
                        <>
                          {lines.map((line,i)=>(
                            <tr key={`${room.id}-${i}`} style={{borderBottom:'1px solid rgba(0,0,0,0.04)'}}>
                              <td style={{padding:'6px 14px'}}>{i===0&&<span style={{color:'var(--muted-fg)',fontWeight:500,marginRight:6}}>{room.name} ·</span>}{line.surface}</td>
                              <td style={{padding:'6px 14px',textAlign:'right',color:'var(--muted-fg)',fontFamily:'monospace'}}>{line.area} {line.areaUnit}</td>
                              <td style={{padding:'6px 14px',textAlign:'right',color:'var(--muted-fg)',fontFamily:'monospace'}}>{line.coats>0?line.coats:'—'}</td>
                              <td style={{padding:'6px 14px',textAlign:'right',color:'var(--muted-fg)',fontFamily:'monospace'}}>{line.rate.toFixed(1)} {line.rateLabel}</td>
                              <td style={{padding:'6px 14px',textAlign:'right',fontFamily:'monospace'}}>{line.hours.toFixed(2)}</td>
                              <td style={{padding:'6px 14px',textAlign:'right',fontWeight:500,fontFamily:'monospace'}}>{fmtCAD(line.cost)}</td>
                            </tr>
                          ))}
                          <tr style={{background:'rgba(0,0,0,0.03)',borderBottom:'1px solid var(--border)'}}>
                            <td colSpan={5} style={{padding:'6px 14px',textAlign:'right',fontSize:11,fontWeight:600,color:'var(--muted-fg)'}}>{room.name} subtotal</td>
                            <td style={{padding:'6px 14px',textAlign:'right',fontWeight:600,fontFamily:'monospace'}}>{fmtCAD(roomCost)}</td>
                          </tr>
                        </>
                      ):null;
                    })}
                    <tr style={{background:'var(--fg)',color:'var(--bg)'}}>
                      <td colSpan={5} style={{padding:'10px 14px',textAlign:'right',fontWeight:500}}>Grand Total</td>
                      <td style={{padding:'10px 14px',textAlign:'right',fontWeight:700,fontFamily:'monospace'}}>{fmtCAD(totals.labourSubtotal)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </Card>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16}}>
              <Card className='overflow-hidden'>
                <div style={{padding:'12px 16px',borderBottom:'1px solid var(--border)'}}><p style={{fontSize:10,fontWeight:600,textTransform:'uppercase',letterSpacing:'0.05em',color:'var(--muted-fg)'}}>Quote Summary</p></div>
                {[{l:'Labour Subtotal',v:totals.labourSubtotal},{l:'Subtotal',v:totals.discounted},{l:`HST (${settings.taxRate}%)`,v:totals.taxAmt}].map(({l,v})=>(
                  <div key={l} style={{display:'flex',justifyContent:'space-between',padding:'10px 16px',borderBottom:'1px solid rgba(0,0,0,0.05)',fontSize:13}}>
                    <span style={{color:'var(--muted-fg)'}}>{l}</span><span style={{fontWeight:500,fontFamily:'monospace'}}>{fmtCAD(v)}</span>
                  </div>
                ))}
                {settings.discount>0&&<div style={{display:'flex',justifyContent:'space-between',padding:'10px 16px',borderBottom:'1px solid rgba(0,0,0,0.05)',fontSize:13}}><span style={{color:'var(--muted-fg)'}}>Discount</span><span style={{color:'var(--destructive)',fontFamily:'monospace'}}>−{fmtCAD(settings.discount)}</span></div>}
                <div style={{display:'flex',justifyContent:'space-between',padding:'12px 16px',background:'var(--fg)',color:'var(--bg)'}}>
                  <span style={{fontWeight:600}}>Total</span><span style={{fontWeight:700,fontSize:16,fontFamily:'monospace'}}>{fmtCAD(totals.total)}</span>
                </div>
              </Card>
              <Card className='overflow-hidden'>
                <div style={{padding:'12px 16px',borderBottom:'1px solid var(--border)'}}><p style={{fontSize:10,fontWeight:600,textTransform:'uppercase',letterSpacing:'0.05em',color:'var(--muted-fg)'}}>Payment Schedule</p></div>
                <div style={{padding:14,display:'flex',flexDirection:'column',gap:10}}>
                  {[{step:'Step 1 · Deposit',desc:'10% on first day',v:totals.deposit},{step:'Step 2 · Midway',desc:'45% midway',v:totals.midway},{step:'Step 3 · Completion',desc:'Balance on completion',v:totals.balance}].map(p=>(
                    <div key={p.step} style={{background:'rgba(0,0,0,0.03)',borderRadius:10,padding:'12px',textAlign:'center'}}>
                      <p style={{fontSize:10,fontWeight:600,color:'var(--primary)',textTransform:'uppercase',letterSpacing:'0.1em'}}>{p.step}</p>
                      <p style={{fontSize:20,fontWeight:300,margin:'4px 0',fontFamily:'monospace'}}>{fmtCAD(p.v)}</p>
                      <p style={{fontSize:11,color:'var(--muted-fg)'}}>{p.desc}</p>
                    </div>
                  ))}
                </div>
              </Card>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}



// ─── MASTER ESTIMATE (full Kingdom Painting HTML app in iframe) ──────────────
const LOGO_PNG = "data:image/png;base64,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";

const KP_MASTER_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>KINGDOM PAINTING INC. — Master Estimate</title>
<style>
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
:root{
  --ink:#2e3354;--ink2:#4a5080;--ink3:#8a90b0;--ink4:#b8bcd4;
  --cream:#faf8f4;--cream2:#f0f1f6;--cream3:#dfe0ea;
  --gold:#c4922a;--gold2:#e8b84b;--gold3:#f5e0a8;
  --red:#c0392b;--green:#27704a;
  --serif:'Montserrat',sans-serif;--sans:'Montserrat',sans-serif;
  --r:8px;--r2:12px;
}
html{font-family:var(--sans);background:var(--cream);color:var(--ink);font-size:14px}
body{overflow:hidden;font-family:'Montserrat',sans-serif}
.shell{display:flex;flex-direction:column;height:100vh}
.topbar{background:var(--ink);color:var(--cream);display:flex;align-items:center;justify-content:space-between;padding:0 24px;height:56px;flex-shrink:0}
.topbar-brand{display:flex;align-items:center;gap:12px}
.topbar-logo{width:40px;height:40px;border-radius:8px;background:transparent;display:flex;align-items:center;justify-content:center;overflow:hidden}
.topbar-name{font-family:var(--serif);font-size:16px;letter-spacing:.02em}
.topbar-sub{font-size:11px;color:var(--ink4);margin-top:1px}
.topbar-date{font-size:12px;color:var(--ink4)}
.tabs-wrap{background:var(--ink);border-bottom:1px solid rgba(255,255,255,.08);flex-shrink:0}
.tabs{display:flex;overflow-x:auto;padding:0 24px;gap:2px;scrollbar-width:none;-webkit-overflow-scrolling:touch}
.tabs::-webkit-scrollbar{display:none}
.tab{padding:10px 16px;font-size:12px;font-weight:500;color:var(--ink4);cursor:pointer;border-bottom:2px solid transparent;white-space:nowrap;transition:color .15s,border-color .15s;letter-spacing:.03em;text-transform:uppercase}
.tab:hover{color:var(--cream3)}
.tab.active{color:var(--gold2);border-bottom-color:var(--gold2)}
.main{padding:24px;padding-top:16px;max-width:1100px;margin:0 auto;width:100%;flex:1;overflow-y:auto}
.page{display:none}.page.active{display:block}
.card{background:#fff;border:1px solid var(--cream3);border-radius:var(--r2);padding:20px;margin-bottom:16px}
.card-title{font-size:11px;font-weight:500;color:var(--ink3);text-transform:uppercase;letter-spacing:.08em;margin-bottom:14px}
.card-header{font-family:var(--serif);font-size:22px;color:var(--ink);margin-bottom:4px}
.grid2{display:grid;grid-template-columns:1fr 1fr;gap:12px}
.grid3{display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px}
.grid4{display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:12px}
.field{display:flex;flex-direction:column;gap:4px}
.field label{font-size:11px;color:var(--ink3);font-weight:500;letter-spacing:.04em;text-transform:uppercase}
.field input,.field select,.field textarea{font-family:var(--sans);font-size:13px;padding:8px 10px;border:1px solid var(--cream3);border-radius:var(--r);background:var(--cream);color:var(--ink);width:100%;transition:border-color .15s}
.field input:focus,.field select:focus{outline:none;border-color:var(--gold);background:#fff}
.field textarea{resize:vertical;min-height:60px}
.toggle-row{display:flex;align-items:center;gap:8px;cursor:pointer;padding:6px 0}
.toggle-row input[type=checkbox]{width:16px;height:16px;accent-color:var(--gold);cursor:pointer}
.toggle-row span{font-size:13px;color:var(--ink2)}
.room-card{background:#fff;border:1px solid var(--cream3);border-radius:var(--r2);margin-bottom:10px;overflow:hidden;transition:box-shadow .2s}
.room-card:hover{box-shadow:0 2px 12px rgba(0,0,0,.06)}
.room-head{display:flex;align-items:center;justify-content:space-between;padding:14px 18px;cursor:pointer;user-select:none}
.room-head-left{display:flex;align-items:center;gap:10px}
.room-arrow{font-size:10px;color:var(--ink4);transition:transform .2s;display:inline-block}
.room-arrow.open{transform:rotate(90deg)}
.room-name-input{font-family:var(--serif);font-size:15px;border:none;background:transparent;color:var(--ink);padding:0;width:180px;cursor:text}
.room-name-input:focus{outline:none;border-bottom:1px solid var(--gold)}
.room-badge{font-size:11px;color:var(--ink3);background:var(--cream2);border-radius:20px;padding:3px 10px}
.room-del{background:none;border:none;cursor:pointer;color:var(--ink4);font-size:18px;line-height:1;padding:2px 6px}
.room-del:hover{color:var(--red)}
.room-body{display:none;padding:0 18px 18px;border-top:1px solid var(--cream2)}
.room-body.open{display:block}
.surf-grid{display:grid;grid-template-columns:160px 80px 80px 90px;gap:8px;align-items:center;margin-bottom:6px}
.surf-label{font-size:12px;color:var(--ink2);display:flex;align-items:center;gap:6px}
.surf-label input[type=checkbox]{width:14px;height:14px;accent-color:var(--gold)}
.coats-sel{font-size:12px;padding:5px 8px;border:1px solid var(--cream3);border-radius:var(--r);background:var(--cream);color:var(--ink);min-width:150px}
.lf-input{font-size:12px;padding:5px 8px;border:1px solid var(--cream3);border-radius:var(--r);background:var(--cream);color:var(--ink);width:80px}
.stats{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:16px}
.stat{background:#fff;border:1px solid var(--cream3);border-radius:var(--r2);padding:14px}
.stat .lbl{font-size:11px;color:var(--ink3);text-transform:uppercase;letter-spacing:.06em}
.stat .val{font-size:24px;font-weight:300;color:var(--ink);margin-top:4px;font-variant-numeric:tabular-nums}
.stat .val.gold{color:var(--gold)}
.quote-box{border:1px solid var(--cream3);border-radius:var(--r2);overflow:hidden}
.q-row{display:flex;justify-content:space-between;align-items:center;padding:11px 16px;border-bottom:1px solid var(--cream2);font-size:13px}
.q-row:last-child{border-bottom:none}
.q-row.total-row{background:var(--ink);color:#fff;font-size:15px;font-weight:500}
.q-label{color:var(--ink2)}
.q-val{font-variant-numeric:tabular-nums;font-weight:500}
.pay-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-top:14px}
.pay-card{background:var(--cream2);border-radius:var(--r2);padding:14px;text-align:center}
.pay-step{font-size:10px;color:var(--gold);font-weight:500;text-transform:uppercase;letter-spacing:.1em;margin-bottom:4px}
.pay-amount{font-family:var(--serif);font-size:20px;color:var(--ink)}
.pay-desc{font-size:11px;color:var(--ink3);margin-top:3px}
.doc-header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:24px;padding-bottom:20px;border-bottom:2px solid var(--ink)}
.doc-company{font-family:var(--serif);font-size:26px;color:var(--gold)}
.doc-type{font-size:11px;color:var(--ink);font-weight:500;text-transform:uppercase;letter-spacing:.12em;margin-top:2px}
.doc-meta{text-align:right;font-size:12px;color:var(--ink2);line-height:1.8}
.doc-meta strong{color:var(--ink)}
.doc-section{margin-bottom:20px}
.doc-section-title{font-size:10px;font-weight:500;color:var(--ink3);text-transform:uppercase;letter-spacing:.1em;margin-bottom:8px;padding-bottom:4px;border-bottom:1px solid var(--cream3)}
.doc-table{width:100%;border-collapse:collapse;font-size:12px}
.doc-table th{text-align:left;padding:8px 10px;background:var(--cream2);font-weight:500;color:var(--ink2);font-size:11px;text-transform:uppercase;letter-spacing:.05em}
.doc-table td{padding:8px 10px;border-bottom:1px solid var(--cream2);color:var(--ink)}
.doc-table .right{text-align:right}
.doc-total-row{background:var(--ink);color:#fff;font-weight:500}
.doc-total-row td{padding:10px 10px;border:none}
.prep-checks{display:grid;grid-template-columns:repeat(4,1fr);gap:6px;margin-top:8px}
.prep-check{display:flex;align-items:center;gap:6px;font-size:12px;color:var(--ink2);padding:6px 10px;background:var(--cream2);border-radius:var(--r);cursor:pointer}
.prep-check input{accent-color:var(--gold);width:14px;height:14px}
.breakdown-table{width:100%;border-collapse:collapse;font-size:12px}
.breakdown-table th{padding:8px 12px;background:var(--ink);color:var(--cream3);text-align:left;font-weight:400;font-size:11px;text-transform:uppercase;letter-spacing:.06em}
.breakdown-table td{padding:8px 12px;border-bottom:1px solid var(--cream2);overflow:hidden;text-overflow:ellipsis}
.breakdown-table tr:hover td{background:var(--cream)}
.breakdown-table .subtotal-row td{background:var(--cream2);font-weight:500}
.breakdown-table .grand-row td{background:var(--ink);color:#fff;font-weight:500}
.num{text-align:right;font-variant-numeric:tabular-nums}
.breakdown-table th.num,.breakdown-table td.num{text-align:center}
.rates-table{width:100%;border-collapse:collapse;font-size:12px;margin-top:8px}
.rates-table td{padding:7px 10px;border-bottom:1px solid var(--cream2)}
.rates-table td:last-child{text-align:right;font-weight:500;font-variant-numeric:tabular-nums}
.colour-chip{display:inline-flex;align-items:center;gap:6px;font-size:11px;background:var(--cream2);border-radius:20px;padding:3px 10px;margin:2px}
.chip-dot{width:12px;height:12px;border-radius:50%;border:1px solid rgba(0,0,0,.12);flex-shrink:0}
hr.divider{border:none;border-top:1px solid var(--cream3);margin:16px 0}
.add-btn{width:100%;padding:10px;border:1px dashed var(--ink4);border-radius:var(--r2);background:transparent;color:var(--ink3);font-size:13px;cursor:pointer;font-family:var(--sans);transition:all .15s}
.add-btn:hover{background:var(--cream2);color:var(--ink);border-color:var(--gold)}
.btn{display:inline-flex;align-items:center;gap:6px;padding:8px 16px;border-radius:var(--r);border:1px solid var(--cream3);background:var(--cream);color:var(--ink);font-size:12px;font-family:var(--sans);cursor:pointer;transition:all .15s;font-weight:500}
.btn:hover{background:#fff;border-color:var(--gold);color:var(--gold)}
.btn-dark{background:var(--ink);color:var(--cream);border-color:var(--ink)}
.btn-dark:hover{background:#2d2720}
.paint-chips{display:flex;flex-wrap:wrap;gap:4px;margin-top:6px}
.section-badge{display:inline-block;font-size:10px;font-weight:500;color:var(--gold);background:var(--gold3);border-radius:20px;padding:2px 8px;text-transform:uppercase;letter-spacing:.06em}
.workers-row{display:flex;align-items:center;gap:10px;flex-wrap:wrap}
.worker-tag{display:flex;align-items:center;gap:6px;background:var(--cream2);border-radius:var(--r);padding:6px 12px;font-size:12px}
.worker-tag input[type=checkbox]{accent-color:var(--gold)}
.change-item{display:grid;grid-template-columns:100px 1fr 130px;gap:8px;align-items:start;margin-bottom:8px}
.export-btn{display:inline-flex;align-items:center;gap:7px;padding:8px 18px;border-radius:var(--r);border:1px solid var(--gold);background:var(--gold);color:#fff;font-size:12px;font-family:var(--sans);cursor:pointer;font-weight:500;letter-spacing:.03em;transition:all .15s;margin-bottom:16px}
.export-btn:hover{background:#b0821f;border-color:#b0821f}
.save-btn{display:inline-flex;align-items:center;gap:7px;padding:7px 14px;border-radius:var(--r);border:1px solid rgba(255,255,255,.2);background:rgba(255,255,255,.1);color:#fff;font-size:11px;font-family:var(--sans);cursor:pointer;font-weight:500;letter-spacing:.03em;transition:all .15s;margin-left:8px}
.save-btn:hover{background:rgba(255,255,255,.2)}
#save-indicator{font-size:11px;color:var(--ink4);margin-left:8px}
.gd-panel{display:none;position:fixed;top:64px;right:16px;z-index:200;background:#fff;border:1px solid var(--cream3);border-radius:var(--r2);padding:16px;width:320px;box-shadow:0 8px 32px rgba(0,0,0,.12)}
.gd-panel.open{display:block}
.gd-panel h3{font-size:13px;font-weight:500;color:var(--ink);margin-bottom:12px}
.gd-panel .field{margin-bottom:10px}
.gd-panel label{font-size:11px;color:var(--ink3);text-transform:uppercase;letter-spacing:.05em;display:block;margin-bottom:4px}
.gd-panel input{font-size:13px;padding:7px 10px;border:1px solid var(--cream3);border-radius:var(--r);background:var(--cream);color:var(--ink);width:100%}
.gd-panel-btn{width:100%;padding:9px;background:var(--gold);color:#fff;border:none;border-radius:var(--r);font-size:13px;font-weight:500;cursor:pointer;font-family:var(--sans);margin-top:4px}
.gd-panel-btn:hover{background:#b0821f}
.gd-panel-btn.secondary{background:transparent;color:var(--ink2);border:1px solid var(--cream3);margin-top:6px}
@keyframes fadeIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}
.page.active{animation:fadeIn .2s ease}
@media(max-width:700px){
  .grid2,.grid3,.grid4,.stats,.prep-checks{grid-template-columns:1fr}
  .main{padding:14px;padding-top:110px}
}
@media print{
  *{-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important}
  .topbar,.tabs-wrap,.export-btn,.add-btn,.btn{display:none!important}
  input,select,textarea{display:none!important}
  .field{display:none!important}
  .surf-grid{display:none!important}
  .page.print-target input,.page.print-target select,.page.print-target textarea{display:block!important}
  body{background:#fff!important;padding:0!important}
  .main{padding:0!important;max-width:100%!important}
  .page{display:none!important}
  .page.print-target{display:block!important;animation:none!important}
  .card.print-card{border:none!important;border-radius:0!important;box-shadow:none!important;padding:24px 32px!important;margin:0!important}
  .doc-header{border-bottom:2px solid #1a1714!important}
  .q-row.total-row{background:#1a1714!important;color:#fff!important}
  .doc-total-row td{background:#1a1714!important;color:#fff!important}
  @page{margin:12mm 14mm;size:A4}
}

button.tab{font-family:var(--sans);background:none;border:none;border-bottom:2px solid transparent;padding:10px 16px;font-size:12px;font-weight:500;color:var(--ink4);cursor:pointer;white-space:nowrap;transition:color .15s,border-color .15s;letter-spacing:.03em;text-transform:uppercase}
button.tab.active{color:var(--gold2);border-bottom-color:var(--gold2)}
</style>
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@300;400;500;600;700&display=swap" rel="stylesheet">
</head>
<body>
<div class="shell">
<div class="topbar">
  
  <div style="display:flex;align-items:center">
    <div class="topbar-date" id="topDate"></div>
    <span id="save-indicator" style="font-size:11px;margin-right:8px;transition:opacity .3s"></span>
    <button onclick="openLoadPanel()" style="margin-right:6px;font-size:12px;padding:6px 12px;border:1px solid rgba(255,255,255,.25);border-radius:var(--r);background:transparent;color:var(--cream);cursor:pointer">&#8679; Load</button>
    <button onclick="pushDocsToProject()" style="margin-right:6px;font-size:12px;padding:6px 14px;border:none;border-radius:var(--r);background:var(--gold);color:var(--ink);cursor:pointer;font-weight:600">&#8599; Push</button>
    <button onclick="newEstimate()" style="margin-right:6px;font-size:12px;padding:6px 12px;border:1px solid rgba(255,255,255,.25);border-radius:var(--r);background:transparent;color:var(--cream);cursor:pointer">+ New</button>
    <button class="save-btn" onclick="exportInfoPackage()">
      <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" width="14" height="14"><path d="M2 12v2h12v-2M8 2v8m0 0l-3-3m3 3l3-3"/></svg>
      Export Package
    </button>
  </div>
</div>

<div class="tabs-wrap">
  <div class="tabs">
    <button class="tab active" onclick="showTab('cover')">Cover</button>
    <button class="tab" onclick="showTab('rooms')">Rooms</button>
    <button class="tab" onclick="showTab('breakdown')">Breakdown</button>
    <button class="tab" onclick="showTab('quote')">Quote</button>
    <button class="tab" onclick="showTab('contract')">Contract</button>
    <button class="tab" onclick="showTab('changeorder')">Change Order</button>
    
    <button class="tab" onclick="showTab('labourrates')">Labour Rates</button>
    <button class="tab" onclick="showTab('paintinputs')">Paint Inputs</button>
    <button class="tab" onclick="showTab('standards')">Standards</button>
  </div>
</div>

<div class="main">

<!-- COVER -->
<div class="page active" id="page-cover">
  <button class="export-btn" onclick="exportPDF(['page-cover','page-quote','page-contract'])">
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" width="14" height="14"><path d="M2 12v2h12v-2M8 2v8m0 0l-3-3m3 3l3-3"/></svg>
    Export Bid Package
  </button>
  <div class="card print-card cover-print-card" style="text-align:center;padding:80px 40px 60px;box-sizing:border-box;display:flex;flex-direction:column;align-items:center;justify-content:center;background:#fff;border:none;box-shadow:none">
    <div style="font-family:'Montserrat',Arial,sans-serif;font-size:30px;font-weight:800;color:#C4922A;letter-spacing:0.06em;text-transform:uppercase;margin-bottom:2px">KINGDOM PAINTING INC.</div>
    <div style="font-family:'Montserrat',Arial,sans-serif;font-size:16px;font-weight:700;color:#C4922A;letter-spacing:0.14em;text-transform:uppercase;margin-bottom:48px">BID PROPOSAL</div>
    <div style="margin-bottom:52px"><img src="data:image/png;base64,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" alt="Kingdom Painting" style="width:200px;height:auto;display:block"/></div>
    <div style="width:100%;max-width:440px">
      <div style="font-family:'Montserrat',Arial,sans-serif;font-size:16px;font-weight:800;color:#1a1714;letter-spacing:0.04em;text-transform:uppercase;margin-bottom:14px">PREPARED FOR</div>
      <div id="cover-print-name" style="font-family:'Montserrat',Arial,sans-serif;font-size:14px;color:#1a1714;line-height:2;text-align:center"></div>
    </div>
  </div>
  <div class="card">
    <div class="card-title">Client information</div>
    <div class="field" style="margin-bottom:12px">
      <label>Select project</label>
      <select id="ci-contact-select" onchange="fillFromContact(this.value)" style="font-family:var(--sans);font-size:13px;padding:8px 10px;border:1px solid var(--cream3);border-radius:var(--r);background:var(--cream);color:var(--ink);width:100%">
        <option value="">— Select a project —</option>
      </select>
    </div>
    <div class="grid2" style="margin-bottom:12px">
      <div class="field"><label>Client name</label><input type="text" id="ci-name" oninput="syncClient()" placeholder="Full name"></div>
      <div class="field"><label>Phone</label><input type="text" id="ci-phone" placeholder="(xxx) xxx-xxxx" oninput="fmtPhone(this)" maxlength="14"></div>
      <div class="field"><label>Address line 1</label><input type="text" id="ci-addr1" oninput="syncClient()" placeholder="Street address"></div>
      <div class="field"><label>Address line 2</label><input type="text" id="ci-addr2" oninput="syncClient()" placeholder="City, Province, Postal"></div>
      <div class="field"><label>Email</label><input type="email" id="ci-email" oninput="syncClient()" placeholder="client@email.com"></div>
    </div>
  </div>
</div>

<!-- ROOMS -->
<div class="page" id="page-rooms">
  <div class="card" style="padding:14px 18px;margin-bottom:12px">
    <div style="display:flex;align-items:center;justify-content:space-between">
      <div>
        <span class="card-title" style="margin:0">Room areas</span>
        
      </div>
      <span class="section-badge" id="rooms-count-badge">0 rooms</span>
    </div>
  </div>
  <div id="roomsContainer"></div>
  <button class="add-btn" onclick="addRoom()" id="addRoomBtn">+ Add room / area</button>
</div>

<!-- BREAKDOWN -->
<div class="page" id="page-breakdown">
  <button class="export-btn" onclick="expandAllAndExport(['page-rooms','page-breakdown'])">
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" width="14" height="14"><path d="M2 12v2h12v-2M8 2v8m0 0l-3-3m3 3l3-3"/></svg>
    Export Rooms + Breakdown PDF
  </button>
  <div class="stats" id="breakdown-stats">
    <div class="stat"><div class="lbl">Total walls sqft</div><div class="val" id="bd-walls">0</div></div>
    <div class="stat"><div class="lbl">Total ceiling sqft</div><div class="val" id="bd-ceil">0</div></div>
    <div class="stat"><div class="lbl">Total lin ft trims</div><div class="val" id="bd-trims">0</div></div>
    <div class="stat"><div class="lbl">Total doors</div><div class="val" id="bd-doors">0</div></div>
  </div>
  <div class="stats">
    <div class="stat"><div class="lbl">Total hours / worker</div><div class="val" id="bd-hours">0</div></div>
    <div class="stat"><div class="lbl">Est. project days</div><div class="val" id="bd-days">0</div></div>
    <div class="stat"><div class="lbl">Labour cost</div><div class="val gold" id="bd-labour">$0</div></div>
    <div class="stat"><div class="lbl">Active rooms</div><div class="val" id="bd-rooms">0</div></div>
  </div>
  <div class="card">
    <div class="card-title">Per-room labour breakdown</div>
    <table class="breakdown-table" id="bd-table">
      <thead><tr><th>Surface</th><th class="num">Sqft</th><th class="num">Coats</th><th class="num">Hours</th><th class="num">Cost</th></tr></thead>
      <tbody id="bd-tbody"></tbody>
    </table>
  </div>
  <div class="card">
    <div class="card-title">Total labour by surface</div>
    <table class="breakdown-table">
      <thead><tr><th>Surface</th><th class="num">Total area</th><th class="num">Hours</th><th class="num">Days</th><th class="num">Cost</th></tr></thead>
      <tbody id="bd-surface-tbody"></tbody>
    </table>
  </div>

  <div class="card">
    <div class="card-title">Paint colour summary and cost</div>
    <table class="breakdown-table">
      <thead><tr><th>Product</th><th>Colour &amp; Sheen</th><th>Surface</th><th class="num">Total Sqft</th><th class="num">Est. Qty</th><th class="num">Cost</th></tr></thead>
      <tbody id="bd-colour-tbody"></tbody>
    </table>
  </div>
</div>

<!-- QUOTE -->
<div class="page" id="page-quote">
  <button class="export-btn" onclick="exportPDF('page-quote')">
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" width="14" height="14"><path d="M2 12v2h12v-2M8 2v8m0 0l-3-3m3 3l3-3"/></svg>
    Export PDF
  </button>
  <button class="export-btn" onclick="pushToProject()" style="background:var(--gold);color:var(--ink);border:none;margin-left:8px">
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" width="14" height="14"><path d="M8 2v12M2 8l6-6 6 6"/></svg>
    Project $
  </button>
  <div class="card print-card">
    <div class="doc-header">
      <div style="display:flex;align-items:center;gap:10px">
        <img class="kp-logo kp-logo-sm" src="data:image/png;base64,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" alt="Kingdom Painting" style="height:44px;width:auto;display:block">
        <span style="font-family:var(--sans);font-size:13px;font-weight:700;color:#C4922A;letter-spacing:0.04em;white-space:nowrap">KINGDOM PAINTING INC.</span>
        <div class="doc-type">Quote</div>

      </div>
      <div class="doc-meta">
        <div><strong>Client</strong> <span id="q-client-left">—</span></div>
        <div><strong>Address</strong> <span id="q-addr-left">—</span></div>
        <div><strong>Date</strong> <span id="q-date"></span></div>
        <div><strong>HST #</strong> 71164 5556 RT0001</div>
      </div>
    </div>
    <table class="doc-table" style="margin-bottom:16px">
      <thead><tr><th style="width:110px">Item</th><th>Description</th><th class="right" style="white-space:nowrap;width:90px">Amount</th></tr></thead>
      <tbody id="q-line-tbody"></tbody>
      <tfoot>
        <tr id="q-disc-row" style="display:none"><td colspan="2" style="text-align:right"><span id="q-disc-label">Discount</span></td><td class="right"><span id="q-disc-val">-$0.00</span></td></tr>
        <tr><td colspan="2" style="text-align:right;font-size:12px;color:var(--ink3)">Subtotal</td><td class="right" id="q-subtotal">$0.00</td></tr>
        <tr><td colspan="2" style="text-align:right;font-size:12px;color:var(--ink3)" id="q-tax-label">HST (13%)</td><td class="right" id="q-tax">$0.00</td></tr>
        <tr><td colspan="2" style="text-align:right;font-size:13px;font-weight:500">TOTAL</td><td class="right" id="q-total" style="font-size:15px;font-weight:600">$0.00</td></tr>
      </tfoot>
    </table>
    <div class="doc-section">
      <div class="doc-section-title">Payment terms</div>
      <div style="font-size:12px;color:var(--ink2);line-height:1.8;margin-bottom:12px">An initial deposit of 10% is required on the first day, followed by 45% midway through the project, and the balance on completion.</div>
      <div class="pay-grid">
        <div class="pay-card"><div class="pay-step">Step 1 · Deposit</div><div class="pay-amount" id="q-pay1">$0.00</div><div class="pay-desc">10% due on first day</div></div>
        <div class="pay-card"><div class="pay-step">Step 2 · Midway</div><div class="pay-amount" id="q-pay2">$0.00</div><div class="pay-desc">45% due midway</div></div>
        <div class="pay-card"><div class="pay-step">Step 3 · Completion</div><div class="pay-amount" id="q-pay3">$0.00</div><div class="pay-desc">Balance on completion</div></div>
      </div>
    </div>
    <div style="margin-top:16px;padding:12px;background:var(--cream2);border-radius:var(--r);font-size:12px;color:var(--ink2);line-height:1.7">
      Thank you for your business! E-transfer payments: <strong>info@kingdompainting.ca</strong>
    </div>
  </div>
</div>

<!-- CONTRACT -->
<div class="page" id="page-contract">
  <button class="export-btn" onclick="exportPDF('page-contract')">
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" width="14" height="14"><path d="M2 12v2h12v-2M8 2v8m0 0l-3-3m3 3l3-3"/></svg>
    Export PDF
  </button>
  <div class="card print-card">
    <div class="doc-header">
      <div style="display:flex;align-items:center;gap:10px"><img class="kp-logo kp-logo-sm" src="data:image/png;base64,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" alt="Kingdom Painting" style="height:44px;width:auto;display:block">
        <span style="font-family:var(--sans);font-size:13px;font-weight:700;color:#C4922A;letter-spacing:0.04em;white-space:nowrap">KINGDOM PAINTING INC.</span><div class="doc-type">Painting Service Agreement</div></div>
      <div class="doc-meta"><div><strong>Date</strong> <span id="con-date"></span></div></div>
    </div>
    <div style="font-size:13px;color:var(--ink2);line-height:1.9" id="contract-body"></div>
  </div>
</div>

<!-- CHANGE ORDER -->
<div class="page" id="page-changeorder">
  <button class="export-btn" onclick="exportPDF('page-changeorder')">
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" width="14" height="14"><path d="M2 12v2h12v-2M8 2v8m0 0l-3-3m3 3l3-3"/></svg>
    Export PDF
  </button>
  <div class="card print-card">
    <div class="doc-header">
      <div style="display:flex;align-items:center;gap:10px"><img class="kp-logo kp-logo-sm" src="data:image/png;base64,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" alt="Kingdom Painting" style="height:44px;width:auto;display:block">
        <span style="font-family:var(--sans);font-size:13px;font-weight:700;color:#C4922A;letter-spacing:0.04em;white-space:nowrap">KINGDOM PAINTING INC.</span><div class="doc-type">Change Order</div></div>
      <div class="doc-meta"><div><strong>Client</strong> <span id="co-client-left">—</span></div><div><strong>Date</strong> <span id="co-date"></span></div><div><strong>HST #</strong> 71164 5556 RT0001</div></div>
    </div>
    <div class="card-title">Change order items</div>
    <div id="co-items"></div>
    <button class="add-btn" onclick="addChangeItem()" style="margin-top:8px">+ Add item</button>
    <hr class="divider">
    <div class="quote-box" style="margin-top:12px">
      <div class="q-row"><span class="q-label">Subtotal</span><span class="q-val" id="co-sub">$0.00</span></div>
      <div class="q-row"><span class="q-label">HST (13%)</span><span class="q-val" id="co-tax">$0.00</span></div>
      <div class="q-row total-row"><span>Total</span><span id="co-total">$0.00</span></div>
    </div>
    <div style="margin-top:12px;font-size:12px;color:var(--ink2)">E-transfer: <strong>info@kingdompainting.ca</strong></div>
  </div>
</div>

<!-- LABOUR RATES -->
<div class="page" id="page-labourrates">
  <div class="grid2">
    <div class="card">
      <div class="card-title">Rate calculation</div>
      <div class="grid2">
        <div class="field"><label>Billable hours/year</label><input type="number" id="lr-billable" value="1700" oninput="recalcRates();schedulePaintSave()"></div>
        <div class="field"><label>Labour buffer</label><input type="number" id="lr-buffer" value="1.25" step="0.05" oninput="recalcRates();schedulePaintSave()"></div><div class="field"><label>Materials buffer</label><input type="number" id="lr-mat-buffer" value="1.25" step="0.05" oninput="recalcAll();schedulePaintSave()"></div>
      </div>
      <hr class="divider">
      <div class="toggle-row"><input type="checkbox" id="lr-taxes" checked onchange="recalcRates();schedulePaintSave()"><span>Apply payroll taxes</span></div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:6px">
        <div style="background:var(--cream2);border-radius:var(--r);padding:10px 12px">
          <div class="toggle-row" style="margin-bottom:6px"><input type="checkbox" id="lr-discount" onchange="recalcRates();schedulePaintSave()"><span style="font-weight:600">Discount %</span></div>
          <div class="field" style="margin:0"><label>Percentage</label><input type="number" id="lr-disc-pct" value="10" min="0" max="100" oninput="recalcRates();schedulePaintSave()"></div>
        </div>
        <div style="background:var(--cream2);border-radius:var(--r);padding:10px 12px">
          <div class="toggle-row" style="margin-bottom:6px"><input type="checkbox" id="lr-discount-amt" onchange="recalcRates();schedulePaintSave()"><span style="font-weight:600">Discount $</span></div>
          <div class="field" style="margin:0"><label>Amount</label><input type="number" id="lr-disc-amt" value="0" min="0" oninput="recalcRates();schedulePaintSave()"></div>
        </div>
      </div>
      <hr class="divider">
      <table class="rates-table">
        <tr><td style="color:var(--ink3)">Overhead / hr</td><td id="lr-oh-hr">$0</td></tr>
        <tr><td style="color:var(--ink3)">Field wage / worker</td><td id="lr-wage">$0</td></tr>
        <tr style="font-weight:500"><td>Profit / hr</td><td id="lr-total-hr" style="color:var(--gold)">$0</td></tr>
        <tr style="font-weight:500;border-top:2px solid var(--cream3)"><td>Total hourly rate (all workers)</td><td id="lr-total-all" style="color:var(--gold);font-size:15px">$0</td></tr>
      </table>
    </div>
    <div class="card">
      <div class="card-title">Overhead costs</div>
      <div id="lr-overhead-fields"></div>
      <hr class="divider">
      <div style="display:flex;justify-content:space-between;font-size:13px;font-weight:500">
        <span>Total overhead</span><span id="lr-oh-sum" style="color:var(--gold)">$0</span>
      </div>
    </div>
  </div>
  <div class="card">
    <div class="card-title">Field workers</div>
    <div id="lr-workers"></div>
    <div style="display:flex;justify-content:space-between;align-items:center;margin-top:12px;padding-top:12px;border-top:1px solid var(--cream3)">
      <div style="font-size:13px">Active workers: <strong id="lr-active-count">0</strong></div>
      <div style="font-size:15px;font-weight:500;color:var(--gold)"><span id="lr-total-all-workers">$0</span><span style="font-size:11px;color:var(--ink3);margin-left:4px">/hr field wage</span></div>
    </div>
  </div>
  <div class="card" style="margin-top:12px">
    <div class="card-title">Profit</div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;align-items:end">
      <div class="field" style="margin:0">
        <label>Target profit ($)</label>
        <input type="number" id="lr-profit-target" value="0" min="0" step="100" oninput="recalcRates();schedulePaintSave()" placeholder="e.g. 5000">
      </div>
      <div style="background:var(--cream2);border-radius:var(--r);padding:10px 14px;display:flex;justify-content:space-between;align-items:center">
        <span style="font-size:12px;color:var(--ink3)">Profit / hr</span>
        <span id="lr-profit" style="font-size:15px;font-weight:600;color:var(--gold)">$0/hr</span>
      </div>
    </div>
    <div style="font-size:11px;color:var(--ink4);margin-top:8px">Target profit ÷ (billable hours × active workers) = profit / hr added to rate</div>
  </div>
</div>

<!-- PAINT INPUTS -->
<div class="page" id="page-paintinputs">
  <div class="grid2">
    <div class="card"><div class="card-title">Paints (Walls &amp; Trim)</div><div id="pi-paints-container"></div><div class="card-title" style="margin-top:16px">Paints (Ceiling)</div><div id="pi-ceilpaints-container"></div></div>
    <div class="card"><div class="card-title">Primers</div><div id="pi-primers-container"></div></div>
    <div class="card"><div class="card-title">Paint colours</div><div id="pi-colours-container"></div></div>
    <div class="card"><div class="card-title">Supplies</div><div id="pi-supplies-container"></div></div>
  </div>
</div>

<!-- STANDARDS -->
<div class="page" id="page-standards">
  <div style="font-size:12px;color:var(--ink3);margin-bottom:14px;padding:10px 14px;background:var(--cream2);border-radius:var(--r);border-left:3px solid var(--gold)">
    All values are editable and update labour calculations in real time.
  </div>
  <div class="grid2">
    <div class="card">
      <div class="card-title">Walls — sqft per hour</div>
      <table class="doc-table"><thead><tr><th>Coats</th><th class="right">Sqft/Hr</th></tr></thead>
        <tbody>
          <tr><td>1 coat</td><td class="right"><input type="number" min="1" value="200" style="width:80px;text-align:right;font-size:13px;padding:4px 8px;border:1px solid var(--cream3);border-radius:var(--r);background:var(--cream)" oninput="updStd('walls',1,+this.value)"></td></tr>
          <tr><td>2 coats</td><td class="right"><input type="number" min="1" value="120" style="width:80px;text-align:right;font-size:13px;padding:4px 8px;border:1px solid var(--cream3);border-radius:var(--r);background:var(--cream)" oninput="updStd('walls',2,+this.value)"></td></tr>
          <tr><td>Primer &amp; 2 coats</td><td class="right"><input type="number" min="1" value="75" style="width:80px;text-align:right;font-size:13px;padding:4px 8px;border:1px solid var(--cream3);border-radius:var(--r);background:var(--cream)" oninput="updStd('walls',3,+this.value)"></td></tr>
        </tbody>
      </table>
    </div>
    <div class="card">
      <div class="card-title">Flat Ceiling — sqft per hour</div>
      <table class="doc-table"><thead><tr><th>Coats</th><th class="right">Sqft/Hr</th></tr></thead>
        <tbody>
          <tr><td>1 coat</td><td class="right"><input type="number" min="1" value="150" style="width:80px;text-align:right;font-size:13px;padding:4px 8px;border:1px solid var(--cream3);border-radius:var(--r);background:var(--cream)" oninput="updStd('flatCeiling',1,+this.value)"></td></tr>
          <tr><td>2 coats</td><td class="right"><input type="number" min="1" value="90" style="width:80px;text-align:right;font-size:13px;padding:4px 8px;border:1px solid var(--cream3);border-radius:var(--r);background:var(--cream)" oninput="updStd('flatCeiling',2,+this.value)"></td></tr>
          <tr><td>Primer &amp; 2 coats</td><td class="right"><input type="number" min="1" value="55" style="width:80px;text-align:right;font-size:13px;padding:4px 8px;border:1px solid var(--cream3);border-radius:var(--r);background:var(--cream)" oninput="updStd('flatCeiling',3,+this.value)"></td></tr>
        </tbody>
      </table>
    </div>
    <div class="card">
      <div class="card-title">Stucco Ceiling — sqft per hour</div>
      <table class="doc-table"><thead><tr><th>Coats</th><th class="right">Sqft/Hr</th></tr></thead>
        <tbody>
          <tr><td>1 coat</td><td class="right"><input type="number" min="1" value="80" style="width:80px;text-align:right;font-size:13px;padding:4px 8px;border:1px solid var(--cream3);border-radius:var(--r);background:var(--cream)" oninput="updStd('stuccoCeiling',1,+this.value)"></td></tr>
          <tr><td>2 coats</td><td class="right"><input type="number" min="1" value="50" style="width:80px;text-align:right;font-size:13px;padding:4px 8px;border:1px solid var(--cream3);border-radius:var(--r);background:var(--cream)" oninput="updStd('stuccoCeiling',2,+this.value)"></td></tr>
          <tr><td>Primer &amp; 2 coats</td><td class="right"><input type="number" min="1" value="35" style="width:80px;text-align:right;font-size:13px;padding:4px 8px;border:1px solid var(--cream3);border-radius:var(--r);background:var(--cream)" oninput="updStd('stuccoCeiling',3,+this.value)"></td></tr>
        </tbody>
      </table>
      <hr class="divider" style="margin:12px 0 10px">
      <div class="card-title" style="margin-bottom:8px">Remove Stucco — rate per sqft</div>
      <div class="field" style="margin:0">
        <label>$ per sqft</label>
        <input type="number" min="0" step="0.05" value="0.75" style="width:100px;font-size:13px;padding:4px 8px;border:1px solid var(--cream3);border-radius:var(--r);background:var(--cream)" oninput="if(+this.value>0){STANDARDS.removeStucco={rate:+this.value};recalcAll();schedulePaintSave();}">
      </div>
    </div>
    <div class="card">
      <div class="card-title">Trims — linear feet per hour</div>
      <table class="doc-table"><thead><tr><th>Surface</th><th>Coats</th><th class="right">LF/Hr</th></tr></thead>
        <tbody>
          <tr><td rowspan="3">Baseboards</td><td>1</td><td class="right"><input type="number" min="1" value="100" style="width:70px;text-align:right;font-size:13px;padding:4px 8px;border:1px solid var(--cream3);border-radius:var(--r);background:var(--cream)" oninput="updStd('baseboards',1,+this.value)"></td></tr>
          <tr><td>2</td><td class="right"><input type="number" min="1" value="60" style="width:70px;text-align:right;font-size:13px;padding:4px 8px;border:1px solid var(--cream3);border-radius:var(--r);background:var(--cream)" oninput="updStd('baseboards',2,+this.value)"></td></tr>
          <tr><td>Primer &amp; 2 Coats</td><td class="right"><input type="number" min="1" value="40" style="width:70px;text-align:right;font-size:13px;padding:4px 8px;border:1px solid var(--cream3);border-radius:var(--r);background:var(--cream)" oninput="updStd('baseboards',3,+this.value)"></td></tr>
          <tr><td rowspan="3">Crown</td><td>1</td><td class="right"><input type="number" min="1" value="90" style="width:70px;text-align:right;font-size:13px;padding:4px 8px;border:1px solid var(--cream3);border-radius:var(--r);background:var(--cream)" oninput="updStd('crown',1,+this.value)"></td></tr>
          <tr><td>2</td><td class="right"><input type="number" min="1" value="55" style="width:70px;text-align:right;font-size:13px;padding:4px 8px;border:1px solid var(--cream3);border-radius:var(--r);background:var(--cream)" oninput="updStd('crown',2,+this.value)"></td></tr>
          <tr><td>Primer &amp; 2 Coats</td><td class="right"><input type="number" min="1" value="35" style="width:70px;text-align:right;font-size:13px;padding:4px 8px;border:1px solid var(--cream3);border-radius:var(--r);background:var(--cream)" oninput="updStd('crown',3,+this.value)"></td></tr>
          <tr><td rowspan="3">Door Frames</td><td>1</td><td class="right"><input type="number" min="1" value="170" style="width:70px;text-align:right;font-size:13px;padding:4px 8px;border:1px solid var(--cream3);border-radius:var(--r);background:var(--cream)" oninput="updStd('doorFrames',1,+this.value)"></td></tr>
          <tr><td>2</td><td class="right"><input type="number" min="1" value="102" style="width:70px;text-align:right;font-size:13px;padding:4px 8px;border:1px solid var(--cream3);border-radius:var(--r);background:var(--cream)" oninput="updStd('doorFrames',2,+this.value)"></td></tr>
          <tr><td>Primer &amp; 2 Coats</td><td class="right"><input type="number" min="1" value="65" style="width:70px;text-align:right;font-size:13px;padding:4px 8px;border:1px solid var(--cream3);border-radius:var(--r);background:var(--cream)" oninput="updStd('doorFrames',3,+this.value)"></td></tr>
          <tr><td rowspan="3">Windows</td><td>1</td><td class="right"><input type="number" min="1" value="100" style="width:70px;text-align:right;font-size:13px;padding:4px 8px;border:1px solid var(--cream3);border-radius:var(--r);background:var(--cream)" oninput="updStd('windows',1,+this.value)"></td></tr>
          <tr><td>2</td><td class="right"><input type="number" min="1" value="60" style="width:70px;text-align:right;font-size:13px;padding:4px 8px;border:1px solid var(--cream3);border-radius:var(--r);background:var(--cream)" oninput="updStd('windows',2,+this.value)"></td></tr>
          <tr><td>Primer &amp; 2 Coats</td><td class="right"><input type="number" min="1" value="40" style="width:70px;text-align:right;font-size:13px;padding:4px 8px;border:1px solid var(--cream3);border-radius:var(--r);background:var(--cream)" oninput="updStd('windows',3,+this.value)"></td></tr>
        </tbody>
      </table>
    </div>
    <div class="card">
      <div class="card-title">Doors — sqft per hour</div>
      <table class="doc-table"><thead><tr><th>Coats</th><th class="right">Sqft/Hr</th></tr></thead>
        <tbody>
          <tr><td>1 coat</td><td class="right"><input type="number" min="1" value="84" style="width:70px;text-align:right;font-size:13px;padding:4px 8px;border:1px solid var(--cream3);border-radius:var(--r);background:var(--cream)" oninput="updStd('doors',1,+this.value)"></td></tr>
          <tr><td>2 coats</td><td class="right"><input type="number" min="1" value="42" style="width:70px;text-align:right;font-size:13px;padding:4px 8px;border:1px solid var(--cream3);border-radius:var(--r);background:var(--cream)" oninput="updStd('doors',2,+this.value)"></td></tr>
          <tr><td>Primer &amp; 2 coats</td><td class="right"><input type="number" min="1" value="21" style="width:70px;text-align:right;font-size:13px;padding:4px 8px;border:1px solid var(--cream3);border-radius:var(--r);background:var(--cream)" oninput="updStd('doors',3,+this.value)"></td></tr>
<script>// ─── DATA ───────────────────────────────────────
const STANDARDS={
  walls:{1:200,2:120,3:75},ceiling:{1:150,2:90,3:55},
  flatCeiling:{1:150,2:90,3:55},stuccoCeiling:{1:80,2:50,3:35},
  removeStucco:{rate:0.75},
  baseboards:{1:100,2:60,3:40},crown:{1:90,2:55,3:35},
  doorFrames:{1:170,2:102,3:65},windows:{1:100,2:60,3:40},doors:{1:84,2:42,3:21}
};
const PAINTS=[
  {n:'Benjamin Moore - Ultra Spec',g:50,p:225},
  {n:'Benjamin Moore - Ben',g:70,p:0},
  {n:'Benjamin Moore - Aura',g:115,p:535},
  {n:'Benjamin Moore - Aura Bath & Spa',g:110,p:0},
  {n:'Benjamin Moore - Advance',g:75,p:0},
  {n:'Sherwin Williams - Promar 200',g:50,p:225},
  {n:'Sherwin Williams - Duration Home',g:70,p:350},
  {n:'Sherwin Williams - Emerald',g:80,p:400},
  {n:'Sherwin Williams - Promar 400',g:35,p:140},
  {n:'Sherwin Williams - Pro Industrial Epoxy',g:75,p:0}
];
var CEILING_PAINTS=[
  {n:'Benjamin Moore - Waterborne Ceiling',g:75,p:0},
  {n:'Benjamin Moore - Ultra Spec Ceiling',g:50,p:0},
  {n:'Sherwin Williams - ProMar Ceiling',g:45,p:0}
];
const PRIMERS=[
  {n:'Benjamin Moore - Drywall Primer',g:35,p:0},
  {n:'Benjamin Moore - Stix Primer',g:85,p:0},
  {n:'Kilz - Original Oil Primer',g:70,p:0},
  {n:'Kilz - PVA Primer',g:25,p:0},
  {n:'Kilz - 1 Primer',g:35,p:0},
  {n:'Kilz - 2 Primer',g:55,p:0}
];
const COLOURS=[
  // Whites & Off-Whites
  {n:'OC-65 Chantilly Lace',h:'#f5f5f2'},
  {n:'OC-117 Simply White',h:'#f7f4e8'},
  {n:'OC-17 White Dove',h:'#f3efe3'},
  {n:'OC-20 Pale Oak',h:'#e8ddd1'},
  {n:'OC-15 Baby Fawn',h:'#ede3d4'},
  {n:'OC-52 Gray Owl',h:'#d5d6cb'},
  {n:'OC-45 Swiss Coffee',h:'#ede8dc'},
  {n:'OC-22 Calm',h:'#d9d5c8'},
  {n:'OC-150 Brilliant White',h:'#f2f2ef'},
  {n:'OC-57 White Heron',h:'#f0ece0'},
  {n:'AF-50 Etiquette',h:'#e8e0d3'},
  // Neutrals & Grays
  {n:'HC-172 Revere Pewter',h:'#cbc6b8'},
  {n:'HC-173 Edgecomb Gray',h:'#cfc9bb'},
  {n:'HC-170 Stonington Gray',h:'#b5bab6'},
  {n:'HC-169 Coventry Gray',h:'#9da0a0'},
  {n:'HC-166 Kendall Charcoal',h:'#74756c'},
  {n:'HC-165 Boothbay Gray',h:'#afb8b5'},
  {n:'HC-105 Rockport Gray',h:'#979490'},
  {n:'AF-100 Pashmina',h:'#d4c9ba'},
  {n:'1560 Antique Pewter',h:'#b4b5a6'},
  // Blues
  {n:'HC-154 Hale Navy',h:'#434c59'},
  {n:'HC-156 Van Deusen Blue',h:'#4a5f75'},
  {n:'HC-144 Palladian Blue',h:'#a8bebe'},
  {n:'2136-40 Aegean Teal',h:'#617f80'},
  {n:'2123-50 Ocean Air',h:'#92afc0'},
  {n:'2062-20 Gentleman\\'s Gray',h:'#3d4a57'},
  {n:'1634 Santorini Blue',h:'#6e8fa5'},
  // Greens
  {n:'HC-114 Saybrook Sage',h:'#9ea98c'},
  {n:'HC-188 Essex Green',h:'#3d4e40'},
  {n:'HC-158 Newburg Green',h:'#4a6057'},
  {n:'2144-40 Soft Fern',h:'#b1be9a'},
  {n:'1495 October Mist',h:'#b9c1a9'},
  {n:'462 Vintage Vogue',h:'#8fa08a'},
  {n:'2041-10 Hunter Green',h:'#2e4335'},
  // Browns & Tans
  {n:'HC-81 Manchester Tan',h:'#c9b89a'},
  {n:'HC-76 Davenport Tan',h:'#c2a882'},
  {n:'HC-72 Branchport Brown',h:'#8e6e52'},
  {n:'HC-9 Chestertown Buff',h:'#d4bc8a'},
  {n:'1001 North Creek Brown',h:'#7a5c42'},
  {n:'2100-20 Leather Saddle Brown',h:'#7a5038'},
  {n:'2130-10 Black Bean Soup',h:'#3a2820'},
  {n:'AF-180 Wenge',h:'#4a3830'},
  // Reds
  {n:'AF-290 Caliente',h:'#c13030'},
  {n:'HC-181 Heritage Red',h:'#8c2020'},
  {n:'2000-10 Red',h:'#b82020'},
  {n:'2090-40 Wild Flower',h:'#b04860'},
  {n:'2092-30 Boston Brick',h:'#9a4030'},
  {n:'AF-300 Dinner Party',h:'#7a2020'},
  {n:'105 Terra Mauve',h:'#c27860'},
  // Oranges
  {n:'2175-70 Peach Parfait',h:'#f0c8a8'},
  {n:'AF-185 Venetian Portico',h:'#c87848'},
  {n:'AF-215 Italianate',h:'#c86830'},
  {n:'070 Topaz',h:'#c88030'},
  {n:'2015-10 Electric Orange',h:'#e05010'},
  // Pinks
  {n:'AF-250 Head Over Heels',h:'#e8b8b0'},
  {n:'1191 Love & Happiness',h:'#e0a0a0'},
  {n:'052 Conch Shell',h:'#e8c0b0'},
  {n:'1296 Sailor\\'s Delight',h:'#d49090'},
  {n:'2174-60 Dream Whip',h:'#f0d0c8'},
  {n:'2102-70 First Light',h:'#f0d8d8'},
  // Purples
  {n:'1444 New Age',h:'#a090b0'},
  {n:'2117-60 Winter Gray',h:'#c0b8c8'},
  {n:'2070-60 Lavender Mist',h:'#c8b8d8'},
  {n:'2071-60 Lily Lavender',h:'#c8b0d8'},
  {n:'2116-40 Hazy Lilac',h:'#9888a8'},
  {n:'2117-30 Shadow',h:'#807090'},
  // Yellows
  {n:'CSP-305 Crisp Linen',h:'#ece0c0'},
  {n:'HC-6 Windham Cream',h:'#ead8a0'},
  {n:'2152-50 Golden Straw',h:'#e0c878'},
  {n:'HC-12 Concord Ivory',h:'#deca90'},
  {n:'HC-11 Marblehead Gold',h:'#d4b860'},
  // Blacks
  {n:'HC-190 Black',h:'#1c1c1c'},
  {n:'2131-10 Black Satin',h:'#2a2820'},
  {n:'2131-20 Midnight',h:'#302e28'},
  {n:'2120-30 Witching Hour',h:'#2c2a30'},
  {n:'1610 French Beret',h:'#302828'},
  {n:'2124-10 Wrought Iron',h:'#282c2c'}
];
const SUPPLIES=[
  {n:'9" Roller',p:6},{n:'18" Roller',p:22},{n:'Mini Roller',p:3},
  {n:'FrogTape 4 Pack',p:38.8},{n:'Floor Shield 36x50',p:32.3},
  {n:'CGC Sheetrock 45 11kg',p:46},{n:'Norton Sanding Sponge',p:5.6}
];
const OVERHEAD_ITEMS=[
  {n:'Salary',v:50000},{n:'Gas',v:4000},{n:'Sprayer',v:1800},{n:'Ads',v:1000},
  {n:'Company Meals',v:750},{n:'Company Insurance',v:650},{n:'Accountant',v:500},
  {n:'Mechanical',v:500},{n:'Tools',v:500},{n:'Google Workplace',v:120},{n:'Website',v:50}
];
const WORKERS_DEFAULT=[{n:'David',r:40,active:true},{n:'René',r:30,active:true},{n:'Nicky',r:18,active:false}];

let rooms=[],roomCounter=0,changeItems=[],changeCounter=0;
let workers=JSON.parse(JSON.stringify(WORKERS_DEFAULT));
let overheadItems=JSON.parse(JSON.stringify(OVERHEAD_ITEMS));
let globalRate=65;
let paintMap={};
const qtyOverrides={};
let currentEstimateId=null,saveTimer=null;

// ─── UTILS ──────────────────────────────────────
function fmt(n){return '$'+(+n||0).toFixed(2).replace(/\\\\\\\\B(?=(\\\\\\\\d{3})+(?!\\\\\\\\d))/g,',');}
function fmtN(n){return Math.round(+n||0).toLocaleString();}
function fmtPhone(el){var v=el.value.replace(/\\D/g,'').slice(0,10);var o='';if(v.length>0)o='('+v.slice(0,3);if(v.length>=4)o+=') '+v.slice(3,6);if(v.length>=7)o+='-'+v.slice(6,10);el.value=o;}
function today(){return new Date().toLocaleDateString('en-CA',{year:'numeric',month:'long',day:'numeric'});}
function sel(id){return document.getElementById(id);}
function v(id){return sel(id)?sel(id).value:'';}
function stripUnit(n){return(n||'').replace(/\\\\\\\\s+(Gallon|Pail|Can)\\\\\\\\s*$/i,'').trim();}
function paintOpts(sv){sv=sv||'';return '<option value="">— Select —</option>'+PAINTS.map(function(p){return '<option value="'+p.n+'" '+(sv===p.n?'selected':'')+'>'+p.n+'</option>';}).join('');}
function ceilPaintOpts(sv){sv=sv||'';return '<option value="">— Select —</option>'+CEILING_PAINTS.map(function(p){return '<option value="'+p.n+'" '+(sv===p.n?'selected':'')+'>'+p.n+'</option>';}).join('');}
function primerOpts(sv=''){return '<option value="">— Select primer —</option>'+PRIMERS.map(p=>'<option value="'+p.n+'" '+(sv===p.n?'selected':'')+'>'+p.n+'</option>').join('');}
function sheenOpts(sv=''){return ['Flat','Matte','Eggshell','Satin','Pearl','Semi-Gloss','TBD'].map(s=>'<option value="'+s+'" '+(sv===s?'selected':'')+'>'+s+'</option>').join('');}
function colourOpts(sv=''){return '<option value="">— Colour —</option>'+COLOURS.map(c=>'<option value="'+c.n+'" '+(sv===c.n?'selected':'')+'>'+c.n+'</option>').join('');}

// ─── TABS ───────────────────────────────────────


// ─── CLIENT SYNC ────────────────────────────────
function syncClient(){
  const name=v('ci-name'),a1=v('ci-addr1'),a2=v('ci-addr2'),em=v('ci-email'),ph=v('ci-phone');
  sel('cover-name').textContent=name||'—';
  sel('cover-addr').textContent=[a1,a2].filter(Boolean).join(', ');
  sel('cover-email').textContent=em;
  // Populate BID PROPOSAL print cover block
  var cpn=sel('cover-print-name');
  if(cpn){
    var lines=[];
    if(name)lines.push('<strong>'+name+'</strong>');
    if(a1)lines.push(a1);
    if(a2)lines.push(a2);
    if(ph)lines.push(ph);
    if(em)lines.push('<span style=\\"color:#1a6bbf\\">'+em+'</span>');
    cpn.innerHTML=lines.join('<br>');
  }
  ['q-client','inv-client','co-client'].forEach(id=>{const e=sel(id);if(e)e.textContent=name||'—';});
  ['q-addr','inv-addr'].forEach(id=>{const e=sel(id);if(e)e.textContent=[a1,a2].filter(Boolean).join(', ')||'—';});
}

// ─── ROOMS ──────────────────────────────────────

// ─── ROOM CALCULATIONS ────────────────────────────────
function calcWalls(r){
  if(!r.walls)return 0;
  if(r.irregular){
    const h=r.height||9;
    return Math.max(0,(r.wallSegs||[]).reduce(function(s,seg){return s+(+(seg.l)||0)*h;},0));
  }
  return Math.max(0,2*(r.length+r.width)*(r.height||9));
}
function calcCeil(r){
  if(!r.ceiling)return 0;
  if(r.irregular){
    return Math.max(0,(r.ceilSegs||[]).reduce(function(s,seg){return s+(+(seg.l)||0)*(+(seg.w)||0);},0));
  }
  return(r.length||0)*(r.width||0);
}
function calcTrims(r){return(r.baseboards?r.baseLF:0)+(r.crown?r.crownLF:0)+(r.doorFrames?r.dfLF:0)+(r.windows?r.winLF:0);}

function upd(id,key,val){
  const r=rooms.find(x=>x.id===id);if(!r)return;
  r[key]=val;
  autoFillLF(r);
  const rerender=['walls','ceiling','baseboards','crown','doorFrames','windows','doors','wallCoats','ceilCoats','doorCoats','baseCoats','crownCoats','dfCoats','winCoats','irregular','wallsPrimer','ceilingPrimer','trimPrimer'];
  if(rerender.includes(key)){renderRooms(id);recalcAll();return;}
  const el_ws=sel('rws_'+id),el_cs=sel('rcs_'+id),el_lc=sel('rlc_'+id),el_t=sel('rtrim_'+id),el_d=sel('rdoors_'+id);
  if(el_ws)el_ws.textContent=fmtN(calcWalls(r));
  if(el_cs)el_cs.textContent=fmtN(calcCeil(r));
  if(el_t)el_t.textContent=fmtN(calcTrims(r));
  if(el_d)el_d.textContent=r.doors?r.doorCount:0;
  if(el_lc)el_lc.textContent=fmt(calcRoomCost(r));
  const b=sel('badge_'+id);if(b)b.textContent=calcWalls(r)>0?fmtN(calcWalls(r))+' sqft walls':'\\u2014';
  recalcAll();

  scheduleRoomSave();
}
function updPrep(id,key,val){const r=rooms.find(x=>x.id===id);if(!r)return;r.prep[key]=val;recalcAll();}
function updWinDim(id,key,val){
  var r=rooms.find(function(x){return x.id===id;});if(!r)return;
  if(!r.winDims||!r.winDims[0])r.winDims=[{l:0,w:0}];
  r.winDims[0][key]=+(val)||0;
  r.winLF=2*((r.winDims[0].l||0)+(r.winDims[0].w||0));
  renderRooms();recalcAll();
}
function toggleRoom(id){
  const b=document.querySelector('.room-body[data-id=\\"'+id+'\\"]');
  const a=sel('arr_'+id);
  if(!b)return;
  const open=b.classList.toggle('open');
  if(a)a.classList.toggle('open',open);
}

function calcRoomHrs(r){
  let h=0;
  const ws=calcWalls(r),cs=calcCeil(r);
  if(r.walls&&ws)h+=ws/STANDARDS.walls[r.wallCoats];
  if(r.ceiling&&cs){
    var cStd=(r.ceilType==='stucco'?STANDARDS.stuccoCeiling:STANDARDS.flatCeiling)||STANDARDS.ceiling;
    h+=cs/cStd[r.ceilCoats];
    if(r.removeStucco)h+=cs/((STANDARDS.removeStucco.rate||0.75));
  }
  if(r.baseboards&&r.baseLF)h+=r.baseLF/STANDARDS.baseboards[r.baseCoats];
  if(r.crown&&r.crownLF)h+=r.crownLF/STANDARDS.crown[r.crownCoats];
  if(r.doorFrames&&r.dfLF)h+=r.dfLF/STANDARDS.doorFrames[r.dfCoats];
  if(r.windows&&r.winLF)h+=r.winLF/STANDARDS.windows[r.winCoats];
  if(r.doors&&r.doorCount)h+=(r.doorCount*21)/STANDARDS.doors[r.doorCoats];
  h+=(r.prepHrs||0);
  return h;
}
function calcRoomCost(r){const aw=workers.filter(w=>w.active).length||1;return calcRoomHrs(r)*globalRate*aw;}

function updSeg(id,idx,val){
  var r=rooms.find(function(x){return x.id===id;});if(!r)return;
  if(!r.wallSegs)r.wallSegs=[{l:0},{l:0},{l:0},{l:0},{l:0},{l:0}];
  r.wallSegs[idx]={l:+(val)||0};
  renderRooms(id);recalcAll();
}
function updCeilSeg(id,idx,key,val){
  var r=rooms.find(function(x){return x.id===id;});if(!r)return;
  if(!r.ceilSegs)r.ceilSegs=[{l:0,w:0},{l:0,w:0}];
  r.ceilSegs[idx]=Object.assign({},r.ceilSegs[idx]);
  r.ceilSegs[idx][key]=+(val)||0;
  renderRooms(id);recalcAll();
}

function calcRoomSuppliesCost(r){
  var t=0;
  (r.supplies||[]).forEach(function(s){
    if(s.name){var x=SUPPLIES.find(function(q){return q.n===s.name;});if(x)t+=x.p*(+(s.qty)||1);}
  });
  return t;
}

function updWinDimIdx(id,idx,key,val){
  var r=rooms.find(function(x){return x.id===id;});if(!r)return;
  if(!r.winDims||!r.winDims.length)r.winDims=[{l:0,w:0}];
  r.winDims[idx]=Object.assign({},r.winDims[idx]);
  r.winDims[idx][key]=+(val)||0;
  r.winLF=r.winDims.reduce(function(t,d){return t+2*((+(d.l)||0)+(+(d.w)||0));},0);
  renderRooms();recalcAll();
}
function updWinAdd(id){
  var r=rooms.find(function(x){return x.id===id;});if(!r)return;
  r.winDims=[].concat(r.winDims||[{l:0,w:0}],{l:0,w:0});
  r.winLF=r.winDims.reduce(function(t,d){return t+2*((+(d.l)||0)+(+(d.w)||0));},0);
  renderRooms();recalcAll();
}
function updWinRemove(id,idx){
  var r=rooms.find(function(x){return x.id===id;});if(!r)return;
  r.winDims=[].concat(r.winDims||[]);r.winDims.splice(idx,1);
  if(!r.winDims.length)r.winDims=[{l:0,w:0}];
  r.winLF=r.winDims.reduce(function(t,d){return t+2*((+(d.l)||0)+(+(d.w)||0));},0);
  renderRooms();recalcAll();
}

function pushDocsToProject(){
  var projectSel=sel('ci-contact-select');
  var projectId=projectSel?projectSel.value:'';
  if(!projectId){alert('Please select a project on the Cover tab first.');return;}
  if(!_session||!_session.access_token){alert('Session not ready. Please reload the estimates page.');return;}
  var token=_session.access_token;
  var btn=document.querySelector('[onclick=\\"pushDocsToProject()\\"]');
  if(btn){btn._origHtml=btn._origHtml||btn.innerHTML;btn.disabled=true;btn.textContent='Pushing…';}

  // Rooms
  var coatLabel=function(v){return v==1?'1 Coat':v==3?'Primer & 2 Coats':'2 Coats';};
  var roomsData=rooms.map(function(r){
    var surfaces=[];
    if(r.walls)surfaces.push({label:'Walls',coats:coatLabel(r.wallCoats),sqft:Math.round(calcWalls(r))});
    if(r.ceiling)surfaces.push({label:'Ceiling',coats:coatLabel(r.ceilCoats),sqft:Math.round(calcCeil(r))});
    if(r.baseboards)surfaces.push({label:'Baseboards',coats:coatLabel(r.baseCoats),lf:Math.round(r.baseLF||0)});
    if(r.crown)surfaces.push({label:'Crown',coats:coatLabel(r.crownCoats),lf:Math.round(r.crownLF||0)});
    if(r.doorFrames)surfaces.push({label:'Door Frames',coats:coatLabel(r.dfCoats),lf:Math.round(r.dfLF||0)});
    if(r.windows)surfaces.push({label:'Windows',coats:coatLabel(r.winCoats),lf:Math.round(r.winLF||0)});
    if(r.doors)surfaces.push({label:'Doors',coats:coatLabel(r.doorCoats),count:r.doorCount||0});
    var sqft=Math.max(1,Math.round(calcWalls(r)+calcCeil(r)+(((r.baseLF||0)+(r.crownLF||0)+(r.dfLF||0)+(r.winLF||0)))*0.5+(r.doors?(r.doorCount||0):0)*20));
    return {name:r.name||('Room '+r.id),surfaces:surfaces,done:false,sqft:sqft};
  }).filter(function(r){return r.surfaces.length>0;});

  // Quote HTML
  var qEl=document.getElementById('page-quote');
  var quoteHtml=qEl?qEl.outerHTML:'';

  // Contract HTML
  var totalEl=sel('q-total');
  var amount=totalEl?parseFloat((totalEl.textContent||'').replace(/[^0-9.]/g,''))||0:0;
  try{buildContract(amount,amount*0.1,amount*0.45,amount*0.45,1);}catch(e){}
  var cEl=document.getElementById('page-contract');
  var contractHtml=cEl?cEl.outerHTML:'';

  // Change order (only if filled)
  var coEl=document.getElementById('page-changeorder');
  var coItems=document.querySelectorAll('.co-item');
  var changeOrderHtml=(coItems&&coItems.length>0&&coEl)?coEl.outerHTML:'';

  var payload={rooms:roomsData,progress:0};
  if(quoteHtml)payload.quote_html=quoteHtml;
  if(contractHtml)payload.contract_html=contractHtml;
  if(changeOrderHtml)payload.change_order_html=changeOrderHtml;

  // Delegate PATCH to React parent which has a fresh session token
  window.parent.postMessage({type:'KP_PATCH_DEAL',dealId:projectId,data:payload},'*');
  if(btn){btn.textContent='\\u2713 Pushed!';setTimeout(function(){btn.innerHTML=btn._origHtml||'\\u2599 Push';btn.disabled=false;},2500);}
}

function addRoom(){
  roomCounter++;
  var newId=roomCounter;
  rooms.push({
    id:newId,name:'',length:0,width:0,height:0,prepHrs:0,
    irregular:false,
    wallSegs:[{l:0},{l:0},{l:0},{l:0},{l:0},{l:0}],
    ceilSegs:[{l:0,w:0},{l:0,w:0}],
    walls:true,wallCoats:2,ceiling:false,ceilCoats:2,
    baseboards:false,baseCoats:2,baseLF:0,crown:false,crownCoats:2,crownLF:0,
    doorFrames:false,dfCoats:2,dfLF:0,windows:false,winCoats:2,winLF:0,winDims:[{l:0,w:0}],
    doors:false,doorCoats:2,doorCount:0,
    prep:{furniture:false,plastic:false,outlets:false,drywall:false,caulking:false,cleanup:false,custom:''},
    ceilType:'flat',removeStucco:false,
    wallPaint:'',wallSheen:'',wallColour:'',ceilPaint:'',ceilSheen:'',ceilColour:'',
    trimPaint:'',trimSheen:'',trimColour:'',notes:'',supplies:[]
  });
  renderRooms(newId);
  recalcAll();
}

function removeRoom(id){rooms=rooms.filter(r=>r.id!==id);renderRooms();recalcAll();}

function renderRooms(autoOpenId){
  const c=sel('roomsContainer');
  const openIds=new Set([...document.querySelectorAll('.room-body.open')].map(el=>+el.dataset.id));
  if(autoOpenId)openIds.add(+autoOpenId);
  c.innerHTML='';
  rooms.forEach(r=>{
    const isOpen=openIds.has(r.id);
    const ws=calcWalls(r),cs=calcCeil(r);
    const badge=ws>0?fmtN(ws)+' sqft walls':'—';
    const d=document.createElement('div');d.className='room-card';
    d.innerHTML='<div class="room-head" onclick="toggleRoom('+r.id+')">'      +'<div class="room-head-left"><span class="room-arrow '+(isOpen?'open':'')+'" id="arr_'+r.id+'">&#9658;</span>'      +'<input class="room-name-input" type="text" value="'+r.name+'" placeholder="Room '+r.id+'" onclick="event.stopPropagation()" oninput="rooms.find(x=>x.id=='+r.id+').name=this.value" id="room-name-'+r.id+'"></div>'      +'<div style="display:flex;align-items:center;gap:8px"><span class="room-badge" id="badge_'+r.id+'">'+badge+'</span>'      +'<button class="room-del" onclick="event.stopPropagation();removeRoom('+r.id+')">&#215;</button></div></div>'      +'<div class="room-body '+(isOpen?'open':'')+'" data-id="'+r.id+'">'      +renderRoomBody(r)+'</div>';
    c.appendChild(d);
  });
  sel('rooms-count-badge').textContent=rooms.length+' room'+(rooms.length!==1?'s':'');
  sel('addRoomBtn').style.display='block';
  if(autoOpenId){
    var ni=sel('room-name-'+autoOpenId);
    if(ni){ni.focus();ni.select();}
  }
}

function surfRow(rid,key,en,coats,label,ck){
  return '<div class="surf-grid"><label class="surf-label"><input type="checkbox" '+(en?'checked':'')+' onchange="upd('+rid+',\\''+key+'\\',this.checked)"> '+label+'</label>'
    +'<select class="coats-sel" onchange="upd('+rid+',\\''+ck+'\\',+this.value)"><option value="1" '+(coats===1?'selected':'')+'>1 coat</option><option value="2" '+(coats===2?'selected':'')+'>2 coats</option><option value="3" '+(coats===3?'selected':'')+'>Primer &amp; 2 Coats</option></select>'
    +'<span></span><span></span></div>';
}

function surfLFRow(rid,key,en,coats,label,ck,lfVal,autoLF){
  const display=en?(autoLF>0?autoLF:lfVal||0):0;
  return '<div class="surf-grid"><label class="surf-label"><input type="checkbox" '+(en?'checked':'')+' onchange="upd('+rid+',\\''+key+'\\',this.checked)"> '+label+'</label>'
    +'<select class="coats-sel" onchange="upd('+rid+',\\''+ck+'\\',+this.value)"><option value="1" '+(coats===1?'selected':'')+'>1 coat</option><option value="2" '+(coats===2?'selected':'')+'>2 coats</option><option value="3" '+(coats===3?'selected':'')+'>Primer &amp; 2 Coats</option></select>'
    +'<span style="font-size:11px;color:var(--ink3);padding:5px 8px;background:var(--cream2);border-radius:var(--r)">'+(en&&display?fmtN(display)+' lf':'\\u2014')+'</span><span></span></div>';
}


function colourChips(r){
  const chips=[];
  if(r.wallColour){const c=COLOURS.find(x=>x.n===r.wallColour);chips.push('<span class="colour-chip"><span class="chip-dot" style="background:'+(c?c.h:'#ccc')+'"></span>Wall: '+r.wallColour+(r.wallSheen?' \\u00b7 '+r.wallSheen:'')+'</span>');}
  if(r.ceilColour){const c=COLOURS.find(x=>x.n===r.ceilColour);chips.push('<span class="colour-chip"><span class="chip-dot" style="background:'+(c?c.h:'#ccc')+'"></span>Ceil: '+r.ceilColour+(r.ceilSheen?' \\u00b7 '+r.ceilSheen:'')+'</span>');}
  if(r.trimColour){const c=COLOURS.find(x=>x.n===r.trimColour);chips.push('<span class="colour-chip"><span class="chip-dot" style="background:'+(c?c.h:'#ccc')+'"></span>Trim: '+r.trimColour+(r.trimSheen?' \\u00b7 '+r.trimSheen:'')+'</span>');}
  return chips.length?'<div class="paint-chips">'+chips.join('')+'</div>':'';
}

function renderRoomBody(r){
  var perim=2*(r.length+r.width);
  var segs=r.wallSegs||[{l:0},{l:0},{l:0},{l:0},{l:0},{l:0}];
  var csegs=r.ceilSegs||[{l:0,w:0},{l:0,w:0}];
  var irrWallSqft=segs.reduce(function(s,seg){return s+(+(seg.l)||0)*(r.height||9);},0);
  var irrCeilSqft=csegs.reduce(function(s,seg){return s+(+(seg.l)||0)*(+(seg.w)||0);},0);

  function coatsSel(key,val){
    return '<select class="coats-sel" onchange="upd('+r.id+',\\''+key+'\\',+this.value)">'
      +'<option value="1"'+(val===1?' selected':'')+'>1 Coat</option>'
      +'<option value="2"'+(val===2?' selected':'')+'>2 Coats</option>'
      +'<option value="3"'+(val===3?' selected':'')+'>Primer &amp; 2 Coats</option>'
      +'</select>';
  }

  function sfRow(key,en,coatsKey,label){
    return '<div class="surf-grid">'
      +'<label class="surf-label"><input type="checkbox" '+(en?'checked':'')+' onchange="upd('+r.id+',\\''+key+'\\',this.checked)"> '+label+'</label>'
      +coatsSel(coatsKey,r[coatsKey])
      +'<span></span><span></span></div>';
  }

  function trimRow(key,en,coatsKey,label){
    return '<div class="surf-grid">'
      +'<label class="surf-label"><input type="checkbox" '+(en?'checked':'')+' onchange="upd('+r.id+',\\''+key+'\\',this.checked)"> '+label+'</label>'
      +coatsSel(coatsKey,r[coatsKey])
      +'<span></span><span></span></div>';
  }

  var irregHtml='';
  if(r.irregular){
    var segInputs=segs.map(function(seg,i){
      return '<div class="field" style="margin:0"><label>Seg '+(i+1)+' length (ft)</label>'
        +'<input type="number" min="0" step="0.5" value="'+(seg.l||'')+'" placeholder="0" oninput="updSeg('+r.id+','+i+',this.value)"></div>';
    }).join('');
    irregHtml=
      '<div style="background:var(--cream2);border-radius:var(--r);padding:10px 12px;margin-bottom:12px">'
      +'<div style="font-size:11px;font-weight:600;color:var(--ink3);text-transform:uppercase;letter-spacing:.06em;margin-bottom:8px">Wall Segments — each length \\u00d7 height = sqft</div>'
      +'<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:6px">'+segInputs+'</div>'
      +'<div style="font-size:12px;color:var(--gold2);font-weight:600">Wall area: '+fmtN(irrWallSqft)+' sqft</div>'
      +'</div>'
      +'<div style="background:var(--cream2);border-radius:var(--r);padding:10px 12px;margin-bottom:12px">'
      +'<div style="font-size:11px;font-weight:600;color:var(--ink3);text-transform:uppercase;letter-spacing:.06em;margin-bottom:8px">Ceiling Sections \\u2014 two rectangles added together</div>'
      +'<div style="display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:8px;margin-bottom:6px">'
      +'<div class="field" style="margin:0"><label>Sec 1 Length</label><input type="number" min="0" step="0.5" value="'+(csegs[0].l||'')+'" placeholder="0" oninput="updCeilSeg('+r.id+',0,\\'l\\',this.value)"></div>'
      +'<div class="field" style="margin:0"><label>Sec 1 Width</label><input type="number" min="0" step="0.5" value="'+(csegs[0].w||'')+'" placeholder="0" oninput="updCeilSeg('+r.id+',0,\\'w\\',this.value)"></div>'
      +'<div class="field" style="margin:0"><label>Sec 2 Length</label><input type="number" min="0" step="0.5" value="'+(csegs[1].l||'')+'" placeholder="0" oninput="updCeilSeg('+r.id+',1,\\'l\\',this.value)"></div>'
      +'<div class="field" style="margin:0"><label>Sec 2 Width</label><input type="number" min="0" step="0.5" value="'+(csegs[1].w||'')+'" placeholder="0" oninput="updCeilSeg('+r.id+',1,\\'w\\',this.value)"></div>'
      +'</div>'
      +'<div style="font-size:12px;color:var(--gold2);font-weight:600">Ceiling area: '+fmtN(irrCeilSqft)+' sqft</div>'
      +'</div>';
  }

  return '<div style="padding-top:14px">'
    +'<div class="card-title">Dimensions</div>'
    +'<div class="grid4" style="margin-bottom:8px">'
    +'<div class="field"><label>Length (ft)</label><input type="number" min="0" step="0.5" value="'+(r.length||'')+'" placeholder="0" oninput="upd('+r.id+',\\'length\\',+this.value)"></div>'
    +'<div class="field"><label>Width (ft)</label><input type="number" min="0" step="0.5" value="'+(r.width||'')+'" placeholder="0" oninput="upd('+r.id+',\\'width\\',+this.value)"></div>'
    +'<div class="field"><label>Height (ft)</label><input type="number" min="0" step="0.5" value="'+(r.height||'')+'" placeholder="0" oninput="upd('+r.id+',\\'height\\',+this.value)"></div>'
    +'<div class="field"><label>Prep hours</label><input type="number" min="0" step="0.5" value="'+(r.prepHrs||'')+'" oninput="upd('+r.id+',\\'prepHrs\\',+this.value)" placeholder="0"></div>'
    +'<div class="field"><label>Doors</label><input type="number" min="0" step="1" value="'+(r.doorCount||'')+'" placeholder="0" oninput="upd('+r.id+',\\'doorCount\\',+this.value)"></div>'
    +'</div>'
    +'<div style="display:flex;align-items:center;gap:8px;margin-bottom:10px">'
    +'<input type="checkbox" id="irreg_'+r.id+'" '+(r.irregular?'checked':'')+' onchange="upd('+r.id+',\\'irregular\\',this.checked);" style="accent-color:var(--gold);width:14px;height:14px">'
    +'<label for="irreg_'+r.id+'" style="font-size:12px;font-weight:600;color:var(--ink2);cursor:pointer">Irregular Room</label>'
    +'</div>'
    +irregHtml
    +'<div class="card-title">Prep</div>'
    +'<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:6px;margin-bottom:12px">'
    +['furniture','plastic','outlets','drywall','caulking','cleanup'].map(function(k){return '<label style="display:flex;align-items:center;gap:6px;font-size:12px;color:var(--ink2);background:var(--cream2);padding:6px 10px;border-radius:var(--r);cursor:pointer"><input type="checkbox" '+(r.prep[k]?'checked':'')+' onchange="updPrep('+r.id+',\\''+k+'\\',this.checked)" style="accent-color:var(--gold);width:13px;height:13px"> '+{furniture:'Move furniture',plastic:'Plastic cover',outlets:'Remove outlets',drywall:'Drywall repairs',caulking:'Caulking',cleanup:'Clean up'}[k]+'</label>';}).join('')
    +'</div>'
    +'<div class="field" style="margin-bottom:12px"><label>Additional prep notes</label><input type="text" value="'+(r.prep.custom||'')+'" placeholder="Type any additional prep..." oninput="updPrep('+r.id+',\\'custom\\',this.value)"></div>'
    +'<div class="card-title">Surfaces</div>'
    +sfRow('walls',r.walls,'wallCoats','Walls')
    +sfRow('ceiling',r.ceiling,'ceilCoats','Ceiling')
+(r.ceiling?(
  '<div style="background:var(--cream2);border-radius:var(--r);padding:10px 12px;margin:4px 0 8px 24px">'
  +'<div style="font-size:11px;font-weight:600;color:var(--ink3);text-transform:uppercase;letter-spacing:.06em;margin-bottom:8px">Ceiling Type</div>'
  +'<div style="display:flex;gap:16px;margin-bottom:8px">'
  +'<label style="display:flex;align-items:center;gap:6px;font-size:12px;cursor:pointer">'
  +'<input type="radio" name="ctype_'+r.id+'" value="flat" '+((!r.ceilType||r.ceilType==="flat")?'checked':'')+' onchange="upd('+r.id+',\\'ceilType\\',\\'flat\\')"> Flat / Drywall</label>'
  +'<label style="display:flex;align-items:center;gap:6px;font-size:12px;cursor:pointer">'
  +'<input type="radio" name="ctype_'+r.id+'" value="stucco" '+(r.ceilType==="stucco"?'checked':'')+' onchange="upd('+r.id+',\\'ceilType\\',\\'stucco\\')"> Stucco</label>'
  +'</div>'
  +'<label style="display:flex;align-items:center;gap:6px;font-size:12px;cursor:pointer;background:var(--cream);padding:6px 10px;border-radius:var(--r)">'
  +'<input type="checkbox" '+(r.removeStucco?'checked':'')+' onchange="upd('+r.id+',\\'removeStucco\\',this.checked)" style="accent-color:var(--gold)">'
  +' Remove stucco ($'+((STANDARDS.removeStucco.rate||0.75))+'/sqft)</label>'
  +'</div>'
):'')
    +trimRow('baseboards',r.baseboards,'baseCoats','Baseboards')
    +trimRow('crown',r.crown,'crownCoats','Crown Moulding')
    +'<div class="surf-grid"><label class="surf-label"><input type="checkbox" '+(r.doors?'checked':'')+' onchange="upd('+r.id+',\\'doors\\',this.checked)"> Doors</label>'
    +coatsSel('doorCoats',r.doorCoats)
    +'<span></span><span></span></div>'
    +trimRow('doorFrames',r.doorFrames,'dfCoats','Door Frames')
    +trimRow('windows',r.windows,'winCoats','Windows')
    +(r.windows?(function(){
      var wDims=r.winDims&&r.winDims.length?r.winDims:[{l:0,w:0}];
      var totalLF=wDims.reduce(function(t,d){return t+2*((+(d.l)||0)+(+(d.w)||0));},0);
      var winRows=wDims.map(function(d,i){
        var lf=2*((+(d.l)||0)+(+(d.w)||0));
        return '<div style="display:grid;grid-template-columns:1fr 1fr auto auto;gap:8px;align-items:end;margin-bottom:8px">'
          +'<div class="field" style="margin:0"><label>Window '+(i+1)+' Length (ft)</label>'
          +'<input type="number" min="0" step="0.5" value="'+(+(d.l)||'')+'" placeholder="0" oninput="updWinDimIdx('+r.id+','+i+',\\'l\\',this.value)"></div>'
          +'<div class="field" style="margin:0"><label>Window '+(i+1)+' Width (ft)</label>'
          +'<input type="number" min="0" step="0.5" value="'+(+(d.w)||'')+'" placeholder="0" oninput="updWinDimIdx('+r.id+','+i+',\\'w\\',this.value)"></div>'
          +'<div style="padding:8px 10px;background:var(--cream);border-radius:var(--r);text-align:center;min-width:56px">'
          +'<div style="font-size:9px;font-weight:600;color:var(--ink4);text-transform:uppercase">LF</div>'
          +'<div style="font-size:13px;font-weight:700;color:var(--gold2)">'+fmtN(lf)+'</div></div>'
          +(wDims.length>1?'<button onclick="updWinRemove('+r.id+','+i+')" style="background:none;border:none;cursor:pointer;color:var(--ink4);font-size:16px;padding:4px">&times;</button>':'<span></span>')
          +'</div>';
      }).join('');
      return '<div style="background:var(--cream2);border-radius:var(--r);padding:10px 12px;margin:4px 0 8px 24px">'
        +'<div style="font-size:11px;font-weight:600;color:var(--ink3);text-transform:uppercase;letter-spacing:.06em;margin-bottom:8px">Window Dimensions — LF = (L+W)×2 per window</div>'
        +winRows
        +'<button onclick="updWinAdd('+r.id+')" style="font-size:12px;padding:5px 12px;border:1px dashed var(--ink4);border-radius:var(--r);background:transparent;color:var(--ink3);cursor:pointer;margin-top:4px;font-family:var(--sans)">+ Add window</button>'
        +'<div style="font-size:12px;color:var(--gold2);font-weight:600;margin-top:8px">Total: '+fmtN(totalLF)+' lf</div>'
        +'</div>';
    }()):'')
    +'<hr class="divider">'
    +'<div class="card-title">Paint &amp; Colours</div>'
    +'<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-bottom:4px">'
    +'<div class="field"><label>Wall paint</label><select onchange="upd('+r.id+',\\'wallPaint\\',this.value)">'+paintOpts(r.wallPaint)+'</select></div>'
    +'<div class="field"><label>Wall colour</label><select onchange="upd('+r.id+',\\'wallColour\\',this.value)"><option value="">\\u2014 Colour \\u2014</option>'+colourOpts(r.wallColour)+'</select></div>'
    +'<div class="field"><label>Wall sheen</label><select onchange="upd('+r.id+',\\'wallSheen\\',this.value)"><option value="">\\u2014 Sheen \\u2014</option>'+sheenOpts(r.wallSheen)+'</select></div>'
    +'</div>'
    +(r.wallCoats==3?'<div class="field" style="margin-bottom:8px"><label style="color:var(--gold2);font-weight:600">Wall primer</label><select onchange="upd('+r.id+',\\'wallsPrimer\\',this.value)">'+primerOpts(r.wallsPrimer)+'</select></div>':'')
    +'<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-bottom:4px">'
    +'<div class="field"><label>Ceiling paint</label><select onchange="upd('+r.id+',\\'ceilPaint\\',this.value)">'+ceilPaintOpts(r.ceilPaint)+'</select></div>'
    +'<div class="field"><label>Ceiling colour</label><select onchange="upd('+r.id+',\\'ceilColour\\',this.value)"><option value="">\\u2014 Colour \\u2014</option>'+colourOpts(r.ceilColour)+'</select></div>'
    +'<div class="field"><label>Ceiling sheen</label><select onchange="upd('+r.id+',\\'ceilSheen\\',this.value)"><option value="">\\u2014 Sheen \\u2014</option>'+sheenOpts(r.ceilSheen)+'</select></div>'
    +'</div>'
    +(r.ceilCoats==3?'<div class="field" style="margin-bottom:8px"><label style="color:var(--gold2);font-weight:600">Ceiling primer</label><select onchange="upd('+r.id+',\\'ceilingPrimer\\',this.value)">'+primerOpts(r.ceilingPrimer)+'</select></div>':'')
    +'<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-bottom:4px">'
    +'<div class="field"><label>Trim paint</label><select onchange="upd('+r.id+',\\'trimPaint\\',this.value)">'+paintOpts(r.trimPaint)+'</select></div>'
    +'<div class="field"><label>Trim colour</label><select onchange="upd('+r.id+',\\'trimColour\\',this.value)"><option value="">\\u2014 Colour \\u2014</option>'+colourOpts(r.trimColour)+'</select></div>'
    +'<div class="field"><label>Trim sheen</label><select onchange="upd('+r.id+',\\'trimSheen\\',this.value)"><option value="">\\u2014 Sheen \\u2014</option>'+sheenOpts(r.trimSheen)+'</select></div>'
    +'</div>'
    +((r.baseCoats==3||r.crownCoats==3||r.doorCoats==3||r.dfCoats==3||r.winCoats==3)?'<div class="field" style="margin-bottom:8px"><label style="color:var(--gold2);font-weight:600">Trim primer</label><select onchange="upd('+r.id+',\\'trimPrimer\\',this.value)">'+primerOpts(r.trimPrimer)+'</select></div>':'')
    +colourChips(r)
    +(function(){
      var sups=r.supplies||[];
      var rows='';
      sups.forEach(function(item,i){
        var selOpts=SUPPLIES.map(function(sup){return '<option value="'+sup.n+'"'+(item.name===sup.n?' selected':'')+'>'+sup.n+' ($'+sup.p.toFixed(2)+')</option>';}).join('');
        rows+='<div style="display:grid;grid-template-columns:1fr 60px 28px;gap:6px;align-items:center;margin-bottom:6px">'
          +'<select style="font-size:12px;padding:5px 8px;border:1px solid var(--cream3);border-radius:var(--r);background:var(--cream);color:var(--ink)" onchange="(function(v){var r2=rooms.find(function(x){return x.id=='+r.id+';});if(!r2)return;var a=[].concat(r2.supplies||[]);a['+i+']={name:v,qty:a['+i+']?a['+i+'].qty:1};r2.supplies=a;renderRooms();recalcAll();})(this.value)"><option value="">\\u2014 Select supply \\u2014</option>'+selOpts+'</select>'
          +'<input type="number" min="1" step="1" value="'+(item.qty||1)+'" style="font-size:12px;padding:5px 6px;border:1px solid var(--cream3);border-radius:var(--r);background:var(--cream);text-align:center" oninput="(function(v){var r2=rooms.find(function(x){return x.id=='+r.id+';});if(!r2)return;var a=[].concat(r2.supplies||[]);a['+i+']={name:a['+i+'].name,qty:+v||1};r2.supplies=a;recalcAll();})(this.value)">'  
          +'<button style="background:none;border:none;cursor:pointer;color:var(--ink4);font-size:14px" onclick="(function(){var r2=rooms.find(function(x){return x.id=='+r.id+';});if(!r2)return;var a=[].concat(r2.supplies||[]);a.splice('+i+',1);r2.supplies=a;renderRooms();recalcAll();})()">&times;</button>'
          +'</div>';
      });
      var addBtn='<button style="font-size:12px;padding:6px 14px;border:1px dashed var(--ink4);border-radius:var(--r);background:transparent;color:var(--ink3);cursor:pointer;width:100%;margin-bottom:8px;font-family:var(--sans)" onclick="(function(){var r2=rooms.find(function(x){return x.id=='+r.id+';});if(!r2)return;r2.supplies=[].concat(r2.supplies||[],{name:\\'\\',qty:1});renderRooms();recalcAll();})();">+ Add supply</button>';
      return '<div class="card-title">Supplies</div>'+rows+addBtn;
    }())
    +'<div class="field" style="margin-top:10px"><label>Notes</label><textarea oninput="upd('+r.id+',\\'notes\\',this.value)">'+(r.notes||'')+'</textarea></div>'
    +'</div>';
}


// ─── CHANGE ORDER ────────────────────────────────
function addChangeItem(){
  changeCounter++;changeItems.push({id:changeCounter,desc:'',amount:0});renderChangeItems();
}
function renderChangeItems(){
  const c=sel('co-items');if(!c)return;c.innerHTML='';
  changeItems.forEach(item=>{
    const d=document.createElement('div');d.className='change-item';
    d.innerHTML='<input type="text" value="'+(item.num||'')+'" placeholder="Item #" style="font-size:13px;padding:7px 9px;border:1px solid var(--cream3);border-radius:var(--r);background:var(--cream);color:var(--ink);width:100%" oninput="changeItems.find(x=>x.id=='+item.id+').num=this.value">'
      +'<input type="text" value="'+item.desc+'" placeholder="Description" style="font-size:13px;padding:7px 9px;border:1px solid var(--cream3);border-radius:var(--r);background:var(--cream);color:var(--ink)" oninput="changeItems.find(x=>x.id=='+item.id+').desc=this.value">'
      +'<input type="number" value="'+(item.amount||'')+'" placeholder="0.00" style="font-size:13px;padding:7px 9px;border:1px solid var(--cream3);border-radius:var(--r);background:var(--cream);text-align:right;width:100%" oninput="changeItems.find(x=>x.id=='+item.id+').amount=+this.value;recalcCO()">';
    c.appendChild(d);
  });
}
function recalcCO(){
  const sub=changeItems.reduce((s,i)=>s+(+i.amount||0),0);
  const tax=sub*0.13;
  if(sel('co-sub'))sel('co-sub').textContent=fmt(sub);
  if(sel('co-tax'))sel('co-tax').textContent=fmt(tax);
  if(sel('co-total'))sel('co-total').textContent=fmt(sub+tax);
}

// ─── POST PROJECT ────────────────────────────────
function recalcPost(){
  const cost=+(sel('pp-cost')&&sel('pp-cost').textContent.replace(/[^0-9.]/g,'')||0);
  const actual=+v('pp-actual')||0;
  const est=+v('pp-est')||0;
  const mats=+v('pp-materials')||0;
  const wages=+v('pp-wages')||0;
  const gross=cost-mats-wages;
  const delta=actual-est;
  if(sel('pp-gross'))sel('pp-gross').textContent=fmt(gross);
  if(sel('pp-eff'))sel('pp-eff').textContent=est>0?((est/Math.max(actual,.01))*100).toFixed(0)+'%':'—';
  if(sel('pp-delta'))sel('pp-delta').textContent=delta===0?'On target':delta>0?'+'+delta.toFixed(1)+' hrs over':Math.abs(delta).toFixed(1)+' hrs under';
  if(sel('pp-margin'))sel('pp-margin').textContent=cost>0?(gross/cost*100).toFixed(1)+'%':'—';
}

// ─── LABOUR RATES ────────────────────────────────
function recalcRates(){
  const billable=+v('lr-billable')||1700;
  const buf=+v('lr-buffer')||1.25;
  const taxes=sel('lr-taxes')&&sel('lr-taxes').checked;
  const numWorkers=workers.filter(w=>w.active).length||1;
  const totalOH=overheadItems.reduce((s,i)=>s+(i.v||0),0);
  const ohPerHr=totalOH/(numWorkers*billable);
  const avgWage=workers.filter(w=>w.active).reduce((s,w)=>s+w.r,0)/Math.max(1,workers.filter(w=>w.active).length);
  const fieldWage=taxes?avgWage*1.3:avgWage;
  const profitTarget=+v('lr-profit-target')||0;
  const profit=profitTarget/(numWorkers*billable);
  const totalHr=ohPerHr+fieldWage+profit;
  globalRate=totalHr;
  if(sel('lr-oh-hr'))sel('lr-oh-hr').textContent='$'+ohPerHr.toFixed(2);
  if(sel('lr-wage'))sel('lr-wage').textContent='$'+fieldWage.toFixed(2)+'/hr';
  if(sel('lr-profit'))sel('lr-profit').textContent='$'+profit.toFixed(2)+'/hr';
  if(sel('lr-total-hr'))sel('lr-total-hr').textContent='$'+profit.toFixed(2)+'/hr';
  const total=totalHr*numWorkers;
  if(sel('lr-total-all'))sel('lr-total-all').textContent='$'+total.toFixed(2)+'/hr';
  if(sel('lr-oh-sum'))sel('lr-oh-sum').textContent=fmt(totalOH);
  if(sel('lr-active-count'))sel('lr-active-count').textContent=numWorkers;
  if(sel('lr-total-all-workers'))sel('lr-total-all-workers').textContent='$'+fieldWage.toFixed(2);
  recalcAll();
}

function initLabourRates(){
  const ohC=sel('lr-overhead-fields');
  if(ohC){
    let h='';
    overheadItems.forEach((item,i)=>{
      h+='<div style="display:grid;grid-template-columns:1fr 90px 28px;align-items:center;gap:6px;padding:4px 0;border-bottom:1px solid var(--cream2)">'
        +'<input type="text" value="'+item.n+'" oninput="overheadItems['+i+'].n=this.value;schedulePaintSave()" style="font-size:12px;padding:4px 8px;border:1px solid var(--cream3);border-radius:var(--r);background:var(--cream);color:var(--ink);width:100%">'
        +'<input type="number" value="'+item.v+'" min="0" oninput="overheadItems['+i+'].v=+this.value;recalcRates();schedulePaintSave()" style="font-size:12px;padding:4px 8px;border:1px solid var(--cream3);border-radius:var(--r);background:var(--cream);text-align:right;width:100%">'
        +'<button onclick="overheadItems.splice('+i+',1);initLabourRates();schedulePaintSave()" style="background:none;border:none;cursor:pointer;color:var(--ink4);font-size:14px">&#215;</button>'
        +'</div>';
    });
    h+='<button onclick="overheadItems.push({n:\\'New item\\',v:0});initLabourRates();schedulePaintSave()" style="margin-top:8px;width:100%;padding:7px;border:1px dashed var(--ink4);border-radius:var(--r);background:transparent;color:var(--ink3);font-size:12px;cursor:pointer;font-family:var(--sans)">+ Add item</button>';
    ohC.innerHTML=h;
  }
  const wC=sel('lr-workers');
  if(wC){
    let h='<div class="workers-row">';
    workers.forEach((w,i)=>{
      h+='<div class="worker-tag" style="position:relative;padding-right:28px">'
        +'<input type="checkbox" '+(w.active?'checked':'')+' onchange="workers['+i+'].active=this.checked;recalcRates()">'
        +'<input type="text" value="'+w.n+'" oninput="workers['+i+'].n=this.value;schedulePaintSave()" style="width:72px;font-size:12px;padding:4px 6px;border:1px solid var(--cream3);border-radius:var(--r);background:var(--cream);color:var(--ink)">'
        +'<span style="font-size:11px;color:var(--ink3)">$</span>'
        +'<input type="number" value="'+w.r+'" min="0" oninput="workers['+i+'].r=+this.value;recalcRates();schedulePaintSave()" style="width:52px;font-size:12px;padding:4px 6px;border:1px solid var(--cream3);border-radius:var(--r);background:var(--cream);text-align:right">'
        +'<span style="font-size:10px;color:var(--ink3)">/hr</span>'
        +'<button onclick="workers.splice('+i+',1);initLabourRates();schedulePaintSave()" style="position:absolute;top:4px;right:4px;background:none;border:none;cursor:pointer;color:var(--ink4);font-size:13px">&#215;</button>'
        +'</div>';
    });
    h+='</div><button onclick="workers.push({n:\\'Worker\\',r:25,active:true});initLabourRates();schedulePaintSave()" style="margin-top:10px;width:100%;padding:7px;border:1px dashed var(--ink4);border-radius:var(--r);background:transparent;color:var(--ink3);font-size:12px;cursor:pointer;font-family:var(--sans)">+ Add worker</button>';
    wC.innerHTML=h;
  }
  recalcRates();
}

// ─── PAINT INPUTS ────────────────────────────────
function renderPIList(containerId,dataArr,onName,onPrice,onDel,onAdd,addLabel){
  const c=sel(containerId);if(!c)return;
  let rows='';
  var dragHandle='<td style="padding:4px 2px;width:20px;cursor:grab" class="pi-drag-handle" draggable="true" title="Drag to reorder">'+
    '<svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round">'+
    '<line x1="3" y1="5" x2="13" y2="5"/><line x1="3" y1="8" x2="13" y2="8"/><line x1="3" y1="11" x2="13" y2="11"/></svg></td>';
  dataArr.forEach(function(item,i){
    rows+='<tr draggable="false" data-idx="'+i+'">'+dragHandle+
      '<td style="padding:4px 6px"><input type="text" value="'+(item.n||'')+'" oninput="'+onName(i)+'" style="font-size:12px;padding:5px 8px;border:1px solid var(--cream3);border-radius:var(--r);background:var(--cream);color:var(--ink);width:100%"></td>'+
      (onPrice?'<td style="padding:4px 6px;width:80px"><input type="number" min="0" step="0.01" value="'+(item.p||'')+'" oninput="'+onPrice(i)+'" style="font-size:12px;padding:5px 8px;border:1px solid var(--cream3);border-radius:var(--r);background:var(--cream);text-align:right;width:100%"></td>':'')+
      '<td style="padding:4px 6px;width:32px"><button onclick="'+onDel(i)+'" style="background:none;border:none;cursor:pointer;color:var(--ink4);font-size:15px">&#215;</button></td></tr>';
  });
  var colSpan=(onPrice?4:3);
  var addRow='<tr><td colspan="'+colSpan+'" style="padding:8px 6px 4px"><button onclick="'+onAdd+'" style="width:100%;padding:7px;border:1px dashed var(--ink4);border-radius:var(--r);background:transparent;color:var(--ink3);font-size:12px;cursor:pointer;font-family:var(--sans)">+ '+addLabel+'</button></td></tr>';
  var priceHeader=onPrice?'<th style="width:80px;text-align:right">Price</th>':'';
  c.innerHTML='<table class="doc-table" style="width:100%"><thead><tr><th style="width:20px"></th><th>Name</th>'+priceHeader+'<th style="width:32px"></th></tr></thead><tbody>'+rows+addRow+'</tbody></table>';

  // Attach drag-and-drop to the handle cells
  var tbody=c.querySelector('tbody');
  var dragSrcIdx=null;
  c.querySelectorAll('.pi-drag-handle').forEach(function(handle){
    handle.addEventListener('dragstart',function(ev){
      dragSrcIdx=parseInt(handle.parentElement.getAttribute('data-idx'));
      handle.parentElement.style.opacity='0.4';
      ev.dataTransfer.effectAllowed='move';
    });
    handle.addEventListener('dragend',function(){
      handle.parentElement.style.opacity='';
      c.querySelectorAll('tr[data-idx]').forEach(function(r){r.style.borderTop='';});
    });
    handle.parentElement.addEventListener('dragover',function(ev){
      ev.preventDefault();
      ev.dataTransfer.dropEffect='move';
      handle.parentElement.style.borderTop='2px solid var(--gold)';
    });
    handle.parentElement.addEventListener('dragleave',function(){
      handle.parentElement.style.borderTop='';
    });
    handle.parentElement.addEventListener('drop',function(ev){
      ev.preventDefault();
      handle.parentElement.style.borderTop='';
      var targetIdx=parseInt(handle.parentElement.getAttribute('data-idx'));
      if(dragSrcIdx===null||dragSrcIdx===targetIdx)return;
      var moved=dataArr.splice(dragSrcIdx,1)[0];
      dataArr.splice(targetIdx,0,moved);
      // Re-render
      renderPIList(containerId,dataArr,onName,onPrice,onDel,onAdd,addLabel);
      if(containerId==='pi-paints-container'||containerId==='pi-colours-container')renderRooms();
    });
  });
}
function renderColoursList(){
  var c=sel('pi-colours-container');if(!c)return;
  var rows='';
  var dragHandle='<td style="padding:4px 2px;width:20px;cursor:grab" class="pi-drag-handle" draggable="true" title="Drag to reorder">'
    +'<svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round">'
    +'<line x1="3" y1="5" x2="13" y2="5"/><line x1="3" y1="8" x2="13" y2="8"/><line x1="3" y1="11" x2="13" y2="11"/></svg></td>';
  COLOURS.forEach(function(item,i){
    var hex=item.h||'#cccccc';
    rows+='<tr draggable="false" data-idx="'+i+'">'+dragHandle
      +'<td style="padding:4px 6px;width:36px">'
      +'<input type="color" value="'+hex+'" oninput="COLOURS['+i+'].h=this.value;renderColoursList();renderRooms();schedulePaintSave()" '
      +'style="width:30px;height:28px;padding:2px;border:1px solid var(--cream3);border-radius:var(--r);cursor:pointer;background:var(--cream)">'
      +'</td>'
      +'<td style="padding:4px 6px"><input type="text" value="'+(item.n||'')+'" oninput="COLOURS['+i+'].n=this.value;schedulePaintSave()" '
      +'style="font-size:12px;padding:5px 8px;border:1px solid var(--cream3);border-radius:var(--r);background:var(--cream);color:var(--ink);width:100%"></td>'
      +'<td style="padding:4px 6px;width:32px"><button onclick="COLOURS.splice('+i+',1);renderColoursList();renderRooms();schedulePaintSave()" '
      +'style="background:none;border:none;cursor:pointer;color:var(--ink4);font-size:15px">&#215;</button></td>'
      +'</tr>';
  });
  var addRow='<tr><td colspan="4" style="padding:8px 6px 4px"><button onclick="COLOURS.push({n:\\'\\',h:\\'#cccccc\\'});renderColoursList();schedulePaintSave()" '
    +'style="width:100%;padding:7px;border:1px dashed var(--ink4);border-radius:var(--r);background:transparent;color:var(--ink3);font-size:12px;cursor:pointer;font-family:var(--sans)">+ Add colour</button></td></tr>';
  c.innerHTML='<table class="doc-table" style="width:100%"><thead><tr><th style="width:20px"></th><th style="width:36px">Swatch</th><th>Name</th><th style="width:32px"></th></tr></thead><tbody>'+rows+addRow+'</tbody></table>';

  // Drag-and-drop
  var dragSrcIdx=null;
  c.querySelectorAll('.pi-drag-handle').forEach(function(handle){
    handle.addEventListener('dragstart',function(ev){
      dragSrcIdx=parseInt(handle.parentElement.getAttribute('data-idx'));
      handle.parentElement.style.opacity='0.4';
      ev.dataTransfer.effectAllowed='move';
    });
    handle.addEventListener('dragend',function(){
      handle.parentElement.style.opacity='';
      c.querySelectorAll('tr[data-idx]').forEach(function(r){r.style.borderTop='';});
    });
    handle.parentElement.addEventListener('dragover',function(ev){ev.preventDefault();handle.parentElement.style.borderTop='2px solid var(--gold)';});
    handle.parentElement.addEventListener('dragleave',function(){handle.parentElement.style.borderTop='';});
    handle.parentElement.addEventListener('drop',function(ev){
      ev.preventDefault();handle.parentElement.style.borderTop='';
      var targetIdx=parseInt(handle.parentElement.getAttribute('data-idx'));
      if(dragSrcIdx===null||dragSrcIdx===targetIdx)return;
      var moved=COLOURS.splice(dragSrcIdx,1)[0];
      COLOURS.splice(targetIdx,0,moved);
      renderColoursList();renderRooms();schedulePaintSave();
    });
  });
}
var _piSaveTimer=null;
function schedulePaintSave(){clearTimeout(_piSaveTimer);_piSaveTimer=setTimeout(upsertPaintSettings,1200);}
function initPaintInputs(){
  // Paints: 2-price-column render with drag sort
  (function(){
    var c=sel('pi-paints-container');if(!c)return;
    var h='<table style="width:100%;border-collapse:collapse"><thead><tr>'
      +'<th style="width:24px"></th>'
      +'<th style="text-align:left;font-size:11px;color:var(--ink3);padding:4px 8px;font-weight:600">Product</th>'
      +'<th style="text-align:right;font-size:11px;color:var(--ink3);padding:4px 8px;font-weight:600">Gallon $</th>'
      +'<th style="text-align:right;font-size:11px;color:var(--ink3);padding:4px 8px;font-weight:600">Pail $</th>'
      +'<th style="width:28px"></th></tr></thead><tbody>';
    PAINTS.forEach(function(item,i){
      h+='<tr style="border-bottom:1px solid var(--cream2)">'
        +'<td style="padding:4px 2px;width:24px;cursor:grab" draggable="true" class="pa-drag" data-idx="'+i+'">'
        +'<svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><line x1="3" y1="5" x2="13" y2="5"/><line x1="3" y1="8" x2="13" y2="8"/><line x1="3" y1="11" x2="13" y2="11"/></svg></td>'
        +'<td style="padding:4px 6px"><input type="text" value="'+(item.n||'')+'" oninput="PAINTS['+i+'].n=this.value;renderRooms();schedulePaintSave()" style="font-size:12px;padding:4px 8px;border:1px solid var(--cream3);border-radius:var(--r);background:var(--cream);color:var(--ink);width:100%"></td>'
        +'<td style="padding:4px 6px;width:80px"><input type="number" min="0" step="0.01" value="'+(item.g||0)+'" oninput="PAINTS['+i+'].g=+this.value;schedulePaintSave()" style="font-size:12px;padding:4px 8px;border:1px solid var(--cream3);border-radius:var(--r);background:var(--cream);text-align:right;width:100%"></td>'
        +'<td style="padding:4px 6px;width:80px"><input type="number" min="0" step="0.01" value="'+(item.p||0)+'" oninput="PAINTS['+i+'].p=+this.value;schedulePaintSave()" style="font-size:12px;padding:4px 8px;border:1px solid var(--cream3);border-radius:var(--r);background:var(--cream);text-align:right;width:100%"></td>'
        +'<td style="padding:4px 6px"><button onclick="PAINTS.splice('+i+',1);initPaintInputs();schedulePaintSave()" style="background:none;border:none;cursor:pointer;color:var(--ink4);font-size:14px">&times;</button></td>'
        +'</tr>';
    });
    h+='</tbody></table>'
      +'<button onclick="PAINTS.push({n:\\'\\',g:0,p:0});initPaintInputs();schedulePaintSave()" style="margin-top:8px;width:100%;padding:7px;border:1px dashed var(--ink4);border-radius:var(--r);background:transparent;color:var(--ink3);font-size:12px;cursor:pointer;font-family:var(--sans)">+ Add paint</button>';
    c.innerHTML=h;
    // Drag-to-reorder
    var dragIdx=null;
    c.querySelectorAll('.pa-drag').forEach(function(handle){
      handle.addEventListener('dragstart',function(ev){dragIdx=parseInt(handle.dataset.idx);handle.parentElement.style.opacity='0.4';ev.dataTransfer.effectAllowed='move';});
      handle.addEventListener('dragend',function(){handle.parentElement.style.opacity='';});
      handle.parentElement.addEventListener('dragover',function(ev){ev.preventDefault();handle.parentElement.style.borderTop='2px solid var(--gold)';});
      handle.parentElement.addEventListener('dragleave',function(){handle.parentElement.style.borderTop='';});
      handle.parentElement.addEventListener('drop',function(ev){ev.preventDefault();handle.parentElement.style.borderTop='';var tgt=parseInt(handle.parentElement.querySelector('.pa-drag').dataset.idx);if(dragIdx===null||dragIdx===tgt)return;var moved=PAINTS.splice(dragIdx,1)[0];PAINTS.splice(tgt,0,moved);initPaintInputs();schedulePaintSave();});
    });
  }());
  // Ceiling Paints: same 2-price-column render with drag
  (function(){
    var c=sel('pi-ceilpaints-container');if(!c)return;
    var h='<table style="width:100%;border-collapse:collapse"><thead><tr>'
      +'<th style="width:24px"></th>'
      +'<th style="text-align:left;font-size:11px;color:var(--ink3);padding:4px 8px;font-weight:600">Product</th>'
      +'<th style="text-align:right;font-size:11px;color:var(--ink3);padding:4px 8px;font-weight:600">Gallon $</th>'
      +'<th style="text-align:right;font-size:11px;color:var(--ink3);padding:4px 8px;font-weight:600">Pail $</th>'
      +'<th style="width:28px"></th></tr></thead><tbody>';
    CEILING_PAINTS.forEach(function(item,i){
      h+='<tr style="border-bottom:1px solid var(--cream2)">'
        +'<td style="padding:4px 2px;width:24px;cursor:grab" draggable="true" class="cp-drag" data-idx="'+i+'">'
        +'<svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><line x1="3" y1="5" x2="13" y2="5"/><line x1="3" y1="8" x2="13" y2="8"/><line x1="3" y1="11" x2="13" y2="11"/></svg></td>'
        +'<td style="padding:4px 6px"><input type="text" value="'+(item.n||'')+'" oninput="CEILING_PAINTS['+i+'].n=this.value;renderRooms();schedulePaintSave()" style="font-size:12px;padding:4px 8px;border:1px solid var(--cream3);border-radius:var(--r);background:var(--cream);color:var(--ink);width:100%"></td>'
        +'<td style="padding:4px 6px;width:80px"><input type="number" min="0" step="0.01" value="'+(item.g||0)+'" oninput="CEILING_PAINTS['+i+'].g=+this.value;schedulePaintSave()" style="font-size:12px;padding:4px 8px;border:1px solid var(--cream3);border-radius:var(--r);background:var(--cream);text-align:right;width:100%"></td>'
        +'<td style="padding:4px 6px;width:80px"><input type="number" min="0" step="0.01" value="'+(item.p||0)+'" oninput="CEILING_PAINTS['+i+'].p=+this.value;schedulePaintSave()" style="font-size:12px;padding:4px 8px;border:1px solid var(--cream3);border-radius:var(--r);background:var(--cream);text-align:right;width:100%"></td>'
        +'<td style="padding:4px 6px"><button onclick="CEILING_PAINTS.splice('+i+',1);initPaintInputs();schedulePaintSave()" style="background:none;border:none;cursor:pointer;color:var(--ink4);font-size:14px">&times;</button></td>'
        +'</tr>';
    });
    h+='</tbody></table>'
      +'<button onclick="CEILING_PAINTS.push({n:\\'\\',g:0,p:0});initPaintInputs();schedulePaintSave()" style="margin-top:8px;width:100%;padding:7px;border:1px dashed var(--ink4);border-radius:var(--r);background:transparent;color:var(--ink3);font-size:12px;cursor:pointer;font-family:var(--sans)">+ Add ceiling paint</button>';
    c.innerHTML=h;
    // Drag-to-reorder
    var dragIdx=null;
    c.querySelectorAll('.cp-drag').forEach(function(handle){
      handle.addEventListener('dragstart',function(ev){dragIdx=parseInt(handle.dataset.idx);handle.parentElement.style.opacity='0.4';ev.dataTransfer.effectAllowed='move';});
      handle.addEventListener('dragend',function(){handle.parentElement.style.opacity='';c.querySelectorAll('tr[data-idx]').forEach(function(r){r.style.borderTop='';});});
      handle.parentElement.addEventListener('dragover',function(ev){ev.preventDefault();handle.parentElement.style.borderTop='2px solid var(--gold)';});
      handle.parentElement.addEventListener('dragleave',function(){handle.parentElement.style.borderTop='';});
      handle.parentElement.addEventListener('drop',function(ev){ev.preventDefault();handle.parentElement.style.borderTop='';var tgt=parseInt(handle.parentElement.querySelector('.cp-drag').dataset.idx);if(dragIdx===null||dragIdx===tgt)return;var moved=CEILING_PAINTS.splice(dragIdx,1)[0];CEILING_PAINTS.splice(tgt,0,moved);initPaintInputs();schedulePaintSave();});
    });
  }());
  // Primers: 2-price-column render with drag (gallon + pail)
  (function(){
    var c=sel('pi-primers-container');if(!c)return;
    var h='<table style="width:100%;border-collapse:collapse"><thead><tr>'
      +'<th style="width:24px"></th>'
      +'<th style="text-align:left;font-size:11px;color:var(--ink3);padding:4px 8px;font-weight:600">Product</th>'
      +'<th style="text-align:right;font-size:11px;color:var(--ink3);padding:4px 8px;font-weight:600">Gallon $</th>'
      +'<th style="text-align:right;font-size:11px;color:var(--ink3);padding:4px 8px;font-weight:600">Pail $</th>'
      +'<th style="width:28px"></th></tr></thead><tbody>';
    PRIMERS.forEach(function(item,i){
      h+='<tr style="border-bottom:1px solid var(--cream2)">'
        +'<td style="padding:4px 2px;width:24px;cursor:grab" draggable="true" class="pr-drag" data-idx="'+i+'">'
        +'<svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><line x1="3" y1="5" x2="13" y2="5"/><line x1="3" y1="8" x2="13" y2="8"/><line x1="3" y1="11" x2="13" y2="11"/></svg></td>'
        +'<td style="padding:4px 6px"><input type="text" value="'+(item.n||'')+'" oninput="PRIMERS['+i+'].n=this.value;renderRooms();schedulePaintSave()" style="font-size:12px;padding:4px 8px;border:1px solid var(--cream3);border-radius:var(--r);background:var(--cream);color:var(--ink);width:100%"></td>'
        +'<td style="padding:4px 6px;width:80px"><input type="number" min="0" step="0.01" value="'+(item.g||0)+'" oninput="PRIMERS['+i+'].g=+this.value;schedulePaintSave()" style="font-size:12px;padding:4px 8px;border:1px solid var(--cream3);border-radius:var(--r);background:var(--cream);text-align:right;width:100%"></td>'
        +'<td style="padding:4px 6px;width:80px"><input type="number" min="0" step="0.01" value="'+(item.p||0)+'" oninput="PRIMERS['+i+'].p=+this.value;schedulePaintSave()" style="font-size:12px;padding:4px 8px;border:1px solid var(--cream3);border-radius:var(--r);background:var(--cream);text-align:right;width:100%"></td>'
        +'<td style="padding:4px 6px"><button onclick="PRIMERS.splice('+i+',1);initPaintInputs();schedulePaintSave()" style="background:none;border:none;cursor:pointer;color:var(--ink4);font-size:14px">&times;</button></td>'
        +'</tr>';
    });
    h+='</tbody></table>'
      +'<button onclick="PRIMERS.push({n:\\'\\',g:0,p:0});initPaintInputs();schedulePaintSave()" style="margin-top:8px;width:100%;padding:7px;border:1px dashed var(--ink4);border-radius:var(--r);background:transparent;color:var(--ink3);font-size:12px;cursor:pointer;font-family:var(--sans)">+ Add primer</button>';
    c.innerHTML=h;
    var dragIdx=null;
    c.querySelectorAll('.pr-drag').forEach(function(handle){
      handle.addEventListener('dragstart',function(ev){dragIdx=parseInt(handle.dataset.idx);handle.parentElement.style.opacity='0.4';ev.dataTransfer.effectAllowed='move';});
      handle.addEventListener('dragend',function(){handle.parentElement.style.opacity='';c.querySelectorAll('tr[data-idx]').forEach(function(r){r.style.borderTop='';});});
      handle.parentElement.addEventListener('dragover',function(ev){ev.preventDefault();handle.parentElement.style.borderTop='2px solid var(--gold)';});
      handle.parentElement.addEventListener('dragleave',function(){handle.parentElement.style.borderTop='';});
      handle.parentElement.addEventListener('drop',function(ev){ev.preventDefault();handle.parentElement.style.borderTop='';var tgt=parseInt(handle.parentElement.querySelector('.pr-drag').dataset.idx);if(dragIdx===null||dragIdx===tgt)return;var moved=PRIMERS.splice(dragIdx,1)[0];PRIMERS.splice(tgt,0,moved);initPaintInputs();schedulePaintSave();});
    });
  }());
  renderColoursList();
  renderPIList('pi-supplies-container',SUPPLIES,
    i=>'SUPPLIES['+i+'].n=this.value;schedulePaintSave()',
    i=>'SUPPLIES['+i+'].p=+this.value;schedulePaintSave()',
    i=>'SUPPLIES.splice('+i+',1);initPaintInputs();schedulePaintSave()',
    'SUPPLIES.push({n:\\'\\',p:0});initPaintInputs();schedulePaintSave()','Add supply');
}

function updStd(surface,coats,val){if(!val||val<1)return;STANDARDS[surface][coats]=val;recalcAll();schedulePaintSave();}

// ─── SUPABASE SAVE/LOAD ──────────────────────────
var _session=null; // injected by React parent via win._session
const SUPA_URL='https://cyzvmcmlpnozwrqifrdt.supabase.co';
const SUPA_KEY='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN5enZtY21scG56dndycWlmcmR0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg2Mzk1MzEsImV4cCI6MjA5NDIxNTUzMX0.IeZRx5xcPddSQcL77vhKjOgAKFi8bKpj3dMfajHpV3c';

async function supaFetch(path,method,body){
  try{
    const opts={method:method||'GET',headers:{'apikey':SUPA_KEY,'Authorization':'Bearer '+SUPA_KEY,'Content-Type':'application/json','Prefer':method==='POST'?'return=representation':''}};
    if(body)opts.body=JSON.stringify(body);
    const res=await fetch(SUPA_URL+path,opts);
    if(!res.ok){const t=await res.text();if(!t.includes('42P01'))console.warn('[Kingdom DB]',res.status,t.slice(0,80));setSaveStatus('DB not set up','#e07070');return null;}
    const txt=await res.text();return txt?JSON.parse(txt):null;
  }catch(e){setSaveStatus('Offline','#e07070');return null;}
}
function setSaveStatus(msg,color){
  const ind=sel('save-indicator');if(!ind)return;
  ind.textContent=msg;ind.style.color=color||'var(--gold2)';
  if(!color)setTimeout(()=>{if(ind.textContent===msg)ind.textContent='';},2500);
}
function collectState(){
  return{rooms,workers,changeItems,changeCounter,roomCounter,overheadItems,coverFields:{'ci-name':v('ci-name'),'ci-email':v('ci-email'),'ci-phone':v('ci-phone'),'ci-addr1':v('ci-addr1'),'ci-addr2':v('ci-addr2')}};
}
function restoreState(state){
  if(!state)return;
  if(state.coverFields)Object.entries(state.coverFields).forEach(([id,val])=>{const e=sel(id);if(e)e.value=val||'';});
  if(state.rooms&&Array.isArray(state.rooms)){rooms=state.rooms;roomCounter=state.roomCounter||rooms.length;}
  if(state.workers&&Array.isArray(state.workers))workers=state.workers;
  if(state.changeItems&&Array.isArray(state.changeItems)){changeItems=state.changeItems;changeCounter=state.changeCounter||changeItems.length;}
  if(state.overheadItems&&Array.isArray(state.overheadItems))overheadItems=state.overheadItems;
  renderRooms();initLabourRates();syncClient();recalcAll();
}
async function saveEstimate(){
  const payload={client_name:v('ci-name')||'Untitled',client_email:v('ci-email'),client_phone:v('ci-phone'),addr1:v('ci-addr1'),addr2:v('ci-addr2'),state:collectState()};
  let result;
  if(currentEstimateId){result=await supaFetch('/rest/v1/estimates?id=eq.'+currentEstimateId,'PATCH',payload);}
  else{result=await supaFetch('/rest/v1/estimates','POST',payload);if(result&&result[0])currentEstimateId=result[0].id;}
  setSaveStatus('✓ Saved');
}
function scheduleSave(){clearTimeout(saveTimer);saveTimer=setTimeout(saveEstimate,1500);}
async function loadEstimatesList(){return await supaFetch('/rest/v1/estimates?select=id,client_name,addr1,updated_at&order=updated_at.desc&limit=50')||[];}
async function loadEstimateById(id){
  const res=await supaFetch('/rest/v1/estimates?id=eq.'+id+'&select=*');
  if(!res||!res[0])return;
  currentEstimateId=res[0].id;restoreState(res[0].state);closeLoadPanel();
}
async function deleteEstimate(id){await supaFetch('/rest/v1/estimates?id=eq.'+id,'DELETE');refreshLoadList();}
function openLoadPanel(){const p=sel('load-panel');if(p){p.style.display='flex';refreshLoadList();}}
function closeLoadPanel(){const p=sel('load-panel');if(p)p.style.display='none';}
async function refreshLoadList(){
  const list=await loadEstimatesList();
  const c=sel('load-list');if(!c)return;
  if(!list.length){c.innerHTML='<p style="color:var(--ink3);text-align:center;padding:20px">No saved estimates yet.</p>';return;}
  c.innerHTML=list.map(e=>'<div style="display:flex;align-items:center;justify-content:space-between;padding:10px 14px;border:1px solid var(--cream3);border-radius:var(--r);margin-bottom:8px;background:var(--cream)">'
    +'<div style="cursor:pointer;flex:1" onclick="loadEstimateById(\\''+e.id+'\\')">'
    +'<div style="font-weight:500;font-size:13px">'+(e.client_name||'Untitled')+'</div>'
    +'<div style="font-size:11px;color:var(--ink3)">'+(e.addr1||'—')+' &middot; '+new Date(e.updated_at).toLocaleDateString('en-CA',{month:'short',day:'numeric',year:'numeric'})+'</div>'
    +'</div>'
    +'<button onclick="deleteEstimate(\\''+e.id+'\\')" style="margin-left:12px;font-size:11px;padding:4px 8px;border:1px solid var(--cream3);border-radius:var(--r);background:transparent;color:var(--ink3);cursor:pointer">Delete</button>'
    +'</div>').join('');
}
function newEstimate(){
  if(!confirm('Start a new estimate? Unsaved changes will be lost.'))return;
  currentEstimateId=null;rooms=[];roomCounter=0;changeItems=[];changeCounter=0;
  overheadItems=JSON.parse(JSON.stringify(OVERHEAD_ITEMS));
  workers=JSON.parse(JSON.stringify(WORKERS_DEFAULT));
  ['ci-name','ci-email','ci-phone','ci-addr1','ci-addr2'].forEach(id=>{const e=sel(id);if(e)e.value='';});
  addRoom();initLabourRates();recalcAll();closeLoadPanel();
}

// ─── PDF EXPORT ──────────────────────────────────
function expandAllAndExport(ids){
  document.querySelectorAll('.room-body').forEach(b=>b.classList.add('open'));
  document.querySelectorAll('.room-arrow').forEach(a=>a.classList.add('open'));
  exportPDF(ids);
}
function exportInfoPackage(){
  exportPDF(['page-cover','page-quote','page-contract']);
}
function exportPDF(id){_loadPDF(function(){_exportPDF(id);});}
function _exportPDF(pageIdOrArray){
  const ids=Array.isArray(pageIdOrArray)?pageIdOrArray:[pageIdOrArray];
  document.querySelectorAll('.page').forEach(p=>{p.classList.remove('print-target');p.classList.remove('cover-target');});
  ids.map(id=>document.getElementById(id)).filter(Boolean).forEach(t=>{t.classList.add('print-target');if(t.id==='page-cover')t.classList.add('cover-target');});
  // Force contract body to populate before printing
  try{recalcAll();}catch(e){}
  if(ids.includes('page-contract')){
    try{initSignaturePads();}catch(e){}
  }
  setTimeout(()=>{window.print();setTimeout(()=>{document.querySelectorAll('.print-target').forEach(t=>{t.classList.remove('print-target');t.classList.remove('cover-target');});},1000);},300);
}

// ─── INIT ────────────────────────────────────────
(function(){
function updWin(rid,idx,key,val){
  var r=rooms.find(function(x){return x.id===rid;});if(!r)return;
  if(!r.winDims)r.winDims=[{l:0,w:0}];
  r.winDims[idx][key]=val;
  // Update winLF = sum of all l*w
  r.winLF=r.winDims.reduce(function(s,w){return s+(w.l||0)*(w.w||0);},0);
  renderRooms();recalcAll();
}
function addWin(rid){
  var r=rooms.find(function(x){return x.id===rid;});if(!r)return;
  if(!r.winDims)r.winDims=[];
  r.winDims.push({l:0,w:0});
  renderRooms();
}
function removeWin(rid,idx){
  var r=rooms.find(function(x){return x.id===rid;});if(!r)return;
  r.winDims.splice(idx,1);
  r.winLF=r.winDims.reduce(function(s,w){return s+(w.l||0)*(w.w||0);},0);
  renderRooms();recalcAll();
}

function initSigPad(canvasId){
  var canvas=document.getElementById(canvasId);
  if(!canvas)return;
  var ctx=canvas.getContext('2d');
  ctx.strokeStyle='#1a1a1a';
  ctx.lineWidth=2;
  ctx.lineCap='round';
  ctx.lineJoin='round';
  var drawing=false;
  var lastX=0,lastY=0;

  function getPos(ev){
    var r=canvas.getBoundingClientRect();
    var scaleX=canvas.width/r.width;
    var scaleY=canvas.height/r.height;
    if(ev.touches){
      return{x:(ev.touches[0].clientX-r.left)*scaleX,y:(ev.touches[0].clientY-r.top)*scaleY};
    }
    return{x:(ev.clientX-r.left)*scaleX,y:(ev.clientY-r.top)*scaleY};
  }

  function start(ev){ev.preventDefault();drawing=true;var p=getPos(ev);lastX=p.x;lastY=p.y;ctx.beginPath();ctx.moveTo(lastX,lastY);}
  function move(ev){ev.preventDefault();if(!drawing)return;var p=getPos(ev);ctx.lineTo(p.x,p.y);ctx.stroke();lastX=p.x;lastY=p.y;}
  function stop(ev){drawing=false;}

  canvas.addEventListener('mousedown',start);
  canvas.addEventListener('mousemove',move);
  canvas.addEventListener('mouseup',stop);
  canvas.addEventListener('mouseleave',stop);
  canvas.addEventListener('touchstart',start,{passive:false});
  canvas.addEventListener('touchmove',move,{passive:false});
  canvas.addEventListener('touchend',stop);
}

function clearSig(canvasId){
  var canvas=document.getElementById(canvasId);
  if(!canvas)return;
  var ctx=canvas.getContext('2d');
  ctx.clearRect(0,0,canvas.width,canvas.height);
}



function recalcAll(){
  try{syncClient();}catch(e){}

  const aw=workers.filter(w=>w.active).length||1;
  const buf=+(v('lr-buffer')||1.25);
  const discOn=sel('lr-discount')&&sel('lr-discount').checked;
  const discPct=(+(v('lr-disc-pct')||10))/100;
  let totWalls=0,totCeil=0,totTrims=0,totDoors=0,totHrs=0;
  rooms.forEach(r=>{totWalls+=calcWalls(r);totCeil+=calcCeil(r);totTrims+=calcTrims(r);totDoors+=r.doors?r.doorCount:0;totHrs+=calcRoomHrs(r);});
  const labourAmt=totHrs*globalRate*aw*buf;
  const discAmt=discOn?labourAmt*discPct:0;
  const matBuf=+(v('lr-mat-buffer')||1.25);
  const suppliesRaw=rooms.reduce(function(t,r){return t+calcRoomSuppliesCost(r);},0);
  const suppliesCost=suppliesRaw*matBuf;
  // Compute totalPaintCost inline before subtotal (colour summary block runs later)
  var totalPaintCost=0;
  var matBufC2=+(v('lr-mat-buffer')||1.25);
  (function(){
    var colMap2={};
    function addCol2(product,sqft){
      if(!product||!sqft)return;
      colMap2[product]=(colMap2[product]||0)+sqft;
    }
    rooms.forEach(function(r){
      var wSqft=calcWalls(r),cSqft=calcCeil(r),tSqft=calcTrims(r);
      if(r.walls&&wSqft){if(r.wallCoats==3&&r.wallsPrimer){addCol2(r.wallsPrimer,wSqft);addCol2(r.wallPaint,wSqft*2);}else addCol2(r.wallPaint,wSqft);}
      if(r.ceiling&&cSqft){if(r.ceilCoats==3&&r.ceilingPrimer){addCol2(r.ceilingPrimer,cSqft);addCol2(r.ceilPaint,cSqft*2);}else addCol2(r.ceilPaint,cSqft);}
      var trimSurfs=(r.baseboards||r.crown||r.doorFrames||r.windows||r.doors);
      if(trimSurfs&&tSqft){var trimHasPrimer=(r.baseCoats==3||r.crownCoats==3||r.dfCoats==3||r.winCoats==3||r.doorCoats==3)&&r.trimPrimer;if(trimHasPrimer){addCol2(r.trimPrimer,tSqft);addCol2(r.trimPaint,tSqft*2);}else addCol2(r.trimPaint,tSqft);}
    });
    Object.keys(colMap2).forEach(function(prod){
      var sqft=colMap2[prod];
      var pObj=[...PAINTS,...CEILING_PAINTS,...PRIMERS].find(function(p){return p.n===prod;});
      var unitPrice=pObj?(sqft>1900&&pObj.p>0?pObj.p:pObj.g||pObj.p||0):0;
      if(unitPrice>0)totalPaintCost+=unitPrice*Math.ceil(sqft/350)*matBufC2;
    });
  }());
  const subtotal=labourAmt-discAmt+suppliesCost+totalPaintCost;
  const tax=subtotal*0.13;
  const total=subtotal+tax;
  const dep=total*0.1,bal45=total*0.45,fin=total-dep-bal45;
  const days=Math.ceil(totHrs/6)+1;

  // Breakdown stats
  const ids_=[['bd-walls',fmtN(totWalls)],['bd-ceil',fmtN(totCeil)],['bd-trims',fmtN(totTrims)],['bd-doors',totDoors],['bd-hours',(totHrs/aw).toFixed(1)],['bd-days',days],['bd-labour',fmt(labourAmt)],['bd-rooms',rooms.length]];
  ids_.forEach(([id,val])=>{const e=sel(id);if(e)e.textContent=val;});

  // Breakdown table
  const tbody=sel('bd-tbody');
  if(tbody){
    tbody.innerHTML='';
    const SURFS=[
      {key:'walls',label:'Walls',aFn:r=>calcWalls(r),ck:'wallCoats',std:'walls'},
      {key:'ceiling',label:'Ceiling',aFn:r=>calcCeil(r),ck:'ceilCoats',std:'ceiling'},
      {key:'baseboards',label:'Baseboards',aFn:r=>r.baseLF,ck:'baseCoats',std:'baseboards'},
      {key:'crown',label:'Crown',aFn:r=>r.crownLF,ck:'crownCoats',std:'crown'},
      {key:'doorFrames',label:'Door Frames',aFn:r=>r.dfLF,ck:'dfCoats',std:'doorFrames'},
      {key:'windows',label:'Windows',aFn:r=>r.winLF,ck:'winCoats',std:'windows'},
      {key:'doors',label:'Doors',aFn:r=>r.doorCount*21,ck:'doorCoats',std:'doors'},
    ];
    rooms.forEach(r=>{
      let rt=0;
      SURFS.forEach(s=>{
        const a=s.aFn(r);if(!r[s.key]||!a)return;
        const rate=STANDARDS[s.std][r[s.ck]];
        const hrs=a/rate;
        const cost=hrs*globalRate*aw*buf;
        rt+=cost;
        tbody.innerHTML+='<tr><td style=\\"padding-left:20px;font-size:12px;color:var(--ink2)\\">'+s.label+'</td><td class=\\"num\\">'+fmtN(a)+'</td><td class=\\"num\\">'+r[s.ck]+'</td><td class=\\"num\\">'+rate+'</td><td class=\\"num\\">'+hrs.toFixed(1)+'</td><td class=\\"num\\">'+fmt(cost)+'</td></tr>';
      });
      if(r.prepHrs>0){const cost=r.prepHrs*globalRate*aw*buf;rt+=cost;tbody.innerHTML+='<tr><td style=\\"padding-left:20px;font-size:12px;color:var(--ink2)\\">Prep</td><td class=\\"num\\">'+r.prepHrs+'</td><td class=\\"num\\">\\u2014</td><td class=\\"num\\">\\u2014</td><td class=\\"num\\">'+r.prepHrs.toFixed(1)+'</td><td class=\\"num\\">'+fmt(cost)+'</td></tr>';}
      tbody.innerHTML+='<tr class=\\"subtotal-row\\"><td colspan=\\"5\\" style=\\"text-align:right;padding-right:12px\\">'+(r.name||'Room '+r.id)+' subtotal</td><td class=\\"num\\">'+fmt(rt)+'</td></tr>';
    });
    tbody.innerHTML+='<tr class=\\"grand-row\\"><td colspan=\\"5\\" style=\\"text-align:right;padding-right:12px\\">Grand total</td><td class=\\"num\\">'+fmt(labourAmt)+'</td></tr>';
  }

  // Surface summary
  const stbody=sel('bd-surface-tbody');
  if(stbody){
    stbody.innerHTML='';
    const smap={Walls:{a:0,h:0},Ceiling:{a:0,h:0},'Trims':{a:0,h:0},Prep:{a:0,h:0}};
    rooms.forEach(r=>{
      const wa=calcWalls(r);if(r.walls&&wa){smap.Walls.a+=wa;smap.Walls.h+=wa/STANDARDS.walls[r.wallCoats];}
      const ca=calcCeil(r);if(r.ceiling&&ca){smap.Ceiling.a+=ca;smap.Ceiling.h+=ca/STANDARDS.ceiling[r.ceilCoats];}
      let ta=0,th=0;
      if(r.baseboards&&r.baseLF){ta+=r.baseLF;th+=r.baseLF/STANDARDS.baseboards[r.baseCoats];}
      if(r.crown&&r.crownLF){ta+=r.crownLF;th+=r.crownLF/STANDARDS.crown[r.crownCoats];}
      if(r.doorFrames&&r.dfLF){ta+=r.dfLF;th+=r.dfLF/STANDARDS.doorFrames[r.dfCoats];}
      if(r.windows&&r.winLF){ta+=r.winLF;th+=r.winLF/STANDARDS.windows[r.winCoats];}
      if(r.doors&&r.doorCount){const da=r.doorCount*21;ta+=da;th+=da/STANDARDS.doors[r.doorCoats];}
      smap.Trims.a+=ta;smap.Trims.h+=th;
      if(r.prepHrs){smap.Prep.a+=r.prepHrs;smap.Prep.h+=r.prepHrs;}
    });
    Object.entries(smap).forEach(([name,d])=>{
      if(!d.h)return;
      const cost=d.h*globalRate*aw*buf;
      stbody.innerHTML+='<tr><td>'+name+'</td><td class=\\"num\\">'+fmtN(d.a)+'</td><td class=\\"num\\">'+d.h.toFixed(1)+'</td><td class=\\"num\\">'+(d.h/6).toFixed(1)+'</td><td class=\\"num\\">'+fmt(cost)+'</td></tr>';
    });
  }

  // Colour summary and cost
  totalPaintCost=0; // reset then recompute for breakdown display
  var ctbody=sel('bd-colour-tbody');
  if(ctbody){
    ctbody.innerHTML='';
    var colMap={};
    var addCol=function(product,colour,surface,roomName,area,sheen){
      if(!colour&&!product)return;
      var key=(product||'')+'·'+(colour||'')+'·'+(sheen||'')+'·'+surface;
      if(!colMap[key])colMap[key]={product:product||'',colour:colour||'',surface:surface,rooms:[],area:0};
      colMap[key].area+=area||0;
    }
    rooms.forEach(function(r){
      var wSqft=calcWalls(r),cSqft=calcCeil(r),tSqft=calcTrims(r);
      // Walls: if Primer & 2 Coats, add primer row (1 coat sqft) and paint row (2x sqft)
      if(r.walls&&wSqft){
        if(r.wallCoats==3&&r.wallsPrimer){addCol(r.wallsPrimer,'','Walls (Primer)',r.name||'Room '+r.id,wSqft);addCol(r.wallPaint,r.wallColour,'Walls (2 Coats)',r.name||'Room '+r.id,wSqft*2);}
        else addCol(r.wallPaint,r.wallColour,'Walls',r.name||'Room '+r.id,wSqft,r.wallSheen||'');
      }
      // Ceiling
      if(r.ceiling&&cSqft){
        if(r.ceilCoats==3&&r.ceilingPrimer){addCol(r.ceilingPrimer,'','Ceiling (Primer)',r.name||'Room '+r.id,cSqft);addCol(r.ceilPaint,r.ceilColour,'Ceiling (2 Coats)',r.name||'Room '+r.id,cSqft*2);}
        else addCol(r.ceilPaint,r.ceilColour,'Ceiling',r.name||'Room '+r.id,cSqft,r.ceilSheen||'');
      }
      // Trim
      var trimSurfs=[];
      if(r.baseboards&&r.baseLF)trimSurfs.push('Baseboards');
      if(r.crown&&r.crownLF)trimSurfs.push('Crown');
      if(r.doorFrames&&r.dfLF)trimSurfs.push('Door Frames');
      if(r.windows&&r.winLF)trimSurfs.push('Windows');
      if(r.doors&&r.doorCount)trimSurfs.push('Doors');
      var trimHasPrimer=(r.baseCoats==3||r.crownCoats==3||r.doorCoats==3||r.dfCoats==3||r.winCoats==3)&&r.trimPrimer;
      if(trimSurfs.length&&tSqft){
        if(trimHasPrimer){addCol(r.trimPrimer,'',trimSurfs.join(', ')+' (Primer)',r.name||'Room '+r.id,tSqft);addCol(r.trimPaint,r.trimColour,trimSurfs.join(', ')+' (2 Coats)',r.name||'Room '+r.id,tSqft*2);}
        else addCol(r.trimPaint,r.trimColour,trimSurfs.join(', '),r.name||'Room '+r.id,tSqft,r.trimSheen||'');
      }
    });
    var matBufC=matBufC2; // use pre-computed mat buffer
    Object.keys(colMap).forEach(function(key){
      var cm=colMap[key];
      var sqft=cm.area;
      var gallons=Math.ceil(sqft/350);
      var qtyStr='';
      if(sqft<=0){qtyStr='—';}
      else if(sqft<=1900){qtyStr=Math.ceil(sqft/350)+' gal';}
      else{var pails=Math.floor(sqft/1900);var rem=sqft-pails*1900;var extraGal=rem>0?Math.ceil(rem/350):0;var parts=[];if(pails>0)parts.push(pails+' pail'+(pails>1?'s':''));if(extraGal>0)parts.push(extraGal+' gal');qtyStr=parts.join(' + ');}
      var pObj=[...PAINTS,...CEILING_PAINTS,...PRIMERS].find(function(p){return p.n===cm.product;});
      var unitPrice=pObj?(sqft>1900&&pObj.p>0?pObj.p:pObj.g||pObj.p||0):0;
      var lineCost=unitPrice>0?unitPrice*gallons*matBufC:0;
      totalPaintCost+=lineCost;
      var colHex=cm.colour?(function(){var c=COLOURS.find(function(x){return x.n===cm.colour;});return c?c.h:'#ccc';}()):'#ccc';
      var swatch=cm.colour?'<span style=\\"display:inline-block;width:10px;height:10px;border-radius:2px;background:'+colHex+';border:1px solid rgba(0,0,0,.15);margin-right:4px;vertical-align:middle\\"></span>':'';
      var productDisplay=cm.product?cm.product.replace(/\\s*\\b(Gallon|Pail)\\b\\s*/gi,'').trim():'\\u2014';
      var colSheen=(cm.colour||'—')+(cm.sheen?' · '+cm.sheen:'');
      ctbody.innerHTML+='<tr>'
        +'<td style=\\"font-size:12px\\">'+productDisplay+'</td>'
        +'<td style=\\"font-size:12px\\">'+swatch+colSheen+'</td>'
        +'<td style=\\"font-size:12px\\">'+cm.surface+'</td>'
        +'<td class=\\"num\\" style=\\"font-size:12px\\">'+fmtN(sqft)+' sqft</td>'
        +'<td class=\\"num\\" style=\\"font-size:12px\\">'+qtyStr+'</td>'
        +'<td class=\\"num\\" style=\\"font-size:12px;font-weight:500\\">'+(lineCost>0?fmt(lineCost):'—')+'</td>'
        +'</tr>';
    });
  }
  if(sel('q-disc-row'))sel('q-disc-row').style.display=discOn?'table-row':'none';
  if(sel('q-disc-val'))sel('q-disc-val').textContent='-'+fmt(discAmt);
  if(sel('q-subtotal'))sel('q-subtotal').textContent=fmt(subtotal);
  if(sel('q-tax'))sel('q-tax').textContent=fmt(tax);
  if(sel('q-total'))sel('q-total').textContent=fmt(total);
  if(sel('q-pay1'))sel('q-pay1').textContent=fmt(dep);
  if(sel('q-pay2'))sel('q-pay2').textContent=fmt(bal45);
  if(sel('q-pay3'))sel('q-pay3').textContent=fmt(fin);
  // Quote lines
  const qlbody=sel('q-line-tbody');
  if(qlbody){
    qlbody.innerHTML='';
    rooms.forEach(r=>{
      const ws=calcWalls(r),cs=calcCeil(r);
      const coatLabel=v=>(v==1?'1 coat':v==3?'Primer & 2 coats':'2 coats');
      const sqLabel=n=>fmtN(n)+' square feet';
      const lfLabel=n=>fmtN(n)+' linear feet';

      // ── Preparation Services ──
      const prepLabels={furniture:'Move furniture',plastic:'Plastic cover',outlets:'Remove outlets',drywall:'Drywall repairs',caulking:'Caulking',cleanup:'Clean up'};
      const prepItems=[];
      if(r.prep){Object.keys(prepLabels).forEach(k=>{if(r.prep[k])prepItems.push(prepLabels[k]);});}
      if(r.prep&&r.prep.custom&&r.prep.custom.trim())prepItems.push(r.prep.custom.trim());
      const prepHtml=prepItems.length
        ?'<div style=\\"margin-bottom:8px\\">'
          +'<div style=\\"font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:var(--ink3);margin-bottom:4px\\">Preparation Services</div>'
          +prepItems.map(p=>'<div style=\\"font-size:11px;color:var(--ink2);padding-left:8px\\">— '+p+'</div>').join('')
          +'</div>':'' ;

      // ── Painting ──
      const paintingItems=[];
      if(r.walls&&ws)paintingItems.push(coatLabel(r.wallCoats)+' on walls \\u2014 '+sqLabel(ws));
      if(r.ceiling&&cs)paintingItems.push(coatLabel(r.ceilCoats)+' on ceiling \\u2014 '+sqLabel(cs));
      if(r.baseboards&&r.baseLF)paintingItems.push(coatLabel(r.baseCoats)+' on baseboards \\u2014 '+lfLabel(r.baseLF));
      if(r.crown&&r.crownLF)paintingItems.push(coatLabel(r.crownCoats)+' on crown moulding \\u2014 '+lfLabel(r.crownLF));
      if(r.doorFrames&&r.dfLF)paintingItems.push(coatLabel(r.dfCoats)+' on door frames \\u2014 '+lfLabel(r.dfLF));
      if(r.windows&&r.winLF)paintingItems.push(coatLabel(r.winCoats)+' on windows \\u2014 '+lfLabel(r.winLF));
      if(r.doors&&r.doorCount)paintingItems.push(coatLabel(r.doorCoats)+' on '+r.doorCount+' door'+(r.doorCount>1?'s':''));
      if(!paintingItems.length&&!prepItems.length)return;
      const paintingHtml=paintingItems.length
        ?'<div style=\\"margin-bottom:8px\\">'
          +'<div style=\\"font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:var(--ink3);margin-bottom:4px\\">Painting</div>'
          +paintingItems.map(p=>'<div style=\\"font-size:11px;color:var(--ink2);padding-left:8px\\">— '+p+'</div>').join('')
          +'</div>':'';

      // ── Materials ──
      function matLine(surface,paint,colour,sheen,primer,primerName){
        const parts=[];
        if(primerName)parts.push('<div style=\\"font-size:11px;color:var(--ink2);padding-left:8px\\">— '+surface+' Primer: '+(primerName.replace(/\\s*(Gallon|Pail)/gi,'').trim()||primerName)+'</div>');
        if(paint){const hex=colour?(COLOURS.find(x=>x.n===colour)||{h:'#ccc'}).h:'';const swatch=colour?'<span style=\\"display:inline-block;width:10px;height:10px;border-radius:2px;background:'+hex+';border:1px solid rgba(0,0,0,.15);margin-right:3px;vertical-align:middle\\"></span>':'';parts.push('<div style=\\"font-size:11px;color:var(--ink2);padding-left:8px\\">— '+surface+': '+(paint.replace(/\\s*(Gallon|Pail)/gi,'').trim())+(colour?' · '+swatch+colour:'')+(sheen?' · '+sheen:'')+'</div>');}
        return parts.join('');
      }
      const matItems=[];
      if(r.walls&&ws){const m=matLine('Walls',r.wallPaint,r.wallColour,r.wallSheen,r.wallCoats==3,r.wallsPrimer);if(m)matItems.push(m);}
      if(r.ceiling&&cs){const m=matLine('Ceiling',r.ceilPaint,r.ceilColour,r.ceilSheen,r.ceilCoats==3,r.ceilingPrimer);if(m)matItems.push(m);}
      const hasTrim=r.baseboards||r.crown||r.doorFrames||r.windows||r.doors;
      if(hasTrim){const m=matLine('Trim',r.trimPaint,r.trimColour,r.trimSheen,(r.baseCoats==3||r.crownCoats==3||r.dfCoats==3||r.winCoats==3||r.doorCoats==3),r.trimPrimer);if(m)matItems.push(m);}
      const materialsHtml=matItems.length
        ?'<div style=\\"margin-bottom:4px\\">'
          +'<div style=\\"font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:var(--ink3);margin-bottom:4px\\">Materials</div>'
          +matItems.join('')
          +'</div>':'';

      const descHtml=prepHtml+paintingHtml+materialsHtml;
      const rowCost=calcRoomCost(r)*buf+calcRoomSuppliesCost(r)*matBuf;
      qlbody.innerHTML+='<tr>'
        +'<td style=\\"font-size:12px;font-weight:600;vertical-align:top;padding-right:8px\\">'+(r.name||'Room '+r.id)+'</td>'
        +'<td style=\\"font-size:11px;vertical-align:top\\">'+descHtml+'</td>'
        +'<td class=\\"right\\" style=\\"font-size:12px;font-weight:500;white-space:nowrap;vertical-align:top\\">'+fmt(rowCost)+'</td>'
        +'</tr>';
    });
  }
  if(sel('q-disc-row'))sel('q-disc-row').style.display=(discOn||(sel('lr-discount-amt')&&sel('lr-discount-amt').checked))?'table-row':'none';
  if(sel('q-disc-label')){if(discOn&&!(sel('lr-discount-amt')&&sel('lr-discount-amt').checked))sel('q-disc-label').textContent='Discount ('+Math.round(discPct*100)+'%)';else sel('q-disc-label').textContent='Discount';}
  if(sel('q-disc-val'))sel('q-disc-val').textContent='-'+fmt(discOn||( sel('lr-discount-amt')&&sel('lr-discount-amt').checked)?0:0);
  if(sel('q-subtotal'))sel('q-subtotal').textContent=fmt(subtotal);
  if(sel('q-tax'))sel('q-tax').textContent=fmt(tax);
  if(sel('q-total'))sel('q-total').textContent=fmt(total);
  if(sel('q-pay1'))sel('q-pay1').textContent=fmt(dep);
  if(sel('q-pay2'))sel('q-pay2').textContent=fmt(bal45);
  if(sel('q-pay3'))sel('q-pay3').textContent=fmt(fin);
  recalcInvoice(total);

  // Contract
  buildContract(total,dep,bal45,fin,days);

  // Post project
  if(sel('pp-date'))sel('pp-date').textContent=today();
  if(sel('pp-client'))sel('pp-client').textContent=v('ci-name')||'\\u2014';
  if(sel('pp-cost'))sel('pp-cost').textContent=fmt(total);
  if(sel('pp-labour'))sel('pp-labour').textContent=fmt(labourAmt);
  if(sel('pp-est'))sel('pp-est').value=totHrs.toFixed(1);
  recalcPost();

  if(typeof scheduleSave==='function'&&document.readyState==='complete')scheduleSave();
}

function buildContract(total,dep,bal45,fin,days){
  const name=v('ci-name')||'[Client Name]';
  const addr=v('ci-addr1')||'[Address]';
  const a2=v('ci-addr2')||'';
  const phone=v('ci-phone')||'[Phone]';
  const email=v('ci-email')||'[Email]';
  const fullAddr=addr+(a2?', '+a2:'');
  const dateStr=today();

  // Scope: aggregate sqft/lf/doors across all rooms
  var totWalls=0,totCeil=0,totTrims=0,totDoors=0;
  var roomRows='';
  rooms.forEach(r=>{
    const ws=calcWalls(r),cs=calcCeil(r),tr=calcTrims(r),dc=(r.doors?r.doorCount:0);
    totWalls+=ws;totCeil+=cs;totTrims+=tr;totDoors+=dc;
    const d=[];
    if(ws)d.push(fmtN(ws)+' sqft walls');
    if(cs)d.push(fmtN(cs)+' sqft ceiling');
    if(tr)d.push(fmtN(tr)+' lin ft trims');
    if(dc)d.push(dc+' door'+(dc>1?'s':''));
    if(d.length)roomRows+='<tr>'
      +'<td style=\\"padding:5px 8px;font-weight:500;border-bottom:1px solid var(--cream2);font-size:12px\\">'+(r.name||'Room '+r.id)+'</td>'
      +'<td style=\\"padding:5px 8px;color:var(--ink2);border-bottom:1px solid var(--cream2);font-size:12px\\">'+d.join(' &middot; ')+'</td>'
      +'</tr>';
  });

  const scopeTable=roomRows
    ?'<table style=\\"width:100%;border-collapse:collapse;margin:8px 0\\"><thead><tr>'
      +'<th style=\\"padding:5px 8px;text-align:left;font-size:11px;color:var(--ink3);text-transform:uppercase;letter-spacing:.06em;background:var(--cream2)\\">Area</th>'
      +'<th style=\\"padding:5px 8px;text-align:left;font-size:11px;color:var(--ink3);text-transform:uppercase;letter-spacing:.06em;background:var(--cream2)\\">Surfaces</th>'
      +'</tr></thead><tbody>'+roomRows+'</tbody></table>'
    :'<p style=\\"color:var(--ink3);font-size:12px\\">No rooms configured.</p>';

  const totalStr=total>0?fmt(total):'$0.00';

  function section(title){
    return '<div style=\\"font-size:10px;font-weight:600;color:var(--ink3);text-transform:uppercase;letter-spacing:.08em;margin:18px 0 6px;padding-bottom:4px;border-bottom:1px solid var(--cream2)\\">'+title+'</div>';
  }
  function para(text){
    return '<p style=\\"font-size:12px;color:var(--ink2);line-height:1.8;margin-bottom:8px\\">'+text+'</p>';
  }


  var html='';
    // ── Header ──
  html+=para('This Painting Service Agreement (&ldquo;Agreement&rdquo;) is made and entered into on <strong>'+dateStr+'</strong> by and between:');
  html+='<div style=\\"display:grid;grid-template-columns:1fr 1fr;gap:20px;margin:14px 0;padding:14px 16px;background:var(--cream2);border-radius:var(--r)\\">';
  html+='<div>';
  html+='<div style=\\"font-size:10px;font-weight:600;color:var(--ink3);text-transform:uppercase;letter-spacing:.06em;margin-bottom:6px\\">Client</div>';
  html+='<div style=\\"font-size:13px;font-weight:600\\">'+name+'</div>';
  html+='<div style=\\"font-size:12px;color:var(--ink2)\\">'+fullAddr+'</div>';
  html+='<div style=\\"font-size:12px;color:var(--ink2)\\">'+phone+'</div>';
  html+='<div style=\\"font-size:12px;color:var(--ink2)\\">'+email+'</div>';
  html+='</div>';
  html+='<div>';
  html+='<div style=\\"font-size:10px;font-weight:600;color:var(--ink3);text-transform:uppercase;letter-spacing:.06em;margin-bottom:6px\\">Contractor</div>';
  html+='<div style=\\"font-size:13px;font-weight:600\\">David Truong</div>';
  html+='<div style=\\"font-size:12px;color:var(--ink2)\\">25 Fieldview Crescent</div>';
  html+='<div style=\\"font-size:12px;color:var(--ink2)\\">Markham, ON L3R 3H6</div>';
  html+='<div style=\\"font-size:12px;color:var(--ink2)\\">(647) 449-6611</div>';
  html+='<div style=\\"font-size:12px;color:var(--ink2)\\">info@kingdompainting.ca</div>';
  html+='</div>';
  html+='</div>';

    // ── Scope of Work ──
  html+=section('Scope of Work');
  html+=para('The Contractor agrees to perform the following painting services (&ldquo;Services&rdquo;) at the Client\\'s property located at <strong>'+fullAddr+'</strong>.');
  html+=scopeTable;
  html+='<div style=\\"display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin:10px 0;padding:10px;background:var(--cream2);border-radius:var(--r)\\">';
  html+='<div style=\\"text-align:center\\"><div style=\\"font-size:10px;color:var(--ink3);text-transform:uppercase;letter-spacing:.06em\\">Walls</div><div style=\\"font-size:14px;font-weight:600\\">'+fmtN(totWalls)+'</div><div style=\\"font-size:11px;color:var(--ink3)\\">sqft</div></div>';
  html+='<div style=\\"text-align:center\\"><div style=\\"font-size:10px;color:var(--ink3);text-transform:uppercase;letter-spacing:.06em\\">Ceiling</div><div style=\\"font-size:14px;font-weight:600\\">'+fmtN(totCeil)+'</div><div style=\\"font-size:11px;color:var(--ink3)\\">sqft</div></div>';
  html+='<div style=\\"text-align:center\\"><div style=\\"font-size:10px;color:var(--ink3);text-transform:uppercase;letter-spacing:.06em\\">Trims</div><div style=\\"font-size:14px;font-weight:600\\">'+fmtN(totTrims)+'</div><div style=\\"font-size:11px;color:var(--ink3)\\">lin ft</div></div>';
  html+='<div style=\\"text-align:center\\"><div style=\\"font-size:10px;color:var(--ink3);text-transform:uppercase;letter-spacing:.06em\\">Doors</div><div style=\\"font-size:14px;font-weight:600\\">'+totDoors+'</div><div style=\\"font-size:11px;color:var(--ink3)\\">total</div></div>';
  html+='</div>';

    // ── Duration ──
  html+=section('Duration of Work');
  html+=para('The Contractor will commence work on the scheduled date and is expected to complete the work in approximately <strong>'+days+' day(s)</strong>, subject to any unforeseen delays.');

    // ── Payment Terms ──
  html+=section('Payment Terms');
  html+=para('The total cost for the Services shall be <strong>'+fmt(total)+'</strong>, which includes labour, materials, and any applicable taxes. A different payment plan can be discussed.');
  html+='<div style=\\"display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin:10px 0\\">';
  html+='<div style=\\"background:var(--cream2);padding:12px;border-radius:var(--r)\\">';
  html+='<div style=\\"font-size:10px;color:var(--ink3);text-transform:uppercase;letter-spacing:.06em\\">10% Deposit</div>';
  html+='<div style=\\"font-size:15px;font-weight:600;color:var(--ink);margin:4px 0\\">'+fmt(dep)+'</div>';
  html+='<div style=\\"font-size:11px;color:var(--ink3)\\">Due on first day</div>';
  html+='</div>';
  html+='<div style=\\"background:var(--cream2);padding:12px;border-radius:var(--r)\\">';
  html+='<div style=\\"font-size:10px;color:var(--ink3);text-transform:uppercase;letter-spacing:.06em\\">45% Balance</div>';
  html+='<div style=\\"font-size:15px;font-weight:600;color:var(--ink);margin:4px 0\\">'+fmt(bal45)+'</div>';
  html+='<div style=\\"font-size:11px;color:var(--ink3)\\">Due midway through</div>';
  html+='</div>';
  html+='<div style=\\"background:var(--cream2);padding:12px;border-radius:var(--r)\\">';
  html+='<div style=\\"font-size:10px;color:var(--ink3);text-transform:uppercase;letter-spacing:.06em\\">Final Balance</div>';
  html+='<div style=\\"font-size:15px;font-weight:600;color:var(--ink);margin:4px 0\\">'+fmt(fin)+'</div>';
  html+='<div style=\\"font-size:11px;color:var(--ink3)\\">Due on completion</div>';
  html+='</div>';
  html+='</div>';

    // ── Changes & Modifications ──
  html+=section('Changes and Modifications');
  html+=para('Any changes or modifications to the Scope of Work must be agreed upon in writing by both the Client and the Contractor. Additional work or changes may result in additional charges.');

    // ── Warranties ──
  html+=section('Warranties');
  html+=para('The Contractor warrants that the Services provided will be performed in a professional manner and in accordance with industry standards. The Contractor also warrants that all materials used are of good quality and fit for the intended purpose.');

    // ── Liability Protection ──
  html+=section('Liability Protection');
  html+=para('<strong>Insurance:</strong> The Contractor maintains general liability insurance with coverage of <strong>$2,000,000</strong> to protect against any claims arising from the performance of the Services.');
  html+=para('<strong>Limitation of Liability:</strong> The Contractor shall not be liable for any indirect, incidental, or consequential damages arising out of or in connection with the performance of the Services. The total liability of the Contractor for any and all claims shall not exceed the total amount paid by the Client under this Agreement.');
  html+=para('<strong>Damage to Property:</strong> The Contractor will take all reasonable precautions to protect the Client\\'s property. However, the Contractor is not liable for any damage to the property that occurs as a result of pre-existing conditions or any conditions outside the Contractor\\'s control.');

    // ── Termination ──
  html+=section('Termination');
  html+=para('Either party may terminate this Agreement upon written notice if the other party breaches any material term of this Agreement. In the event of termination, the Client shall pay for all Services rendered up to the date of termination.');

    // ── Indemnification ──
  html+=section('Indemnification');
  html+=para('The Client agrees to indemnify and hold harmless the Contractor and its employees, agents, and subcontractors from any claims, damages, or expenses arising from the Client\\'s negligence or breach of this Agreement.');

    // ── Governing Law ──
  html+=section('Governing Law');
  html+=para('This Agreement shall be governed by and construed in accordance with the laws of the Province of Ontario.');

    // ── Entire Agreement ──
  html+=section('Entire Agreement');
  html+=para('This Agreement constitutes the entire understanding between the parties and supersedes all prior agreements, whether oral or written.');

    // ── Signatures ──
  html+=section('Signatures');
  html+=para('By signing below, the parties agree to the terms and conditions outlined in this Agreement.');
  html+='<div style=\\"display:grid;grid-template-columns:1fr 1fr;gap:32px;margin-top:20px\\">';
  html+='<div>';
  html+='<canvas id=\\"sig-client\\" width=\\"320\\" height=\\"80\\" style=\\"border:1px solid var(--cream3);border-radius:var(--r);background:#fff;width:100%;cursor:crosshair\\"></canvas>';
  html+='<div style=\\"font-size:12px;color:var(--ink3);margin-top:4px\\">'+name+' &middot; '+dateStr+'</div>';
  html+='<button onclick=\\"clearSig(\\'sig-client\\')\\" style=\\"margin-top:4px;font-size:11px;padding:3px 10px;border:1px solid var(--cream3);border-radius:var(--r);background:var(--cream);cursor:pointer;color:var(--ink3)\\">Clear</button>';
  html+='</div>';
  html+='<div>';
  html+='<canvas id=\\"sig-contractor\\" width=\\"320\\" height=\\"80\\" style=\\"border:1px solid var(--cream3);border-radius:var(--r);background:#fff;width:100%;cursor:crosshair\\"></canvas>';
  html+='<div style=\\"font-size:12px;color:var(--ink3);margin-top:4px\\">David Truong &middot; '+dateStr+'</div>';
  html+='<button onclick=\\"clearSig(\\'sig-contractor\\')\\" style=\\"margin-top:4px;font-size:11px;padding:3px 10px;border:1px solid var(--cream3);border-radius:var(--r);background:var(--cream);cursor:pointer;color:var(--ink3)\\">Clear</button>';
  html+='</div>';
  html+='</div>';;

  if(sel('contract-body'))sel('contract-body').innerHTML=html;
  setTimeout(function(){try{initSignaturePads();}catch(e){}},100);
}
function initSignaturePads(){
  initSigPad('sig-client');
  initSigPad('sig-contractor');
}
function init(){
  const ds=today();
  sel('topDate').textContent=ds;
  ['q-date','inv-date','con-date','co-date'].forEach(id=>{const e=sel(id);if(e)e.textContent=ds;});
  try{initLabourRates();}catch(e){console.warn('initLabourRates:',e);}
  try{
    loadPaintSettings(function(){
      try{initPaintInputs();}catch(e){console.warn('initPaintInputs:',e);}
    });
  }catch(e){try{initPaintInputs();}catch(e2){console.warn('initPaintInputs:',e2);}}
  try{addRoom();}catch(e){console.warn('addRoom:',e);}
  // loadContactsDropdown is called from React onLoad after session is injected
}
function showTab(id){
  document.querySelectorAll('.tab').forEach(t=>t.classList.remove('active'));
  document.querySelectorAll('.page').forEach(p=>p.classList.remove('active'));
  const tabMap={cover:0,rooms:1,breakdown:2,quote:3,contract:4,changeorder:5,labourrates:6,paintinputs:7,standards:8};
  const tabs=document.querySelectorAll('.tab');
  if(tabMap[id]!==undefined)tabs[tabMap[id]].classList.add('active');
  const pg=sel('page-'+id);if(pg)pg.classList.add('active');
  if(['breakdown','quote','contract','changeorder'].includes(id)){
    try{syncClient();}catch(e){}
    try{recalcAll();}catch(e){
      console.warn('recalcAll error on tab '+id+':',e.message,e.stack&&e.stack.split('\\n').slice(0,4).join(' | '));
      // If recalcAll failed, still try to build contract directly
      if(id==='contract'){try{buildContract(0,0,0,0,0);}catch(e2){console.warn('buildContract direct error:',e2.message);}}
    }
  }
  if(id==='contract'){
    setTimeout(function(){
      try{initSignaturePads();}catch(e){}
      // Safety net: ensure contract body is populated even if recalcAll failed
      var cb=sel('contract-body');
      if(cb&&!cb.innerHTML.trim()){try{buildContract(0,0,0,0,0);}catch(e){}}
    },150);
  }
  if(id==='rooms'){
    setTimeout(function(){
      const firstRoom=rooms[0];
      if(firstRoom){
        const body=document.querySelector('.room-body[data-id="'+firstRoom.id+'"]');
        const arr=sel('arr_'+firstRoom.id);
        if(body&&!body.classList.contains('open')){body.classList.add('open');if(arr)arr.classList.add('open');}
        const ni=sel('room-name-'+firstRoom.id);
        if(ni){ni.focus();ni.select();}
      }
    },80);
  }
}

// Expose functions to global scope for inline onclick handlers
window.updSeg=updSeg;
window.updWinDimIdx=updWinDimIdx;
window.updWinAdd=updWinAdd;
window.updWinRemove=updWinRemove;
window.updWinDim=updWinDim;
window.updCeilSeg=updCeilSeg;
window.showTab=showTab;
window.schedulePaintSave=schedulePaintSave;
window.loadContactsDropdown=loadContactsDropdown;
window.populateDealsDropdown=populateDealsDropdown;
window.ceilPaintOpts=ceilPaintOpts;
window.loadPaintSettings=loadPaintSettings;
window.renderRooms=renderRooms;
window.addRoom=addRoom;
window.removeRoom=removeRoom;
window.toggleRoom=toggleRoom;
window.upd=upd;
window.updPrep=updPrep;
window.updStd=updStd;
window.updWin=updWin;
window.addWin=addWin;
window.removeWin=removeWin;
window.clearSig=clearSig;
window.addChangeItem=addChangeItem;
window.renderChangeItems=renderChangeItems;
window.recalcCO=recalcCO;
window.exportPDF=exportPDF;
window.exportInfoPackage=exportInfoPackage;
window.expandAllAndExport=expandAllAndExport;
window.saveEstimate=saveEstimate;
window.newEstimate=newEstimate;
window.openLoadPanel=openLoadPanel;
window.closeLoadPanel=closeLoadPanel;
window.loadEstimateById=loadEstimateById;
window.deleteEstimate=deleteEstimate;
window.syncClient=syncClient;
window.fillFromContact=fillFromContact;
window.pushToProject=pushToProject;
window.pushDocsToProject=pushDocsToProject;

init();

function savePaintSettings(){
  var token=(_session&&_session.access_token)?_session.access_token:SUPA_KEY;
  var uid=_session&&_session.user?_session.user.id:null;
  if(!uid)return;
  var data={paints:PAINTS,ceilPaints:CEILING_PAINTS,primers:PRIMERS,colours:COLOURS,supplies:SUPPLIES};
  fetch(SUPA_URL+'/rest/v1/paint_settings?id=eq.singleton',{
    method:'PATCH',
    headers:{'apikey':SUPA_KEY,'Authorization':'Bearer '+token,'Content-Type':'application/json','Prefer':'return=minimal'},
    body:JSON.stringify({id:'singleton',user_id:uid,data:data,updated_at:new Date().toISOString()})
  }).then(function(r){
    if(r.status===404||r.status===0||r.statusText==='Not Found'){
      // Row doesn't exist yet, insert
      return fetch(SUPA_URL+'/rest/v1/paint_settings',{
        method:'POST',
        headers:{'apikey':SUPA_KEY,'Authorization':'Bearer '+token,'Content-Type':'application/json','Prefer':'return=minimal'},
        body:JSON.stringify({id:'singleton',user_id:uid,data:data})
      });
    }
  }).catch(function(err){console.warn('savePaintSettings error:',err);});
}

function gv(id){var e=sel(id);return e?e.value:'';}
function upsertPaintSettings(){
  var data={paints:PAINTS,ceilPaints:CEILING_PAINTS,primers:PRIMERS,colours:COLOURS,supplies:SUPPLIES};
  var labourData={
    workers:JSON.parse(JSON.stringify(workers)),
    overheadItems:JSON.parse(JSON.stringify(overheadItems)),
    billable:gv('lr-billable'),buffer:gv('lr-buffer'),matBuffer:gv('lr-mat-buffer'),
    taxes:(function(){var e=sel('lr-taxes');return e?e.checked:true;}()),
    discount:(function(){var e=sel('lr-discount');return e?e.checked:false;}()),
    discountAmt:(function(){var e=sel('lr-discount-amt');return e?e.checked:false;}()),
    discAmt:gv('lr-disc-amt'),
    discPct:gv('lr-disc-pct'),profitTarget:gv('lr-profit-target')
  };
  var standardsData=JSON.parse(JSON.stringify(STANDARDS));
  // Post to React parent which uses its own authenticated session
  window.parent.postMessage({
    type:'KP_SAVE_PAINT_SETTINGS',
    data:data,
    labour:labourData,
    standards:standardsData
  },'*');
}

function sv(id,val){var e=sel(id);if(e&&val!==undefined&&val!=='')e.value=val;}
function loadPaintSettings(cb){
  // Store callback so we can call it when parent sends back the data
  window._paintSettingsCb=cb;
  window.parent.postMessage({type:'KP_LOAD_PAINT_SETTINGS'},'*');
  // Fallback: call cb after 3s even if no response
  var t=setTimeout(function(){if(window._paintSettingsCb){window._paintSettingsCb();window._paintSettingsCb=null;}},3000);
  window._paintSettingsTimeout=t;
}
// Called when React parent sends back paint settings
function applyPaintSettings(settingsData){
  clearTimeout(window._paintSettingsTimeout);
  var cb=window._paintSettingsCb;
  window._paintSettingsCb=null;
  if(!settingsData){if(cb)cb();return;}
  var d=settingsData.data||{};
  var L=settingsData.labour||{};
  var S=settingsData.standards||{};
  if(d.paints&&d.paints.length)PAINTS.splice(0,PAINTS.length,...d.paints);
  if(d.ceilPaints&&d.ceilPaints.length)CEILING_PAINTS.splice(0,CEILING_PAINTS.length,...d.ceilPaints);
  if(d.primers&&d.primers.length)PRIMERS.splice(0,PRIMERS.length,...d.primers);
  if(d.colours&&d.colours.length)COLOURS.splice(0,COLOURS.length,...d.colours);
  if(d.supplies&&d.supplies.length)SUPPLIES.splice(0,SUPPLIES.length,...d.supplies);
  if(S&&Object.keys(S).length){Object.keys(S).forEach(function(surf){if(STANDARDS[surf])Object.assign(STANDARDS[surf],S[surf]);});}
  if(L.workers&&L.workers.length)workers.splice(0,workers.length,...L.workers);
  if(L.overheadItems&&L.overheadItems.length)overheadItems.splice(0,overheadItems.length,...L.overheadItems);
  function sv(id,val){var e=sel(id);if(e&&val!==undefined&&val!==null&&val!=='')e.value=val;}
  try{initLabourRates();}catch(e){}
  sv('lr-billable',L.billable);sv('lr-buffer',L.buffer);sv('lr-mat-buffer',L.matBuffer);
  if(L.taxes!==undefined){var et=sel('lr-taxes');if(et)et.checked=(L.taxes===true||L.taxes==='true');}
  if(L.discount!==undefined){var ed=sel('lr-discount');if(ed)ed.checked=(L.discount===true||L.discount==='true');}
  if(L.discountAmt!==undefined){var eda=sel('lr-discount-amt');if(eda)eda.checked=(L.discountAmt===true||L.discountAmt==='true');}
  sv('lr-disc-amt',L.discAmt);sv('lr-disc-pct',L.discPct);sv('lr-profit-target',L.profitTarget);
  try{recalcRates();}catch(e){}
  if(cb)cb();
}
// Listen for paint settings sent back from React parent
window.addEventListener('message',function(ev){
  if(ev.data&&ev.data.type==='KP_PAINT_SETTINGS_DATA'){
    applyPaintSettings(ev.data.settings);
  }
});

})();


// Contacts dropdown
var _kpMap={};
function loadContactsDropdown(){
  var selEl=document.getElementById('ci-contact-select');
  if(!selEl)return;
  // Data may already be loaded via postMessage — check first
  if(selEl.options.length>1)return;
  // Try Supabase fetch
  var token=(_session&&_session.access_token)?_session.access_token:null;
  var headers={'apikey':SUPA_KEY,'Authorization':'Bearer '+(token||SUPA_KEY)};
  Promise.all([
    fetch(SUPA_URL+'/rest/v1/deals?select=*&order=dealName.asc',{headers:headers}).then(function(r){return r.json();}),
    fetch(SUPA_URL+'/rest/v1/contacts?select=*&order=fullName.asc',{headers:headers}).then(function(r){return r.json();})
  ]).then(function(results){
    var deals=Array.isArray(results[0])?results[0]:[];
    var contacts=Array.isArray(results[1])?results[1]:[];
    populateDealsDropdown(deals,contacts);
  }).catch(function(err){console.warn('loadContactsDropdown error:',err);});
}

function populateDealsDropdown(deals,contacts){
  var selEl=document.getElementById('ci-contact-select');
  if(!selEl||!deals||!deals.length)return;
  var contactMap={};
  (contacts||[]).forEach(function(c){contactMap[c.id]=c;});
  while(selEl.options.length>1)selEl.remove(1);
  deals.forEach(function(deal){
    var contact=contactMap[deal.contact]||{};
    var label=deal.dealName||'Unnamed project';
    var id=String(deal.id);
    _kpMap[id]={
      _isDeal:true,dealId:id,dealName:label,
      fullName:contact.fullName||contact.full_name||contact.name||deal.contactFreeText||'',
      phone:contact.phone||contact.phoneNumber||contact.phone_number||'',
      email:contact.email||'',
      address:deal.address||contact.address||''
    };
    var opt=document.createElement('option');
    opt.value=id;
    var clientName=contact.fullName||deal.contactFreeText||'';
    opt.textContent=label+(clientName?' — '+clientName:'');
    selEl.appendChild(opt);
  });
  console.log('Populated '+deals.length+' projects');
}

// Listen for deals data posted from React parent
window.addEventListener('message',function(evt){
  if(evt.data&&evt.data.type==='KP_DEALS'){
    populateDealsDropdown(evt.data.deals,evt.data.contacts);
  }
  if(evt.data&&evt.data.type==='KP_SESSION'){
    _session=evt.data.session;
  }
});
function fillFromContact(val){
  if(!val)return;
  var c=_kpMap[val];if(!c)return;
  function sv(id,v){var el=document.getElementById(id);if(el){el.value=v||'';el.dispatchEvent(new Event('input'));}}
  sv('ci-name',c.fullName||c.full_name||c.name||'');
  // Strip existing phone formatting before setting so fmtPhone works correctly
  var rawPhone=(c.phone||c.phone_number||'').replace(/\\D/g,'');
  var el_phone=document.getElementById('ci-phone');
  if(el_phone){el_phone.value=rawPhone;fmtPhone(el_phone);}
  sv('ci-email',c.email||'');
  // Split address on first comma: "123 Main St, Toronto ON" -> addr1="123 Main St" addr2="Toronto ON"
  var addr=c.address||c.addr||c.address_line1||'';
  var commaIdx=addr.indexOf(',');
  var addr1=commaIdx>=0?addr.slice(0,commaIdx).trim():addr.trim();
  var addr2=commaIdx>=0?addr.slice(commaIdx+1).trim():(c.city||c.addr2||c.address_line2||'');
  sv('ci-addr1',addr1);
  sv('ci-addr2',addr2);
  syncClient();
}

var _pdfReady=false;
function _loadPDF(cb){
  if(_pdfReady){cb();return;}
  var s1=document.createElement('script');
  s1.src='https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js';
  s1.onload=function(){
    var s2=document.createElement('script');
    s2.src='https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
    s2.onload=function(){_pdfReady=true;cb();};
    document.head.appendChild(s2);
  };
  document.head.appendChild(s1);
}

// Push quote total to connected pipeline project
function pushToProject(){
  var totalEl=sel('q-total');
  if(!totalEl){alert('No total found. Please fill in rooms first.');return;}
  var totalText=totalEl.textContent||totalEl.innerText||'';
  var amount=parseFloat(totalText.replace(/[^0-9.]/g,''));
  if(isNaN(amount)||amount===0){alert('Could not read total amount. Make sure rooms are filled in.');return;}
  var projectSel=sel('ci-contact-select');
  var projectId=projectSel?projectSel.value:'';
  if(!projectId){alert('Please select a project on the Cover tab first.');return;}
  if(!_session||!_session.access_token){alert('Session not ready. Please reload the estimates page.');return;}
  var token=_session.access_token;
  console.log('pushToProject: token prefix',token.slice(0,20),'projectId',projectId);
  var btn=document.querySelector('[onclick=\\"pushToProject()\\"]');
  if(btn){btn._origHtml=btn._origHtml||btn.innerHTML;btn.disabled=true;btn.textContent='Saving…';}
  window.parent.postMessage({type:'KP_PATCH_DEAL',dealId:projectId,data:{value:amount,quote_date:new Date().toISOString().slice(0,10)}},'*');
  if(btn){btn.textContent='\\u2713 Saved!';setTimeout(function(){btn.innerHTML=btn._origHtml||'Project $';btn.disabled=false;},2000);}

}





























































































</script>
</body>
</html>`;

function MasterEstimate(){
  const ref=useRef(null);

  // Listen for PATCH requests from the iframe (which can't reliably use its own session)
  useEffect(()=>{
    const handler=async(ev)=>{
      if(ev.data?.type==='KP_PATCH_DEAL'){
        const {dealId,data}=ev.data;
        if(!dealId||!data)return;
        try{
          await api.saveDeal(data,dealId);
          const existing=DB.deals.find(d=>d.id===dealId);
          if(existing) Object.assign(existing,data);
        }catch(e){console.warn('KP_PATCH_DEAL error:',e);}
      }
      if(ev.data?.type==='KP_LOAD_PAINT_SETTINGS'){
        // Fetch paint settings from Supabase and send back to iframe
        (async()=>{
          try{
            const session=_session;
            if(!session?.access_token||!session?.user?.id)return;
            const rows=await supaFetch(`/rest/v1/paint_settings?user_id=eq.${session.user.id}&select=data,labour,standards`);
            const settings=(rows&&rows.length)?rows[0]:null;
            const win=ref.current?.contentWindow;
            if(win) win.postMessage({type:'KP_PAINT_SETTINGS_DATA',settings},'*');
          }catch(e){console.warn('KP_LOAD_PAINT_SETTINGS error:',e);}
        })();
      }
      if(ev.data?.type==='KP_SAVE_PAINT_SETTINGS'){
        const {data,labour,standards}=ev.data;
        if(!data)return;
        try{
          const session=_session;
          if(!session?.access_token)return;
          const token=session.access_token;
          const uid=session.user?.id||null;
          if(!uid)return;
          const payload={user_id:uid,data,labour,standards,updated_at:new Date().toISOString()};
          // PATCH first, then POST if no rows updated
          const r=await supaFetch(`/rest/v1/paint_settings?user_id=eq.${uid}`,'PATCH',payload);
          // If PATCH updated 0 rows, insert
          const check=await fetch(`${SUPA_URL}/rest/v1/paint_settings?user_id=eq.${uid}&select=id`,{
            headers:{apikey:SUPA_KEY,'Authorization':`Bearer ${token}`}
          });
          const rows=await check.json();
          if(!rows||rows.length===0){
            await supaFetch('/rest/v1/paint_settings','POST',payload);
          }
        }catch(e){console.warn('KP_SAVE_PAINT_SETTINGS error:',e);}
      }
    };
    window.addEventListener('message',handler);
    return ()=>window.removeEventListener('message',handler);
  },[]);
  const onLoad=useCallback(()=>{
    try{
      const win=ref.current?.contentWindow;
      if(!win)return;
      // Inject session
      if(_session?.access_token){
        win._session={access_token:_session.access_token,user:_session.user};
        win.postMessage({type:'KP_SESSION',session:{access_token:_session.access_token,user:_session.user}},'*');
      }
      // Post deals + contacts directly — most reliable approach
      const deals=api.getDeals();
      const contacts=api.getContacts();
      win.postMessage({type:'KP_DEALS',deals,contacts},'*');
      // Also call loadContactsDropdown as fallback
      if(win.loadContactsDropdown) win.loadContactsDropdown();
      // Load paint settings
      if(win.loadPaintSettings) win.loadPaintSettings(function(){
        if(win.initPaintInputs) win.initPaintInputs();
      });
    }catch(e){console.warn('MasterEstimate onLoad error:',e);}
  },[]);
  return (
    <div style={{width:'100%',height:'100%',overflow:'hidden'}}>
      <iframe
        ref={ref}
        srcDoc={KP_MASTER_HTML}
        style={{width:'100%',height:'100%',border:'none',display:'block'}}
        title="Kingdom Painting Master Estimate"
        sandbox="allow-scripts allow-same-origin allow-modals allow-downloads allow-forms allow-popups"
        onLoad={onLoad}
      />
    </div>
  );
}

function MasterEstimateOnTab({tab}){
  const ref=useRef(null);
  const onLoad=useCallback(()=>{
    try{
      const win=ref.current?.contentWindow;
      if(!win)return;
      if(_session?.access_token) win._session={access_token:_session.access_token,user:_session.user};
      // Post deals directly into iframe
      const deals=api.getDeals();
      const contacts=api.getContacts();
      win.postMessage({type:'KP_DEALS',deals,contacts},'*');
      if(win.loadContactsDropdown) win.loadContactsDropdown();
      if(win.showTab) win.showTab(tab);
    }catch(e){}
    setTimeout(()=>{
      try{
        const win=ref.current?.contentWindow;
        if(!win)return;
        if(_session?.access_token) win._session={access_token:_session.access_token,user:_session.user};
        win.postMessage({type:'KP_DEALS',deals:api.getDeals(),contacts:api.getContacts()},'*');
        if(win.showTab) win.showTab(tab);
        if(win.loadContactsDropdown) win.loadContactsDropdown();
      }catch(e){}
    },400);
  },[tab]);
  return (
    <div style={{width:'100%',height:'100%',overflow:'hidden'}}>
      <iframe
        ref={ref}
        srcDoc={KP_MASTER_HTML}
        style={{width:'100%',height:'100%',border:'none',display:'block'}}
        title="Kingdom Painting Invoice"
        sandbox="allow-scripts allow-same-origin allow-modals allow-downloads allow-forms allow-popups"
        onLoad={onLoad}
      />
    </div>
  );
}

// ─── Kingdom Painting SVG Logo (white version, matches estimate page) ─────────
function KPLogo({height=32}){
  return (
    <svg viewBox="0 0 282.7 100" style={{height,width:'auto',display:'block'}} xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="kpg1" gradientUnits="userSpaceOnUse" x1="0" y1="18.05" x2="47.81" y2="18.05">
          <stop offset="0" stopColor="#FDC60D"/>
          <stop offset="0.038" stopColor="#F8C21B"/>
          <stop offset="0.268" stopColor="#E4AD3E"/>
          <stop offset="0.503" stopColor="#D6A04F"/>
          <stop offset="0.743" stopColor="#CE9956"/>
          <stop offset="1" stopColor="#CC9659"/>
        </linearGradient>
      </defs>
      {/* Flame */}
      <path fill="url(#kpg1)" d="M47.4,11.7c-0.3-0.2-0.6-0.2-0.9,0l-11,7.9L24.6,0.4C24.5,0.2,24.2,0,23.9,0c-0.3,0-0.6,0.2-0.7,0.4L12.3,19.6l-11-7.9c-0.3-0.2-0.6-0.2-0.9,0C0.1,11.8,0,12.2,0,12.5l3.5,22.9c0.1,0.3,0.3,0.6,0.7,0.7c0.1,0,0.3,0,0.4-0.1c0,0,4.9-1.4,12-2.1c6.5-0.6,16.4-0.8,26.1,2.1c0.1,0,0.2,0,0.3,0c0.3-0.1,0.6-0.3,0.7-0.7l3.6-22.8C47.8,12.2,47.7,11.8,47.4,11.7z"/>
      {/* Candle – outline only */}
      <path fill="none" stroke="#F7F8F8" strokeWidth="2" d="M43.4,43.5c0-0.2,0-0.4,0-0.6c-0.1-0.3-0.4-0.6-0.7-0.6c-9.6-2.8-19.3-2.7-25.8-2c-6.5,0.6-11.1,1.8-11.8,2c-0.4,0.1-0.6,0.5-0.6,0.9l0,0.5c0,0.7,0,1.5,0,2.2c0,0.4,0.3,0.8,0.5,1c0.5,0.4,0.9,0.7,1.4,1c0.7,0.5,1.4,1,2.1,1.5c1.2,0.8,2.4,1.6,3.6,2.5c1.7,1.2,2.9,2.5,3.9,3.9c2.1,3.2,3.2,6.3,3.6,9.3c0.2,1.9,0.1,3.6-0.3,5.1c-1.5,5.2-2.2,9.8-2.1,14.2c0,2.9,0.4,5.4,1.1,7.8c0.8,2.9,2.1,5.2,3.8,7.2c0.6,0.7,1.4,1.1,2.2,1.1c0.8,0,1.6-0.4,2.1-1.1c0.6-0.8,1.1-1.4,1.5-2.1c1.8-3,2.9-6.4,3.2-10.5c0.3-3.8,0-7.8-0.9-12c-0.2-1-0.5-1.9-0.7-2.9c-0.2-0.7-0.4-1.4-0.5-2.1c-0.5-2.1-0.5-4.3,0.1-6.7c0.5-2.2,1.4-4.3,2.7-6.5c0.6-1,1.3-2,2.1-2.9c1.3-1.2,2.8-2.2,4.1-3.2c0.5-0.4,1-0.7,1.5-1.1c1.2-0.9,2.5-1.7,3.7-2.6c0.3-0.2,0.6-0.5,0.6-1.1C43.4,44.7,43.4,44.1,43.4,43.5z"/>
      <path fill="none" stroke="#F7F8F8" strokeWidth="2" d="M42.9,39.3c-9.6-2.8-19.2-2.7-25.7-2.1c-7,0.7-11.8,2-11.8,2.1c-0.5,0.1-1-0.1-1.1-0.6c-0.1-0.5,0.1-1,0.6-1.1c0.2-0.1,5-1.4,12.1-2.1c6.6-0.6,16.6-0.8,26.4,2.1c0.5,0.1,0.7,0.6,0.6,1.1C43.7,39.1,43.3,39.3,42.9,39.3z"/>
      <circle fill="#F7F8F8" cx="23.9" cy="90.8" r="2.1"/>
      {/* KINGDOM – gold */}
      <path fill="#DCB47E" d="M66.3,49.7V20h6.8v29.7H66.3z M72.4,42.9L72,35l14.2-15h7.6L81.1,33.8l-3.8,4.1L72.4,42.9z M86.6,49.7L76,36.8l4.5-4.9l14.1,17.8H86.6z"/>
      <path fill="#DCB47E" d="M97.7,49.7V20h6.9v29.7H97.7z"/>
      <path fill="#DCB47E" d="M111.6,49.7V20h5.7l17.5,21.4H132V20h6.8v29.7h-5.6l-17.6-21.4h2.8v21.4H111.6z"/>
      <path fill="#DCB47E" d="M160.1,50.2c-2.3,0-4.5-0.4-6.5-1.1s-3.7-1.8-5.1-3.2c-1.5-1.4-2.6-3-3.4-4.9c-0.8-1.9-1.2-3.9-1.2-6.1c0-2.2,0.4-4.3,1.2-6.1s1.9-3.5,3.4-4.9c1.5-1.4,3.2-2.5,5.2-3.2c2-0.7,4.2-1.1,6.5-1.1c2.6,0,5,0.4,7.1,1.3s3.9,2.1,5.3,3.8l-4.4,4.1c-1.1-1.1-2.2-2-3.5-2.5s-2.7-0.8-4.2-0.8c-1.4,0-2.8,0.2-3.9,0.7s-2.2,1.1-3.1,2c-0.9,0.8-1.5,1.9-2,3c-0.5,1.2-0.7,2.4-0.7,3.9c0,1.4,0.2,2.7,0.7,3.8c0.5,1.2,1.1,2.2,2,3c0.9,0.9,1.9,1.5,3.1,2c1.2,0.5,2.5,0.7,3.9,0.7c1.4,0,2.7-0.2,4-0.7s2.5-1.2,3.8-2.2l3.9,5c-1.6,1.2-3.5,2.1-5.6,2.8C164.4,49.9,162.3,50.2,160.1,50.2z M165.9,45.6V34.4h6.3v12L165.9,45.6z"/>
      <path fill="#DCB47E" d="M178.5,49.7V20H192c3.2,0,6.1,0.6,8.5,1.8s4.4,2.9,5.8,5.2s2.1,4.8,2.1,7.8s-0.7,5.6-2.1,7.8s-3.3,3.9-5.8,5.2s-5.3,1.8-8.5,1.8H178.5z M185.4,44.1h6.3c2,0,3.7-0.4,5.2-1.1s2.6-1.8,3.4-3.2s1.2-3,1.2-4.9s-0.4-3.5-1.2-4.9s-1.9-2.4-3.4-3.2s-3.2-1.1-5.2-1.1h-6.3V44.1z"/>
      <path fill="#DCB47E" d="M227.9,50.2c-2.3,0-4.5-0.4-6.5-1.1s-3.7-1.8-5.2-3.2c-1.5-1.4-2.6-3-3.4-4.9s-1.2-3.9-1.2-6.1s0.4-4.2,1.2-6.1s1.9-3.5,3.4-4.9c1.5-1.4,3.2-2.5,5.2-3.2s4.1-1.1,6.4-1.1c2.3,0,4.5,0.4,6.5,1.1s3.7,1.8,5.1,3.2c1.5,1.4,2.6,3,3.4,4.9c0.8,1.9,1.2,3.9,1.2,6.1s-0.4,4.2-1.2,6.1c-0.8,1.9-2,3.5-3.4,4.9c-1.5,1.4-3.2,2.4-5.1,3.2C232.4,49.8,230.2,50.2,227.9,50.2z M227.9,44.4c1.3,0,2.5-0.2,3.7-0.7s2.1-1.1,2.9-2c0.8-0.8,1.5-1.9,2-3c0.5-1.2,0.7-2.4,0.7-3.9s-0.2-2.7-0.7-3.9s-1.1-2.2-2-3s-1.8-1.5-2.9-2s-2.4-0.7-3.7-0.7c-1.3,0-2.6,0.2-3.7,0.7s-2.1,1.1-2.9,2s-1.5,1.9-2,3s-0.7,2.4-0.7,3.9s0.2,2.7,0.7,3.8c0.5,1.2,1.1,2.2,2,3s1.8,1.5,2.9,2C225.3,44.1,226.6,44.4,227.9,44.4z"/>
      <path fill="#DCB47E" d="M249.3,49.7V20h5.7L267.6,41h-3L277,20h5.6l0.1,29.7h-6.4l0-19.8h1.2l-9.9,16.7h-3.1l-10.1-16.7h1.4v19.8H249.3z"/>
      {/* PAINTING INC. – white */}
      <path fill="#F7F8F8" d="M66.6,78.6V58.2h8.8c1.8,0,3.4,0.3,4.7,0.9s2.3,1.4,3.1,2.5s1.1,2.4,1.1,4s-0.4,2.8-1.1,3.9s-1.7,2-3.1,2.5s-2.9,0.9-4.7,0.9h-6.2l2.1-2.1v7.7H66.6z M71.3,71.4l-2.1-2.2h5.9c1.5,0,2.5-0.3,3.3-0.9c0.7-0.6,1.1-1.5,1.1-2.6s-0.4-2-1.1-2.6s-1.8-0.9-3.3-0.9h-5.9l2.1-2.2V71.4z"/>
      <path fill="#F7F8F8" d="M83.9,78.6L93,58.2h4.7l9.1,20.4h-4.9l-7.5-18h1.9l-7.5,18H83.9z M88.4,74.2l1.3-3.6h10.5l1.3,3.6H88.4z"/>
      <path fill="#F7F8F8" d="M108.9,78.6V58.2h4.7v20.4H108.9z"/>
      <path fill="#F7F8F8" d="M118.4,78.6V58.2h3.9l12,14.7h-1.9V58.2h4.7v20.4h-3.9l-12-14.7h1.9v14.7H118.4z"/>
      <path fill="#F7F8F8" d="M146.2,78.6V62.1h-6.5v-3.8h17.8v3.8h-6.5v16.5H146.2z"/>
      <path fill="#F7F8F8" d="M159.9,78.6V58.2h4.7v20.4H159.9z"/>
      <path fill="#F7F8F8" d="M169.5,78.6V58.2h3.9l12,14.7h-1.9V58.2h4.7v20.4h-3.9l-12-14.7h1.9v14.7H169.5z"/>
      <path fill="#F7F8F8" d="M202.8,78.9c-1.6,0-3.1-0.3-4.4-0.8s-2.5-1.2-3.5-2.2s-1.8-2.1-2.3-3.3s-0.8-2.7-0.8-4.2s0.3-2.9,0.8-4.2s1.3-2.4,2.3-3.3s2.2-1.7,3.6-2.2s2.9-0.8,4.5-0.8c1.8,0,3.4,0.3,4.9,0.9s2.7,1.5,3.7,2.6l-3,2.8c-0.7-0.8-1.5-1.4-2.4-1.7s-1.8-0.6-2.9-0.6c-1,0-1.9,0.2-2.7,0.5s-1.5,0.8-2.1,1.3s-1,1.3-1.4,2.1s-0.5,1.7-0.5,2.6s0.2,1.8,0.5,2.6s0.8,1.5,1.4,2.1s1.3,1,2.1,1.4s1.7,0.5,2.7,0.5c0.9,0,1.8-0.2,2.7-0.5s1.7-0.8,2.6-1.5l2.7,3.4c-1.1,0.8-2.4,1.5-3.9,1.9C205.7,78.7,204.3,78.9,202.8,78.9z M206.7,75.7v-7.7h4.3v8.3L206.7,75.7z"/>
      <path fill="#F7F8F8" d="M223.7,78.6V58.2h4.7v20.4H223.7z"/>
      <path fill="#F7F8F8" d="M233.2,78.6V58.2h3.9l12,14.7h-1.9V58.2h4.7v20.4H248l-12-14.7h1.9v14.7H233.2z"/>
      <path fill="#F7F8F8" d="M266.5,78.9c-1.6,0-3-0.3-4.4-0.8s-2.5-1.2-3.5-2.2s-1.8-2.1-2.3-3.3s-0.8-2.7-0.8-4.2s0.3-2.9,0.8-4.2s1.3-2.4,2.3-3.3s2.2-1.7,3.5-2.2s2.8-0.8,4.4-0.8c1.8,0,3.4,0.3,4.8,0.9s2.6,1.5,3.6,2.7l-3,2.8c-0.7-0.8-1.5-1.4-2.3-1.8s-1.8-0.6-2.8-0.6s-1.8,0.2-2.6,0.5s-1.5,0.8-2.1,1.3s-1,1.3-1.4,2.1s-0.5,1.7-0.5,2.6s0.2,1.9,0.5,2.6s0.8,1.5,1.4,2.1s1.3,1,2.1,1.3s1.7,0.5,2.6,0.5s1.9-0.2,2.8-0.6s1.6-1,2.3-1.8l3,2.8c-1,1.2-2.2,2.1-3.6,2.7C269.9,78.6,268.2,78.9,266.5,78.9z"/>
      <path fill="#F7F8F8" d="M279.8,78.8c-0.8,0-1.4-0.3-2-0.8s-0.8-1.2-0.8-2.1s0.3-1.5,0.8-2s1.2-0.8,2-0.8s1.5,0.3,2,0.8s0.8,1.2,0.8,2s-0.3,1.5-0.8,2.1S280.6,78.8,279.8,78.8z"/>
    </svg>
  );
}
// ─── LAYOUT + APP ─────────────────────────────────────────────────────────────
// ─── Financials Page ─────────────────────────────────────────────────────────
function generateInvoicePDF(deal, contactName, contactAddr){
  const revenue     = parseFloat(deal.value)||0;
  const paid        = parseFloat(deal.invoicePaid)||0;
  const outstanding = Math.max(0, revenue - paid);
  const today       = new Date().toLocaleDateString('en-CA',{year:'numeric',month:'long',day:'numeric'});
  const addr        = contactAddr||deal.address||'—';
  const fmt = n => '$'+n.toLocaleString('en-CA',{minimumFractionDigits:2,maximumFractionDigits:2});
  const esc = s => String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');

  const html = '<!DOCTYPE html>'
    +'<html><head><meta charset="UTF-8">'
    +'<title>Invoice \u2014 '+esc(deal.dealName||'Project')+'</title>'
    +'<link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;600;700&display=swap" rel="stylesheet"/>'
    +'<style>'
    +'*{box-sizing:border-box;margin:0;padding:0}'
    +'body{font-family:\'Montserrat\',sans-serif;font-size:13px;color:#1a1714;background:#fff;padding:48px 56px}'
    +'.doc-header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:32px;padding-bottom:24px;border-bottom:2px solid #1a1714}'
    +'.kp-logo{height:48px;width:auto;display:block}'
    +'.doc-type{font-size:11px;color:#1a1714;font-weight:500;text-transform:uppercase;letter-spacing:.14em;margin-top:4px}'
    +'.doc-meta{font-size:12px;color:#555;line-height:2.2;text-align:right}'
    +'.doc-meta strong{color:#1a1714}'
    +'.project-title{font-size:16px;font-weight:700;color:#1a1714;margin-bottom:24px;padding-bottom:12px;border-bottom:1px solid #e5ddd0}'
    +'.inv-table{width:100%;border-collapse:collapse;margin-bottom:0}'
    +'.inv-table td{padding:16px 18px;font-size:14px;border-bottom:1px solid #ece8e1}'
    +'.inv-table tr:last-child td{border-bottom:none}'
    +'.inv-table .label{color:#7a6e65;font-weight:500;width:60%}'
    +'.inv-table .amount{text-align:right;font-weight:600;font-size:15px}'
    +'.outstanding-row td{background:#1a1714;color:#fff;font-size:17px;font-weight:700}'
    +'.outstanding-row .label{color:rgba(255,255,255,0.75)}'
    +'.inv-wrap{background:#f9f7f4;border-radius:10px;overflow:hidden;border:1px solid #e5ddd0}'
    +'.footer-note{margin-top:32px;padding:14px 16px;background:#f2ede6;border-radius:8px;font-size:12px;color:#3d3530;line-height:1.8;text-align:center}'
    +'@media print{body{padding:24px 32px}}'
    +'</style></head><body>'
    +'<div class="doc-header">'
    +'<div style="display:flex;align-items:center;gap:12px">'
    +'<img class="kp-logo" src="'+LOGO_PNG+'" alt="Kingdom Painting"/>'
    +'<div>'
    +'<div style="font-family:\'Montserrat\',sans-serif;font-size:14px;font-weight:700;color:#C4922A;letter-spacing:0.05em;text-transform:uppercase">Kingdom Painting Inc.</div>'
    +'<div class="doc-type">Invoice</div>'
    +'</div></div>'
    +'<div class="doc-meta">'
    +'<div><strong>Client</strong> '+esc(contactName||'\u2014')+'</div>'
    +(addr&&addr!=='\u2014'?'<div><strong>Address</strong> '+esc(addr)+'</div>':'')
    +'<div><strong>Date</strong> '+esc(today)+'</div>'
    +'<div><strong>HST #</strong> 71164 5556 RT0001</div>'
    +'</div></div>'
    +'<div class="project-title">'+esc(deal.dealName||'Painting Services')+(deal.description?' \u2014 '+esc(deal.description):'')+'</div>'
    +'<div class="inv-wrap"><table class="inv-table">'
    +'<tr><td class="label">Invoice Total</td><td class="amount">'+fmt(revenue)+'</td></tr>'
    +'<tr><td class="label">Amount Paid</td><td class="amount">'+fmt(paid)+'</td></tr>'
    +'<tr class="outstanding-row"><td class="label">Outstanding</td><td class="amount">'+fmt(outstanding)+'</td></tr>'
    +'</table></div>'
    +'<div class="footer-note">Thank you for your business!</div>'
    +'<script>window.onload=function(){window.print();}<\/script>'
    +'</body></html>';

  // Open print window
  const win = window.open('','_blank','width=860,height=900');
  if(win){ win.document.write(html); win.document.close(); }

  // Save invoice HTML to Supabase deal record
  if(deal.id){
    const session=_session||null;
    const token=session?.access_token;
    supaFetch(`/rest/v1/deals?id=eq.${deal.id}`,'PATCH',{invoice_html:html})
      .then(()=>{
        // Refresh local DB
        const d=DB.deals.find(x=>x.id===deal.id);
        if(d) d.invoice_html=html;
      })
      .catch(e=>console.warn('invoice save error:',e));
  }
}


function InvoicePage({showToast}){
  const [deals,setDeals]=useState(()=>api.getDeals().filter(d=>['Scheduled','Completed','Archive'].includes(d.stage)&&!(d.labels||[]).includes('Lost')));
  const [contacts,setContacts]=useState(()=>api.getContacts());
  const [sortKey,setSortKey]=useState('date');
  const [sortDir,setSortDir]=useState('desc');

  useEffect(()=>{
    api.loadDeals().then(()=>{ setDeals(api.getDeals().filter(d=>['Scheduled','Completed','Archive'].includes(d.stage)&&!(d.labels||[]).includes('Lost'))); setContacts(api.getContacts()); });
  },[]);

  const contactName=deal=>{
    const c=contacts.find(x=>x.id===(deal.contact||deal.contactId));
    return c?.fullName||deal.contactFreeText||'—';
  };

  const contactAddr=deal=>{
    const c=contacts.find(x=>x.id===(deal.contact||deal.contactId));
    return c?.address||deal.address||'';
  };

  const dealDate=deal=>{
    if(deal.endDate) return new Date(deal.endDate);
    const days=deal.scheduleDays||[];
    if(days.length) return new Date(days[days.length-1].date);
    if(deal.created_at) return new Date(deal.created_at);
    return new Date(0);
  };

  const saveTimers=useRef({});
  const savePaid=async(dealId,val)=>{
    const parsed=Math.max(0,parseFloat(val)||0);
    // Update UI immediately
    setDeals(prev=>prev.map(d=>d.id===dealId?{...d,invoicePaid:parsed}:d));
    DB.deals=DB.deals.map(d=>d.id===dealId?{...d,invoicePaid:parsed}:d);
    // Debounce Supabase write — wait 600ms after last keystroke
    clearTimeout(saveTimers.current[dealId]);
    saveTimers.current[dealId]=setTimeout(async()=>{
      try{
        await supaFetch(`/rest/v1/deals?id=eq.${dealId}`,'PATCH',{invoicepaid:parsed});
        if(showToast) showToast('Saved','success');
      }catch(e){
        console.warn('Invoice save:',e.message);
        if(showToast) showToast('Save failed','error');
      }
    },600);
  };

  const handleSort=key=>{
    if(sortKey===key) setSortDir(d=>d==='asc'?'desc':'asc');
    else{ setSortKey(key); setSortDir('asc'); }
  };

  const sortedDeals=[...deals].sort((a,b)=>{
    let av,bv;
    const rev=d=>parseFloat(d.value)||0;
    const paid=d=>parseFloat(d.invoicePaid)||0;
    const outstanding=d=>Math.max(0,rev(d)-paid(d));
    switch(sortKey){
      case 'project': av=(a.dealName||'').toLowerCase(); bv=(b.dealName||'').toLowerCase(); break;
      case 'client':  av=contactName(a).toLowerCase(); bv=contactName(b).toLowerCase(); break;
      case 'date':    av=dealDate(a).getTime(); bv=dealDate(b).getTime(); break;
      case 'revenue': av=rev(a); bv=rev(b); break;
      case 'paid':    av=paid(a); bv=paid(b); break;
      case 'outstanding': av=outstanding(a); bv=outstanding(b); break;
      default: av=0; bv=0;
    }
    if(av<bv) return sortDir==='asc'?-1:1;
    if(av>bv) return sortDir==='asc'?1:-1;
    return 0;
  });

  const totalOutstandingCount=sortedDeals.filter(d=>Math.max(0,(parseFloat(d.value)||0)-(parseFloat(d.invoicePaid)||0))>0).length;
  const totalOutstandingAmt=sortedDeals.reduce((s,d)=>s+Math.max(0,(parseFloat(d.value)||0)-(parseFloat(d.invoicePaid)||0)),0);

  const thStyle={padding:'8px 12px',textAlign:'left',fontSize:11,fontWeight:600,textTransform:'uppercase',letterSpacing:'0.05em',color:'var(--muted-fg)',whiteSpace:'nowrap',borderBottom:'1px solid var(--border)'};
  const tdStyle={padding:'10px 12px',fontSize:13,borderBottom:'1px solid var(--border)',verticalAlign:'middle'};
  const inp={width:'100%',padding:'5px 8px',fontSize:13,border:'1px solid var(--border)',borderRadius:6,background:'var(--bg)',color:'var(--fg)',textAlign:'right'};

  const SortTh=({col,label,right})=>(
    <th style={{...thStyle,textAlign:right?'right':'left',cursor:'pointer',userSelect:'none'}} onClick={()=>handleSort(col)}>
      <span style={{display:'inline-flex',alignItems:'center',gap:4,justifyContent:right?'flex-end':'flex-start'}}>
        {label}
        <span style={{fontSize:10,color:sortKey===col?'var(--primary)':'var(--border)'}}>{sortKey===col?(sortDir==='asc'?'▲':'▼'):'⇅'}</span>
      </span>
    </th>
  );

  return (
    <div style={{padding:24,overflowY:'auto',height:'100%',boxSizing:'border-box'}}>
      <h2 style={{fontSize:18,fontWeight:700,marginBottom:20}}>Invoices</h2>

      {/* Summary boxes */}
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16,marginBottom:24}}>
        <div style={{background:'var(--card)',border:'1px solid var(--border)',borderRadius:10,padding:'16px 20px',boxShadow:'var(--shadow-sm)'}}>
          <p style={{fontSize:11,fontWeight:600,textTransform:'uppercase',letterSpacing:'0.06em',color:'var(--muted-fg)',marginBottom:6}}>Outstanding Invoices</p>
          <p style={{fontSize:32,fontWeight:700,color:'var(--primary)'}}>{totalOutstandingCount}</p>
          <p style={{fontSize:11,color:'var(--muted-fg)',marginTop:4}}>project{totalOutstandingCount!==1?'s':''} with balance owing</p>
        </div>
        <div style={{background:'var(--card)',border:'1px solid var(--border)',borderRadius:10,padding:'16px 20px',boxShadow:'var(--shadow-sm)'}}>
          <p style={{fontSize:11,fontWeight:600,textTransform:'uppercase',letterSpacing:'0.06em',color:'var(--muted-fg)',marginBottom:6}}>Outstanding Amount</p>
          <p style={{fontSize:32,fontWeight:700,color:'#ef4444'}}>{fmtUSD(totalOutstandingAmt)}</p>
          <p style={{fontSize:11,color:'var(--muted-fg)',marginTop:4}}>total balance owing</p>
        </div>
      </div>

      {/* Table */}
      <div style={{background:'var(--card)',border:'1px solid var(--border)',borderRadius:10,overflow:'hidden',boxShadow:'var(--shadow-sm)'}}>
        <div style={{overflowX:'auto'}}>
          <table style={{width:'100%',borderCollapse:'collapse',minWidth:640}}>
            <thead>
              <tr style={{background:'var(--muted)'}}>
                <SortTh col='project' label='Project'/>
                <SortTh col='client' label='Client'/>
                <SortTh col='date' label='Date'/>
                <SortTh col='revenue' label='Revenue' right/>
                <SortTh col='paid' label='Paid' right/>
                <SortTh col='outstanding' label='Outstanding' right/>
                <th style={{...thStyle,textAlign:'center'}}>Generate</th>
              </tr>
            </thead>
            <tbody>
              {sortedDeals.length===0&&(
                <tr><td colSpan={6} style={{...tdStyle,textAlign:'center',color:'var(--muted-fg)',padding:'32px 0'}}>No projects yet. Add projects in Pipeline.</td></tr>
              )}
              {sortedDeals.map(deal=>{
                const revenue=parseFloat(deal.value)||0;
                const paid=parseFloat(deal.invoicePaid)||0;
                const outstanding=Math.max(0,revenue-paid);
                const outColor=outstanding>0?'#ef4444':'#22c55e';
                const dateStr=deal.endDate||(deal.scheduleDays?.length?deal.scheduleDays[deal.scheduleDays.length-1].date:null);
                return (
                  <tr key={deal.id}
                    onMouseEnter={e=>e.currentTarget.style.background='var(--muted)'}
                    onMouseLeave={e=>e.currentTarget.style.background=''}>
                    <td style={{...tdStyle,fontWeight:500,maxWidth:180,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{deal.dealName||'Unnamed'}</td>
                    <td style={{...tdStyle,color:'var(--muted-fg)'}}>{contactName(deal)}</td>
                    <td style={{...tdStyle,color:'var(--muted-fg)',whiteSpace:'nowrap'}}>{dateStr||'—'}</td>
                    <td style={{...tdStyle,textAlign:'right',fontWeight:600}}>{fmtUSD(revenue)}</td>
                    <td style={{...tdStyle,textAlign:'right',padding:'6px 8px'}}>
                      <input type='number' min='0' value={paid||''} placeholder='0.00'
                        onChange={ev=>savePaid(deal.id,ev.target.value)}
                        style={inp}/>
                    </td>
                    <td style={{...tdStyle,textAlign:'right',fontWeight:700,color:outColor}}>{fmtUSD(outstanding)}</td>
                    <td style={{...tdStyle,textAlign:'center'}}>
                      <button onClick={()=>generateInvoicePDF(deal,contactName(deal),contactAddr(deal))}
                        style={{background:'var(--primary)',color:'#fff',border:'none',borderRadius:6,padding:'5px 12px',fontSize:11,fontWeight:600,cursor:'pointer',whiteSpace:'nowrap',display:'inline-flex',alignItems:'center',gap:4}}>
                        <FileText size={11}/>PDF
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            {sortedDeals.length>0&&(
              <tfoot>
                <tr style={{background:'var(--muted)'}}>
                  <td colSpan={3} style={{...tdStyle,fontWeight:600,fontSize:11,color:'var(--muted-fg)'}}>Totals — {sortedDeals.length} project{sortedDeals.length!==1?'s':''}</td>
                  <td style={{...tdStyle,textAlign:'right',fontWeight:700}}>{fmtUSD(sortedDeals.reduce((s,d)=>s+(parseFloat(d.value)||0),0))}</td>
                  <td style={{...tdStyle,textAlign:'right',fontWeight:700}}>{fmtUSD(sortedDeals.reduce((s,d)=>s+(parseFloat(d.invoicePaid)||0),0))}</td>
                  <td style={{...tdStyle,textAlign:'right',fontWeight:700,color:'#ef4444'}}>{fmtUSD(totalOutstandingAmt)}</td>
                  <td style={tdStyle}/>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  );
}

function Financials({showToast}){
  const [deals,setDeals]=useState(()=>api.getDeals().filter(d=>['Scheduled','Completed','Archive'].includes(d.stage)&&!(d.labels||[]).includes('Lost')));
  const [contacts,setContacts]=useState(()=>api.getContacts());
  const [saving,setSaving]=useState({});
  const [sortKey,setSortKey]=useState('date');
  const [sortDir,setSortDir]=useState('desc'); // newest first by default

  // Load deals fresh from Supabase on mount to get latest materials/wages
  useEffect(()=>{
    api.loadDeals().then(()=>{
      setDeals(api.getDeals().filter(d=>['Scheduled','Completed','Archive'].includes(d.stage)&&!(d.labels||[]).includes('Lost')));
      setContacts(api.getContacts());
    });
  },[]);

  const load=()=>{ setDeals(api.getDeals().filter(d=>['Scheduled','Completed','Archive'].includes(d.stage)&&!(d.labels||[]).includes('Lost'))); setContacts(api.getContacts()); };

  const saveRow=async(dealId,field,val)=>{
    const parsed=parseFloat(val)||0;
    setDeals(prev=>prev.map(d=>d.id===dealId?{...d,[field]:parsed}:d));
    DB.deals=DB.deals.map(d=>d.id===dealId?{...d,[field]:parsed}:d);
    setSaving(prev=>({...prev,[dealId+field]:true}));
    try{
      await supaFetch(`/rest/v1/deals?id=eq.${dealId}`,'PATCH',{[field]:parsed});
    }catch(e){ console.warn('Financials save:',e.message); }
    setSaving(prev=>({...prev,[dealId+field]:false}));
  };

  const contactName=deal=>{
    const c=contacts.find(x=>x.id===(deal.contact||deal.contactId));
    return c?.fullName||deal.contactFreeText||'—';
  };

  const dealDate=deal=>{
    if(deal.endDate) return new Date(deal.endDate);
    const days=deal.scheduleDays||[];
    if(days.length) return new Date(days[days.length-1].date);
    if(deal.created_at) return new Date(deal.created_at);
    return new Date(0);
  };

  const endDate=deal=>{
    const d=dealDate(deal);
    if(!d||d.getTime()===0) return '—';
    if(deal.endDate) return deal.endDate;
    const days=deal.scheduleDays||[];
    if(days.length) return days[days.length-1].date;
    return '—';
  };

  const getRow=deal=>{
    const quote=parseFloat(deal.value)||0;
    const materials=parseFloat(deal.materials)||0;
    const wages=parseFloat(deal.wages)||0;
    const labour=Math.max(0,quote-materials);
    const grossProfit=quote-materials-wages;
    return {quote,materials,wages,labour,grossProfit};
  };

  // Sorting
  const handleSort=key=>{
    if(sortKey===key) setSortDir(d=>d==='asc'?'desc':'asc');
    else{ setSortKey(key); setSortDir(key==='date'?'desc':'asc'); }
  };

  const sortedDeals=[...deals].sort((a,b)=>{
    let av,bv;
    switch(sortKey){
      case 'date': av=dealDate(a).getTime(); bv=dealDate(b).getTime(); break;
      case 'client': av=contactName(a).toLowerCase(); bv=contactName(b).toLowerCase(); break;
      case 'revenue': av=getRow(a).quote; bv=getRow(b).quote; break;
      case 'labour': av=getRow(a).labour; bv=getRow(b).labour; break;
      case 'materials': av=getRow(a).materials; bv=getRow(b).materials; break;
      case 'wages': av=getRow(a).wages; bv=getRow(b).wages; break;
      case 'grossProfit': av=getRow(a).grossProfit; bv=getRow(b).grossProfit; break;
      default: av=0; bv=0;
    }
    if(av<bv) return sortDir==='asc'?-1:1;
    if(av>bv) return sortDir==='asc'?1:-1;
    return 0;
  });

  // Summary stats — Scheduled→Archive only
  const activeDeals = deals.filter(d=>['Scheduled','Completed','Archive'].includes(d.stage));
  const totalRevenue=activeDeals.reduce((s,d)=>s+getRow(d).quote,0);
  const totalGP=activeDeals.reduce((s,d)=>s+getRow(d).grossProfit,0);
  const totalProjects=activeDeals.length;

  // Profit Margin: (gross profit / revenue) * 100
  const profitMarginF = totalRevenue>0 ? (totalGP/totalRevenue)*100 : 0;

  // Avg Project Value: revenue / total projects
  const avgProjectValueF = totalProjects>0 ? totalRevenue/totalProjects : 0;

  // Conversion Rate — Scheduled→Archive only
  const allDeals = api.getDeals().filter(d=>['Scheduled','Completed','Archive'].includes(d.stage));
  const invoiceDealsF = allDeals.filter(d=>!(d.labels||[]).includes('Lost'));
  const paidOffDealsF = invoiceDealsF.filter(d=>(parseFloat(d.value)||0)>0 && Math.max(0,(parseFloat(d.value)||0)-(parseFloat(d.invoicePaid)||0))===0);
  const conversionRateF = allDeals.length>0 ? (paidOffDealsF.length/allDeals.length)*100 : 0;

  // Monthly data for charts (last 6 months)
  const now=new Date();
  const monthlyData=Array.from({length:6},(_,i)=>{
    const d=new Date(now); d.setMonth(d.getMonth()-5+i);
    const yr=d.getFullYear(); const mo=d.getMonth();
    const month=d.toLocaleString('en',{month:'short'});
    const monthDeals=activeDeals.filter(dd=>{
      const dt=dealDate(dd);
      return dt && dt.getTime()!==0 && dt.getFullYear()===yr && dt.getMonth()===mo;
    });
    const revenue=monthDeals.reduce((s,dd)=>s+getRow(dd).quote,0);
    const gp=monthDeals.reduce((s,dd)=>s+getRow(dd).grossProfit,0);
    return {month,revenue,grossProfit:gp,projects:monthDeals.length};
  });

  const inp={background:'var(--muted)',border:'1px solid var(--border)',borderRadius:6,padding:'5px 8px',fontSize:12,color:'var(--fg)',width:'100%',textAlign:'right'};
  const tdStyle={padding:'8px 10px',borderBottom:'1px solid var(--border)',fontSize:12,verticalAlign:'middle'};
  const thStyle={padding:'8px 10px',fontSize:11,fontWeight:700,textTransform:'uppercase',letterSpacing:'0.05em',color:'var(--muted-fg)',borderBottom:'2px solid var(--border)',whiteSpace:'nowrap',textAlign:'left'};

  return (
    <div style={{padding:'20px 24px',overflowY:'auto',height:'100%',display:'flex',flexDirection:'column',gap:20}}>
      <div>
        <h1 style={{fontSize:22,fontWeight:700}}>Financials</h1>
        <p style={{fontSize:13,color:'var(--muted-fg)',marginTop:2}}>{totalProjects} projects · Enter Materials & Wages to calculate profit</p>
      </div>

      {/* ── Row 1: Conversion Rate + Profit Margin + Avg Project Value ── */}
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:14}}>
        <Card style={{padding:'20px 22px',display:'flex',flexDirection:'column',gap:6}}>
          <p style={{fontSize:10,fontWeight:700,textTransform:'uppercase',letterSpacing:'0.06em',color:'var(--muted-fg)'}}>Conversion Rate</p>
          <p style={{fontSize:42,fontWeight:800,color:'var(--primary)',lineHeight:1}}>{conversionRateF.toFixed(1)}<span style={{fontSize:22,fontWeight:600}}>%</span></p>
        </Card>
        <Card style={{padding:'20px 22px',display:'flex',flexDirection:'column',gap:6}}>
          <p style={{fontSize:10,fontWeight:700,textTransform:'uppercase',letterSpacing:'0.06em',color:'var(--muted-fg)'}}>Profit Margin</p>
          <p style={{fontSize:42,fontWeight:800,color:profitMarginF>=0?'#22c55e':'#ef4444',lineHeight:1}}>{profitMarginF.toFixed(1)}<span style={{fontSize:22,fontWeight:600}}>%</span></p>
        </Card>
        <Card style={{padding:'20px 22px',display:'flex',flexDirection:'column',gap:6}}>
          <p style={{fontSize:10,fontWeight:700,textTransform:'uppercase',letterSpacing:'0.06em',color:'var(--muted-fg)'}}>Avg Project Value</p>
          <p style={{fontSize:36,fontWeight:800,color:'var(--primary)',lineHeight:1}}>{fmtUSD(avgProjectValueF)}</p>
        </Card>
      </div>

      {/* ── Stat cards ── */}
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:14,flexShrink:0}}>
        {[
          {label:'Total Revenue',value:fmtUSD(totalRevenue),color:'var(--primary)'},
          {label:'Total Profit',value:fmtUSD(totalGP),color:totalGP>=0?'#22c55e':'#ef4444'},
          {label:'Profit Margin',value:profitMarginF.toFixed(1)+'%',color:profitMarginF>=0?'#22c55e':'#ef4444'},
        ].map(({label,value,color})=>(
          <Card key={label} style={{padding:'14px 18px'}}>
            <p style={{fontSize:10,fontWeight:700,textTransform:'uppercase',letterSpacing:'0.06em',color:'var(--muted-fg)',marginBottom:4}}>{label}</p>
            <p style={{fontSize:28,fontWeight:700,color,lineHeight:1}}>{value}</p>
          </Card>
        ))}
      </div>

      {/* ── Row 2: charts ── */}
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:14}}>
        <Card style={{display:'flex',flexDirection:'column'}}>
          <div style={{padding:'10px 14px 4px',fontWeight:600,fontSize:12}}>Monthly Revenue</div>
          <div style={{padding:'0 14px 10px'}}>
            <ResponsiveContainer width='100%' height={160}>
              <BarChart data={monthlyData} margin={{top:4,right:4,left:0,bottom:4}}>
                <CartesianGrid strokeDasharray='3 3' stroke='var(--border)'/>
                <XAxis dataKey='month' tick={{fontSize:9}}/>
                <YAxis tick={{fontSize:9}} tickFormatter={v=>`$${(v/1000).toFixed(0)}k`}/>
                <Tooltip formatter={v=>[`$${v.toLocaleString()}`,'Revenue']} contentStyle={{background:'var(--card)',border:'1px solid var(--border)',borderRadius:8,fontSize:11}}/>
                <Bar dataKey='revenue' fill='var(--primary)' radius={[3,3,0,0]}/>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
        <Card style={{display:'flex',flexDirection:'column'}}>
          <div style={{padding:'10px 14px 4px',fontWeight:600,fontSize:12}}>Monthly Gross Profit</div>
          <div style={{padding:'0 14px 10px'}}>
            <ResponsiveContainer width='100%' height={160}>
              <BarChart data={monthlyData} margin={{top:4,right:4,left:0,bottom:4}}>
                <CartesianGrid strokeDasharray='3 3' stroke='var(--border)'/>
                <XAxis dataKey='month' tick={{fontSize:9}}/>
                <YAxis tick={{fontSize:9}} tickFormatter={v=>`$${(v/1000).toFixed(0)}k`}/>
                <Tooltip formatter={v=>[`$${v.toLocaleString()}`,'Gross Profit']} contentStyle={{background:'var(--card)',border:'1px solid var(--border)',borderRadius:8,fontSize:11}}/>
                <Bar dataKey='grossProfit' fill='#22c55e' radius={[3,3,0,0]}/>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
        <Card style={{display:'flex',flexDirection:'column'}}>
          <div style={{padding:'10px 14px 4px',fontWeight:600,fontSize:12}}>Projects / Month</div>
          <div style={{padding:'0 14px 10px'}}>
            <ResponsiveContainer width='100%' height={160}>
              <LineChart data={monthlyData} margin={{top:4,right:4,left:0,bottom:4}}>
                <CartesianGrid strokeDasharray='3 3' stroke='var(--border)'/>
                <XAxis dataKey='month' tick={{fontSize:9}}/>
                <YAxis tick={{fontSize:9}} allowDecimals={false}/>
                <Tooltip formatter={v=>[v,'Projects']} contentStyle={{background:'var(--card)',border:'1px solid var(--border)',borderRadius:8,fontSize:11}}/>
                <Line type='monotone' dataKey='projects' stroke='var(--primary)' strokeWidth={2} dot={{fill:'var(--primary)',r:2}}/>
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      {/* ── Financials table ── */}
      <Card>
        <div style={{overflowX:'auto'}}>
          <table style={{width:'100%',borderCollapse:'collapse',minWidth:800}}>
            <thead>
              <tr style={{background:'var(--muted)'}}>
                <th style={thStyle}>Project</th>
                {[
                  {key:'client',label:'Client',align:'left'},
                  {key:'date',label:'Date',align:'left'},
                  {key:'revenue',label:'Revenue',align:'right'},
                  {key:'labour',label:'Labour',align:'right'},
                  {key:'materials',label:'Materials',align:'right'},
                  {key:'wages',label:'Wages',align:'right'},
                  {key:'grossProfit',label:'Gross Profit',align:'right'},
                ].map(({key,label,align})=>(
                  <th key={key} style={{...thStyle,textAlign:align,cursor:'pointer',userSelect:'none',whiteSpace:'nowrap'}}
                    onClick={()=>handleSort(key)}>
                    <span style={{display:'inline-flex',alignItems:'center',gap:4,justifyContent:align==='right'?'flex-end':'flex-start'}}>
                      {label}
                      <span style={{fontSize:10,color:sortKey===key?'var(--primary)':'var(--border)',fontWeight:400}}>
                        {sortKey===key?(sortDir==='asc'?'▲':'▼'):'⇅'}
                      </span>
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sortedDeals.length===0&&(
                <tr><td colSpan={8} style={{...tdStyle,textAlign:'center',color:'var(--muted-fg)',padding:'32px 0'}}>No projects yet. Add projects in Pipeline.</td></tr>
              )}
              {sortedDeals.map(deal=>{
                const {quote,materials,wages,labour,grossProfit}=getRow(deal);
                const gpColor=grossProfit>0?'#22c55e':grossProfit<0?'#ef4444':'var(--fg)';
                return (
                  <tr key={deal.id} style={{transition:'background 0.1s'}}
                    onMouseEnter={e=>e.currentTarget.style.background='var(--muted)'}
                    onMouseLeave={e=>e.currentTarget.style.background=''}>
                    <td style={{...tdStyle,fontWeight:500,maxWidth:180,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{deal.dealName||'Unnamed'}</td>
                    <td style={{...tdStyle,color:'var(--muted-fg)'}}>{contactName(deal)}</td>
                    <td style={{...tdStyle,color:'var(--muted-fg)',whiteSpace:'nowrap'}}>{endDate(deal)}</td>
                    <td style={{...tdStyle,textAlign:'right',fontWeight:600}}>{fmtUSD(quote)}</td>
                    <td style={{...tdStyle,textAlign:'right',color:'var(--muted-fg)'}}>{fmtUSD(labour)}</td>
                    <td style={{...tdStyle,textAlign:'right',padding:'4px 6px'}}>
                      <input type='number' min='0' value={deal.materials||''} placeholder='0.00'
                        onChange={ev=>saveRow(deal.id,'materials',ev.target.value)}
                        style={inp}/>
                    </td>
                    <td style={{...tdStyle,textAlign:'right',padding:'4px 6px'}}>
                      <input type='number' min='0' value={deal.wages||''} placeholder='0.00'
                        onChange={ev=>saveRow(deal.id,'wages',ev.target.value)}
                        style={inp}/>
                    </td>
                    <td style={{...tdStyle,textAlign:'right',fontWeight:700,color:gpColor}}>{fmtUSD(grossProfit)}</td>
                  </tr>
                );
              })}
            </tbody>
            {deals.length>0&&(
              <tfoot>
                <tr style={{background:'var(--muted)'}}>
                  <td style={{...tdStyle,fontWeight:700,fontSize:12}}>
                    <span style={{background:'rgba(212,169,106,0.15)',color:'var(--primary)',padding:'2px 8px',borderRadius:6,fontSize:11,fontWeight:700}}>{totalProjects} project{totalProjects!==1?'s':''}</span>
                  </td>
                  <td style={{...tdStyle,fontWeight:600,color:'var(--muted-fg)',fontSize:11}}>Totals</td>
                  <td style={tdStyle}/>
                  <td style={{...tdStyle,textAlign:'right',fontWeight:700}}>{fmtUSD(totalRevenue)}</td>
                  <td style={{...tdStyle,textAlign:'right',fontWeight:700}}>{fmtUSD(deals.reduce((s,d)=>s+getRow(d).labour,0))}</td>
                  <td style={{...tdStyle,textAlign:'right',fontWeight:700}}>{fmtUSD(deals.reduce((s,d)=>s+getRow(d).materials,0))}</td>
                  <td style={{...tdStyle,textAlign:'right',fontWeight:700}}>{fmtUSD(deals.reduce((s,d)=>s+getRow(d).wages,0))}</td>
                  <td style={{...tdStyle,textAlign:'right',fontWeight:700,color:totalGP>=0?'#22c55e':'#ef4444'}}>{fmtUSD(totalGP)}</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </Card>
    </div>
  );
}

const NAV=[
  {id:'dashboard',Icon:LayoutDashboard,label:'Dashboard'},
  {id:'pipeline',Icon:Kanban,label:'Pipeline'},
  {id:'estimates',Icon:FileText,label:'Estimates'},
  {id:'contacts',Icon:UserRound,label:'Contacts'},
  {id:'invoice',Icon:Receipt,label:'Invoice'},
  {id:'financials',Icon:DollarSign,label:'Financials'},
];

// ─── Login Screen ─────────────────────────────────────────────────────────────
function LoginScreen(){
  const [mode, setMode] = useState('login'); // 'login' | 'signup'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  const submit = async () => {
    if(!email || !password){ setError('Please enter email and password'); return; }
    setLoading(true); setError('');
    try{
      if(mode === 'login'){
        await signIn(email, password);
      } else {
        const res = await signUp(email, password);
        if(!res.access_token){
          setMessage('Check your email to confirm your account, then sign in.');
          setMode('login'); setLoading(false); return;
        }
      }
    } catch(e){
      setError(e.message);
    }
    setLoading(false);
  };

  return (
    <div style={{minHeight:'100vh',background:'#262E4B',display:'flex',alignItems:'center',justifyContent:'center',padding:20}}>
      <style>{STYLE}</style>
      <div style={{width:'100%',maxWidth:400}}>
        {/* Logo above card */}
        <div style={{display:'flex',flexDirection:'column',alignItems:'center',marginBottom:28}}>
          <KPLogo height={52}/>
        </div>
        {/* Card */}
        <div style={{background:'#EDE9DE',borderRadius:16,padding:'32px 28px',boxShadow:'0 8px 40px rgba(0,0,0,.30)'}}>
          <h2 style={{fontSize:20,fontWeight:700,marginBottom:20,color:'#1a1714'}}>
            {mode==='login' ? 'Sign in' : 'Create account'}
          </h2>

          {message && <div style={{background:'rgba(34,197,94,.1)',border:'1px solid rgba(34,197,94,.3)',borderRadius:8,padding:'10px 12px',fontSize:12,color:'#15803d',marginBottom:16}}>{message}</div>}
          {error && <div style={{background:'rgba(239,68,68,.1)',border:'1px solid rgba(239,68,68,.3)',borderRadius:8,padding:'10px 12px',fontSize:12,color:'#dc2626',marginBottom:16}}>{error}</div>}

          <div style={{marginBottom:14}}>
            <label style={{display:'block',fontSize:12,fontWeight:600,color:'#4a3f36',marginBottom:5}}>Email</label>
            <input type="email" value={email} onChange={e=>setEmail(e.target.value)}
              placeholder="you@example.com"
              onKeyDown={e=>e.key==='Enter'&&submit()}
              style={{width:'100%',padding:'10px 13px',border:'1.5px solid #c8bfb4',borderRadius:8,fontSize:13,fontFamily:'inherit',color:'#1a1714',background:'#fff',outline:'none',boxSizing:'border-box',transition:'border-color .15s'}}
              onFocus={e=>e.target.style.borderColor='#C4922A'}
              onBlur={e=>e.target.style.borderColor='#c8bfb4'}/>
          </div>
          <div style={{marginBottom:24}}>
            <label style={{display:'block',fontSize:12,fontWeight:600,color:'#4a3f36',marginBottom:5}}>Password</label>
            <input type="password" value={password} onChange={e=>setPassword(e.target.value)}
              placeholder="••••••••"
              onKeyDown={e=>e.key==='Enter'&&submit()}
              style={{width:'100%',padding:'10px 13px',border:'1.5px solid #c8bfb4',borderRadius:8,fontSize:13,fontFamily:'inherit',color:'#1a1714',background:'#fff',outline:'none',boxSizing:'border-box',transition:'border-color .15s'}}
              onFocus={e=>e.target.style.borderColor='#C4922A'}
              onBlur={e=>e.target.style.borderColor='#c8bfb4'}/>
          </div>

          <button onClick={submit} disabled={loading}
            style={{width:'100%',padding:'12px 0',background:'#C4922A',color:'#fff',border:'none',borderRadius:8,fontSize:14,fontWeight:700,cursor:'pointer',opacity:loading?0.7:1,transition:'opacity 0.15s,background 0.15s',letterSpacing:'0.02em'}}
            onMouseEnter={e=>!loading&&(e.target.style.background='#b07e20')}
            onMouseLeave={e=>e.target.style.background='#C4922A'}>
            {loading ? 'Please wait…' : mode==='login' ? 'Sign In' : 'Create Account'}
          </button>

          <div style={{textAlign:'center',marginTop:18,fontSize:12,color:'#7a6e65'}}>
            {mode==='login' ? "Don't have an account? " : 'Already have an account? '}
            <button onClick={()=>{setMode(mode==='login'?'signup':'login');setError('');setMessage('');}}
              style={{background:'none',border:'none',color:'#C4922A',fontWeight:700,cursor:'pointer',fontSize:12,padding:0}}>
              {mode==='login' ? 'Create one' : 'Sign in'}
            </button>
          </div>
          <div style={{textAlign:'center',marginTop:8,fontSize:12,color:'#7a6e65'}}>
            Client Portal{' '}
            <a href="https://kingdom-crm-kingdompaintings-projects.vercel.app/portal"
              target="_blank" rel="noopener noreferrer"
              style={{color:'#C4922A',fontWeight:700,textDecoration:'none'}}>
              click here
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function App(){
  const [page,setPage]=useState('dashboard');
  const [toast,setToast]=useState(null);
  const [ready,setReady]=useState(false);
  const [session,setSessionState]=useState(_session);
  const showToast=msg=>setToast(msg);

  // Listen for auth changes
  useEffect(()=>{
    const unsub = onAuthChange(s=>setSessionState(s));
    return unsub;
  },[]);

  // Bootstrap DB only when authenticated
  useEffect(()=>{
    if(session){
      bootstrapDB().finally(()=>setReady(true));
    } else {
      setReady(false);
    }
  },[session]);

  if(!session) return <LoginScreen/>;

  return (
    <>
      <style>{STYLE}</style>
      <div style={{display:'flex',flexDirection:'column',minHeight:'100vh',height:'100vh',overflow:'hidden',background:'var(--bg)'}}>
        {/* Brand bar */}
        <header style={{background:'var(--fg)',flexShrink:0,boxShadow:'0 1px 3px rgba(0,0,0,.3)'}}>
          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'0 20px',height:50}}>
            <KPLogo height={34}/>
            <div style={{display:'flex',alignItems:'center',gap:12}}>
              <span style={{fontSize:11,color:'rgba(255,255,255,0.45)'}}>{session.user?.email}</span>
              <button onClick={signOut} style={{background:'none',border:'1px solid rgba(255,255,255,0.2)',color:'rgba(255,255,255,0.6)',borderRadius:6,padding:'4px 10px',fontSize:11,cursor:'pointer'}}>Sign out</button>
              <DbStatusDot/>
            </div>
          </div>
        </header>
        {/* Scrollable tab bar */}
        <div style={{background:'var(--fg)',borderBottom:'1px solid rgba(255,255,255,.08)',flexShrink:0,overflowX:'auto',scrollbarWidth:'none'}}>
          <style>{`::-webkit-scrollbar{display:none}`}</style>
          <nav style={{display:'flex',padding:'0 20px',minWidth:'max-content'}}>
            {NAV.map(({id,Icon,label})=>(
              <button key={id} onClick={()=>setPage(id)} style={{display:'flex',alignItems:'center',gap:6,padding:'9px 14px',border:'none',borderBottom:page===id?'2px solid #DCB47E':'2px solid transparent',cursor:'pointer',fontSize:12,fontWeight:500,whiteSpace:'nowrap',letterSpacing:'0.03em',textTransform:'uppercase',transition:'all 0.15s',background:'transparent',color:page===id?'#DCB47E':'rgba(255,255,255,0.5)'}}>
                <Icon size={13}/>{label}
              </button>
            ))}
          </nav>
        </div>
        <main style={{flex:1,overflow:'hidden'}}>
          {!ready
            ? <div style={{display:'flex',alignItems:'center',justifyContent:'center',height:'100%',color:'var(--muted-fg)',fontSize:13}}>Loading…</div>
            : <>
              {page==='dashboard'&&<Dashboard showToast={showToast}/>}
              {page==='pipeline'&&<Pipeline showToast={showToast}/>}
              {page==='estimates'&&<MasterEstimate/>}
              {page==='invoice'&&<InvoicePage showToast={showToast}/>}
              {page==='contacts'&&<Contacts showToast={showToast}/>}
              {page==='financials'&&<Financials showToast={showToast}/>}
            </>
          }
        </main>
      </div>
      {toast&&<Toast msg={toast} onDone={()=>setToast(null)}/>}
    </>
  );
}
