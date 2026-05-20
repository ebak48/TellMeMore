'use strict';
// ─────────────────────────────────────────────────────────────────────────────
// TellMeMore — Server v3 (investor kill-risk edition)
// All 12 kill risks addressed. Node.js 22+, zero npm deps, node:sqlite.
// ─────────────────────────────────────────────────────────────────────────────

const http   = require('node:http');
const https  = require('node:https');
const crypto = require('node:crypto');
const fs     = require('node:fs');
const path   = require('node:path');
const url    = require('node:url');

const { initDb }   = require('./migrations.js');
const { generateOgCard } = require('./og_generator.js');
const {
  computeResult, getQuestionsForMode, SIGNALS,
  UNLOCK_THRESHOLDS, QUESTION_BANK_VERSION,
  coverageReport, credibilityTest
} = require('./questions.js');

const PORT       = parseInt(process.env.PORT || '3000', 10);
const BASE_URL   = (process.env.BASE_URL || 'https://tellmemore-production.up.railway.app').replace(/\/$/, '');
const ADMIN_PASS = process.env.ADMIN_PASS || 'tmm-alpha-change-me';
const APP_HTML   = path.join(__dirname, 'app.html');
const IP_SALT    = process.env.IP_SALT || crypto.randomBytes(16).toString('hex');

const db = initDb();

// ── HELPERS ───────────────────────────────────────────────────────────────────
function esc(s) {
  return String(s || '')
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;').replace(/'/g,'&#x27;').replace(/\//g,'&#x2F;');
}
function sanitize(s, max=500) {
  return typeof s==='string' ? s.replace(/<[^>]*>/g,'').replace(/[^\S ]/g,' ').trim().slice(0,max) : '';
}
function uid()    { return crypto.randomBytes(16).toString('hex'); }
function tok()    { return crypto.randomBytes(32).toString('hex'); }
function hashIp(ip){ return crypto.createHash('sha256').update(ip+IP_SALT).digest('hex').slice(0,16); }
function slugify(n){ return n.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,40)+'-'+crypto.randomBytes(3).toString('hex'); }
function shareId() { return crypto.randomBytes(6).toString('hex'); }

// ── IN-MEMORY RATE LIMITER ────────────────────────────────────────────────────
const _rl = new Map();
setInterval(()=>{ const now=Date.now(); for(const[k,r]of _rl) if(now>r.reset+120000)_rl.delete(k); },300000);
function rateLimit(key,max,windowMs){
  const now=Date.now(); let r=_rl.get(key);
  if(!r||now>r.reset){r={n:0,reset:now+windowMs};_rl.set(key,r);} r.n++;
  return r.n<=max;
}

// ── SESSION ───────────────────────────────────────────────────────────────────
function getSession(req){const c=req.headers.cookie||'';const m=c.match(/tmm_session=([a-f0-9]{64})/);return m?m[1]:null;}
function setSessionCookie(res,t,days=30){
  res.setHeader('Set-Cookie',`tmm_session=${t}; Path=/; Expires=${new Date(Date.now()+days*864e5).toUTCString()}; HttpOnly; SameSite=Lax`);
}
function clearCookie(res){res.setHeader('Set-Cookie','tmm_session=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; HttpOnly; SameSite=Lax');}
function validateSession(t){
  if(!t)return null;
  const r=db.prepare('SELECT user_id,profile_id FROM owner_sessions WHERE token=? AND expires_at>?').get(t,Date.now());
  return r?{userId:r.user_id,profileId:r.profile_id}:null;
}

// ── EMAIL (Resend or alpha log) ───────────────────────────────────────────────
async function sendMagicEmail(email, magicUrl) {
  if(!process.env.RESEND_API_KEY){ console.log(`[AUTH] Magic link → ${email}: ${magicUrl}`); return false; }
  const body=JSON.stringify({from:'TellMeMore <noreply@tellmemore.app>',to:[email],
    subject:'Your TellMeMore results link',
    html:`<p style="font-family:monospace">Click to return to your results:</p>
          <a href="${magicUrl}" style="font-family:monospace">${magicUrl}</a>
          <p style="font-family:monospace;color:#888;font-size:12px">Link expires in 24 hours. Do not share it.</p>`});
  return new Promise(resolve=>{
    const req=https.request({hostname:'api.resend.com',path:'/emails',method:'POST',
      headers:{'Authorization':`Bearer ${process.env.RESEND_API_KEY}`,'Content-Type':'application/json','Content-Length':Buffer.byteLength(body)}
    },res=>{let d='';res.on('data',c=>d+=c);res.on('end',()=>resolve(res.statusCode<300));});
    req.on('error',()=>resolve(false));req.write(body);req.end();
  });
}

