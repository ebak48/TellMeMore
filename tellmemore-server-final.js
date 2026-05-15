import { createServer } from 'node:http';
import { readFileSync, existsSync, mkdirSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const PORT = process.env.PORT || 3000;
const DATA_DIR = process.env.DATA_DIR || join(__dirname, 'data');
const DB_PATH = join(DATA_DIR, 'tellmemore.db');
const APP_PATH = join(__dirname, 'app.html');

mkdirSync(DATA_DIR, { recursive: true });

const db = new DatabaseSync(DB_PATH);
db.exec(`
  CREATE TABLE IF NOT EXISTS profiles (
    id TEXT PRIMARY KEY,
    slug TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    context TEXT NOT NULL,
    self_traits TEXT DEFAULT '[]',
    self_beh TEXT DEFAULT '{}',
    self_dec TEXT DEFAULT '{}',
    created_at INTEGER DEFAULT (unixepoch()),
    response_count INTEGER DEFAULT 0
  );
  CREATE TABLE IF NOT EXISTS responses (
    id TEXT PRIMARY KEY,
    profile_id TEXT NOT NULL,
    responder_hash TEXT NOT NULL,
    beh TEXT DEFAULT '{}',
    dec TEXT DEFAULT '{}',
    traits TEXT DEFAULT '[]',
    forced_choice TEXT DEFAULT '{}',
    energy TEXT DEFAULT '',
    blind_spot TEXT DEFAULT '',
    created_at INTEGER DEFAULT (unixepoch()),
    FOREIGN KEY (profile_id) REFERENCES profiles(id)
  );
  CREATE TABLE IF NOT EXISTS feedback (
    id TEXT PRIMARY KEY,
    profile_id TEXT,
    type TEXT,
    message TEXT,
    created_at INTEGER DEFAULT (unixepoch())
  );
`);
console.log('[DB] Ready:', DB_PATH);

// ── HELPERS ──────────────────────────────────────────────────────────────────

function uid() { return Math.random().toString(36).slice(2, 14); }
function slugify(n) {
  return n.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 30)
    + '-' + Math.random().toString(36).slice(2, 7);
}
function readBody(req) {
  return new Promise(r => {
    let d = '';
    req.on('data', c => d += c.slice(0, 10000));
    req.on('end', () => { try { r(JSON.parse(d || '{}')); } catch { r({}); } });
    req.on('error', () => r({}));
  });
}
function j(res, code, data) {
  const b = JSON.stringify(data);
  res.writeHead(code, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,DELETE,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Length': Buffer.byteLength(b),
  });
  res.end(b);
}

function aggregate(profileId) {
  const p = db.prepare('SELECT * FROM profiles WHERE id=?').get(profileId);
  if (!p) return null;
  const rows = db.prepare('SELECT * FROM responses WHERE profile_id=? ORDER BY created_at ASC').all(profileId);
  const n = rows.length;
  if (n === 0) return { profile: p, responseCount: 0, unlocked: false, teaser: false };

  const bS = {}, dS = {}, tC = {}, eC = {}, blind = [];
  for (const r of rows) {
    const beh = JSON.parse(r.beh || '{}');
    for (const [k, v] of Object.entries(beh)) { (bS[k] = bS[k] || []).push(+v); }
    const dec = JSON.parse(r.dec || '{}');
    for (const [k, v] of Object.entries(dec)) { (dS[k] = dS[k] || []).push(v === 'yes' ? 1 : 0); }
    for (const t of JSON.parse(r.traits || '[]')) tC[t] = (tC[t] || 0) + 1;
    if (r.energy) eC[r.energy] = (eC[r.energy] || 0) + 1;
    if (r.blind_spot?.trim()) blind.push(r.blind_spot.trim());
  }

  const avg = o => Object.fromEntries(
    Object.entries(o).map(([k, a]) => [k, Math.round(a.reduce((x, y) => x + y, 0) / a.length * 10) / 10])
  );
  const avgPct = o => Object.fromEntries(
    Object.entries(o).map(([k, a]) => [k, Math.round(a.reduce((x, y) => x + y, 0) / a.length * 100)])
  );

  const behAvg = avg(bS);
  const decAvg = avgPct(dS);
  const topTraits = Object.entries(tC).sort((a, b) => b[1] - a[1]).slice(0, 6)
    .map(([t, c]) => ({ trait: t, count: c, pct: Math.round(c / n * 100) }));
  const topEnergy = Object.entries(eC).sort((a, b) => b[1] - a[1])
    .map(([e, c]) => ({ energy: e, count: c, pct: Math.round(c / n * 100) }));
  const selfBeh = JSON.parse(p.self_beh || '{}');
  const gaps = Object.entries(behAvg)
    .map(([qid, o]) => ({ qid, self: selfBeh[qid] || 3, other: o, gap: Math.round((o - (selfBeh[qid] || 3)) * 10) / 10 }))
    .sort((a, b) => Math.abs(b.gap) - Math.abs(a.gap)).slice(0, 5);

  return { profile: p, responseCount: n, unlocked: n >= 8, teaser: n >= 3, behAvg, decAvg, topTraits, topEnergy, gaps, blindSpots: blind };
}

