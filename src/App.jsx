
import { useState, useEffect, useCallback, useRef } from "react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  LineChart, Line, PieChart, Pie, Cell,
} from "recharts";
import {
  LayoutDashboard, Kanban, UserRound, Activity, FileText,
  Plus, Search, Pencil, Trash2, Globe, Building2, Phone, Mail,
  MapPin, Star, CalendarDays, StickyNote, CheckSquare, DollarSign,
  TrendingUp, Percent, Layers, ArrowRight, ArrowLeft,
  ChevronRight, ChevronDown, Archive as ArchiveIcon, Receipt, BarChart2,
  Save, Loader2, GripVertical, Printer, Download, Eye,
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

function DrivePickerBtn({onAttach}){
  const [open,setOpen]=useState(false);
  const [files,setFiles]=useState([]);
  const [loading,setLoading]=useState(false);
  const [query,setQuery]=useState('');

  const load=async()=>{
    setLoading(true);
    // Drive files are attached via paste URL — no MCP import needed at build time
    setLoading(false);
  };

  if(!open)return (
    <button onClick={()=>setOpen(true)} style={{fontSize:11,fontWeight:600,padding:'3px 10px',borderRadius:6,border:'1px solid #4285f4',background:'#fff',color:'#4285f4',cursor:'pointer',display:'flex',alignItems:'center',gap:4}}>
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none"><path d="M6.5 20L1 11l4-7h14l4 7-5.5 9H6.5z" stroke="#4285f4" strokeWidth="1.5"/><path d="M8.5 20L14 11H1" stroke="#4285f4" strokeWidth="1.5"/><path d="M23 11H14l-5.5 9" stroke="#4285f4" strokeWidth="1.5"/></svg>
      Attach from Drive
    </button>
  );

  return (
    <div style={{position:'relative'}}>
      <button onClick={()=>setOpen(false)} style={{fontSize:11,fontWeight:600,padding:'3px 10px',borderRadius:6,border:'1px solid #4285f4',background:'#e8f0fe',color:'#4285f4',cursor:'pointer'}}>✕ Close</button>
      <div style={{position:'absolute',right:0,top:28,background:'var(--card)',border:'1px solid var(--border)',borderRadius:10,boxShadow:'0 4px 20px rgba(0,0,0,.15)',width:360,zIndex:200,padding:14}}>
        <p style={{fontSize:12,fontWeight:600,color:'var(--fg)',marginBottom:10}}>Attach Google Drive file</p>
        <p style={{fontSize:11,color:'var(--muted-fg)',marginBottom:10}}>Paste a Google Drive share link:</p>
        <input
          style={{width:'100%',padding:'7px 10px',border:'1px solid var(--border)',borderRadius:6,fontSize:12,color:'var(--fg)',background:'var(--card)',outline:'none',marginBottom:8}}
          placeholder="https://drive.google.com/file/d/..."
          value={query}
          onChange={e=>setQuery(e.target.value)}
        />
        <input
          id="drive-fname"
          style={{width:'100%',padding:'7px 10px',border:'1px solid var(--border)',borderRadius:6,fontSize:12,color:'var(--fg)',background:'var(--card)',outline:'none',marginBottom:10}}
          placeholder="File name (e.g. Project Photos)"
        />
        <div style={{display:'flex',gap:8,justifyContent:'flex-end'}}>
          <button onClick={()=>{setOpen(false);setQuery('');}} style={{fontSize:11,padding:'5px 12px',borderRadius:6,border:'1px solid var(--border)',background:'var(--card)',color:'var(--fg)',cursor:'pointer'}}>Cancel</button>
          <button onClick={()=>{
            const url=query.trim();
            const name=document.getElementById('drive-fname')?.value?.trim()||'Drive File';
            if(!url){return;}
            // Extract file ID from Drive URL
            const match=url.match(/\/d\/([^/]+)/)||url.match(/id=([^&]+)/);
            const id=match?match[1]:url;
            onAttach({id,name,url:url.includes('drive.google.com')?url:`https://drive.google.com/file/d/${id}/view`,type:'drive'});
            setOpen(false);setQuery('');
          }} style={{fontSize:11,padding:'5px 14px',borderRadius:6,border:'none',background:'#4285f4',color:'#fff',cursor:'pointer',fontWeight:600}}>Attach</button>
        </div>
      </div>
    </div>
  );
}

function DealModal({open,onClose,deal,contacts,onSaved,defaultStage='Lead'}){
  const blank={dealName:'',value:'',description:'',contactId:'',referralContactId:'',labels:[],leadSource:'',
    startDate:'',startTime:'09:00',endDate:'',endTime:'17:00',
    scheduleDays:[], // [{date, startTime, endTime, calEventId}]
    address:'',notes:'',rooms:[],progress:0,contactFreeText:'',quote_html:'',contract_html:'',change_order_html:'',invoice_html:'',contract_signed_html:'',contract_signed_at:'',quote_date:'',drive_files:[]};
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
        drive_files:deal.drive_files||[],
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
      drive_files:f.drive_files&&f.drive_files.length?f.drive_files:null,
      projectCalEventId:projectCalEventId||undefined,
    },deal?.id);
    // Auto-create task if stage changed to Scheduled
    if(f.stage==='Scheduled' && deal?.stage!=='Scheduled'){
      const dealObj={id:deal?.id,...f};
      await autoCreateScheduledTask(dealObj, api.getContacts());
    }
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
      {/* Documents section */}
      <div style={{marginBottom:12,padding:10,background:'var(--muted)',borderRadius:8,border:'1px solid var(--border)'}}>
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:8}}>
          <p style={{fontSize:10,fontWeight:700,textTransform:'uppercase',letterSpacing:'0.07em',color:'var(--fg)'}}>📄 Documents</p>
          <DrivePickerBtn dealId={f.id} onAttach={file=>{
            const files=[...(f.drive_files||[]),file];
            setF(x=>({...x,drive_files:files}));
            api.saveDeal({drive_files:files},f.id);
            DB.deals=DB.deals.map(x=>x.id===f.id?{...x,drive_files:files}:x);
          }}/>
        </div>
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
                }} style={{fontSize:11,padding:'2px 8px',borderRadius:5,border:'1px solid var(--border)',background:'var(--card)',color:'var(--muted-fg)',cursor:'pointer',fontWeight:500}}>🗑 Delete</button>
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
          {/* Google Drive attachments */}
          {(f.drive_files||[]).map((file,i)=>(
            <div key={file.id||i} style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'4px 8px',background:'rgba(66,133,244,0.08)',borderRadius:6,border:'1px solid rgba(66,133,244,0.2)'}}>
              <a href={file.url} target="_blank" rel="noopener noreferrer" style={{fontSize:12,fontWeight:600,color:'#1a73e8',display:'flex',alignItems:'center',gap:5,textDecoration:'none'}}>
                <img src="https://ssl.gstatic.com/docs/doctype/images/icon_12_generic_list.png" style={{width:14,height:14}} alt=""/>
                {file.name}
              </a>
              <button onClick={async()=>{
                if(!window.confirm(`Remove "${file.name}"?`))return;
                const files=(f.drive_files||[]).filter((_,j)=>j!==i);
                setF(x=>({...x,drive_files:files}));
                await api.saveDeal({drive_files:files.length?files:null},f.id);
                DB.deals=DB.deals.map(x=>x.id===f.id?{...x,drive_files:files}:x);
              }} style={{fontSize:11,padding:'2px 8px',borderRadius:5,border:'1px solid var(--border)',background:'var(--card)',color:'var(--muted-fg)',cursor:'pointer',fontWeight:500}}>🗑</button>
            </div>
          ))}
        </div>
      </div>
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
      <div style={{display:'flex',flexDirection:'column',gap:14}}>
        {/* Title */}
        <div><Label>Task Title</Label><Input value={f.title} onChange={e=>setF(x=>({...x,title:e.target.value}))} placeholder='What needs to be done?'/></div>

        {/* Details */}
        <div><Label>Details / Notes</Label><Textarea value={f.details} onChange={e=>setF(x=>({...x,details:e.target.value}))} rows={2} placeholder='Add details, instructions, or notes…'/></div>

        {/* Subtasks */}
        <div>
          <Label>Subtasks{f.subtasks.length>0&&<span style={{color:'var(--muted-fg)',fontWeight:400,marginLeft:6}}>{doneCount}/{f.subtasks.length}</span>}</Label>
          <div style={{border:'1px solid var(--border)',borderRadius:6,overflow:'hidden',background:'var(--card)'}}>
            {f.subtasks.map((s,i)=>(
              <div key={i} style={{display:'flex',alignItems:'center',gap:10,padding:'8px 12px',borderBottom:i<f.subtasks.length-1?'1px solid var(--border)':'none'}}>
                <input type='checkbox' checked={s.completed} onChange={()=>toggleSub(i)}
                  style={{cursor:'pointer',accentColor:'var(--primary)',width:14,height:14,flexShrink:0}}/>
                <span style={{flex:1,fontSize:13,textDecoration:s.completed?'line-through':'none',color:s.completed?'var(--muted-fg)':'var(--fg)'}}>{s.title}</span>
                <button onClick={()=>removeSub(i)} style={{background:'none',border:'none',cursor:'pointer',color:'var(--muted-fg)',fontSize:16,padding:'0 2px',lineHeight:1,display:'flex',alignItems:'center'}}>×</button>
              </div>
            ))}
            {f.subtasks.length===0&&<p style={{padding:'8px 12px',fontSize:12,color:'var(--muted-fg)'}}>No subtasks yet.</p>}
          </div>
          <div style={{display:'flex',gap:8,marginTop:8}}>
            <Input value={newSub} onChange={e=>setNewSub(e.target.value)}
              onKeyDown={e=>e.key==='Enter'&&(e.preventDefault(),addSub())}
              placeholder='Add subtask…' style={{flex:1}}/>
            <Btn onClick={addSub} disabled={!newSub.trim()}>Add</Btn>
          </div>
        </div>

        {/* Due date + time */}
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
          <div><Label>Due Date</Label><Input type='date' value={f.dueDate} onChange={e=>setF(x=>({...x,dueDate:e.target.value}))}/></div>
          <div><Label>Due Time</Label><Input type='time' value={f.dueTime} onChange={e=>setF(x=>({...x,dueTime:e.target.value}))}/></div>
        </div>

        {/* Contact + Project */}
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
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

        {/* Priority + completed */}
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
          <div><Label>Priority</Label>
            <Select value={f.priority} onChange={e=>setF(x=>({...x,priority:e.target.value}))}>
              {['none','low','medium','high'].map(p=><option key={p} value={p}>{p.charAt(0).toUpperCase()+p.slice(1)}</option>)}
            </Select>
          </div>
          <div style={{display:'flex',alignItems:'flex-end',paddingBottom:2}}>
            <label style={{display:'flex',alignItems:'center',gap:8,cursor:'pointer',fontSize:13,color:'var(--fg)',fontWeight:500,padding:'8px 12px',border:'1px solid var(--border)',borderRadius:6,background:'var(--card)',width:'100%'}}>
              <input type='checkbox' checked={f.completed} onChange={e=>setF(x=>({...x,completed:e.target.checked}))} style={{cursor:'pointer',accentColor:'var(--primary)',width:14,height:14}}/>
              Completed
            </label>
          </div>
        </div>

        {/* Actions */}
        <div style={{display:'flex',gap:8,justifyContent:'flex-end',paddingTop:4,borderTop:'1px solid var(--border)'}}>
          <Btn variant='outline' onClick={onClose}>Cancel</Btn>
          <Btn onClick={save} disabled={!f.title||saving}>{saving?'Saving…':'Save Task'}</Btn>
        </div>
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

  // Quotes / month: count deals with quote_date, avg across distinct months
  const quoteDates = deals.filter(d=>d.quote_date).map(d=>d.quote_date.slice(0,7));
  const quoteMonthCounts = {};
  quoteDates.forEach(m=>{ quoteMonthCounts[m]=(quoteMonthCounts[m]||0)+1; });
  const quotesPerMonth = Object.keys(quoteMonthCounts).length>0
    ? Object.values(quoteMonthCounts).reduce((s,v)=>s+v,0)/Object.keys(quoteMonthCounts).length
    : 0;

  // Avg projects / month: count deals with endDate, avg across distinct months
  const endDates = deals.filter(d=>d.endDate).map(d=>d.endDate.slice(0,7));
  const endMonthCounts = {};
  endDates.forEach(m=>{ endMonthCounts[m]=(endMonthCounts[m]||0)+1; });
  const projectsPerMonth = Object.keys(endMonthCounts).length>0
    ? Object.values(endMonthCounts).reduce((s,v)=>s+v,0)/Object.keys(endMonthCounts).length
    : 0;

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
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,flexShrink:0}}>
          <StatCard label='Total Revenue' value={fmtUSD(totalRevenue)}/>
          <StatCard label='Total Profit' value={fmtUSD(totalProfit)} color={totalProfit>=0?'#22c55e':'#ef4444'}/>
        </div>

        {/* Row 5 — Quotes/Month + Avg Projects/Month */}
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,flexShrink:0}}>
          <StatCard label='Quotes / Month (avg)' value={quotesPerMonth.toFixed(1)} color='var(--primary)'/>
          <StatCard label='Projects / Month (avg)' value={projectsPerMonth.toFixed(1)} color='var(--primary)'/>
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


