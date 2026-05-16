import { createServer } from 'node:http';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync, existsSync, mkdirSync } from 'node:fs';
import { createHash, randomBytes } from 'node:crypto';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { QUESTIONS, RESULTS, ROUTING } from './questions.js';

const __dir = dirname(fileURLToPath(import.meta.url));
const PORT  = process.env.PORT || 3000;
const DB_PATH = process.env.DB_PATH || join(__dir, 'data', 'tellmemore.db');
const APP_PATH = join(__dir, 'app.html');
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY || '';

// â”€â”€ DB â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
mkdirSync(dirname(DB_PATH), { recursive: true });
const db = new DatabaseSync(DB_PATH);
db.exec(`
  CREATE TABLE IF NOT EXISTS profiles (
    id TEXT PRIMARY KEY,
    slug TEXT UNIQUE,
    name TEXT,
    mode TEXT,
    self_answers TEXT,
    created_at INTEGER DEFAULT (unixepoch())
  );
  CREATE TABLE IF NOT EXISTS responses (
    id TEXT PRIMARY KEY,
    profile_id TEXT,
    answers TEXT,
    path TEXT,
    signals TEXT,
    responder_hash TEXT,
    created_at INTEGER DEFAULT (unixepoch())
  );
`);

// â”€â”€ Helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const uid  = () => randomBytes(8).toString('hex');
const slug = name => name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '') + '-' + randomBytes(3).toString('hex');
const json = (res, data, status = 200) => { res.writeHead(status, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }); res.end(JSON.stringify(data)); };
const err  = (res, msg, status = 400) => json(res, { error: msg }, status);

async function body(req) {
  return new Promise(resolve => {
    let d = '';
    req.on('data', c => d += c);
    req.on('end', () => { try { resolve(JSON.parse(d)); } catch { resolve({}); } });
  });
}

// â”€â”€ AI Results â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
async function generateInsight(name, mode, signals, path, responseCount) {
  if (!ANTHROPIC_KEY) return buildFallbackInsight(name, mode, signals, path);

  const contradictionId = ROUTING.selectContradiction(signals);
  const contradictionText = RESULTS.contradiction.find(c => c.id === contradictionId)?.text || RESULTS.contradiction[2].text;
  const magneticScore = (signals.magnetic || 0) + (signals.presence || 0);
  const magneticText = magneticScore >= 3 ? RESULTS.magnetic[0] : magneticScore >= 2 ? RESULTS.magnetic[1] : RESULTS.magnetic[2];
  const frictionScore = (signals.negative || 0) + (signals.friction || 0);
  const frictionText = frictionScore >= 2 ? RESULTS.friction[Math.min(frictionScore - 2, 2)] : null;

  const prompt = `You are writing perception insights for TellMeMore, a social perception app.

Person: ${name}
Mode: ${mode}
Response count: ${responseCount}
Signal summary: ${JSON.stringify(signals)}
Path taken: ${path}
Contradiction template: "${contradictionText}"
Magnetic insight: "${magneticText}"
${frictionText ? `Friction insight (user-only): "${frictionText}"` : ''}

Write a perception profile with these exact sections. Use Turkish language. Be emotionally sharp, specific, non-generic. 70% validation, 30% friction.

Rules:
- Never use words like "hot", "sexy", "beautiful", "score", "rating"
- Use: "magnetic", "presence", "emotionally attractive", "memorable", "charismatic"
- No therapy language, no HR language
- Keep each section under 2 sentences
- The contradiction section is the most important â€” make it feel personal

Return JSON only:
{
  "howPeopleSeeYou": "...",
  "whatYouDontRealize": "...",
  "yourSocialEnergy": "...",
  "contradiction": "...",
  "whatKeepsShowing": "...",
  "shareHeadline": "..."
}`;

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': ANTHROPIC_KEY, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: 'claude-sonnet-4-20250514', max_tokens: 800, messages: [{ role: 'user', content: prompt }] })
    });
    const data = await res.json();
    const text = data.content?.[0]?.text || '';
    const clean = text.replace(/```json|```/g, '').trim();
    return { ...JSON.parse(clean), magneticText, frictionText, contradictionText, livePattern: getLivePattern(responseCount) };
  } catch {
    return buildFallbackInsight(name, mode, signals, path);
  }
}

