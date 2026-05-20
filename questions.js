'use strict';
// ─────────────────────────────────────────────────────────────────────────────
// TellMeMore — Question Bank v1
// Every question maps to named perception signals.
// Signals: warmth | confidence | reliability | social_energy | authenticity | leadership | empathy
// Answer option signals: { signalKey: weight }
//   weight range: -3 (strong negative) to +3 (strong positive)
//   question.weight: multiplier applied at scoring time (importance)
// ─────────────────────────────────────────────────────────────────────────────

const QUESTION_BANK_VERSION = 'v1';

const SIGNALS = {
  warmth:        { label: 'Warmth',          short: 'Warmth',        icon: '◈' },
  confidence:    { label: 'Confidence',      short: 'Confidence',    icon: '◆' },
  reliability:   { label: 'Reliability',     short: 'Reliability',   icon: '◉' },
  social_energy: { label: 'Social Presence', short: 'Social',        icon: '◇' },
  authenticity:  { label: 'Authenticity',    short: 'Authentic',     icon: '△' },
  leadership:    { label: 'Leadership',      short: 'Leadership',    icon: '○' },
  empathy:       { label: 'Empathy',         short: 'Empathy',       icon: '✦' }
};

// Unlock thresholds — response count required per tier
const UNLOCK_THRESHOLDS = {
  first_glimpse:    1,   // Tier 1 — primary signal name only
  basic_profile:    3,   // Tier 2 — top 2 signals + one sentence each
  strength_insight: 5,   // Tier 3 — top 3 signals with context
  hidden_signal:    7,   // Tier 4 — reveal 4th signal (the hidden one)
  full_result:      10   // Tier 5 — full picture including blind spot
};