// Auto-create task when deal moves to Scheduled
async function autoCreateScheduledTask(deal, contacts){
  try{
    const cid=Array.isArray(deal.contact)?deal.contact[0]:deal.contact;
    const contact=contacts.find(c=>c.id===cid);
    const dueDate=deal.startDate?deal.startDate.slice(0,10):'';
    const dueTime=deal.startDate&&deal.startDate.includes('T')?deal.startDate.slice(11,16):'';
    const taskData={
      type:'Task',
      title:`${deal.dealName||'Project'} — Prep`,
      details:`Auto-created when project moved to Scheduled.`,
      dueDate,
      dueTime,
      contactId:cid||'',
      dealId:deal.id,
      priority:'high',
      completed:false,
      subtasks:[
        {title:'Buy paint',completed:false},
        {title:'Google review',completed:false},
      ],
    };
    await api.saveActivity(taskData);
  }catch(e){console.warn('autoCreateScheduledTask error:',e);}
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
      const newStage=STAGES[idx+1];
      await api.saveDeal({stage:newStage},deal.id);
      if(newStage==='Scheduled') await autoCreateScheduledTask(deal,contacts);
      showToast(`Moved to ${newStage}`);
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
    if(stage==='Scheduled') await autoCreateScheduledTask(deal,contacts);
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


function PortalInviteBtn({email,showToast}){
  const [status,setStatus]=useState(null); // null | 'exists' | 'none' | 'loading' | 'sent'
  useEffect(()=>{
    let cancelled=false;
    supaFetch(`/rest/v1/rpc/check_portal_user`,'POST',{user_email:email}).then(exists=>{
      if(!cancelled)setStatus(exists?'exists':'none');
    }).catch(()=>{if(!cancelled)setStatus('none');});
    return ()=>{cancelled=true;};
  },[email]);

  if(status===null)return null;

  if(status==='exists')return (
    <span style={{fontSize:10,fontWeight:700,background:'#d1fae5',color:'#065f46',padding:'2px 8px',borderRadius:20,display:'inline-flex',alignItems:'center',gap:4}}>
      ✓ Portal access
    </span>
  );

  const sendInvite=async(e)=>{
    e.stopPropagation();
    setStatus('loading');
    // Send password reset email — client clicks link to set password and gains access
    const {error}=await createSupabaseClient().auth.resetPasswordForEmail(email,{
      redirectTo:window.location.origin+'/portal'
    });
    if(error){setStatus('none');showToast('Could not send invite: '+error.message);}
    else{setStatus('sent');showToast('Portal invite sent to '+email);}
  };

  if(status==='sent')return (
    <span style={{fontSize:10,fontWeight:700,background:'#fef9c3',color:'#a16207',padding:'2px 8px',borderRadius:20}}>
      Invite sent
    </span>
  );

  return (
    <button onClick={sendInvite} disabled={status==='loading'} style={{fontSize:10,fontWeight:700,background:'var(--primary)',color:'#fff',border:'none',padding:'2px 10px',borderRadius:20,cursor:'pointer',opacity:status==='loading'?0.6:1}}>
      {status==='loading'?'Sending…':'Invite to Portal'}
    </button>
  );
}

function createSupabaseClient(){
  // Minimal Supabase client for auth operations using the anon key
  const url=SUPA_URL;
  const key=SUPA_KEY;
  return {auth:{resetPasswordForEmail:async(email,opts)=>{
    try{
      const res=await fetch(url+'/auth/v1/recover',{
        method:'POST',
        headers:{'apikey':key,'Content-Type':'application/json'},
        body:JSON.stringify({email,gotrue_meta_security:{},options:{emailRedirectTo:opts?.redirectTo}})
      });
      if(!res.ok){const t=await res.text();return {error:{message:t.slice(0,80)}};}
      return {error:null};
    }catch(e){return {error:{message:e.message}};}
  }}};
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
                  <div style={{display:'flex',gap:12,flexWrap:'wrap',alignItems:'center'}}>
                    {contact.email&&<span style={{fontSize:11,color:'var(--muted-fg)',display:'flex',gap:3,alignItems:'center'}}><Mail size={10}/>{contact.email}</span>}
                    {contact.phone&&<span style={{fontSize:11,color:'var(--muted-fg)',display:'flex',gap:3,alignItems:'center'}}><Phone size={10}/>{contact.phone}</span>}
                    {contact.address&&<span style={{fontSize:11,color:'var(--muted-fg)',display:'flex',gap:3,alignItems:'center'}}><MapPin size={10}/>{contact.address}</span>}
                    {contact.email&&<PortalInviteBtn email={contact.email} showToast={showToast}/>}
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



// ─── ESTIMATE DEFAULTS & CONSTANTS ───────────────────────────────────────────
const SHEENS = ['Flat','Matte','Eggshell','Satin','Pearl','Semi-Gloss','TBD'];

const DEFAULT_PAINTS = [
  {n:'Benjamin Moore - Ultra Spec',g:50,p:225},
  {n:'Benjamin Moore - Ben',g:70,p:0},
  {n:'Benjamin Moore - Aura',g:115,p:535},
  {n:'Benjamin Moore - Aura Bath & Spa',g:110,p:0},
  {n:'Benjamin Moore - Advance',g:75,p:0},
  {n:'Sherwin Williams - Promar 200',g:50,p:225},
  {n:'Sherwin Williams - Duration Home',g:70,p:350},
  {n:'Sherwin Williams - Emerald',g:80,p:400},
  {n:'Sherwin Williams - Promar 400',g:35,p:140},
  {n:'Sherwin Williams - Pro Industrial Epoxy',g:75,p:0},
];
const DEFAULT_CEILING_PAINTS = [
  {n:'Benjamin Moore - Waterborne Ceiling',g:75,p:0},
  {n:'Benjamin Moore - Ultra Spec Ceiling',g:50,p:0},
  {n:'Sherwin Williams - ProMar Ceiling',g:45,p:0},
];
const DEFAULT_PRIMERS = [
  {n:'Benjamin Moore - Drywall Primer',g:35,p:0},
  {n:'Benjamin Moore - Stix Primer',g:85,p:0},
  {n:'Kilz - Original Oil Primer',g:70,p:0},
  {n:'Kilz - PVA Primer',g:25,p:0},
  {n:'Kilz - 1 Primer',g:35,p:0},
  {n:'Kilz - 2 Primer',g:55,p:0},
];
const DEFAULT_COLOURS = [
  {n:'OC-65 Chantilly Lace',h:'#f5f5f2'},{n:'OC-117 Simply White',h:'#f7f4e8'},{n:'OC-17 White Dove',h:'#f3efe3'},
  {n:'OC-20 Pale Oak',h:'#e8ddd1'},{n:'OC-15 Baby Fawn',h:'#ede3d4'},{n:'OC-52 Gray Owl',h:'#d5d6cb'},
  {n:'OC-45 Swiss Coffee',h:'#ede8dc'},{n:'OC-22 Calm',h:'#d9d5c8'},{n:'OC-150 Brilliant White',h:'#f2f2ef'},
  {n:'OC-57 White Heron',h:'#f0ece0'},{n:'AF-50 Etiquette',h:'#e8e0d3'},
  {n:'HC-172 Revere Pewter',h:'#cbc6b8'},{n:'HC-173 Edgecomb Gray',h:'#cfc9bb'},
  {n:'HC-170 Stonington Gray',h:'#b5bab6'},{n:'HC-169 Coventry Gray',h:'#9da0a0'},
  {n:'HC-166 Kendall Charcoal',h:'#74756c'},{n:'HC-165 Boothbay Gray',h:'#afb8b5'},
  {n:'HC-105 Rockport Gray',h:'#979490'},{n:'AF-100 Pashmina',h:'#d4c9ba'},
  {n:'1560 Antique Pewter',h:'#b4b5a6'},
  {n:'HC-154 Hale Navy',h:'#434c59'},{n:'HC-156 Van Deusen Blue',h:'#4a5f75'},
  {n:'HC-144 Palladian Blue',h:'#a8bebe'},{n:'2136-40 Aegean Teal',h:'#617f80'},
  {n:'2123-50 Ocean Air',h:'#92afc0'},{n:"2062-20 Gentleman's Gray",h:'#3d4a57'},
  {n:'1634 Santorini Blue',h:'#6e8fa5'},
  {n:'HC-114 Saybrook Sage',h:'#9ea98c'},{n:'HC-188 Essex Green',h:'#3d4e40'},
  {n:'HC-158 Newburg Green',h:'#4a6057'},{n:'2144-40 Soft Fern',h:'#b1be9a'},
  {n:'1495 October Mist',h:'#b9c1a9'},{n:'462 Vintage Vogue',h:'#8fa08a'},
  {n:'2041-10 Hunter Green',h:'#2e4335'},
  {n:'HC-81 Manchester Tan',h:'#c9b89a'},{n:'HC-76 Davenport Tan',h:'#c2a882'},
  {n:'HC-72 Branchport Brown',h:'#8e6e52'},{n:'HC-9 Chestertown Buff',h:'#d4bc8a'},
  {n:'1001 North Creek Brown',h:'#7a5c42'},{n:'2100-20 Leather Saddle Brown',h:'#7a5038'},
  {n:'2130-10 Black Bean Soup',h:'#3a2820'},{n:'AF-180 Wenge',h:'#4a3830'},
  {n:'AF-290 Caliente',h:'#c13030'},{n:'HC-181 Heritage Red',h:'#8c2020'},
  {n:'2000-10 Red',h:'#b82020'},{n:'2090-40 Wild Flower',h:'#b04860'},
  {n:'2092-30 Boston Brick',h:'#9a4030'},{n:'AF-300 Dinner Party',h:'#7a2020'},
  {n:'105 Terra Mauve',h:'#c27860'},
  {n:'2175-70 Peach Parfait',h:'#f0c8a8'},{n:'AF-185 Venetian Portico',h:'#c87848'},
  {n:'AF-215 Italianate',h:'#c86830'},{n:'070 Topaz',h:'#c88030'},
  {n:'2015-10 Electric Orange',h:'#e05010'},
  {n:'AF-250 Head Over Heels',h:'#e8b8b0'},{n:'1191 Love and Happiness',h:'#e0a0a0'},
  {n:'052 Conch Shell',h:'#e8c0b0'},{n:"1296 Sailor's Delight",h:'#d49090'},
  {n:'2174-60 Dream Whip',h:'#f0d0c8'},{n:'2102-70 First Light',h:'#f0d8d8'},
  {n:'1444 New Age',h:'#a090b0'},{n:'2117-60 Winter Gray',h:'#c0b8c8'},
  {n:'2070-60 Lavender Mist',h:'#c8b8d8'},{n:'2071-60 Lily Lavender',h:'#c8b0d8'},
  {n:'2116-40 Hazy Lilac',h:'#9888a8'},{n:'2117-30 Shadow',h:'#807090'},
  {n:'CSP-305 Crisp Linen',h:'#ece0c0'},{n:'HC-6 Windham Cream',h:'#ead8a0'},
  {n:'2152-50 Golden Straw',h:'#e0c878'},{n:'HC-12 Concord Ivory',h:'#deca90'},
  {n:'HC-11 Marblehead Gold',h:'#d4b860'},
  {n:'HC-190 Black',h:'#1c1c1c'},{n:'2131-10 Black Satin',h:'#2a2820'},
  {n:'2131-20 Midnight',h:'#302e28'},{n:'2120-30 Witching Hour',h:'#2c2a30'},
  {n:'1610 French Beret',h:'#302828'},{n:'2124-10 Wrought Iron',h:'#282c2c'},
];
const DEFAULT_SUPPLIES = [
  {n:'9" Roller',p:6},{n:'18" Roller',p:22},{n:'Mini Roller',p:3},
  {n:'FrogTape 4 Pack',p:38.8},{n:'Floor Shield 36x50',p:32.3},
  {n:'CGC Sheetrock 45 11kg',p:46},{n:'Norton Sanding Sponge',p:5.6},
];
const DEFAULT_OVERHEAD_ITEMS = [
  {n:'Salary',v:50000},{n:'Gas',v:4000},{n:'Sprayer',v:1800},{n:'Ads',v:1000},
  {n:'Company Meals',v:750},{n:'Company Insurance',v:650},{n:'Accountant',v:500},
  {n:'Mechanical',v:500},{n:'Tools',v:500},{n:'Google Workplace',v:120},{n:'Website',v:50},
];
const DEFAULT_WORKERS = [{n:'David',r:40,active:true},{n:'René',r:30,active:true},{n:'Nicky',r:18,active:false}];
const DEFAULT_STANDARDS = {
  walls:{1:200,2:120,3:75},
  flatCeiling:{1:150,2:90,3:55},
  stuccoCeiling:{1:80,2:50,3:35},
  removeStucco:{rate:0.75},
  baseboards:{1:100,2:60,3:40},
  crown:{1:90,2:55,3:35},
  doorFrames:{1:170,2:102,3:65},
  windows:{1:100,2:60,3:40},
  doors:{1:84,2:42,3:21},
  doorsFlat:{1:84,2:42,3:21},
  doors6Panel:{1:70,2:35,3:18},
  doorsCustom:{1:60,2:30,3:15},
};
const DEFAULT_SETTINGS = { hourlyRate:65, labourBuffer:1.25, taxRate:13, discount:0 };

// ─── ESTIMATE HELPER FUNCTIONS ───────────────────────────────────────────────
function newRoom(id, number){
  return {
    id, name:`Room ${number}`, length:0, width:0, height:'', irregular:false, irregularSqft:0, prepHrs:0,
    wallSegs:[{l:0},{l:0},{l:0},{l:0},{l:0},{l:0}],
    ceilSegs:[{l:0,w:0},{l:0,w:0}],
    walls:{enabled:true,coats:2}, ceiling:{enabled:false,coats:2,type:'flat',removeStucco:false},
    baseboards:{enabled:false,coats:2}, crown:{enabled:false,coats:2},
    doorFrames:{enabled:false,coats:2},
    doors:{enabled:false,flat:{count:0,coats:2},sixPanel:{count:0,coats:2},custom:{count:0,coats:2}},
    windows:{enabled:false,coats:2,dims:[{l:0,w:0}]},
    prep:{furniture:false,plastic:false,outlets:false,drywall:false,caulking:false,cleanup:false,custom:''},
    paint:{wallProduct:'',wallColour:'',wallSheen:'',ceilProduct:'',ceilColour:'',ceilSheen:'',trimProduct:'',trimColour:'',trimSheen:'',wallsPrimer:'',ceilingPrimer:'',trimPrimer:''},
    notes:'', supplies:[],
  };
}

function roomWallSqft(room){
  if(room.irregular){
    const h = room.height||0;
    return Math.max(0,(room.wallSegs||[]).reduce((s,seg)=>s+((+seg.l)||0)*h,0)) || (room.irregularSqft||0);
  }
  return Math.max(0, 2*(room.length+room.width)*(room.height||0));
}
function roomCeilSqft(room){
  if(room.irregular && room.ceilSegs?.length){
    const s = room.ceilSegs.reduce((t,seg)=>t+((+seg.l)||0)*((+seg.w)||0),0);
    if(s>0) return s;
  }
  return (room.length||0)*(room.width||0);
}
function roomPerimLF(room){ return 2*((room.length||0)+(room.width||0)); }
function roomWindowLF(room){
  if(!room.windows?.enabled) return 0;
  const dims = room.windows?.dims || [{l:0,w:0}];
  return dims.reduce((t,d)=>t+2*(((+d.l)||0)+((+d.w)||0)),0);
}
function roomDoorCount(room){
  if(!room.doors?.enabled) return 0;
  if(typeof room.doors.count==='number') return room.doors.count;
  return (room.doors.flat?.count||0)+(room.doors.sixPanel?.count||0)+(room.doors.custom?.count||0);
}
function roomTrimLF(room){
  const p = roomPerimLF(room);
  let lf = 0;
  if(room.baseboards?.enabled) lf += p;
  if(room.crown?.enabled) lf += p;
  if(room.doorFrames?.enabled) lf += p;
  if(room.windows?.enabled) lf += roomWindowLF(room);
  return lf;
}

function calcRoom(room, settings){
  const std = settings._standards || DEFAULT_STANDARDS;
  const wallSqft = roomWallSqft(room);
  const ceilSqft = roomCeilSqft(room);
  const perimLF = roomPerimLF(room);
  const winLF = roomWindowLF(room);
  let hrs = 0;
  if(room.walls?.enabled && wallSqft) hrs += wallSqft / (std.walls?.[room.walls.coats] || 120);
  if(room.ceiling?.enabled && ceilSqft){
    const cstd = room.ceiling.type==='stucco' ? (std.stuccoCeiling||std.flatCeiling) : std.flatCeiling;
    hrs += ceilSqft / (cstd?.[room.ceiling.coats] || 90);
    if(room.ceiling.removeStucco) hrs += ceilSqft * (std.removeStucco?.rate || 0.75);
  }
  if(room.baseboards?.enabled && perimLF) hrs += perimLF / (std.baseboards?.[room.baseboards.coats] || 60);
  if(room.crown?.enabled && perimLF) hrs += perimLF / (std.crown?.[room.crown.coats] || 55);
  if(room.doorFrames?.enabled && perimLF) hrs += perimLF / (std.doorFrames?.[room.doorFrames.coats] || 102);
  if(room.doors?.enabled){
    const fl=room.doors.flat||{};const sp=room.doors.sixPanel||{};const cu=room.doors.custom||{};
    if(fl.count>0) hrs+=(fl.count*21)/(std.doorsFlat?.[fl.coats]||std.doors?.[fl.coats]||42);
    if(sp.count>0) hrs+=(sp.count*21)/(std.doors6Panel?.[sp.coats]||std.doors?.[sp.coats]||42);
    if(cu.count>0) hrs+=(cu.count*21)/(std.doorsCustom?.[cu.coats]||std.doors?.[cu.coats]||42);
  } else if(room.doors?.count > 0) hrs += (room.doors.count * 21) / (std.doors?.[room.doors.coats] || 42);
  if(room.windows?.enabled && winLF) hrs += winLF / (std.windows?.[room.windows.coats] || 60);
  hrs += (room.prepHrs || 0);
  const cost = hrs * (settings.hourlyRate || 65) * (settings.labourBuffer || 1.25);
  return { wallSqft, ceilSqft, perimLF, winLF, totalHrs:hrs, cost };
}

function calcTotals(rooms, settings, materialCost=0){
  const labourSubtotal = rooms.reduce((s,r) => s + calcRoom(r,settings).cost, 0);
  const discounted = Math.max(0, labourSubtotal - (settings.discount||0));
  const taxAmt = discounted * ((settings.taxRate||13)/100);
  const total = discounted + taxAmt + materialCost;
  const deposit = total * 0.30;
  const midway = total * 0.35;
  const balance = total - deposit - midway;
  return { labourSubtotal, discounted, taxAmt, total, deposit, midway, balance, materialCost };
}

function calcRoomLines(room, settings){
  const std = settings._standards || DEFAULT_STANDARDS;
  const lines = [];
  const rate = (settings.hourlyRate||65) * (settings.labourBuffer||1.25);
  const wallSqft = roomWallSqft(room);
  const ceilSqft = roomCeilSqft(room);
  const perimLF = roomPerimLF(room);
  const winLF = roomWindowLF(room);
  if(room.walls?.enabled && wallSqft){
    const r = std.walls?.[room.walls.coats]||120;
    const h = wallSqft/r;
    lines.push({surface:'Walls',area:Math.round(wallSqft),areaUnit:'sqft',coats:room.walls.coats,rate:r,rateLabel:'sqft/hr',hours:h,cost:h*rate});
  }
  if(room.ceiling?.enabled && ceilSqft){
    const cstd = room.ceiling.type==='stucco' ? (std.stuccoCeiling||std.flatCeiling) : std.flatCeiling;
    const r = cstd?.[room.ceiling.coats]||90;
    const h = ceilSqft/r;
    lines.push({surface:'Ceiling',area:Math.round(ceilSqft),areaUnit:'sqft',coats:room.ceiling.coats,rate:r,rateLabel:'sqft/hr',hours:h,cost:h*rate});
  }
  if(room.baseboards?.enabled && perimLF){
    const r = std.baseboards?.[room.baseboards.coats]||60;
    const h = perimLF/r;
    lines.push({surface:'Baseboards',area:Math.round(perimLF),areaUnit:'lf',coats:room.baseboards.coats,rate:r,rateLabel:'lf/hr',hours:h,cost:h*rate});
  }
  if(room.crown?.enabled && perimLF){
    const r = std.crown?.[room.crown.coats]||55;
    const h = perimLF/r;
    lines.push({surface:'Crown',area:Math.round(perimLF),areaUnit:'lf',coats:room.crown.coats,rate:r,rateLabel:'lf/hr',hours:h,cost:h*rate});
  }
  if(room.doorFrames?.enabled && perimLF){
    const r = std.doorFrames?.[room.doorFrames.coats]||102;
    const h = perimLF/r;
    lines.push({surface:'Door Frames',area:Math.round(perimLF),areaUnit:'lf',coats:room.doorFrames.coats,rate:r,rateLabel:'lf/hr',hours:h,cost:h*rate});
  }
  if(room.doors?.enabled){
    const types=[['Flat',room.doors.flat,'doorsFlat'],['6 Panel',room.doors.sixPanel,'doors6Panel'],['Custom',room.doors.custom,'doorsCustom']];
    types.forEach(([label,dt,stdKey])=>{
      if(dt?.count>0){
        const r=std[stdKey]?.[dt.coats]||std.doors?.[dt.coats]||42;
        const sqft=dt.count*21;const h=sqft/r;
        lines.push({surface:`Doors - ${label} (${dt.count})`,area:sqft,areaUnit:'sqft',coats:dt.coats,rate:r,rateLabel:'sqft/hr',hours:h,cost:h*rate});
      }
    });
  } else if(room.doors?.count > 0){
    const r = std.doors?.[room.doors.coats]||42;
    const sqft = room.doors.count*21;const h = sqft/r;
    lines.push({surface:`Doors (${room.doors.count})`,area:sqft,areaUnit:'sqft',coats:room.doors.coats,rate:r,rateLabel:'sqft/hr',hours:h,cost:h*rate});
  }
  if(room.windows?.enabled && winLF){
    const r = std.windows?.[room.windows.coats]||60;
    const h = winLF/r;
    lines.push({surface:`Windows (${room.windows.dims?.length||0})`,area:Math.round(winLF),areaUnit:'lf',coats:room.windows.coats,rate:r,rateLabel:'lf/hr',hours:h,cost:h*rate});
  }
  if(room.prepHrs > 0){
    const h = room.prepHrs;
    lines.push({surface:'Prep Work',area:h,areaUnit:'hrs',coats:0,rate:1,rateLabel:'hr',hours:h,cost:h*rate});
  }
  return lines;
}

function calcPaintCosts(rooms, allPaints, allCeilPaints, allPrimers, allColours, matBuffer){
  const colMap = {};
  const addCol = (product,colour,sheen,surface,area)=>{
    if(!product||!area) return;
    const key = `${product}·${colour||''}·${sheen||''}·${surface}`;
    if(!colMap[key]) colMap[key] = {product,colour:colour||'',sheen:sheen||'',surface,area:0};
    colMap[key].area += area;
  };
  rooms.forEach(r=>{
    const ws = roomWallSqft(r), cs = roomCeilSqft(r);
    const trimLF = roomTrimLF(r);
    if(r.walls?.enabled && ws){
      if(r.walls.coats===3 && r.paint?.wallsPrimer){ addCol(r.paint.wallsPrimer,'','','Walls (Primer)',ws); addCol(r.paint.wallProduct,r.paint.wallColour,r.paint.wallSheen,'Walls (2 Coats)',ws*2); }
      else addCol(r.paint?.wallProduct,r.paint?.wallColour,r.paint?.wallSheen,'Walls',ws);
    }
    if(r.ceiling?.enabled && cs){
      if(r.ceiling.coats===3 && r.paint?.ceilingPrimer){ addCol(r.paint.ceilingPrimer,'','','Ceiling (Primer)',cs); addCol(r.paint.ceilProduct,r.paint.ceilColour,r.paint.ceilSheen,'Ceiling (2 Coats)',cs*2); }
      else addCol(r.paint?.ceilProduct,r.paint?.ceilColour,r.paint?.ceilSheen,'Ceiling',cs);
    }
    const hasTrim = r.baseboards?.enabled || r.crown?.enabled || r.doorFrames?.enabled || r.windows?.enabled || r.doors?.enabled || (r.windows?.count>0) || (r.doors?.count>0);
    if(hasTrim && trimLF){
      const needsPrimer = (r.baseboards?.coats===3||r.crown?.coats===3||r.doorFrames?.coats===3||r.doors?.coats===3||r.windows?.coats===3||r.doors?.flat?.coats===3||r.doors?.sixPanel?.coats===3||r.doors?.custom?.coats===3) && r.paint?.trimPrimer;
      if(needsPrimer){ addCol(r.paint.trimPrimer,'','','Trim (Primer)',trimLF); addCol(r.paint.trimProduct,r.paint.trimColour,r.paint.trimSheen,'Trim (2 Coats)',trimLF*2); }
      else addCol(r.paint?.trimProduct,r.paint?.trimColour,r.paint?.trimSheen,'Trim',trimLF);
    }
  });
  const allProducts = [...(allPaints||[]),...(allCeilPaints||[]),...(allPrimers||[])];
  let total = 0;
  const lines = Object.values(colMap).map(cm=>{
    const sqft = cm.area;
    const pObj = allProducts.find(p=>p.n===cm.product);
    let qtyStr = '—', gallons = 0;
    if(sqft > 0){
      gallons = Math.ceil(sqft/350);
      if(sqft <= 1900){ qtyStr = gallons + ' gal'; }
      else { const pails=Math.floor(sqft/1900); const rem=sqft-pails*1900; const eg=rem>0?Math.ceil(rem/350):0; const p2=[]; if(pails>0)p2.push(pails+' pail'+(pails>1?'s':'')); if(eg>0)p2.push(eg+' gal'); qtyStr=p2.join(' + '); }
    }
    const unitPrice = pObj ? (sqft>1900 && pObj.p>0 ? pObj.p : pObj.g||pObj.p||0) : 0;
    const lineCost = unitPrice>0 ? unitPrice*gallons*matBuffer : 0;
    total += lineCost;
    const hex = cm.colour ? ((allColours||[]).find(c=>c.n===cm.colour)?.h||'#ccc') : '';
    return { ...cm, sqft, qtyStr, lineCost, hex };
  });
  return { lines, total };
}

function calcRoomSupplyCost(room, allSupplies){
  return (room.supplies||[]).reduce((t,s)=>{
    if(!s.name) return t;
    const sup = (allSupplies||[]).find(x=>x.n===s.name);
    return t + (sup ? sup.p * ((+s.qty)||1) : 0);
  },0);
}

// Derived paint name arrays — computed from paint settings state
const WALL_PAINTS = DEFAULT_PAINTS.map(p=>p.n);
const TRIM_PAINTS = DEFAULT_PAINTS.map(p=>p.n);
const CEILING_PAINTS = DEFAULT_CEILING_PAINTS.map(p=>p.n);
const COLOURS = DEFAULT_COLOURS.map(c=>c.n);
const CEILING_COLOURS = DEFAULT_COLOURS.map(c=>c.n);

// ─── PAINT SETTINGS HOOK ─────────────────────────────────────────────────────
function usePaintSettings(){
  const [paints, setPaints] = useState(()=>JSON.parse(JSON.stringify(DEFAULT_PAINTS)));
  const [ceilPaints, setCeilPaints] = useState(()=>JSON.parse(JSON.stringify(DEFAULT_CEILING_PAINTS)));
  const [primers, setPrimers] = useState(()=>JSON.parse(JSON.stringify(DEFAULT_PRIMERS)));
  const [colours, setColours] = useState(()=>JSON.parse(JSON.stringify(DEFAULT_COLOURS)));
  const [supplies, setSupplies] = useState(()=>JSON.parse(JSON.stringify(DEFAULT_SUPPLIES)));
  const [standards, setStandards] = useState(()=>JSON.parse(JSON.stringify(DEFAULT_STANDARDS)));
  const [labour, setLabour] = useState(()=>({
    workers:JSON.parse(JSON.stringify(DEFAULT_WORKERS)),
    overheadItems:JSON.parse(JSON.stringify(DEFAULT_OVERHEAD_ITEMS)),
    billable:1700, buffer:1.25, matBuffer:1.25, taxes:true,
    discount:false, discountAmt:false, discAmt:0, discPct:10, profitTarget:0,
  }));
  const [loaded, setLoaded] = useState(false);
  const saveTimer = useRef(null);

  useEffect(()=>{
    (async()=>{
      try{
        if(!_session?.access_token){
          const stored = localStorage.getItem('kp_session');
          if(stored){const s=JSON.parse(stored); if(s?.access_token) setSession(s);}
        }
        const session = _session;
        if(!session?.access_token||!session?.user?.id){setLoaded(true);return;}
        const rows = await supaFetch(`/rest/v1/paint_settings?user_id=eq.${session.user.id}&select=data,labour,standards`);
        if(rows && rows.length){
          const row = rows[0];
          const d = row.data || {};
          if(d.paints?.length) setPaints(d.paints);
          if(d.ceilPaints?.length) setCeilPaints(d.ceilPaints);
          if(d.primers?.length) setPrimers(d.primers);
          if(d.colours?.length) setColours(d.colours);
          if(d.supplies?.length) setSupplies(d.supplies);
          if(row.standards && Object.keys(row.standards).length) setStandards(prev=>({...prev,...row.standards}));
          if(row.labour) setLabour(prev=>({...prev,...row.labour}));
        }
      }catch(e){console.warn('usePaintSettings load error:',e);}
      setLoaded(true);
    })();
  },[]);

  const save = useCallback(async(overrides={})=>{
    try{
      if(!_session?.access_token||!_session?.user?.id) return false;
      const uid = _session.user.id;
      const token = _session.access_token;
      const body = {
        user_id: uid,
        data: overrides.data || {paints, ceilPaints, primers, colours, supplies},
        labour: overrides.labour || labour,
        standards: overrides.standards || standards,
        updated_at: new Date().toISOString(),
      };
      const res = await fetch(`${SUPA_URL}/rest/v1/paint_settings?on_conflict=user_id`,{
        method:'POST',
        headers:{'apikey':SUPA_KEY,'Authorization':`Bearer ${token}`,'Content-Type':'application/json','Prefer':'resolution=merge-duplicates,return=minimal'},
        body:JSON.stringify(body),
      });
      return res.ok;
    }catch(e){console.warn('usePaintSettings save error:',e);return false;}
  },[paints,ceilPaints,primers,colours,supplies,standards,labour]);

  const scheduleSave = useCallback((overrides)=>{
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(()=>save(overrides), 1200);
  },[save]);

  return { paints,setPaints, ceilPaints,setCeilPaints, primers,setPrimers, colours,setColours, supplies,setSupplies, standards,setStandards, labour,setLabour, loaded, save, scheduleSave };
}

// ─── ROOM CARD ────────────────────────────────────────────────────────────────
function RoomCard({room,settings,onChange,onRemove,primers,paints,ceilPaints,colours,supplies}){
  const [open,setOpen]=useState(true);
  const calc=calcRoom(room,settings);
  const u=patch=>onChange({...room,...patch});
  const up=patch=>u({paint:{...room.paint,...patch}});
  const uprep=patch=>u({prep:{...room.prep,...patch}});
  const cbStyle={width:18,height:18,accentColor:'var(--primary)',cursor:'pointer'};
  const S=({label,field,sub})=>(
    <div style={{display:'flex',alignItems:'center',gap:10,padding:'4px 0'}}>
      <label style={{fontSize:12,display:'flex',gap:6,alignItems:'center'}}>
        <input type='checkbox' checked={room[field].enabled} onChange={e=>u({[field]:{...room[field],enabled:e.target.checked}})} style={cbStyle}/>
        {label}
      </label>
      {room[field].enabled&&<select value={room[field].coats} onChange={e=>u({[field]:{...room[field],coats:+e.target.value}})} style={{fontSize:11,padding:'2px 6px',border:'1px solid var(--border)',borderRadius:4,background:'var(--card)'}}>
        <option value={1}>1 coat</option><option value={2}>2 coats</option><option value={3}>Primer & 2 coats</option>
      </select>}
    </div>
  );
  const PREP_ITEMS=[{k:'furniture',l:'Move furniture'},{k:'plastic',l:'Cover w/ plastic'},{k:'outlets',l:'Remove outlets'},{k:'drywall',l:'Drywall repairs'},{k:'caulking',l:'Caulking'},{k:'cleanup',l:'Clean up'}];
  const PaintRow=({label,prod,colour,sheen,products,colours,onProd,onColour,onSheen})=>(
    <div style={{marginBottom:10}}>
      <p style={{fontSize:11,fontWeight:500,color:'var(--muted-fg)',marginBottom:4}}>{label}</p>
      <div style={{display:'flex',flexDirection:'column',gap:6}}>
        <select value={prod} onChange={e=>onProd(e.target.value)} style={{width:'100%',fontSize:11,padding:'4px 6px',border:'1px solid var(--border)',borderRadius:4,background:'var(--card)'}}><option value=''>— Product —</option>{products.map(p=><option key={p} value={p}>{p}</option>)}</select>
        <select value={colour} onChange={e=>onColour(e.target.value)} style={{width:'100%',fontSize:11,padding:'4px 6px',border:'1px solid var(--border)',borderRadius:4,background:'var(--card)'}}><option value=''>— Colour —</option>{colours.map(c=><option key={c} value={c}>{c}</option>)}</select>
        <select value={sheen} onChange={e=>onSheen(e.target.value)} style={{width:'100%',fontSize:11,padding:'4px 6px',border:'1px solid var(--border)',borderRadius:4,background:'var(--card)'}}><option value=''>— Sheen —</option>{SHEENS.map(s=><option key={s} value={s}>{s}</option>)}</select>
      </div>
    </div>
  );
  return (
    <div style={{border:'1px solid var(--border)',borderRadius:12,marginBottom:12,overflow:'hidden',background:'var(--card)',boxShadow:'var(--shadow)'}}>
      <div onClick={()=>setOpen(!open)} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'12px 16px',cursor:'pointer',userSelect:'none'}}>
        <div style={{display:'flex',gap:8,alignItems:'center',flex:'1 1 0',minWidth:0}}>
          <ChevronRight size={14} style={{color:'var(--muted-fg)',transform:open?'rotate(90deg)':'none',transition:'transform 0.2s',flexShrink:0}}/>
          <input type='text' value={room.name} onClick={e=>e.stopPropagation()} onChange={e=>u({name:e.target.value})} placeholder='Room name' style={{fontWeight:600,fontSize:13,background:'transparent',border:'none',outline:'none',color:'var(--fg)',width:'100%',minWidth:0}}/>
        </div>
        <div style={{display:'flex',gap:8,alignItems:'center',flexShrink:0}}>
          <span style={{fontSize:11,background:'rgba(212,169,106,0.15)',color:'var(--primary)',padding:'3px 8px',borderRadius:999,fontWeight:500,whiteSpace:'nowrap'}}>{fmtCAD(calc.cost)}</span>
          <button onClick={e=>{e.stopPropagation();onRemove();}} style={{background:'none',border:'none',cursor:'pointer',color:'var(--destructive)',padding:3}}><Trash2 size={13}/></button>
        </div>
      </div>
      {open&&(
        <div style={{borderTop:'1px solid var(--border)'}}>
          <div style={{padding:'14px 16px',borderBottom:'1px solid rgba(0,0,0,0.05)'}}>
            <p style={{fontSize:10,fontWeight:600,textTransform:'uppercase',letterSpacing:'0.05em',color:'var(--muted-fg)',marginBottom:10}}>Dimensions</p>
            <div style={{display:'flex',flexDirection:'column',gap:8}}>
              {[['Length (ft)','length'],['Width (ft)','width'],['Height (ft)','height']].map(([l,k])=>(
                <div key={k}><Label>{l}</Label><Input type='number' value={room[k]||''} onChange={e=>u({[k]:+e.target.value})} style={{padding:'6px 8px',minWidth:0}}/></div>
              ))}
            </div>
            <div style={{marginTop:8,display:'flex',gap:8,alignItems:'center'}}>
              <input type='checkbox' id={`irr-${room.id}`} checked={room.irregular} onChange={e=>u({irregular:e.target.checked})} style={cbStyle}/>
              <label htmlFor={`irr-${room.id}`} style={{fontSize:12,cursor:'pointer'}}>Irregular shape</label>
            </div>
            {room.irregular&&(
              <div style={{marginTop:8,padding:12,background:'rgba(0,0,0,0.02)',borderRadius:8,border:'1px solid var(--border)'}}>
                <p style={{fontSize:11,fontWeight:600,color:'var(--muted-fg)',marginBottom:8}}>Wall Segments (length × height)</p>
                <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(90px,1fr))',gap:6}}>
                  {(room.wallSegs||[]).map((seg,i)=>(
                    <div key={i}>
                      <Label>Seg {i+1}</Label>
                      <Input type='number' value={seg.l||''} onChange={e=>{const segs=[...(room.wallSegs||[])];segs[i]={...segs[i],l:+e.target.value};u({wallSegs:segs});}} placeholder='L' style={{padding:'4px 8px',fontSize:11,minWidth:0}}/>
                      {seg.l>0&&room.height>0&&<p style={{fontSize:10,color:'var(--muted-fg)',marginTop:2}}>{Math.round(seg.l*(room.height||0))} sqft</p>}
                    </div>
                  ))}
                </div>
                {calc.wallSqft>0&&<p style={{fontSize:11,fontWeight:600,color:'var(--primary)',marginTop:6}}>Total: ~{Math.round(calc.wallSqft)} sqft</p>}
              </div>
            )}
            {room.irregular&&room.ceiling?.enabled&&(
              <div style={{marginTop:8,padding:12,background:'rgba(0,0,0,0.02)',borderRadius:8,border:'1px solid var(--border)'}}>
                <p style={{fontSize:11,fontWeight:600,color:'var(--muted-fg)',marginBottom:8}}>Ceiling Segments (L × W)</p>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
                  {(room.ceilSegs||[]).map((seg,i)=>(
                    <div key={i} style={{display:'flex',gap:6,alignItems:'flex-end'}}>
                      <div style={{flex:1}}><Label>L</Label><Input type='number' value={seg.l||''} onChange={e=>{const segs=[...(room.ceilSegs||[])];segs[i]={...segs[i],l:+e.target.value};u({ceilSegs:segs});}} style={{padding:'4px 8px',fontSize:11,minWidth:0}}/></div>
                      <div style={{flex:1}}><Label>W</Label><Input type='number' value={seg.w||''} onChange={e=>{const segs=[...(room.ceilSegs||[])];segs[i]={...segs[i],w:+e.target.value};u({ceilSegs:segs});}} style={{padding:'4px 8px',fontSize:11,minWidth:0}}/></div>
                      <p style={{fontSize:10,color:'var(--muted-fg)',whiteSpace:'nowrap',paddingBottom:4}}>{Math.round((seg.l||0)*(seg.w||0))} sqft</p>
                    </div>
                  ))}
                </div>
                {calc.ceilSqft>0&&<p style={{fontSize:11,fontWeight:600,color:'var(--primary)',marginTop:6}}>Total ceiling: ~{Math.round(calc.ceilSqft)} sqft</p>}
              </div>
            )}
            {!room.irregular&&calc.wallSqft>0&&<p style={{fontSize:11,color:'var(--muted-fg)',marginTop:6}}>Walls: ~{Math.round(calc.wallSqft)} sqft · Ceiling: ~{Math.round(calc.ceilSqft)} sqft</p>}
          </div>
          <div style={{padding:'14px 16px',borderBottom:'1px solid rgba(0,0,0,0.05)'}}>
            <p style={{fontSize:10,fontWeight:600,textTransform:'uppercase',letterSpacing:'0.05em',color:'var(--muted-fg)',marginBottom:8}}>Surfaces</p>
            <S label='Walls' field='walls'/>
            <div style={{display:'flex',alignItems:'center',gap:10,padding:'4px 0'}}>
              <label style={{fontSize:12,display:'flex',gap:6,alignItems:'center'}}>
                <input type='checkbox' checked={room.ceiling.enabled} onChange={e=>u({ceiling:{...room.ceiling,enabled:e.target.checked}})} style={cbStyle}/>
                Ceiling
              </label>
              {room.ceiling.enabled&&<select value={room.ceiling.coats} onChange={e=>u({ceiling:{...room.ceiling,coats:+e.target.value}})} style={{fontSize:11,padding:'2px 6px',border:'1px solid var(--border)',borderRadius:4,background:'var(--card)'}}>
                <option value={1}>1 coat</option><option value={2}>2 coats</option><option value={3}>Primer & 2 coats</option>
              </select>}
            </div>
            {room.ceiling.enabled&&(
              <div style={{marginLeft:22,marginBottom:6,padding:10,background:'rgba(0,0,0,0.02)',borderRadius:6,border:'1px solid var(--border)'}}>
                <div style={{display:'flex',gap:12,alignItems:'center',marginBottom:4}}>
                  <label style={{fontSize:11,display:'flex',gap:4,alignItems:'center',cursor:'pointer'}}>
                    <input type='radio' name={`ceil-${room.id}`} checked={room.ceiling.type==='flat'} onChange={()=>u({ceiling:{...room.ceiling,type:'flat',removeStucco:false}})}/> Flat
                  </label>
                  <label style={{fontSize:11,display:'flex',gap:4,alignItems:'center',cursor:'pointer'}}>
                    <input type='radio' name={`ceil-${room.id}`} checked={room.ceiling.type==='stucco'} onChange={()=>u({ceiling:{...room.ceiling,type:'stucco'}})}/> Stucco
                  </label>
                </div>
                {room.ceiling.type==='stucco'&&(
                  <label style={{fontSize:11,display:'flex',gap:6,alignItems:'center',cursor:'pointer'}}>
                    <input type='checkbox' checked={room.ceiling.removeStucco||false} onChange={e=>u({ceiling:{...room.ceiling,removeStucco:e.target.checked}})} style={cbStyle}/> Stucco removal
                  </label>
                )}
              </div>
            )}
            <S label='Baseboards' field='baseboards'/><S label='Crown Moulding' field='crown'/>
            <div style={{padding:'4px 0'}}>
              <label style={{fontSize:12,display:'flex',gap:6,alignItems:'center'}}>
                <input type='checkbox' checked={room.doors?.enabled||false} onChange={e=>u({doors:{...room.doors,enabled:e.target.checked}})} style={cbStyle}/>
                Doors
              </label>
              {room.doors?.enabled&&(
                <div style={{marginLeft:22,marginTop:6,padding:10,background:'rgba(0,0,0,0.02)',borderRadius:6,border:'1px solid var(--border)'}}>
                  {[['Flat','flat'],['6 Panel','sixPanel'],['Custom','custom']].map(([label,key])=>(
                    <div key={key} style={{display:'flex',gap:8,alignItems:'center',marginBottom:6}}>
                      <span style={{fontSize:11,fontWeight:500,width:60}}>{label}</span>
                      <Input type='number' value={room.doors[key]?.count||''} onChange={e=>u({doors:{...room.doors,[key]:{...room.doors[key],count:+e.target.value}}})} placeholder='#' style={{width:45,padding:'4px 6px',fontSize:11,minWidth:0}}/>
                      <select value={room.doors[key]?.coats||2} onChange={e=>u({doors:{...room.doors,[key]:{...room.doors[key],coats:+e.target.value}}})} style={{fontSize:11,padding:'2px 6px',border:'1px solid var(--border)',borderRadius:4,background:'var(--card)'}}>
                        <option value={1}>1 coat</option><option value={2}>2 coats</option><option value={3}>Primer & 2 coats</option>
                      </select>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div style={{padding:'4px 0'}}>
              <div style={{display:'flex',alignItems:'center',gap:10}}>
                <label style={{fontSize:12,display:'flex',gap:6,alignItems:'center'}}>
                  <input type='checkbox' checked={room.windows?.enabled||false} onChange={e=>u({windows:{...room.windows,enabled:e.target.checked}})} style={cbStyle}/>
                  Windows
                </label>
                {room.windows?.enabled&&<select value={room.windows.coats} onChange={e=>u({windows:{...room.windows,coats:+e.target.value}})} style={{fontSize:11,padding:'2px 6px',border:'1px solid var(--border)',borderRadius:4,background:'var(--card)'}}>
                  <option value={1}>1 coat</option><option value={2}>2 coats</option><option value={3}>Primer & 2 coats</option>
                </select>}
              </div>
              {room.windows?.enabled&&(
                <div style={{marginLeft:22,marginTop:6,padding:10,background:'rgba(0,0,0,0.02)',borderRadius:6,border:'1px solid var(--border)'}}>
                  {(room.windows.dims||[]).map((dim,i)=>(
                    <div key={i} style={{display:'flex',gap:6,alignItems:'center',marginBottom:6}}>
                      <span style={{fontSize:11,fontWeight:500,color:'var(--muted-fg)',width:16}}>{i+1}.</span>
                      <div style={{flex:1}}><Input type='number' value={dim.l||''} onChange={e=>{const dims=[...(room.windows.dims||[])];dims[i]={...dims[i],l:+e.target.value};u({windows:{...room.windows,dims}});}} placeholder='L' style={{padding:'4px 6px',fontSize:11,minWidth:0}}/></div>
                      <span style={{fontSize:11,color:'var(--muted-fg)'}}>×</span>
                      <div style={{flex:1}}><Input type='number' value={dim.w||''} onChange={e=>{const dims=[...(room.windows.dims||[])];dims[i]={...dims[i],w:+e.target.value};u({windows:{...room.windows,dims}});}} placeholder='W' style={{padding:'4px 6px',fontSize:11,minWidth:0}}/></div>
                      <span style={{fontSize:10,color:'var(--muted-fg)',whiteSpace:'nowrap'}}>{2*((dim.l||0)+(dim.w||0))} lf</span>
                      {(room.windows.dims||[]).length>1&&<button onClick={()=>{const dims=(room.windows.dims||[]).filter((_,j)=>j!==i);u({windows:{...room.windows,dims}});}} style={{background:'none',border:'none',cursor:'pointer',color:'var(--destructive)',padding:2,fontSize:12}}>×</button>}
                    </div>
                  ))}
                  <button onClick={()=>u({windows:{...room.windows,dims:[...(room.windows.dims||[]),{l:0,w:0}]}})} style={{fontSize:11,padding:'4px 10px',borderRadius:4,border:'1px dashed var(--border)',background:'none',cursor:'pointer',color:'var(--primary)',fontWeight:500,marginTop:2}}>+ Add Window</button>
                  {roomWindowLF(room)>0&&<p style={{fontSize:10,color:'var(--primary)',fontWeight:600,marginTop:4}}>Total: {Math.round(roomWindowLF(room))} lf</p>}
                </div>
              )}
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
                  <input type='checkbox' checked={room.prep[k]} onChange={e=>uprep({[k]:e.target.checked})} style={cbStyle}/>{l}
                </label>
              ))}
            </div>
            <div style={{marginTop:8}}>
              <Label>Additional prep</Label>
              <textarea value={room.prep.custom||''} onChange={e=>uprep({custom:e.target.value})} placeholder='Additional prep details...' rows={2} style={{width:'100%',fontSize:12,padding:'6px 8px',border:'1px solid var(--border)',borderRadius:6,background:'var(--card)',color:'var(--fg)',resize:'vertical',fontFamily:'inherit'}}/>
            </div>
          </div>
          <div style={{padding:'14px 16px'}}>
            <p style={{fontSize:10,fontWeight:600,textTransform:'uppercase',letterSpacing:'0.05em',color:'var(--muted-fg)',marginBottom:8}}>Paint Selections</p>
            {room.walls.enabled&&<>
              <PaintRow label='Walls' prod={room.paint.wallProduct} colour={room.paint.wallColour} sheen={room.paint.wallSheen} products={(paints||[]).map(p=>p.n)} colours={(colours||[]).map(c=>c.n)} onProd={v=>up({wallProduct:v})} onColour={v=>up({wallColour:v})} onSheen={v=>up({wallSheen:v})}/>
              {room.walls.coats===3&&<div style={{marginTop:-6,marginBottom:10}}><p style={{fontSize:11,fontWeight:500,color:'var(--muted-fg)',marginBottom:4}}>Walls Primer</p><select value={room.paint.wallsPrimer||''} onChange={e=>up({wallsPrimer:e.target.value})} style={{width:'100%',fontSize:11,padding:'4px 6px',border:'1px solid var(--border)',borderRadius:4,background:'var(--card)'}}><option value=''>— Select Primer —</option>{(primers||[]).map(p=><option key={p.n} value={p.n}>{p.n}</option>)}</select></div>}
            </>}
            {room.ceiling.enabled&&<>
              <PaintRow label='Ceiling' prod={room.paint.ceilProduct} colour={room.paint.ceilColour} sheen={room.paint.ceilSheen} products={(ceilPaints||[]).map(p=>p.n)} colours={(colours||[]).map(c=>c.n)} onProd={v=>up({ceilProduct:v})} onColour={v=>up({ceilColour:v})} onSheen={v=>up({ceilSheen:v})}/>
              {room.ceiling.coats===3&&<div style={{marginTop:-6,marginBottom:10}}><p style={{fontSize:11,fontWeight:500,color:'var(--muted-fg)',marginBottom:4}}>Ceiling Primer</p><select value={room.paint.ceilingPrimer||''} onChange={e=>up({ceilingPrimer:e.target.value})} style={{width:'100%',fontSize:11,padding:'4px 6px',border:'1px solid var(--border)',borderRadius:4,background:'var(--card)'}}><option value=''>— Select Primer —</option>{(primers||[]).map(p=><option key={p.n} value={p.n}>{p.n}</option>)}</select></div>}
            </>}
            {(room.baseboards.enabled||room.doors?.enabled||roomDoorCount(room)>0||room.crown.enabled)&&<>
              <PaintRow label='Trim / Doors' prod={room.paint.trimProduct} colour={room.paint.trimColour} sheen={room.paint.trimSheen} products={(paints||[]).map(p=>p.n)} colours={(colours||[]).map(c=>c.n)} onProd={v=>up({trimProduct:v})} onColour={v=>up({trimColour:v})} onSheen={v=>up({trimSheen:v})}/>
              {(room.baseboards?.coats===3||room.crown?.coats===3||room.doorFrames?.coats===3||room.windows?.coats===3||(room.doors?.flat?.coats===3)||(room.doors?.sixPanel?.coats===3)||(room.doors?.custom?.coats===3))&&<div style={{marginTop:-6,marginBottom:10}}><p style={{fontSize:11,fontWeight:500,color:'var(--muted-fg)',marginBottom:4}}>Trim Primer</p><select value={room.paint.trimPrimer||''} onChange={e=>up({trimPrimer:e.target.value})} style={{width:'100%',fontSize:11,padding:'4px 6px',border:'1px solid var(--border)',borderRadius:4,background:'var(--card)'}}><option value=''>— Select Primer —</option>{(primers||[]).map(p=><option key={p.n} value={p.n}>{p.n}</option>)}</select></div>}
            </>}
          </div>
          <div style={{padding:'14px 16px',borderTop:'1px solid rgba(0,0,0,0.05)'}}>
            <p style={{fontSize:10,fontWeight:600,textTransform:'uppercase',letterSpacing:'0.05em',color:'var(--muted-fg)',marginBottom:8}}>Supplies</p>
            {(room.supplies||[]).map((s,i)=>(
              <div key={i} style={{display:'flex',gap:6,alignItems:'center',marginBottom:6}}>
                <select value={s.name||''} onChange={e=>{const next=[...(room.supplies||[])];next[i]={...next[i],name:e.target.value};u({supplies:next});}} style={{flex:1,fontSize:11,padding:'4px 6px',border:'1px solid var(--border)',borderRadius:4,background:'var(--card)'}}>
                  <option value=''>— Select —</option>
                  {(supplies||[]).map(sp=><option key={sp.n} value={sp.n}>{sp.n} ({fmtCAD(sp.p)})</option>)}
                </select>
                <Input type='number' value={s.qty||''} onChange={e=>{const next=[...(room.supplies||[])];next[i]={...next[i],qty:+e.target.value};u({supplies:next});}} placeholder='Qty' style={{width:50,padding:'4px 6px',fontSize:11,minWidth:0}}/>
                <button onClick={()=>u({supplies:(room.supplies||[]).filter((_,j)=>j!==i)})} style={{background:'none',border:'none',cursor:'pointer',color:'var(--destructive)',fontSize:12}}>×</button>
              </div>
            ))}
            <button onClick={()=>u({supplies:[...(room.supplies||[]),{name:'',qty:1}]})} style={{fontSize:11,padding:'4px 10px',borderRadius:4,border:'1px dashed var(--border)',background:'none',cursor:'pointer',color:'var(--primary)',fontWeight:500}}>+ Add Supply</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── COVER TAB ────────────────────────────────────────────────────────────────
function CoverTab({client,setClient,deals,contacts,onSelectDeal,selectedDealId}){
  const todayStr=new Date().toLocaleDateString('en-CA',{year:'numeric',month:'long',day:'numeric'});
  const docStyle={background:'#fff',color:'#1a1a1a',borderRadius:8,maxWidth:900,margin:'0 auto',padding:40,boxShadow:'0 2px 12px rgba(0,0,0,0.08)'};
  const gold='#C4922A';
  const dealLabel=(d)=>{
    const cid=Array.isArray(d.contact)?d.contact[0]:d.contact;
    const c=(contacts||[]).find(x=>x.id===cid);
    const name=c?.fullName||d.contactFreeText||'';
    return name?`${d.dealName||'Unnamed project'} - ${name}`:(d.dealName||'Unnamed project');
  };
  return (
    <div style={{display:'flex',flexDirection:'column',gap:24,padding:24,overflow:'auto',maxHeight:'100%',maxWidth:900,margin:'0 auto'}}>
      <div style={docStyle}>
        <div style={{textAlign:'center',padding:'48px 24px'}}>
          <img src="/kingdom-logo-dark.svg" alt="Kingdom Painting Inc." style={{height:80,margin:'0 auto'}}/>
          <div style={{width:60,height:2,background:gold,margin:'16px auto'}}/>
          <p style={{fontSize:16,fontWeight:600,letterSpacing:'0.08em',color:'#555',marginTop:24}}>BID PROPOSAL</p>
          <div style={{marginTop:48}}>
            <p style={{fontSize:11,textTransform:'uppercase',letterSpacing:'0.1em',color:'#999'}}>PREPARED FOR</p>
            <p style={{fontSize:18,fontWeight:600,marginTop:8,color:'#1a1a1a'}}>{client.name||'Client Name'}</p>
            {client.address&&<p style={{fontSize:12,color:'#666',marginTop:6}}>{client.address}</p>}
            {client.phone&&<p style={{fontSize:12,color:'#666',marginTop:4}}>{client.phone}</p>}
            {client.email&&<p style={{fontSize:12,color:'#666',marginTop:4}}>{client.email}</p>}
          </div>
          <p style={{fontSize:12,color:'#999',marginTop:32}}>{todayStr}</p>
        </div>
      </div>
      <div style={{display:'flex',flexDirection:'column',gap:12}}>
        <div>
          <Label>Project</Label>
          <Select value={selectedDealId||''} onChange={e=>{if(e.target.value)onSelectDeal(e.target.value);}}>
            <option value=''>Select a project...</option>
            {deals.map(d=><option key={d.id} value={d.id}>{dealLabel(d)}</option>)}
          </Select>
        </div>
        <div>
          <Label>Client Name</Label>
          <Input value={client.name} onChange={e=>setClient({...client,name:e.target.value})}/>
        </div>
        <div>
          <Label>Address</Label>
          <Input value={client.address||''} onChange={e=>setClient({...client,address:e.target.value})} placeholder='Full address'/>
        </div>
        <div>
          <Label>Phone</Label>
          <Input value={client.phone} onChange={e=>setClient({...client,phone:e.target.value})}/>
        </div>
        <div>
          <Label>Email</Label>
          <Input value={client.email} onChange={e=>setClient({...client,email:e.target.value})}/>
        </div>
      </div>
    </div>
  );
}

// ─── ROOMS TAB ────────────────────────────────────────────────────────────────
function RoomsTab({rooms,settings,onUpdate,onRemove,onAdd,paints,ceilPaints,colours,primers,supplies}){
  const totalCost=rooms.reduce((s,r)=>s+calcRoom(r,settings).cost,0);
  return (
    <div style={{padding:'16px 12px',overflow:'auto',maxHeight:'100%'}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16}}>
        <div style={{display:'flex',gap:12,alignItems:'center'}}>
          <h3 style={{fontSize:15,fontWeight:700}}>Rooms</h3>
          <Badge color='primary'>{rooms.length}</Badge>
        </div>
        <span style={{fontSize:13,fontWeight:600,color:'var(--primary)'}}>{fmtCAD(totalCost)}</span>
      </div>
      {rooms.map((r,i)=>(
        <RoomCard key={r.id} room={r} settings={settings} primers={primers} paints={paints} ceilPaints={ceilPaints} colours={colours} supplies={supplies}
          onChange={updated=>onUpdate(i,updated)}
          onRemove={()=>onRemove(i)}/>
      ))}
      <Btn onClick={onAdd} variant='outline' style={{width:'100%',marginTop:8}}>
        <Plus size={14}/> Add Room
      </Btn>
    </div>
  );
}

// ─── BREAKDOWN TAB ────────────────────────────────────────────────────────────
function BreakdownTab({rooms,settings,paints,ceilPaints,primers,colours,supplies}){
  const fmtN=n=>Math.round(n).toLocaleString('en-CA');
  const activeRooms=rooms.filter(r=>r.walls.enabled||r.ceiling.enabled||r.baseboards.enabled||r.doors?.enabled||roomDoorCount(r)>0);
  let tWalls=0,tCeil=0,tTrim=0,tDoors=0,tHrs=0,tCost=0;
  const roomCalcs=rooms.map(r=>{
    const c=calcRoom(r,settings);
    tWalls+=c.wallSqft;tCeil+=c.ceilSqft;tTrim+=c.perimLF;tDoors+=roomDoorCount(r);tHrs+=c.totalHrs;tCost+=c.cost;
    return {room:r,calc:c,lines:calcRoomLines(r,settings)};
  });
  const numWorkers=Math.max(1,settings._standards?.workers||1);
  const estDays=tHrs>0?Math.ceil(tHrs/numWorkers/8):0;
  const paintData=calcPaintCosts(rooms,paints||[],ceilPaints||[],primers||[],colours||[],settings._standards?.matBuffer||1.15);
  const statStyle={background:'var(--card)',border:'1px solid var(--border)',borderRadius:10,padding:'14px 16px',textAlign:'center'};
  const statLabel={fontSize:10,textTransform:'uppercase',letterSpacing:'0.06em',color:'var(--muted-fg)',fontWeight:600};
  const statVal={fontSize:20,fontWeight:700,marginTop:4};
  const thStyle={fontSize:11,fontWeight:600,textAlign:'left',padding:'8px 10px',borderBottom:'2px solid var(--border)',color:'var(--muted-fg)'};
  const tdStyle={fontSize:12,padding:'7px 10px',borderBottom:'1px solid var(--border)'};
  return (
    <div style={{padding:24,overflow:'auto',maxHeight:'100%'}}>
      <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:12,marginBottom:24}}>
        <div style={statStyle}><p style={statLabel}>Total Walls</p><p style={statVal}>{fmtN(tWalls)} sqft</p></div>
        <div style={statStyle}><p style={statLabel}>Total Ceiling</p><p style={statVal}>{fmtN(tCeil)} sqft</p></div>
        <div style={statStyle}><p style={statLabel}>Total Trim</p><p style={statVal}>{fmtN(tTrim)} LF</p></div>
        <div style={statStyle}><p style={statLabel}>Total Doors</p><p style={statVal}>{tDoors}</p></div>
        <div style={statStyle}><p style={statLabel}>Hours / Worker</p><p style={statVal}>{fmtN(tHrs)}</p></div>
        <div style={statStyle}><p style={statLabel}>Est. Days</p><p style={statVal}>{estDays}</p></div>
        <div style={statStyle}><p style={statLabel}>Labour Cost</p><p style={statVal}>{fmtCAD(tCost)}</p></div>
        <div style={statStyle}><p style={statLabel}>Active Rooms</p><p style={statVal}>{activeRooms.length}</p></div>
      </div>
      <Card style={{marginBottom:24}}>
        <div style={{padding:16}}>
          <p style={{fontSize:13,fontWeight:700,marginBottom:12}}>Per-Room Labour Breakdown</p>
          {roomCalcs.map(({room,calc,lines})=>(
            <div key={room.id} style={{marginBottom:16}}>
              <p style={{fontSize:12,fontWeight:600,marginBottom:6}}>{room.name} <span style={{color:'var(--muted-fg)',fontWeight:400}}>({fmtCAD(calc.cost)})</span></p>
              <table style={{width:'100%',borderCollapse:'collapse'}}>
                <thead><tr>
                  <th style={thStyle}>Surface</th><th style={thStyle}>Area</th><th style={thStyle}>Coats</th>
                  <th style={thStyle}>Rate</th><th style={thStyle}>Hours</th><th style={{...thStyle,textAlign:'right'}}>Cost</th>
                </tr></thead>
                <tbody>{lines.map((ln,i)=>(
                  <tr key={i}>
                    <td style={tdStyle}>{ln.surface}</td>
                    <td style={tdStyle}>{fmtN(ln.area)} {ln.areaUnit}</td>
                    <td style={tdStyle}>{ln.coats}</td>
                    <td style={tdStyle}>{ln.rateLabel}</td>
                    <td style={tdStyle}>{ln.hours.toFixed(1)}</td>
                    <td style={{...tdStyle,textAlign:'right'}}>{fmtCAD(ln.cost)}</td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          ))}
        </div>
      </Card>
      {paintData.lines.length>0&&(
        <Card style={{marginBottom:24}}>
          <div style={{padding:16}}>
            <p style={{fontSize:13,fontWeight:700,marginBottom:12}}>Paint Summary <span style={{fontWeight:400,color:'var(--muted-fg)'}}>({fmtCAD(paintData.total)})</span></p>
            {(()=>{
              const agg={};
              paintData.lines.forEach(ln=>{
                const key=`${ln.product}·${ln.colour}·${ln.sheen}`;
                if(!agg[key]) agg[key]={product:ln.product,colour:ln.colour,sheen:ln.sheen,hex:ln.hex,sqft:0,cost:0};
                agg[key].sqft+=ln.sqft;
                agg[key].cost+=ln.lineCost;
              });
              const rows=Object.values(agg);
              const summaryTotal=rows.reduce((s,r)=>s+r.cost,0);
              return (
                <table style={{width:'100%',borderCollapse:'collapse'}}>
                  <thead><tr>
                    <th style={thStyle}>Product</th><th style={thStyle}>Colour</th><th style={thStyle}>Sheen</th>
                    <th style={thStyle}>Sqft</th><th style={thStyle}>Est. Qty</th><th style={{...thStyle,textAlign:'right'}}>Cost</th>
                  </tr></thead>
                  <tbody>{rows.map((r,i)=>{
                    const gallons=r.sqft>0?Math.ceil(r.sqft/350):0;
                    let qtyStr='—';
                    if(r.sqft>0){
                      if(r.sqft<=1900) qtyStr=gallons+' gal';
                      else{const pails=Math.floor(r.sqft/1900);const rem=r.sqft-pails*1900;const eg=rem>0?Math.ceil(rem/350):0;const p2=[];if(pails>0)p2.push(pails+' pail'+(pails>1?'s':''));if(eg>0)p2.push(eg+' gal');qtyStr=p2.join(' + ');}
                    }
                    return (
                      <tr key={i}>
                        <td style={tdStyle}>{r.product}</td>
                        <td style={tdStyle}>
                          <span style={{display:'inline-flex',gap:6,alignItems:'center'}}>
                            {r.hex&&<span style={{width:10,height:10,borderRadius:2,background:r.hex,border:'1px solid #ccc',display:'inline-block'}}/>}
                            {r.colour||'—'}
                          </span>
                        </td>
                        <td style={tdStyle}>{r.sheen||'—'}</td>
                        <td style={tdStyle}>{fmtN(r.sqft)}</td>
                        <td style={tdStyle}>{qtyStr}</td>
                        <td style={{...tdStyle,textAlign:'right'}}>{fmtCAD(r.cost)}</td>
                      </tr>
                    );
                  })}</tbody>
                  <tfoot><tr>
                    <td colSpan={5} style={{...tdStyle,fontWeight:700,borderTop:'2px solid var(--border)'}}>Total</td>
                    <td style={{...tdStyle,textAlign:'right',fontWeight:700,borderTop:'2px solid var(--border)'}}>{fmtCAD(summaryTotal)}</td>
                  </tr></tfoot>
                </table>
              );
            })()}
          </div>
        </Card>
      )}
      {(()=>{
        const supAgg={};
        rooms.forEach(r=>{
          (r.supplies||[]).forEach(s=>{
            if(!s.name) return;
            const qty=(+s.qty)||1;
            if(!supAgg[s.name]) supAgg[s.name]={name:s.name,qty:0,cost:0};
            supAgg[s.name].qty+=qty;
            const sup=(supplies||[]).find(x=>x.n===s.name);
            supAgg[s.name].cost+=(sup?sup.p:0)*qty;
          });
        });
        const supRows=Object.values(supAgg);
        if(!supRows.length) return null;
        const supTotal=supRows.reduce((s,r)=>s+r.cost,0);
        return (
          <Card style={{marginBottom:24}}>
            <div style={{padding:16}}>
              <p style={{fontSize:13,fontWeight:700,marginBottom:12}}>Materials <span style={{fontWeight:400,color:'var(--muted-fg)'}}>({fmtCAD(supTotal)})</span></p>
              <table style={{width:'100%',borderCollapse:'collapse'}}>
                <thead><tr>
                  <th style={thStyle}>Product</th><th style={thStyle}>Qty</th><th style={{...thStyle,textAlign:'right'}}>Cost</th>
                </tr></thead>
                <tbody>{supRows.map((r,i)=>(
                  <tr key={i}>
                    <td style={tdStyle}>{r.name}</td>
                    <td style={tdStyle}>{r.qty}</td>
                    <td style={{...tdStyle,textAlign:'right'}}>{fmtCAD(r.cost)}</td>
                  </tr>
                ))}</tbody>
                <tfoot><tr>
                  <td colSpan={2} style={{...tdStyle,fontWeight:700,borderTop:'2px solid var(--border)'}}>Total</td>
                  <td style={{...tdStyle,textAlign:'right',fontWeight:700,borderTop:'2px solid var(--border)'}}>{fmtCAD(supTotal)}</td>
                </tr></tfoot>
              </table>
            </div>
          </Card>
        );
      })()}
    </div>
  );
}

// ─── QUOTE TAB ────────────────────────────────────────────────────────────────
function QuoteTab({rooms,settings,client,totals,paints,ceilPaints,primers,colours,supplies}){
  const fmtN=n=>Math.round(n).toLocaleString('en-CA');
  const todayStr=new Date().toLocaleDateString('en-CA',{year:'numeric',month:'long',day:'numeric'});
  const gold='#C4922A';
  const docStyle={background:'#fff',color:'#1a1a1a',borderRadius:8,maxWidth:900,margin:'0 auto',padding:'32px 40px',boxShadow:'0 2px 12px rgba(0,0,0,0.08)'};
  const thStyle={fontSize:11,fontWeight:600,textAlign:'left',padding:'8px 10px',borderBottom:'2px solid #e5e5e5',color:'#888'};
  const tdStyle={fontSize:12,padding:'8px 10px',borderBottom:'1px solid #eee',verticalAlign:'top'};
  const prepLabelsMap={furniture:'Move furniture',plastic:'Cover w/ plastic',outlets:'Remove outlets',drywall:'Drywall repairs',caulking:'Caulking',cleanup:'Clean up'};
  const allColours=[...(colours||[])];
  const getHex=(name)=>{const c=allColours.find(x=>x.n===name);return c?.hex||null;};
  return (
    <div style={{padding:24,overflow:'auto',maxHeight:'100%',background:'#f5f5f0'}}>
      <div style={docStyle}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:24,paddingBottom:16,borderBottom:`2px solid ${gold}`}}>
          <div style={{display:'flex',gap:12,alignItems:'center'}}>
            <img src="/kingdom-logo-dark.svg" alt="Kingdom Painting" style={{height:48}}/>
            <p style={{fontSize:20,fontWeight:700,color:gold,letterSpacing:2}}>QUOTE</p>
          </div>
          <div style={{textAlign:'right'}}>
            <p style={{fontSize:11,color:'#666'}}>{todayStr}</p>
            <p style={{fontSize:10,color:'#999',marginTop:4}}>HST# 71164 5556 RT0001</p>
          </div>
        </div>
        <div style={{display:'flex',justifyContent:'space-between',marginBottom:24,fontSize:12}}>
          <div>
            <p style={{fontWeight:600,color:'#888',fontSize:10,textTransform:'uppercase',marginBottom:4}}>Prepared For</p>
            <p style={{fontWeight:600}}>{client.name||'—'}</p>
            {client.address&&<p style={{color:'#666'}}>{client.address}</p>}
            {client.phone&&<p style={{color:'#666'}}>{client.phone}</p>}
            {client.email&&<p style={{color:'#666'}}>{client.email}</p>}
          </div>
        </div>
        <table style={{width:'100%',borderCollapse:'collapse',marginBottom:24}}>
          <thead><tr>
            <th style={thStyle}>Item</th>
            <th style={thStyle}>Description</th>
            <th style={{...thStyle,textAlign:'right'}}>Amount</th>
          </tr></thead>
          <tbody>
            {rooms.map(r=>{
              const c=calcRoom(r,settings);
              const prepItems=Object.entries(r.prep).filter(([k,v])=>v&&k!=='custom').map(([k])=>prepLabelsMap[k]||k).filter(Boolean);
              if(r.prep?.custom) prepItems.push(r.prep.custom);
              const surfaces=[];
              if(r.walls.enabled) surfaces.push(`${r.walls.coats} coat${r.walls.coats>1?'s':''} on walls — ${fmtN(c.wallSqft)} sqft`);
              if(r.ceiling.enabled) surfaces.push(`${r.ceiling.coats} coat${r.ceiling.coats>1?'s':''} on ceiling — ${fmtN(c.ceilSqft)} sqft`);
              if(r.baseboards.enabled) surfaces.push(`${r.baseboards.coats} coat${r.baseboards.coats>1?'s':''} on baseboards`);
              if(r.crown.enabled) surfaces.push(`${r.crown.coats} coat${r.crown.coats>1?'s':''} on crown moulding`);
              if(r.doorFrames?.enabled) surfaces.push(`${r.doorFrames.coats} coat${r.doorFrames.coats>1?'s':''} on door frames`);
              if(r.doors?.enabled){
                [['Flat','flat'],['6 Panel','sixPanel'],['Custom','custom']].forEach(([label,key])=>{
                  const dt=r.doors[key];if(dt?.count>0) surfaces.push(`${dt.count} ${label} door${dt.count>1?'s':''} — ${dt.coats} coat${dt.coats>1?'s':''}`);
                });
              } else if(r.doors?.count>0) surfaces.push(`${r.doors.count} door${r.doors.count>1?'s':''} — ${r.doors.coats} coat${r.doors.coats>1?'s':''}`);
              if(r.windows?.enabled&&roomWindowLF(r)>0) surfaces.push(`${r.windows.dims?.length||0} window${(r.windows.dims?.length||0)>1?'s':''} — ${r.windows.coats} coat${r.windows.coats>1?'s':''}`);
              else if(r.windows?.count>0) surfaces.push(`${r.windows.count} window${r.windows.count>1?'s':''} — ${r.windows.coats} coat${r.windows.coats>1?'s':''}`);
              const materials=[];
              if(r.walls.enabled&&r.paint.wallProduct){
                const hex=getHex(r.paint.wallColour);
                materials.push({label:`Walls: ${r.paint.wallProduct}`,colour:r.paint.wallColour,sheen:r.paint.wallSheen,hex});
              }
              if(r.ceiling.enabled&&r.paint.ceilProduct){
                const hex=getHex(r.paint.ceilColour);
                materials.push({label:`Ceiling: ${r.paint.ceilProduct}`,colour:r.paint.ceilColour,sheen:r.paint.ceilSheen,hex});
              }
              if((r.baseboards.enabled||r.doors?.enabled||roomDoorCount(r)>0||r.crown.enabled)&&r.paint.trimProduct){
                const hex=getHex(r.paint.trimColour);
                materials.push({label:`Trim: ${r.paint.trimProduct}`,colour:r.paint.trimColour,sheen:r.paint.trimSheen,hex});
              }
              return (
                <tr key={r.id}>
                  <td style={{...tdStyle,fontWeight:600,whiteSpace:'nowrap'}}>{r.name}</td>
                  <td style={tdStyle}>
                    {prepItems.length>0&&<p style={{fontSize:11,marginBottom:4}}><strong>Prep:</strong> {prepItems.join(', ')}</p>}
                    {surfaces.map((s,i)=><p key={i} style={{fontSize:11,color:'#444'}}>{s}</p>)}
                    {materials.length>0&&(
                      <div style={{marginTop:6}}>
                        {materials.map((m,i)=>(
                          <p key={i} style={{fontSize:10,color:'#666',display:'flex',gap:4,alignItems:'center'}}>
                            {m.label} — {m.colour}{m.hex&&<span style={{width:8,height:8,borderRadius:2,background:m.hex,border:'1px solid #ccc',display:'inline-block'}}/>} ({m.sheen})
                          </p>
                        ))}
                      </div>
                    )}
                  </td>
                  <td style={{...tdStyle,textAlign:'right',fontWeight:600,whiteSpace:'nowrap'}}>{fmtCAD(c.cost)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <div style={{borderTop:'2px solid #e5e5e5',paddingTop:16,display:'flex',justifyContent:'flex-end'}}>
          <div style={{width:280}}>
            {(settings.discount||0)>0&&(
              <div style={{display:'flex',justifyContent:'space-between',fontSize:12,marginBottom:6}}>
                <span style={{color:'#888'}}>Discount</span>
                <span style={{color:'#c00'}}>-{fmtCAD(totals.labourSubtotal-totals.discounted)}</span>
              </div>
            )}
            <div style={{display:'flex',justifyContent:'space-between',fontSize:12,marginBottom:6}}>
              <span style={{color:'#888'}}>Labour</span><span>{fmtCAD(totals.discounted)}</span>
            </div>
            <div style={{display:'flex',justifyContent:'space-between',fontSize:12,marginBottom:6}}>
              <span style={{color:'#888'}}>HST on Labour (13%)</span><span>{fmtCAD(totals.taxAmt)}</span>
            </div>
            {totals.materialCost>0&&(
              <div style={{display:'flex',justifyContent:'space-between',fontSize:12,marginBottom:6}}>
                <span style={{color:'#888'}}>Materials</span><span>{fmtCAD(totals.materialCost)}</span>
              </div>
            )}
            <div style={{display:'flex',justifyContent:'space-between',fontSize:14,fontWeight:700,paddingTop:8,borderTop:'2px solid #1a1a1a'}}>
              <span>Total</span><span style={{color:gold}}>{fmtCAD(totals.total)}</span>
            </div>
          </div>
        </div>
        <div style={{marginTop:32,paddingTop:20,borderTop:'1px solid #eee'}}>
          <p style={{fontSize:12,fontWeight:700,marginBottom:12,color:gold}}>Payment Terms</p>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:12}}>
            <div style={{background:'#faf7f2',border:'1px solid #e8e0d4',borderRadius:8,padding:14,textAlign:'center'}}>
              <p style={{fontSize:10,color:'#888',textTransform:'uppercase',fontWeight:600}}>Deposit (30%)</p>
              <p style={{fontSize:16,fontWeight:700,marginTop:4}}>{fmtCAD(totals.deposit)}</p>
            </div>
            <div style={{background:'#faf7f2',border:'1px solid #e8e0d4',borderRadius:8,padding:14,textAlign:'center'}}>
              <p style={{fontSize:10,color:'#888',textTransform:'uppercase',fontWeight:600}}>Midway (35%)</p>
              <p style={{fontSize:16,fontWeight:700,marginTop:4}}>{fmtCAD(totals.midway)}</p>
            </div>
            <div style={{background:'#faf7f2',border:'1px solid #e8e0d4',borderRadius:8,padding:14,textAlign:'center'}}>
              <p style={{fontSize:10,color:'#888',textTransform:'uppercase',fontWeight:600}}>Balance</p>
              <p style={{fontSize:16,fontWeight:700,marginTop:4}}>{fmtCAD(totals.balance)}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── CONTRACT TAB ─────────────────────────────────────────────────────────────
function ContractTab({rooms,settings,client,totals}){
  const fmtN=n=>Math.round(n).toLocaleString('en-CA');
  const todayStr=new Date().toLocaleDateString('en-CA',{year:'numeric',month:'long',day:'numeric'});
  const gold='#C4922A';
  const docStyle={background:'#fff',color:'#1a1a1a',borderRadius:8,maxWidth:900,margin:'0 auto',padding:'32px 40px',boxShadow:'0 2px 12px rgba(0,0,0,0.08)'};
  const sectionTitle={fontSize:13,fontWeight:700,color:gold,marginTop:28,marginBottom:10,paddingBottom:6,borderBottom:`1px solid ${gold}`};
  const bodyText={fontSize:11,lineHeight:'1.7',color:'#444',marginBottom:8};
  let tWalls=0,tCeil=0,tTrim=0,tDoors=0,tHrs=0;
  rooms.forEach(r=>{const c=calcRoom(r,settings);tWalls+=c.wallSqft;tCeil+=c.ceilSqft;tTrim+=c.perimLF;tDoors+=roomDoorCount(r);tHrs+=c.totalHrs;});
  const numWorkers=Math.max(1,settings._standards?.workers||1);
  const estDays=tHrs>0?Math.ceil(tHrs/numWorkers/8):0;

  const clientSigRef=useRef(null);
  const contractorSigRef=useRef(null);
  const clientDrawing=useRef(false);
  const contractorDrawing=useRef(false);

  const initCanvas=(canvasRef,drawingRef)=>{
    const canvas=canvasRef.current;
    if(!canvas)return;
    const ctx=canvas.getContext('2d');
    ctx.lineWidth=2;ctx.lineCap='round';ctx.strokeStyle='#1a1a1a';
    const getPos=(e)=>{
      const rect=canvas.getBoundingClientRect();
      const t=e.touches?e.touches[0]:e;
      return {x:t.clientX-rect.left,y:t.clientY-rect.top};
    };
    const start=(e)=>{e.preventDefault();drawingRef.current=true;const p=getPos(e);ctx.beginPath();ctx.moveTo(p.x,p.y);};
    const move=(e)=>{if(!drawingRef.current)return;e.preventDefault();const p=getPos(e);ctx.lineTo(p.x,p.y);ctx.stroke();};
    const end=()=>{drawingRef.current=false;};
    canvas.addEventListener('mousedown',start);canvas.addEventListener('mousemove',move);canvas.addEventListener('mouseup',end);canvas.addEventListener('mouseleave',end);
    canvas.addEventListener('touchstart',start,{passive:false});canvas.addEventListener('touchmove',move,{passive:false});canvas.addEventListener('touchend',end);
  };

  useEffect(()=>{initCanvas(clientSigRef,clientDrawing);initCanvas(contractorSigRef,contractorDrawing);},[]);

  const clearCanvas=(ref)=>{const c=ref.current;if(c){const ctx=c.getContext('2d');ctx.clearRect(0,0,c.width,c.height);}};

  return (
    <div style={{padding:24,overflow:'auto',maxHeight:'100%',background:'#f5f5f0'}}>
      <div style={docStyle}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:24,paddingBottom:16,borderBottom:`2px solid ${gold}`}}>
          <div style={{display:'flex',gap:12,alignItems:'center'}}>
            <img src="/kingdom-logo-dark.svg" alt="Kingdom Painting" style={{height:48}}/>
            <p style={{fontSize:20,fontWeight:700,color:gold,letterSpacing:2}}>CONTRACT</p>
          </div>
          <div style={{textAlign:'right'}}>
            <p style={{fontSize:11,color:'#666'}}>{todayStr}</p>
          </div>
        </div>

        <p style={sectionTitle}>1. Parties</p>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:20,marginBottom:8}}>
          <div style={{fontSize:11,color:'#444',lineHeight:'1.7'}}>
            <p style={{fontWeight:600,marginBottom:4}}>Client</p>
            <p>{client.name||'—'}</p>
            {client.address&&<p>{client.address}</p>}
            {client.phone&&<p>{client.phone}</p>}
            {client.email&&<p>{client.email}</p>}
          </div>
          <div style={{fontSize:11,color:'#444',lineHeight:'1.7'}}>
            <p style={{fontWeight:600,marginBottom:4}}>Contractor</p>
            <p>David Truong</p>
            <p>25 Fieldview Crescent</p>
            <p>Markham ON L3R 3H6</p>
            <p>(647) 449-6611</p>
            <p>info@kingdompainting.ca</p>
          </div>
        </div>

        <p style={sectionTitle}>2. Scope of Work</p>
        <table style={{width:'100%',borderCollapse:'collapse',fontSize:11,marginBottom:12}}>
          <thead><tr>
            <th style={{textAlign:'left',padding:'6px 8px',borderBottom:'2px solid #e5e5e5',color:'#888',fontWeight:600}}>Room</th>
            <th style={{textAlign:'left',padding:'6px 8px',borderBottom:'2px solid #e5e5e5',color:'#888',fontWeight:600}}>Surfaces</th>
          </tr></thead>
          <tbody>{rooms.map(r=>{
            const parts=[];
            if(r.walls.enabled)parts.push('Walls');
            if(r.ceiling.enabled)parts.push('Ceiling');
            if(r.baseboards.enabled)parts.push('Baseboards');
            if(r.crown.enabled)parts.push('Crown');
            {const dc=roomDoorCount(r);if(dc>0)parts.push(`${dc} Door${dc>1?'s':''}`);}
            {const wc=r.windows?.dims?.length||0;if(r.windows?.enabled&&wc>0)parts.push(`${wc} Window${wc>1?'s':''}`);}
            if(!r.windows?.enabled&&r.windows?.count>0)parts.push(`${r.windows.count} Window${r.windows.count>1?'s':''}`);
            return (
              <tr key={r.id}>
                <td style={{padding:'6px 8px',borderBottom:'1px solid #eee',fontWeight:500}}>{r.name}</td>
                <td style={{padding:'6px 8px',borderBottom:'1px solid #eee',color:'#555'}}>{parts.join(', ')||'—'}</td>
              </tr>
            );
          })}</tbody>
        </table>
        <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:8,marginBottom:8}}>
          <div style={{background:'#faf7f2',borderRadius:6,padding:'8px 10px',textAlign:'center'}}>
            <p style={{fontSize:9,color:'#888',textTransform:'uppercase',fontWeight:600}}>Walls</p>
            <p style={{fontSize:13,fontWeight:700}}>{fmtN(tWalls)} sqft</p>
          </div>
          <div style={{background:'#faf7f2',borderRadius:6,padding:'8px 10px',textAlign:'center'}}>
            <p style={{fontSize:9,color:'#888',textTransform:'uppercase',fontWeight:600}}>Ceiling</p>
            <p style={{fontSize:13,fontWeight:700}}>{fmtN(tCeil)} sqft</p>
          </div>
          <div style={{background:'#faf7f2',borderRadius:6,padding:'8px 10px',textAlign:'center'}}>
            <p style={{fontSize:9,color:'#888',textTransform:'uppercase',fontWeight:600}}>Trims</p>
            <p style={{fontSize:13,fontWeight:700}}>{fmtN(tTrim)} LF</p>
          </div>
          <div style={{background:'#faf7f2',borderRadius:6,padding:'8px 10px',textAlign:'center'}}>
            <p style={{fontSize:9,color:'#888',textTransform:'uppercase',fontWeight:600}}>Doors</p>
            <p style={{fontSize:13,fontWeight:700}}>{tDoors}</p>
          </div>
        </div>

        <p style={sectionTitle}>3. Duration</p>
        <p style={bodyText}>Estimated project duration: <strong>{estDays} working day{estDays!==1?'s':''}</strong>.</p>

        <p style={sectionTitle}>4. Payment Terms</p>
        <p style={bodyText}>Total project cost: <strong>{fmtCAD(totals.total)}</strong> (HST 13% applied to labour only)</p>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:10,marginBottom:12}}>
          <div style={{background:'#faf7f2',border:'1px solid #e8e0d4',borderRadius:8,padding:12,textAlign:'center'}}>
            <p style={{fontSize:9,color:'#888',textTransform:'uppercase',fontWeight:600}}>Deposit (30%)</p>
            <p style={{fontSize:14,fontWeight:700,marginTop:2}}>{fmtCAD(totals.deposit)}</p>
          </div>
          <div style={{background:'#faf7f2',border:'1px solid #e8e0d4',borderRadius:8,padding:12,textAlign:'center'}}>
            <p style={{fontSize:9,color:'#888',textTransform:'uppercase',fontWeight:600}}>Midway (35%)</p>
            <p style={{fontSize:14,fontWeight:700,marginTop:2}}>{fmtCAD(totals.midway)}</p>
          </div>
          <div style={{background:'#faf7f2',border:'1px solid #e8e0d4',borderRadius:8,padding:12,textAlign:'center'}}>
            <p style={{fontSize:9,color:'#888',textTransform:'uppercase',fontWeight:600}}>Balance</p>
            <p style={{fontSize:14,fontWeight:700,marginTop:2}}>{fmtCAD(totals.balance)}</p>
          </div>
        </div>

        <p style={sectionTitle}>5. Changes & Modifications</p>
        <p style={bodyText}>Any changes to the scope of work described herein must be agreed upon in writing by both parties. Additional work will be quoted separately and is subject to additional charges.</p>

        <p style={sectionTitle}>6. Warranties</p>
        <p style={bodyText}>The Contractor warrants all workmanship for a period of two (2) years from the date of project completion. This warranty covers peeling, blistering, and flaking that results from improper application. It does not cover damage caused by the Client, normal wear and tear, or structural defects.</p>

        <p style={sectionTitle}>7. Liability Protection</p>
        <p style={bodyText}>The Contractor carries comprehensive general liability insurance with coverage of $2,000,000. Proof of insurance is available upon request.</p>

        <p style={sectionTitle}>8. Termination</p>
        <p style={bodyText}>Either party may terminate this agreement with written notice. If the Client terminates, the Client shall pay for all work completed to date plus materials purchased. If the Contractor terminates, the Contractor shall complete any work in progress and refund payment for incomplete work.</p>

        <p style={sectionTitle}>9. Indemnification</p>
        <p style={bodyText}>Each party agrees to indemnify and hold harmless the other party from any claims, damages, losses, or expenses arising out of the indemnifying party's breach of this agreement or negligent acts.</p>

        <p style={sectionTitle}>10. Governing Law</p>
        <p style={bodyText}>This agreement shall be governed by and construed in accordance with the laws of the Province of Ontario, Canada.</p>

        <p style={sectionTitle}>11. Entire Agreement</p>
        <p style={bodyText}>This document constitutes the entire agreement between the parties and supersedes all prior negotiations, representations, or agreements relating to this subject matter.</p>

        <p style={sectionTitle}>Signatures</p>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:24,marginTop:12}}>
          <div>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:6}}>
              <p style={{fontSize:11,fontWeight:600}}>Client Signature</p>
              <button onClick={()=>clearCanvas(clientSigRef)} style={{fontSize:10,color:gold,background:'none',border:'none',cursor:'pointer',fontWeight:600}}>Clear</button>
            </div>
            <canvas ref={clientSigRef} width={350} height={100} style={{border:'1px solid #ddd',borderRadius:6,background:'#fafafa',width:'100%',height:100,cursor:'crosshair'}}/>
            <p style={{fontSize:10,color:'#999',marginTop:4}}>{client.name||'Client'}</p>
          </div>
          <div>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:6}}>
              <p style={{fontSize:11,fontWeight:600}}>Contractor Signature</p>
              <button onClick={()=>clearCanvas(contractorSigRef)} style={{fontSize:10,color:gold,background:'none',border:'none',cursor:'pointer',fontWeight:600}}>Clear</button>
            </div>
            <canvas ref={contractorSigRef} width={350} height={100} style={{border:'1px solid #ddd',borderRadius:6,background:'#fafafa',width:'100%',height:100,cursor:'crosshair'}}/>
            <p style={{fontSize:10,color:'#999',marginTop:4}}>David Truong, Kingdom Painting Inc.</p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── CHANGE ORDER TAB ─────────────────────────────────────────────────────────
