'use strict';
// ─────────────────────────────────────────────────────────────────────────────
// TellMeMore — Question Bank v4
// LOCKED DECISIONS APPLIED (2026-06-03):
//   LD-06: 7 structured questions + 1 optional text field (was 11)
//   LD-05: Unlock thresholds 1-2 / 3-4 / 5+ (was 1/3/8)
//   LD-04: Mode 'dating' (was 'romance')
//   Operating system: PRODUCT_DECISIONS.md governs all changes.
// ─────────────────────────────────────────────────────────────────────────────

const QUESTION_BANK_VERSION = 'v4';

// ── SIGNAL SYSTEM v2 ──────────────────────────────────────────────────────────
const SIGNALS = {
  quiet_authority: {
    label:'Quiet Authority', label_tr:'Sessiz Otorite',
    lines_en:['QUIET','AUTHORITY'], lines_tr:['SESSİZ','OTORİTE'],
    short:'Authority',
    high_text:"You don't need to raise your voice. Your certainty speaks before you do — and people feel it.",
    low_text:"Your direction isn't always clear to the people around you. The space where your authority could sit tends to get filled by someone else.",
    blind_spot:"People may wait for signals from you that you don't know you're withholding.",
    icon:'◆'
  },
  soft_power: {
    label:'Soft Power', label_tr:'Yumuşak Güç',
    lines_en:['SOFT','POWER'], lines_tr:['YUMUŞAK','GÜÇ'],
    short:'Soft Power',
    high_text:"You change things without being obvious about it. You don't need force — you have something more durable.",
    low_text:"The influence you could have in moments tends to go unused. Not from weakness, but from hesitation.",
    blind_spot:"Your restraint is often mistaken for disinterest by people who would respond to a clearer signal.",
    icon:'◈'
  },
  social_gravity: {
    label:'Social Gravity', label_tr:'Sosyal Ağırlık',
    lines_en:['SOCIAL','GRAVITY'], lines_tr:['SOSYAL','AĞIRLIK'],
    short:'Gravity',
    high_text:"Rooms shift when you enter. Not because you demand it — because you generate it. That pull is not manufactured.",
    low_text:"You move through social settings without leaving much of a trace. People enjoy your presence but don't always seek it.",
    blind_spot:"You underestimate how much you are noticed — including when you are absent.",
    icon:'◉'
  },
  controlled_fire: {
    label:'Controlled Fire', label_tr:'Kontrollü Ateş',
    lines_en:['CONTROLLED','FIRE'], lines_tr:['KONTROLLÜ','ATEŞ'],
    short:'Fire',
    high_text:"There is real intensity in you that almost never fully surfaces. People sense the heat without seeing the flame. That restraint is part of the power.",
    low_text:"The intensity that could make you memorable tends to stay internal. What comes out is the surface, not the signal.",
    blind_spot:"People who sense what's underneath are drawn to it — you may not know how often this is happening.",
    icon:'◇'
  },
  emotional_radar: {
    label:'Emotional Radar', label_tr:'Duygusal Radar',
    lines_en:['EMOTIONAL','RADAR'], lines_tr:['DUYGUSAL','RADAR'],
    short:'Radar',
    high_text:"You read people before they read themselves. That depth of attunement is unusual — and people feel safe being read by you.",
    low_text:"Emotional cues that would matter to the people around you tend to land without registering. It creates a gap they feel.",
    blind_spot:"Your accuracy at reading others is higher than you think — and it shapes how people behave around you.",
    icon:'○'
  },
  rare_energy: {
    label:'Rare Energy', label_tr:'Nadir Enerji',
    lines_en:['RARE','ENERGY'], lines_tr:['NADİR','ENERJİ'],
    short:'Energy',
    high_text:"Something about you stays with people after you leave. That quality is not easily explained or easily replicated. It is not performance.",
    low_text:"Your presence does not leave a distinctive residue in most interactions. People experience you neutrally, which is its own signal.",
    blind_spot:"The quality that makes you memorable tends to come through in short, specific moments — you may not notice them.",
    icon:'✦'
  },
  protective_force: {
    label:'Protective Force', label_tr:'Koruyucu Güç',
    lines_en:['PROTECTIVE','FORCE'], lines_tr:['KORUYUCU','GÜÇ'],
    short:'Protection',
    high_text:"People feel safe around you — not because you promise safety, but because you actually show up. That is a different thing entirely.",
    low_text:"Your reliability is conditional in ways that are visible to the people close to you. They adjust their expectations accordingly.",
    blind_spot:"The protection you offer tends to come without announcement — people notice it most when it is absent.",
    icon:'△'
  },
  calm_magnet: {
    label:'Calm Magnet', label_tr:'Sessiz Mıknatıs',
    lines_en:['CALM','MAGNET'], lines_tr:['SESSİZ','MIKNATISK'],
    short:'Calm',
    high_text:"There is a quality to your presence that slows things down. People gravitate toward your steadiness — sometimes without knowing why.",
    low_text:"Your calm does not radiate outward in a way others can feel. The steadiness is internal but not yet contagious.",
    blind_spot:"You are a reference point for others in ways you have probably never been told directly.",
    icon:'▽'
  },
  hard_to_read: {
    label:'Hard to Read', label_tr:'Okunması Zor',
    lines_en:['HARD','TO READ'], lines_tr:['OKUNMASI','ZOR'],
    short:'Mystery',
    high_text:"You are not easily decoded. That ambiguity is not a flaw — it creates a particular kind of fascination that is hard to manufacture.",
    low_text:"You are fairly transparent in most contexts. What you feel tends to be visible. That is its own kind of trust signal.",
    blind_spot:"Your ambiguity creates more projection than you realize — people fill in the gaps with their own version of you.",
    icon:'◌'
  },
  dangerous_calm: {
    label:'Dangerous Calm', label_tr:'Tehlikeli Sakinlik',
    lines_en:['DANGEROUS','CALM'], lines_tr:['TEHLİKELİ','SAKİNLİK'],
    short:'Calm',
    high_text:"Your stillness is not absence — it is contained intensity. The calm is real but it has weight. People sense what is underneath.",
    low_text:"Under pressure, the stillness tends to break into visibility. Your inner state becomes readable in ways you may not intend.",
    blind_spot:"Your composed exterior in difficult moments is more remarkable than you treat it — others notice it intensely.",
    icon:'◐'
  },
  selective_depth: {
    label:'Selective Depth', label_tr:'Seçici Derinlik',
    lines_en:['SELECTIVE','DEPTH'], lines_tr:['SEÇİCİ','DERİNLİK'],
    short:'Depth',
    high_text:"You don't offer yourself cheaply. Those who reach the real you are few — and they know what they have.",
    low_text:"The depth is there but the access isn't restricted in a way others experience as meaningful. You open quickly and widely.",
    blind_spot:"The people who have earned your real attention often don't know how selective that access actually is.",
    icon:'◎'
  },
  raw_warmth: {
    label:'Raw Warmth', label_tr:'Gerçek Sıcaklık',
    lines_en:['RAW','WARMTH'], lines_tr:['GERÇEK','SICAKLIK'],
    short:'Warmth',
    high_text:"Your care is not a performance. It is visible, specific, and real. People feel genuinely seen around you — and that is rare.",
    low_text:"The warmth is present internally but it doesn't always make it to the surface in a form others receive clearly.",
    blind_spot:"Your care lands harder than you know. Specific moments of warmth you have forgotten are ones others still hold.",
    icon:'✧'
  }
};

