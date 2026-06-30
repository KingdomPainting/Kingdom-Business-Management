// ─── API — Supabase-backed, falls back to in-memory if table missing ──────────
import { supaFetch, setSupaStatus, _session } from './supabase';
import { genId, now } from './format';

// ─── In-memory fallback cache (used as local state between Supabase calls) ────
export let DB = { clients:[], contacts:[], deals:[], activities:[], estimates:[] };

export const api = {
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

// ─── Bootstrap: load all data from Supabase on startup ───────────────────────
export async function bootstrapDB(){
  await Promise.all([api.loadContacts(), api.loadDeals(), api.loadActivities()]);
  setSupaStatus(true); // Data loaded successfully → mark as connected
}
