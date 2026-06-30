// ─── Google Calendar helpers ─────────────────────────────────────────────────
const GCAL_API='https://www.googleapis.com/calendar/v3';
const GCAL_SCOPE='https://www.googleapis.com/auth/calendar';
export const GCAL_CLIENT_ID='679479647573-mlt9c1ngee00f0fildru0mbda9gdi78p.apps.googleusercontent.com';

export function gcalGetToken(){ return localStorage.getItem('kp_gcal_token'); }
export function gcalSetToken(t){ localStorage.setItem('kp_gcal_token',t); }
export function gcalClearToken(){ localStorage.removeItem('kp_gcal_token'); }

export function gcalSignIn(){
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

export async function gcalFetchEvents(timeMin, timeMax){
  const url=`${GCAL_API}/calendars/primary/events?timeMin=${encodeURIComponent(timeMin)}&timeMax=${encodeURIComponent(timeMax)}&singleEvents=true&orderBy=startTime&maxResults=50`;
  return gcalAuthFetch(url);
}

export async function gcalCreateEvent(title, dateStr, startTime, endTime, address, notes){
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

export async function gcalCreateProjectEvent(title, startDate, startTime, endDate, endTime, address, notes){
  if(!startDate) return null;
  return gcalCreateEvent(title, startDate, startTime||'09:00', endDate||startDate, endTime||'17:00', address, notes);
}

export async function gcalDeleteEvent(eventId){
  if(!eventId) return;
  try{ await gcalAuthFetch(`${GCAL_API}/calendars/primary/events/${encodeURIComponent(eventId)}`,{method:'DELETE'}); }catch(e){}
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

export async function gtasksCreate(task){
  // task: {title, notes, due} — due is ISO datetime string
  const due = task.due ? new Date(task.due).toISOString() : null;
  return gtasksCall(
    `Create a Google Task with title: "${task.title}"${task.notes?`, notes: "${task.notes}"`:''}${due?`, due date: "${due}"`:''}. Return JSON: {taskId, title, status}`
  );
}

export async function gtasksComplete(taskId){
  return gtasksCall(`Mark Google Task with ID "${taskId}" as completed. Return JSON: {taskId, status}`);
}

export async function gtasksDelete(taskId){
  return gtasksCall(`Delete Google Task with ID "${taskId}". Return JSON: {deleted: true}`);
}

export async function gtasksUpdate(taskId, task){
  const due = task.due ? new Date(task.due).toISOString() : null;
  return gtasksCall(
    `Update Google Task ID "${taskId}": title="${task.title}"${task.notes?`, notes="${task.notes}"`:''}${due?`, due="${due}"`:''}. Return JSON: {taskId, title}`
  );
}
