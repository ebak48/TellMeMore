export const QUESTIONS = {
  friends: {
    mode: 'friends', label: 'Friends',
    section1: [
      { id:'s1', section:1, format:'forced', routeWeight:'primary',
        text: "What's it like to spend time with this person?",
        options: [
          { key:'A', text:'Easy and relaxing — natural to be around',           signals:{ positive:1 } },
          { key:'B', text:'Energetic — something is always happening',           signals:{ positive:1 } },
          { key:'C', text:'Intense — nice, but you need to know your limits',    signals:{ neutral:1 } },
          { key:'D', text:"Distant — they don't quite open up",                 signals:{ negative:1 } }
        ]
      },
      { id:'s2', section:1, format:'forced',
        text:'Where does this person usually land in a group?',
        options: [
          { key:'A', text:'At the center — everyone looks to them',              signals:{ positive:1, magnetic:1 } },
          { key:'B', text:'The balancer — quiet but decisive',                   signals:{ positive:1 } },
          { key:'C', text:'The observer — waiting for the right moment',         signals:{ neutral:1 } },
          { key:'D', text:'On the edges — not quite part of it',                signals:{ negative:1 } }
        ]
      },
      { id:'s3', section:1, format:'forced',
        text:'If you had something hard to share, would they be your first call?',
        options: [
          { key:'A', text:'Yes — always the first person I think of',            signals:{ positive:1, trust:2 } },
          { key:'B', text:'Sometimes — depends on the topic',                    signals:{ neutral:1 } },
          { key:'C', text:'Not really — not that kind of person',               signals:{ negative:1 } },
          { key:'D', text:'No — emotionally closed off',                         signals:{ negative:1, distance:1 } }
        ]
      }
    ],
    section2_fixed: [
      { id:'s4', section:2, format:'forced',
        text:'If you disagreed with this person, what would happen?',
        options: [
          { key:'A', text:"They'd stay calm and look for a solution",            signals:{ positive:1, trust:1 } },
          { key:'B', text:"They'd be honest, then move on",                      signals:{ positive:1 } },
          { key:'C', text:"They'd go quiet and keep it inside",                  signals:{ neutral:1, guarded:1 } },
          { key:'D', text:"They'd get defensive and try to prove they're right", signals:{ negative:1, friction:1 } }
        ]
      },
      { id:'s5', section:2, format:'pair',
        text:'Which feels more true?',
        options: [
          { key:'A', text:'More trustworthy than they realize',                  signals:{ positive:1, magnetic:1 } },
          { key:'B', text:'Reliable on the surface, but lets very little in',    signals:{ neutral:1, friction:1 } }
        ]
      },
      { id:'s6', section:2, format:'forced', hiddenLayer:'attraction',
        text:'What does it feel like when this person enters a room?',
        options: [
          { key:'A', text:'The energy shifts — you notice them',                 signals:{ magnetic:2, presence:2 } },
          { key:'B', text:'Warmth arrives — the room relaxes',                   signals:{ magnetic:1, warmth:2 } },
          { key:'C', text:'They slip in quietly — you notice them later',        signals:{ neutral:1 } },
          { key:'D', text:'Nothing really changes — they stay in the background',signals:{ negative:1, presence:-1 } }
        ]
      }
    ],
    section2_pathA: [
      { id:'s7a', section:2, format:'pair', path:'A',
        text:"They're warm and open — do they still protect their limits?",
        options: [
          { key:'A', text:'Yes — open but with clear limits',                    signals:{ positive:1, balance:1 } },
          { key:'B', text:'Sometimes gives too much and gets nothing back',       signals:{ friction:1, reciprocity:-1 } }
        ]
      },
      { id:'s8a', section:2, format:'forced', path:'A',
        text:'When do people need this person most?',
        options: [
          { key:'A', text:'In hard moments — they make you feel safe',           signals:{ magnetic:1, trust:2 } },
          { key:'B', text:'In fun moments — they bring the energy',              signals:{ magnetic:1, energy:2 } },
          { key:'C', text:'Both — always there',                                 signals:{ positive:2, magnetic:1 } },
          { key:'D', text:"Honestly, they're not really needed",                 signals:{ negative:1, friction:1 } }
        ]
      }
    ],
    section2_pathB: [
      { id:'s7b', section:2, format:'forced', path:'B',
        text:'Where does this distance come from?',
        options: [
          { key:'A', text:"In their own world — doesn't engage much with the outside", signals:{ distance:2, warmth:-1, independence:1 } },
          { key:'B', text:'Tests you first — opens up once trust is built',      signals:{ guarded:2, trust_delay:2 } },
          { key:'C', text:"A defense mechanism — though they don't show it",     signals:{ vulnerability_hidden:2, sensitivity:1 } },
          { key:'D', text:'Just seems indifferent — disengaged',                signals:{ distance:3 } }
        ]
      },
      { id:'s8b', section:2, format:'pair', path:'B',
        text:'Which feels more true?',
        options: [
          { key:'A', text:'Mysterious — makes you want to know more',            signals:{ magnetic:1, mystery:2 } },
          { key:'B', text:'Hard to read — exhausting at times',                  signals:{ friction:2, negative:1 } }
        ]
      }
    ],
    section3: [
      { id:'s9', section:3, format:'gut', weight:1.5,
        text:'When they leave, what do people say?',
        options: [
          { key:'A', text:'"What an incredible person — we\'re lucky to know them"', signals:{ positive:2, magnetic:1 } },
          { key:'B', text:'"So much energy — it\'s contagious"',                signals:{ positive:1, magnetic:1, energy:1 } },
          { key:'C', text:'"Good person, but hard to figure out"',              signals:{ neutral:1 } },
          { key:'D', text:'"Why did they act like that?"',                       signals:{ negative:2, friction:1 } }
        ]
      }
    ]
  },

  romance: {
    mode: 'romance', label: 'Romance',
    section1: [
      { id:'s1', section:1, format:'forced', routeWeight:'primary',
        text:'What did you feel when you first saw this person?',
        options: [
          { key:'A', text:'They immediately caught my eye',                       signals:{ positive:1, magnetic:2 } },
          { key:'B', text:'They made me curious — I wanted to know more',        signals:{ positive:1, magnetic:1 } },
          { key:'C', text:'It took a while — I noticed them later',              signals:{ neutral:1 } },
          { key:'D', text:"Honestly, I didn't really notice them",               signals:{ negative:1 } }
        ]
      },
      { id:'s2', section:1, format:'forced',
        text:'What do they make you feel, romantically?',
        options: [
          { key:'A', text:'Excited and safe — both at once',                     signals:{ positive:1, trust:1 } },
          { key:'B', text:"Attracted but hard to read — can't quite figure them out", signals:{ magnetic:2, mystery:1 } },
          { key:'C', text:'Interesting, but no clear signal',                    signals:{ neutral:1 } },
          { key:'D', text:"Unclear — hard to know what they're thinking",        signals:{ negative:1, friction:1 } }
        ]
      },
      { id:'s3', section:1, format:'forced',
        text:"Can you tell when they're flirting?",
        options: [
          { key:'A', text:'Yes — clear and natural, it just flows',              signals:{ positive:1, magnetic:1 } },
          { key:'B', text:'Sometimes — they give subtle hints',                  signals:{ neutral:1 } },
          { key:'C', text:'Hard to say — very mysterious, signals unclear',      signals:{ neutral:1, mystery:1 } },
          { key:'D', text:'No — no signal at all',                               signals:{ negative:1 } }
        ]
      }
    ],
    section2_fixed: [
      { id:'s4', section:2, format:'forced',
        text:"What's their strongest romantic quality?",
        options: [
          { key:'A', text:'Their confidence — it creates attraction',            signals:{ positive:1, magnetic:1 } },
          { key:'B', text:'They really listen — makes you feel seen',            signals:{ positive:1, warmth:1 } },
          { key:'C', text:'Their warmth and sincerity',                          signals:{ positive:1 } },
          { key:'D', text:"Honestly, I haven't noticed a standout quality yet",  signals:{ negative:1, neutral:1 } }
        ]
      },
      { id:'s5', section:2, format:'pair',
        text:'Which feels more true?',
        options: [
          { key:'A', text:'More attractive than they realize — unaware of their effect', signals:{ magnetic:2, positive:1 } },
          { key:'B', text:'Attractive, but that awareness creates distance',     signals:{ magnetic:1, friction:1 } }
        ]
      },
      { id:'s6', section:2, format:'forced', hiddenLayer:'attraction',
        text:'What does their presence feel like in a room?',
        options: [
          { key:'A', text:'Magnetic — eyes go to them',                          signals:{ magnetic:2, presence:2 } },
          { key:'B', text:'Warm — being near them feels safe',                   signals:{ magnetic:1, warmth:2 } },
          { key:'C', text:'Intriguing — but hard to reach',                      signals:{ neutral:1, mystery:1 } },
          { key:'D', text:"Neutral — doesn't leave much of an impression",       signals:{ negative:1, presence:-1 } }
        ]
      }
    ],
    section2_pathA: [
      { id:'s7a', section:2, format:'pair', path:'A',
        text:"They're attractive — are they easy to approach?",
        options: [
          { key:'A', text:'Yes — attractive and approachable',                   signals:{ positive:1, magnetic:1 } },
          { key:'B', text:'No — attractive but it takes courage to get close',   signals:{ magnetic:1, friction:1, distance:1 } }
        ]
      },
      { id:'s8a', section:2, format:'forced', path:'A',
        text:"What's their biggest romantic effect?",
        options: [
          { key:'A', text:'Makes you feel confident — good to be around them',   signals:{ magnetic:1, warmth:1 } },
          { key:'B', text:'Makes you curious — you want to know more',           signals:{ magnetic:1, mystery:1 } },
          { key:'C', text:'Exciting — something unexpected could happen any moment', signals:{ positive:1, energy:1 } },
          { key:'D', text:'Calming — makes you feel safe',                       signals:{ positive:1, trust:1 } }
        ]
      }
    ],
    section2_pathB: [
      { id:'s7b', section:2, format:'forced', path:'B',
        text:'Where does this romantic distance come from?',
        options: [
          { key:'A', text:"Doesn't trust easily — opens up with time",           signals:{ guarded:1, trust_delay:1 } },
          { key:'B', text:"Not emotionally ready — it's just not the right time",signals:{ neutral:1, distance:1 } },
          { key:'C', text:'Emotionally fragile — protecting themselves',         signals:{ vulnerability_hidden:1, sensitivity:1 } },
          { key:'D', text:'Seems disinterested — not giving romantic signals',   signals:{ negative:2, distance:2 } }
        ]
      },
      { id:'s8b', section:2, format:'pair', path:'B',
        text:'Which feels more true?',
        options: [
          { key:'A', text:'Mysterious — the distance actually makes them more attractive', signals:{ magnetic:1, mystery:2 } },
          { key:'B', text:'Hard to read — the uncertainty is tiring',            signals:{ friction:2, negative:1 } }
        ]
      }
    ],
    section3: [
      { id:'s9', section:3, format:'gut', weight:1.5,
        text:'What affects you most about this person?',
        options: [
          { key:'A', text:'Their presence — something shifts when they enter a room', signals:{ magnetic:2, presence:2 } },
          { key:'B', text:'Their gaze — like they actually see you',             signals:{ magnetic:1, warmth:1 } },
          { key:'C', text:"Their mystery — I've never quite figured them out",   signals:{ neutral:1, mystery:1 } },
          { key:'D', text:"Honestly, they haven't had much of an effect on me",  signals:{ negative:2 } }
        ]
      }
    ]
  }
};