// ── UNLOCK SYSTEM (LD-05) ─────────────────────────────────────────────────────
// State structure:
//   locked:         0 responses  → Invite state
//   first_signals:  1-2 responses → "Something keeps showing up."
//   emerging:       3-4 responses → Emerging signal shown
//   unlocked:       5+ responses  → Full result unlocked
const UNLOCK_THRESHOLDS = {
  first_signals: 1,
  emerging:      3,
  unlocked:      5
};

// ── QUESTION BANK v4 (LD-06) ──────────────────────────────────────────────────
// 7 questions. Selected for maximum signal coverage + emotional immediacy.
// Completion target: 60–90 seconds.
// All mode: 'both' — same 7 questions for friends and dating.

const QUESTIONS = [
  {
    id: 'q01', mode: 'both', weight: 1.3,
    text: 'When this person enters a room, the atmosphere usually...',
    options: [
      { id: 'a', text: 'Shifts — people orient toward them without realizing it',        signals: { social_gravity: 3, quiet_authority: 1  } },
      { id: 'b', text: 'Stays the same — they blend in comfortably',                    signals: { hard_to_read: 1, selective_depth: 1    } },
      { id: 'c', text: 'Gets more energized — conversations pick up',                   signals: { rare_energy: 2, social_gravity: 1      } },
      { id: 'd', text: 'Gets lighter — there is a sense of ease',                       signals: { calm_magnet: 2, raw_warmth: 1          } }
    ]
  },
  {
    id: 'q02', mode: 'both', weight: 1.4,
    text: 'Under real pressure, this person becomes...',
    options: [
      { id: 'a', text: 'Quieter and more focused — the opposite of panicked',           signals: { dangerous_calm: 3, quiet_authority: 1  } },
      { id: 'b', text: 'Visibly stressed but they push through anyway',                 signals: { controlled_fire: 1, protective_force: 1 } },
      { id: 'c', text: 'The one who holds others together while absorbing the weight',  signals: { soft_power: 2, protective_force: 2     } },
      { id: 'd', text: 'Hard to read — you cannot tell how much it is affecting them',  signals: { hard_to_read: 2, dangerous_calm: 1     } }
    ]
  },
  {
    id: 'q03', mode: 'both', weight: 1.2,
    text: 'After spending real time with this person, you usually feel...',
    options: [
      { id: 'a', text: 'Energized — something about them stays with you',               signals: { rare_energy: 3, calm_magnet: 1         } },
      { id: 'b', text: 'Understood — like they actually saw you',                       signals: { emotional_radar: 3, raw_warmth: 1      } },
      { id: 'c', text: 'Calmer — like the noise around you turned down',                signals: { calm_magnet: 3, soft_power: 1          } },
      { id: 'd', text: 'Curious about them — like you want to know more',               signals: { hard_to_read: 2, selective_depth: 2    } }
    ]
  },
  {
    id: 'q05', mode: 'both', weight: 1.2,
    text: 'When someone close to them needs something, this person...',
    options: [
      { id: 'a', text: 'Shows up before being asked',                                   signals: { protective_force: 3, raw_warmth: 1     } },
      { id: 'b', text: 'Responds reliably when asked but does not anticipate',          signals: { selective_depth: 1, protective_force: 1 } },
      { id: 'c', text: 'Senses the need before being told and moves toward it',        signals: { emotional_radar: 2, protective_force: 2 } },
      { id: 'd', text: 'Gives space — shows care by not overwhelming',                  signals: { soft_power: 1, selective_depth: 2       } }
    ]
  },
  {
    id: 'q07', mode: 'both', weight: 1.1,
    text: 'The gap between what this person shows and who they really are is...',
    options: [
      { id: 'a', text: 'Small — what you see is consistently what you get',             signals: { raw_warmth: 2, selective_depth: -1     } },
      { id: 'b', text: 'Real — there is a private self most people never reach',        signals: { selective_depth: 3, hard_to_read: 1    } },
      { id: 'c', text: 'Large — you sense depth that rarely surfaces publicly',         signals: { dangerous_calm: 2, selective_depth: 2  } },
      { id: 'd', text: 'Inconsistent — different people get different versions',        signals: { hard_to_read: 2, soft_power: -1        } }
    ]
  },
  {
    id: 'q08', mode: 'both', weight: 1.3,
    text: 'When something goes seriously wrong, this person...',
    options: [
      { id: 'a', text: 'Becomes unnervingly steady — their calm in a crisis is real',  signals: { dangerous_calm: 3, quiet_authority: 1  } },
      { id: 'b', text: 'Gets intense — controlled but the pressure is visible',        signals: { controlled_fire: 3, quiet_authority: 1  } },
      { id: 'c', text: 'Takes care of others while quietly carrying the weight',       signals: { protective_force: 2, soft_power: 2      } },
      { id: 'd', text: 'Shows the stress — they do not perform stability',             signals: { raw_warmth: 1, selective_depth: -1       } }
    ]
  },
  {
    id: 'q10', mode: 'both', weight: 1.4,
    text: 'The effect this person has on the people around them is usually...',
    options: [
      { id: 'a', text: 'Gravitational — people adjust to their presence',              signals: { social_gravity: 3, quiet_authority: 1  } },
      { id: 'b', text: 'Warm — people feel safe and at ease',                          signals: { calm_magnet: 2, raw_warmth: 2          } },
      { id: 'c', text: 'Electric — hard to define but hard to ignore',                 signals: { rare_energy: 3, controlled_fire: 1     } },
      { id: 'd', text: 'Subtle — they shift rooms without being the loudest thing',    signals: { soft_power: 3, dangerous_calm: 1       } }
    ]
  }
];

