'use strict';
// ─────────────────────────────────────────────────────────────────────────────
// TellMeMore — Server v2 (soft-launch candidate)
// Node.js 22+, zero npm deps, node:sqlite
// All hard blockers + must-fixes applied (see audit board).
// ─────────────────────────────────────────────────────────────────────────────

const http    = require('node:http');
const https   = require('node:https');
const crypto  = require('node:crypto');
const fs      = require('node:fs');
const path    = require('node:path');
const url     = require('node:url');

const { initDb }       = require('./migrations.js');
const { computeResult, getQuestionsForMode, SIGNALS, UNLOCK_THRESHOLDS, QUESTION_BANK_VERSION } = require('./questions.js');

const PORT     = parseInt(process.env.PORT || '3000', 10);
const BASE_URL = (process.env.BASE_URL || `https://tellmemore-production.up.railway.app`).replace(/\/$/, '');
const ADMIN_PASS = process.env.ADMIN_PASS || 'tmm-admin-2024';
const APP_HTML_PATH = path.join(__dirname, 'app.html');
const IP_SALT  = process.env.IP_SALT || crypto.randomBytes(16).toString('hex');

// ─── DB ──────────────────────────────────────────────────────────────────────
const db = initDb();

// ─── HELPERS ─────────────────────────────────────────────────────────────────

