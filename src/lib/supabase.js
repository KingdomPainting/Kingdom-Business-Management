// ─── Supabase client, auth & connection status ───────────────────────────────
import { demoFetch, resetDemoStore } from './demo';

export const SUPA_URL = 'https://cyzvmcmlpnozwrqifrdt.supabase.co';
export const SUPA_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN5enZtY21scG5vendycWlmcmR0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg2Mzk1MzEsImV4cCI6MjA5NDIxNTUzMX0.IeZRx5xcPddSQcL77vhKjOgAKFi8bKpj3dMfajHpV3c';
export const ADMIN_EMAIL = 'info@kingdompainting.ca';
export const DEMO_EMAIL = 'demo@kingdompainting.ca';
export function isDemo(){ return (_session?.user?.email||'').toLowerCase() === DEMO_EMAIL; }

// ─── Auth state ──────────────────────────────────────────────────────────────
export let _session = null; // { access_token, user }
const _authListeners = new Set();
export function onAuthChange(fn){ _authListeners.add(fn); return ()=>_authListeners.delete(fn); }
export function setSession(s){ _session = s; _authListeners.forEach(fn=>fn(s)); }

export function supaHeaders(){
  const token = _session?.access_token || SUPA_KEY;
  return {
    'apikey': SUPA_KEY,
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
    'Prefer': 'return=representation',
  };
}

export async function supaFetch(path, method='GET', body=null){
  if(isDemo()) return demoFetch(path, method, body);
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
export async function signIn(email, password){
  // Demo account — fully client-side, never touches the database
  if((email||'').trim().toLowerCase()===DEMO_EMAIL && password==='password'){
    resetDemoStore();
    const session = { access_token:'demo-token', refresh_token:'demo-refresh', user:{ id:'demo-user', email:DEMO_EMAIL } };
    setSession(session);
    localStorage.setItem('kp_session', JSON.stringify(session));
    return session;
  }
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

export async function signUp(email, password){
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

export async function signOut(){
  try{
    await fetch(`${SUPA_URL}/auth/v1/logout`, {
      method: 'POST',
      headers: supaHeaders(),
    });
  }catch(e){}
  localStorage.removeItem('kp_session');
  setSession(null);
}

export async function refreshSession(refreshToken){
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
export let _supaConnected = null; // null=unknown, true=ok, false=error
let _supaError = '';
const _supaListeners = new Set();
export function onSupaStatus(fn){ _supaListeners.add(fn); return ()=>_supaListeners.delete(fn); }
export function setSupaStatus(ok, err=''){
  _supaConnected = ok; _supaError = err;
  _supaListeners.forEach(fn=>fn(ok,err));
}

export async function checkSupaConnection(){
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