function buildFallbackInsight(name, mode, signals, path) {
  const contradictionId = ROUTING.selectContradiction(signals);
  const contradictionText = RESULTS.contradiction.find(c => c.id === contradictionId)?.text || RESULTS.contradiction[2].text;
  const magneticScore = (signals.magnetic || 0) + (signals.presence || 0);
  const magneticText = RESULTS.magnetic[magneticScore >= 3 ? 0 : magneticScore >= 2 ? 1 : 2];
  const frictionScore = (signals.negative || 0) + (signals.friction || 0);
  const frictionText = frictionScore >= 2 ? RESULTS.friction[Math.min(frictionScore - 2, 2)] : null;

  const modeLabel = mode === 'friends' ? 'arkadaÅŸlarÄ±' : 'Ã§evresi';
  return {
    howPeopleSeeYou: `${name}'Ä± tanÄ±yanlar, onu ${path === 'A' ? 'yakÄ±n ve gÃ¼venilir' : 'ilginÃ§ ama gizemli'} olarak tanÄ±mlÄ±yor.`,
    whatYouDontRealize: magneticText,
    yourSocialEnergy: magneticScore >= 2 ? `${name}'Ä±n varlÄ±ÄŸÄ± ortamda fark ediliyor â€” bunu her zaman gÃ¶stermiyor olsa da.` : `${name} Ã§evresini zaman iÃ§inde etkiliyor â€” ilk izlenim tam resmini yansÄ±tmÄ±yor.`,
    contradiction: contradictionText,
    whatKeepsShowing: `${modeLabel.charAt(0).toUpperCase() + modeLabel.slice(1)} aynÄ± ÅŸeyi tekrar ediyor. Bu pattern tesadÃ¼f deÄŸil.`,
    shareHeadline: contradictionText.split('.')[0],
    magneticText,
    frictionText,
    contradictionText,
    livePattern: null
  };
}

function getLivePattern(count) {
  const thresholds = Object.keys(RESULTS.livePattern).map(Number).sort((a, b) => b - a);
  for (const t of thresholds) {
    if (count >= t) return RESULTS.livePattern[t];
  }
  return null;
}