function ChangeOrderTab({client,items,setItems}){
  const todayStr=new Date().toLocaleDateString('en-CA',{year:'numeric',month:'long',day:'numeric'});
  const gold='#C4922A';
  const docStyle={background:'#fff',color:'#1a1a1a',borderRadius:8,maxWidth:900,margin:'0 auto',padding:'32px 40px',boxShadow:'0 2px 12px rgba(0,0,0,0.08)'};
  const subtotal=items.reduce((s,it)=>s+(parseFloat(it.amount)||0),0);
  const tax=subtotal*0.13;
  const total=subtotal+tax;
  const updateItem=(idx,patch)=>setItems(items.map((it,i)=>i===idx?{...it,...patch}:it));
  const removeItem=(idx)=>setItems(items.filter((_,i)=>i!==idx));
  const addItem=()=>{
    const nextNum=items.length>0?Math.max(...items.map(it=>it.num||0))+1:1;
    setItems([...items,{id:genId(),num:nextNum,desc:'',amount:0}]);
  };
  return (
    <div style={{padding:24,overflow:'auto',maxHeight:'100%',background:'#f5f5f0'}}>
      <div style={docStyle}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:24,paddingBottom:16,borderBottom:`2px solid ${gold}`}}>
          <div style={{display:'flex',gap:12,alignItems:'center'}}>
            <img src="/kingdom-logo-dark.svg" alt="Kingdom Painting" style={{height:48}}/>
            <p style={{fontSize:20,fontWeight:700,color:gold,letterSpacing:2}}>CHANGE ORDER</p>
          </div>
          <div style={{textAlign:'right'}}>
            <p style={{fontSize:11,color:'#666'}}>{todayStr}</p>
            <p style={{fontSize:10,color:'#999',marginTop:4}}>HST# 71164 5556 RT0001</p>
          </div>
        </div>
        <p style={{fontSize:12,marginBottom:20}}><strong>Client:</strong> {client.name||'—'}</p>
        <table style={{width:'100%',borderCollapse:'collapse',marginBottom:16}}>
          <thead><tr>
            <th style={{fontSize:11,fontWeight:600,textAlign:'left',padding:'8px 10px',borderBottom:'2px solid #e5e5e5',color:'#888',width:60}}>Item #</th>
            <th style={{fontSize:11,fontWeight:600,textAlign:'left',padding:'8px 10px',borderBottom:'2px solid #e5e5e5',color:'#888'}}>Description</th>
            <th style={{fontSize:11,fontWeight:600,textAlign:'right',padding:'8px 10px',borderBottom:'2px solid #e5e5e5',color:'#888',width:120}}>Amount</th>
            <th style={{width:40,borderBottom:'2px solid #e5e5e5'}}/>
          </tr></thead>
          <tbody>
            {items.map((it,idx)=>(
              <tr key={it.id}>
                <td style={{padding:'6px 10px',borderBottom:'1px solid #eee'}}>
                  <input type='number' value={it.num||''} onChange={e=>updateItem(idx,{num:+e.target.value})} style={{width:40,border:'1px solid #ddd',borderRadius:4,padding:'4px 6px',fontSize:12,textAlign:'center'}}/>
                </td>
                <td style={{padding:'6px 10px',borderBottom:'1px solid #eee'}}>
                  <input type='text' value={it.desc} onChange={e=>updateItem(idx,{desc:e.target.value})} placeholder='Description' style={{width:'100%',border:'1px solid #ddd',borderRadius:4,padding:'4px 8px',fontSize:12}}/>
                </td>
                <td style={{padding:'6px 10px',borderBottom:'1px solid #eee',textAlign:'right'}}>
                  <input type='number' value={it.amount||''} onChange={e=>updateItem(idx,{amount:+e.target.value})} style={{width:100,border:'1px solid #ddd',borderRadius:4,padding:'4px 8px',fontSize:12,textAlign:'right'}}/>
                </td>
                <td style={{padding:'6px 10px',borderBottom:'1px solid #eee',textAlign:'center'}}>
                  <button onClick={()=>removeItem(idx)} style={{background:'none',border:'none',cursor:'pointer',color:'#c00',fontSize:14}}><Trash2 size={13}/></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <button onClick={addItem} style={{fontSize:12,color:gold,background:'none',border:`1px dashed ${gold}`,borderRadius:6,padding:'8px 16px',cursor:'pointer',width:'100%',fontWeight:600}}>
          + Add Item
        </button>
        <div style={{borderTop:'2px solid #e5e5e5',marginTop:20,paddingTop:16,display:'flex',justifyContent:'flex-end'}}>
          <div style={{width:220}}>
            <div style={{display:'flex',justifyContent:'space-between',fontSize:12,marginBottom:6}}>
              <span style={{color:'#888'}}>Subtotal</span><span>{fmtCAD(subtotal)}</span>
            </div>
            <div style={{display:'flex',justifyContent:'space-between',fontSize:12,marginBottom:6}}>
              <span style={{color:'#888'}}>HST (13%)</span><span>{fmtCAD(tax)}</span>
            </div>
            <div style={{display:'flex',justifyContent:'space-between',fontSize:14,fontWeight:700,paddingTop:8,borderTop:'2px solid #1a1a1a'}}>
              <span>Total</span><span style={{color:gold}}>{fmtCAD(total)}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}



// ─── LABOUR RATES TAB (React) ────────────────────────────────────────────────
function LabourRatesTab({labour,setLabour,onSave}){
  const [saving,setSaving]=useState(false);
  const [saveMsg,setSaveMsg]=useState('');

  const L = labour;
  const workers = L.workers||[];
  const overheadItems = L.overheadItems||[];
  const numWorkers = workers.filter(w=>w.active).length||1;
  const billable = L.billable||1700;
  const totalOH = overheadItems.reduce((s,i)=>s+(i.v||0),0);
  const ohPerHr = totalOH/(numWorkers*billable);
  const avgWage = workers.filter(w=>w.active).reduce((s,w)=>s+w.r,0)/Math.max(1,workers.filter(w=>w.active).length);
  const fieldWage = L.taxes ? avgWage*1.3 : avgWage;
  const profitTarget = L.profitTarget||0;
  const profitPerHr = profitTarget/(numWorkers*billable);
  const totalHr = ohPerHr + fieldWage + profitPerHr;
  const totalAll = totalHr * numWorkers;

  const upd = (patch)=>setLabour(prev=>({...prev,...patch}));
  const updWorker = (idx,patch)=>{
    const next=[...workers];
    next[idx]={...next[idx],...patch};
    upd({workers:next});
  };
  const addWorker = ()=>upd({workers:[...workers,{n:'Worker',r:25,active:true}]});
  const removeWorker = (idx)=>upd({workers:workers.filter((_,i)=>i!==idx)});
  const updOH = (idx,patch)=>{
    const next=[...overheadItems];
    next[idx]={...next[idx],...patch};
    upd({overheadItems:next});
  };
  const addOH = ()=>upd({overheadItems:[...overheadItems,{n:'New item',v:0}]});
  const removeOH = (idx)=>upd({overheadItems:overheadItems.filter((_,i)=>i!==idx)});

  const doSave = async()=>{
    setSaving(true);setSaveMsg('');
    const ok = await onSave();
    setSaveMsg(ok?'Saved':'Save failed');
    setSaving(false);
    setTimeout(()=>setSaveMsg(''),3000);
  };

  const fieldS = {fontSize:12,padding:'6px 10px',border:'1px solid var(--border)',borderRadius:6,background:'var(--card)',color:'var(--fg)',width:'100%'};
  const numS = {...fieldS,textAlign:'right'};

  return (
    <div style={{padding:24,overflowY:'auto',height:'100%'}}>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16,marginBottom:16}}>
        <Card className='p-5'>
          <p style={{fontSize:11,fontWeight:700,textTransform:'uppercase',letterSpacing:'0.06em',color:'var(--primary)',marginBottom:12}}>Rate Calculation</p>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:10,marginBottom:12}}>
            <div><Label>Billable hours/year</Label><input type='number' value={L.billable||1700} onChange={e=>upd({billable:+e.target.value})} style={numS}/></div>
            <div><Label>Labour buffer</Label><input type='number' step='0.05' value={L.buffer||1.25} onChange={e=>upd({buffer:+e.target.value})} style={numS}/></div>
            <div><Label>Materials buffer</Label><input type='number' step='0.05' value={L.matBuffer||1.25} onChange={e=>upd({matBuffer:+e.target.value})} style={numS}/></div>
          </div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:12}}>
            <div style={{background:'rgba(0,0,0,0.03)',borderRadius:8,padding:'10px 12px'}}>
              <label style={{display:'flex',gap:6,alignItems:'center',fontSize:12,fontWeight:600,marginBottom:8,cursor:'pointer'}}>
                <input type='checkbox' checked={!!L.discount} onChange={e=>upd({discount:e.target.checked})}/> Discount %
              </label>
              <div><Label>Percentage</Label><input type='number' value={L.discPct||10} min={0} max={100} onChange={e=>upd({discPct:+e.target.value})} style={numS}/></div>
            </div>
            <div style={{background:'rgba(0,0,0,0.03)',borderRadius:8,padding:'10px 12px'}}>
              <label style={{display:'flex',gap:6,alignItems:'center',fontSize:12,fontWeight:600,marginBottom:8,cursor:'pointer'}}>
                <input type='checkbox' checked={!!L.discountAmt} onChange={e=>upd({discountAmt:e.target.checked})}/> Discount $
              </label>
              <div><Label>Amount</Label><input type='number' value={L.discAmt||0} min={0} onChange={e=>upd({discAmt:+e.target.value})} style={numS}/></div>
            </div>
          </div>
          <div style={{borderTop:'1px solid var(--border)',paddingTop:12}}>
            <table style={{width:'100%',fontSize:13,borderCollapse:'collapse'}}>
              <tbody>
                <tr><td style={{padding:'6px 0',color:'var(--muted-fg)'}}>Overhead / hr</td><td style={{textAlign:'right',padding:'6px 0'}}>${ohPerHr.toFixed(2)}</td></tr>
                <tr><td style={{padding:'6px 0',color:'var(--muted-fg)'}}>Field wage / worker</td><td style={{textAlign:'right',padding:'6px 0'}}>${fieldWage.toFixed(2)}/hr</td></tr>
                <tr style={{fontWeight:500}}><td style={{padding:'6px 0'}}>Profit / hr</td><td style={{textAlign:'right',padding:'6px 0',color:'var(--primary)'}}>${profitPerHr.toFixed(2)}/hr</td></tr>
                <tr style={{fontWeight:500,borderTop:'2px solid var(--border)'}}><td style={{padding:'8px 0'}}>Total hourly rate (all workers)</td><td style={{textAlign:'right',padding:'8px 0',color:'var(--primary)',fontSize:15}}>${totalAll.toFixed(2)}/hr</td></tr>
              </tbody>
            </table>
          </div>
        </Card>

        <Card className='p-5'>
          <p style={{fontSize:11,fontWeight:700,textTransform:'uppercase',letterSpacing:'0.06em',color:'var(--primary)',marginBottom:12}}>Overhead Costs</p>
          {overheadItems.map((item,i)=>(
            <div key={i} style={{display:'grid',gridTemplateColumns:'1fr 90px 28px',alignItems:'center',gap:6,padding:'4px 0',borderBottom:'1px solid rgba(0,0,0,0.05)'}}>
              <input type='text' value={item.n} onChange={e=>updOH(i,{n:e.target.value})} style={fieldS}/>
              <input type='number' value={item.v} min={0} onChange={e=>updOH(i,{v:+e.target.value})} style={numS}/>
              <button onClick={()=>removeOH(i)} style={{background:'none',border:'none',cursor:'pointer',color:'var(--muted-fg)',fontSize:14}}>×</button>
            </div>
          ))}
          <button onClick={addOH} style={{marginTop:8,width:'100%',padding:7,border:'1px dashed var(--muted)',borderRadius:6,background:'transparent',color:'var(--muted-fg)',fontSize:12,cursor:'pointer'}}>+ Add item</button>
          <div style={{borderTop:'1px solid var(--border)',marginTop:12,paddingTop:10,display:'flex',justifyContent:'space-between',fontSize:13,fontWeight:500}}>
            <span>Total overhead</span><span style={{color:'var(--primary)'}}>{fmtCAD(totalOH)}</span>
          </div>
        </Card>
      </div>

      <Card className='p-5' style={{marginBottom:16}}>
        <p style={{fontSize:11,fontWeight:700,textTransform:'uppercase',letterSpacing:'0.06em',color:'var(--primary)',marginBottom:12}}>Field Workers</p>
        <div style={{display:'flex',flexWrap:'wrap',gap:8}}>
          {workers.map((w,i)=>(
            <div key={i} style={{position:'relative',display:'flex',alignItems:'center',gap:6,padding:'8px 32px 8px 10px',background:'rgba(0,0,0,0.03)',borderRadius:8,border:'1px solid var(--border)'}}>
              <input type='checkbox' checked={w.active} onChange={e=>updWorker(i,{active:e.target.checked})}/>
              <input type='text' value={w.n} onChange={e=>updWorker(i,{n:e.target.value})} style={{...fieldS,width:72}}/>
              <span style={{fontSize:11,color:'var(--muted-fg)'}}>$</span>
              <input type='number' value={w.r} min={0} onChange={e=>updWorker(i,{r:+e.target.value})} style={{...numS,width:52}}/>
              <span style={{fontSize:10,color:'var(--muted-fg)'}}>/hr</span>
              <button onClick={()=>removeWorker(i)} style={{position:'absolute',top:4,right:4,background:'none',border:'none',cursor:'pointer',color:'var(--muted-fg)',fontSize:13}}>×</button>
            </div>
          ))}
        </div>
        <button onClick={addWorker} style={{marginTop:10,width:'100%',padding:7,border:'1px dashed var(--muted)',borderRadius:6,background:'transparent',color:'var(--muted-fg)',fontSize:12,cursor:'pointer'}}>+ Add worker</button>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginTop:12,paddingTop:12,borderTop:'1px solid var(--border)'}}>
          <span style={{fontSize:13}}>Active workers: <strong>{numWorkers}</strong></span>
          <span style={{fontSize:15,fontWeight:500,color:'var(--primary)'}}>${fieldWage.toFixed(2)}<span style={{fontSize:11,color:'var(--muted-fg)',marginLeft:4}}>/hr field wage</span></span>
        </div>
        <div style={{marginTop:10,paddingTop:10,borderTop:'1px solid var(--border)'}}>
          <label style={{display:'flex',gap:8,alignItems:'center',fontSize:12,cursor:'pointer'}}>
            <input type='checkbox' checked={L.taxes!==false} onChange={e=>upd({taxes:e.target.checked})}/> Apply payroll taxes
          </label>
        </div>
      </Card>

      <Card className='p-5' style={{marginBottom:16}}>
        <p style={{fontSize:11,fontWeight:700,textTransform:'uppercase',letterSpacing:'0.06em',color:'var(--primary)',marginBottom:12}}>Profit</p>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16,alignItems:'end'}}>
          <div>
            <Label>Target profit ($)</Label>
            <input type='number' value={L.profitTarget||0} min={0} step={100} onChange={e=>upd({profitTarget:+e.target.value})} placeholder='e.g. 5000' style={numS}/>
          </div>
          <div style={{background:'rgba(0,0,0,0.03)',borderRadius:8,padding:'10px 14px',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
            <span style={{fontSize:12,color:'var(--muted-fg)'}}>Profit / hr</span>
            <span style={{fontSize:15,fontWeight:600,color:'var(--primary)'}}>${profitPerHr.toFixed(2)}/hr</span>
          </div>
        </div>
      </Card>

      <div style={{display:'flex',alignItems:'center',gap:12}}>
        <button onClick={doSave} disabled={saving} style={{padding:'9px 24px',background:'var(--primary)',color:'#fff',border:'none',borderRadius:7,fontSize:13,fontWeight:700,cursor:'pointer'}}>
          {saving?'Saving…':'Save Settings'}
        </button>
        {saveMsg&&<span style={{fontSize:12,fontWeight:600,color:saveMsg==='Saved'?'#22c55e':'#ef4444'}}>{saveMsg==='Saved'?'✓ ':''}{saveMsg}</span>}
      </div>
    </div>
  );
}