// XSS: escape all user-controlled text before putting it in HTML context.
function esc(str) {
  if (typeof str !== 'string') return '';
  return str
    .replace(/&/g,  '&amp;')
    .replace(/</g,  '&lt;')
    .replace(/>/g,  '&gt;')
    .replace(/"/g,  '&quot;')
    .replace(/'/g,  '&#x27;')
    .replace(/\//g, '&#x2F;');
}

// Sanitize for storage: strip all tags, limit length.
function sanitize(str, maxLen = 500) {
  if (typeof str !== 'string') return '';
  return str.replace(/<[^>]*>/g, '').replace(/[^\S ]/g, ' ').trim().slice(0, maxLen);
}

function uid()     { return crypto.randomBytes(16).toString('hex'); }
function token()   { return crypto.randomBytes(32).toString('hex'); }
function hashIp(ip){ return crypto.createHash('sha256').update(ip + IP_SALT).digest('hex').slice(0, 16); }

function slugify(name) {
  return name.toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40) + '-' + crypto.randomBytes(3).toString('hex');
}

function shareId() {
  return crypto.randomBytes(6).toString('hex');
}

// ─── IN-MEMORY RATE LIMITER ───────────────────────────────────────────────────
const _rlMap = new Map();
setInterval(() => {
  const now = Date.now();
  for (const [k, r] of _rlMap) { if (now > r.reset + 120_000) _rlMap.delete(k); }
}, 300_000);

function rateLimit(key, max, windowMs) {
  const now = Date.now();
  let r = _rlMap.get(key);
  if (!r || now > r.reset) { r = { n: 0, reset: now + windowMs }; _rlMap.set(key, r); }
  r.n++;
  return r.n <= max;
}

// ─── SESSION HELPERS ─────────────────────────────────────────────────────────
function getSession(req) {
  const c = req.headers.cookie || '';
  const m = c.match(/tmm_session=([a-f0-9]{64})/);
  return m ? m[1] : null;
}

function setSessionCookie(res, tok, days = 30) {
  const exp = new Date(Date.now() + days * 864e5).toUTCString();
  res.setHeader('Set-Cookie', `tmm_session=${tok}; Path=/; Expires=${exp}; HttpOnly; SameSite=Lax`);
}

function clearCookie(res) {
  res.setHeader('Set-Cookie', 'tmm_session=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; HttpOnly; SameSite=Lax');
}

// Returns { userId, profileId } or null
function validateSession(sessionToken) {
  if (!sessionToken) return null;
  const row = db.prepare(
    'SELECT user_id, profile_id FROM owner_sessions WHERE token=? AND expires_at>?'
  ).get(sessionToken, Date.now());
  return row ? { userId: row.user_id, profileId: row.profile_id } : null;
}

// ─── MAGIC LINK EMAIL ────────────────────────────────────────────────────────
async function sendMagicLinkEmail(email, magicUrl) {
  if (!process.env.RESEND_API_KEY) {
    // Alpha mode: log. Client gets the URL back in the response.
    console.log(`[AUTH] Magic link → ${email}: ${magicUrl}`);
    return false;
  }
  const body = JSON.stringify({
    from:    'TellMeMore <noreply@tellmemore.app>',
    to:      [email],
    subject: 'Your TellMeMore results link',
    html:    `<p style="font-family:monospace">Click to view your results:</p>
              <a href="${magicUrl}" style="font-family:monospace">${magicUrl}</a>
              <p style="font-family:monospace;color:#888;font-size:12px">Link expires in 24 hours.</p>`
  });
  return new Promise(resolve => {
    const req = https.request({
      hostname: 'api.resend.com', path: '/emails', method: 'POST',
      headers: {
        'Authorization':  `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type':   'application/json',
        'Content-Length': Buffer.byteLength(body)
      }
    }, res => {
      let d = ''; res.on('data', c => d += c);
      res.on('end', () => resolve(res.statusCode < 300));
    });
    req.on('error', () => resolve(false));
    req.write(body); req.end();
  });
}

// ─── HTTP HELPERS ────────────────────────────────────────────────────────────
function json(res, data, status = 200) {
  const body = JSON.stringify(data);
  res.writeHead(status, { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) });
  res.end(body);
}

function err(res, msg, status = 400) { json(res, { error: msg }, status); }

function html(res, body, status = 200) {
  res.writeHead(status, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(body);
}

function redirect(res, location) {
  res.writeHead(302, { Location: location }); res.end();
}

async function readBody(req, maxBytes = 65536) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', c => { size += c.length; if (size > maxBytes) { reject(new Error('body too large')); } else chunks.push(c); });
    req.on('end',  () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

function parseBody(req) {
  return readBody(req).then(b => { try { return JSON.parse(b); } catch { return {}; } });
}

function clientIp(req) {
  return (req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',')[0].trim();
}

// ─── ANALYTICS HELPER ────────────────────────────────────────────────────────
function track(event, fields = {}) {
  try {
    db.prepare(`
      INSERT INTO analytics (id, event, profile_id, session_id, user_id, language, platform, metadata, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      uid(), event,
      fields.profileId  || null,
      fields.sessionId  || null,
      fields.userId     || null,
      sanitize(fields.language  || '', 10),
      sanitize(fields.platform  || '', 50),
      fields.metadata ? JSON.stringify(fields.metadata) : null,
      Date.now()
    );
  } catch (e) { console.error('[TRACK]', e.message); }
}

// ─── OG META HELPER ──────────────────────────────────────────────────────────
function ogMeta(title, desc, imageUrl = '') {
  const img = imageUrl || `${BASE_URL}/og-default.png`;
  return `
  <meta property="og:type"        content="website">
  <meta property="og:title"       content="${esc(title)}">
  <meta property="og:description" content="${esc(desc)}">
  <meta property="og:image"       content="${esc(img)}">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta name="twitter:card"       content="summary_large_image">
  <meta name="twitter:title"      content="${esc(title)}">
  <meta name="twitter:description" content="${esc(desc)}">
  <meta name="twitter:image"      content="${esc(img)}">`;
}

// ─── SHARE / TEASER PAGE ─────────────────────────────────────────────────────
function renderSharePage(profile) {
  const name   = esc(profile.name);
  const mode   = profile.mode === 'romance' ? 'romantic' : 'friendship';
  const lang   = profile.language || 'en';
  const respUrl = `${BASE_URL}/r/${esc(profile.slug)}`;
  const createUrl = `${BASE_URL}/`;
  const og = ogMeta(
    `${profile.name} wants to know how you really see them`,
    `Answer anonymously. Your name is never revealed. Takes 2 minutes.`
  );

  return `<!DOCTYPE html>
<html lang="${esc(lang)}">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>${name} — TellMeMore</title>
${og}
<style>
*{box-sizing:border-box;margin:0;padding:0}
:root{--bg:#0f0f13;--surface:#16151e;--border:#2a2840;--accent:#7c6af5;--text:#e8e6f0;--muted:#7a78a0;--green:#4ade80}
body{background:var(--bg);color:var(--text);font-family:'DM Mono',ui-monospace,monospace;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:1.5rem}
@import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@300;400;500&display=swap');
.card{background:var(--surface);border:1px solid var(--border);border-radius:16px;padding:2.5rem 2rem;max-width:420px;width:100%;text-align:center}
.avatar{width:72px;height:72px;border-radius:50%;background:var(--accent);display:flex;align-items:center;justify-content:center;font-size:28px;font-weight:500;color:#fff;margin:0 auto 1.5rem}
.title{font-size:1.25rem;font-weight:500;margin-bottom:.75rem;line-height:1.4}
.sub{font-size:.85rem;color:var(--muted);margin-bottom:.5rem;line-height:1.6}
.anon{font-size:.75rem;color:var(--green);border:1px solid var(--green);border-radius:6px;padding:.35rem .75rem;display:inline-block;margin:1rem 0 1.5rem;letter-spacing:.04em}
.btn-primary{display:block;width:100%;padding:1rem;background:var(--accent);color:#fff;border:none;border-radius:10px;font-family:inherit;font-size:1rem;font-weight:500;cursor:pointer;text-decoration:none;margin-bottom:.75rem;letter-spacing:.02em}
.btn-secondary{display:block;width:100%;padding:.85rem;background:transparent;color:var(--muted);border:1px solid var(--border);border-radius:10px;font-family:inherit;font-size:.85rem;cursor:pointer;text-decoration:none;letter-spacing:.02em}
.btn-primary:hover{opacity:.9}.btn-secondary:hover{border-color:var(--accent);color:var(--text)}
.mode-badge{font-size:.7rem;color:var(--muted);letter-spacing:.08em;text-transform:uppercase;margin-bottom:1.5rem}
</style>
</head>
<body>
<div class="card">
  <div class="avatar">${esc(profile.name.charAt(0).toUpperCase())}</div>
  <p class="mode-badge">${esc(mode)} perception</p>
  <h1 class="title">${name} wants to know<br>how you really see them</h1>
  <p class="sub">Answer a few short questions. Takes about 2 minutes.<br>Your identity is never revealed.</p>
  <div class="anon">&#x2714;&nbsp; Your answers are shown without your name. We do not reveal who submitted them.</div>
  <a class="btn-primary" href="${respUrl}">Answer for ${name}</a>
  <a class="btn-secondary" href="${createUrl}">Create your own TellMeMore profile &#x2192;</a>
</div>
</body>
</html>`;
}

// ─── PRIVACY PAGE ─────────────────────────────────────────────────────────────
function renderPrivacyPage() {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Privacy Policy — TellMeMore</title>
<style>
body{background:#0f0f13;color:#e8e6f0;font-family:ui-monospace,monospace;max-width:680px;margin:0 auto;padding:3rem 1.5rem;line-height:1.8}
h1{font-size:1.4rem;margin-bottom:.5rem}h2{font-size:1rem;margin:2rem 0 .5rem;color:#7c6af5}
p,li{font-size:.875rem;color:#b8b6d0}a{color:#7c6af5}
.back{display:inline-block;margin-bottom:2rem;color:#7a78a0;font-size:.8rem;text-decoration:none}
</style>
</head>
<body>
<a class="back" href="/">&larr; Back</a>
<h1>Privacy Policy</h1>
<p>Last updated: ${new Date().toLocaleDateString('en-GB', {year:'numeric',month:'long',day:'numeric'})}</p>
<h2>What we collect</h2>
<ul>
<li>Profile owner email address (for account recovery only)</li>
<li>Profile name and selected mode (friends / romance)</li>
<li>Anonymous perception responses from responders</li>
<li>Basic analytics events (page views, funnel steps) — no PII</li>
<li>Hashed IP address for rate limiting (not stored in readable form)</li>
</ul>
<h2>What we do not collect</h2>
<ul>
<li>Responder names or email addresses</li>
<li>Device identifiers or tracking cookies from responders</li>
<li>Any data from third-party advertising networks</li>
</ul>
<h2>How we use it</h2>
<p>Your email is used only to send magic login links so you can return to your results. We do not send marketing email. Perception responses are aggregated to produce your result — no individual response is publicly visible.</p>
<h2>Anonymity</h2>
<p>Responders answer without creating an account. We do not store any information that links a response to a specific person. Profile owners see aggregate results only — never who said what.</p>
<h2>Data retention</h2>
<p>Profile data is retained until you request deletion. Magic login tokens expire after 24 hours. You can request full deletion by emailing us.</p>
<h2>Age requirement</h2>
<p>You must be at least 16 years old to create a profile or respond to questions.</p>
<h2>Your rights</h2>
<p>You may request deletion of your data at any time. To delete your profile and all associated responses, contact: <a href="mailto:privacy@tellmemore.app">privacy@tellmemore.app</a></p>
<h2>Contact</h2>
<p><a href="mailto:privacy@tellmemore.app">privacy@tellmemore.app</a></p>
</body>
</html>`;
}

// ─── TERMS PAGE ──────────────────────────────────────────────────────────────
function renderTermsPage() {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Terms of Use — TellMeMore</title>
<style>
body{background:#0f0f13;color:#e8e6f0;font-family:ui-monospace,monospace;max-width:680px;margin:0 auto;padding:3rem 1.5rem;line-height:1.8}
h1{font-size:1.4rem;margin-bottom:.5rem}h2{font-size:1rem;margin:2rem 0 .5rem;color:#7c6af5}
p,li{font-size:.875rem;color:#b8b6d0}a{color:#7c6af5}
.back{display:inline-block;margin-bottom:2rem;color:#7a78a0;font-size:.8rem;text-decoration:none}
</style>
</head>
<body>
<a class="back" href="/">&larr; Back</a>
<h1>Terms of Use</h1>
<p>By using TellMeMore you agree to these terms.</p>
<h2>Eligibility</h2>
<p>You must be at least 16 years old. By creating a profile you confirm this.</p>
<h2>Acceptable use</h2>
<p>You may not use TellMeMore to harass, bully, or harm other people. Profiles created to gather targeted abuse responses will be removed. Submitting false or harmful responses is prohibited.</p>
<h2>Anonymity and responsibility</h2>
<p>Responses are anonymous but must remain respectful. We reserve the right to remove reported responses that violate these terms. Profile owners are responsible for the profiles they create.</p>
<h2>No guarantees</h2>
<p>Perception results are aggregated from anonymous responses. They represent the perceptions of respondents, not objective facts. TellMeMore is not a psychological assessment tool.</p>
<h2>Data</h2>
<p>See our <a href="/privacy">Privacy Policy</a>.</p>
<h2>Changes</h2>
<p>We may update these terms. Continued use constitutes acceptance.</p>
</body>
</html>`;
}

// ─── ADMIN DASHBOARD ─────────────────────────────────────────────────────────
function renderAdminPage() {
  const profiles  = db.prepare('SELECT COUNT(*) AS n FROM profiles').get().n;
  const responses = db.prepare('SELECT COUNT(*) AS n FROM responses WHERE hidden=0').get().n;
  const hidden    = db.prepare('SELECT COUNT(*) AS n FROM responses WHERE hidden=1').get().n;
  const reports   = db.prepare('SELECT COUNT(*) AS n FROM reports WHERE resolved=0').get().n;
  const users     = db.prepare('SELECT COUNT(*) AS n FROM users').get().n;
  const shares    = db.prepare("SELECT COUNT(*) AS n FROM analytics WHERE event='share_clicked'").get().n;
  const results   = db.prepare("SELECT COUNT(*) AS n FROM analytics WHERE event='result_viewed'").get().n;
  const conversions = db.prepare("SELECT COUNT(*) AS n FROM referrals WHERE converted=1").get().n;
  const referrals   = db.prepare("SELECT COUNT(*) AS n FROM referrals").get().n;

  const today = new Date(); today.setHours(0,0,0,0);
  const newToday = db.prepare('SELECT COUNT(*) AS n FROM profiles WHERE created_at>?').get(today.getTime()).n;
  const respToday = db.prepare('SELECT COUNT(*) AS n FROM responses WHERE created_at>?').get(today.getTime()).n;

  const topProfiles = db.prepare(`
    SELECT p.name, p.slug, COUNT(r.id) AS resp_count
    FROM profiles p LEFT JOIN responses r ON r.profile_id=p.id AND r.hidden=0
    GROUP BY p.id ORDER BY resp_count DESC LIMIT 10
  `).all();

  const dropoff = db.prepare(`
    SELECT event, COUNT(*) AS n FROM analytics
    WHERE created_at > ? GROUP BY event ORDER BY n DESC
  `).all(Date.now() - 7 * 864e5);

  function row(label, val) { return `<tr><td>${label}</td><td><strong>${val}</strong></td></tr>`; }

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Admin — TellMeMore</title>
<style>
body{background:#0f0f13;color:#e8e6f0;font-family:ui-monospace,monospace;padding:2rem;max-width:900px;margin:0 auto}
h1{font-size:1.2rem;margin-bottom:2rem;color:#7c6af5}h2{font-size:.9rem;color:#7a78a0;margin:2rem 0 .75rem;text-transform:uppercase;letter-spacing:.08em}
table{width:100%;border-collapse:collapse;font-size:.85rem;margin-bottom:1rem}
th,td{padding:.5rem .75rem;text-align:left;border-bottom:1px solid #2a2840}
th{color:#7a78a0;font-weight:400}td strong{color:#7c6af5}
.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:1rem;margin-bottom:2rem}
.metric{background:#16151e;border:1px solid #2a2840;border-radius:10px;padding:1rem}
.metric-n{font-size:1.6rem;font-weight:500;color:#7c6af5}.metric-l{font-size:.75rem;color:#7a78a0;margin-top:.25rem}
.badge-warn{background:#7c3f0020;color:#f59e0b;border:1px solid #f59e0b40;border-radius:4px;padding:.15rem .4rem;font-size:.75rem}
</style>
</head>
<body>
<h1>TellMeMore — Admin</h1>
<div class="grid">
  <div class="metric"><div class="metric-n">${profiles}</div><div class="metric-l">Total profiles</div></div>
  <div class="metric"><div class="metric-n">${responses}</div><div class="metric-l">Total responses</div></div>
  <div class="metric"><div class="metric-n">${users}</div><div class="metric-l">Registered users</div></div>
  <div class="metric"><div class="metric-n">${newToday}</div><div class="metric-l">Profiles today</div></div>
  <div class="metric"><div class="metric-n">${respToday}</div><div class="metric-l">Responses today</div></div>
  <div class="metric"><div class="metric-n">${reports}</div><div class="metric-l">Open reports ${reports > 0 ? '<span class="badge-warn">!</span>' : ''}</div></div>
</div>

<h2>Funnel (all time)</h2>
<table>
  ${row('Share clicks', shares)}
  ${row('Result views', results)}
  ${row('Referrals tracked', referrals)}
  ${row('Responder → creator conversions', conversions)}
  ${row('Conversion rate', referrals > 0 ? ((conversions/referrals)*100).toFixed(1)+'%' : 'n/a')}
  ${row('Hidden responses', hidden)}
</table>

<h2>Top profiles by response count</h2>
<table>
<thead><tr><th>Name</th><th>Slug</th><th>Responses</th></tr></thead>
<tbody>
${topProfiles.map(p => `<tr><td>${esc(p.name)}</td><td>${esc(p.slug)}</td><td>${p.resp_count}</td></tr>`).join('')}
</tbody>
</table>

<h2>Analytics events (last 7 days)</h2>
<table>
<thead><tr><th>Event</th><th>Count</th></tr></thead>
<tbody>
${dropoff.map(e => `<tr><td>${esc(e.event)}</td><td>${e.n}</td></tr>`).join('')}
</tbody>
</table>
<p style="font-size:.75rem;color:#7a78a0;margin-top:2rem">Refreshed: ${new Date().toISOString()}</p>
</body>
</html>`;
}

// ─── ROUTER ──────────────────────────────────────────────────────────────────
const server = http.createServer(async (req, res) => {
  // Security headers
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Content-Security-Policy',
    "default-src 'self'; script-src 'self' 'unsafe-inline' fonts.googleapis.com; style-src 'self' 'unsafe-inline' fonts.googleapis.com fonts.gstatic.com; font-src fonts.gstatic.com; img-src 'self' data:; connect-src 'self'");

  const parsed   = new url.URL(req.url, `http://localhost`);
  const pathname = parsed.pathname;
  const method   = req.method;
  const ip       = clientIp(req);

  try {

    // ── STATIC: serve app HTML ──────────────────────────────────────────────
    if (method === 'GET' && (pathname === '/' || pathname.startsWith('/r/'))) {
      const content = fs.readFileSync(APP_HTML_PATH, 'utf8');
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Content-Length': Buffer.byteLength(content) });
      return res.end(content);
    }

    // ── PUBLIC SHARE / TEASER PAGE ─────────────────────────────────────────
    if (method === 'GET' && pathname.startsWith('/s/')) {
      const shareId = sanitize(pathname.slice(3), 20);
      const profile = db.prepare('SELECT * FROM profiles WHERE share_id=?').get(shareId);
      if (!profile) return html(res, '<h1 style="font-family:monospace;color:#e8e6f0;background:#0f0f13;padding:2rem">Profile not found.</h1>', 404);
      track('teaser_viewed', { profileId: profile.id, platform: req.headers['user-agent'] });
      return html(res, renderSharePage(profile));
    }

    // ── PRIVACY & TERMS ────────────────────────────────────────────────────
    if (method === 'GET' && pathname === '/privacy') return html(res, renderPrivacyPage());
    if (method === 'GET' && pathname === '/terms')   return html(res, renderTermsPage());

    // ── ADMIN (basic auth) ─────────────────────────────────────────────────
    if (method === 'GET' && pathname === '/admin') {
      const authHeader = req.headers.authorization || '';
      const encoded    = authHeader.replace('Basic ', '');
      const decoded    = Buffer.from(encoded, 'base64').toString('utf8');
      const [, pass]   = decoded.split(':');
      if (pass !== ADMIN_PASS) {
        res.writeHead(401, { 'WWW-Authenticate': 'Basic realm="TellMeMore Admin"' });
        return res.end('Unauthorized');
      }
      return html(res, renderAdminPage());
    }

    // ── API ────────────────────────────────────────────────────────────────
    // All API routes return JSON.

    // POST /api/profile — create profile
    if (method === 'POST' && pathname === '/api/profile') {
      if (!rateLimit(`profile:${hashIp(ip)}`, 5, 3_600_000))
        return err(res, 'Too many profiles. Try again later.', 429);

      const body = await parseBody(req);
      const name = sanitize(body.name || '', 60);
      const mode = ['friends','romance'].includes(body.mode) ? body.mode : 'friends';
      const lang = sanitize(body.language || 'en', 10);
      const email = sanitize(body.email || '', 200).toLowerCase();

      if (!name || name.length < 2) return err(res, 'Name is required (min 2 chars).');
      if (!email || !email.includes('@')) return err(res, 'Valid email is required to recover your results.');

      // Upsert user
      let user = db.prepare('SELECT * FROM users WHERE email=?').get(email);
      if (!user) {
        user = { id: uid() };
        db.prepare('INSERT INTO users (id, email, created_at) VALUES (?,?,?)').run(user.id, email, Date.now());
      }

      const profileId   = uid();
      const slug        = slugify(name);
      const sId         = shareId();
      const sessionTok  = token();

      db.prepare(`
        INSERT INTO profiles (id, user_id, slug, share_id, name, mode, language, question_version, created_at)
        VALUES (?,?,?,?,?,?,?,?,?)
      `).run(profileId, user.id, slug, sId, name, mode, lang, QUESTION_BANK_VERSION, Date.now());

      db.prepare('INSERT INTO owner_sessions (token, user_id, profile_id, expires_at) VALUES (?,?,?,?)').run(
        sessionTok, user.id, profileId, Date.now() + 30 * 864e5
      );

      setSessionCookie(res, sessionTok);
      track('profile_created', { profileId, userId: user.id, language: lang });

      return json(res, {
        profileId, slug, shareId: sId,
        shareUrl:  `${BASE_URL}/s/${sId}`,
        respondUrl:`${BASE_URL}/r/${slug}`,
        name, mode
      }, 201);
    }

    // GET /api/me — check owner session
    if (method === 'GET' && pathname === '/api/me') {
      const sess = validateSession(getSession(req));
      if (!sess) return err(res, 'Not authenticated.', 401);
      const profile = db.prepare('SELECT id,slug,share_id,name,mode,language FROM profiles WHERE id=?').get(sess.profileId);
      return json(res, { userId: sess.userId, profileId: sess.profileId, profile });
    }

    // GET /api/profile/:slug — public profile info (for responders)
    if (method === 'GET' && pathname.startsWith('/api/profile/')) {
      const slug = sanitize(pathname.slice(13), 60);
      const profile = db.prepare('SELECT id,slug,share_id,name,mode,language FROM profiles WHERE slug=?').get(slug);
      if (!profile) return err(res, 'Profile not found.', 404);
      const questions = getQuestionsForMode(profile.mode);
      return json(res, { profile, questions });
    }

    // POST /api/auth/email — send magic link
    if (method === 'POST' && pathname === '/api/auth/email') {
      if (!rateLimit(`auth:${hashIp(ip)}`, 5, 3_600_000))
        return err(res, 'Too many requests. Try again later.', 429);

      const body  = await parseBody(req);
      const email = sanitize(body.email || '', 200).toLowerCase();
      if (!email || !email.includes('@')) return err(res, 'Valid email required.');

      const user = db.prepare('SELECT * FROM users WHERE email=?').get(email);
      if (!user) return json(res, { sent: false, message: 'No profile found with that email.' });

      const profile = db.prepare('SELECT * FROM profiles WHERE user_id=? ORDER BY created_at DESC LIMIT 1').get(user.id);

      // Expire old tokens for this user
      db.prepare('UPDATE magic_tokens SET used=1 WHERE user_id=?').run(user.id);

      const tok = token();
      db.prepare('INSERT INTO magic_tokens (token, user_id, profile_id, expires_at, used) VALUES (?,?,?,?,0)')
        .run(tok, user.id, profile?.id || null, Date.now() + 24 * 3_600_000);

      const magicUrl = `${BASE_URL}/api/auth/verify?token=${tok}`;
      const emailSent = await sendMagicLinkEmail(email, magicUrl);

      // Alpha: always return the URL so the client can show it if email is not configured
      return json(res, { sent: emailSent, magicUrl: process.env.RESEND_API_KEY ? null : magicUrl });
    }

    // GET /api/auth/verify?token=... — verify magic link
    if (method === 'GET' && pathname === '/api/auth/verify') {
      const tok = sanitize(parsed.searchParams.get('token') || '', 70);
      const row = db.prepare('SELECT * FROM magic_tokens WHERE token=? AND used=0 AND expires_at>?').get(tok, Date.now());
      if (!row) return redirect(res, '/?auth=expired');

      db.prepare('UPDATE magic_tokens SET used=1 WHERE token=?').run(tok);

      if (!row.profile_id) return redirect(res, '/?auth=noprofile');

      const sessionTok = token();
      db.prepare('INSERT INTO owner_sessions (token, user_id, profile_id, expires_at) VALUES (?,?,?,?)')
        .run(sessionTok, row.user_id, row.profile_id, Date.now() + 30 * 864e5);
      setSessionCookie(res, sessionTok);
      return redirect(res, `/r/results?verified=1`);
    }

    // DELETE /api/auth/logout
    if (method === 'DELETE' && pathname === '/api/auth/logout') {
      const tok = getSession(req);
      if (tok) db.prepare('DELETE FROM owner_sessions WHERE token=?').run(tok);
      clearCookie(res);
      return json(res, { ok: true });
    }

    // GET /api/results/:profileId — results (owner auth required)
    if (method === 'GET' && pathname.startsWith('/api/results/')) {
      const sess = validateSession(getSession(req));
      if (!sess) return err(res, 'Not authenticated.', 401);

      const profileId = sanitize(pathname.slice(13), 40);
      if (sess.profileId !== profileId) return err(res, 'Forbidden.', 403);

      const profile = db.prepare('SELECT * FROM profiles WHERE id=?').get(profileId);
      if (!profile) return err(res, 'Profile not found.', 404);

      const responseRows = db.prepare('SELECT answers, created_at FROM responses WHERE profile_id=? AND hidden=0').all(profileId);
      const result       = computeResult(responseRows);

      track('result_viewed', { profileId, userId: sess.userId, language: profile.language });

      return json(res, { profile: { name: profile.name, mode: profile.mode, shareId: profile.share_id }, result });
    }

    // POST /api/responses — submit anonymous response
    if (method === 'POST' && pathname === '/api/responses') {
      if (!rateLimit(`resp:${hashIp(ip)}`, 30, 3_600_000))
        return err(res, 'Too many submissions. Try again later.', 429);

      const body      = await parseBody(req);
      const profileId = sanitize(body.profileId || '', 40);
      const sessionId = sanitize(body.sessionId || uid(), 40);
      const refProfId = sanitize(body.refProfileId || '', 40);
      const src       = sanitize(body.src || '', 50);
      const lang      = sanitize(body.language || 'en', 10);

      const profile = db.prepare('SELECT * FROM profiles WHERE id=?').get(profileId);
      if (!profile) return err(res, 'Profile not found.', 404);

      // Rate limit: 1 response per IP per profile per hour
      if (!rateLimit(`resp:${hashIp(ip)}:${profileId}`, 1, 3_600_000))
        return err(res, 'You have already responded to this profile recently.', 429);

      // Validate + sanitize answers
      const rawAnswers = body.answers || {};
      if (typeof rawAnswers !== 'object' || Array.isArray(rawAnswers))
        return err(res, 'Invalid answers format.');

      const questions = getQuestionsForMode(profile.mode);
      const sanitizedAnswers = {};
      let answered = 0;
      for (const [qid, optId] of Object.entries(rawAnswers)) {
        const q = questions.find(x => x.id === sanitize(qid, 10));
        if (!q) continue;
        const opt = q.options.find(o => o.id === sanitize(String(optId), 5));
        if (!opt) continue;
        sanitizedAnswers[q.id] = opt.id;
        answered++;
      }
      if (answered < 5) return err(res, 'Please answer at least 5 questions.');

      const responseId = uid();
      db.prepare(`
        INSERT INTO responses (id, profile_id, session_id, answers, ref_profile_id, src, ip_hash, hidden, reported, created_at)
        VALUES (?,?,?,?,?,?,?,0,0,?)
      `).run(responseId, profileId, sessionId, JSON.stringify(sanitizedAnswers), refProfId || null, src || null, hashIp(ip), Date.now());

      // Referral attribution
      if (refProfId) {
        db.prepare(`
          INSERT OR IGNORE INTO referrals (id, share_id, referrer_profile_id, responder_session, src, converted, created_at)
          VALUES (?,?,?,?,?,0,?)
        `).run(uid(), profile.share_id, refProfId, sessionId, src || null, Date.now());
      }

      track('response_submitted', { profileId, sessionId, language: lang });
      return json(res, { ok: true, responseId }, 201);
    }

    // DELETE /api/responses/:id — owner deletes a response
    if (method === 'DELETE' && pathname.startsWith('/api/responses/')) {
      const sess = validateSession(getSession(req));
      if (!sess) return err(res, 'Not authenticated.', 401);

      const responseId = sanitize(pathname.slice(15), 40);
      const row = db.prepare('SELECT * FROM responses WHERE id=?').get(responseId);
      if (!row) return err(res, 'Not found.', 404);
      if (row.profile_id !== sess.profileId) return err(res, 'Forbidden.', 403);

      db.prepare('UPDATE responses SET hidden=1 WHERE id=?').run(responseId);
      return json(res, { ok: true });
    }

    // POST /api/report — report a response
    if (method === 'POST' && pathname === '/api/report') {
      const body       = await parseBody(req);
      const responseId = sanitize(body.responseId || '', 40);
      const reason     = sanitize(body.reason || '', 300);
      const sessionId  = sanitize(body.sessionId || '', 40);

      const row = db.prepare('SELECT * FROM responses WHERE id=?').get(responseId);
      if (!row) return err(res, 'Response not found.', 404);

      db.prepare('UPDATE responses SET reported=1 WHERE id=?').run(responseId);
      db.prepare('INSERT INTO reports (id, response_id, reporter_session, reason, resolved, created_at) VALUES (?,?,?,?,0,?)')
        .run(uid(), responseId, sessionId || null, reason || null, Date.now());

      return json(res, { ok: true });
    }

    // POST /api/track — client-side analytics
    if (method === 'POST' && pathname === '/api/track') {
      const body = await parseBody(req);
      const allowed = new Set(['profile_created','responder_started','question_answered','response_submitted','result_viewed','share_clicked','teaser_viewed','responder_converted','return_requested']);
      const event = sanitize(body.event || '', 60);
      if (!allowed.has(event)) return err(res, 'Unknown event.');
      track(event, {
        profileId: sanitize(body.profileId || '', 40),
        sessionId: sanitize(body.sessionId || '', 40),
        userId:    sanitize(body.userId    || '', 40),
        language:  sanitize(body.language  || '', 10),
        platform:  sanitize(body.platform  || '', 100),
        metadata:  body.metadata || null
      });
      return json(res, { ok: true });
    }

    // POST /api/referral/convert — mark a referral as converted (profile created by responder)
    if (method === 'POST' && pathname === '/api/referral/convert') {
      const body = await parseBody(req);
      const sessionId       = sanitize(body.sessionId || '', 40);
      const invitedProfileId = sanitize(body.invitedProfileId || '', 40);
      db.prepare('UPDATE referrals SET converted=1, invited_profile_id=? WHERE responder_session=? AND converted=0')
        .run(invitedProfileId, sessionId);
      track('responder_converted', { profileId: invitedProfileId, sessionId });
      return json(res, { ok: true });
    }

    // 404
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not found' }));

  } catch (e) {
    // Never leak stack traces in production
    console.error('[ERR]', e.message);
    if (process.env.NODE_ENV !== 'production') console.error(e.stack);
    json(res, { error: 'Internal server error' }, 500);
  }
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`[TMM] Server running on port ${PORT} — ${BASE_URL}`);
  console.log(`[TMM] DB: ${require('./migrations.js').DB_PATH}`);
  console.log(`[TMM] Email: ${process.env.RESEND_API_KEY ? 'RESEND configured' : 'Alpha mode (magic link returned in response)'}`);
  console.log(`[TMM] Admin: ${BASE_URL}/admin`);
});

module.exports = server;