// ── RESULT ENGINE v4 ──────────────────────────────────────────────────────────

function getQuestionsForMode() {
  return QUESTIONS; // all 7 questions work for both modes (LD-04)
}

function computeResult(responseRows) {
  const keys = Object.keys(SIGNALS);
  const sums = {}; const cnts = {};
  keys.forEach(k => { sums[k] = 0; cnts[k] = 0; });

  for (const row of responseRows) {
    let answers;
    try { answers = typeof row.answers === 'string' ? JSON.parse(row.answers) : row.answers; }
    catch { continue; }

    for (const [qid, optId] of Object.entries(answers)) {
      const q = QUESTIONS.find(x => x.id === qid);
      if (!q) continue;
      const opt = q.options.find(o => o.id === optId);
      if (!opt || !opt.signals) continue;
      const w = q.weight || 1;
      for (const [sig, weight] of Object.entries(opt.signals)) {
        if (sums[sig] !== undefined) { sums[sig] += weight * w; cnts[sig] += w; }
      }
    }
  }

  const normalized = {};
  for (const k of keys) {
    normalized[k] = cnts[k] > 0
      ? Math.max(-1, Math.min(1, sums[k] / (cnts[k] * 3)))
      : null;
  }

  const ranked = keys
    .filter(k => normalized[k] !== null)
    .sort((a, b) => Math.abs(normalized[b]) - Math.abs(normalized[a]));

  const n    = responseRows.length;
  const tier = getTier(n);

  function sig(k) {
    if (!k || normalized[k] === null) return null;
    const s = SIGNALS[k];
    const score = normalized[k];
    return {
      signal: k, score,
      label: s.label, label_tr: s.label_tr,
      lines_en: s.lines_en, lines_tr: s.lines_tr,
      icon: s.icon,
      text: score >= 0 ? s.high_text : s.low_text,
      blind_spot: s.blind_spot
    };
  }

  const blindSpotKey = ranked.find(k => normalized[k] !== null && normalized[k] < -0.3);

  return {
    tier, responseCount: n,
    thresholds: UNLOCK_THRESHOLDS,
    nextUnlock: getNextThreshold(tier),
    signals: normalized, ranked,
    primary:   sig(ranked[0]),
    secondary: sig(ranked[1]),
    tertiary:  sig(ranked[2]),
    blindSpot: tier === 'unlocked' && blindSpotKey ? sig(blindSpotKey) : null
  };
}

