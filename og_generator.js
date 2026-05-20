'use strict';
// ─────────────────────────────────────────────────────────────────────────────
// TellMeMore — OG SVG Generator v4
// 3 states: invite → emerging (1-2 responses) → final (3+ responses)
// Cinematic, dark premium. System fonts for OG bot compatibility.
// TR copy: "Sence doğru mu?" (per product council spec)
// ─────────────────────────────────────────────────────────────────────────────

// 2-line breaks for all 12 signals — always two lines, centered
const SIGNAL_LINES = {
  quiet_authority:  { en:['QUIET','AUTHORITY'],    tr:['SESSİZ','OTORİTE']       },
  soft_power:       { en:['SOFT','POWER'],          tr:['YUMUŞAK','GÜÇ']          },
  social_gravity:   { en:['SOCIAL','GRAVITY'],      tr:['SOSYAL','AĞIRLIK']        },
  controlled_fire:  { en:['CONTROLLED','FIRE'],     tr:['KONTROLLÜ','ATEŞ']        },
  emotional_radar:  { en:['EMOTIONAL','RADAR'],     tr:['DUYGUSAL','RADAR']        },
  rare_energy:      { en:['RARE','ENERGY'],          tr:['NADİR','ENERJİ']          },
  protective_force: { en:['PROTECTIVE','FORCE'],    tr:['KORUYUCU','GÜÇ']          },
  calm_magnet:      { en:['CALM','MAGNET'],          tr:['SESSİZ','MIKNATISK']      },
  hard_to_read:     { en:['HARD','TO READ'],         tr:['OKUNMASI','ZOR']          },
  dangerous_calm:   { en:['DANGEROUS','CALM'],       tr:['TEHLİKELİ','SAKİNLİK']   },
  selective_depth:  { en:['SELECTIVE','DEPTH'],      tr:['SEÇİCİ','DERİNLİK']      },
  raw_warmth:       { en:['RAW','WARMTH'],            tr:['GERÇEK','SICAKLIK']       }
};

const FONT = "-apple-system, 'Helvetica Neue', 'Segoe UI', ui-monospace, monospace";

function esc(s) {
  return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#x27;');
}
function uName(s) {
  s = String(s||'').trim().toUpperCase();
  return s.length > 18 ? s.slice(0,17)+'…' : s;
}

// ── STATE 1: INVITE — 0 responses ─────────────────────────────────────────────
function genInvite(name, lang) {
  const n    = uName(name);
  const apo  = lang==='tr' ? '\'' : '\'S';
  const line2 = lang==='tr' ? 'GÖRÜŞLERİNİ' : 'PERCEPTION';
  const line3 = lang==='tr' ? 'BEKLIYOR.' : 'BEGINS.';
  const cta  = lang==='tr' ? 'ANONİM YANITLA →' : 'ANSWER ANONYMOUSLY →';
  const sub  = lang==='tr'
    ? `${esc(n)} NASIL BİRİ OLDUĞUNU ÖĞRENMEK İSTİYOR.`
    : `${esc(n)} WANTS TO KNOW HOW YOU REALLY SEE THEM.`;
  return frame(`
  <radialGradient id="bg" cx="50%" cy="0%" r="70%">
    <stop offset="0%" stop-color="#1e1830" stop-opacity="1"/>
    <stop offset="100%" stop-color="#0C0B10" stop-opacity="0"/>
  </radialGradient>
  <rect width="1200" height="630" fill="url(#bg)"/>
  <text x="600" y="228" font-family="${FONT}" font-size="26" font-weight="200"
    letter-spacing="10" fill="#2d2b3d" text-anchor="middle">${esc(n)}${apo}</text>
  <text x="600" y="340" font-family="${FONT}" font-size="82" font-weight="200"
    letter-spacing="10" fill="#f0eeff" text-anchor="middle">${line2}</text>
  <text x="600" y="418" font-family="${FONT}" font-size="38" font-weight="200"
    letter-spacing="10" fill="#4a4870" text-anchor="middle">${line3}</text>
  <text x="600" y="530" font-family="${FONT}" font-size="17" font-weight="300"
    letter-spacing="4" fill="#2d2b3d" text-anchor="middle">${esc(sub)}</text>
  <rect x="870" y="566" width="256" height="40" rx="5" fill="#534AB7"/>
  <text x="997" y="591" font-family="${FONT}" font-size="14" font-weight="400"
    letter-spacing="2" fill="#CECBF6" text-anchor="middle">${esc(cta)}</text>
`);
}