// ─── PAINT INPUTS TAB (React) ────────────────────────────────────────────────
function DragTable({items,setItems,columns,renderRow,addLabel,onAdd}){
  const [dragIdx,setDragIdx]=useState(null);
  const reorder=(from,to)=>{
    if(from===to)return;
    const next=[...items];
    const [moved]=next.splice(from,1);
    next.splice(to,0,moved);
    setItems(next);
  };
  return (
    <table style={{width:'100%',borderCollapse:'collapse',fontSize:12}}>
      <thead><tr style={{borderBottom:'1px solid var(--border)'}}>
        <th style={{width:24,padding:'6px 4px'}}/>
        {columns.map(c=><th key={c.label} style={{textAlign:c.align||'left',padding:'6px 8px',fontSize:11,color:'var(--muted-fg)',fontWeight:600,...(c.width?{width:c.width}:{})}}>{c.label}</th>)}
        <th style={{width:28}}/>
      </tr></thead>
      <tbody>
        {items.map((item,i)=>(
          <tr key={i} style={{borderBottom:'1px solid rgba(0,0,0,0.05)',opacity:dragIdx===i?0.4:1}}
            onDragOver={e=>{e.preventDefault();e.currentTarget.style.borderTop='2px solid var(--primary)';}}
            onDragLeave={e=>{e.currentTarget.style.borderTop='';}}
            onDrop={e=>{e.preventDefault();e.currentTarget.style.borderTop='';reorder(dragIdx,i);setDragIdx(null);}}>
            <td style={{padding:'4px 2px',cursor:'grab'}} draggable onDragStart={()=>setDragIdx(i)} onDragEnd={()=>setDragIdx(null)}>
              <GripVertical size={14} style={{color:'var(--muted-fg)'}}/>
            </td>
            {renderRow(item,i)}
          </tr>
        ))}
        <tr><td colSpan={columns.length+2} style={{padding:'8px 6px 4px'}}>
          <button onClick={onAdd} style={{width:'100%',padding:7,border:'1px dashed var(--muted)',borderRadius:6,background:'transparent',color:'var(--muted-fg)',fontSize:12,cursor:'pointer'}}>+ {addLabel}</button>
        </td></tr>
      </tbody>
    </table>
  );
}