// ── ANALYTICS ─────────────────────────────────────────────────────────────────
function track(event,fields={}){
  try{
    db.prepare('INSERT INTO analytics(id,event,profile_id,session_id,user_id,language,platform,metadata,created_at)VALUES(?,?,?,?,?,?,?,?,?)').run(
      uid(),event,
      sanitize(fields.profileId||'',40)||null,
      sanitize(fields.sessionId||'',40)||null,
      sanitize(fields.userId||'',40)||null,
      sanitize(fields.language||'',10),
      sanitize(fields.platform||'',100),
      fields.metadata?JSON.stringify(fields.metadata):null,
      Date.now()
    );
  }catch(e){console.error('[TRACK]',e.message);}
}

// ── OG META ───────────────────────────────────────────────────────────────────
function ogMeta(title,desc,shareId=null){
  const img=shareId ? `${BASE_URL}/og/${encodeURIComponent(shareId)}.svg` : `${BASE_URL}/og-default.png`;
  return `<meta property="og:type" content="website">
  <meta property="og:title" content="${esc(title)}">
  <meta property="og:description" content="${esc(desc)}">
  <meta property="og:image" content="${img}">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${esc(title)}">
  <meta name="twitter:description" content="${esc(desc)}">
  <meta name="twitter:image" content="${img}">`;
}

// ── SHARE / TEASER PAGE ───────────────────────────────────────────────────────
function renderSharePage(profile, responseCount) {
  const n    = esc(profile.name);
  const mode = profile.mode === 'romance' ? 'romantic perception' : 'friendship perception';
  const countText = responseCount > 0
    ? `<div class="count">${responseCount} person${responseCount===1?'':'s'} already answered</div>`
    : '';
  return `<!DOCTYPE html>
<html lang="${esc(profile.language||'en')}">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
${ogMeta(`${profile.name} wants to know how you really see them`,`Answer anonymously. Your name is never revealed. Takes 2 minutes.`,profile.share_id)}
<title>${n} — TellMeMore</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=DM+Mono:wght@300;400;500&display=swap">
<style>
*{box-sizing:border-box;margin:0;padding:0}
:root{--bg:#0f0f13;--s1:#16151e;--border:#2a2840;--accent:#7c6af5;--text:#e8e6f0;--muted:#7a78a0;--green:#4ade80}
body{background:var(--bg);color:var(--text);font-family:'DM Mono',ui-monospace,monospace;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:1.5rem}
.card{background:var(--s1);border:1px solid var(--border);border-radius:16px;padding:2.5rem 2rem;max-width:420px;width:100%;text-align:center}
.av{width:72px;height:72px;border-radius:50%;background:var(--accent);display:flex;align-items:center;justify-content:center;font-size:28px;font-weight:500;color:#fff;margin:0 auto 1.5rem}
h1{font-size:1.2rem;font-weight:500;line-height:1.4;margin-bottom:.75rem}
.sub{font-size:.85rem;color:var(--muted);margin-bottom:.5rem;line-height:1.6}
.count{font-size:.75rem;color:var(--muted);margin:.5rem 0}
.anon{font-size:.75rem;color:var(--green);border:1px solid #4ade8030;border-radius:6px;padding:.35rem .75rem;display:inline-block;margin:1rem 0 1.5rem;line-height:1.5}
.btn-p{display:block;width:100%;padding:1rem;background:var(--accent);color:#fff;border:none;border-radius:10px;font-family:inherit;font-size:.95rem;font-weight:500;cursor:pointer;text-decoration:none;margin-bottom:.75rem}
.btn-s{display:block;width:100%;padding:.85rem;background:transparent;color:var(--muted);border:1px solid var(--border);border-radius:10px;font-family:inherit;font-size:.85rem;cursor:pointer;text-decoration:none}
.btn-p:hover{opacity:.9}.btn-s:hover{border-color:var(--accent);color:var(--text)}
.mode{font-size:.7rem;color:var(--muted);letter-spacing:.08em;text-transform:uppercase;margin-bottom:1.5rem}
footer{font-size:.7rem;color:var(--muted);margin-top:1.25rem}footer a{color:var(--muted)}
</style>
</head>
<body>
<div class="card">
  <div class="av">${esc(profile.name.charAt(0).toUpperCase())}</div>
  <p class="mode">${mode}</p>
  <h1>${n} wants to know<br>how you really see them</h1>
  <p class="sub">A few short questions. Takes about 2 minutes.</p>
  ${countText}
  <div class="anon">&#x2714;&nbsp; Your answers are shown without your name.<br>We do not reveal who submitted them.</div>
  <a class="btn-p" href="${esc(BASE_URL)}/r/${esc(profile.slug)}">Answer for ${n}</a>
  <a class="btn-s" href="${esc(BASE_URL)}/">Create your own profile &#x2192;</a>
  <footer><a href="/privacy">Privacy</a> &middot; <a href="/terms">Terms</a></footer>
</div>
</body></html>`;
}