const QUESTIONS = [

  // ────────────────────────────── BOTH MODES ──────────────────────────────

  {
    id: 'q01', mode: 'both', category: 'authenticity', weight: 1.2,
    text: 'When this person disagrees with the group, they usually...',
    options: [
      { id: 'a', text: 'Stay quiet — they avoid conflict',                      signals: { authenticity: -1, confidence: -1 } },
      { id: 'b', text: 'Say exactly what they think, directly',                 signals: { authenticity: 2,  confidence: 1  } },
      { id: 'c', text: 'Change the subject or disappear',                       signals: { authenticity: -1, social_energy: -1 } },
      { id: 'd', text: 'Find common ground first, then state their view',        signals: { authenticity: 1,  empathy: 1     } }
    ],
    result_impact: 'High weight on authenticity signal. Calibrates whether person performs or expresses.'
  },
  {
    id: 'q02', mode: 'both', category: 'reliability', weight: 1.3,
    text: 'Under real pressure, this person...',
    options: [
      { id: 'a', text: 'Stays calm and figures out a solution',                 signals: { reliability: 2,  confidence: 1  } },
      { id: 'b', text: 'Gets stressed but pushes through anyway',               signals: { reliability: 1,  authenticity: 1 } },
      { id: 'c', text: 'Shuts down or goes quiet',                              signals: { reliability: -1, social_energy: -1 } },
      { id: 'd', text: 'Leans on others heavily',                               signals: { empathy: 1,     reliability: -1 } }
    ],
    result_impact: 'Reliability under pressure is a key blind spot signal.'
  },
  {
    id: 'q03', mode: 'both', category: 'empathy', weight: 1.1,
    text: 'When someone around them is upset, this person...',
    options: [
      { id: 'a', text: 'Notices immediately and offers support without being asked', signals: { empathy: 2, warmth: 2 } },
      { id: 'b', text: 'Notices but is not sure how to respond',               signals: { empathy: 1,  confidence: -1 } },
      { id: 'c', text: 'Only notices if directly told something is wrong',     signals: { empathy: -1, social_energy: -1 } },
      { id: 'd', text: 'Gives space rather than intrude',                      signals: { empathy: 1,  authenticity: 1 } }
    ],
    result_impact: 'Maps directly to empathy signal and warmth as secondary.'
  },
  {
    id: 'q04', mode: 'both', category: 'authenticity', weight: 1.2,
    text: 'When this person makes a mistake in front of others, they...',
    options: [
      { id: 'a', text: 'Own it immediately and move on',                        signals: { authenticity: 2,  confidence: 1  } },
      { id: 'b', text: 'Get defensive before eventually admitting it',         signals: { authenticity: -1, confidence: -1 } },
      { id: 'c', text: 'Apologize excessively and over-explain',               signals: { authenticity: -1, confidence: -2 } },
      { id: 'd', text: 'Quietly correct it without making it a moment',        signals: { reliability: 1,   authenticity: 1 } }
    ],
    result_impact: 'Authenticity under failure pressure. High discriminating power.'
  },
  {
    id: 'q05', mode: 'both', category: 'social_energy', weight: 1.0,
    text: 'Walking into a room of people they barely know, this person...',
    options: [
      { id: 'a', text: 'Starts talking immediately — no warm-up needed',       signals: { social_energy: 2, confidence: 2  } },
      { id: 'b', text: 'Finds one person and stays with them',                 signals: { social_energy: -1, warmth: 1    } },
      { id: 'c', text: 'Waits to be approached',                              signals: { social_energy: -1, confidence: -1 } },
      { id: 'd', text: 'Scans the room, then approaches selectively',          signals: { social_energy: 1,  leadership: 1 } }
    ],
    result_impact: 'Social energy calibration — introvert vs extrovert signal.'
  },
  {
    id: 'q06', mode: 'both', category: 'warmth', weight: 1.1,
    text: 'After spending time with this person, you usually feel...',
    options: [
      { id: 'a', text: 'Energized — like you were really heard',               signals: { warmth: 2, empathy: 2      } },
      { id: 'b', text: 'Fine — neutral, nothing special',                      signals: { warmth: 0, social_energy: 0 } },
      { id: 'c', text: 'A bit drained — they take energy',                    signals: { warmth: -1, social_energy: -1 } },
      { id: 'd', text: 'Impressed but not particularly close',                 signals: { leadership: 1, warmth: -1  } }
    ],
    result_impact: 'Post-interaction warmth rating. Strongest warmth signal.'
  },
  {
    id: 'q07', mode: 'both', category: 'leadership', weight: 1.2,
    text: 'When a group cannot agree on a decision, this person...',
    options: [
      { id: 'a', text: 'Takes charge and makes a call',                        signals: { leadership: 2, confidence: 2  } },
      { id: 'b', text: 'Mediates and finds the middle ground',                 signals: { empathy: 2,   leadership: 1  } },
      { id: 'c', text: 'Follows whoever seems most confident',                 signals: { leadership: -1, confidence: -1 } },
      { id: 'd', text: 'Disengages until someone else decides',                signals: { leadership: -2, social_energy: -1 } }
    ],
    result_impact: 'Leadership signal primary. Useful blind spot for people who think they lead.'
  },
  {
    id: 'q08', mode: 'both', category: 'reliability', weight: 1.4,
    text: 'When this person says they will do something, you...',
    options: [
      { id: 'a', text: 'Know it is done — they always follow through',         signals: { reliability: 3              } },
      { id: 'b', text: 'Expect it but sometimes follow up',                   signals: { reliability: 1              } },
      { id: 'c', text: 'Wait and see — it is 50/50',                          signals: { reliability: -1             } },
      { id: 'd', text: 'Do not count on it until it happens',                  signals: { reliability: -2, authenticity: -1 } }
    ],
    result_impact: 'Highest weight reliability question. Strong predictor signal.'
  },
  {
    id: 'q09', mode: 'both', category: 'authenticity', weight: 1.3,
    text: 'How does this person talk about others when they are not in the room?',
    options: [
      { id: 'a', text: 'Mostly the same as to their face',                    signals: { authenticity: 2, reliability: 1  } },
      { id: 'b', text: 'More critical, but generally fair',                   signals: { authenticity: 1, confidence: 1   } },
      { id: 'c', text: 'Very differently — more negative, sometimes cruel',   signals: { authenticity: -2, reliability: -1 } },
      { id: 'd', text: 'Avoids talking about people in their absence',        signals: { authenticity: 1,  empathy: 1     } }
    ],
    result_impact: 'Authenticity behind-the-scenes. Very high signal value.'
  },
  {
    id: 'q10', mode: 'both', category: 'confidence', weight: 1.1,
    text: 'When shown to be publicly wrong about something, this person...',
    options: [
      { id: 'a', text: 'Accepts it gracefully and updates their view',         signals: { confidence: 2, authenticity: 2  } },
      { id: 'b', text: 'Accepts it but is visibly rattled',                   signals: { confidence: -1, authenticity: 1 } },
      { id: 'c', text: 'Doubles down to save face',                           signals: { confidence: -1, authenticity: -2 } },
      { id: 'd', text: 'Deflects with humor or changes the subject',          signals: { social_energy: 1, authenticity: -1 } }
    ],
    result_impact: 'Confidence under challenge. Differentiates secure vs fragile confidence.'
  },
  {
    id: 'q11', mode: 'both', category: 'social_energy', weight: 1.0,
    text: 'In a group setting, this person is usually...',
    options: [
      { id: 'a', text: 'The one driving the conversation',                     signals: { social_energy: 2, leadership: 1  } },
      { id: 'b', text: 'Active but not dominating',                           signals: { social_energy: 1, empathy: 1     } },
      { id: 'c', text: 'Quiet but clearly engaged',                           signals: { social_energy: -1, authenticity: 1 } },
      { id: 'd', text: 'Mostly in their head — hard to read',                 signals: { social_energy: -2, confidence: -1 } }
    ],
    result_impact: 'Group social energy calibration.'
  },
  {
    id: 'q12', mode: 'both', category: 'empathy', weight: 1.2,
    text: 'If you shared something painful with this person, they would...',
    options: [
      { id: 'a', text: 'Really listen and make you feel understood',           signals: { empathy: 3, warmth: 2           } },
      { id: 'b', text: 'Listen but quickly try to fix it',                    signals: { empathy: 1, leadership: 1       } },
      { id: 'c', text: 'Be sympathetic but a bit awkward',                    signals: { empathy: 0, authenticity: 1     } },
      { id: 'd', text: 'Share a related story about themselves',              signals: { empathy: -1, social_energy: 1   } }
    ],
    result_impact: 'Deepest empathy signal. Highest value for relationship mapping.'
  },
  {
    id: 'q13', mode: 'both', category: 'authenticity', weight: 1.1,
    text: 'In social contexts, how authentic does this person seem?',
    options: [
      { id: 'a', text: 'Completely — what you see is what you get',            signals: { authenticity: 3               } },
      { id: 'b', text: 'Mostly, with some performance in new settings',       signals: { authenticity: 1               } },
      { id: 'c', text: 'Hard to tell — they adapt a lot based on who is around', signals: { authenticity: -1          } },
      { id: 'd', text: 'Quite performed — rarely lets the mask drop',          signals: { authenticity: -2, confidence: -1 } }
    ],
    result_impact: 'Direct authenticity rating. Useful aggregated across responders.'
  },
  {
    id: 'q14', mode: 'both', category: 'warmth', weight: 1.0,
    text: 'When someone around them is struggling, this person...',
    options: [
      { id: 'a', text: 'Steps up without being asked',                        signals: { warmth: 2, empathy: 2          } },
      { id: 'b', text: 'Helps if asked but does not push',                   signals: { warmth: 1, reliability: 1     } },
      { id: 'c', text: 'Acknowledges it but stays out of it',                signals: { warmth: -1                    } },
      { id: 'd', text: 'Does not seem to notice',                            signals: { warmth: -2, empathy: -2       } }
    ],
    result_impact: 'Active warmth signal — behavior not feelings.'
  },
  {
    id: 'q15', mode: 'both', category: 'reliability', weight: 1.3,
    text: 'This person and time/commitments...',
    options: [
      { id: 'a', text: 'Consistently punctual and prepared',                  signals: { reliability: 2               } },
      { id: 'b', text: 'Usually on time, occasionally slips',                signals: { reliability: 1               } },
      { id: 'c', text: 'Regularly late or forgetful about commitments',      signals: { reliability: -1              } },
      { id: 'd', text: 'Chronically unreliable with time',                   signals: { reliability: -2, authenticity: -1 } }
    ],
    result_impact: 'Behavioral reliability. Responders measure this accurately.'
  },

  // ──────────────────────────── FRIENDS ONLY ───────────────────────────────

  {
    id: 'q16', mode: 'friends', category: 'reliability', weight: 1.4,
    text: 'If two of your mutual friends were in conflict, this person would...',
    options: [
      { id: 'a', text: 'Stay neutral — they do not pick sides',               signals: { reliability: 1, empathy: 1    } },
      { id: 'b', text: 'Side with whoever they believe is right, even if uncomfortable', signals: { authenticity: 2, reliability: 1 } },
      { id: 'c', text: 'Quietly side with whoever is more powerful in the group', signals: { authenticity: -2, reliability: -1 } },
      { id: 'd', text: 'Try to solve it and bring them back together',        signals: { empathy: 2, leadership: 1     } }
    ],
    result_impact: 'Loyalty under social pressure — key friendship reliability signal.'
  },
  {
    id: 'q17', mode: 'friends', category: 'warmth', weight: 1.1,
    text: 'When you succeed at something big, this person...',
    options: [
      { id: 'a', text: 'Is genuinely excited — no jealousy, full support',   signals: { warmth: 3, authenticity: 1    } },
      { id: 'b', text: 'Is happy but makes it about themselves quickly',     signals: { warmth: 0, authenticity: -1   } },
      { id: 'c', text: 'Minimizes it slightly or stays neutral',             signals: { warmth: -1, authenticity: -1  } },
      { id: 'd', text: 'Celebrates loudly in public but seems off in private', signals: { authenticity: -2, social_energy: 1 } }
    ],
    result_impact: 'Envy vs support signal. Critical friendship differentiator.'
  },
  {
    id: 'q18', mode: 'friends', category: 'reliability', weight: 1.5,
    text: 'When life gets genuinely hard for you, does this person show up?',
    options: [
      { id: 'a', text: 'Always — they are the first one there',               signals: { reliability: 3, warmth: 2     } },
      { id: 'b', text: 'Usually, though not always sure how to help',        signals: { reliability: 2, warmth: 1     } },
      { id: 'c', text: 'Sometimes — depends on their own situation',         signals: { reliability: 0               } },
      { id: 'd', text: 'Rarely — they tend to disappear when things get heavy', signals: { reliability: -2, warmth: -1 } }
    ],
    result_impact: 'Highest-weight friendship reliability question.'
  },
  {
    id: 'q19', mode: 'friends', category: 'empathy', weight: 1.2,
    text: 'When there is tension between you and this person, they usually...',
    options: [
      { id: 'a', text: 'Address it directly but kindly',                     signals: { empathy: 2, authenticity: 2   } },
      { id: 'b', text: 'Wait for you to bring it up',                       signals: { empathy: 0, confidence: -1    } },
      { id: 'c', text: 'Act like nothing happened',                         signals: { authenticity: -1, empathy: -1 } },
      { id: 'd', text: 'Go cold or distant without explanation',             signals: { empathy: -2, authenticity: -1 } }
    ],
    result_impact: 'Conflict approach — empathy vs avoidance in direct relationship.'
  },
  {
    id: 'q20', mode: 'friends', category: 'warmth', weight: 1.0,
    text: 'In a group, how does this person treat someone on the outside of the circle?',
    options: [
      { id: 'a', text: 'Includes them naturally and makes them feel welcome', signals: { warmth: 3, empathy: 2        } },
      { id: 'b', text: 'Polite but does not go out of their way',           signals: { warmth: 0                    } },
      { id: 'c', text: 'Does not notice or engage much',                    signals: { warmth: -1, empathy: -1      } },
      { id: 'd', text: 'Can be exclusive or subtly dismissive',             signals: { warmth: -2, authenticity: -1 } }
    ],
    result_impact: 'In-group vs out-group warmth. Key character signal.'
  },
  {
    id: 'q21', mode: 'friends', category: 'reliability', weight: 1.4,
    text: 'If you told this person something in confidence, you would expect...',
    options: [
      { id: 'a', text: 'Complete privacy — they never break confidence',     signals: { reliability: 3, authenticity: 1 } },
      { id: 'b', text: 'Privacy unless they thought you really needed help', signals: { reliability: 2, empathy: 1    } },
      { id: 'c', text: 'It probably gets shared — they struggle with secrets', signals: { reliability: -2           } },
      { id: 'd', text: 'I would not risk it',                               signals: { reliability: -3, authenticity: -1 } }
    ],
    result_impact: 'Trust and discretion. High weight, clear outcomes.'
  },
  {
    id: 'q22', mode: 'friends', category: 'leadership', weight: 1.0,
    text: 'In your friend group, this person tends to be...',
    options: [
      { id: 'a', text: 'The one who sets the energy and drives plans',       signals: { leadership: 2, social_energy: 2 } },
      { id: 'b', text: 'The one who keeps the peace and holds things together', signals: { empathy: 2, reliability: 1 } },
      { id: 'c', text: 'The one who goes along with whatever is decided',   signals: { leadership: -1, social_energy: -1 } },
      { id: 'd', text: 'The outsider — does not quite fit one role',        signals: { authenticity: 1, social_energy: -1 } }
    ],
    result_impact: 'Group role — leadership vs support vs follower signal.'
  },
  {
    id: 'q23', mode: 'friends', category: 'social_energy', weight: 1.0,
    text: 'When it comes to making plans, this person...',
    options: [
      { id: 'a', text: 'Usually initiates — always has ideas and energy',    signals: { social_energy: 2, leadership: 2 } },
      { id: 'b', text: 'Responds enthusiastically when invited',            signals: { social_energy: 1, warmth: 1   } },
      { id: 'c', text: 'Participates but rarely initiates',                 signals: { social_energy: 0, leadership: -1 } },
      { id: 'd', text: 'Often unavailable or hard to pin down',             signals: { social_energy: -1, reliability: -1 } }
    ],
    result_impact: 'Initiation energy — leader vs reactor distinction.'
  },

  // ──────────────────────────── ROMANCE ONLY ───────────────────────────────

  {
    id: 'q24', mode: 'romance', category: 'authenticity', weight: 1.4,
    text: 'How vulnerable does this person allow themselves to be?',
    options: [
      { id: 'a', text: 'Very open — shares fears, doubts, and soft spots',   signals: { authenticity: 3, empathy: 1   } },
      { id: 'b', text: 'Selectively — opens up over time with the right person', signals: { authenticity: 2, reliability: 1 } },
      { id: 'c', text: 'Rarely — keeps most things close',                   signals: { authenticity: -1, confidence: -1 } },
      { id: 'd', text: 'Never — vulnerability feels like weakness',           signals: { authenticity: -2, empathy: -1 } }
    ],
    result_impact: 'Emotional openness in romance context — primary intimacy signal.'
  },
  {
    id: 'q25', mode: 'romance', category: 'reliability', weight: 1.3,
    text: 'In a conflict with someone they care about, they...',
    options: [
      { id: 'a', text: 'Communicate directly and work through it',           signals: { reliability: 2, empathy: 2    } },
      { id: 'b', text: 'Need time to cool down but always return to it',     signals: { reliability: 1, authenticity: 1 } },
      { id: 'c', text: 'Shut down or go cold',                              signals: { reliability: -1, empathy: -1  } },
      { id: 'd', text: 'Avoid it until resentment builds',                  signals: { reliability: -2, authenticity: -1 } }
    ],
    result_impact: 'Conflict resolution in romantic context — reliability + empathy.'
  },
  {
    id: 'q26', mode: 'romance', category: 'warmth', weight: 1.2,
    text: 'The way this person shows they care is mostly through...',
    options: [
      { id: 'a', text: 'Consistent presence and quality time',               signals: { warmth: 2, reliability: 1     } },
      { id: 'b', text: 'Small, consistent gestures over time',              signals: { warmth: 2, authenticity: 1    } },
      { id: 'c', text: 'Big gestures when it matters, quieter in between',  signals: { warmth: 1, reliability: -1   } },
      { id: 'd', text: 'Saying it more than showing it',                    signals: { warmth: 0, reliability: -1    } }
    ],
    result_impact: 'Love expression style — warmth + consistency in romance.'
  },
  {
    id: 'q27', mode: 'romance', category: 'confidence', weight: 1.2,
    text: 'Their balance between independence and closeness in a relationship is...',
    options: [
      { id: 'a', text: 'Healthy — their own life and space for yours',       signals: { confidence: 2, authenticity: 1 } },
      { id: 'b', text: 'Leans toward closeness — needs connection',         signals: { confidence: -1, warmth: 1    } },
      { id: 'c', text: 'Leans toward distance — keeps walls up',            signals: { confidence: 1, authenticity: -1 } },
      { id: 'd', text: 'Switches — sometimes clingy, sometimes cold',        signals: { reliability: -2, authenticity: -1 } }
    ],
    result_impact: 'Attachment style signal — key romance dimension.'
  },
  {
    id: 'q28', mode: 'romance', category: 'authenticity', weight: 1.3,
    text: 'How does this person handle jealousy or insecurity?',
    options: [
      { id: 'a', text: 'Names it directly — communicates it calmly',        signals: { authenticity: 3, reliability: 1 } },
      { id: 'b', text: 'Manages it internally without acting on it',        signals: { confidence: 2, authenticity: 1 } },
      { id: 'c', text: 'Acts on it — controlling behavior or testing',      signals: { authenticity: -2, reliability: -1 } },
      { id: 'd', text: 'Plays it cool but holds it inside',                 signals: { authenticity: -1, social_energy: 1 } }
    ],
    result_impact: 'Emotional regulation and authenticity in romantic stress.'
  },
  {
    id: 'q29', mode: 'romance', category: 'empathy', weight: 1.3,
    text: 'In terms of emotional availability, this person is...',
    options: [
      { id: 'a', text: 'Consistently present and emotionally engaged',      signals: { empathy: 3, warmth: 2         } },
      { id: 'b', text: 'Available when they are in a good place',           signals: { empathy: 1, reliability: -1   } },
      { id: 'c', text: 'Physically there but emotionally distant',          signals: { empathy: -2, warmth: -1       } },
      { id: 'd', text: 'Hard to reach emotionally most of the time',        signals: { empathy: -3, authenticity: -1 } }
    ],
    result_impact: 'Deepest romance-specific empathy signal.'
  },
  {
    id: 'q30', mode: 'romance', category: 'reliability', weight: 1.5,
    text: 'Long-term, this person seems like someone who...',
    options: [
      { id: 'a', text: 'Builds things that last',                           signals: { reliability: 3, authenticity: 1 } },
      { id: 'b', text: 'Tries hard but may lose steam over time',           signals: { reliability: 0, social_energy: -1 } },
      { id: 'c', text: 'Keeps options open unconsciously',                  signals: { reliability: -1, authenticity: -1 } },
      { id: 'd', text: 'Leaves when things get genuinely difficult',        signals: { reliability: -3, authenticity: -1 } }
    ],
    result_impact: 'Long-term reliability — highest weight romance question.'
  },
  {
    id: 'q31', mode: 'romance', category: 'authenticity', weight: 1.2,
    text: 'How does this person treat you when others are around, compared to in private?',
    options: [
      { id: 'a', text: 'The same — consistently warm and real',             signals: { authenticity: 3, warmth: 1    } },
      { id: 'b', text: 'More affectionate in private, professional in public', signals: { authenticity: 1, reliability: 1 } },
      { id: 'c', text: 'Better in public — more performance than reality',  signals: { authenticity: -2, reliability: -1 } },
      { id: 'd', text: 'Very different — hard to reconcile the two versions', signals: { authenticity: -3, reliability: -1 } }
    ],
    result_impact: 'Authenticity in public vs private — key romance signal.'
  }
];