// ── STATE 2: EMERGING — 1–2 responses ─────────────────────────────────────────
function genEmerging(name, lang, signalKey, responseCount) {
  const n      = uName(name);
  const lines  = SIGNAL_LINES[signalKey]?.[lang] || ['SIGNAL','FORMING'];
  const l1 = esc(lines[0]); const l2 = esc(lines[1]);
  const forming = lang==='tr' ? 'ŞEKİLLENİYOR' : 'FORMING';
  const agree   = lang==='tr' ? 'SENCE DOĞRU MU?' : 'DO YOU AGREE?';
  const cta     = lang==='tr' ? 'GÖRÜŞÜNÜ EKLE →' : 'WEIGH IN →';
  return frame(`
  <radialGradient id="bg" cx="50%" cy="0%" r="70%">
    <stop offset="0%" stop-color="#1a1630" stop-opacity="1"/>
    <stop offset="100%" stop-color="#0C0B10" stop-opacity="0"/>
  </radialGradient>
  <rect width="1200" height="630" fill="url(#bg)"/>
  <text x="600" y="196" font-family="${FONT}" font-size="20" font-weight="300"
    letter-spacing="8" fill="#3d3a5a" text-anchor="middle">${esc(n)}</text>
  <text x="600" y="306" font-family="${FONT}" font-size="96" font-weight="200"
    letter-spacing="6" fill="#7c6af5" fill-opacity="0.65" text-anchor="middle">${l1}</text>
  <text x="600" y="412" font-family="${FONT}" font-size="96" font-weight="200"
    letter-spacing="6" fill="#7c6af5" fill-opacity="0.65" text-anchor="middle">${l2}</text>
  <text x="600" y="468" font-family="${FONT}" font-size="17" font-weight="300"
    letter-spacing="8" fill="#534AB7" text-anchor="middle">${esc(forming)}</text>
  <text x="600" y="522" font-family="${FONT}" font-size="19" font-weight="300"
    letter-spacing="6" fill="#3d3a5a" text-anchor="middle">${esc(agree)}</text>
  ${responseCount>=1?`<text x="80" y="592" font-family="${FONT}" font-size="16"
    font-weight="300" letter-spacing="4" fill="#2d2b3d">
    ${responseCount} ${lang==='tr'?'YANIT · ANONİM':'RESPONSES · ANONYMOUS'}</text>`:''}
  <rect x="870" y="566" width="256" height="40" rx="5" fill="#2a2840"/>
  <text x="997" y="591" font-family="${FONT}" font-size="14" font-weight="400"
    letter-spacing="2" fill="#7a78a0" text-anchor="middle">${esc(cta)}</text>
`);
}

// ── STATE 3: FINAL — 3+ responses ─────────────────────────────────────────────
function genFinal(name, lang, signalKey, responseCount) {
  const n      = uName(name);
  const lines  = SIGNAL_LINES[signalKey]?.[lang] || ['SIGNAL','NAME'];
  const l1 = esc(lines[0]); const l2 = esc(lines[1]);
  const appar  = lang==='tr' ? 'GÖRÜNÜŞE GÖRE' : 'APPARENTLY';
  const agree  = lang==='tr' ? 'Sence doğru mu?' : 'Do you agree?';
  const cta    = lang==='tr' ? 'GÖRÜŞÜNÜ EKLE →' : 'ADD YOUR TAKE →';
  const countTxt = responseCount>=3
    ? `${responseCount} ${lang==='tr'?'KİŞİ · ANONİM':'PEOPLE · ANONYMOUS'}` : '';
  return frame(`
  <radialGradient id="bg" cx="50%" cy="0%" r="65%">
    <stop offset="0%" stop-color="#1e1830" stop-opacity="0.9"/>
    <stop offset="100%" stop-color="#0C0B10" stop-opacity="0"/>
  </radialGradient>
  <rect width="1200" height="630" fill="url(#bg)"/>
  <text x="600" y="172" font-family="${FONT}" font-size="18" font-weight="200"
    letter-spacing="14" fill="#3d3a5a" text-anchor="middle">${esc(appar)}</text>
  <text x="600" y="304" font-family="${FONT}" font-size="96" font-weight="200"
    letter-spacing="6" fill="#f0eeff" text-anchor="middle">${l1}</text>
  <text x="600" y="410" font-family="${FONT}" font-size="96" font-weight="200"
    letter-spacing="6" fill="#f0eeff" text-anchor="middle">${l2}</text>
  <text x="600" y="474" font-family="${FONT}" font-size="22" font-weight="300"
    letter-spacing="6" fill="#4a4870" text-anchor="middle">${esc(agree)}</text>
  ${countTxt?`<text x="80" y="592" font-family="${FONT}" font-size="16"
    font-weight="300" letter-spacing="4" fill="#2d2b3d">${esc(countTxt)}</text>`:''}
  <rect x="870" y="566" width="256" height="40" rx="5" fill="#534AB7"/>
  <text x="997" y="591" font-family="${FONT}" font-size="14" font-weight="400"
    letter-spacing="2" fill="#CECBF6" text-anchor="middle">${esc(cta)}</text>
`);
}

function frame(inner) {
  const gradient = inner.match(/<radialGradient[\s\S]*?<\/radialGradient>/)?.[0] || '';
  const body = inner.replace(/<radialGradient[\s\S]*?<\/radialGradient>/, '');
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <defs>${gradient}</defs>
  <rect width="1200" height="630" fill="#0C0B10"/>
  ${body}
  <text x="48" y="50" font-family="${FONT}" font-size="14" font-weight="300"
    letter-spacing="8" fill="#2d2b3d">TMM</text>
  <rect x="0" y="0" width="3" height="630" fill="#534AB7" opacity="0.6"/>
</svg>`;
}

function generateOgCard(opts) {
  const { name, lang='en', signalKey, responseCount=0 } = opts;
  const n = Math.max(0, parseInt(responseCount,10)||0);
  if (!signalKey || n===0) return genInvite(name, lang);
  if (n >= 3)             return genFinal(name, lang, signalKey, n);
  return genEmerging(name, lang, signalKey, n);
}

module.exports = { generateOgCard, SIGNAL_LINES };