export const RESULTS = {
  contradiction: [
    { id:'c1', text:"People are naturally drawn to you — but pause just before getting close.",  trigger:'magnetic_distance' },
    { id:'c2', text:"You have a strong presence. But that strength can read as distance.",       trigger:'strength_distance' },
    { id:'c3', text:"You leave more of an impression than you realize. But you rarely show it.", trigger:'hidden_impact' },
    { id:'c4', text:"People miss you — without saying it.",                                      trigger:'silent_miss' },
    { id:'c5', text:"You give a lot — but does it always come back?",                           trigger:'overgiving' },
    { id:'c6', text:"Your energy is magnetic — but people can't always predict what comes next.", trigger:'unpredictable_energy' },
    { id:'c7', text:"You say little. But what you say stays.",                                   trigger:'quiet_impact' }
  ],
  magnetic: [
    "When you enter a room, something shifts. You might not even notice.",
    "People remember your energy, not just your words.",
    "Emotionally attractive — more powerful than physical."
  ],
  friction: [
    "Some people hesitate before getting close. They sense walls.",
    "Your intention isn't always clear — and that keeps some people at a distance.",
    "You want to be trusted, but it doesn't always come through."
  ],
  patternMessage: {
    1:"Listening.",
    2:"Two perspectives in.",
    3:"Getting closer. One more to unlock the first read.",
    4:"Something keeps showing up.",
    5:"5 people in. The picture is sharpening.",
    6:"6 in. A contradiction might be forming.",
    7:"Almost there. One more unlocks the contradiction read.",
    8:"People agree on something — and disagree on something else.",
    9:"9 people in. The full picture is forming.",
    10:"10 in. Two more unlocks everything.",
    11:"Almost complete. One more."
  },
  unlockMessage: {
    4:"Something keeps showing up.",
    8:"People agree on something — and disagree on something else.",
    12:"This is how you're experienced. All of it."
  }
};