function PaintInputsTab({paints,setPaints,ceilPaints,setCeilPaints,primers,setPrimers,colours,setColours,supplies,setSupplies,onSave}){
  const [saving,setSaving]=useState(false);
  const [saveMsg,setSaveMsg]=useState('');

  const doSave = async()=>{
    setSaving(true);setSaveMsg('');
    const ok = await onSave();
    setSaveMsg(ok?'Saved':'Save failed');
    setSaving(false);
    setTimeout(()=>setSaveMsg(''),3000);
  };

  const fieldS = {fontSize:12,padding:'5px 8px',border:'1px solid var(--border)',borderRadius:6,background:'var(--card)',color:'var(--fg)',width:'100%'};
  const numS = {...fieldS,textAlign:'right',width:80};

  const updItem = (arr,setArr,idx,patch)=>{
    const next=[...arr];
    next[idx]={...next[idx],...patch};
    setArr(next);
  };
  const delItem = (arr,setArr,idx)=>setArr(arr.filter((_,i)=>i!==idx));

  const paintRow = (item,i,arr,setArr)=>(
    <>
      <td style={{padding:'4px 6px'}}><input type='text' value={item.n||''} onChange={e=>updItem(arr,setArr,i,{n:e.target.value})} style={fieldS}/></td>
      <td style={{padding:'4px 6px'}}><input type='number' min={0} step={0.01} value={item.g||0} onChange={e=>updItem(arr,setArr,i,{g:+e.target.value})} style={numS}/></td>
      <td style={{padding:'4px 6px'}}><input type='number' min={0} step={0.01} value={item.p||0} onChange={e=>updItem(arr,setArr,i,{p:+e.target.value})} style={numS}/></td>
      <td style={{padding:'4px 6px'}}><button onClick={()=>delItem(arr,setArr,i)} style={{background:'none',border:'none',cursor:'pointer',color:'var(--muted-fg)',fontSize:14}}>×</button></td>
    </>
  );

  const paintCols = [{label:'Product'},{label:'Gallon $',align:'right',width:80},{label:'Pail $',align:'right',width:80}];

  return (
    <div style={{padding:24,overflowY:'auto',height:'100%'}}>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16,marginBottom:16}}>
        <Card className='p-5'>
          <p style={{fontSize:11,fontWeight:700,textTransform:'uppercase',letterSpacing:'0.06em',color:'var(--primary)',marginBottom:12}}>Paints (Walls & Trim)</p>
          <DragTable items={paints} setItems={setPaints} columns={paintCols}
            renderRow={(item,i)=>paintRow(item,i,paints,setPaints)}
            addLabel='Add paint' onAdd={()=>setPaints(p=>[...p,{n:'',g:0,p:0}])}/>

          <p style={{fontSize:11,fontWeight:700,textTransform:'uppercase',letterSpacing:'0.06em',color:'var(--primary)',marginTop:20,marginBottom:12}}>Paints (Ceiling)</p>
          <DragTable items={ceilPaints} setItems={setCeilPaints} columns={paintCols}
            renderRow={(item,i)=>paintRow(item,i,ceilPaints,setCeilPaints)}
            addLabel='Add ceiling paint' onAdd={()=>setCeilPaints(p=>[...p,{n:'',g:0,p:0}])}/>
        </Card>

        <Card className='p-5'>
          <p style={{fontSize:11,fontWeight:700,textTransform:'uppercase',letterSpacing:'0.06em',color:'var(--primary)',marginBottom:12}}>Primers</p>
          <DragTable items={primers} setItems={setPrimers} columns={paintCols}
            renderRow={(item,i)=>paintRow(item,i,primers,setPrimers)}
            addLabel='Add primer' onAdd={()=>setPrimers(p=>[...p,{n:'',g:0,p:0}])}/>
        </Card>

        <Card className='p-5'>
          <p style={{fontSize:11,fontWeight:700,textTransform:'uppercase',letterSpacing:'0.06em',color:'var(--primary)',marginBottom:12}}>Paint Colours</p>
          <DragTable items={colours} setItems={setColours}
            columns={[{label:'Swatch',width:36},{label:'Name'}]}
            renderRow={(item,i)=>(
              <>
                <td style={{padding:'4px 6px',width:36}}>
                  <input type='color' value={item.h||'#cccccc'} onChange={e=>{const next=[...colours];next[i]={...next[i],h:e.target.value};setColours(next);}}
                    style={{width:30,height:28,padding:2,border:'1px solid var(--border)',borderRadius:6,cursor:'pointer',background:'var(--card)'}}/>
                </td>
                <td style={{padding:'4px 6px'}}><input type='text' value={item.n||''} onChange={e=>{const next=[...colours];next[i]={...next[i],n:e.target.value};setColours(next);}} style={fieldS}/></td>
                <td style={{padding:'4px 6px',width:32}}><button onClick={()=>setColours(colours.filter((_,j)=>j!==i))} style={{background:'none',border:'none',cursor:'pointer',color:'var(--muted-fg)',fontSize:14}}>×</button></td>
              </>
            )}
            addLabel='Add colour' onAdd={()=>setColours(c=>[...c,{n:'',h:'#cccccc'}])}/>
        </Card>

        <Card className='p-5'>
          <p style={{fontSize:11,fontWeight:700,textTransform:'uppercase',letterSpacing:'0.06em',color:'var(--primary)',marginBottom:12}}>Supplies</p>
          <DragTable items={supplies} setItems={setSupplies}
            columns={[{label:'Name'},{label:'Price',align:'right',width:80}]}
            renderRow={(item,i)=>(
              <>
                <td style={{padding:'4px 6px'}}><input type='text' value={item.n||''} onChange={e=>{const next=[...supplies];next[i]={...next[i],n:e.target.value};setSupplies(next);}} style={fieldS}/></td>
                <td style={{padding:'4px 6px'}}><input type='number' min={0} step={0.01} value={item.p||0} onChange={e=>{const next=[...supplies];next[i]={...next[i],p:+e.target.value};setSupplies(next);}} style={numS}/></td>
                <td style={{padding:'4px 6px',width:32}}><button onClick={()=>setSupplies(supplies.filter((_,j)=>j!==i))} style={{background:'none',border:'none',cursor:'pointer',color:'var(--muted-fg)',fontSize:14}}>×</button></td>
              </>
            )}
            addLabel='Add supply' onAdd={()=>setSupplies(s=>[...s,{n:'',p:0}])}/>
        </Card>
      </div>

      <div style={{display:'flex',alignItems:'center',gap:12}}>
        <button onClick={doSave} disabled={saving} style={{padding:'9px 24px',background:'var(--primary)',color:'#fff',border:'none',borderRadius:7,fontSize:13,fontWeight:700,cursor:'pointer'}}>
          {saving?'Saving…':'Save Settings'}
        </button>
        {saveMsg&&<span style={{fontSize:12,fontWeight:600,color:saveMsg==='Saved'?'#22c55e':'#ef4444'}}>{saveMsg==='Saved'?'✓ ':''}{saveMsg}</span>}
      </div>
    </div>
  );
}

