/* Masani Finsure CRM — policies, sub-agents, commission, endorsements, claims.
   Data: Supabase (Postgres + Auth + Storage). Koi build step nahi. */
(() => {
'use strict';

/* ---------- small helpers ---------- */
const CFG = window.MASANI_CONFIG || {};
const ls = {
  get(k){ try { return localStorage.getItem(k) || ''; } catch { return ''; } },
  set(k,v){ try { localStorage.setItem(k,v); } catch {} },
  del(k){ try { localStorage.removeItem(k); } catch {} }
};
const SB_URL = CFG.SUPABASE_URL || '';
const SB_KEY = CFG.SUPABASE_ANON_KEY || ls.get('masani_key');
const BUCKET = 'policy-files';

const $ = (s, r=document) => r.querySelector(s);
const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const num = v => Number(String(v ?? '').replace(/,/g,'')) || 0;
const inr = v => '₹' + Math.round(num(v)).toLocaleString('en-IN');
const iso = d => { const z = d.getTimezoneOffset(); return new Date(d - z*60000).toISOString().slice(0,10); };
const today = () => iso(new Date());
const fdate = s => s ? s.slice(8,10) + '-' + s.slice(5,7) + '-' + s.slice(0,4) : '—';
const daysLeft = s => { if(!s) return 9999; const t = new Date(); t.setHours(0,0,0,0); return Math.round((new Date(s + 'T00:00:00') - t) / 864e5); };
const addYear = s => { if(!s) return ''; const d = new Date(s + 'T00:00:00'); return iso(new Date(d.getFullYear()+1, d.getMonth(), d.getDate()-1)); };
const tenDigits = m => String(m || '').replace(/\D/g,'').slice(-10);
const waLink = (mobile, text) => 'https://wa.me/91' + tenDigits(mobile) + '?text=' + encodeURIComponent(text);
const uid = () => Math.random().toString(36).slice(2);

function toast(msg, type){
  const box = $('#toast'); if(!box) return;
  const d = document.createElement('div'); d.textContent = msg; if(type) d.className = type === 'error' ? 'e' : 's';
  box.appendChild(d); setTimeout(() => d.remove(), type === 'error' ? 5000 : 2600);
}
async function q(p){ const { data, error } = await p; if(error) throw error; return data; }
const errMsg = e => (e && (e.message || e.error_description)) || String(e);

/* ---------- state ---------- */
const S = {
  sb: null, user: null, tab: 'home',
  policies: [], customers: [], agents: [], payments: [],
  loaded: false, loadedAt: 0, settings: null, imp: null,
  fPol: { text: '', type: 'all', agent: 'all' },
  fAgent: '', fCust: '', fRen: 'due',
  installEvt: null
};

const INSURERS = [
  'Acko General Insurance Limited',
  'Bajaj Allianz General Insurance Company Limited',
  'Cholamandalam MS General Insurance Company Limited',
  'Generali Central Insurance Company Limited',
  'Go Digit General Insurance Limited',
  'HDFC Ergo General Insurance Company Limited',
  'ICICI Lombard General Insurance Company Limited',
  'IndusInd General Insurance Company Limited',
  'IFFCO Tokio General Insurance Company Limited',
  'Kiwi General Insurance Limited',
  'Kshema General Insurance Limited',
  'Liberty General Insurance Limited',
  'Magma HDI General Insurance Company Limited',
  'National Insurance Company Limited',
  'Navi General Insurance Limited',
  'Protec General Insurance Limited',
  'Raheja QBE General Insurance Company Limited',
  'Royal Sundaram General Insurance Company Limited',
  'SBI General Insurance Company Limited',
  'Shriram General Insurance Company Limited',
  'Tata AIG General Insurance Company Limited',
  'The New India Assurance Company Limited',
  'The Oriental Insurance Company Limited',
  'United India Insurance Company Limited',
  'Universal Sompo General Insurance Company Limited',
  'Zuno General Insurance Limited',
  'Zurich Kotak General Insurance Company (India) Limited',
  'Star Health and Allied Insurance Company Limited',
  'Care Health Insurance Limited',
  'Niva Bupa Health Insurance Company Limited',
  'Aditya Birla Health Insurance Co. Limited',
  'ManipalCigna Health Insurance Company Limited',
  'Life Insurance Corporation of India',
  'HDFC Life Insurance Company Limited',
  'ICICI Prudential Life Insurance Company Limited',
  'SBI Life Insurance Company Limited',
  'Max Life Insurance Company Limited',
  'Bajaj Allianz Life Insurance Company Limited',
  'Tata AIA Life Insurance Company Limited'
   // --- TYPE WISE FILTER ---
const MOTOR_COMPANIES = [
  'Acko General Insurance Limited',
  'Bajaj Allianz General Insurance Company Limited',
  'Cholamandalam MS General Insurance Company Limited',
  'Generali Central Insurance Company Limited',
  'Go Digit General Insurance Limited',
  'HDFC Ergo General Insurance Company Limited',
  'ICICI Lombard General Insurance Company Limited',
  'IndusInd General Insurance Company Limited',
  'IFFCO Tokio General Insurance Company Limited',
  'Kiwi General Insurance Limited',
  'Kshema General Insurance Limited',
  'Liberty General Insurance Limited',
  'Magma HDI General Insurance Company Limited',
  'National Insurance Company Limited',
  'Navi General Insurance Limited',
  'Protec General Insurance Limited',
  'Raheja QBE General Insurance Company Limited',
  'Royal Sundaram General Insurance Company Limited',
  'SBI General Insurance Company Limited',
  'Shriram General Insurance Company Limited',
  'Tata AIG General Insurance Company Limited',
  'The New India Assurance Company Limited',
  'The Oriental Insurance Company Limited',
  'United India Insurance Company Limited',
  'Universal Sompo General Insurance Company Limited',
  'Zuno General Insurance Limited',
  'Zurich Kotak General Insurance Company (India) Limited'
];

const HEALTH_COMPANIES = [
  'Star Health and Allied Insurance Company Limited',
  'Care Health Insurance Limited',
  'Niva Bupa Health Insurance Company Limited',
  'Aditya Birla Health Insurance Co. Limited',
  'ManipalCigna Health Insurance Company Limited'
];

const LIFE_COMPANIES = [
  'Life Insurance Corporation of India',
  'HDFC Life Insurance Company Limited',
  'ICICI Prudential Life Insurance Company Limited',
  'SBI Life Insurance Company Limited',
  'Max Life Insurance Company Limited',
  'Bajaj Allianz Life Insurance Company Limited',
  'Tata AIA Life Insurance Company Limited'
];

function getCompaniesByType(type) {
  if (type === 'Health') return HEALTH_COMPANIES;
  if (type === 'Life') return LIFE_COMPANIES;
  return MOTOR_COMPANIES; // default Motor
}
];
/* ---------- data ---------- */
async function loadAll(silent){
  const sb = S.sb;
  try {
    const [p, c, a, pay] = await Promise.all([
      q(sb.from('policies').select('*').order('expiry_date', { ascending: true })),
      q(sb.from('customers').select('*').order('name', { ascending: true })),
      q(sb.from('sub_agents').select('*').order('name', { ascending: true })),
      q(sb.from('agent_payments').select('*').order('paid_on', { ascending: false }))
    ]);
    S.policies = p || []; S.customers = c || []; S.agents = a || []; S.payments = pay || [];
    try { const st = await q(sb.from('app_settings').select('*').eq('id','main')); S.settings = (st && st[0] && st[0].value) || null; } catch { S.settings = null; }
    S.loaded = true; S.loadedAt = Date.now();
  } catch(e) {
    if(!silent) toast('Data nahi aaya: ' + errMsg(e), 'error');
    if(/sub_agents|agent_payments/.test(errMsg(e))) S.setupMissing = true;
  }
}
const agentById = id => S.agents.find(a => a.id === id);
const policyById = id => S.policies.find(p => p.id === id);
const agentStats = id => {
  const pols = S.policies.filter(p => p.sub_agent_id === id);
  const due = pols.reduce((s,p) => s + num(p.agent_commission), 0);
  const paid = S.payments.filter(x => x.agent_id === id).reduce((s,x) => s + num(x.amount), 0);
  return { count: pols.length, premium: pols.reduce((s,p) => s + num(p.net_premium), 0), due, paid, bal: due - paid, pols };
};
const policyPaid = pid => S.payments.filter(x => x.policy_id === pid).reduce((s,x) => s + num(x.amount), 0);
const isActive = p => daysLeft(p.expiry_date) >= 0;

async function upload(file, folder){
  if(!file || !file.size) return null;
  if(file.size > 12 * 1024 * 1024) throw new Error('File 12MB se badi hai');
  const safe = file.name.replace(/[^\w.\-]+/g, '_').slice(-60) || 'file';
  const path = `${folder}/${Date.now()}_${safe}`;
  const { error } = await S.sb.storage.from(BUCKET).upload(path, file, { contentType: file.type || 'application/octet-stream' });
  if(error) throw error;
  return { path, name: file.name };
}
async function openFile(path){
  try {
    const { data, error } = await S.sb.storage.from(BUCKET).createSignedUrl(path, 600);
    if(error) throw error;
    const w = window.open(data.signedUrl, '_blank');
    if(!w) location.href = data.signedUrl;
  } catch(e){ toast('File nahi khuli: ' + errMsg(e), 'error'); }
}
async function removeFile(path){ if(path) { try { await S.sb.storage.from(BUCKET).remove([path]); } catch {} } }

/* ---------- shell rendering ---------- */
const app = () => $('#app');

function renderSetupKey(msg){
  app().innerHTML = `<div class="login"><div class="box">
    <img class="lg" src="logo.png" alt="Masani Finsure">
    <h1>Pehli baar setup</h1>
    <p class="sub">Supabase ki <b>anon public key</b> yahan paste karein<br>(Supabase → Project Settings → API Keys)</p>
    ${msg ? `<div class="err">${esc(msg)}</div>` : ''}
    <form data-form="setkey">
      <div class="f"><label>Anon public key</label><textarea name="key" required placeholder="eyJhbGciOi... (lambi key)"></textarea></div>
      <button class="btn full">Save karein</button>
    </form></div></div>`;
}

function renderLogin(msg){
  app().innerHTML = `<div class="login"><div class="box">
    <img class="lg" src="logo.png" alt="Masani Finsure">
    <h1>Masani Finsure CRM</h1>
    <p class="sub">Sirf authorised login. Apna email aur password daalein.</p>
    ${msg ? `<div class="err">${esc(msg)}</div>` : ''}
    <form data-form="login" autocomplete="on">
      <div class="f"><label>Email</label><input name="email" type="email" required autocomplete="username" inputmode="email"></div>
      <div class="f"><label>Password</label><input name="password" type="password" required autocomplete="current-password"></div>
      <button class="btn full" id="loginBtn">Login</button>
    </form>
    <p class="small muted" style="text-align:center;margin:14px 0 0">Best searching for you</p>
  </div></div>`;
}

const NAV = [
  ['home','🏠','Home'], ['policies','📄','Policies'], ['agents','🤝','Agents'],
  ['renewals','🔔','Renewals'], ['customers','👥','Customers'], ['more','⚙️','More']
];
const renewalsDue = () => S.policies.filter(p => { const d = daysLeft(p.expiry_date); return d >= 0 && d <= 30; }).length;

function render(){
  if(!S.user) return;
  const badge = renewalsDue();
  app().innerHTML = `<div class="shell">
    <header class="top"><img src="logo.png" alt="Masani Finsure"><span class="sp"></span>
      ${S.installEvt ? '<button class="btn sm ghost" data-act="install">⬇ Install</button>' : ''}
      <span class="who">${esc(S.user.email || '')}</span></header>
    <nav class="nav">${NAV.map(([id,ic,l]) => `<button data-act="tab" data-id="${id}" class="${S.tab===id?'on':''}"><span class="ic">${ic}</span>${l}${id==='renewals'&&badge?`<span class="badge">${badge}</span>`:''}</button>`).join('')}</nav>
    <main id="main">${S.loaded ? view() : '<div class="empty">Data load ho raha hai…</div>'}</main></div>`;
}
function view(){
  if(S.setupMissing) return `<div class="card"><h3>⚠️ Setup SQL baaki hai</h3><p>Supabase me <b>setup.sql</b> run karna baaki hai (agent / endorsement / claim tables ke liye). Run karke app reload karein.</p><button class="btn" data-act="reload">Dobara check karein</button></div>`;
  switch(S.tab){
    case 'home': return vHome();
    case 'policies': return vPolicies();
    case 'agents': return vAgents();
    case 'renewals': return vRenewals();
    case 'customers': return vCustomers();
    default: return vMore();
  }
}
const keepScroll = fn => { const y = window.scrollY; fn(); window.scrollTo(0, y); };


/* ---------- expiry status & WhatsApp templates ---------- */
const isRenewed = p => p.follow_up_status === 'Renewed';
function statusOf(p){
  const d = daysLeft(p.expiry_date);
  if(isRenewed(p)) return { label: 'Renewed', cls: 'gr' };
  if(d < 0) return { label: `Expired (${-d} din)`, cls: 'rd' };
  if(d === 0) return { label: 'Aaj expire', cls: 'rd' };
  if(d <= 7) return { label: `Urgent: ${d} din`, cls: 'rd' };
  if(d <= 15) return { label: `Upcoming: ${d} din`, cls: 'yl' };
  if(d <= 30) return { label: `Upcoming: ${d} din`, cls: 'yl' };
  return { label: `${d} din baaki`, cls: 'gr' };
}
const open_ = p => !isRenewed(p) && p.follow_up_status !== 'Lost';
const contactPending = p => { const d = daysLeft(p.expiry_date); return open_(p) && d <= 30 && (!p.last_contact_date || (p.next_follow_up_date && p.next_follow_up_date <= today())); };
const REN_FILTERS = {
  due:  ['30 din tak', p => open_(p) && daysLeft(p.expiry_date) >= 0 && daysLeft(p.expiry_date) <= 30],
  today:['Aaj', p => open_(p) && daysLeft(p.expiry_date) === 0],
  d7:   ['1–7 din', p => open_(p) && daysLeft(p.expiry_date) >= 1 && daysLeft(p.expiry_date) <= 7],
  d15:  ['8–15 din', p => open_(p) && daysLeft(p.expiry_date) >= 8 && daysLeft(p.expiry_date) <= 15],
  d30:  ['16–30 din', p => open_(p) && daysLeft(p.expiry_date) >= 16 && daysLeft(p.expiry_date) <= 30],
  d60:  ['31–60 din', p => open_(p) && daysLeft(p.expiry_date) >= 31 && daysLeft(p.expiry_date) <= 60],
  exp:  ['Expired', p => open_(p) && daysLeft(p.expiry_date) < 0],
  fu:   ['Follow-up baaki', contactPending],
  nc:   ['Contact nahi hua', p => open_(p) && !p.last_contact_date && daysLeft(p.expiry_date) <= 60],
  ren:  ['Renewed', isRenewed],
  ni:   ['Not interested', p => p.follow_up_status === 'Lost' || p.call_outcome === 'Not Interested'],
  all:  ['Sab', () => true]
};
const OUTCOMES = ['Connected','No Answer','Busy','Call Back','Not Interested'];
const DEFAULT_TPL = {
  d30: 'Namaste {Customer_Name} ji,\n\nAapki {Policy_Type} insurance policy{Vehicle_Line} (Policy No. {Policy_Number}) ki expiry date {Expiry_Date} hai. Ab 30 din se kam bache hain.\n\nRenewal mein hum madad kar sakte hain. Kripya expiry se pehle sampark karein.\n\n{Business_Name}\nWebsite: {Website}\nContact: {Contact}\n\nDhanyavaad!',
  d15: 'Namaste {Customer_Name} ji,\n\nAapki {Policy_Type} policy{Vehicle_Line} (Policy No. {Policy_Number}) {Expiry_Date} ko expire ho rahi hai — sirf 15 din ya usse kam bache hain.\n\nRenewal ke liye abhi sampark karein, taaki coverage mein gap na aaye.\n\n{Business_Name}\nWebsite: {Website}\nContact: {Contact}\n\nDhanyavaad!',
  d7: 'Namaste {Customer_Name} ji,\n\nZaroori suchna: aapki {Policy_Type} policy{Vehicle_Line} (Policy No. {Policy_Number}) {Expiry_Date} ko expire ho rahi hai — 7 din ya usse kam bache hain.\n\nKripya jald renewal karwayein. Hum poori madad karenge.\n\n{Business_Name}\nWebsite: {Website}\nContact: {Contact}\n\nDhanyavaad!',
  d1: 'Namaste {Customer_Name} ji,\n\nAapki {Policy_Type} policy{Vehicle_Line} (Policy No. {Policy_Number}) kal, {Expiry_Date} ko expire ho rahi hai.\n\nAaj hi renewal karwa lein — hum turant madad ke liye taiyaar hain.\n\n{Business_Name}\nWebsite: {Website}\nContact: {Contact}\n\nDhanyavaad!',
  d0: 'Namaste {Customer_Name} ji,\n\nAapki {Policy_Type} policy{Vehicle_Line} (Policy No. {Policy_Number}) aaj, {Expiry_Date} ko expire ho rahi hai.\n\nKripya aaj hi renewal ke liye sampark karein.\n\n{Business_Name}\nWebsite: {Website}\nContact: {Contact}\n\nDhanyavaad!',
  exp: 'Namaste {Customer_Name} ji,\n\nAapki {Policy_Type} policy{Vehicle_Line} (Policy No. {Policy_Number}) {Expiry_Date} ko expire ho chuki hai.\n\nBina policy ke risk rehta hai. Kripya jald renewal ke liye sampark karein, hum madad karenge.\n\n{Business_Name}\nWebsite: {Website}\nContact: {Contact}\n\nDhanyavaad!'
};
const TPL_LABEL = { d30: '30 din', d15: '15 din', d7: '7 din', d1: 'Kal expire', d0: 'Aaj expire', exp: 'Expired policy' };
const cfg = () => Object.assign({ business_name: 'Masani Finsure', website: '', phone: '', email: '', address: '', phones: [] }, (S.settings || {}));
const tplOf = k => (S.settings && S.settings.templates && S.settings.templates[k]) || DEFAULT_TPL[k];
function tplKey(p){ const d = daysLeft(p.expiry_date); return d < 0 ? 'exp' : d === 0 ? 'd0' : d === 1 ? 'd1' : d <= 7 ? 'd7' : d <= 15 ? 'd15' : 'd30'; }
function fillTpl(t, p, contact){
  const c = cfg();
  const map = { Customer_Name: p.customer_name, Policy_Type: p.policy_type, Policy_Number: p.policy_number, Expiry_Date: fdate(p.expiry_date),
    Vehicle_Number: p.vehicle_reg || '', Vehicle_Line: p.vehicle_reg ? ` (Gaadi no. ${p.vehicle_reg})` : '', Insurer: p.insurer_name,
    Business_Name: c.business_name, Website: c.website || '', Contact: contact || c.phone || '' };
  let out = t.replace(/\{(\w+)\}/g, (m, k) => (k in map ? map[k] : m));
  if(!c.website) out = out.replace(/^Website:.*\n?/m, '');
  if(!(contact || c.phone)) out = out.replace(/^Contact:.*\n?/m, '');
  return out.replace(/\n{3,}/g, '\n\n').trim();
}

/* ---------- HOME ---------- */
function vHome(){
  const P = S.policies, act = P.filter(isActive);
  const ym = today().slice(0,7);
  const month = P.filter(p => (p.issue_date || p.start_date || '').slice(0,7) === ym);
  const sum = (arr, f) => arr.reduce((s,p) => s + num(p[f]), 0);
  const myComm = sum(P,'total_expected_commission'), recv = sum(P,'actual_commission_received');
  const agComm = sum(P,'agent_commission'), agPaid = S.payments.reduce((s,x) => s + num(x.amount), 0);
  const due = P.filter(p => { const d = daysLeft(p.expiry_date); return d >= 0 && d <= 30; }).sort((a,b) => a.expiry_date.localeCompare(b.expiry_date));
  const recent = [...P].sort((a,b) => (b.created_at||'').localeCompare(a.created_at||'')).slice(0,5);
  const months = {};
  P.forEach(p => { const k = (p.issue_date || p.start_date || '').slice(0,7); if(!k) return; (months[k] ||= { n:0, prem:0, my:0, ag:0 }); const m = months[k]; m.n++; m.prem += num(p.total_premium); m.my += num(p.total_expected_commission); m.ag += num(p.agent_commission); });
  const mk = Object.keys(months).sort().reverse().slice(0,6);
  return `<div class="pt"><h2>Namaste 👋</h2><button class="btn" data-act="newpol">＋ Nayi Policy</button></div>
  <div class="grid g2 g4">
    <div class="stat"><div class="n">${act.length}</div><div class="l">Active policies (kul ${P.length}, customers ${S.customers.length})</div></div>
    <div class="stat"><div class="n">${due.length}</div><div class="l">30 din me renewal</div></div>
    <div class="stat"><div class="n">${inr(sum(month,'total_premium'))}</div><div class="l">Is mahine ka premium (${month.length})</div></div>
    <div class="stat dark"><div class="n">${inr(sum(P,'total_premium'))}</div><div class="l">Kul premium</div></div>
    <div class="stat"><div class="n">${inr(myComm)}</div><div class="l">Aapka commission (banta)</div></div>
    <div class="stat"><div class="n">${inr(myComm - recv)}</div><div class="l">Company se aana baaki</div></div>
    <div class="stat"><div class="n">${inr(agComm - agPaid)}</div><div class="l">Agents ko dena baaki</div></div>
    <div class="stat dark"><div class="n">${inr(myComm - agComm)}</div><div class="l">Aapka net munafa</div></div>
  </div>
  <div class="card" style="margin-top:12px"><h3>📅 Expiry tracker <span class="muted small">(tap karke list dekhein)</span></h3><div class="grid g2 g4">
    ${[['exp','Expired'],['today','Aaj expire'],['d7','1–7 din'],['d15','8–15 din'],['d30','16–30 din'],['d60','31–60 din'],['ren','Renewed'],['fu','Follow-up baaki']].map(([k,l]) => `<div class="item" data-act="rb" data-id="${k}" style="margin:0;text-align:center;padding:10px 6px"><div class="n" style="font-size:22px;font-weight:800;color:var(--or)">${P.filter(REN_FILTERS[k][1]).length}</div><div class="small muted">${l}</div></div>`).join('')}</div></div>
  <div class="card"><h3>🔔 Jaldi khatam hone wali policies</h3>
    ${due.length ? due.slice(0,6).map(polItem).join('') : '<div class="empty">Agle 30 din me koi renewal nahi 🎉</div>'}
    ${due.length > 6 ? '<button class="btn ghost sm" data-act="tab" data-id="renewals">Sab dekhein</button>' : ''}</div>
  <div class="card"><h3>🆕 Haal ki policies</h3>${recent.length ? recent.map(polItem).join('') : '<div class="empty">Abhi koi policy nahi. “Nayi Policy” se shuru karein.</div>'}</div>
  ${mk.length ? `<div class="card"><h3>📊 Mahine-wise</h3><div style="overflow:auto"><table style="width:100%;border-collapse:collapse;font-size:13px">
    <tr class="muted"><th align="left">Mahina</th><th align="right">Policy</th><th align="right">Premium</th><th align="right">Aapka</th><th align="right">Agent</th><th align="right">Munafa</th></tr>
    ${mk.map(k => { const m = months[k]; return `<tr style="border-top:1px solid var(--line)"><td>${k.slice(5)}-${k.slice(0,4)}</td><td align="right">${m.n}</td><td align="right">${inr(m.prem)}</td><td align="right">${inr(m.my)}</td><td align="right">${inr(m.ag)}</td><td align="right" class="b">${inr(m.my - m.ag)}</td></tr>`; }).join('')}
  </table></div></div>` : ''}`;
}

function polItem(p){
  const d = daysLeft(p.expiry_date), ag = agentById(p.sub_agent_id);
  const st = statusOf(p), tag = `<span class="tag ${st.cls}">${esc(st.label)}</span>`;
  return `<div class="item" data-act="pol" data-id="${p.id}">
    <div class="row between"><span class="t">${esc(p.customer_name)}</span>${tag}</div>
    <div class="s">${esc(p.insurer_name)} • ${esc(p.policy_type)}${p.vehicle_reg ? ' • ' + esc(p.vehicle_reg) : ''}</div>
    <div class="s">${esc(p.policy_number)} • ${fdate(p.start_date)} → ${fdate(p.expiry_date)}</div>
    <div class="row between s"><span>Premium <b class="money">${inr(p.total_premium)}</b></span>${ag ? `<span class="tag or">🤝 ${esc(ag.name)}</span>` : '<span class="tag">Direct</span>'}</div></div>`;
}

/* ---------- POLICIES ---------- */
function filteredPolicies(){
  const f = S.fPol, t = f.text.trim().toLowerCase();
  return S.policies.filter(p => {
    if(f.type !== 'all' && p.policy_type !== f.type) return false;
    if(f.agent === 'direct' && p.sub_agent_id) return false;
    if(f.agent !== 'all' && f.agent !== 'direct' && p.sub_agent_id !== f.agent) return false;
    if(!t) return true;
    return [p.customer_name, p.customer_mobile, p.policy_number, p.vehicle_reg, p.insurer_name].some(x => String(x || '').toLowerCase().includes(t));
  }).sort((a,b) => (b.created_at || '').localeCompare(a.created_at || ''));
}
function vPolicies(){
  const list = filteredPolicies();
  return `<div class="pt"><h2>Policies <span class="muted small">(${list.length})</span></h2><button class="btn" data-act="newpol">＋ Nayi</button></div>
  <div class="search"><input id="polSearch" placeholder="Naam / mobile / policy no / gaadi no. khojein" value="${esc(S.fPol.text)}"></div>
  <div class="chips">${['all', ...TYPES].map(t => `<button class="chip ${S.fPol.type===t?'on':''}" data-act="ftype" data-id="${t}">${t==='all'?'Sab':t}</button>`).join('')}</div>
  <div class="row" style="margin-bottom:10px"><select id="polAgent"><option value="all">Sab agents</option><option value="direct" ${S.fPol.agent==='direct'?'selected':''}>Direct (bina agent)</option>${S.agents.map(a => `<option value="${a.id}" ${S.fPol.agent===a.id?'selected':''}>${esc(a.name)}</option>`).join('')}</select></div>
  <div id="polList">${list.length ? list.map(polItem).join('') : '<div class="empty">Koi policy nahi mili.</div>'}</div>`;
}

function policyForm(p){
  p = p || {};
  const ag = S.agents.filter(a => a.active !== false || a.id === p.sub_agent_id);
  const base = num(p.net_premium);
  const agPct = base && p.agent_commission ? Math.round(num(p.agent_commission) / base * 10000) / 100 : '';
  const myPct = base && p.total_expected_commission ? Math.round(num(p.total_expected_commission) / base * 10000) / 100 : '';
  return `<form data-form="policy" data-id="${p.id || ''}">
  <div class="sec">Customer</div>
  <div class="grid g2"><div class="f"><label>Naam *</label><input name="customer_name" required value="${esc(p.customer_name)}"></div>
  <div class="f"><label>Mobile *</label><input name="customer_mobile" required inputmode="numeric" maxlength="12" value="${esc(p.customer_mobile)}"></div></div>
  <div class="f"><label>Email</label><input name="customer_email" type="email" value="${esc(p.customer_email)}"></div>
  <div class="sec">Policy</div>
  <div class="grid g2"><div class="f"><label>Policy number *</label><input name="policy_number" required value="${esc(p.policy_number)}"></div>
  <div class="f"><label>Purani policy number</label><input name="previous_policy_number" value="${esc(p.previous_policy_number)}"></div></div>
  <div class="grid g2"><div class="f"><label>Company *</label><input name="insurer_name" list="insl" required value="${esc(p.insurer_name)}"><datalist id="insl">${INSURERS.map(i => `<option>${i}</option>`).join('')}</datalist></div>
  <div class="f"><label>Type *</label><select name="policy_type">${TYPES.map(t => `<option ${p.policy_type===t?'selected':''}>${t}</option>`).join('')}</select></div></div>
  <div class="grid g2"><div class="f"><label>Gaadi category</label><select name="vehicle_category"><option value="">—</option>${VCATS.map(t => `<option ${p.vehicle_category===t?'selected':''}>${t}</option>`).join('')}</select></div>
  <div class="f"><label>Gaadi no. (RC)</label><input name="vehicle_reg" style="text-transform:uppercase" value="${esc(p.vehicle_reg)}" placeholder="MP04AB1234"></div></div>
  <div class="f"><label>Gaadi / policy ki detail (make, model, year, fuel)</label><input name="vehicle_desc" value="${esc(p.vehicle_desc)}"></div>
  <div class="grid g3"><div class="f"><label>Issue date</label><input name="issue_date" type="date" value="${esc(p.issue_date || (p.id ? '' : today()))}"></div>
  <div class="f"><label>Start *</label><input name="start_date" type="date" required value="${esc(p.start_date || today())}"></div>
  <div class="f"><label>Expiry *</label><input name="expiry_date" type="date" required value="${esc(p.expiry_date || addYear(today()))}" data-touched="${p.id ? 1 : 0}"></div></div>
  <div class="sec">Premium</div>
  <div class="grid g3"><div class="f"><label>Net premium ₹ *</label><input name="net_premium" required inputmode="decimal" value="${p.net_premium ?? ''}"></div>
  <div class="f"><label>GST %</label><input name="gst_rate" inputmode="decimal" value="${p.gst_rate ?? 18}"></div>
  <div class="f"><label>Total ₹ *</label><input name="total_premium" required inputmode="decimal" value="${p.total_premium ?? ''}"></div></div>
  <div class="sec">Commission</div>
  <div class="grid g3"><div class="f"><label>Aapka % (net par)</label><input name="my_pct" inputmode="decimal" value="${myPct}"></div>
  <div class="f"><label>Aapka commission ₹</label><input name="total_expected_commission" inputmode="decimal" value="${p.total_expected_commission ?? ''}"></div>
  <div class="f"><label>Company se mila ₹</label><input name="actual_commission_received" inputmode="decimal" value="${p.actual_commission_received ?? ''}"></div></div>
  <div class="sec">🤝 Agent</div>
  <div class="f"><label>Kis agent ka case hai?</label><select name="sub_agent_id"><option value="">Direct (mera apna)</option>${ag.map(a => `<option value="${a.id}" data-pct="${num(a.default_commission_pct)}" ${p.sub_agent_id===a.id?'selected':''}>${esc(a.name)}${a.city ? ' — ' + esc(a.city) : ''}</option>`).join('')}</select></div>
  <div class="grid g2"><div class="f"><label>Agent % (net par)</label><input name="agent_pct" inputmode="decimal" value="${agPct}"></div>
  <div class="f"><label>Agent ko commission ₹</label><input name="agent_commission" inputmode="decimal" value="${p.agent_commission ?? ''}"></div></div>
  <div class="info" id="profitLine" style="display:none"></div>
  <div class="f"><label>Notes</label><textarea name="calculation_notes">${esc(p.calculation_notes)}</textarea></div>
  <div class="f"><label>Policy PDF / photo ${p.pdf_file_name ? '(naya dene par purani badal jayegi)' : ''}</label><input name="file" type="file" accept="application/pdf,image/*"></div>
  <button class="btn full" id="savePol">${p.id ? 'Save badlav' : 'Policy save karein'}</button></form>`;
}
function policyCalc(form, changed){
  const g = n => form.elements[n];
  const net = num(g('net_premium').value), gst = num(g('gst_rate').value);
  if(['net_premium','gst_rate'].includes(changed)) g('total_premium').value = net ? (Math.round(net * (1 + gst/100) * 100) / 100) : '';
  if(changed === 'my_pct') g('total_expected_commission').value = Math.round(net * num(g('my_pct').value)) / 100;
  if(changed === 'agent_pct') g('agent_commission').value = Math.round(net * num(g('agent_pct').value)) / 100;
  if(['net_premium'].includes(changed)){
    if(g('my_pct').value) g('total_expected_commission').value = Math.round(net * num(g('my_pct').value)) / 100;
    if(g('agent_pct').value) g('agent_commission').value = Math.round(net * num(g('agent_pct').value)) / 100;
  }
  if(changed === 'sub_agent_id'){
    const opt = g('sub_agent_id').selectedOptions[0], pct = opt ? num(opt.dataset.pct) : 0;
    if(!g('sub_agent_id').value){ g('agent_pct').value = ''; g('agent_commission').value = ''; }
    else if(pct && !num(g('agent_commission').value)){ g('agent_pct').value = pct; g('agent_commission').value = Math.round(net * pct) / 100; }
  }
  if(changed === 'start_date' && g('expiry_date').dataset.touched !== '1') g('expiry_date').value = addYear(g('start_date').value);
  if(changed === 'expiry_date') g('expiry_date').dataset.touched = '1';
  const my = num(g('total_expected_commission').value), agc = num(g('agent_commission').value), pl = $('#profitLine');
  if(pl){ if(my || agc){ pl.style.display = ''; pl.innerHTML = `Aapka commission <b>${inr(my)}</b> − Agent <b>${inr(agc)}</b> = <b>Munafa ${inr(my - agc)}</b>`; } else pl.style.display = 'none'; }
}

async function savePolicy(form){
  const f = form.elements, id = form.dataset.id, btn = $('#savePol');
  const v = n => (f[n] ? f[n].value.trim() : '');
  const mobile = tenDigits(v('customer_mobile'));
  if(mobile.length !== 10) return toast('Mobile 10 digit ka hona chahiye', 'error');
  const net = num(v('net_premium')), total = num(v('total_premium'));
  if(v('expiry_date') < v('start_date')) return toast('Expiry date start se pehle nahi ho sakti', 'error');
  btn.disabled = true; btn.textContent = 'Save ho raha hai…';
  try {
    // customer (mobile se dhundho, na mile to banao)
    let cust = S.customers.find(c => tenDigits(c.mobile) === mobile);
    if(!cust){
      cust = await q(S.sb.from('customers').insert({ name: v('customer_name'), mobile, email: v('customer_email') || null }).select().single());
      S.customers.push(cust);
    }
    const exp = num(v('total_expected_commission')), got = num(v('actual_commission_received'));
    const row = {
      policy_number: v('policy_number'), previous_policy_number: v('previous_policy_number') || null,
      insurer_name: v('insurer_name'), policy_type: v('policy_type'), vehicle_category: v('vehicle_category') || null,
      vehicle_reg: v('vehicle_reg').toUpperCase().replace(/\s+/g,'') || null, vehicle_desc: v('vehicle_desc') || null,
      customer_id: cust.id, customer_name: v('customer_name'), customer_mobile: mobile, customer_email: v('customer_email') || null,
      issue_date: v('issue_date') || null, start_date: v('start_date'), expiry_date: v('expiry_date'),
      net_premium: net, gst_rate: num(v('gst_rate')), gst_amount: Math.round((total - net) * 100) / 100, total_premium: total,
      commission_mode: 'NET_PREMIUM', total_expected_commission: exp, actual_commission_received: got, commission_pending: exp - got,
      sub_agent_id: v('sub_agent_id') || null, agent_commission: v('sub_agent_id') ? num(v('agent_commission')) : 0,
      calculation_notes: v('calculation_notes') || null, updated_at: new Date().toISOString()
    };
    let saved;
    if(id) saved = await q(S.sb.from('policies').update(row).eq('id', id).select().single());
    else saved = await q(S.sb.from('policies').insert(row).select().single());
    const file = f.file && f.file.files[0];
    if(file){
      const up = await upload(file, 'policies/' + saved.id);
      if(id && policyById(id)?.pdf_storage_path) await removeFile(policyById(id).pdf_storage_path);
      saved = await q(S.sb.from('policies').update({ pdf_file_name: up.name, pdf_storage_path: up.path }).eq('id', saved.id).select().single());
    }
    await loadAll(true);
    closeSheet(); toast(id ? 'Policy update ho gayi' : 'Policy save ho gayi ✔', 'ok'); render();
    if(!id) openPolicy(saved.id);
  } catch(e) {
    const m = errMsg(e);
    toast(/duplicate|unique/i.test(m) ? 'Ye policy number pehle se hai' : 'Save nahi hua: ' + m, 'error');
    btn.disabled = false; btn.textContent = id ? 'Save badlav' : 'Policy save karein';
  }
}

/* ---------- sheet ---------- */
function openSheet(title, html){
  closeSheet();
  const ov = document.createElement('div'); ov.className = 'ov'; ov.id = 'ov';
  ov.innerHTML = `<div class="sheet" role="dialog" aria-modal="true"><div class="hd"><h3>${esc(title)}</h3><button class="x" data-act="close" aria-label="Band">✕</button></div><div id="sheetBody">${html}</div></div>`;
  ov.addEventListener('mousedown', e => { if(e.target === ov) closeSheet(); });
  document.body.appendChild(ov); document.body.style.overflow = 'hidden';
}
function closeSheet(){ const o = $('#ov'); if(o) o.remove(); document.body.style.overflow = ''; S.sheet = null; }
const setSheet = html => { const b = $('#sheetBody'); if(b) b.innerHTML = html; };

/* ---------- policy detail ---------- */
function openPolicy(id, tab){
  const p = policyById(id); if(!p) return;
  openSheet(p.customer_name, '');
  S.sheet = { kind: 'policy', id, tab: tab || 'info' };
  renderPolicySheet();
}
async function renderPolicySheet(){
  const sh = S.sheet; if(!sh || sh.kind !== 'policy') return;
  const p = policyById(sh.id); if(!p) return closeSheet();
  const ag = agentById(p.sub_agent_id), d = daysLeft(p.expiry_date);
  const paid = policyPaid(p.id), due = num(p.agent_commission);
  let body = `<div class="card"><div class="row between wrap"><div><div class="b">${esc(p.policy_number)}</div><div class="small muted">${esc(p.insurer_name)} • ${esc(p.policy_type)}${p.vehicle_category ? ' • ' + esc(p.vehicle_category) : ''}</div></div>
    <span class="tag ${statusOf(p).cls}">${esc(statusOf(p).label)}</span></div>
    <div class="s muted small" style="margin-top:4px">Aakhri contact: ${p.last_contact_date ? fdate(p.last_contact_date) : 'nahi hua'}${p.call_outcome ? ' (' + esc(p.call_outcome) + ')' : ''} • ${esc(p.follow_up_status || 'Pending')}${p.next_follow_up_date ? ' • agla: ' + fdate(p.next_follow_up_date) : ''}</div>
    <div class="row wrap" style="margin-top:10px"><a class="btn sm ghost" href="tel:${tenDigits(p.customer_mobile)}">📞 Call</a><button class="btn sm wa" data-act="wa" data-id="${p.id}">💬 WhatsApp</button><button class="btn sm ghost" data-act="contact" data-id="${p.id}">📝 Follow-up</button>${isRenewed(p) ? '' : `<button class="btn sm ghost" data-act="renewed" data-id="${p.id}">✅ Renewed</button>`}
    <button class="btn sm ghost" data-act="editpol" data-id="${p.id}">✏️ Edit</button><button class="btn sm red" data-act="delpol" data-id="${p.id}">🗑</button></div></div>
    <div class="tabs">${[['info','Detail'],['endo','Endorsement'],['claim','Claim'],['svc','Service']].map(([k,l]) => `<button data-act="ptab" data-id="${k}" class="${sh.tab===k?'on':''}">${l}</button>`).join('')}</div>`;
  if(sh.tab === 'info'){
    body += `<div class="card"><div class="kv"><span>Mobile</span><span>${esc(p.customer_mobile)}</span>
      ${p.vehicle_reg ? `<span>Gaadi no.</span><span>${esc(p.vehicle_reg)}</span>` : ''}${p.vehicle_desc ? `<span>Detail</span><span>${esc(p.vehicle_desc)}</span>` : ''}
      <span>Period</span><span>${fdate(p.start_date)} → ${fdate(p.expiry_date)}</span>
      ${p.previous_policy_number ? `<span>Purani policy</span><span>${esc(p.previous_policy_number)}</span>` : ''}
      <span>Net premium</span><span class="money">${inr(p.net_premium)}</span><span>GST (${num(p.gst_rate)}%)</span><span class="money">${inr(p.gst_amount)}</span><span>Total premium</span><span class="money">${inr(p.total_premium)}</span></div></div>
    <div class="card"><h3>💰 Commission</h3><div class="kv"><span>Aapka commission</span><span class="money">${inr(p.total_expected_commission)}</span><span>Company se mila</span><span class="money">${inr(p.actual_commission_received)}</span><span>Company se baaki</span><span class="money ${num(p.commission_pending)>0?'warn':''}">${inr(p.commission_pending)}</span></div></div>
    <div class="card"><h3>🤝 Agent</h3>${ag ? `<div class="kv"><span>Agent</span><span>${esc(ag.name)}</span><span>Banta commission</span><span class="money">${inr(due)}</span><span>Diya gaya</span><span class="money ok">${inr(paid)}</span><span>Dena baaki</span><span class="money ${due-paid>0?'bad':''}">${inr(due - paid)}</span><span>Aapka munafa</span><span class="money b">${inr(num(p.total_expected_commission) - due)}</span></div>
      <div class="row wrap" style="margin-top:10px"><button class="btn sm" data-act="paypol" data-id="${p.id}">＋ Commission diya</button><button class="btn sm ghost" data-act="agent" data-id="${ag.id}">Agent dekhein</button></div>` : '<span class="muted">Direct policy — koi agent nahi.</span>'}</div>
    <div class="card"><h3>📎 Policy file</h3>${p.pdf_storage_path ? `<div class="file-row"><span class="sp1">📄 ${esc(p.pdf_file_name || 'policy')}</span><button class="btn sm" data-act="openfile" data-path="${esc(p.pdf_storage_path)}">Kholein</button></div>` : '<span class="muted">Koi file upload nahi. Edit me jaakar PDF jodein.</span>'}</div>
    ${p.calculation_notes ? `<div class="card"><h3>📝 Notes</h3>${esc(p.calculation_notes)}</div>` : ''}`;
    setSheet(body); return;
  }
  setSheet(body + '<div class="empty">Load ho raha hai…</div>');
  const table = { endo: 'endorsements', claim: 'claims', svc: 'service_records' }[sh.tab];
  let rows = [];
  try { rows = await q(S.sb.from(table).select('*').eq('policy_id', p.id).order('created_at', { ascending: false })); }
  catch(e){ setSheet(body + `<div class="err">Load nahi hua: ${esc(errMsg(e))}<br>setup.sql run kiya hai?</div>`); return; }
  if(!S.sheet || S.sheet.id !== p.id || S.sheet.tab !== sh.tab) return;
  let h = '';
  if(sh.tab === 'endo'){
    h = `<form class="card" data-form="endo" data-id="${p.id}"><h3>＋ Naya endorsement</h3>
      <div class="grid g2"><div class="f"><label>Type</label><select name="etype">${ENDO_TYPES.map(t => `<option>${t}</option>`).join('')}</select></div><div class="f"><label>Date</label><input type="date" name="endorsement_date" value="${today()}"></div></div>
      <div class="f"><label>Detail (kya badla)</label><textarea name="description"></textarea></div>
      <div class="grid g2"><div class="f"><label>Charge / premium ₹</label><input name="charge" inputmode="decimal"></div><div class="f"><label>Endorsement PDF / photo</label><input type="file" name="file" accept="application/pdf,image/*"></div></div>
      <button class="btn full">Save endorsement</button></form>
      ${rows.length ? rows.map(r => `<div class="item" style="cursor:default"><div class="row between"><span class="t">${esc(r.etype || 'Endorsement')}</span><span class="small muted">${fdate(r.endorsement_date)}</span></div>
        ${r.description ? `<div class="s">${esc(r.description)}</div>` : ''}${num(r.charge) ? `<div class="s">Charge: <b>${inr(r.charge)}</b></div>` : ''}
        <div class="row wrap" style="margin-top:6px">${r.file_path ? `<button class="btn sm" data-act="openfile" data-path="${esc(r.file_path)}">📄 ${esc((r.file_name || 'File').slice(0,24))}</button>` : ''}<button class="btn sm red" data-act="delrow" data-table="endorsements" data-id="${r.id}" data-path="${esc(r.file_path || '')}">Hatao</button></div></div>`).join('') : '<div class="empty">Abhi koi endorsement nahi.</div>'}`;
  } else if(sh.tab === 'claim'){
    h = `<form class="card" data-form="claim" data-id="${p.id}"><h3>＋ Naya claim</h3>
      <div class="grid g2"><div class="f"><label>Claim number</label><input name="claim_number"></div><div class="f"><label>Date</label><input type="date" name="claim_date" value="${today()}"></div></div>
      <div class="grid g2"><div class="f"><label>Claim amount ₹</label><input name="amount_claimed" inputmode="decimal"></div><div class="f"><label>Status</label><select name="status">${CLAIM_ST.map(t => `<option>${t}</option>`).join('')}</select></div></div>
      <div class="f"><label>Detail (kya hua)</label><textarea name="description"></textarea></div>
      <div class="f"><label>Claim file / photo</label><input type="file" name="file" accept="application/pdf,image/*"></div>
      <button class="btn full">Save claim</button></form>
      ${rows.length ? rows.map(r => `<div class="item" style="cursor:default" data-claim="${r.id}"><div class="row between"><span class="t">Claim ${esc(r.claim_number || '')}</span><span class="small muted">${fdate(r.claim_date)}</span></div>
        ${r.description ? `<div class="s">${esc(r.description)}</div>` : ''}<div class="s">Claim: <b>${inr(r.amount_claimed)}</b> • Settle: <b>${inr(r.amount_settled)}</b></div>
        <div class="grid g2" style="margin-top:6px"><select data-f="status">${CLAIM_ST.map(t => `<option ${r.status===t?'selected':''}>${t}</option>`).join('')}</select><input data-f="settled" inputmode="decimal" placeholder="Settle ₹" value="${num(r.amount_settled) || ''}"></div>
        <div class="row wrap" style="margin-top:6px"><button class="btn sm" data-act="claimupd" data-id="${r.id}">Update</button>${r.file_path ? `<button class="btn sm ghost" data-act="openfile" data-path="${esc(r.file_path)}">📄 File</button>` : ''}<button class="btn sm red" data-act="delrow" data-table="claims" data-id="${r.id}" data-path="${esc(r.file_path || '')}">Hatao</button></div></div>`).join('') : '<div class="empty">Abhi koi claim nahi.</div>'}`;
  } else {
    h = `<form class="card" data-form="svc" data-id="${p.id}"><h3>＋ Service note</h3><div class="f"><label>Date</label><input type="date" name="service_date" value="${today()}"></div>
      <div class="f"><label>Kya service di (renewal call, documents, claim help…)</label><textarea name="note" required></textarea></div><button class="btn full">Save</button></form>
      ${rows.length ? rows.map(r => `<div class="item" style="cursor:default"><div class="row between"><span class="small muted">${fdate(r.service_date)}</span><button class="btn sm red" data-act="delrow" data-table="service_records" data-id="${r.id}">Hatao</button></div><div>${esc(r.note)}</div></div>`).join('') : '<div class="empty">Abhi koi service note nahi.</div>'}`;
  }
  setSheet(body + h);
}

async function saveChild(form, kind){
  const f = form.elements, pid = form.dataset.id, btn = form.querySelector('button.btn'); btn.disabled = true;
  try {
    const file = f.file && f.file.files[0]; let up = null;
    if(file) up = await upload(file, `${kind}/${pid}`);
    if(kind === 'endorsements') await q(S.sb.from('endorsements').insert({ policy_id: pid, etype: f.etype.value, endorsement_date: f.endorsement_date.value || today(), description: f.description.value.trim() || null, charge: num(f.charge.value), file_name: up?.name || null, file_path: up?.path || null }));
    if(kind === 'claims') await q(S.sb.from('claims').insert({ policy_id: pid, claim_number: f.claim_number.value.trim() || null, claim_date: f.claim_date.value || today(), status: f.status.value, amount_claimed: num(f.amount_claimed.value), description: f.description.value.trim() || null, file_name: up?.name || null, file_path: up?.path || null }));
    if(kind === 'service_records') await q(S.sb.from('service_records').insert({ policy_id: pid, service_date: f.service_date.value || today(), note: f.note.value.trim() }));
    toast('Save ho gaya ✔', 'ok'); renderPolicySheet();
  } catch(e){ toast('Save nahi hua: ' + errMsg(e), 'error'); btn.disabled = false; }
}

/* ---------- AGENTS ---------- */
function vAgents(){
  const t = S.fAgent.trim().toLowerCase();
  const list = S.agents.filter(a => !t || (a.name + ' ' + (a.mobile || '') + ' ' + (a.city || '')).toLowerCase().includes(t));
  const tot = S.agents.reduce((s,a) => { const x = agentStats(a.id); s.due += x.due; s.paid += x.paid; return s; }, { due: 0, paid: 0 });
  return `<div class="pt"><h2>Agents <span class="muted small">(${list.length})</span></h2><button class="btn" data-act="newagent">＋ Naya Agent</button></div>
  <div class="grid g3" style="margin-bottom:10px"><div class="stat"><div class="n">${inr(tot.due)}</div><div class="l">Kul banta</div></div><div class="stat"><div class="n">${inr(tot.paid)}</div><div class="l">Diya gaya</div></div><div class="stat dark"><div class="n">${inr(tot.due - tot.paid)}</div><div class="l">Dena baaki</div></div></div>
  <div class="search"><input id="agSearch" placeholder="Agent khojein" value="${esc(S.fAgent)}"></div>
  <div id="agList">${list.length ? list.map(agentItem).join('') : '<div class="empty">Abhi koi agent nahi. “Naya Agent” se jodein.</div>'}</div>`;
}
function agentItem(a){
  const x = agentStats(a.id);
  const pct = x.due ? Math.min(100, Math.round(x.paid / x.due * 100)) : 0;
  return `<div class="item" data-act="agent" data-id="${a.id}"><div class="row between"><span class="t">🤝 ${esc(a.name)}</span>${a.active === false ? '<span class="tag">Band</span>' : `<span class="tag or">${x.count} policy</span>`}</div>
    <div class="s">${esc(a.mobile || '')}${a.city ? ' • ' + esc(a.city) : ''}</div>
    <div class="row between s" style="margin-top:6px"><span>Banta <b>${inr(x.due)}</b></span><span>Diya <b class="ok">${inr(x.paid)}</b></span><span>Baaki <b class="${x.bal>0?'bad':''}">${inr(x.bal)}</b></span></div>
    <div class="progress" style="margin-top:6px"><i style="width:${pct}%"></i></div></div>`;
}
function agentForm(a){
  a = a || {};
  return `<form data-form="agent" data-id="${a.id || ''}">
    <div class="f"><label>Agent ka naam *</label><input name="name" required value="${esc(a.name)}"></div>
    <div class="grid g2"><div class="f"><label>Mobile</label><input name="mobile" inputmode="numeric" value="${esc(a.mobile)}"></div><div class="f"><label>Shehar</label><input name="city" value="${esc(a.city)}"></div></div>
    <div class="f"><label>Usual commission % (net premium par)</label><input name="default_commission_pct" inputmode="decimal" value="${a.default_commission_pct ?? ''}"><div class="small muted">Policy me agent chunte hi ye % apne aap bhar jayega (badal sakte hain).</div></div>
    <div class="f"><label>Notes</label><textarea name="notes">${esc(a.notes)}</textarea></div>
    ${a.id ? `<div class="f"><label><input type="checkbox" name="active" style="width:auto" ${a.active !== false ? 'checked' : ''}> Active agent</label></div>` : ''}
    <button class="btn full">${a.id ? 'Save' : 'Agent jodein'}</button></form>`;
}
function openAgent(id, tab){
  if(!agentById(id)) return;
  openSheet(agentById(id).name, ''); S.sheet = { kind: 'agent', id, tab: tab || 'pol' }; renderAgentSheet();
}
function agentStatement(a){
  const x = agentStats(a.id), pays = S.payments.filter(p => p.agent_id === a.id);
  let t = `*Masani Finsure — Agent Statement*\nAgent: ${a.name}\nDate: ${fdate(today())}\n\nKul policy: ${x.count}\nKul net premium: ${inr(x.premium)}\nBanta commission: ${inr(x.due)}\nDiya gaya: ${inr(x.paid)}\n*Baaki: ${inr(x.bal)}*\n`;
  if(x.pols.length) t += '\n*Policies*\n' + x.pols.map(p => `• ${fdate(p.start_date)} ${p.customer_name} (${p.policy_number}) — ${inr(p.agent_commission)}`).join('\n');
  if(pays.length) t += '\n\n*Payments*\n' + pays.map(p => `• ${fdate(p.paid_on)} ${inr(p.amount)}${p.mode ? ' (' + p.mode + ')' : ''}${p.note ? ' - ' + p.note : ''}`).join('\n');
  return t;
}
function renderAgentSheet(){
  const sh = S.sheet; if(!sh || sh.kind !== 'agent') return;
  const a = agentById(sh.id); if(!a) return closeSheet();
  const x = agentStats(a.id), pays = S.payments.filter(p => p.agent_id === a.id);
  let h = `<div class="card"><div class="muted small">${esc(a.mobile || '')}${a.city ? ' • ' + esc(a.city) : ''}${num(a.default_commission_pct) ? ' • usual ' + num(a.default_commission_pct) + '%' : ''}</div>
    <div class="grid g3" style="margin-top:8px"><div class="stat"><div class="n">${inr(x.due)}</div><div class="l">Banta</div></div><div class="stat"><div class="n ok">${inr(x.paid)}</div><div class="l">Diya</div></div><div class="stat dark"><div class="n">${inr(x.bal)}</div><div class="l">Baaki</div></div></div>
    <div class="row wrap" style="margin-top:10px"><button class="btn sm" data-act="payagent" data-id="${a.id}">＋ Payment diya</button>
      <a class="btn sm wa" target="_blank" rel="noopener" href="${waLink(a.mobile, agentStatement(a))}">💬 Statement bhejein</a>
      ${a.mobile ? `<a class="btn sm ghost" href="tel:${tenDigits(a.mobile)}">📞</a>` : ''}
      <button class="btn sm ghost" data-act="editagent" data-id="${a.id}">✏️ Edit</button><button class="btn sm red" data-act="delagent" data-id="${a.id}">🗑</button></div></div>
    <div class="tabs"><button data-act="atab" data-id="pol" class="${sh.tab==='pol'?'on':''}">Policies (${x.count})</button><button data-act="atab" data-id="pay" class="${sh.tab==='pay'?'on':''}">Payments (${pays.length})</button></div>`;
  if(sh.tab === 'pol'){
    h += x.pols.length ? x.pols.map(p => `<div class="item" data-act="pol" data-id="${p.id}"><div class="row between"><span class="t">${esc(p.customer_name)}</span><span class="small muted">${fdate(p.start_date)}</span></div><div class="s">${esc(p.insurer_name)} • ${esc(p.policy_number)}</div>
      <div class="row between s"><span>Commission <b>${inr(p.agent_commission)}</b></span><span>Diya <b class="ok">${inr(policyPaid(p.id))}</b></span></div></div>`).join('') : '<div class="empty">Is agent ki koi policy nahi.</div>';
  } else {
    h += pays.length ? pays.map(p => { const pol = policyById(p.policy_id); return `<div class="item" style="cursor:default"><div class="row between"><span class="t money ok">${inr(p.amount)}</span><span class="small muted">${fdate(p.paid_on)}</span></div>
      <div class="s">${esc(p.mode || '')}${pol ? ' • ' + esc(pol.customer_name) + ' (' + esc(pol.policy_number) + ')' : ' • General'}${p.note ? ' • ' + esc(p.note) : ''}</div>
      <div style="margin-top:6px"><button class="btn sm red" data-act="delpay" data-id="${p.id}">Hatao</button></div></div>`; }).join('') : '<div class="empty">Abhi koi payment record nahi.</div>';
  }
  setSheet(h);
}
function payForm(agentId, policyId){
  const a = agentById(agentId), pols = agentStats(agentId).pols;
  let def = '';
  if(policyId){ const p = policyById(policyId); def = Math.max(0, num(p.agent_commission) - policyPaid(policyId)) || ''; }
  else def = Math.max(0, agentStats(agentId).bal) || '';
  return `<form data-form="pay" data-agent="${agentId}"><div class="muted small" style="margin-bottom:8px">Agent: <b>${esc(a.name)}</b></div>
    <div class="f"><label>Kis policy ka (optional)</label><select name="policy_id"><option value="">General / sab ka mila ke</option>${pols.map(p => `<option value="${p.id}" ${p.id===policyId?'selected':''}>${esc(p.customer_name)} — ${esc(p.policy_number)} (baaki ${inr(num(p.agent_commission) - policyPaid(p.id))})</option>`).join('')}</select></div>
    <div class="grid g2"><div class="f"><label>Amount ₹ *</label><input name="amount" required inputmode="decimal" value="${def}"></div><div class="f"><label>Date</label><input type="date" name="paid_on" value="${today()}"></div></div>
    <div class="f"><label>Tareeka</label><select name="mode"><option>Cash</option><option>UPI</option><option>Bank transfer</option><option>Cheque</option></select></div>
    <div class="f"><label>Note</label><input name="note"></div><button class="btn full">Payment save karein</button></form>`;
}

/* ---------- RENEWALS & FOLLOW-UPS ---------- */
function vRenewals(){
  const f = REN_FILTERS[S.fRen] ? S.fRen : 'due';
  const list = S.policies.filter(REN_FILTERS[f][1]).sort((a,b) => a.expiry_date.localeCompare(b.expiry_date));
  return `<div class="pt"><h2>Renewals & Follow-up <span class="muted small">(${list.length})</span></h2></div>
  <div class="chips">${Object.keys(REN_FILTERS).map(k => `<button class="chip ${f===k?'on':''}" data-act="fren" data-id="${k}">${REN_FILTERS[k][0]}</button>`).join('')}</div>
  ${list.length ? list.map(p => {
    const st = statusOf(p), ag = agentById(p.sub_agent_id);
    return `<div class="item" style="cursor:default"><div class="row between" data-act="pol" data-id="${p.id}" style="cursor:pointer"><span class="t">${esc(p.customer_name)}</span><span class="tag ${st.cls}">${esc(st.label)}</span></div>
      <div class="s">${esc(p.insurer_name)} • ${esc(p.policy_type)}${p.vehicle_reg ? ' • ' + esc(p.vehicle_reg) : ''} • ${fdate(p.expiry_date)}${ag ? ' • 🤝 ' + esc(ag.name) : ''}</div>
      <div class="s">${esc(p.customer_mobile)} • Premium ${inr(p.total_premium)}</div>
      <div class="s">Aakhri contact: <b>${p.last_contact_date ? fdate(p.last_contact_date) : 'nahi hua'}</b>${p.call_outcome ? ' (' + esc(p.call_outcome) + ')' : ''}${p.next_follow_up_date ? ' • Agla follow-up: <b>' + fdate(p.next_follow_up_date) + '</b>' : ''} • ${esc(p.follow_up_status || 'Pending')}</div>
      <div class="row wrap" style="margin-top:8px"><button class="btn sm wa" data-act="wa" data-id="${p.id}">💬 WhatsApp</button><a class="btn sm ghost" href="tel:${tenDigits(p.customer_mobile)}">📞 Call</a>
        <button class="btn sm ghost" data-act="contact" data-id="${p.id}">📝 Follow-up</button>${isRenewed(p) ? '' : `<button class="btn sm ghost" data-act="renewed" data-id="${p.id}">✅ Renewed</button>`}${ag ? `<button class="btn sm ghost" data-act="wa" data-id="${p.id}" data-to="agent">Agent ko</button>` : ''}</div></div>`;
  }).join('') : '<div class="empty">Is list me koi policy nahi 🎉</div>'}`;
}

/* WhatsApp message sheet (edit karke bhejein) */
function openWA(id, toAgent){
  const p = policyById(id); if(!p) return;
  const c = cfg(), phones = [c.phone ? { label: 'Primary', number: c.phone } : null, ...(c.phones || [])].filter(Boolean);
  const ag = agentById(p.sub_agent_id), to = toAgent && ag ? ag.mobile : p.customer_mobile;
  S.wa = { id, to, k: tplKey(p) };
  openSheet('WhatsApp message', `<div class="card"><div class="small muted">Kisko: <b>${esc(toAgent && ag ? 'Agent ' + ag.name : p.customer_name)}</b> (${esc(to || '—')})</div>
    <div class="grid g2" style="margin-top:8px"><div class="f"><label>Template</label><select id="waTpl">${Object.keys(TPL_LABEL).map(k => `<option value="${k}" ${k===S.wa.k?'selected':''}>${TPL_LABEL[k]}</option>`).join('')}</select></div>
    <div class="f"><label>Message me kaun sa contact number</label><select id="waNum">${phones.length ? phones.map(x => `<option value="${esc(x.number)}">${esc(x.label)} — ${esc(x.number)}</option>`).join('') : '<option value="">(Settings me number jodein)</option>'}</select></div></div>
    <div class="f"><label>Message (bhejne se pehle badal sakte hain)</label><textarea id="waMsg" style="min-height:230px"></textarea></div>
    <button class="btn wa full" data-act="wasend">💬 WhatsApp kholein</button>
    <p class="small muted" style="margin:8px 2px 0">Ye sirf WhatsApp me message taiyaar karke kholta hai. Bhejne ke liye WhatsApp me “Send” aap dabate hain. Jis number se message jayega wo aapke phone/WhatsApp Web me login number hota hai; yahan ka dropdown sirf message ke andar likha contact number badalta hai.</p></div>
    <button class="btn ghost full" data-act="contact" data-id="${id}">📝 Contact / follow-up log karein</button>`);
  waFill();
}
function waFill(){
  const p = policyById(S.wa.id); if(!p) return;
  S.wa.k = $('#waTpl').value; $('#waMsg').value = fillTpl(tplOf(S.wa.k), p, $('#waNum').value);
}

/* contact / follow-up log */
function openContact(id){
  const p = policyById(id); if(!p) return;
  openSheet('Follow-up: ' + p.customer_name, `<form data-form="contact" data-id="${id}"><div class="card">
    <div class="grid g2"><div class="f"><label>Call / baat ka nateeja</label><select name="call_outcome"><option value="">—</option>${OUTCOMES.map(o => `<option ${p.call_outcome===o?'selected':''}>${o}</option>`).join('')}</select></div>
    <div class="f"><label>Status</label><select name="follow_up_status">${FU.map(o => `<option ${(p.follow_up_status||'Pending')===o?'selected':''}>${o}</option>`).join('')}</select></div></div>
    <div class="grid g2"><div class="f"><label>Contact kab hua</label><input type="date" name="last_contact_date" value="${esc(p.last_contact_date || today())}"></div>
    <div class="f"><label>Agla follow-up</label><input type="date" name="next_follow_up_date" value="${esc(p.next_follow_up_date || '')}"></div></div>
    <div class="f"><label>Notes</label><textarea name="follow_up_notes">${esc(p.follow_up_notes)}</textarea></div>
    <button class="btn full">Save follow-up</button></div></form>`);
}

/* ---------- CUSTOMERS ---------- */
function vCustomers(){
  const t = S.fCust.trim().toLowerCase();
  const list = S.customers.filter(c => !t || (c.name + ' ' + c.mobile + ' ' + (c.city || '')).toLowerCase().includes(t));
  return `<div class="pt"><h2>Customers <span class="muted small">(${list.length})</span></h2><button class="btn" data-act="newcust">＋ Naya</button></div>
  <div class="search"><input id="cuSearch" placeholder="Naam / mobile khojein" value="${esc(S.fCust)}"></div>
  <div id="cuList">${list.length ? list.map(custItem).join('') : '<div class="empty">Koi customer nahi.</div>'}</div>`;
}
const custPolicies = c => S.policies.filter(p => p.customer_id === c.id || tenDigits(p.customer_mobile) === tenDigits(c.mobile));
function custItem(c){
  const ps = custPolicies(c), act = ps.filter(isActive).length;
  return `<div class="item" data-act="cust" data-id="${c.id}"><div class="row between"><span class="t">${esc(c.name)}</span><span class="tag or">${ps.length} policy</span></div><div class="s">${esc(c.mobile)}${c.city ? ' • ' + esc(c.city) : ''} • ${act} active</div></div>`;
}
function custForm(c){
  c = c || {};
  return `<form data-form="cust" data-id="${c.id || ''}"><div class="f"><label>Naam *</label><input name="name" required value="${esc(c.name)}"></div>
  <div class="grid g2"><div class="f"><label>Mobile *</label><input name="mobile" required inputmode="numeric" value="${esc(c.mobile)}"></div><div class="f"><label>Email</label><input name="email" type="email" value="${esc(c.email)}"></div></div>
  <div class="grid g2"><div class="f"><label>PAN</label><input name="pan_number" style="text-transform:uppercase" value="${esc(c.pan_number)}"></div><div class="f"><label>Shehar</label><input name="city" value="${esc(c.city)}"></div></div>
  <div class="f"><label>Address</label><textarea name="address">${esc(c.address)}</textarea></div><button class="btn full">Save</button></form>`;
}
function openCustomer(id){
  const c = S.customers.find(x => x.id === id); if(!c) return;
  const ps = custPolicies(c);
  openSheet(c.name, `<div class="card"><div class="small muted">${esc(c.mobile)}${c.email ? ' • ' + esc(c.email) : ''}${c.city ? ' • ' + esc(c.city) : ''}</div>
    <div class="row wrap" style="margin-top:8px"><a class="btn sm ghost" href="tel:${tenDigits(c.mobile)}">📞 Call</a><a class="btn sm wa" target="_blank" rel="noopener" href="${waLink(c.mobile, 'नमस्ते ' + c.name + ' जी, Masani Finsure की तरफ से।')}">💬 WhatsApp</a><button class="btn sm ghost" data-act="editcust" data-id="${c.id}">✏️ Edit</button></div></div>
    <h3 style="margin:6px 2px">Policies (${ps.length})</h3>${ps.length ? ps.map(polItem).join('') : '<div class="empty">Is customer ki koi policy nahi.</div>'}`);
}

/* ---------- MORE ---------- */
function vMore(){
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
  const standalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone;
  return `<div class="pt"><h2>More</h2></div>
  <div class="card"><h3>📲 App install</h3>${standalone ? '<span class="ok b">✔ App installed hai.</span>' : S.installEvt ? '<button class="btn" data-act="install">⬇ Is device par install karein</button>' :
    ios ? '<p>iPhone me: Safari me <b>Share</b> (⬆) → <b>Add to Home Screen</b>.</p>' : '<p>Chrome me: ⋮ menu → <b>Install app</b> / <b>Add to Home screen</b>. (Laptop par address bar me install icon dikhega.)</p>'}</div>
  <div class="card"><h3>📥 Excel / CSV import</h3><p class="small muted">Purani customer-policy list (Excel ya CSV) upload karein. Pehle preview aur galtiyan dikhengi, purana data nahi hatega.</p><div class="row wrap"><button class="btn" data-act="import">Import shuru karein</button><button class="btn ghost" data-act="tpl">Sample template</button></div></div>
  <div class="card"><h3>🏢 Business settings & WhatsApp templates</h3><p class="small muted">Naam, website, mobile numbers aur message templates yahin se badlein.</p><button class="btn ghost" data-act="settings">Settings kholein</button></div>
  <div class="card"><h3>📤 Export / Backup</h3><div class="row wrap"><button class="btn ghost" data-act="csv">Policies CSV</button><button class="btn ghost" data-act="csvag">Agents hisaab CSV</button><button class="btn ghost" data-act="backup">Poora backup (JSON)</button></div></div>
  <div class="card"><h3>🔄 Data</h3><p class="small muted">Aakhri refresh: ${S.loadedAt ? new Date(S.loadedAt).toLocaleTimeString('en-IN') : '—'}. Dusre device par kiya badlav yahan dikhane ke liye refresh karein.</p><button class="btn ghost" data-act="reload">Refresh</button></div>
  <div class="card"><h3>👤 Account</h3><p class="small muted">${esc(S.user.email)}</p><div class="row wrap"><button class="btn dark" data-act="logout">Logout</button>${ls.get('masani_key') ? '<button class="btn ghost" data-act="resetkey">Supabase key badlein</button>' : ''}</div></div>
  <p class="small muted" style="text-align:center">Masani Finsure • Best searching for you</p>`;
}
function csvDownload(name, rows){
  const csv = rows.map(r => r.map(c => '"' + String(c ?? '').replace(/"/g,'""') + '"').join(',')).join('\r\n');
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' })); a.download = name; document.body.appendChild(a); a.click(); a.remove();
}
function exportPolicies(){
  csvDownload('masani_policies_' + today() + '.csv', [['Policy No','Customer','Mobile','Company','Type','Gaadi no','Start','Expiry','Net Premium','GST','Total Premium','Aapka Commission','Company se mila','Agent','Agent Commission','Agent ko diya','Munafa'],
    ...S.policies.map(p => { const ag = agentById(p.sub_agent_id); return [p.policy_number, p.customer_name, p.customer_mobile, p.insurer_name, p.policy_type, p.vehicle_reg, p.start_date, p.expiry_date, p.net_premium, p.gst_amount, p.total_premium, p.total_expected_commission, p.actual_commission_received, ag ? ag.name : 'Direct', p.agent_commission, policyPaid(p.id), num(p.total_expected_commission) - num(p.agent_commission)]; })]);
}
function exportAgents(){
  csvDownload('masani_agents_' + today() + '.csv', [['Agent','Mobile','Policies','Net Premium','Commission banta','Diya','Baaki'], ...S.agents.map(a => { const x = agentStats(a.id); return [a.name, a.mobile, x.count, x.premium, x.due, x.paid, x.bal]; })]);
}

/* ---------- SETTINGS ---------- */
function openSettings(){
  const c = cfg();
  openSheet('Business settings', `<form data-form="settings">
    <div class="card"><div class="sec">Business</div>
    <div class="f"><label>Business naam</label><input name="business_name" value="${esc(c.business_name)}"></div>
    <div class="f"><label>Website link (message me jayega)</label><input name="website" inputmode="url" placeholder="https://..." value="${esc(c.website)}"></div>
    <div class="grid g2"><div class="f"><label>Primary mobile</label><input name="phone" inputmode="tel" value="${esc(c.phone)}"></div><div class="f"><label>Email</label><input name="email" type="email" value="${esc(c.email)}"></div></div>
    <div class="f"><label>Aur business numbers (har line me “Naam: number”)</label><textarea name="phones" placeholder="Office: 9876543210&#10;Sonu: 9123456789">${esc((c.phones || []).map(x => x.label + ': ' + x.number).join('\n'))}</textarea></div>
    <div class="f"><label>Address</label><textarea name="address">${esc(c.address)}</textarea></div>
    <div class="sec">WhatsApp templates</div>
    <p class="small muted">Ye shabd apne aap bharte hain: {Customer_Name} {Policy_Type} {Policy_Number} {Expiry_Date} {Vehicle_Number} {Vehicle_Line} {Insurer} {Business_Name} {Website} {Contact}</p>
    ${Object.keys(TPL_LABEL).map(k => `<div class="f"><label>${TPL_LABEL[k]}</label><textarea name="tpl_${k}" style="min-height:120px">${esc(tplOf(k))}</textarea></div>`).join('')}
    <button class="btn full">Settings save karein</button>
    <button type="button" class="btn ghost full" data-act="tplreset" style="margin-top:8px">Templates default par laayein</button></div>
    <p class="small muted">Time zone: India Standard Time (IST) • Date format: DD-MM-YYYY. Logo badalne ke liye <b>logo.png</b> file replace karein.</p></form>`);
}
async function saveSettings(form){
  const f = form.elements, val = {
    business_name: f.business_name.value.trim() || 'Masani Finsure', website: f.website.value.trim(), phone: f.phone.value.trim(), email: f.email.value.trim(), address: f.address.value.trim(),
    phones: f.phones.value.split('\n').map(l => l.trim()).filter(Boolean).map(l => { const i = l.indexOf(':'); return i > 0 ? { label: l.slice(0,i).trim(), number: l.slice(i+1).trim() } : { label: 'Number', number: l }; }),
    templates: {}
  };
  Object.keys(TPL_LABEL).forEach(k => { val.templates[k] = f['tpl_' + k].value; });
  const ex = await q(S.sb.from('app_settings').select('id').eq('id', 'main'));
  if(ex && ex.length) await q(S.sb.from('app_settings').update({ value: val, updated_at: new Date().toISOString() }).eq('id', 'main'));
  else await q(S.sb.from('app_settings').insert({ id: 'main', value: val }));
  S.settings = val; closeSheet(); toast('Settings save ho gayi ✔', 'ok'); render();
}

/* ---------- EXCEL / CSV IMPORT ---------- */
const IMP_FIELDS = [
  ['name','Customer naam',['customer name','name','naam','customer','insured name','client name','client']],
  ['mobile','Mobile',['customer mobile number','customer mobile','mobile number','mobile no','mobile','phone','contact number','contact','phone number']],
  ['alt','Alternate mobile',['alternate mobile number','alternate mobile','alt mobile','alternate number','alternate','mobile 2']],
  ['policy_number','Policy number',['policy number','policy no','policy no.','policy','pol no']],
  ['insurer','Insurance company',['insurance company','insurer','company','company name']],
  ['ptype','Policy type',['policy type','type','product','class','insurance type']],
  ['vehicle','Vehicle number',['vehicle registration number','vehicle number','vehicle no','registration number','registration no','reg no','regn no','rc number','vehicle']],
  ['premium','Premium',['premium amount','total premium','premium']],
  ['start','Start date',['policy start date','start date','risk start date','from date','start']],
  ['expiry','Expiry date',['policy expiry date','expiry date','expiry','end date','policy end date','due date','to date','renewal date']],
  ['email','Email',['email address','email','e mail','mail id']],
  ['status','Pichla follow-up status',['previous follow up status','follow up status','follow up','status']],
  ['notes','Notes',['notes','note','remarks','remark']]
];
const norm = h => String(h).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
function guessMap(headers){
  const map = {}, used = new Set(), nh = headers.map(norm);
  IMP_FIELDS.forEach(([k,,al]) => { const i = nh.findIndex((h,ix) => !used.has(ix) && al.includes(h)); if(i >= 0){ map[k] = headers[i]; used.add(i); } });
  IMP_FIELDS.forEach(([k,,al]) => { if(map[k]) return; const i = nh.findIndex((h,ix) => !used.has(ix) && h && al.some(a => a.length > 3 && h.includes(a))); if(i >= 0){ map[k] = headers[i]; used.add(i); } });
  return map;
}
function parseDate(v){
  if(v === '' || v == null) return '';
  if(v instanceof Date && !isNaN(v)) return new Date(v.getTime() + 12*3600e3).toISOString().slice(0,10);
  if(typeof v === 'number' && v > 20000 && v < 80000) return new Date(Math.round((v - 25569) * 864e5)).toISOString().slice(0,10);
  const t = String(v).trim();
  let m = t.match(/^(\d{4})[-\/.](\d{1,2})[-\/.](\d{1,2})/);
  if(m) return chk(+m[1], +m[2], +m[3]);
  m = t.match(/^(\d{1,2})[-\/.](\d{1,2})[-\/.](\d{2,4})/);
  if(m){ let y = +m[3]; if(y < 100) y += 2000; return chk(y, +m[2], +m[1]); }
  const d = new Date(t + ' 12:00 UTC'); if(!isNaN(d)) return d.toISOString().slice(0,10);
  const d2 = new Date(t); return isNaN(d2) ? '' : iso(d2);
}
function chk(y, m, d){ const dt = new Date(Date.UTC(y, m-1, d)); return dt.getUTCFullYear() === y && dt.getUTCMonth() === m-1 && dt.getUTCDate() === d ? dt.toISOString().slice(0,10) : ''; }
function mapType(t, hasVeh){
  const x = String(t || '').toLowerCase();
  if(/health|mediclaim|medical/.test(x)) return ['Health', null];
  if(/life|lic|term/.test(x)) return ['Life', null];
  if(/fire/.test(x)) return ['Fire', null];
  if(/marine|transit/.test(x)) return ['Marine/Transit', null];
  if(/bike|two|2 ?w|scooter|motorcycle/.test(x)) return ['Motor', 'Two Wheeler'];
  if(/commercial|goods|truck|gcv|pcv|bus|taxi/.test(x)) return ['Motor', 'Commercial Vehicle'];
  if(/car|private|motor|auto/.test(x)) return ['Motor', 'Private Car'];
  return hasVeh ? ['Motor', null] : ['Other', null];
}
function mapStatus(v){ const x = String(v || '').toLowerCase(); if(!x) return 'Pending'; if(/renew/.test(x)) return 'Renewed'; if(/lost|not int|cancel/.test(x)) return 'Lost'; if(/quot/.test(x)) return 'Quotation Sent'; if(/contact|called|done/.test(x)) return 'Contacted'; return 'Pending'; }
const cell = (r, col) => (col && col in r ? r[col] : '');
const sv = v => (v instanceof Date ? '' : String(v ?? '').trim());

function buildImport(){
  const I = S.imp, existing = new Map(S.policies.map(p => [String(p.policy_number).trim().toLowerCase(), p]));
  const seen = new Set(); I.parsed = [];
  I.rows.forEach((r, i) => {
    const g = k => cell(r, I.map[k]), errs = [];
    const name = sv(g('name')), mobile = tenDigits(sv(g('mobile'))), pn = sv(g('policy_number')), exp = parseDate(g('expiry'));
    if(!name) errs.push('Naam nahi'); if(mobile.length !== 10) errs.push('Mobile galat'); if(!pn) errs.push('Policy no. nahi'); if(!exp) errs.push('Expiry date galat/khali');
    let start = parseDate(g('start')); if(sv(g('start')) && !start) errs.push('Start date galat');
    if(!start && exp){ const d = new Date(exp + 'T00:00:00'); start = iso(new Date(d.getFullYear() - 1, d.getMonth(), d.getDate() + 1)); }
    if(start && exp && exp < start) errs.push('Expiry start se pehle');
    const alt = tenDigits(sv(g('alt'))); const veh = sv(g('vehicle')).toUpperCase().replace(/\s+/g, '');
    const [ptype, vcat] = mapType(sv(g('ptype')), !!veh);
    const prem = num(g('premium'));
    const key = pn.toLowerCase(); let dup = null;
    if(pn){ if(existing.has(key)) dup = 'db'; else if(seen.has(key)) dup = 'file'; seen.add(key); }
    I.parsed.push({ i: i + 2, errs, dup, ex: existing.get(key),
      row: { customer_name: name, customer_mobile: mobile, customer_email: sv(g('email')) || null, alt: alt.length === 10 ? alt : null, policy_number: pn, insurer_name: sv(g('insurer')) || 'Other', policy_type: ptype, vehicle_category: vcat, vehicle_reg: veh || null,
        net_premium: prem, total_premium: prem, gst_rate: 0, gst_amount: 0, start_date: start, expiry_date: exp, follow_up_status: mapStatus(g('status')), follow_up_notes: sv(g('notes')) || null } });
  });
}
function renderImport(){
  const I = S.imp, P = I.parsed, ok = P.filter(x => !x.errs.length), bad = P.filter(x => x.errs.length), dupDb = ok.filter(x => x.dup === 'db'), dupFile = ok.filter(x => x.dup === 'file');
  const fresh = ok.filter(x => !x.dup).length;
  setSheet(`<div class="card"><div class="small muted">File: <b>${esc(I.fileName)}</b> • ${I.rows.length} rows</div>
    <div class="sec">Columns match karein</div><div class="grid g2">${IMP_FIELDS.map(([k,l]) => `<div class="f"><label>${l}</label><select class="impmap" data-k="${k}"><option value="">— nahi hai —</option>${I.headers.map(h => `<option ${I.map[k] === h ? 'selected' : ''}>${esc(h)}</option>`).join('')}</select></div>`).join('')}</div></div>
    <div class="card"><div class="grid g2"><div class="stat"><div class="n ok">${fresh}</div><div class="l">Nayi policies</div></div><div class="stat"><div class="n warn">${dupDb.length}</div><div class="l">Pehle se maujood</div></div>
    <div class="stat"><div class="n bad">${bad.length}</div><div class="l">Galat rows</div></div><div class="stat"><div class="n">${dupFile.length}</div><div class="l">File me repeat</div></div></div>
    ${dupDb.length ? `<div class="f" style="margin-top:10px"><label>Jo policy pehle se hai uska kya karein?</label><select id="impMode"><option value="skip" ${I.mode==='skip'?'selected':''}>Chhod dein (skip)</option><option value="update" ${I.mode==='update'?'selected':''}>File ke data se update karein</option></select><div class="small muted">Policy number har record me alag hona zaroori hai, isliye duplicate dobara nahi banta.</div></div>` : ''}
    ${bad.length ? `<div class="sec">Galat rows (import nahi hongi)</div><div style="max-height:160px;overflow:auto;font-size:13px">${bad.slice(0,60).map(x => `<div>Row ${x.i}: <span class="bad">${esc(x.errs.join(', '))}</span> — ${esc(x.row.customer_name || x.row.policy_number || '')}</div>`).join('')}${bad.length > 60 ? '<div class="muted">…aur bhi</div>' : ''}</div>` : ''}
    <div class="sec">Preview (pehli 5)</div><div style="font-size:13px">${ok.slice(0,5).map(x => `<div style="margin-bottom:4px"><b>${esc(x.row.customer_name)}</b> • ${esc(x.row.customer_mobile)} • ${esc(x.row.policy_number)} • ${fdate(x.row.expiry_date)}${x.dup ? ' <span class="tag yl">duplicate</span>' : ''}</div>`).join('') || '<span class="muted">Koi sahi row nahi</span>'}</div>
    <button class="btn full" style="margin-top:12px" data-act="impgo" ${ok.length ? '' : 'disabled'}>${ok.length ? 'Import karein' : 'Pehle columns match karein'}</button></div>`);
}
function openImport(){
  S.imp = null; openSheet('Excel / CSV import', `<div class="card"><p>.xlsx, .xls ya .csv file chunein. Pehli sheet padhi jayegi, pehli row heading honi chahiye.</p>
    <input type="file" id="impFile" accept=".xlsx,.xls,.csv,text/csv"><div class="row wrap" style="margin-top:10px"><button class="btn ghost sm" data-act="tpl">Sample template download</button></div><div id="impStatus" class="small muted" style="margin-top:8px"></div></div>`);
}
function loadScript(src){ return new Promise((res, rej) => { if(window.XLSX) return res(); const el = document.createElement('script'); el.src = src; el.onload = res; el.onerror = () => rej(new Error('Excel library load nahi hui (internet check karein)')); document.head.appendChild(el); }); }
async function readImportFile(file){
  const st = $('#impStatus'); if(st) st.textContent = 'File padh raha hu…';
  try {
    await loadScript('https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js');
    const wb = window.XLSX.read(await file.arrayBuffer(), { type: 'array', cellDates: true });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rows = window.XLSX.utils.sheet_to_json(ws, { defval: '', raw: true }).filter(r => Object.values(r).some(v => String(v).trim() !== ''));
    if(!rows.length) throw new Error('File khali hai ya heading nahi mili');
    if(rows.length > 5000) throw new Error('Ek baar me 5000 se zyada rows nahi — file todkar daalein');
    const headers = [...new Set(rows.flatMap(r => Object.keys(r)))];
    S.imp = { rows, headers, map: guessMap(headers), fileName: file.name, mode: 'skip', parsed: [] };
    buildImport(); renderImport();
  } catch(e){ if(st) st.innerHTML = `<span class="bad">${esc(errMsg(e))}</span>`; }
}
async function runImport(btn){
  const I = S.imp; btn.disabled = true; btn.textContent = 'Import ho raha hai…';
  const ok = I.parsed.filter(x => !x.errs.length);
  const toNew = ok.filter(x => !x.dup), toUpd = I.mode === 'update' ? ok.filter(x => x.dup === 'db') : [];
  const skipped = ok.length - toNew.length - toUpd.length, errors = I.parsed.filter(x => x.errs.length).map(x => `Row ${x.i}: ${x.errs.join(', ')}`);
  let added = 0, updated = 0;
  try {
    const cmap = new Map(S.customers.map(c => [tenDigits(c.mobile), c]));
    const newCust = new Map();
    [...toNew, ...toUpd].forEach(x => { const m = x.row.customer_mobile; if(!cmap.has(m) && !newCust.has(m)) newCust.set(m, { name: x.row.customer_name, mobile: m, email: x.row.customer_email, alternate_mobile: x.row.alt }); });
    const nc = [...newCust.values()];
    for(let i = 0; i < nc.length; i += 100){ const out = await q(S.sb.from('customers').insert(nc.slice(i, i + 100)).select()); out.forEach(c => cmap.set(tenDigits(c.mobile), c)); }
    const payload = x => { const { alt, ...r } = x.row; return { ...r, customer_id: cmap.get(r.customer_mobile)?.id || null, commission_mode: 'NET_PREMIUM', updated_at: new Date().toISOString() }; };
    for(let i = 0; i < toNew.length; i += 100){
      const chunk = toNew.slice(i, i + 100);
      try { await q(S.sb.from('policies').insert(chunk.map(payload))); added += chunk.length; }
      catch { for(const x of chunk){ try { await q(S.sb.from('policies').insert(payload(x))); added++; } catch(e){ errors.push(`Row ${x.i}: ${errMsg(e)}`); } } }
    }
    for(const x of toUpd){
      try { const pl = payload(x); delete pl.follow_up_status; if(!pl.follow_up_notes) delete pl.follow_up_notes; await q(S.sb.from('policies').update(pl).eq('id', x.ex.id)); updated++; } catch(e){ errors.push(`Row ${x.i}: ${errMsg(e)}`); }
    }
    await loadAll(true); render();
    setSheet(`<div class="card"><h3>✅ Import poora</h3><div class="grid g2"><div class="stat"><div class="n ok">${added}</div><div class="l">Nayi policies jodi</div></div><div class="stat"><div class="n">${updated}</div><div class="l">Update hui</div></div><div class="stat"><div class="n warn">${skipped}</div><div class="l">Skip (duplicate)</div></div><div class="stat"><div class="n bad">${errors.length}</div><div class="l">Error / galat rows</div></div></div>
      ${errors.length ? `<div class="sec">Error report</div><div style="max-height:200px;overflow:auto;font-size:13px">${errors.slice(0,100).map(e => `<div>${esc(e)}</div>`).join('')}</div><button class="btn ghost sm" style="margin-top:8px" data-act="errcsv">Error list download</button>` : ''}
      <p class="small muted">Premium ko total maana gaya hai (GST alag nahi). Zarurat ho to policy me edit karein.</p></div>`);
    S.impErrors = errors; toast('Import poora ✔', 'ok');
  } catch(e){ toast('Import ruk gaya: ' + errMsg(e), 'error'); btn.disabled = false; btn.textContent = 'Dobara koshish karein'; }
}
function downloadTemplate(){
  csvDownload('masani_import_template.csv', [
    ['Customer Name','Customer Mobile Number','Alternate Mobile Number','Policy Number','Insurance Company','Policy Type','Vehicle Registration Number','Premium Amount','Policy Start Date','Policy Expiry Date','Email Address','Previous Follow-up Status','Notes'],
    ['Ramesh Kumar','9876543210','9123456780','POL12345','United India','Car','MP04AB1234','11800','21-10-2025','20-10-2026','ramesh@example.com','Pending','Purana customer'],
    ['Sita Devi','9988776655','','HLT7788','Star Health','Health','','15400','01-12-2025','30-11-2026','','Contacted','']
  ]);
}
async function backupAll(){
  const tables = ['customers','policies','sub_agents','agent_payments','endorsements','claims','service_records','app_settings'], out = { exported_at: new Date().toISOString() };
  for(const t of tables){ try { out[t] = await q(S.sb.from(t).select('*')); } catch { out[t] = []; } }
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([JSON.stringify(out, null, 1)], { type: 'application/json' })); a.download = 'masani_backup_' + today() + '.json'; document.body.appendChild(a); a.click(); a.remove();
  toast('Backup download ho gaya (files ko chhodkar)', 'ok');
}

/* ---------- events ---------- */
async function afterChange(msg){ await loadAll(true); render(); if(msg) toast(msg, 'ok'); }
async function refreshSheet(){ if(!S.sheet) return; if(S.sheet.kind === 'policy') renderPolicySheet(); else if(S.sheet.kind === 'agent') renderAgentSheet(); }

document.addEventListener('click', async e => {
  const el = e.target.closest('[data-act]'); if(!el) return;
  const act = el.dataset.act, id = el.dataset.id;
  if(el.tagName === 'SELECT') return;
  try {
    switch(act){
      case 'tab': S.tab = id; closeSheet(); render(); window.scrollTo(0,0); break;
      case 'close': closeSheet(); break;
      case 'ftype': S.fPol.type = id; render(); break;
      case 'fren': S.fRen = id; render(); break;
      case 'newpol': openSheet('Nayi Policy', policyForm()); break;
      case 'editpol': openSheet('Policy edit', policyForm(policyById(id))); break;
      case 'pol': openPolicy(id); break;
      case 'ptab': S.sheet.tab = id; renderPolicySheet(); break;
      case 'delpol': { const p = policyById(id); if(!confirm(`Policy ${p.policy_number} (${p.customer_name}) hamesha ke liye hata dein? Endorsement, claim sab bhi hat jayenge.`)) break;
        await q(S.sb.from('policies').delete().eq('id', id)); await removeFile(p.pdf_storage_path); closeSheet(); await afterChange('Policy hata di'); break; }
      case 'openfile': openFile(el.dataset.path); break;
      case 'delrow': { if(!confirm('Pakka hatana hai?')) break; await q(S.sb.from(el.dataset.table).delete().eq('id', id)); await removeFile(el.dataset.path); toast('Hata diya', 'ok'); renderPolicySheet(); break; }
      case 'claimupd': { const box = el.closest('[data-claim]'); await q(S.sb.from('claims').update({ status: box.querySelector('[data-f=status]').value, amount_settled: num(box.querySelector('[data-f=settled]').value) }).eq('id', id)); toast('Claim update ✔', 'ok'); renderPolicySheet(); break; }
      case 'paypol': { const p = policyById(id); openSheet('Agent ko commission diya', payForm(p.sub_agent_id, id)); break; }
      case 'newagent': openSheet('Naya Agent', agentForm()); break;
      case 'agent': openAgent(id); break;
      case 'atab': S.sheet.tab = id; renderAgentSheet(); break;
      case 'editagent': openSheet('Agent edit', agentForm(agentById(id))); break;
      case 'payagent': openSheet('Payment diya', payForm(id)); break;
      case 'delpay': { if(!confirm('Ye payment hatani hai?')) break; await q(S.sb.from('agent_payments').delete().eq('id', id)); await loadAll(true); render(); renderAgentSheet(); toast('Hata diya', 'ok'); break; }
      case 'delagent': { const st = agentStats(id); if(st.count){ alert('Is agent ki ' + st.count + ' policy hain, isliye hata nahi sakte. Edit me “Active” band kar dein.'); break; }
        if(!confirm('Agent hata dein?')) break; await q(S.sb.from('sub_agents').delete().eq('id', id)); closeSheet(); await afterChange('Agent hata diya'); break; }
      case 'newcust': openSheet('Naya customer', custForm()); break;
      case 'cust': openCustomer(id); break;
      case 'editcust': openSheet('Customer edit', custForm(S.customers.find(c => c.id === id))); break;
      case 'install': if(S.installEvt){ S.installEvt.prompt(); await S.installEvt.userChoice; S.installEvt = null; render(); } break;
      case 'wa': openWA(id, el.dataset.to === 'agent'); break;
      case 'wasend': { const p = policyById(S.wa.id), msg = $('#waMsg').value; if(!S.wa.to){ toast('Mobile number nahi hai', 'error'); break; } window.open(waLink(S.wa.to, msg), '_blank', 'noopener'); break; }
      case 'contact': openContact(id); break;
      case 'renewed': { await q(S.sb.from('policies').update({ follow_up_status: 'Renewed', last_contact_date: today() }).eq('id', id)); await afterChange('Renewed mark ho gayi ✔'); refreshSheet(); break; }
      case 'rb': S.tab = 'renewals'; S.fRen = id; render(); window.scrollTo(0,0); break;
      case 'import': openImport(); break;
      case 'impgo': runImport(el); break;
      case 'errcsv': csvDownload('import_errors.csv', [['Error'], ...(S.impErrors || []).map(e => [e])]); break;
      case 'tpl': downloadTemplate(); break;
      case 'settings': openSettings(); break;
      case 'tplreset': if(confirm('Saare templates default ho jayenge?')){ Object.keys(TPL_LABEL).forEach(k => { const t = $('textarea[name=tpl_' + k + ']'); if(t) t.value = DEFAULT_TPL[k]; }); } break;
      case 'backup': backupAll(); break;
      case 'csv': exportPolicies(); break;
      case 'csvag': exportAgents(); break;
      case 'reload': S.setupMissing = false; S.loaded = false; render(); await loadAll(); render(); break;
      case 'logout': await S.sb.auth.signOut(); break;
      case 'resetkey': if(confirm('Saved key hata dein?')){ ls.del('masani_key'); location.reload(); } break;
    }
  } catch(err){ toast('Error: ' + errMsg(err), 'error'); }
});

document.addEventListener('change', async e => {
  const el = e.target;
  if(el.dataset && el.dataset.act === 'fu'){
    try { await q(S.sb.from('policies').update({ follow_up_status: el.value }).eq('id', el.dataset.id)); const p = policyById(el.dataset.id); if(p) p.follow_up_status = el.value; toast('Status: ' + el.value, 'ok'); if(el.value === 'Renewed') { render(); } }
    catch(err){ toast('Error: ' + errMsg(err), 'error'); }
    return;
  }
  if(el.id === 'waTpl' || el.id === 'waNum'){ waFill(); return; }
  if(el.id === 'impFile'){ if(el.files[0]) readImportFile(el.files[0]); return; }
  if(el.id === 'impMode'){ S.imp.mode = el.value; return; }
  if(el.classList && el.classList.contains('impmap')){ S.imp.map[el.dataset.k] = el.value; buildImport(); renderImport(); return; }
  if(el.id === 'polAgent'){ S.fPol.agent = el.value; keepScroll(render); return; }
  const form = el.closest && el.closest('form[data-form=policy]');
  if(form && el.name === 'sub_agent_id') policyCalc(form, 'sub_agent_id');
});

document.addEventListener('input', e => {
  const el = e.target;
  if(el.id === 'polSearch'){ S.fPol.text = el.value; $('#polList').innerHTML = filteredPolicies().map(polItem).join('') || '<div class="empty">Koi policy nahi mili.</div>'; return; }
  if(el.id === 'agSearch'){ S.fAgent = el.value; const t = el.value.trim().toLowerCase(); const l = S.agents.filter(a => !t || (a.name + ' ' + (a.mobile||'') + ' ' + (a.city||'')).toLowerCase().includes(t)); $('#agList').innerHTML = l.map(agentItem).join('') || '<div class="empty">Koi agent nahi.</div>'; return; }
  if(el.id === 'cuSearch'){ S.fCust = el.value; const t = el.value.trim().toLowerCase(); const l = S.customers.filter(c => !t || (c.name + ' ' + c.mobile + ' ' + (c.city||'')).toLowerCase().includes(t)); $('#cuList').innerHTML = l.map(custItem).join('') || '<div class="empty">Koi customer nahi.</div>'; return; }
  const form = el.closest && el.closest('form[data-form=policy]');
  if(form && el.name) policyCalc(form, el.name);
});

document.addEventListener('submit', async e => {
  const form = e.target.closest('form[data-form]'); if(!form) return;
  e.preventDefault();
  const kind = form.dataset.form, f = form.elements;
  const btn = form.querySelector('button.btn');
  try {
    if(kind === 'setkey'){ ls.set('masani_key', f.key.value.trim()); location.reload(); return; }
    if(kind === 'login'){
      btn.disabled = true; btn.textContent = 'Login ho raha hai…';
      const { error } = await S.sb.auth.signInWithPassword({ email: f.email.value.trim(), password: f.password.value });
      if(error){ renderLogin(/invalid/i.test(error.message) ? 'Email ya password galat hai.' : error.message); }
      return;
    }
    if(kind === 'policy') return savePolicy(form);
    if(kind === 'settings'){ btn.disabled = true; await saveSettings(form); return; }
    if(kind === 'contact'){ btn.disabled = true;
      await q(S.sb.from('policies').update({ call_outcome: f.call_outcome.value || null, follow_up_status: f.follow_up_status.value, last_contact_date: f.last_contact_date.value || null, next_follow_up_date: f.next_follow_up_date.value || null, follow_up_notes: f.follow_up_notes.value.trim() || null }).eq('id', form.dataset.id));
      closeSheet(); await afterChange('Follow-up save ho gaya ✔'); return; }
    if(kind === 'endo') return saveChild(form, 'endorsements');
    if(kind === 'claim') return saveChild(form, 'claims');
    if(kind === 'svc') return saveChild(form, 'service_records');
    btn.disabled = true;
    if(kind === 'agent'){
      const row = { name: f.name.value.trim(), mobile: tenDigits(f.mobile.value) || null, city: f.city.value.trim() || null, default_commission_pct: num(f.default_commission_pct.value), notes: f.notes.value.trim() || null };
      if(form.dataset.id){ row.active = f.active ? f.active.checked : true; await q(S.sb.from('sub_agents').update(row).eq('id', form.dataset.id)); }
      else await q(S.sb.from('sub_agents').insert(row));
      closeSheet(); await afterChange('Agent save ho gaya ✔'); return;
    }
    if(kind === 'pay'){
      const amt = num(f.amount.value); if(amt <= 0){ toast('Amount daalein', 'error'); btn.disabled = false; return; }
      await q(S.sb.from('agent_payments').insert({ agent_id: form.dataset.agent, policy_id: f.policy_id.value || null, amount: amt, paid_on: f.paid_on.value || today(), mode: f.mode.value, note: f.note.value.trim() || null }));
      closeSheet(); await afterChange('Payment save ho gayi ✔');
      if(S.sheet == null && $('#ov') == null){ /* sheet closed */ }
      return;
    }
    if(kind === 'cust'){
      const mobile = tenDigits(f.mobile.value); if(mobile.length !== 10){ toast('Mobile 10 digit ka ho', 'error'); btn.disabled = false; return; }
      const row = { name: f.name.value.trim(), mobile, email: f.email.value.trim() || null, pan_number: f.pan_number.value.trim().toUpperCase() || null, city: f.city.value.trim() || null, address: f.address.value.trim() || null, updated_at: new Date().toISOString() };
      if(form.dataset.id) await q(S.sb.from('customers').update(row).eq('id', form.dataset.id)); else await q(S.sb.from('customers').insert(row));
      closeSheet(); await afterChange('Customer save ho gaya ✔'); return;
    }
  } catch(err){
    const m = errMsg(err);
    toast(/duplicate|unique/i.test(m) ? 'Ye mobile / number pehle se hai' : 'Save nahi hua: ' + m, 'error');
    if(btn){ btn.disabled = false; }
  }
});

document.addEventListener('keydown', e => { if(e.key === 'Escape') closeSheet(); });
window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); S.installEvt = e; if(S.user) render(); });
window.addEventListener('appinstalled', () => { S.installEvt = null; if(S.user) render(); });
document.addEventListener('visibilitychange', async () => {
  if(document.visibilityState === 'visible' && S.user && Date.now() - S.loadedAt > 60000 && !$('#ov')){ await loadAll(true); render(); }
});

/* ---------- boot ---------- */
async function boot(){
  if('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) navigator.serviceWorker.register('sw.js').catch(() => {});
  if(!window.supabase){ app().innerHTML = '<div class="login"><div class="box"><h1>Internet chahiye</h1><p class="sub">Pehli baar kholne ke liye internet zaroori hai. Net chalu karke page refresh karein.</p></div></div>'; return; }
  if(!SB_KEY){ renderSetupKey(); return; }
  S.sb = window.supabase.createClient(SB_URL, SB_KEY, { auth: { persistSession: true, autoRefreshToken: true } });
  const apply = async session => {
    const u = session && session.user;
    if(u){ const first = !S.user; S.user = u; if(first){ render(); await loadAll(); render(); } }
    else { S.user = null; S.loaded = false; closeSheet(); renderLogin(); }
  };
  S.sb.auth.onAuthStateChange((ev, session) => { if(ev === 'SIGNED_IN' || ev === 'SIGNED_OUT' || ev === 'INITIAL_SESSION') setTimeout(() => apply(session), 0); });
  const { data } = await S.sb.auth.getSession();
  if(!S.user && !data.session) renderLogin();
}
boot();
})();