// â”€â”€ Routes â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const routes = {

  'GET /': (req, res) => {
    try {
      const html = readFileSync(APP_PATH, 'utf8');
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(html);
    } catch {
      res.writeHead(404); res.end('app.html not found');
    }
  },

  'GET /api/questions': (req, res) => {
    const url = new URL(req.url, 'http://x');
    const mode = url.searchParams.get('mode') || 'friends';
    const q = QUESTIONS[mode];
    if (!q) return err(res, 'Invalid mode');
    json(res, { mode, section1: q.section1, section2_fixed: q.section2_fixed });
  },

  'GET /api/questions/adaptive': (req, res) => {
    const url = new URL(req.url, 'http://x');
    const mode = url.searchParams.get('mode') || 'friends';
    const path = url.searchParams.get('path') || 'A';
    const q = QUESTIONS[mode];
    if (!q) return err(res, 'Invalid mode');
    const adaptive = path === 'A' ? q.section2_pathA : q.section2_pathB;
    json(res, { path, questions: adaptive, section3: q.section3 });
  },

  'POST /api/route': async (req, res) => {
    const { mode, s1, s2, s3 } = await body(req);
    if (!mode || !s1) return err(res, 'Missing params');
    const q = QUESTIONS[mode];
    if (!q) return err(res, 'Invalid mode');
    const path = ROUTING.computePath(s1, s2, s3, q);
    json(res, { path });
  },

  'POST /api/profiles': async (req, res) => {
    const { name, mode } = await body(req);
    if (!name || !mode) return err(res, 'name and mode required');
    if (!QUESTIONS[mode]) return err(res, 'Invalid mode');
    const id = uid();
    const s = slug(name);
    db.prepare('INSERT INTO profiles (id,slug,name,mode) VALUES (?,?,?,?)').run(id, s, name.trim(), mode);
    json(res, { id, slug: s, name: name.trim(), mode }, 201);
  },

  'GET /api/profiles/:slug': (req, res, params) => {
    const p = db.prepare('SELECT * FROM profiles WHERE slug=?').get(params.slug);
    if (!p) return err(res, 'Not found', 404);
    const count = db.prepare('SELECT COUNT(*) as c FROM responses WHERE profile_id=?').get(p.id).c;
    json(res, { id: p.id, slug: p.slug, name: p.name, mode: p.mode, responseCount: count, livePattern: getLivePattern(count) });
  },

  'POST /api/responses': async (req, res) => {
    const { profileId, answers } = await body(req);
    if (!profileId || !answers) return err(res, 'profileId and answers required');
    const p = db.prepare('SELECT * FROM profiles WHERE id=?').get(profileId);
    if (!p) return err(res, 'Profile not found', 404);
    const q = QUESTIONS[p.mode];
    const s1 = answers.s1, s2 = answers.s2, s3 = answers.s3;
    const path = ROUTING.computePath(s1, s2, s3, q);
    const signals = ROUTING.computeSignals(answers, q, path);
    const hash = createHash('sha256').update(profileId + JSON.stringify(answers) + Date.now()).digest('hex').slice(0, 16);
    const id = uid();
    db.prepare('INSERT INTO responses (id,profile_id,answers,path,signals,responder_hash) VALUES (?,?,?,?,?,?)').run(id, profileId, JSON.stringify(answers), path, JSON.stringify(signals), hash);
    const count = db.prepare('SELECT COUNT(*) as c FROM responses WHERE profile_id=?').get(profileId).c;
    json(res, { id, path, responseCount: count, livePattern: getLivePattern(count) }, 201);
  },

  'GET /api/status/:id': (req, res, params) => {
    const p = db.prepare('SELECT * FROM profiles WHERE id=?').get(params.id);
    if (!p) return err(res, 'Not found', 404);
    const count = db.prepare('SELECT COUNT(*) as c FROM responses WHERE profile_id=?').get(p.id).c;
    json(res, { responseCount: count, livePattern: getLivePattern(count), unlocked: count >= 3 });
  },

  'GET /api/results/:id': async (req, res, params) => {
    const p = db.prepare('SELECT * FROM profiles WHERE id=?').get(params.id);
    if (!p) return err(res, 'Not found', 404);
    const rows = db.prepare('SELECT signals, path FROM responses WHERE profile_id=? ORDER BY created_at DESC').all(p.id);
    if (rows.length < 3) return err(res, 'Not enough responses', 403);

    const merged = {};
    for (const r of rows) {
      const s = JSON.parse(r.signals);
      for (const [k, v] of Object.entries(s)) merged[k] = (merged[k] || 0) + v;
    }
    const normalized = Object.fromEntries(Object.entries(merged).map(([k, v]) => [k, +(v / rows.length).toFixed(2)]));
    const dominantPath = rows.filter(r => r.path === 'A').length >= rows.length / 2 ? 'A' : 'B';
    const insight = await generateInsight(p.name, p.mode, normalized, dominantPath, rows.length);

    json(res, { profile: { id: p.id, name: p.name, mode: p.mode }, responseCount: rows.length, signals: normalized, dominantPath, insight });
  },

  'GET /share-preview': (req, res) => {
    try {
      const html = readFileSync(join(__dir, 'share-preview.html'), 'utf8');
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(html);
    } catch {
      res.writeHead(404); res.end('share-preview.html not found');
    }
  },

  'GET /admin': (req, res) => {
    const profiles = db.prepare('SELECT p.*, (SELECT COUNT(*) FROM responses r WHERE r.profile_id=p.id) as response_count FROM profiles p ORDER BY p.created_at DESC LIMIT 50').all();
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>TellMeMore Admin</title>
<style>body{font-family:monospace;background:#0f0f10;color:#c4c0b8;padding:2rem}h1{color:#8b5cf6;margin-bottom:1rem}table{width:100%;border-collapse:collapse}th,td{padding:8px 12px;text-align:left;border-bottom:1px solid #2a2a30;font-size:13px}th{color:#7a7590}a{color:#8b5cf6}
.badge{display:inline-block;padding:2px 8px;border-radius:10px;font-size:11px;background:#1a1a2e;color:#8b5cf6}</style></head>
<body><h1>TellMeMore Admin</h1>
<table><tr><th>Name</th><th>Mode</th><th>Responses</th><th>Link</th><th>Created</th></tr>
${profiles.map(p => `<tr><td>${p.name}</td><td><span class="badge">${p.mode}</span></td><td>${p.response_count}</td><td><a href="/r/${p.slug}" target="_blank">/r/${p.slug}</a></td><td>${new Date(p.created_at * 1000).toLocaleDateString('tr-TR')}</td></tr>`).join('')}
</table></body></html>`);
  }
};

// â”€â”€ Route matcher â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function matchRoute(method, pathname) {
  for (const key of Object.keys(routes)) {
    const [m, pattern] = key.split(' ');
    if (m !== method) continue;
    const patParts = pattern.split('/');
    const urlParts = pathname.split('/');
    if (patParts.length !== urlParts.length) continue;
    const params = {};
    let match = true;
    for (let i = 0; i < patParts.length; i++) {
      if (patParts[i].startsWith(':')) { params[patParts[i].slice(1)] = urlParts[i]; }
      else if (patParts[i] !== urlParts[i]) { match = false; break; }
    }
    if (match) return { handler: routes[key], params };
  }
  return null;
}

// â”€â”€ Server â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const server = createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.writeHead(204); return res.end(); }

  const url = new URL(req.url, 'http://x');
  const pathname = url.pathname.replace(/\/$/, '') || '/';

  // Responder shortlink /r/:slug â†’ redirect to /?respond=slug
  if (pathname.startsWith('/r/')) {
    const s = pathname.slice(3);
    res.writeHead(302, { Location: `/?respond=${s}` });
    return res.end();
  }

  const match = matchRoute(req.method, pathname);
  if (!match) { res.writeHead(404, { 'Content-Type': 'text/plain' }); return res.end('Not found'); }
  try { match.handler(req, res, match.params); } catch (e) { console.error(e); res.writeHead(500); res.end('Server error'); }
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`\n  TellMeMore`);
  console.log(`  http://localhost:${PORT}`);
  console.log(`  DB: ${DB_PATH}\n`);
});