// LD-05: Tiers map to unlock states
function getTier(n) {
  if (n >= UNLOCK_THRESHOLDS.unlocked)      return 'unlocked';
  if (n >= UNLOCK_THRESHOLDS.emerging)      return 'emerging';
  if (n >= UNLOCK_THRESHOLDS.first_signals) return 'first_signals';
  return 'locked';
}

function getNextThreshold(tier) {
  return ({
    locked:        UNLOCK_THRESHOLDS.first_signals,
    first_signals: UNLOCK_THRESHOLDS.emerging,
    emerging:      UNLOCK_THRESHOLDS.unlocked,
    unlocked:      null
  })[tier] ?? null;
}

function coverageReport() {
  const total  = QUESTIONS.length;
  const mapped = QUESTIONS.filter(q =>
    q.options && q.options.every(o => o.signals && Object.keys(o.signals).length > 0)
  ).length;
  return {
    total, mapped,
    unmapped: QUESTIONS.filter(q =>
      !q.options || q.options.some(o => !o.signals || Object.keys(o.signals).length === 0)
    ).map(q => q.id),
    coverage: `${((mapped/total)*100).toFixed(0)}%`,
    signals: Object.keys(SIGNALS),
    signalCount: Object.keys(SIGNALS).length,
    version: QUESTION_BANK_VERSION
  };
}

function credibilityTest() {
  const qs = QUESTIONS;
  const fakeResponses = [
    ...Array(4).fill(null).map(() => ({
      answers: JSON.stringify(Object.fromEntries(qs.map(q => [q.id, q.options[0].id])))
    })),
    ...Array(2).fill(null).map(() => ({
      answers: JSON.stringify(Object.fromEntries(qs.map((q, i) => [q.id, q.options[i%4].id])))
    }))
  ];
  const r = computeResult(fakeResponses);
  return [{
    responseCount: r.responseCount, tier: r.tier,
    primary: r.primary ? `${r.primary.label} (${r.primary.score.toFixed(2)})` : 'none',
    secondary: r.secondary ? `${r.secondary.label} (${r.secondary.score.toFixed(2)})` : 'none',
    signalCount: r.ranked.length
  }];
}

module.exports = {
  QUESTIONS, SIGNALS, UNLOCK_THRESHOLDS, QUESTION_BANK_VERSION,
  getQuestionsForMode, computeResult, getTier, getNextThreshold,
  coverageReport, credibilityTest
};