// ── SERVER ───────────────────────────────────────────────────────────────────

const server = createServer(async (req, res) => {
  const { pathname: path } = new URL(req.url, `http://localhost:${PORT}`);
  const m = req.method;

  if (m === 'OPTIONS') {
    res.writeHead(204, { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET,POST,DELETE,OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' });
    res.end(); return;
  }

  try {
    // POST /api/profiles
    if (path === '/api/profiles' && m === 'POST') {
      const b = await readBody(req);
      if (!b.name?.trim() || !b.context) return j(res, 400, { error: 'name and context required' });
      const id = uid(), slug = slugify(b.name.trim());
      db.prepare('INSERT INTO profiles(id,slug,name,context,self_traits,self_beh,self_dec) VALUES(?,?,?,?,?,?,?)').run(
        id, slug, b.name.trim(), b.context,
        JSON.stringify(b.selfTraits || []),
        JSON.stringify(b.selfBeh || {}),
        JSON.stringify(b.selfDec || {})
      );
      const host = req.headers.host || `localhost:${PORT}`;
      const proto = req.headers['x-forwarded-proto'] || 'http';
      return j(res, 201, { id, slug, link: `${proto}://${host}/r/${slug}` });
    }

    // GET /api/profiles/:slug
    if (path.startsWith('/api/profiles/') && m === 'GET') {
      const slug = decodeURIComponent(path.slice(14));
      const p = db.prepare('SELECT * FROM profiles WHERE slug=?').get(slug);
      if (!p) return j(res, 404, { error: 'Profile not found' });
      return j(res, 200, { ...p, self_traits: JSON.parse(p.self_traits || '[]'), self_beh: JSON.parse(p.self_beh || '{}'), self_dec: JSON.parse(p.self_dec || '{}') });
    }

    // POST /api/responses
    if (path === '/api/responses' && m === 'POST') {
      const b = await readBody(req);
      if (!b.profileId) return j(res, 400, { error: 'profileId required' });
      const p = db.prepare('SELECT id FROM profiles WHERE id=?').get(b.profileId);
      if (!p) return j(res, 404, { error: 'Profile not found' });
      const ip = req.headers['x-forwarded-for']?.split(',')[0] || req.socket?.remoteAddress || 'x';
      const hash = createHash('sha256').update(ip + Math.floor(Date.now() / 3600000) + 'tmm2025salt').digest('hex').slice(0, 16);
      const id = uid();
      db.prepare('INSERT INTO responses(id,profile_id,responder_hash,beh,dec,traits,forced_choice,energy,blind_spot) VALUES(?,?,?,?,?,?,?,?,?)').run(
        id, b.profileId, hash,
        JSON.stringify(b.beh || {}), JSON.stringify(b.dec || {}),
        JSON.stringify(b.traits || []), JSON.stringify(b.forcedChoice || {}),
        b.energy || '', b.blindSpot || ''
      );
      db.prepare('UPDATE profiles SET response_count=response_count+1 WHERE id=?').run(b.profileId);
      const u = db.prepare('SELECT response_count FROM profiles WHERE id=?').get(b.profileId);
      return j(res, 201, { id, responseCount: u.response_count });
    }

    // GET /api/results/:id
    if (path.startsWith('/api/results/') && m === 'GET') {
      const id = decodeURIComponent(path.slice(13));
      const r = aggregate(id);
      if (!r) return j(res, 404, { error: 'Profile not found' });
      return j(res, 200, r);
    }

    // GET /api/status/:id
    if (path.startsWith('/api/status/') && m === 'GET') {
      const id = decodeURIComponent(path.slice(12));
      const p = db.prepare('SELECT response_count FROM profiles WHERE id=?').get(id);
      if (!p) return j(res, 404, { error: 'not found' });
      return j(res, 200, { responseCount: p.response_count });
    }

    // POST /api/feedback — test team feedback collection
    if (path === '/api/feedback' && m === 'POST') {
      const b = await readBody(req);
      const id = uid();
      db.prepare('INSERT INTO feedback(id,profile_id,type,message) VALUES(?,?,?,?)').run(
        id, b.profileId || null, b.type || 'general', (b.message || '').slice(0, 2000)
      );
      return j(res, 201, { id, saved: true });
    }

    // GET /api/admin/dashboard — test team overview
    if (path === '/api/admin/dashboard' && m === 'GET') {
      const profiles = db.prepare('SELECT id,slug,name,context,response_count,created_at FROM profiles ORDER BY created_at DESC').all();
      const totalResponses = db.prepare('SELECT COUNT(*) as n FROM responses').get().n;
      const feedback = db.prepare('SELECT * FROM feedback ORDER BY created_at DESC').all();
      const energyDist = db.prepare('SELECT energy, COUNT(*) as n FROM responses WHERE LENGTH(energy) > 0 GROUP BY energy ORDER BY n DESC').all();
      const traitDist = db.prepare('SELECT * FROM responses').all()
        .flatMap(r => JSON.parse(r.traits || '[]'))
        .reduce((acc, t) => { acc[t] = (acc[t] || 0) + 1; return acc; }, {});
      const topTraits = Object.entries(traitDist).sort((a, b) => b[1] - a[1]).slice(0, 10);
      return j(res, 200, { profiles, totalResponses, feedback, energyDist, topTraits, dbPath: DB_PATH });
    }

    // DELETE /api/admin/profiles/:id
    if (path.startsWith('/api/admin/profiles/') && m === 'DELETE') {
      const id = path.slice(20);
      db.prepare('DELETE FROM responses WHERE profile_id=?').run(id);
      db.prepare('DELETE FROM profiles WHERE id=?').run(id);
      return j(res, 200, { deleted: id });
    }

    // GET /admin — test dashboard HTML
    if (path === '/admin' && m === 'GET') {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(getAdminHTML());
      return;
    }

    // Serve app.html for all other GET requests
    if (m === 'GET' && existsSync(APP_PATH)) {
      let html = readFileSync(APP_PATH, 'utf8');
      const host = req.headers.host || `localhost:${PORT}`;
      const proto = req.headers['x-forwarded-proto'] || 'http';
      const apiBase = `${proto}://${host}/api`;
      const inj = `<script>window.TELLMEMORE_API='${apiBase}';window.TELLMEMORE_HOST='${proto}://${host}';</script>`;
      html = html.replace('</head>', inj + '</head>');
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-cache' });
      return res.end(html);
    }

    j(res, 404, { error: 'Not found' });

  } catch (e) {
    console.error('[ERR]', m, path, e.message);
    j(res, 500, { error: e.message });
  }
});

function getAdminHTML() {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>TellMeMore — Test Dashboard</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{background:#0a0a0a;color:#d8d2cb;font-family:'Inter',system-ui,sans-serif;padding:32px}
h1{color:#f3f3f2;font-size:24px;margin-bottom:8px}
.sub{color:#807870;font-size:12px;margin-bottom:32px;font-family:monospace}
.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:12px;margin-bottom:32px}
.stat{background:#191816;border:1px solid #302e2c;padding:20px;border-radius:4px}
.stat-n{font-size:40px;font-weight:700;color:#8b5cf6;font-family:Georgia,serif}
.stat-l{font-size:10px;color:#807870;text-transform:uppercase;letter-spacing:.2em;margin-top:4px}
table{width:100%;border-collapse:collapse;margin-bottom:24px}
th{text-align:left;font-size:9px;text-transform:uppercase;letter-spacing:.2em;color:#585250;padding:8px 12px;border-bottom:1px solid #302e2c}
td{padding:10px 12px;border-bottom:1px solid #1e1c1a;font-size:12px;vertical-align:top}
td:first-child{font-family:monospace;color:#a78bfa}
.badge{display:inline-block;padding:2px 8px;background:rgba(139,92,246,.15);border:1px solid rgba(139,92,246,.3);color:#a78bfa;font-size:9px;font-family:monospace;border-radius:2px}
.badge-green{background:rgba(88,216,152,.1);border-color:rgba(88,216,152,.3);color:#58d898}
.btn{padding:6px 14px;background:var(--c,#8b5cf6);border:none;color:#f3f3f2;font-size:10px;cursor:pointer;font-family:monospace;letter-spacing:.1em;text-transform:uppercase}
.btn:hover{opacity:.8}
.btn-del{--c:#902828}
.section{margin-bottom:32px}
h2{font-size:13px;color:#807870;text-transform:uppercase;letter-spacing:.25em;margin-bottom:14px;font-family:monospace}
.fb{background:#191816;border:1px solid #302e2c;padding:14px;margin-bottom:8px;border-radius:2px}
.fb-type{font-size:9px;color:#a78bfa;text-transform:uppercase;letter-spacing:.2em;font-family:monospace;margin-bottom:5px}
.fb-msg{font-size:13px;color:#d8d2cb;line-height:1.6}
.fb-time{font-size:9px;color:#585250;margin-top:5px;font-family:monospace}
.energy-bar{display:flex;align-items:center;gap:10px;margin-bottom:6px}
.energy-fill{height:6px;background:#8b5cf6;border-radius:3px;transition:width .3s}
.energy-label{font-size:11px;color:#aaa;width:100px}
.energy-pct{font-size:11px;color:#807870;font-family:monospace;width:35px;text-align:right}
.refresh{float:right;font-size:9px;color:#585250;font-family:monospace;cursor:pointer}
.refresh:hover{color:#a78bfa}
</style>
</head>
<body>
<h1>TellMeMore</h1>
<div class="sub">Test Dashboard · <span id="ts"></span> <span class="refresh" onclick="load()">↻ Refresh</span></div>

<div class="grid" id="stats"></div>

<div class="section">
  <h2>Profiles</h2>
  <table><thead><tr><th>Name</th><th>Context</th><th>Responses</th><th>Link</th><th>Created</th><th></th></tr></thead>
  <tbody id="profiles"></tbody></table>
</div>

<div style="display:grid;grid-template-columns:1fr 1fr;gap:24px">
  <div class="section">
    <h2>Energy Distribution</h2>
    <div id="energy"></div>
  </div>
  <div class="section">
    <h2>Top Traits Seen</h2>
    <div id="traits"></div>
  </div>
</div>

<div class="section">
  <h2>Feedback from Test Team</h2>
  <div id="feedback"><p style="color:#585250;font-size:12px">No feedback yet.</p></div>
</div>

<script>
const API = window.location.origin + '/api';
function ts(epoch){ const d=new Date(epoch*1000); return d.toLocaleDateString()+' '+d.toLocaleTimeString(); }

async function load(){
  document.getElementById('ts').textContent = new Date().toLocaleTimeString();
  try {
    const d = await fetch(API+'/admin/dashboard').then(r=>r.json());
    
    // Stats
    document.getElementById('stats').innerHTML = [
      ['Profiles Created', d.profiles.length],
      ['Total Responses', d.totalResponses],
      ['Feedback Items', d.feedback.length],
      ['Avg Responses/Profile', d.profiles.length ? Math.round(d.totalResponses/d.profiles.length*10)/10 : 0],
    ].map(([l,n])=>
      '<div class="stat"><div class="stat-n">'+n+'</div><div class="stat-l">'+l+'</div></div>'
    ).join('');

    // Profiles
    document.getElementById('profiles').innerHTML = d.profiles.map(p=>
      '<tr><td>'+p.name+'</td><td><span class="badge">'+p.context+'</span></td><td><span class="badge-green badge">'+p.response_count+'/8</span></td>'+
      '<td><a href="/r/'+p.slug+'" style="color:#a78bfa;font-size:10px;font-family:monospace" target="_blank">'+window.location.host+'/r/'+p.slug+'</a></td>'+
      '<td style="color:#585250;font-size:10px;font-family:monospace">'+ts(p.created_at)+'</td>'+
      '<td><button class="btn btn-del" onclick="del(\''+p.id+'\')">Delete</button></td></tr>'
    ).join('') || '<tr><td colspan="6" style="color:#585250;text-align:center;padding:20px">No profiles yet</td></tr>';

    // Energy
    const maxE = Math.max(...(d.energyDist.map(e=>e.n)||[1]),1);
    document.getElementById('energy').innerHTML = d.energyDist.length ?
      d.energyDist.map(e=>
        '<div class="energy-bar"><span class="energy-label">'+e.energy+'</span>'+
        '<div style="flex:1;background:#1e1c1a;border-radius:3px"><div class="energy-fill" style="width:'+Math.round(e.n/maxE*100)+'%"></div></div>'+
        '<span class="energy-pct">'+e.n+'</span></div>'
      ).join('') : '<p style="color:#585250;font-size:12px">No data yet</p>';

    // Traits
    const maxT = Math.max(...(d.topTraits.map(t=>t[1])||[1]),1);
    document.getElementById('traits').innerHTML = d.topTraits.length ?
      d.topTraits.map(([t,n])=>
        '<div class="energy-bar"><span class="energy-label">'+t+'</span>'+
        '<div style="flex:1;background:#1e1c1a;border-radius:3px"><div class="energy-fill" style="width:'+Math.round(n/maxT*100)+'%;background:#58d898"></div></div>'+
        '<span class="energy-pct">'+n+'</span></div>'
      ).join('') : '<p style="color:#585250;font-size:12px">No data yet</p>';

    // Feedback
    document.getElementById('feedback').innerHTML = d.feedback.length ?
      d.feedback.map(f=>
        '<div class="fb"><div class="fb-type">'+f.type+'</div><div class="fb-msg">'+f.message+'</div><div class="fb-time">'+ts(f.created_at)+'</div></div>'
      ).join('') : '<p style="color:#585250;font-size:12px">No feedback yet.</p>';

  } catch(e){ console.error(e); }
}

async function del(id){
  if(!confirm('Delete this profile and all its responses?')) return;
  await fetch(API+'/admin/profiles/'+id, {method:'DELETE'});
  load();
}

load();
setInterval(load, 15000);
</script>
</body>
</html>`;
}

server.listen(PORT, '0.0.0.0', () => {
  console.log('');
  console.log('  TellMeMore running');
  console.log('  Port:', PORT);
  console.log('  DB:', DB_PATH);
  console.log('  App:', APP_PATH);
  console.log('');
});
server.on('error', e => {
  if (e.code === 'EADDRINUSE') { console.error('Port', PORT, 'in use'); process.exit(1); }
  else throw e;
});
