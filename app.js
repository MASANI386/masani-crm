/* MASANI CRM - Clean Rebuild v2 | No Service Worker Cache Issue */
const SB_URL = 'https://YOUR_PROJECT.supabase.co';
const SB_KEY = 'YOUR_ANON_KEY';
const S = { sb: null, user: null, policies: [], customers: [], agents: [], payments: [], loaded: false, loadedAt: 0, f: 'all' };

const $ = s => document.querySelector(s);
const $$ = s => document.querySelectorAll(s);
const app = () => document.getElementById('app');
const num = v => parseFloat(v) || 0;
const tenDigits = v => (v||'').replace(/\D/g,'').slice(0,10);
const today = () => new Date().toISOString().slice(0,10);
const toast = (m) => {
  let d = document.getElementById('toast');
  if(!d){ d = document.createElement('div'); d.id='toast'; d.style.cssText='position:fixed;bottom:20px;left:50%;transform:translateX(-50%);background:#222;color:#fff;padding:10px 18px;border-radius:20px;z-index:9999'; document.body.appendChild(d); }
  d.textContent = m; d.style.display='block'; setTimeout(()=>d.style.display='none',2500);
};
function closeSheet(){ const ov=$('#ov'); if(ov) ov.remove(); }

function renderSetupKey(){
  app().innerHTML = `<div class="login"><div class="box"><h1>Key missing hai</h1><p class="sub">app.js me SB_URL / SB_KEY dalo</p></div></div>`;
}
function renderLogin(){
  app().innerHTML = `<div class="login"><div class="box"><h1>Masani Insurance</h1><p class="sub">Login karein</p>
  <input id="em" placeholder="Email" type="email"><input id="pw" placeholder="Password" type="password" style="margin-top:10px">
  <button id="loginBtn" class="btn" style="margin-top:14px;width:100%">Login</button></div></div>`;
  $('#loginBtn').onclick = async () => {
    const em=$('#em').value.trim(), pw=$('#pw').value.trim();
    if(!em||!pw){ toast('Email/Password dalo'); return; }
    const {error} = await S.sb.auth.signInWithPassword({email:em,password:pw});
    if(error) toast(error.message); else toast('Login ho gaya ✓');
  };
}
function render(){
  const types = ['all','Motor','Health','Life'];
  const counts = {all:S.policies.length, Motor:S.policies.filter(p=>p.category==='Motor').length, Health:S.policies.filter(p=>p.category==='Health').length, Life:S.policies.filter(p=>p.category==='Life').length };
  const filtered = S.f==='all' ? S.policies : S.policies.filter(p=>p.category===S.f);
  app().innerHTML = `<div class="wrap">
  <div class="top"><h2>Masani CRM</h2><div><button id="addPol" class="btn">+ Policy</button> <button id="logout" class="btn o">Logout</button></div></div>
  <div class="filters" style="display:flex;gap:8px;margin:12px 0;flex-wrap:wrap">
    ${types.map(t=>`<button data-f="${t}" class="chip ${S.f===t?'active':''}" style="padding:8px 14px;border-radius:20px;border:1px solid #ddd;background:${S.f===t?'#111': '#fff'};color:${S.f===t?'#fff':'#000'}">${t==='all'?'All':t} (${counts[t]||0})</button>`).join('')}
  </div>
  <div class="list">${filtered.length===0?'<p class="sub">Koi policy nahi mili</p>':filtered.map(p=>`
    <div class="card" style="border:1px solid #eee;padding:12px;border-radius:12px;margin-bottom:10px">
      <b>${p.vehicle_no||p.policy_no||'Policy'} </b> <span class="badge">${p.category||'General'}</span>
      <div class="sub">${p.customer_name||''} - ${p.premium||''} Rs</div>
    </div>`).join('')}</div></div>`;
  $$('.chip').forEach(b=> b.onclick = ()=>{ S.f=b.dataset.f; render(); });
  $('#logout').onclick = async ()=>{ await S.sb.auth.signOut(); };
}
async function loadAll(force=false){
  if(S.loaded && !force && Date.now()-S.loadedAt < 60000) return;
  try{
    const {data:pol} = await S.sb.from('policies').select('*').order('created_at',{ascending:false}).limit(200);
    S.policies = pol||[]; S.loaded = true; S.loadedAt = Date.now();
  }catch(e){ console.log('load err',e); }
}
async function boot(){
  if(!window.supabase){ app().innerHTML = '<div class="login"><div class="box"><h1>Internet chahiye</h1><p class="sub">Net chalu karke refresh karein.</p></div></div>'; return; }
  if(!SB_URL.includes('supabase.co') || SB_KEY==='YOUR_ANON_KEY'){ renderSetupKey(); return; }
  S.sb = window.supabase.createClient(SB_URL, SB_KEY, { auth: { persistSession:true, autoRefreshToken:true } });
  const apply = async (session) => {
    const u = session && session.user;
    if(u){ const first = !S.user; S.user = u; if(first){ render(); await loadAll(); render(); } }
    else{ S.user = null; S.loaded=false; closeSheet(); renderLogin(); }
  };
  S.sb.auth.onAuthStateChange((ev, session) => {
    if(ev==='SIGNED_IN' || ev==='SIGNED_OUT' || ev==='INITIAL_SESSION') setTimeout(()=>apply(session),0);
  });
  const { data } = await S.sb.auth.getSession();
  if(!S.user && !data.session) renderLogin();
}
boot();
