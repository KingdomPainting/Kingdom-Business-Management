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

// De-dupe concurrent token refreshes: Supabase refresh tokens are single-use, so
// several parallel 401s must share one refresh (portal polling fires many calls).
let _refreshInFlight = null;
function refreshOnce(){
  const rt = _session?.refresh_token;
  if(!rt || rt==='demo-refresh') return Promise.resolve(null);
  if(!_refreshInFlight){
    _refreshInFlight = refreshSession(rt).finally(()=>{ _refreshInFlight = null; });
  }
  return _refreshInFlight;
}

export async function supaFetch(path, method='GET', body=null){
  if(isDemo()) return demoFetch(path, method, body);
  const doFetch = ()=>{
    const opts = { method, headers: supaHeaders() };
    if(body) opts.body = JSON.stringify(body);
    return fetch(SUPA_URL + path, opts);
  };
  let res = await doFetch();
  // Access token (JWT) expired — refresh it once and retry the request.
  if(res.status===401){
    const fresh = await refreshOnce();
    if(fresh){
      res = await doFetch();
    }else if(_session && _session.refresh_token && _session.refresh_token!=='demo-refresh'){
      // Refresh token is dead too — end the session so the user is sent to login
      // instead of looping on an unrecoverable error.
      localStorage.removeItem('kp_session');
      setSession(null);
    }
  }
  if(!res.ok){
    const err = await res.text();
    throw new Error(`Supabase ${method} ${path}: ${res.status} ${err.slice(0,120)}`);
  }
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

// Call a Supabase Edge Function. Unlike supaFetch this omits the `Prefer`
// header, so the function's CORS preflight only needs to allow the standard
// auth/apikey/content-type headers. Refreshes an expired JWT once and retries.
export async function functionFetch(name, body=null){
  const doFetch = ()=>{
    const token = _session?.access_token || SUPA_KEY;
    return fetch(`${SUPA_URL}/functions/v1/${name}`, {
      method: 'POST',
      headers: { 'apikey': SUPA_KEY, 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
    });
  };
  let res = await doFetch();
  if(res.status===401){
    const fresh = await refreshOnce();
    if(fresh) res = await doFetch();
  }
  const text = await res.text();
  let data = null;
  try{ data = text ? JSON.parse(text) : null; }catch{ data = { raw:text }; }
  if(!res.ok){
    throw new Error(data?.error || `Function ${name}: ${res.status}`);
  }
  return data;
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

// ─── Two-factor auth helpers ──────────────────────────────────────────────────
// Password grant only — returns the session WITHOUT committing it, so the login
// screen can require a second factor before the app treats the user as signed in.
export async function passwordGrant(email, password){
  const res = await fetch(`${SUPA_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { 'apikey': SUPA_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const data = await res.json();
  if(!res.ok) throw new Error(data.error_description || data.msg || 'Login failed');
  return { access_token: data.access_token, refresh_token: data.refresh_token, user: data.user };
}

// Commit a verified session (no 2FA required, or after the second factor passed).
export function commitSession(session){
  setSession(session);
  localStorage.setItem('kp_session', JSON.stringify(session));
}

// Call an RPC with an explicit bearer token (used during the 2FA gate, before the
// session is committed globally).
export async function rpcWithToken(token, fn, args={}){
  const res = await fetch(`${SUPA_URL}/rest/v1/rpc/${fn}`, {
    method: 'POST',
    headers: { 'apikey': SUPA_KEY, 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(args),
  });
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if(!res.ok) throw new Error(data?.message || `Request failed`);
  return data;
}

// Email one-time code (Supabase built-in email), used as an email 2FA factor.
export async function sendEmailOtp(email){
  const res = await fetch(`${SUPA_URL}/auth/v1/otp`, {
    method: 'POST', headers: { 'apikey': SUPA_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, create_user: false }),
  });
  if(!res.ok){ const d = await res.json().catch(()=>({})); throw new Error(d.error_description || d.msg || 'Could not send code'); }
  return true;
}
export async function verifyEmailOtp(email, token){
  const res = await fetch(`${SUPA_URL}/auth/v1/verify`, {
    method: 'POST', headers: { 'apikey': SUPA_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ type: 'email', email, token }),
  });
  const data = await res.json();
  if(!res.ok) throw new Error(data.error_description || data.msg || 'Invalid or expired code');
  return { access_token: data.access_token, refresh_token: data.refresh_token, user: data.user };
}

// Enrollment helpers (called while already signed in — use the current session).
export async function getMy2FA(){ try{ return await supaFetch('/rest/v1/rpc/get_my_2fa','POST',{}); }catch{ return 'none'; } }
export async function setMyPin(pin){ return supaFetch('/rest/v1/rpc/set_my_pin','POST',{ p_pin: pin }); }
export async function setMy2FAEmail(){ return supaFetch('/rest/v1/rpc/set_my_2fa_email','POST',{}); }
export async function disableMy2FA(){ return supaFetch('/rest/v1/rpc/disable_my_2fa','POST',{}); }
export async function setMy2FATotp(factorId){ return supaFetch('/rest/v1/rpc/set_my_2fa_totp','POST',{ p_factor_id: factorId }); }

// ─── Supabase native MFA (TOTP / authenticator app) ───────────────────────────
// authFetch helper — hits a GoTrue endpoint with a bearer token (defaults to the
// current session; the login gate passes the not-yet-committed AAL1 token).
async function authFetch(path, body, token){
  const t = token || _session?.access_token || SUPA_KEY;
  const res = await fetch(`${SUPA_URL}/auth/v1${path}`, {
    method: 'POST', headers: { 'apikey': SUPA_KEY, 'Authorization': `Bearer ${t}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(()=>({}));
  if(!res.ok) throw new Error(data.error_description || data.msg || data.message || 'MFA request failed');
  return data;
}

// Enroll a new TOTP factor (returns {id, totp:{qr_code, secret, uri}}).
export async function mfaEnroll(){
  return authFetch('/factors', { factor_type: 'totp', friendly_name: `Authenticator ${Date.now()}` });
}
export async function mfaChallenge(factorId, token){
  return authFetch(`/factors/${factorId}/challenge`, {}, token);
}
// Verify a challenge; on success GoTrue returns a fresh (AAL2) session.
export async function mfaVerify(factorId, challengeId, code, token){
  return authFetch(`/factors/${factorId}/verify`, { challenge_id: challengeId, code }, token);
}
export async function mfaUnenroll(factorId, token){
  const t = token || _session?.access_token || SUPA_KEY;
  try{ await fetch(`${SUPA_URL}/auth/v1/factors/${factorId}`, { method:'DELETE', headers:{ 'apikey':SUPA_KEY, 'Authorization':`Bearer ${t}` } }); }catch{ /* ignore */ }
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