export const ROUTING = {
  computePath(s1answer, s2answer, s3answer, questions) {
    const sig = (q, key) => {
      const opt = q.options.find(o => o.key === key);
      if (!opt) return 'neutral';
      const s = opt.signals;
      if (s.positive) return 'positive';
      if (s.negative) return 'negative';
      if (s.magnetic) return 'positive';
      return 'neutral';
    };
    const sig1 = sig(questions.section1[0], s1answer);
    const sig2 = sig(questions.section1[1], s2answer);
    const sig3 = sig(questions.section1[2], s3answer);
    if (sig1 === 'negative') return 'B';
    const pos = [sig1,sig2,sig3].filter(s=>s==='positive').length;
    const neg = [sig1,sig2,sig3].filter(s=>s==='negative').length;
    if (pos >= 2) return 'A';
    if (neg >= 2) return 'B';
    if (sig1 === 'positive') return 'A';
    return 'B';
  },
  computeSignals(answers, questions, path) {
    const allQ = [
      ...questions.section1, ...questions.section2_fixed,
      ...(path==='A' ? questions.section2_pathA : questions.section2_pathB),
      ...questions.section3
    ];
    const totals = {};
    for (const q of allQ) {
      const ans = answers[q.id]; if (!ans) continue;
      const opt = q.options.find(o=>o.key===ans); if (!opt) continue;
      const w = q.weight||1;
      for (const [sig,val] of Object.entries(opt.signals))
        totals[sig] = (totals[sig]||0) + (val*w);
    }
    return totals;
  },
  selectContradiction(signals) {
    const pos=( signals.positive||0)+(signals.magnetic||0);
    const neg=(signals.negative||0)+(signals.friction||0);
    const dist=signals.distance||0, recip=signals.reciprocity||0;
    const energy=signals.energy||0, quiet=(signals.trust_delay||0)+(signals.guarded||0);
    if(pos>=3&&dist>=2)   return 'c1';
    if(pos>=3&&neg>=2)    return 'c2';
    if((signals.magnetic||0)>=3) return 'c3';
    if(quiet>=3)          return 'c7';
    if(recip<0)           return 'c5';
    if(energy>=2&&neg>=1) return 'c6';
    if(neg>=2)            return 'c4';
    return 'c3';
  },
  getTier(count) {
    if(count>=12) return 3;
    if(count>=8)  return 2;
    if(count>=4)  return 1;
    return 0;
  },
  getNextTier(tier, count) {
    if(tier===0) return { threshold:4,  remaining:4 -count, label:'first read' };
    if(tier===1) return { threshold:8,  remaining:8 -count, label:'contradiction read' };
    if(tier===2) return { threshold:12, remaining:12-count, label:'full profile' };
    return null;
  },
  getPatternMessage(count) {
    if(count>=12) return RESULTS.unlockMessage[12];
    return RESULTS.patternMessage[count] || RESULTS.patternMessage[Math.min(count,11)];
  }
};