// ─── STANDARDS TAB (React) ───────────────────────────────────────────────────
function StandardsTab({standards,setStandards,onSave}){
  const [saving,setSaving]=useState(false);
  const [saveMsg,setSaveMsg]=useState('');

  const doSave = async()=>{
    setSaving(true);setSaveMsg('');
    const ok = await onSave();
    setSaveMsg(ok?'Saved':'Save failed');
    setSaving(false);
    setTimeout(()=>setSaveMsg(''),3000);
  };

  const upd = (surface,coats,val)=>{
    setStandards(prev=>{
      const next={...prev};
      if(surface==='removeStucco') next.removeStucco={rate:val};
      else next[surface]={...prev[surface],[coats]:val};
      return next;
    });
  };

  const numS = {width:80,textAlign:'right',fontSize:13,padding:'4px 8px',border:'1px solid var(--border)',borderRadius:6,background:'var(--card)',color:'var(--fg)'};

  const coatTable = (surface,subtitle)=>(
    <div>
      {subtitle&&<p style={{fontSize:10,fontWeight:700,textTransform:'uppercase',letterSpacing:'0.07em',color:'var(--muted-fg)',margin:'4px 0 6px'}}>{subtitle}</p>}
      <table style={{width:'100%',borderCollapse:'collapse',fontSize:13}}>
        <thead><tr style={{borderBottom:'1px solid var(--border)'}}><th style={{textAlign:'left',padding:'6px 8px',fontSize:11,color:'var(--muted-fg)',fontWeight:600}}>Coats</th><th style={{textAlign:'right',padding:'6px 8px',fontSize:11,color:'var(--muted-fg)',fontWeight:600}}>Sqft/Hr</th></tr></thead>
        <tbody>
          <tr style={{borderBottom:'1px solid rgba(0,0,0,0.05)'}}><td style={{padding:'6px 8px'}}>1 coat</td><td style={{padding:'6px 8px',textAlign:'right'}}><input type='number' min={0} value={standards[surface]?.[1]||''} onChange={e=>upd(surface,1,+e.target.value)} style={numS}/></td></tr>
          <tr style={{borderBottom:'1px solid rgba(0,0,0,0.05)'}}><td style={{padding:'6px 8px'}}>2 coats</td><td style={{padding:'6px 8px',textAlign:'right'}}><input type='number' min={0} value={standards[surface]?.[2]||''} onChange={e=>upd(surface,2,+e.target.value)} style={numS}/></td></tr>
          <tr style={{borderBottom:'1px solid rgba(0,0,0,0.05)'}}><td style={{padding:'6px 8px'}}>Primer & 2 coats</td><td style={{padding:'6px 8px',textAlign:'right'}}><input type='number' min={0} value={standards[surface]?.[3]||''} onChange={e=>upd(surface,3,+e.target.value)} style={numS}/></td></tr>
        </tbody>
      </table>
    </div>
  );

  const trimTable = (surface,label)=>(
    <>
      <tr style={{borderBottom:'1px solid rgba(0,0,0,0.05)'}}><td rowSpan={3} style={{padding:'6px 8px',verticalAlign:'top',fontWeight:500}}>{label}</td><td style={{padding:'6px 8px'}}>1</td><td style={{padding:'6px 8px',textAlign:'right'}}><input type='number' min={0} value={standards[surface]?.[1]||''} onChange={e=>upd(surface,1,+e.target.value)} style={{...numS,width:70}}/></td></tr>
      <tr style={{borderBottom:'1px solid rgba(0,0,0,0.05)'}}><td style={{padding:'6px 8px'}}>2</td><td style={{padding:'6px 8px',textAlign:'right'}}><input type='number' min={0} value={standards[surface]?.[2]||''} onChange={e=>upd(surface,2,+e.target.value)} style={{...numS,width:70}}/></td></tr>
      <tr style={{borderBottom:'1px solid var(--border)'}}><td style={{padding:'6px 8px'}}>Primer & 2 Coats</td><td style={{padding:'6px 8px',textAlign:'right'}}><input type='number' min={0} value={standards[surface]?.[3]||''} onChange={e=>upd(surface,3,+e.target.value)} style={{...numS,width:70}}/></td></tr>
    </>
  );

  return (
    <div style={{padding:24,overflowY:'auto',height:'100%'}}>
      <div style={{fontSize:12,color:'var(--muted-fg)',marginBottom:14,padding:'10px 14px',background:'rgba(0,0,0,0.03)',borderRadius:6,borderLeft:'3px solid var(--primary)'}}>
        All values are editable and update labour calculations in real time.
      </div>

      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16,marginBottom:16}}>
        <Card className='p-5'>
          <p style={{fontSize:11,fontWeight:700,textTransform:'uppercase',letterSpacing:'0.06em',color:'var(--primary)',marginBottom:12}}>Walls — sqft per hour</p>
          {coatTable('walls')}
        </Card>

        <Card className='p-5'>
          <p style={{fontSize:11,fontWeight:700,textTransform:'uppercase',letterSpacing:'0.06em',color:'var(--primary)',marginBottom:12}}>Ceiling — sqft per hour</p>
          {coatTable('flatCeiling','Flat / Drywall')}
          <div style={{borderTop:'1px solid var(--border)',margin:'12px 0 10px'}}/>
          {coatTable('stuccoCeiling','Stucco')}
          <div style={{borderTop:'1px solid var(--border)',margin:'12px 0 10px'}}/>
          <p style={{fontSize:10,fontWeight:700,textTransform:'uppercase',letterSpacing:'0.07em',color:'var(--muted-fg)',marginBottom:8}}>Remove Stucco — rate per sqft</p>
          <div>
            <Label>$ per sqft</Label>
            <input type='number' min={0} step={0.05} value={standards.removeStucco?.rate||0.75} onChange={e=>{if(+e.target.value>0)upd('removeStucco',0,+e.target.value);}} style={{...numS,width:100}}/>
          </div>
        </Card>

        <Card className='p-5'>
          <p style={{fontSize:11,fontWeight:700,textTransform:'uppercase',letterSpacing:'0.06em',color:'var(--primary)',marginBottom:12}}>Trims — linear feet per hour</p>
          <table style={{width:'100%',borderCollapse:'collapse',fontSize:13}}>
            <thead><tr style={{borderBottom:'1px solid var(--border)'}}>
              <th style={{textAlign:'left',padding:'6px 8px',fontSize:11,color:'var(--muted-fg)',fontWeight:600}}>Surface</th>
              <th style={{textAlign:'left',padding:'6px 8px',fontSize:11,color:'var(--muted-fg)',fontWeight:600}}>Coats</th>
              <th style={{textAlign:'right',padding:'6px 8px',fontSize:11,color:'var(--muted-fg)',fontWeight:600}}>LF/Hr</th>
            </tr></thead>
            <tbody>
              {trimTable('baseboards','Baseboards')}
              {trimTable('crown','Crown')}
              {trimTable('doorFrames','Door Frames')}
              {trimTable('windows','Windows')}
            </tbody>
          </table>
        </Card>

        <Card className='p-5'>
          <p style={{fontSize:11,fontWeight:700,textTransform:'uppercase',letterSpacing:'0.06em',color:'var(--primary)',marginBottom:12}}>Doors — sqft per hour</p>
          {coatTable('doorsFlat','Flat')}
          <div style={{borderTop:'1px solid var(--border)',margin:'12px 0 10px'}}/>
          {coatTable('doors6Panel','6 Panel')}
          <div style={{borderTop:'1px solid var(--border)',margin:'12px 0 10px'}}/>
          {coatTable('doorsCustom','Custom')}
        </Card>
      </div>

      <div style={{display:'flex',alignItems:'center',gap:12}}>
        <button onClick={doSave} disabled={saving} style={{padding:'9px 24px',background:'var(--primary)',color:'#fff',border:'none',borderRadius:7,fontSize:13,fontWeight:700,cursor:'pointer'}}>
          {saving?'Saving…':'Save Settings'}
        </button>
        {saveMsg&&<span style={{fontSize:12,fontWeight:600,color:saveMsg==='Saved'?'#22c55e':'#ef4444'}}>{saveMsg==='Saved'?'✓ ':''}{saveMsg}</span>}
      </div>
    </div>
  );
}