// ── PRIVACY PAGE ──────────────────────────────────────────────────────────────
function renderPrivacyPage(){
  return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Privacy — TellMeMore</title>
<style>body{background:#0f0f13;color:#e8e6f0;font-family:ui-monospace,monospace;max-width:680px;margin:0 auto;padding:3rem 1.5rem;line-height:1.8}h1{font-size:1.3rem;margin-bottom:.5rem}h2{font-size:.95rem;margin:2rem 0 .5rem;color:#7c6af5}p,li{font-size:.875rem;color:#b8b6d0}a{color:#7c6af5}.back{display:inline-block;margin-bottom:2rem;color:#7a78a0;font-size:.8rem;text-decoration:none}</style>
</head><body>
<a class="back" href="/">&larr; Back</a>
<h1>Privacy Policy</h1>
<p>Last updated: ${new Date().toLocaleDateString('en-GB',{year:'numeric',month:'long',day:'numeric'})}</p>
<h2>What we collect</h2>
<ul>
<li>Profile owner email (for account recovery only — not used for marketing)</li>
<li>Profile name and selected mode (friends / romance)</li>
<li>Anonymous perception responses from responders</li>
<li>Basic analytics events (page views, funnel steps) — no personal identifiers attached</li>
<li>Hashed IP address for rate limiting (one-way hash, cannot be reversed to original IP)</li>
</ul>
<h2>What we do not collect</h2>
<ul>
<li>Responder names, email addresses, or accounts</li>
<li>Device fingerprints or advertising identifiers</li>
<li>Any data from third-party advertising networks</li>
</ul>
<h2>Anonymity</h2>
<p>Responder answers are aggregated. Profile owners see signal patterns across all responses — not individual responses linked to a name. Your answers are shown without your name. We do not reveal who submitted them. Note: for legal compliance purposes, hashed technical identifiers (session ID and hashed IP) are stored alongside responses and may be accessed if required by law.</p>
<h2>How we use your data</h2>
<p>Your email is used only to send your magic access link. We do not send marketing email. Perception responses are used solely to generate your result — we do not sell, share, or use this data for advertising.</p>
<h2>Data retention</h2>
<p>Profile and response data is retained until you request deletion. Magic link tokens expire after 24 hours. Session cookies expire after 30 days.</p>
<h2>Age requirement</h2>
<p>You must be at least 16 years old to create a profile or respond to questions.</p>
<h2>Your rights</h2>
<p>You may request full deletion of your profile and all associated responses at any time. Contact: <a href="mailto:privacy@tellmemore.app">privacy@tellmemore.app</a></p>
</body></html>`;
}

// ── TERMS PAGE ────────────────────────────────────────────────────────────────
function renderTermsPage(){
  return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Terms — TellMeMore</title>
<style>body{background:#0f0f13;color:#e8e6f0;font-family:ui-monospace,monospace;max-width:680px;margin:0 auto;padding:3rem 1.5rem;line-height:1.8}h1{font-size:1.3rem;margin-bottom:.5rem}h2{font-size:.95rem;margin:2rem 0 .5rem;color:#7c6af5}p,li{font-size:.875rem;color:#b8b6d0}a{color:#7c6af5}.back{display:inline-block;margin-bottom:2rem;color:#7a78a0;font-size:.8rem;text-decoration:none}</style>
</head><body>
<a class="back" href="/">&larr; Back</a>
<h1>Terms of Use</h1>
<h2>Eligibility</h2><p>You must be at least 16 years old to create a profile or answer questions.</p>
<h2>Acceptable use</h2><p>Do not use TellMeMore to harass, target, or harm others. Profiles created to gather coordinated negative responses about a specific person violate these terms and will be removed. Submitting responses with the intent to harm is prohibited.</p>
<h2>Anonymity and responses</h2><p>Responses are submitted without identity. Profile owners see aggregated perception signals — not individual responses. We reserve the right to remove reported responses that violate these terms.</p>
<h2>No guaranteed accuracy</h2><p>Results represent the aggregated perception of respondents, not objective fact or psychological assessment. TellMeMore is not a clinical tool.</p>
<h2>Data</h2><p>See our <a href="/privacy">Privacy Policy</a>.</p>
</body></html>`;
}

// ── ADMIN DASHBOARD ───────────────────────────────────────────────────────────
function renderAdminPage(){
  const now=Date.now(); const day=864e5; const week=7*day;
  const p  =db.prepare('SELECT COUNT(*) AS n FROM profiles').get().n;
  const r  =db.prepare('SELECT COUNT(*) AS n FROM responses WHERE hidden=0').get().n;
  const rh =db.prepare('SELECT COUNT(*) AS n FROM responses WHERE hidden=1').get().n;
  const rpts=db.prepare('SELECT COUNT(*) AS n FROM reports WHERE resolved=0').get().n;
  const u  =db.prepare('SELECT COUNT(*) AS n FROM users').get().n;
  const pt =db.prepare('SELECT COUNT(*) AS n FROM profiles WHERE created_at>?').get(now-day).n;
  const rt =db.prepare('SELECT COUNT(*) AS n FROM responses WHERE created_at>?').get(now-day).n;
  const avg=db.prepare('SELECT ROUND(AVG(cnt),1) AS a FROM (SELECT COUNT(*) cnt FROM responses WHERE hidden=0 GROUP BY profile_id)').get().a||0;
  const sh =db.prepare("SELECT COUNT(*) AS n FROM analytics WHERE event='share_clicked'").get().n;
  const shAR=db.prepare("SELECT COUNT(*) AS n FROM analytics WHERE event='share_after_result'").get().n;
  const rv =db.prepare("SELECT COUNT(*) AS n FROM analytics WHERE event='result_viewed'").get().n;
  const conv=db.prepare('SELECT COUNT(*) AS n FROM referrals WHERE converted=1').get().n;
  const refT=db.prepare('SELECT COUNT(*) AS n FROM referrals').get().n;
  const kEst=refT>0?((conv/refT)*100).toFixed(1)+'%':'n/a';

  const top=db.prepare('SELECT p.name,p.slug,COUNT(r.id) cnt FROM profiles p LEFT JOIN responses r ON r.profile_id=p.id AND r.hidden=0 GROUP BY p.id ORDER BY cnt DESC LIMIT 10').all();
  const events=db.prepare('SELECT event,COUNT(*) n FROM analytics WHERE created_at>? GROUP BY event ORDER BY n DESC').all(now-week);

  const m=(l,v,warn=false)=>`<tr><td>${l}</td><td style="font-weight:500;color:${warn?'#f87171':'#7c6af5'}">${v}</td></tr>`;
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Admin — TellMeMore</title>
<style>body{background:#0f0f13;color:#e8e6f0;font-family:ui-monospace,monospace;padding:2rem;max-width:960px;margin:0 auto}
h1{font-size:1.1rem;color:#7c6af5;margin-bottom:2rem}h2{font-size:.8rem;color:#7a78a0;text-transform:uppercase;letter-spacing:.08em;margin:2rem 0 .75rem}
table{width:100%;border-collapse:collapse;font-size:.85rem;margin-bottom:1rem}
th,td{padding:.5rem .75rem;text-align:left;border-bottom:1px solid #2a2840}th{color:#7a78a0;font-weight:400}
.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:1rem;margin-bottom:2rem}
.mc{background:#16151e;border:1px solid #2a2840;border-radius:10px;padding:1rem}
.mn{font-size:1.6rem;font-weight:500;color:#7c6af5}.ml{font-size:.75rem;color:#7a78a0;margin-top:.25rem}
.warn{color:#f87171!important}
</style></head><body>
<h1>TellMeMore — Admin Dashboard</h1>
<div class="grid">
<div class="mc"><div class="mn">${p}</div><div class="ml">Total profiles</div></div>
<div class="mc"><div class="mn">${r}</div><div class="ml">Total responses</div></div>
<div class="mc"><div class="mn">${u}</div><div class="ml">Users (owners)</div></div>
<div class="mc"><div class="mn">${avg}</div><div class="ml">Avg responses/profile</div></div>
<div class="mc"><div class="mn">${pt}</div><div class="ml">Profiles today</div></div>
<div class="mc"><div class="mn">${rt}</div><div class="ml">Responses today</div></div>
<div class="mc"><div class="mn ${rpts>0?'warn':''}">${rpts}</div><div class="ml">Open reports</div></div>
<div class="mc"><div class="mn">${rh}</div><div class="ml">Hidden responses</div></div>
</div>

<h2>K-factor indicators</h2>
<table><tbody>
${m('Share clicks',sh)}
${m('Result views',rv)}
${m('Re-shares after result',shAR)}
${m('Total referrals tracked',refT)}
${m('Referral → new profile conversions',conv)}
${m('Responder → creator rate',kEst)}
</tbody></table>

<h2>Top profiles by response count</h2>
<table><thead><tr><th>Name</th><th>Slug</th><th>Responses</th></tr></thead><tbody>
${top.map(t=>`<tr><td>${esc(t.name)}</td><td>${esc(t.slug)}</td><td>${t.cnt}</td></tr>`).join('')}
</tbody></table>

<h2>Analytics events (last 7 days)</h2>
<table><thead><tr><th>Event</th><th>Count</th></tr></thead><tbody>
${events.map(e=>`<tr><td>${esc(e.event)}</td><td>${e.n}</td></tr>`).join('')}
</tbody></table>

<h2>Credibility system</h2>
<table><tbody>
${(()=>{const cv=coverageReport();return [
  m('Question bank version',cv.version),
  m('Total questions',cv.total),
  m('Mapped questions',cv.mapped),
  m('Mapping coverage',cv.coverage,cv.coverage!=='100%'),
  m('Signal count',cv.signalCount),
  m('Unmapped questions',cv.unmapped.length?cv.unmapped.join(','):'None',cv.unmapped.length>0),
].join('');})()}
</tbody></table>

<p style="font-size:.75rem;color:#7a78a0;margin-top:2rem">Refreshed: ${new Date().toISOString()} &nbsp;|&nbsp; <a href="/admin/credibility" style="color:#7c6af5">Run credibility test</a></p>
</body></html>`;
}

// ── HTTP HELPERS ──────────────────────────────────────────────────────────────
function json(res,data,status=200){const b=JSON.stringify(data);res.writeHead(status,{'Content-Type':'application/json','Content-Length':Buffer.byteLength(b)});res.end(b);}
function err(res,msg,status=400){json(res,{error:msg},status);}
function html(res,body,status=200){res.writeHead(status,{'Content-Type':'text/html; charset=utf-8'});res.end(body);}
function redirect(res,loc){res.writeHead(302,{Location:loc});res.end();}
async function readBody(req,max=65536){return new Promise((ok,fail)=>{const c=[];let s=0;req.on('data',d=>{s+=d.length;if(s>max)fail(new Error('too large'));else c.push(d);});req.on('end',()=>ok(Buffer.concat(c).toString('utf8')));req.on('error',fail);});}
async function parseBody(req){return readBody(req).then(b=>{try{return JSON.parse(b);}catch{return{};}});}
function clientIp(req){return(req.headers['x-forwarded-for']||req.socket.remoteAddress||'').split(',')[0].trim();}
function basicAuth(req){const h=req.headers.authorization||'';const d=Buffer.from(h.replace('Basic ',''),'base64').toString();const[,p]=d.split(':');return p;}

// ── SERVER ────────────────────────────────────────────────────────────────────
const server=http.createServer(async(req,res)=>{
  res.setHeader('X-Content-Type-Options','nosniff');
  res.setHeader('X-Frame-Options','DENY');
  res.setHeader('X-XSS-Protection','1; mode=block');
  res.setHeader('Referrer-Policy','strict-origin-when-cross-origin');
  res.setHeader('Content-Security-Policy',
    "default-src 'self'; script-src 'self' 'unsafe-inline' fonts.googleapis.com; style-src 'self' 'unsafe-inline' fonts.googleapis.com fonts.gstatic.com; font-src fonts.gstatic.com; img-src 'self' data:; connect-src 'self'");

  const parsed  =new url.URL(req.url,'http://localhost');
  const pathname=parsed.pathname;
  const method  =req.method;
  const ip      =clientIp(req);

  try {

    // ── STATIC ───────────────────────────────────────────────────────────────
    if(method==='GET'&&(pathname==='/'||pathname.startsWith('/r/'))){
      const c=fs.readFileSync(APP_HTML,'utf8');
      res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Content-Length':Buffer.byteLength(c)});
      return res.end(c);
    }

    // ── PUBLIC SHARE TEASER ───────────────────────────────────────────────────
    if(method==='GET'&&pathname.startsWith('/s/')){
      const sid=sanitize(pathname.slice(3),20);
      const profile=db.prepare('SELECT * FROM profiles WHERE share_id=?').get(sid);
      if(!profile)return html(res,'<body style="background:#0f0f13;color:#e8e6f0;font-family:monospace;padding:2rem">Profile not found.</body>',404);
      const rCount=db.prepare('SELECT COUNT(*) AS n FROM responses WHERE profile_id=? AND hidden=0').get(profile.id).n;
      track('teaser_viewed',{profileId:profile.id,platform:sanitize(req.headers['user-agent']||'',100)});
      return html(res,renderSharePage(profile,rCount));
    }

    if(method==='GET'&&pathname==='/privacy')return html(res,renderPrivacyPage());
    if(method==='GET'&&pathname==='/terms')  return html(res,renderTermsPage());

    // ── ADMIN ─────────────────────────────────────────────────────────────────
    if(method==='GET'&&pathname==='/admin'){
      if(basicAuth(req)!==ADMIN_PASS){res.writeHead(401,{'WWW-Authenticate':'Basic realm="TellMeMore Admin"'});return res.end('Unauthorized');}
      return html(res,renderAdminPage());
    }
    if(method==='GET'&&pathname==='/admin/credibility'){
      if(basicAuth(req)!==ADMIN_PASS){res.writeHead(401,{'WWW-Authenticate':'Basic realm="TellMeMore Admin"'});return res.end('Unauthorized');}
      const r=credibilityTest();
      const cv=coverageReport();
      return json(res,{coverageReport:cv,credibilityTest:r});
    }

    // ── API: CREATE PROFILE ───────────────────────────────────────────────────
    if(method==='POST'&&pathname==='/api/profile'){
      if(!rateLimit(`prof:${hashIp(ip)}`,5,3600000))return err(res,'Too many profiles. Try again later.',429);
      const body=await parseBody(req);
      const name =sanitize(body.name||'',60);
      const mode =['friends','romance'].includes(body.mode)?body.mode:'friends';
      const lang =sanitize(body.language||'en',10);
      const email=sanitize(body.email||'',200).toLowerCase();
      if(!name||name.length<2)return err(res,'Name is required (min 2 chars).');
      if(!email||!email.includes('@'))return err(res,'Valid email is required to recover your results.');
      let user=db.prepare('SELECT * FROM users WHERE email=?').get(email);
      if(!user){user={id:uid()};db.prepare('INSERT INTO users(id,email,created_at)VALUES(?,?,?)').run(user.id,email,Date.now());}
      const profileId=uid(); const slug=slugify(name); const sId=shareId(); const sessionTok=tok();
      db.prepare('INSERT INTO profiles(id,user_id,slug,share_id,name,mode,language,question_version,created_at)VALUES(?,?,?,?,?,?,?,?,?)').run(profileId,user.id,slug,sId,name,mode,lang,QUESTION_BANK_VERSION,Date.now());
      db.prepare('INSERT INTO owner_sessions(token,user_id,profile_id,expires_at)VALUES(?,?,?,?)').run(sessionTok,user.id,profileId,Date.now()+30*864e5);
      setSessionCookie(res,sessionTok);
      track('profile_created',{profileId,userId:user.id,language:lang});
      return json(res,{profileId,slug,shareId:sId,shareUrl:`${BASE_URL}/s/${sId}`,respondUrl:`${BASE_URL}/r/${slug}`,name,mode},201);
    }

    // ── API: ME ───────────────────────────────────────────────────────────────
    if(method==='GET'&&pathname==='/api/me'){
      const sess=validateSession(getSession(req));
      if(!sess)return err(res,'Not authenticated.',401);
      const profile=db.prepare('SELECT id,slug,share_id,name,mode,language FROM profiles WHERE id=?').get(sess.profileId);
      return json(res,{userId:sess.userId,profileId:sess.profileId,profile});
    }

    // ── API: PROFILE (public) ─────────────────────────────────────────────────
    if(method==='GET'&&pathname.startsWith('/api/profile/')){
      const slug=sanitize(pathname.slice(13),60);
      const profile=db.prepare('SELECT id,slug,share_id,name,mode,language FROM profiles WHERE slug=?').get(slug);
      if(!profile)return err(res,'Profile not found.',404);
      const questions=getQuestionsForMode(profile.mode);
      return json(res,{profile,questions});
    }

    // ── API: AUTH/EMAIL (magic link request) ──────────────────────────────────
    if(method==='POST'&&pathname==='/api/auth/email'){
      if(!rateLimit(`auth:${hashIp(ip)}`,5,3600000))return err(res,'Too many requests. Try again later.',429);
      const body=await parseBody(req);
      const email=sanitize(body.email||'',200).toLowerCase();
      if(!email||!email.includes('@'))return err(res,'Valid email required.');
      const user=db.prepare('SELECT * FROM users WHERE email=?').get(email);
      if(!user)return json(res,{sent:false,message:'No profile found with that email.'});
      const profile=db.prepare('SELECT * FROM profiles WHERE user_id=? ORDER BY created_at DESC LIMIT 1').get(user.id);
      db.prepare('UPDATE magic_tokens SET used=1 WHERE user_id=?').run(user.id);
      const t=tok();
      db.prepare('INSERT INTO magic_tokens(token,user_id,profile_id,expires_at,used)VALUES(?,?,?,?,0)').run(t,user.id,profile?.id||null,Date.now()+24*3600000);
      const magicUrl=`${BASE_URL}/api/auth/verify?token=${t}`;
      const emailSent=await sendMagicEmail(email,magicUrl);
      track('return_requested',{userId:user.id});
      return json(res,{sent:emailSent,magicUrl:process.env.RESEND_API_KEY?null:magicUrl});
    }

    // ── API: AUTH/VERIFY ──────────────────────────────────────────────────────
    if(method==='GET'&&pathname==='/api/auth/verify'){
      const t=sanitize(parsed.searchParams.get('token')||'',70);
      const row=db.prepare('SELECT * FROM magic_tokens WHERE token=? AND used=0 AND expires_at>?').get(t,Date.now());
      if(!row)return redirect(res,'/?auth=expired');
      db.prepare('UPDATE magic_tokens SET used=1 WHERE token=?').run(t);
      if(!row.profile_id)return redirect(res,'/?auth=noprofile');
      const sessionTok=tok();
      db.prepare('INSERT INTO owner_sessions(token,user_id,profile_id,expires_at)VALUES(?,?,?,?)').run(sessionTok,row.user_id,row.profile_id,Date.now()+30*864e5);
      setSessionCookie(res,sessionTok);
      return redirect(res,`/r/results?verified=1`);
    }

    // ── API: LOGOUT ───────────────────────────────────────────────────────────
    if(method==='DELETE'&&pathname==='/api/auth/logout'){
      const t=getSession(req);if(t)db.prepare('DELETE FROM owner_sessions WHERE token=?').run(t);
      clearCookie(res);return json(res,{ok:true});
    }

    // ── API: RESULTS ──────────────────────────────────────────────────────────
    if(method==='GET'&&pathname.startsWith('/api/results/')){
      const sess=validateSession(getSession(req));
      if(!sess)return err(res,'Not authenticated.',401);
      const profileId=sanitize(pathname.slice(13),40);
      if(sess.profileId!==profileId)return err(res,'Forbidden.',403);
      const profile=db.prepare('SELECT * FROM profiles WHERE id=?').get(profileId);
      if(!profile)return err(res,'Profile not found.',404);
      const rows=db.prepare('SELECT answers,created_at FROM responses WHERE profile_id=? AND hidden=0').all(profileId);
      const result=computeResult(rows);
      track('result_viewed',{profileId,userId:sess.userId,language:profile.language});
      return json(res,{profile:{name:profile.name,mode:profile.mode,shareId:profile.share_id,slug:profile.slug},result});
    }

    // ── API: SUBMIT RESPONSE ──────────────────────────────────────────────────
    if(method==='POST'&&pathname==='/api/responses'){
      if(!rateLimit(`resp:${hashIp(ip)}`,30,3600000))return err(res,'Too many submissions. Try again later.',429);
      const body=await parseBody(req);
      const profileId =sanitize(body.profileId||'',40);
      const sessionId =sanitize(body.sessionId||uid(),40);
      const refProfId =sanitize(body.refProfileId||'',40);
      const src       =sanitize(body.src||'',50);
      const lang      =sanitize(body.language||'en',10);
      const profile=db.prepare('SELECT * FROM profiles WHERE id=?').get(profileId);
      if(!profile)return err(res,'Profile not found.',404);
      if(!rateLimit(`resp:${hashIp(ip)}:${profileId}`,1,3600000))return err(res,'You have already responded to this profile recently.',429);
      const rawAns=body.answers||{};
      if(typeof rawAns!=='object'||Array.isArray(rawAns))return err(res,'Invalid answers format.');
      const questions=getQuestionsForMode(profile.mode);
      const safe={};let answered=0;
      for(const[qid,optId]of Object.entries(rawAns)){
        const q=questions.find(x=>x.id===sanitize(qid,10));if(!q)continue;
        const o=q.options.find(o=>o.id===sanitize(String(optId),5));if(!o)continue;
        safe[q.id]=o.id;answered++;
      }
      if(answered<5)return err(res,'Please answer at least 5 questions.');
      const responseId=uid();
      db.prepare('INSERT INTO responses(id,profile_id,session_id,answers,ref_profile_id,src,ip_hash,hidden,reported,created_at)VALUES(?,?,?,?,?,?,?,0,0,?)').run(responseId,profileId,sessionId,JSON.stringify(safe),refProfId||null,src||null,hashIp(ip),Date.now());
      if(refProfId){
        db.prepare('INSERT OR IGNORE INTO referrals(id,share_id,referrer_profile_id,responder_session,src,converted,created_at)VALUES(?,?,?,?,?,0,?)').run(uid(),profile.share_id,refProfId,sessionId,src||null,Date.now());
      }
      track('response_submitted',{profileId,sessionId,language:lang});
      return json(res,{ok:true,responseId},201);
    }

    // ── API: DELETE RESPONSE (owner) ──────────────────────────────────────────
    if(method==='DELETE'&&pathname.startsWith('/api/responses/')){
      const sess=validateSession(getSession(req));if(!sess)return err(res,'Not authenticated.',401);
      const responseId=sanitize(pathname.slice(15),40);
      const row=db.prepare('SELECT * FROM responses WHERE id=?').get(responseId);
      if(!row)return err(res,'Not found.',404);
      if(row.profile_id!==sess.profileId)return err(res,'Forbidden.',403);
      db.prepare('UPDATE responses SET hidden=1 WHERE id=?').run(responseId);
      return json(res,{ok:true});
    }

    // ── API: REPORT ───────────────────────────────────────────────────────────
    if(method==='POST'&&pathname==='/api/report'){
      const body=await parseBody(req);
      const responseId=sanitize(body.responseId||'',40);
      const reason    =sanitize(body.reason||'',300);
      const sessionId =sanitize(body.sessionId||'',40);
      const row=db.prepare('SELECT * FROM responses WHERE id=?').get(responseId);
      if(!row)return err(res,'Response not found.',404);
      db.prepare('UPDATE responses SET reported=1 WHERE id=?').run(responseId);
      db.prepare('INSERT INTO reports(id,response_id,reporter_session,reason,resolved,created_at)VALUES(?,?,?,?,0,?)').run(uid(),responseId,sessionId||null,reason||null,Date.now());
      return json(res,{ok:true});
    }

    // ── API: TRACK ────────────────────────────────────────────────────────────
    if(method==='POST'&&pathname==='/api/track'){
      const body=await parseBody(req);
      const allowed=new Set(['profile_created','responder_started','question_answered','response_submitted','result_viewed','share_clicked','share_after_result','teaser_viewed','responder_converted','return_requested','result_unlocked','own_profile_created_after_response']);
      const event=sanitize(body.event||'',60);
      if(!allowed.has(event))return err(res,'Unknown event.');
      track(event,{profileId:sanitize(body.profileId||'',40),sessionId:sanitize(body.sessionId||'',40),userId:sanitize(body.userId||'',40),language:sanitize(body.language||'',10),platform:sanitize(body.platform||'',100),metadata:body.metadata||null});
      return json(res,{ok:true});
    }

    // ── API: REFERRAL CONVERT ─────────────────────────────────────────────────
    if(method==='POST'&&pathname==='/api/referral/convert'){
      const body=await parseBody(req);
      const sessionId        =sanitize(body.sessionId||'',40);
      const invitedProfileId =sanitize(body.invitedProfileId||'',40);
      db.prepare('UPDATE referrals SET converted=1,invited_profile_id=? WHERE responder_session=? AND converted=0').run(invitedProfileId,sessionId);
      track('own_profile_created_after_response',{profileId:invitedProfileId,sessionId});
      return json(res,{ok:true});
    }

    // ── DYNAMIC OG SVG CARD ──────────────────────────────────────────────────
    if(method==='GET'&&pathname.startsWith('/og/')&&pathname.endsWith('.svg')){
      const sid=sanitize(pathname.slice(4,pathname.length-4),20);
      const profile=db.prepare('SELECT * FROM profiles WHERE share_id=?').get(sid);
      if(!profile){res.writeHead(404);return res.end('Not found');}
      const responseRows=db.prepare('SELECT answers FROM responses WHERE profile_id=? AND hidden=0 LIMIT 20').all(profile.id);
      const rCount=responseRows.length;
      // Get top signal if enough responses
      let sigKey=null,sigLabel=null,sigLabelTr=null;
      if(rCount>=1){
        try{
          const {computeResult,SIGNALS}=require('./questions.js');
          const result=computeResult(responseRows);
          if(result.primary){
            sigKey=result.primary.signal;
            sigLabel=SIGNALS[sigKey].label;
            sigLabelTr=SIGNALS[sigKey].label_tr;
          }
        }catch(e){console.error('[OG]',e.message);}
      }
      const svg=generateOgCard({
        name:profile.name, lang:profile.language||'en', mode:profile.mode,
        signalKey:sigKey, signalLabel:sigLabel, signalLabelTr:sigLabelTr,
        responseCount:rCount
      });
      res.writeHead(200,{'Content-Type':'image/svg+xml','Cache-Control':'public, max-age=300'});
      return res.end(svg);
    }

    res.writeHead(404,{'Content-Type':'application/json'});res.end(JSON.stringify({error:'Not found'}));

  }catch(e){
    console.error('[ERR]',e.message);
    if(process.env.NODE_ENV!=='production')console.error(e.stack);
    json(res,{error:'Internal server error'},500);
  }
});

server.listen(PORT,'0.0.0.0',()=>{
  console.log(`[TMM] Server v3 running on port ${PORT} — ${BASE_URL}`);
  console.log(`[TMM] DB: ${require('./migrations.js').DB_PATH}`);
  console.log(`[TMM] Questions: ${require('./questions.js').coverageReport().total} | Coverage: ${require('./questions.js').coverageReport().coverage}`);
  console.log(`[TMM] Email: ${process.env.RESEND_API_KEY?'RESEND configured':'Alpha mode — magic link in response'}`);
  console.log(`[TMM] Admin: ${BASE_URL}/admin`);
});

module.exports=server;