// ─── RESULT ENGINE ───────────────────────────────────────────────────────────

function getQuestionsForMode(mode) {
  return QUESTIONS.filter(q => q.mode === 'both' || q.mode === mode);
}

// Compute aggregate signal scores from an array of DB response rows.
// Each row must have .answers (JSON string: { questionId: optionId }).
function computeResult(responseRows) {
  const scores  = {};
  const counts  = {};
  const sigKeys = Object.keys(SIGNALS);
  sigKeys.forEach(k => { scores[k] = 0; counts[k] = 0; });

  for (const row of responseRows) {
    let answers;
    try { answers = typeof row.answers === 'string' ? JSON.parse(row.answers) : row.answers; }
    catch { continue; }

    for (const [qid, optId] of Object.entries(answers)) {
      const q = QUESTIONS.find(x => x.id === qid);
      if (!q) continue;
      const opt = q.options.find(o => o.id === optId);
      if (!opt) continue;
      const qw = q.weight || 1;
      for (const [sig, w] of Object.entries(opt.signals)) {
        if (scores[sig] !== undefined) {
          scores[sig] += w * qw;
          counts[sig] += qw;
        }
      }
    }
  }

  // Normalize to -1..+1 (max raw weight ~3 * 1.5 per question)
  const normalized = {};
  for (const k of sigKeys) {
    normalized[k] = counts[k] > 0
      ? Math.max(-1, Math.min(1, scores[k] / (counts[k] * 3)))
      : null;
  }

  // Rank by |strength|, non-null first
  const ranked = sigKeys
    .filter(k => normalized[k] !== null)
    .sort((a, b) => Math.abs(normalized[b]) - Math.abs(normalized[a]));

  const n    = responseRows.length;
  const tier = getTier(n);

  return {
    tier,
    responseCount: n,
    thresholds: UNLOCK_THRESHOLDS,
    nextUnlock: getNextThreshold(tier),
    signals: normalized,
    ranked,
    primary:   ranked[0] ? makeSig(ranked[0], normalized[ranked[0]])   : null,
    secondary: ranked[1] ? makeSig(ranked[1], normalized[ranked[1]])   : null,
    tertiary:  ranked[2] ? makeSig(ranked[2], normalized[ranked[2]])   : null,
    hidden:    ranked[3] ? makeSig(ranked[3], normalized[ranked[3]])   : null,
    blindSpot: ranked.find(k => normalized[k] < -0.4) ? makeSig(
      ranked.find(k => normalized[k] < -0.4),
      normalized[ranked.find(k => normalized[k] < -0.4)]
    ) : null
  };
}