// ─── MASTER ESTIMATE (React-based with tabs) ─────────────────────────────────
function MasterEstimate(){
  const [rooms,setRooms]=useState(()=>[newRoom('1',1)]);
  const [roomCounter,setRoomCounter]=useState(1);
  const [client,setClient]=useState({name:'',email:'',phone:'',address:''});
  const [changeItems,setChangeItems]=useState([]);
  const [changeCounter,setChangeCounter]=useState(0);
  const [currentEstimateId,setCurrentEstimateId]=useState(null);
  const [activeTab,setActiveTab]=useState('cover');
  const [savedEstimates,setSavedEstimates]=useState([]);
  const [showLoadPanel,setShowLoadPanel]=useState(false);
  const [saving,setSaving]=useState(false);
  const [saveMsg,setSaveMsg]=useState('');
  const [deals,setDeals]=useState([]);
  const [contacts,setContacts]=useState([]);
  const [selectedDealId,setSelectedDealId]=useState(null);

  const ps=usePaintSettings();

  const workers=ps.labour.workers?.filter(w=>w.active)||[];
  const numWorkers=workers.length||1;
  const avgWage=workers.reduce((s,w)=>s+w.r,0)/numWorkers;
  const fieldWage=ps.labour.taxes?avgWage*1.3:avgWage;
  const ohPerHr=(ps.labour.overheadItems||[]).reduce((s,i)=>s+(i.v||0),0)/(numWorkers*(ps.labour.billable||1700));
  const profitPerHr=(ps.labour.profitTarget||0)/(numWorkers*(ps.labour.billable||1700));
  const hourlyRate=(ohPerHr+fieldWage+profitPerHr)*numWorkers;
  const settings={
    hourlyRate:hourlyRate||65,
    labourBuffer:ps.labour.buffer||1.25,
    taxRate:13,
    discount:ps.labour.discount||0,
    _standards:ps.standards
  };

  const paintTotal=calcPaintCosts(rooms,ps.paints||[],ps.ceilPaints||[],ps.primers||[],ps.colours||[],settings._standards?.matBuffer||1.15).total;
  const supplyTotal=rooms.reduce((s,r)=>s+calcRoomSupplyCost(r,ps.supplies||[]),0);
  const totals=calcTotals(rooms,settings,paintTotal+supplyTotal);
  const totalHrs=rooms.reduce((s,r)=>s+calcRoom(r,settings).totalHrs,0);

  useEffect(()=>{
    api.loadDeals().then(d=>{setDeals(d);setContacts(api.getContacts());});
    api.loadContacts().then(()=>setContacts(api.getContacts()));
  },[]);

  const saveTimerRef=useRef(null);
  const buildTitle=useCallback(()=>{
    const deal=deals.find(d=>d.id===selectedDealId);
    const project=deal?.dealName||'';
    const name=client.name||'';
    if(project&&name) return `${project} - ${name}`;
    return project||name||'Untitled Estimate';
  },[deals,selectedDealId,client.name]);

  const doSave=useCallback(async(rid,rms,cli,ci,cc,rc,sdid)=>{
    if(!_session?.user?.id)return;
    setSaving(true);setSaveMsg('');
    try{
      const payload={
        user_id:_session.user.id,
        title:buildTitle(),
        client_name:cli.name,client_email:cli.email,client_phone:cli.phone,
        addr1:cli.address||'',
        state:JSON.stringify({rooms:rms,roomCounter:rc,changeItems:ci,changeCounter:cc,client:cli,selectedDealId:sdid})
      };
      if(rid){
        await supaFetch(`/rest/v1/estimates?id=eq.${rid}`,'PATCH',payload);
      }else{
        const rows=await supaFetch('/rest/v1/estimates','POST',payload);
        if(rows&&rows[0])setCurrentEstimateId(rows[0].id);
      }
      setSaveMsg('Saved');
    }catch(e){setSaveMsg('Error');console.warn('Save error:',e);}
    finally{setSaving(false);}
    setTimeout(()=>setSaveMsg(''),3000);
  },[buildTitle]);

  const handleSave=()=>{
    if(saveTimerRef.current)clearTimeout(saveTimerRef.current);
    doSave(currentEstimateId,rooms,client,changeItems,changeCounter,roomCounter,selectedDealId);
  };

  useEffect(()=>{
    if(saveTimerRef.current)clearTimeout(saveTimerRef.current);
    saveTimerRef.current=setTimeout(()=>{
      doSave(currentEstimateId,rooms,client,changeItems,changeCounter,roomCounter,selectedDealId);
    },1500);
    return ()=>{if(saveTimerRef.current)clearTimeout(saveTimerRef.current);};
  },[rooms,client,changeItems,roomCounter,changeCounter,currentEstimateId,selectedDealId,doSave]);

  const loadEstimates=async()=>{
    if(!_session?.user?.id)return;
    try{
      const rows=await supaFetch(`/rest/v1/estimates?user_id=eq.${_session.user.id}&select=id,title,client_name,client_email,updated_at&order=updated_at.desc&limit=50`);
      setSavedEstimates(rows||[]);
    }catch(e){console.warn('Load estimates error:',e);}
    setShowLoadPanel(true);
  };

  const loadEstimate=async(eid)=>{
    try{
      const rows=await supaFetch(`/rest/v1/estimates?id=eq.${eid}&select=*`);
      if(rows&&rows[0]){
        const est=rows[0];
        const st=JSON.parse(est.state||'{}');
        if(st.rooms){
          const migrated=st.rooms.map(r=>{
            if(r.doors&&typeof r.doors.count==='number'&&!('enabled' in r.doors)){
              r.doors={enabled:r.doors.count>0,flat:{count:r.doors.count,coats:r.doors.coats||2},sixPanel:{count:0,coats:2},custom:{count:0,coats:2}};
            }
            if(r.windows&&!('enabled' in r.windows)){
              r.windows={...r.windows,enabled:(r.windows.count||0)>0};
            }
            return r;
          });
          setRooms(migrated);
        }
        if(st.roomCounter)setRoomCounter(st.roomCounter);
        if(st.client){
          const c=st.client;
          const addr=c.address||[c.street||c.addr1,[c.city,c.province].filter(Boolean).join(', '),c.postal].filter(Boolean).join(', ');
          setClient({name:c.name||'',email:c.email||'',phone:c.phone||'',address:addr});
        }
        if(st.changeItems)setChangeItems(st.changeItems);
        if(st.changeCounter!=null)setChangeCounter(st.changeCounter);
        if(st.selectedDealId)setSelectedDealId(st.selectedDealId);
        setCurrentEstimateId(eid);
      }
    }catch(e){console.warn('Load estimate error:',e);}
    setShowLoadPanel(false);
  };

  const newEstimate=()=>{
    if(!confirm('Start a new estimate? Unsaved changes will be lost.'))return;
    setRooms([newRoom('1',1)]);setRoomCounter(1);
    setClient({name:'',email:'',phone:'',address:''});
    setChangeItems([]);setChangeCounter(0);
    setCurrentEstimateId(null);setActiveTab('cover');
  };

  const onSelectDeal=(dealId)=>{
    setSelectedDealId(dealId);
    const deal=deals.find(d=>d.id===dealId);
    if(!deal)return;
    const cid=Array.isArray(deal.contact)?deal.contact[0]:deal.contact;
    const contact=contacts.find(c=>c.id===cid);
    setClient({
      name:contact?.fullName||contact?.full_name||[contact?.first_name,contact?.last_name].filter(Boolean).join(' ')||'',
      email:contact?.email||'',
      phone:contact?.phone||'',
      address:contact?.address||deal.address||'',
    });
  };

  const pushToProject=async()=>{
    if(!selectedDealId){alert('Select a deal on the Cover tab first.');return;}
    try{
      const fmtC=n=>'$'+n.toLocaleString('en-CA',{minimumFractionDigits:2,maximumFractionDigits:2});
      const fmtN=n=>Math.round(n).toLocaleString('en-CA');
      const today=new Date().toLocaleDateString('en-CA',{year:'numeric',month:'long',day:'numeric'});
      const todayISO=new Date().toISOString().slice(0,10);
      const gold='#C4922A';
      const clientAddr=client.address||'';
      const allColours=[...(ps.colours||[])];
      const getHex=name=>{const c=allColours.find(x=>x.n===name);return c?.h||null;};
      const prepLabelsMap={furniture:'Move furniture',plastic:'Cover w/ plastic',outlets:'Remove outlets',drywall:'Drywall repairs',caulking:'Caulking',cleanup:'Clean up'};
      const css='*{margin:0;padding:0;box-sizing:border-box}body{font-family:-apple-system,sans-serif;color:#1a1a1a;font-size:12px}table{width:100%;border-collapse:collapse}th{text-align:left;padding:8px 10px;border-bottom:2px solid #e5e5e5;color:#888;font-size:11px;font-weight:600}td{padding:8px 10px;border-bottom:1px solid #eee;font-size:12px;vertical-align:top}';

      const dealRooms=rooms.map(r=>({name:r.name,done:false}));

      let qhtml='<!DOCTYPE html><html><head><meta charset="utf-8"><title>Quote</title><style>'+css+'</style></head><body style="padding:40px 48px;max-width:900px;margin:0 auto">';
      qhtml+=`<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:24px;padding-bottom:16px;border-bottom:2px solid ${gold}"><div style="display:flex;gap:12px;align-items:center"><img src="/kingdom-logo-dark.svg" style="height:48px"><span style="font-size:20px;font-weight:700;color:${gold};letter-spacing:2px">QUOTE</span></div><div style="text-align:right"><p style="font-size:11px;color:#666">${today}</p><p style="font-size:10px;color:#999;margin-top:4px">HST# 71164 5556 RT0001</p></div></div>`;
      qhtml+='<div style="margin-bottom:24px;font-size:12px"><p style="font-weight:600;color:#888;font-size:10px;text-transform:uppercase;margin-bottom:4px">Prepared For</p>';
      qhtml+=`<p style="font-weight:600">${client.name||'—'}</p>`;
      if(clientAddr) qhtml+=`<p style="color:#666">${clientAddr}</p>`;
      if(client.phone) qhtml+=`<p style="color:#666">${client.phone}</p>`;
      if(client.email) qhtml+=`<p style="color:#666">${client.email}</p>`;
      qhtml+='</div><table><thead><tr><th>Item</th><th>Description</th><th style="text-align:right">Amount</th></tr></thead><tbody>';
      rooms.forEach(r=>{
        const c=calcRoom(r,settings);
        const surfaces=[],prepItems=[];
        if(r.walls?.enabled) surfaces.push(`${r.walls.coats} coat${r.walls.coats>1?'s':''} on walls — ${fmtN(c.wallSqft)} sqft`);
        if(r.ceiling?.enabled) surfaces.push(`${r.ceiling.coats} coat${r.ceiling.coats>1?'s':''} on ceiling — ${fmtN(c.ceilSqft)} sqft`);
        if(r.baseboards?.enabled) surfaces.push('Baseboards');
        if(r.crown?.enabled) surfaces.push('Crown moulding');
        const dc=roomDoorCount(r);if(dc>0) surfaces.push(`${dc} door${dc>1?'s':''}`);
        const wc=r.windows?.dims?.length||0;if(r.windows?.enabled&&wc>0) surfaces.push(`${wc} window${wc>1?'s':''}`);
        Object.entries(prepLabelsMap).forEach(([k,v])=>{if(r.prep?.[k])prepItems.push(v);});
        if(r.prep?.custom) prepItems.push(r.prep.custom);
        const materials=[];
        if(r.walls?.enabled&&r.paint?.wallProduct){
          const hex=getHex(r.paint.wallColour);
          materials.push({label:`Walls: ${r.paint.wallProduct}`,colour:r.paint.wallColour,sheen:r.paint.wallSheen,hex});
        }
        if(r.ceiling?.enabled&&r.paint?.ceilProduct){
          const hex=getHex(r.paint.ceilColour);
          materials.push({label:`Ceiling: ${r.paint.ceilProduct}`,colour:r.paint.ceilColour,sheen:r.paint.ceilSheen,hex});
        }
        if((r.baseboards?.enabled||r.doors?.enabled||roomDoorCount(r)>0||r.crown?.enabled)&&r.paint?.trimProduct){
          const hex=getHex(r.paint.trimColour);
          materials.push({label:`Trim: ${r.paint.trimProduct}`,colour:r.paint.trimColour,sheen:r.paint.trimSheen,hex});
        }
        qhtml+=`<tr><td style="font-weight:600;white-space:nowrap">${r.name}</td><td>`;
        if(prepItems.length) qhtml+=`<p style="margin-bottom:4px"><strong>Prep:</strong> ${prepItems.join(', ')}</p>`;
        qhtml+=`<p>${surfaces.join('<br>')}</p>`;
        if(materials.length) materials.forEach(m=>{qhtml+=`<p style="font-size:10px;color:#666;margin-top:4px">${m.label} — ${m.colour}${m.hex?`<span style="display:inline-block;width:8px;height:8px;border-radius:2px;background:${m.hex};border:1px solid #ccc;margin:0 3px;vertical-align:middle"></span>`:''} (${m.sheen})</p>`;});
        qhtml+=`</td><td style="text-align:right;font-weight:600;white-space:nowrap">${fmtC(c.cost)}</td></tr>`;
      });
      qhtml+='</tbody></table>';
      qhtml+=`<div style="margin-top:24px;padding-top:16px;border-bottom:2px solid ${gold}"><table style="width:auto;margin-left:auto">`;
      if((settings.discount||0)>0) qhtml+=`<tr><td style="text-align:right;padding:4px 16px;color:#888">Discount</td><td style="text-align:right;padding:4px 0;color:#c00">-${fmtC(totals.labourSubtotal-totals.discounted)}</td></tr>`;
      qhtml+=`<tr><td style="text-align:right;padding:4px 16px;color:#888">Labour</td><td style="text-align:right;padding:4px 0">${fmtC(totals.discounted)}</td></tr>`;
      qhtml+=`<tr><td style="text-align:right;padding:4px 16px;color:#888">HST on Labour (13%)</td><td style="text-align:right;padding:4px 0">${fmtC(totals.taxAmt)}</td></tr>`;
      if(totals.materialCost>0) qhtml+=`<tr><td style="text-align:right;padding:4px 16px;color:#888">Materials</td><td style="text-align:right;padding:4px 0">${fmtC(totals.materialCost)}</td></tr>`;
      qhtml+=`<tr style="border-top:2px solid ${gold}"><td style="text-align:right;padding:8px 16px;font-weight:700;font-size:14px;color:${gold}">Total</td><td style="text-align:right;padding:8px 0;font-weight:700;font-size:14px;color:${gold}">${fmtC(totals.total)}</td></tr></table></div>`;
      qhtml+='</body></html>';

      let chtml='<!DOCTYPE html><html><head><meta charset="utf-8"><title>Contract</title><style>'+css+'</style></head><body style="padding:40px 48px;max-width:900px;margin:0 auto">';
      chtml+=`<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:24px;padding-bottom:16px;border-bottom:2px solid ${gold}"><div style="display:flex;gap:12px;align-items:center"><img src="/kingdom-logo-dark.svg" style="height:48px"><span style="font-size:20px;font-weight:700;color:${gold};letter-spacing:2px">CONTRACT</span></div><div style="text-align:right"><p style="font-size:11px;color:#666">${today}</p></div></div>`;
      chtml+=`<p style="font-size:13px;font-weight:700;color:${gold};margin-top:28px;margin-bottom:10px;padding-bottom:6px;border-bottom:1px solid ${gold}">1. Parties</p>`;
      chtml+='<div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-bottom:8px;font-size:11px;color:#444;line-height:1.7">';
      chtml+=`<div><p style="font-weight:600;margin-bottom:4px">Client</p><p>${client.name||'—'}</p>`;
      if(clientAddr) chtml+=`<p>${clientAddr}</p>`;
      if(client.phone) chtml+=`<p>${client.phone}</p>`;if(client.email) chtml+=`<p>${client.email}</p>`;
      chtml+='</div><div><p style="font-weight:600;margin-bottom:4px">Contractor</p><p>David Truong</p><p>25 Fieldview Crescent</p><p>Markham ON L3R 3H6</p><p>(647) 449-6611</p><p>info@kingdompainting.ca</p></div></div>';
      chtml+=`<p style="font-size:13px;font-weight:700;color:${gold};margin-top:28px;margin-bottom:10px;padding-bottom:6px;border-bottom:1px solid ${gold}">2. Scope of Work</p>`;
      chtml+='<table style="font-size:11px"><thead><tr><th>Room</th><th>Surfaces</th></tr></thead><tbody>';
      rooms.forEach(r=>{
        const parts=[];
        if(r.walls?.enabled) parts.push('Walls');if(r.ceiling?.enabled) parts.push('Ceiling');
        if(r.baseboards?.enabled) parts.push('Baseboards');if(r.crown?.enabled) parts.push('Crown');
        const dc=roomDoorCount(r);if(dc>0) parts.push(`${dc} Door${dc>1?'s':''}`);
        const wc=r.windows?.dims?.length||0;if(r.windows?.enabled&&wc>0) parts.push(`${wc} Window${wc>1?'s':''}`);
        chtml+=`<tr><td style="padding:6px 8px;font-weight:500">${r.name}</td><td style="padding:6px 8px;color:#555">${parts.join(', ')||'—'}</td></tr>`;
      });
      chtml+='</tbody></table>';
      chtml+=`<p style="font-size:13px;font-weight:700;color:${gold};margin-top:28px;margin-bottom:10px;padding-bottom:6px;border-bottom:1px solid ${gold}">3. Payment Terms</p>`;
      chtml+=`<div style="font-size:11px;line-height:1.7;color:#444"><p style="margin-bottom:8px">Total contract value: <strong>${fmtC(totals.total)}</strong> (HST 13% applied to labour only)</p>`;
      chtml+=`<p>30% Deposit: ${fmtC(totals.deposit)} · 35% Midway: ${fmtC(totals.midway)} · Balance: ${fmtC(totals.balance)}</p></div>`;
      chtml+=`<p style="font-size:13px;font-weight:700;color:${gold};margin-top:28px;margin-bottom:10px;padding-bottom:6px;border-bottom:1px solid ${gold}">4. Signatures</p>`;
      chtml+='<div style="display:grid;grid-template-columns:1fr 1fr;gap:40px;margin-top:24px;font-size:11px">';
      chtml+='<div><div style="border-bottom:1px solid #ccc;height:60px;margin-bottom:8px"></div><p style="color:#888">Client Signature</p></div>';
      chtml+='<div><div style="border-bottom:1px solid #ccc;height:60px;margin-bottom:8px"></div><p style="color:#888">Contractor Signature</p></div></div>';
      chtml+='</body></html>';

      const pushData={value:totals.total,estimateHrs:totalHrs,rooms:dealRooms,quote_html:qhtml,quote_date:todayISO,contract_html:chtml};

      if(changeItems.length>0){
        const coSub=changeItems.reduce((s,it)=>s+(parseFloat(it.amount)||0),0);
        const coTax=coSub*0.13;const coTotal=coSub+coTax;
        let cohtml='<!DOCTYPE html><html><head><meta charset="utf-8"><title>Change Order</title><style>'+css+'</style></head><body style="padding:40px 48px;max-width:900px;margin:0 auto">';
        cohtml+=`<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:24px;padding-bottom:16px;border-bottom:2px solid ${gold}"><div style="display:flex;gap:12px;align-items:center"><img src="/kingdom-logo-dark.svg" style="height:48px"><span style="font-size:20px;font-weight:700;color:${gold};letter-spacing:2px">CHANGE ORDER</span></div><div style="text-align:right"><p style="font-size:11px;color:#666">${today}</p><p style="font-size:10px;color:#999;margin-top:4px">HST# 71164 5556 RT0001</p></div></div>`;
        cohtml+=`<p style="font-size:12px;margin-bottom:20px"><strong>Client:</strong> ${client.name||'—'}</p>`;
        cohtml+='<table><thead><tr><th style="width:60px">Item #</th><th>Description</th><th style="text-align:right;width:120px">Amount</th></tr></thead><tbody>';
        changeItems.forEach(it=>{cohtml+=`<tr><td>${it.num||''}</td><td>${it.desc||''}</td><td style="text-align:right">${fmtC(parseFloat(it.amount)||0)}</td></tr>`;});
        cohtml+=`</tbody></table><div style="margin-top:16px;padding-top:12px;border-top:2px solid #e5e5e5;text-align:right"><p style="font-size:12px;margin-bottom:4px">Subtotal: ${fmtC(coSub)}</p><p style="font-size:12px;margin-bottom:4px">HST (13%): ${fmtC(coTax)}</p><p style="font-size:14px;font-weight:700;color:${gold}">Total: ${fmtC(coTotal)}</p></div></body></html>`;
        pushData.change_order_html=cohtml;
      }

      await api.saveDeal(pushData,selectedDealId);
      setSaveMsg('Pushed!');setTimeout(()=>setSaveMsg(''),3000);
    }catch(e){console.warn('Push error:',e);setSaveMsg('Push failed');}
  };

  const handlePaintSave=useCallback(async()=>{
    const ok=await ps.save();
    return ok;
  },[ps.save]);

  const TABS=[
    {k:'cover',l:'Cover'},
    {k:'rooms',l:`Rooms (${rooms.length})`},
    {k:'breakdown',l:'Breakdown'},
    {k:'quote',l:'Quote'},
    {k:'contract',l:'Contract'},
    {k:'changeorder',l:'Change Order'},
    {k:'labourrates',l:'Labour Rates'},
    {k:'paintinputs',l:'Paint Inputs'},
    {k:'standards',l:'Standards'},
  ];

  const tabBarWrapStyle={background:'var(--fg)',borderBottom:'1px solid rgba(237,233,222,0.1)',flexShrink:0,overflowX:'auto',scrollbarWidth:'none'};
  const tabBarInnerStyle={display:'flex',padding:'0 20px',minWidth:'max-content',gap:2};
  const tabBtnStyle=(active)=>({background:'none',border:'none',cursor:'pointer',padding:'9px 16px',fontSize:12,fontWeight:500,letterSpacing:'0.03em',color:active?'var(--bg)':'rgba(237,233,222,0.5)',borderBottom:active?'2px solid var(--primary)':'2px solid transparent',transition:'all 0.15s',whiteSpace:'nowrap'});
  const actionBarStyle={background:'var(--card)',borderBottom:'1px solid var(--border)',padding:'8px 20px',display:'flex',gap:8,alignItems:'center',flexShrink:0};
  const actionBtnStyle={fontSize:11,fontWeight:600,padding:'6px 14px',borderRadius:6,cursor:'pointer',border:'1px solid var(--border)',background:'var(--card)',color:'var(--fg)'};

  return (
    <div style={{width:'100%',height:'100%',display:'flex',flexDirection:'column',overflow:'hidden'}}>
      <div style={tabBarWrapStyle}>
        <div style={tabBarInnerStyle}>
          {TABS.map(t=>(
            <button key={t.k} onClick={()=>setActiveTab(t.k)} style={tabBtnStyle(activeTab===t.k)}>{t.l}</button>
          ))}
        </div>
      </div>
      <div style={actionBarStyle}>
        <button onClick={handleSave} disabled={saving} style={{...actionBtnStyle,background:'var(--primary)',color:'#fff',border:'none'}}>Save</button>
        <button onClick={loadEstimates} style={actionBtnStyle}>Load</button>
        <button onClick={pushToProject} style={actionBtnStyle}>Push</button>
        <button onClick={newEstimate} style={actionBtnStyle}>New</button>
        <button onClick={()=>{const deal=deals.find(d=>d.id===selectedDealId);exportBidPDF(client,rooms,settings,totals,ps.paints,ps.ceilPaints,ps.primers,ps.colours,ps.supplies,deal?.dealName||'');}} style={actionBtnStyle}>Export Bid</button>
        <div style={{flex:1}}/>
        {saving&&<Loader2 size={14} style={{animation:'spin 1s linear infinite',color:'var(--muted-fg)'}}/>}
        {saveMsg&&<span style={{fontSize:11,fontWeight:600,color:saveMsg==='Saved'||saveMsg==='Pushed!'?'#22c55e':'#ef4444'}}>{saveMsg}</span>}
      </div>
      <div style={{flex:1,overflow:'hidden',position:'relative'}}>
        {activeTab==='cover'&&(
          <CoverTab client={client} setClient={setClient} deals={deals} contacts={contacts} onSelectDeal={onSelectDeal} selectedDealId={selectedDealId}/>
        )}
        {activeTab==='rooms'&&(
          <RoomsTab rooms={rooms} settings={settings}
            onUpdate={(i,updated)=>setRooms(rooms.map((r,j)=>j===i?updated:r))}
            onRemove={(i)=>{if(rooms.length>1)setRooms(rooms.filter((_,j)=>j!==i));}}
            onAdd={()=>{const next=roomCounter+1;setRoomCounter(next);setRooms([...rooms,newRoom(String(next),next)]);}}
            paints={ps.paints} ceilPaints={ps.ceilPaints} colours={ps.colours} primers={ps.primers} supplies={ps.supplies}/>
        )}
        {activeTab==='breakdown'&&(
          <BreakdownTab rooms={rooms} settings={settings}
            paints={ps.paints} ceilPaints={ps.ceilPaints} primers={ps.primers} colours={ps.colours} supplies={ps.supplies}/>
        )}
        {activeTab==='quote'&&(
          <QuoteTab rooms={rooms} settings={settings} client={client} totals={totals}
            paints={ps.paints} ceilPaints={ps.ceilPaints} primers={ps.primers} colours={ps.colours} supplies={ps.supplies}/>
        )}
        {activeTab==='contract'&&(
          <ContractTab rooms={rooms} settings={settings} client={client} totals={totals}/>
        )}
        {activeTab==='changeorder'&&(
          <ChangeOrderTab client={client} items={changeItems} setItems={setChangeItems}/>
        )}
        {activeTab==='labourrates'&&(
          <LabourRatesTab labour={ps.labour} setLabour={ps.setLabour} onSave={handlePaintSave}/>
        )}
        {activeTab==='paintinputs'&&(
          <PaintInputsTab paints={ps.paints} setPaints={ps.setPaints} ceilPaints={ps.ceilPaints} setCeilPaints={ps.setCeilPaints}
            primers={ps.primers} setPrimers={ps.setPrimers} colours={ps.colours} setColours={ps.setColours}
            supplies={ps.supplies} setSupplies={ps.setSupplies} onSave={handlePaintSave}/>
        )}
        {activeTab==='standards'&&(
          <StandardsTab standards={ps.standards} setStandards={ps.setStandards} onSave={handlePaintSave}/>
        )}
        {showLoadPanel&&(
          <div style={{position:'absolute',top:0,right:0,width:360,height:'100%',background:'var(--card)',borderLeft:'1px solid var(--border)',boxShadow:'-4px 0 20px rgba(0,0,0,0.1)',zIndex:10,display:'flex',flexDirection:'column'}}>
            <div style={{padding:'16px 20px',borderBottom:'1px solid var(--border)',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
              <p style={{fontSize:14,fontWeight:700}}>Saved Estimates</p>
              <button onClick={()=>setShowLoadPanel(false)} style={{background:'none',border:'none',cursor:'pointer',fontSize:18,color:'var(--muted-fg)'}}>&times;</button>
            </div>
            <div style={{flex:1,overflow:'auto',padding:12}}>
              {savedEstimates.length===0&&<p style={{fontSize:12,color:'var(--muted-fg)',textAlign:'center',padding:20}}>No saved estimates</p>}
              {savedEstimates.map(est=>(
                <div key={est.id} onClick={()=>loadEstimate(est.id)}
                  style={{padding:'12px 14px',borderRadius:8,marginBottom:6,cursor:'pointer',border:'1px solid var(--border)',background:'var(--bg)'}}>
                  <p style={{fontSize:13,fontWeight:600}}>{est.title||est.client_name||'Untitled'}</p>
                  <p style={{fontSize:11,color:'var(--muted-fg)'}}>{est.client_name&&est.title?est.client_name:est.client_email||''}</p>
                  {est.updated_at&&<p style={{fontSize:10,color:'var(--muted-fg)',marginTop:4}}>{new Date(est.updated_at).toLocaleDateString('en-CA')}</p>}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
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
function exportBidPDF(client,rooms,settings,totals,paints,ceilPaints,primers,colours,supplies,projectName){
  const fmtN=n=>Math.round(n).toLocaleString('en-CA');
  const fmtC=n=>'$'+n.toLocaleString('en-CA',{minimumFractionDigits:2,maximumFractionDigits:2});
  const today=new Date().toLocaleDateString('en-CA',{year:'numeric',month:'long',day:'numeric'});
  const gold='#C4922A';
  const clientAddr=client.address||'';
  const roomCalcs=rooms.map(r=>({room:r,calc:calcRoom(r,settings),lines:calcRoomLines(r,settings)}));
  const paintData=calcPaintCosts(rooms,paints||[],ceilPaints||[],primers||[],colours||[],settings._standards?.matBuffer||1.15);
  const allColours=[...(colours||[])];
  const getHex=name=>{const c=allColours.find(x=>x.n===name);return c?.hex||null;};
  const prepLabelsMap={furniture:'Move furniture',plastic:'Cover w/ plastic',outlets:'Remove outlets',drywall:'Drywall repairs',caulking:'Caulking',cleanup:'Clean up'};
  const docTitle=projectName?`Bid Proposal - ${projectName}`:'Bid Proposal';
  let html='<!DOCTYPE html><html><head><meta charset="utf-8"><title>'+docTitle+'</title>';
  html+='<style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:-apple-system,sans-serif;color:#1a1a1a;font-size:12px}';
  html+='.page{page-break-after:always;padding:40px 48px;max-width:900px;margin:0 auto}.page:last-child{page-break-after:auto}';
  html+=`.gold{color:${gold}}.border-gold{border-bottom:2px solid ${gold}}`;
  html+='table{width:100%;border-collapse:collapse}th{text-align:left;padding:8px 10px;border-bottom:2px solid #e5e5e5;color:#888;font-size:11px;font-weight:600}td{padding:8px 10px;border-bottom:1px solid #eee;font-size:12px;vertical-align:top}';
  html+='@media print{body{padding:0}.page{padding:32px 40px}}</style></head><body>';
  html+='<div class="page" style="display:flex;align-items:center;justify-content:center;min-height:90vh">';
  html+='<div style="text-align:center">';
  html+=`<img src="/kingdom-logo-dark.svg" style="height:80px;margin:0 auto"><div style="width:60px;height:2px;background:${gold};margin:16px auto"></div>`;
  html+='<p style="font-size:16px;font-weight:600;letter-spacing:0.08em;color:#555;margin-top:24px">BID PROPOSAL</p>';
  html+='<div style="margin-top:48px"><p style="font-size:11px;text-transform:uppercase;letter-spacing:0.1em;color:#999">PREPARED FOR</p>';
  html+=`<p style="font-size:18px;font-weight:600;margin-top:8px">${client.name||'Client Name'}</p>`;
  if(clientAddr) html+=`<p style="font-size:12px;color:#666;margin-top:6px">${clientAddr}</p>`;
  if(client.phone) html+=`<p style="font-size:12px;color:#666;margin-top:4px">${client.phone}</p>`;
  if(client.email) html+=`<p style="font-size:12px;color:#666;margin-top:2px">${client.email}</p>`;
  html+='</div>';
  html+=`<p style="font-size:12px;color:#999;margin-top:32px">${today}</p></div></div>`;
  html+='<div class="page">';
  html+=`<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:24px;padding-bottom:16px" class="border-gold"><div style="display:flex;gap:12px;align-items:center"><img src="/kingdom-logo-dark.svg" style="height:48px"><span style="font-size:20px;font-weight:700;color:${gold};letter-spacing:2px">QUOTE</span></div><div style="text-align:right"><p style="font-size:11px;color:#666">${today}</p><p style="font-size:10px;color:#999;margin-top:4px">HST# 71164 5556 RT0001</p></div></div>`;
  html+='<div style="margin-bottom:24px;font-size:12px"><p style="font-weight:600;color:#888;font-size:10px;text-transform:uppercase;margin-bottom:4px">Prepared For</p>';
  html+=`<p style="font-weight:600">${client.name||'—'}</p>`;
  if(clientAddr) html+=`<p style="color:#666">${clientAddr}</p>`;
  if(client.phone) html+=`<p style="color:#666">${client.phone}</p>`;
  if(client.email) html+=`<p style="color:#666">${client.email}</p>`;
  html+='</div>';
  html+='<table><thead><tr><th>Room</th><th>Description</th></tr></thead><tbody>';
  rooms.forEach(r=>{
    const c=calcRoom(r,settings);
    const surfaces=[],prepItems=[];
    if(r.walls?.enabled) surfaces.push(`${r.walls.coats} coat${r.walls.coats>1?'s':''} on walls — ${fmtN(c.wallSqft)} sqft`);
    if(r.ceiling?.enabled) surfaces.push(`${r.ceiling.coats} coat${r.ceiling.coats>1?'s':''} on ceiling — ${fmtN(c.ceilSqft)} sqft`);
    if(r.baseboards?.enabled) surfaces.push(`Baseboards`);
    if(r.crown?.enabled) surfaces.push(`Crown moulding`);
    const dc=roomDoorCount(r);if(dc>0) surfaces.push(`${dc} door${dc>1?'s':''}`);
    const wc=r.windows?.dims?.length||0;if(r.windows?.enabled&&wc>0) surfaces.push(`${wc} window${wc>1?'s':''}`);
    Object.entries(prepLabelsMap).forEach(([k,v])=>{if(r.prep?.[k])prepItems.push(v);});
    if(r.prep?.custom) prepItems.push(r.prep.custom);
    html+=`<tr><td style="font-weight:600;white-space:nowrap">${r.name}</td><td>`;
    if(prepItems.length) html+=`<p style="margin-bottom:4px"><strong>Prep:</strong> ${prepItems.join(', ')}</p>`;
    html+=`<p>${surfaces.join('<br>')}</p></td></tr>`;
  });
  html+='</tbody></table>';
  html+=`<div style="margin-top:24px;padding-top:16px" class="border-gold"><table style="width:auto;margin-left:auto"><tr><td style="text-align:right;padding:4px 16px;color:#888">Labour</td><td style="text-align:right;padding:4px 0;font-weight:600">${fmtC(totals.discounted)}</td></tr>`;
  html+=`<tr><td style="text-align:right;padding:4px 16px;color:#888">HST on Labour (13%)</td><td style="text-align:right;padding:4px 0">${fmtC(totals.taxAmt)}</td></tr>`;
  if(totals.materialCost>0) html+=`<tr><td style="text-align:right;padding:4px 16px;color:#888">Materials</td><td style="text-align:right;padding:4px 0">${fmtC(totals.materialCost)}</td></tr>`;
  html+=`<tr style="border-top:2px solid ${gold}"><td style="text-align:right;padding:8px 16px;font-weight:700;font-size:14px" class="gold">Total</td><td style="text-align:right;padding:8px 0;font-weight:700;font-size:14px" class="gold">${fmtC(totals.total)}</td></tr></table></div>`;
  html+='</div>';
  html+='<div class="page">';
  html+=`<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:24px;padding-bottom:16px" class="border-gold"><div style="display:flex;gap:12px;align-items:center"><img src="/kingdom-logo-dark.svg" style="height:48px"><span style="font-size:20px;font-weight:700;color:${gold};letter-spacing:2px">CONTRACT</span></div><div style="text-align:right"><p style="font-size:11px;color:#666">${today}</p></div></div>`;
  html+=`<p style="font-size:13px;font-weight:700;color:${gold};margin-top:28px;margin-bottom:10px;padding-bottom:6px;border-bottom:1px solid ${gold}">1. Parties</p>`;
  html+='<div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-bottom:8px;font-size:11px;color:#444;line-height:1.7">';
  html+=`<div><p style="font-weight:600;margin-bottom:4px">Client</p><p>${client.name||'—'}</p>`;
  if(clientAddr) html+=`<p>${clientAddr}</p>`;
  if(client.phone) html+=`<p>${client.phone}</p>`;
  if(client.email) html+=`<p>${client.email}</p>`;
  html+='</div><div><p style="font-weight:600;margin-bottom:4px">Contractor</p><p>David Truong</p><p>25 Fieldview Crescent</p><p>Markham ON L3R 3H6</p><p>(647) 449-6611</p><p>info@kingdompainting.ca</p></div></div>';
  html+=`<p style="font-size:13px;font-weight:700;color:${gold};margin-top:28px;margin-bottom:10px;padding-bottom:6px;border-bottom:1px solid ${gold}">2. Scope of Work</p>`;
  html+='<table style="font-size:11px"><thead><tr><th>Room</th><th>Surfaces</th></tr></thead><tbody>';
  rooms.forEach(r=>{
    const parts=[];
    if(r.walls?.enabled) parts.push('Walls');
    if(r.ceiling?.enabled) parts.push('Ceiling');
    if(r.baseboards?.enabled) parts.push('Baseboards');
    if(r.crown?.enabled) parts.push('Crown');
    const dc=roomDoorCount(r);if(dc>0) parts.push(`${dc} Door${dc>1?'s':''}`);
    const wc=r.windows?.dims?.length||0;if(r.windows?.enabled&&wc>0) parts.push(`${wc} Window${wc>1?'s':''}`);
    html+=`<tr><td style="padding:6px 8px;font-weight:500">${r.name}</td><td style="padding:6px 8px;color:#555">${parts.join(', ')||'—'}</td></tr>`;
  });
  html+='</tbody></table>';
  html+=`<p style="font-size:13px;font-weight:700;color:${gold};margin-top:28px;margin-bottom:10px;padding-bottom:6px;border-bottom:1px solid ${gold}">3. Payment Terms</p>`;
  html+=`<div style="font-size:11px;line-height:1.7;color:#444"><p style="margin-bottom:8px">Total contract value: <strong>${fmtC(totals.total)}</strong> (HST 13% applied to labour only)</p>`;
  html+=`<p>30% Deposit: ${fmtC(totals.deposit)} · 35% Midway: ${fmtC(totals.midway)} · Balance: ${fmtC(totals.balance)}</p></div>`;
  html+=`<p style="font-size:13px;font-weight:700;color:${gold};margin-top:28px;margin-bottom:10px;padding-bottom:6px;border-bottom:1px solid ${gold}">4. Signatures</p>`;
  html+='<div style="display:grid;grid-template-columns:1fr 1fr;gap:40px;margin-top:24px;font-size:11px">';
  html+='<div><div style="border-bottom:1px solid #ccc;height:60px;margin-bottom:8px"></div><p style="color:#888">Client Signature</p></div>';
  html+='<div><div style="border-bottom:1px solid #ccc;height:60px;margin-bottom:8px"></div><p style="color:#888">Contractor Signature</p></div></div>';
  html+='</div>';
  html+='<script>window.onload=function(){window.print();}<\/script></body></html>';
  const win=window.open('','_blank','width=860,height=900');
  if(win){win.document.write(html);win.document.close();win.document.title=docTitle;}
}

// ─── LAYOUT + APP ─────────────────────────────────────────────────────────────
// ─── Financials Page ─────────────────────────────────────────────────────────
const LOGO_PNG = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAANcAAADXCAIAAAAGH1PiAAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAAJcEhZcwAADsMAAA7DAcdvqGQAABW2SURBVHhe7Z0LcJTXdcdXyLwkLTiAqCWXFHsGRIpdN7ziAo6Btq4LFJyhBhxIJsahAzN4xtjGtB0kCnjSOjgxNiTgYmPqwvCwSRAF7BCbRyDE1gtkJPQC9AIJtNLqsS+BhLZn9x59utr9nvuQ9n57fsOsz/m0rLXsf8+959xz75fg9XotREi4nfbmS+87K08PTn189MwNSdYR+APCIAPwv4RxWov2Oau+BKPdVmS/tJtdJEKAVBgiTnuNoyIbHXArT7fU5qNDGIRUGCJNOb9Aq5vmogNoEQYhFYZC683cu7Yr6HTT3lDUWHISHcIIpMJQsOe8jVZvmosOuh12dAjdkAoNYys62OluQKc3na6G1rL/Q4fQDanQGG5nU1vxPnTkaC07RuHQKKRCYzgrftvV4UJHjq4Od1PBh+gQ+iAVGsBpr2m7+r/oKOOoPNN6uxQdQgekQgO0Fu5ES4um/D1oETogFeql9WaOp+4iOlp4Goqbrv8BHUILUqFeWgt/jZY+Gikc6oZUqAt7+bGO1uvo6KPTZavL+xgdQhVSoTZuZ1PrN8YCIaO19DhVbfRAKtTGde2IenVGia4Ot/3KYXQIZUiFGriaq13XPkXHOC2lJxz2WnQIBUiFGjhK9oYWCCUaLu5Ai1CAVKhG262v3TW/QydUPA1Xm2sK0CHkIBWq4Sj5CK3wuHPxV2gRcpAKFWmuOHqvsRCd8Oh02W4X/gYdIghSoTxuZ5OzNDKBkNFUeJiqNkqQCuVxX//kvvsOOpGgq8PdXEqd2PKQCmXwOJtcNyJf57N/84mj6SY6BAepUAbHlfe84VVnlLDl7UWL4BBGhR2Vmff/OKDzwsB7RT9oV2i4jwjOhiJP7WfoRBpXbZ695hI6UcDlaL7+xa/yd/4Q/tR8dQivxjzCqHBAE3YGJDSfGHDpsXabbzt6NHAUvYtWdLDlRiscttRXXD+a1VLxR+bai08xI/YRRoUJ91vRAu63JVz9p/ay19CNHK3Vv7/XeBmd6HC3ubrhauT1AZHv+tGNHc4m9OEf6Z4HrZhHGBV6k/4KLYn69z25T7bbI3kigvNKdAMhoyH3fyJYtXE03Sr97SbbpZ6DIhhDRoxBK+YRRoVdQ59Ai8dV3FX0nKdyO7rh0fTNr+97bqMTTXxVm5LITD1t5X+6fjTTdbsMfY6BKaPQinmEUaEl8UE0Arjf5q3MdF3+YbvLhldCwuNs9FT23XS+ueRkmFUblojUfPme0sg7ZOS30Yp5xBmRrd9HSw5v0+edudM8d86ibxxn8TZvhxOd6OPbMFoYRsNYfcWN7MyWigvoyzGIYmHE8Q7+C7SU6HR0fvO8q+y/0DWCq7mqvfYEOn1F6/U/2KtDqdrUfnXoRnYWn4jIQiNy5BlsHY+WKver32m7ONtjcI+Is3AzWn2L0XDoS0SO/oft8lH0VRk5Vm4mHZOIMy+UTZPl8DpL7ubNdVXvR18LR93Fjqb+6f9z3ym5c/X36Ghhq7h4PXuDW99++4EpI9ESAaFUOEhrUJbodHSUvNGW+6JHR8rSX4GQ0XT5U7ejGR0FIBG58cWO2i/f69JdAhRoUgiIpEKLvlgocb/xi/acBa7b59GXo6V0b5enHp3+oMPVaL+qVrXxJyIbWq6pJSLBCJQgAyaNhd1422+1F/yorSTw3FWGx9noLv9vdPqP5pLPINqh05u6S8cqj23ocDairxuBUhNAKBVqpskK3Luxo+ncXHfLDfS78VS87+3su+qMEl333A05gfvnQZdl2Rvv5Oid3QYwZATFwugweNTfo2WcLkeZ+0+LHJU9XYPulsr2qlg5ibr1+vmW+nJ0/InItU/X6kxEZKEROZokDkPDON5Oh6dog/2rVTAQg+sukT8VuL9oyPGdSQchsPr8BzdPb4MAya6HRrL1W2iJgGAq1FmsUaGj4Yzj4uLWsj0dYSy0RAP3nZKbXx+o+d2b9qvh7j1NfigDLUGIOxUCkBR7SmMrEDIaC39z116DThgMtIqUmgDCjcgKPQ0Eh1gJMiBaLBz2FFqEMskPTUBLEESLhYNESv36i8TBSWgJgmAqHDxMV09DnPNg2ji0BEG0WOhLUB5Hi5BDoEZ/CfFUaBlMg7IaiYMEG44BAVUYiWKNiUlKEyw1AUQckUmFaojV08UQMBYmDkeDkEO4YiEgngoHp/4dWoQcAjX6SwgYC4HB4qWBfUPioKFoCYWgKgyx0dD0iNVWKCGkCqlkqIRYbYUSgsZCKhnKI2JqAoipQirWKEAjct/hpViowCDROgsZQqpwyDDBVuv7DOvIh9ESCjFHZGDYDDSIboRr9JcQVoW0ghKEcI3+EsKqMJmKNYEImiADoqqQSobBDBUzQQaEjYUP0IgcCI3Ifc2Q1L9Fi+hGuEZ/CWFjIUA9DRwiNvpLCK1Cql33IGKjv4TIKkx+DA1CzEZ/CYqFJkHERn8JoWMhFWt6ELdYCIiswiQakXsQtLOQkeD1etEUEM9Zq9c7wOJN6PI9DvB64e0M8PrelO+iZLPrviuWbtt3nf3pseE72W3AMxMGjfwu/NuAMXD4uISBVrDgemLSnz2Q/BBY3f9s8GQJn42X/f/pdNk6nHi8+/17rrvN1fA7+A3fwVz+/xGQAE+G/wva+Mo9LsBdYfDXfUBq8tcvfYiOgMA/evdbERBPwT94W78KR4WJ1oyEgcMeGDEZ7EGjJsEjaG5on9ymobW+HBTZ4WrscNja7dVd99zuO77DW0NQYfJDEyb8YCM6AgKfhMgqLF7pbTisU4UJicMSrN9JtE5IGPLnicMyBgxNT3rwEXyhmMHRdLPD2ei6XQKPd+017f7jDDVVOHLiM2O//yI6AgIfj8gqvLbFW/u2kgotg8ckpPwl/En81vcGWL8zNNnw/P3CRbwbT5vTVVZeyWxGXV1DXb38zVTS01LT00ej4ydj/CPDUpLBsFqTnnjcWEnFXn3ZVV8KcgRpdt/vJFCFqd997ttPLkFHQMRWYbs9v6voOUunQ1KhZfj0hOF/k5AyccCDTw5NTsXnKWNrtJeVVzGRORzwWAUXS8srnc6wjpXWJC0t9eG00VZrcsb4sdaU5AnjH0lPT310rMb6R0t9hbu+xHW7jCmSfXRDRowZO/ffxDrIOgCxVQj4hFiZaRk2I2H4jKGjZ+FVBSC23aqHGNYAaoNgVlbh01xMkTFuLMRRkObUSY+p6xIU2VbtC9UwHAstQUB4FarA4lxuQRE8QnirVxhAY5mUlCQIk1MmTwRRgjRTR43AH5gLs6kQoh0ILq+gOFKyY0Mns4MnfJrw08fwB3qIlKDIKZMfmzppopkUaQYV3qiqPX0258y5HBAfXjICizdsigYuRB141DNLC5nCK6UOh5vNDZhMwTb6nQFFzp41beH82dH7PfsM4VUIEnx+2Wv6Y8yUSROZ4FjeOnP6JPxBDCBNW/Pyi3XqEr5Cn+z/hehCFF6FH+w9svWdj9AJQppXgeYeTks1WiXpX6R5LYhSZTRftXLx2jU/RkdMhFchxI+XVmeh44dNnkB2UydPNMFoJQHjeG5+Mcw6cvOLJEXC12zPrs1ifbuCMcO88OSp8/sPHIdBNkrTdql2DUBMcjhd6OiAzTIZERz94Vc6fe5rmFBuyVpjgjTFDCoMEzbwgQFjHzyC7XC4fBXsqFUTYW4KjyzjTk8bDTl4VJOh2CfuVChlAExtoaXVUYLPnCaMHxs/ujS5CiGDLi2vKiuvFLFwzadWJisQBmBCFUK0i+x6CV+4lsqKemDhltkhVAQDgF8DtOib+5or6wJMokKIednHz+T5U0i8ZASmMzZRY70FcBHUBppjT4gg/kq1TWrSgd85hDkoqwOsXrnEHAHSJCpc8M9rdH6QbJgDhUFaAAakBWDgz/oVpk6I4r42C5hF6Hg75ijTAGZQ4Ts7Pt61+zA6QUDY8GkufTRrCIhGeIsSECxz84t9jwXFSqM5JDT7P3oLHWExgwqXvbieH4ghQkyd7BOccLJTAUZt0GJeftHpczm8IkmFsQKvwmVL573x6gpmmxUQ4tp1qDxzqFDknaBymCPyqcM2D5gJs6mQEBFSoXi0GVnIFgIzqJAfhfcdOA7TJnTMCLy7zE3b0TELZlDh8qXz0bJYnE43zNzhc5IWLUwDvKNX1r0F745vNMzQvZATy5hBhTOnT2JdKhLHTpx9fvlrefkx1KkQJvBe4B2d6R3mM8aNXb1S4G3IEiZZOwE2/+fO/QdPoNPNqpWLTfA57dx9KLgsv2zpPFrBi0VOnjoPY3FAZzwEjC0b12T4l4aFo6y8MnPTjoDVvJSUpC0bX577zFPoi4+pVAjYGu0weQruaRAxKEKmBVEw4Es1++lp5uiv5jGbChkf7D0S/PnB3BGCYoz0LqjDEpGA7xKEQPgi/fQni9A3EeZUIXCjqvaV198KHsvgg1z+Qk9OHYOwWkzwvGLb2+vN2n1tWhUyZNttIChu27o+Btf6IARCCJfNsUTf66mOyVUIFF4pVZrgz3l6GvoxgGwikpaW+mbWyzG1dT8amF+FDNk6zoJ5s954dUUsBEVIRIL39rNfz8TbTSTiRYXAhYsFGzZvD2gX7fc6DozCP//lnmMnzqLvx3y1GHXiSIWArdEu+5G/u/Vfp0zutfrSN9TVNwSnUCyXj6vtyfGlQoZscXtz1pqF82ej0yfARHDFqqyAX8P0iYgs8ahCQLaO05dCDJYgC8mmT0RkiVMVMtb9+9sBo3PfCDFYguYuB2oS112uW3/2+rKl89DxA7NGkAg60SFYgrOfnvbhrs1xK0EgrmMh49CRz7M270DHPzJ+nr0rSuUbyIhfWpXFzwQWzJsFXwZ04hXq+LcsWfQsSAEdf5/sK9073CKOL9aSBIMgFfoAKcCwiI7FkldQvO/AcXQix+lzOfw0FOaCJEEGqRDZkrUmLa3nLj07dx+C0ROdSMCq0+j4x32YC6IT95AKkdRRI97Mehkd/7jMiyZ8QNb8ss2WjS/Hw9KcTkiFPcycPolPmWH0jNTOlbr6Bn4VG0b/+Fmd0wOpsBerVy6BsRIdfwBDKzwyN/XKwd94VeD7d0YDUmEvYJTkj7mBNCX8cAivwHdNL39hfjyXBmUhFQayZNGzfJqyYXO4W9D5gAqvHIfLxJqQCmXg0xRIKcI57CEgEAq3A6tvIBXKELDNfn8YtcOAQAiBFh2Cg1QoDx+0IJiFtrgMf4sCoR5IhfJAOORnh6EtpfB/iwKhCqRCRfjQdezE2RCWUvgJJX+kExEAqVCROU9P42uHRnOU7ONn+PatPm7kFgtSoSKpo0bwW0UDzsvShH/+gnmzaL1OBVKhGrNnfQ8tv6oMDcq8CvnXIYIhFaox95mnQhuU+WfCK9CqsTqkQg34QTkv33frWj3wz5w6uecWyYQspEINpnAayg06kE6JMv8NlxkB58wSwZAKNZjK7Zavr7fpnBryxWr+FQhZSIUaPDp2DF++5oOcEgELLSa4W2K0IRVqI90cGSjVsZRXSsOxQUiF2vBH2Dh03PGmrr4BLYtJ7gQRbUiF2li5+87paXqtq+tRYTzcly98SIXasFvH66eO2+Uk6L0F+hhSoTGM9jSY7/6d0YBUaIyAY76IiEAq1CY+T3PrS0iF2tyoqkWLiA6kQm3q6nqyDb6CTUQKUqEx+Aq2Hsx3R+1oQCrU5hZXhdZDeq8Vv+ieyWkOSIXaGF0LSU/viZd8BZtQglSoDb9eoudmjnylWk/3A0Eq1MZom9YELl6WVVTZGu3oEAqQCjU4eeo8Wv7efT0rchAv+VRaf29s3EIq1CC03v2pXEOX/n0CcQupUAN+Usiffa0Ov09ATxtOnEMqVONGVS2/cKy/d59/JrwCrb6oQypUI5cLYzDV05MgMwKnhhQOVSEVqtFrUmiwd5+mhvohFarBp7f8VE8P/HkMlCarQypUxNZo5+8NYXRDJx8L4XVoaqgCqVARPoAZmhQyrNbkjHE95WuaGqpAKlSEb0QwOilk8IvO1NagAqlQEb7OF9omJqoa6oRUqAi/Ad7oNjxGwIIyWkQQpEJ5IJngT2LlN8brJyCCFl4pRYvoDalQHr7Ln08yjMKfEMKfHELwkArlyS3oqTPzXatG4RMUvluW4CEVysP3SIdz1gxf36EERQlSoTyROuWDT2uM7l+JH0iF8vAJcjinfPBxlF+JIXhIhfKEnyAzAs7sonU8WUiFMkS2pMKnyXzqTUiQCmVwOLhAGNLanRI0NZSFVBh1qFijCalQBr5YGP5hrHScqyakQg3CKRYGQ0c1yEIqjDp84ZovQxISpEIZQrgVsgpGj/mKQ0iFMtDhMn0MqVCDqZOMbXoiQoBUSPQ/pEKi/yEVEv0PqZDof0iFGvDrKESUIBXKEE4rVzB0zL8mpMKow++HpzVlWUiFGkR2HSWyq9KmgVQoA7/yG/46SmR1bEpIhTJEduWX17HRI5fiBFKhDFZrElqWXreZCA0+FlJngyykQhmeeHwCWn7CHFL5E2rS0+lmjjKQCuXhT6WWnRrW1Tdkbto+Y86Pnpi2CB7Blu3mDzgw7tGxY9AiOEiF8vBDJ783mQHaen7Za8dOnGUbRuER7H9cuDr7+Bn2BIlbXFtrZDdSmQlSoTx84TognsEAvWJVFr9hWeLnv9wTEBH5v8vfK5TgIRXKw58KEnA2OgQ8WQkCcH3fgePo+An/KM54gFQoT8DZ6HyEO3MuBy05AiaRRu/kGJ+QCuVJHTUi/LPR+UCYkpIUkHoTEqRCRfipIR//9K8Fnz73NVq+QEg7BxQhFSrCn43Oq1D9nowL5s9Gy6fCnr9FCbIKpEJF5j7zFAyj6PiTEmYsnD9bSVIwiMNPmQ3ZMX9U3JxZeu8nGoeQCtWYw4U9Phxu27o+WIhw5cNdm9GxWPhkGdRJ9WoVErxeL5pEECdPnV+77i10LJbPsncGnBAsdWJnjH+El6zD4Xp24SqpoLNu7Ys//ckiZhPBkAo1mDxjsSSmVSsXr165hNnqwPCdtXkHOhbLhS8/hqQbHSIIGpE1WP7CfLT8g6zOzoaduw+hBfnKvFkkQXVIhRpI2QbgWxo52GtpRBYIhHxewuuYkIVUqAFkFRDM0NEXDvlACCkLFas1IRVqs/pfeuaCmuEQJMgHQp3zyDiHVKhNQDjctftwQJeNRF19A1+ggUA4c/okdAhlSIW6gHDIV7AzN/XkvzxwXUqogS0b16BFqEIq1AWEQz7JKKuo4id/DIiCfAfNsqXzqFKtE1KhXtau+THfZQPjMr9MDGP01nc+Qse/YYBmhPohFRoARtje4/J2trgMjytWZbGLjHe3rqcaoX5o7cQYh458zi+KyLJq5WIInOgQOqBYaIwli57l8+VgZj89jSRoFFKhYbb+7HUlIcLEcUsW5cWGoRE5RD7Ye2TfweNSgRrmi5BEUxQMBYvl/wEV2/F+BAZN5gAAAABJRU5ErkJggg==";
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
        </div>
        <div style={{background:'var(--card)',border:'1px solid var(--border)',borderRadius:10,padding:'16px 20px',boxShadow:'var(--shadow-sm)'}}>
          <p style={{fontSize:11,fontWeight:600,textTransform:'uppercase',letterSpacing:'0.06em',color:'var(--muted-fg)',marginBottom:6}}>Outstanding Amount</p>
          <p style={{fontSize:32,fontWeight:700,color:'#ef4444'}}>{fmtUSD(totalOutstandingAmt)}</p>
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

  const monthsWithData=monthlyData.filter(m=>m.revenue>0);
  const avgRevenuePerMonth=monthsWithData.length>0?monthsWithData.reduce((s,m)=>s+m.revenue,0)/monthsWithData.length:0;
  const avgProfitPerMonth=monthsWithData.length>0?monthsWithData.reduce((s,m)=>s+m.grossProfit,0)/monthsWithData.length:0;

  // Total Lost — sum of project values with "Lost" label
  const lostDeals=api.getDeals().filter(d=>(d.labels||[]).includes('Lost'));
  const totalLostValue=lostDeals.reduce((s,d)=>s+(parseFloat(d.value)||0),0);

  const inp={background:'var(--muted)',border:'1px solid var(--border)',borderRadius:6,padding:'5px 8px',fontSize:12,color:'var(--fg)',width:'100%',textAlign:'right'};
  const tdStyle={padding:'8px 10px',borderBottom:'1px solid var(--border)',fontSize:12,verticalAlign:'middle'};
  const thStyle={padding:'8px 10px',fontSize:11,fontWeight:700,textTransform:'uppercase',letterSpacing:'0.05em',color:'var(--muted-fg)',borderBottom:'2px solid var(--border)',whiteSpace:'nowrap',textAlign:'left'};

  return (
    <div style={{padding:'20px 24px',overflowY:'auto',height:'100%',display:'flex',flexDirection:'column',gap:20}}>
      <div>
        <h1 style={{fontSize:22,fontWeight:700}}>Financials</h1>
      </div>

      {/* ── Stat cards (Row 1) ── */}
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:14,flexShrink:0}}>
        {[
          {label:'Avg Revenue / Month',value:fmtUSD(avgRevenuePerMonth),color:'var(--primary)'},
          {label:'Avg Profit / Month',value:fmtUSD(avgProfitPerMonth),color:avgProfitPerMonth>=0?'#22c55e':'#ef4444'},
          {label:'Total Lost',value:fmtUSD(totalLostValue),color:'#ef4444'},
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


      {/* ── Row 2: Leads by Source + Cost Breakdown pie + Avg Project Value bar ── */}
      {(()=>{
        const totalLabour=activeDeals.reduce((s,d)=>s+getRow(d).labour,0);
        const totalMaterials=activeDeals.reduce((s,d)=>s+getRow(d).materials,0);
        const totalWages=activeDeals.reduce((s,d)=>s+getRow(d).wages,0);
        const totalGrossProfit=activeDeals.reduce((s,d)=>s+getRow(d).grossProfit,0);
        const pieBase=Math.max(totalMaterials+totalWages+Math.max(0,totalGrossProfit),1);
        const matPct=Math.round(totalMaterials/pieBase*100);
        const wagePct=Math.round(totalWages/pieBase*100);
        const profPct=100-matPct-wagePct;
        const costPieData=[
          {name:'Profit',value:Math.max(0,profPct),color:'#C4922A'},
          {name:'Materials',value:matPct,color:'#3b82f6'},
          {name:'Wages',value:wagePct,color:'#22c55e'},
        ];
        const projectValues=activeDeals.map(d=>parseFloat(d.value)||0).filter(v=>v>0);
        const highestVal=projectValues.length?Math.max(...projectValues):0;
        const lowestVal=projectValues.length?Math.min(...projectValues):0;
        const avgVal=avgProjectValueF;
        const barData=[
          {label:'Lowest',value:lowestVal,fill:'#3b82f6'},
          {label:'Average',value:avgVal,fill:'#C4922A'},
          {label:'Highest',value:highestVal,fill:'#22c55e'},
        ];
        // Leads by source — avg per month using quote_date
        const totalLeadsWithSrc=activeDeals.filter(d=>d.leadSource).length||1;
        return (
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:14}}>
            <Card style={{padding:'14px 18px',display:'flex',flexDirection:'column',gap:4}}>
              <p style={{fontSize:10,fontWeight:700,textTransform:'uppercase',letterSpacing:'0.06em',color:'var(--muted-fg)',marginBottom:8}}>Leads by Source / Month</p>
              <div style={{display:'flex',flexDirection:'column',gap:7}}>
                {LEAD_SOURCES.map(source=>{
                  const count=activeDeals.filter(d=>d.leadSource===source).length;
                  const pct=Math.round((count/totalLeadsWithSrc)*100);
                  return (
                    <div key={source} style={{display:'flex',alignItems:'center',gap:7}}>
                      <span style={{fontSize:10,fontWeight:700,width:80,textAlign:'center',flexShrink:0,padding:'1px 8px',borderRadius:20,background:(LEAD_COLORS[source]||{bg:'#f3f4f6'}).bg,color:(LEAD_COLORS[source]||{color:'#374151'}).color}}>{source}</span>
                      <div style={{flex:1,height:7,background:'var(--muted)',borderRadius:9,overflow:'hidden'}}>
                        <div style={{height:'100%',background:'var(--primary)',borderRadius:9,width:`${pct}%`,transition:'width .4s'}}/>
                      </div>
                      <span style={{fontSize:11,fontWeight:700,color:'var(--fg)',width:20,textAlign:'right'}}>{count}</span>
                      <span style={{fontSize:10,color:'var(--muted-fg)',width:30,textAlign:'right'}}>{pct}%</span>
                    </div>
                  );
                })}
                {activeDeals.filter(d=>d.leadSource).length===0&&<p style={{fontSize:12,color:'var(--muted-fg)'}}>No lead sources yet.</p>}
              </div>
            </Card>
            <Card style={{padding:'14px 18px',display:'flex',flexDirection:'column',gap:8}}>
              <p style={{fontSize:10,fontWeight:700,textTransform:'uppercase',letterSpacing:'0.06em',color:'var(--muted-fg)'}}>Cost Breakdown (Avg)</p>
              <div style={{display:'flex',alignItems:'center',gap:8,flex:1}}>
                <PieChart width={150} height={150}>
                  <Pie data={costPieData} cx={70} cy={70} innerRadius={42} outerRadius={68} dataKey='value' startAngle={90} endAngle={-270} strokeWidth={0}>
                    {costPieData.map((e,i)=><Cell key={i} fill={e.color}/>)}
                  </Pie>
                </PieChart>
                <div style={{display:'flex',flexDirection:'column',gap:10,flex:1}}>
                  {costPieData.map(d=>(
                    <div key={d.name} style={{display:'flex',alignItems:'center',gap:8}}>
                      <span style={{width:12,height:12,borderRadius:'50%',background:d.color,flexShrink:0,display:'inline-block'}}/>
                      <span style={{fontSize:13,color:'var(--muted-fg)',flex:1}}>{d.name}</span>
                      <span style={{fontWeight:800,fontSize:18,color:d.color}}>{d.value}%</span>
                    </div>
                  ))}
                </div>
              </div>
            </Card>
            <Card style={{padding:'14px 18px',display:'flex',flexDirection:'column',gap:4}}>
              <p style={{fontSize:10,fontWeight:700,textTransform:'uppercase',letterSpacing:'0.06em',color:'var(--muted-fg)'}}>Project Value Range</p>
              <ResponsiveContainer width='100%' height={130}>
                <BarChart data={barData} margin={{top:4,right:4,left:0,bottom:4}}>
                  <XAxis dataKey='label' tick={{fontSize:10,fontWeight:600}}/>
                  <YAxis tick={{fontSize:9}} tickFormatter={v=>`$${(v/1000).toFixed(0)}k`} width={40}/>
                  <Tooltip formatter={v=>['$'+v.toFixed(2),'Value']} contentStyle={{background:'var(--card)',border:'1px solid var(--border)',borderRadius:8,fontSize:11}}/>
                  <Bar dataKey='value' radius={[4,4,0,0]}>
                    {barData.map((e,i)=><Cell key={i} fill={e.fill}/>)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
              <p style={{fontSize:11,color:'var(--primary)',fontWeight:700,textAlign:'center'}}>Avg: ${avgVal.toFixed(2)}</p>
            </Card>
          </div>
        );
      })()}

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
  const showToast=msg=>{setToast(msg);window.__kpToast=msg=>setToast(msg);};

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