function getTier(n) {
  if (n >= UNLOCK_THRESHOLDS.full_result)      return 'full_result';
  if (n >= UNLOCK_THRESHOLDS.hidden_signal)    return 'hidden_signal';
  if (n >= UNLOCK_THRESHOLDS.strength_insight) return 'strength_insight';
  if (n >= UNLOCK_THRESHOLDS.basic_profile)    return 'basic_profile';
  if (n >= UNLOCK_THRESHOLDS.first_glimpse)    return 'first_glimpse';
  return 'locked';
}

function getNextThreshold(tier) {
  const t = UNLOCK_THRESHOLDS;
  const map = {
    locked:           t.first_glimpse,
    first_glimpse:    t.basic_profile,
    basic_profile:    t.strength_insight,
    strength_insight: t.hidden_signal,
    hidden_signal:    t.full_result,
    full_result:      null
  };
  return map[tier] ?? null;
}

function makeSig(key, score) {
  return { signal: key, score, label: SIGNALS[key].label, icon: SIGNALS[key].icon, text: signalText(key, score) };
}

// Natural language result per signal+score
function signalText(sig, score) {
  const s = score > 0;
  const strong = Math.abs(score) > 0.55;
  const TEXTS = {
    warmth: {
      pp: 'People feel genuinely cared for around you — that warmth is real and visible.',
      p:  'You come across as warm and approachable to the people around you.',
      n:  'Your warmth is not always visible to others. People sense some distance.',
      nn: 'People find it hard to feel emotionally close to you. The distance is noticeable.'
    },
    confidence: {
      pp: 'You project real self-assurance. It is noticed and trusted.',
      p:  'You carry yourself with quiet, steady confidence.',
      n:  'Uncertainty comes through in how you carry yourself. Others pick it up.',
      nn: 'Your confidence does not read clearly in most situations.'
    },
    reliability: {
      pp: 'People trust your word completely. That level of follow-through is rare.',
      p:  'You are generally seen as someone who does what they say.',
      n:  'Your reliability is inconsistent. It creates quiet doubt in people around you.',
      nn: 'People have learned not to fully count on you. That pattern is visible.'
    },
    social_energy: {
      pp: 'You define the energy in rooms you enter. People feel your presence.',
      p:  'You bring positive presence to social settings. People notice when you are there.',
      n:  'Your energy in groups is quiet and reserved. You tend to recede.',
      nn: 'In group settings, you largely fade into the background — even when you do not mean to.'
    },
    authenticity: {
      pp: 'What people see is what you are. That consistency is rare and valued.',
      p:  'You come across as genuine. Minimal performance. People trust what they see.',
      n:  'People sense a gap between your public and private self.',
      nn: 'The version of you others see feels different from who you actually are. People notice.'
    },
    leadership: {
      pp: 'You have a natural pull — people look to you for direction without you trying.',
      p:  'You take initiative in ways others appreciate and follow.',
      n:  'You tend to follow rather than lead — even in moments where you could step up.',
      nn: 'Leadership is not something you often step into, even when the situation calls for it.'
    },
    empathy: {
      pp: 'You read people with unusual accuracy. They feel deeply understood around you.',
      p:  'You tune into others naturally. People feel seen when they are with you.',
      n:  'You miss emotional cues that matter to the people around you.',
      nn: 'Emotional attunement is not your strongest trait. People feel it.'
    }
  };
  const t = TEXTS[sig];
  if (!t) return '';
  if (s && strong)  return t.pp;
  if (s && !strong) return t.p;
  if (!s && strong) return t.nn;
  return t.n;
}

module.exports = {
  QUESTIONS,
  SIGNALS,
  UNLOCK_THRESHOLDS,
  QUESTION_BANK_VERSION,
  getQuestionsForMode,
  computeResult,
  getTier,
  getNextThreshold
};
