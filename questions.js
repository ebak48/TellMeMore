export const QUESTIONS = {
  friends: {
    mode: 'friends',
    label: 'Friends',
    section1: [
      {
        id: 's1', section: 1, format: 'forced',
        text: 'Yanında zaman geçirmek nasıl bir his?',
        options: [
          { key: 'A', text: 'Rahatlatıcı — yanında olmak kolay',               signals: { positive: 1 } },
          { key: 'B', text: 'Enerjik — her an bir şey oluyor',                   signals: { positive: 1 } },
          { key: 'C', text: 'Yoğun — güzel ama dozunu bilmek lazım',             signals: { neutral: 1 } },
          { key: 'D', text: 'Mesafeli — tam açılmıyor gibi hissettiriyor',        signals: { negative: 1 } }
        ],
        routeWeight: 'primary'
      },
      {
        id: 's2', section: 1, format: 'forced',
        text: 'Bir grupta bu kişi genellikle nerede durur?',
        options: [
          { key: 'A', text: 'Ortanın tam merkezinde — herkes ona bakıyor',        signals: { positive: 1, magnetic: 1 } },
          { key: 'B', text: 'Dengeyi kuran — sessiz ama belirleyici',             signals: { positive: 1 } },
          { key: 'C', text: 'Gözlemleyen — konuşmak için doğru anı bekliyor',    signals: { neutral: 1 } },
          { key: 'D', text: 'Kenarda — gruba tam dahil olmuyor',                  signals: { negative: 1 } }
        ]
      },
      {
        id: 's3', section: 1, format: 'forced',
        text: 'Zor bir şey paylaşman gerekse ilk aklına gelir mi?',
        options: [
          { key: 'A', text: 'Evet, hep ilk o aklıma gelir',                      signals: { positive: 1, trust: 2 } },
          { key: 'B', text: 'Bazen — bağlı olduğu konuya',                       signals: { neutral: 1 } },
          { key: 'C', text: 'Pek değil — o tarz konular için değil',             signals: { negative: 1 } },
          { key: 'D', text: 'Hayır — duygusal konularda kapalı',                  signals: { negative: 1, distance: 1 } }
        ]
      }
    ],
    section2_fixed: [
      {
        id: 's4', section: 2, format: 'forced',
        text: 'Bu kişiyle anlaşmazlık yaşarsan ne olur?',
        options: [
          { key: 'A', text: 'Sakin kalır, çözüm arar',                           signals: { positive: 1, trust: 1 } },
          { key: 'B', text: 'Dürüstçe konuşur, sonra geçer',                     signals: { positive: 1 } },
          { key: 'C', text: 'Sessizleşir, içine atar',                            signals: { neutral: 1, guarded: 1 } },
          { key: 'D', text: 'Savunmaya geçer, haklılığını kanıtlamaya çalışır',  signals: { negative: 1, friction: 1 } }
        ]
      },
      {
        id: 's5', section: 2, format: 'pair',
        text: 'Bu kişiyle ilgili hangisi daha doğru?',
        options: [
          { key: 'A', text: 'Fark ettiğinden daha çok güven veriyor',            signals: { positive: 1, magnetic: 1 } },
          { key: 'B', text: 'Güvenilir görünüyor ama içine çok az alıyor',       signals: { neutral: 1, friction: 1 } }
        ]
      },
      {
        id: 's6', section: 2, format: 'forced', hiddenLayer: 'attraction',
        text: 'Bu kişinin odaya girişi nasıl hissettiriyor?',
        options: [
          { key: 'A', text: 'Enerji değişiyor — fark ediliyor',                  signals: { magnetic: 2, presence: 2 } },
          { key: 'B', text: 'Sıcaklık getiriyor — ortam rahatıyor',              signals: { magnetic: 1, warmth: 2 } },
          { key: 'C', text: 'Sessizce giriyor — zamanla fark ediliyor',          signals: { neutral: 1 } },
          { key: 'D', text: 'Pek değişmiyor — arka planda kalıyor',              signals: { negative: 1, presence: -1 } }
        ]
      }
    ],
    section2_pathA: [
      {
        id: 's7a', section: 2, format: 'pair', path: 'A',
        text: 'Bu kadar sıcak ve açık biri — sınırlarını da koruyor mu?',
        options: [
          { key: 'A', text: 'Evet — hem açık hem sınırları net',                 signals: { positive: 1, balance: 1 } },
          { key: 'B', text: 'Bazen çok veriyor, karşılık bulamıyor',             signals: { friction: 1, reciprocity: -1 } }
        ]
      },
      {
        id: 's8a', section: 2, format: 'forced', path: 'A',
        text: 'İnsanlar ona ne zaman daha çok ihtiyaç duyuyor?',
        options: [
          { key: 'A', text: 'Zor anlarda — güvende hissettiriyor',               signals: { magnetic: 1, trust: 2 } },
          { key: 'B', text: 'Eğlenceli anlarda — enerji katar',                  signals: { magnetic: 1, energy: 2 } },
          { key: 'C', text: 'Her iki durumda da',                                signals: { positive: 2, magnetic: 1 } },
          { key: 'D', text: 'Pek ihtiyaç duyulmuyor aslında',                   signals: { negative: 1, friction: 1 } }
        ]
      }
    ],
    section2_pathB: [
      {
        id: 's7b', section: 2, format: 'forced', path: 'B',
        text: 'Bu mesafe nereden geliyor sence?',
        options: [
          { key: 'A', text: 'Kendi dünyasında — dışarıyı pek umursamıyor',      signals: { distance: 2, warmth: -1, independence: 1 } },
          { key: 'B', text: 'İlk önce test ediyor, sonra açılıyor',              signals: { guarded: 2, trust_delay: 2 } },
          { key: 'C', text: 'Savunma mekanizması — bunu göstermiyor ama',        signals: { vulnerability_hidden: 2, sensitivity: 1 } },
          { key: 'D', text: 'Umursamıyor sanki — ilgisiz',                       signals: { distance: 3 } }
        ]
      },
      {
        id: 's8b', section: 2, format: 'pair', path: 'B',
        text: 'Bu kişiyle ilgili hangisi daha doğru?',
        options: [
          { key: 'A', text: 'Gizemli — merak uyandırıyor, daha fazlasını öğrenmek istiyorum', signals: { magnetic: 1, mystery: 2 } },
          { key: 'B', text: 'Zor anlaşılıyor — yorucu hissettiriyor bazen',      signals: { friction: 2, negative: 1 } }
        ]
      }
    ],
    section3: [
      {
        id: 's9', section: 3, format: 'gut', weight: 1.5,
        text: 'Bu kişi odadan çıkınca arkadaşlar ne der?',
        options: [
          { key: 'A', text: '"Ne kadar iyi biri — şanslıyız"',                  signals: { positive: 2, magnetic: 1 } },
          { key: 'B', text: '"Çok eğlenceli, enerjisi bulaşıcı"',               signals: { positive: 1, magnetic: 1, energy: 1 } },
          { key: 'C', text: '"İyi biri ama tam anlayamadım"',                    signals: { neutral: 1 } },
          { key: 'D', text: '"Neden böyle davrandı acaba?"',                     signals: { negative: 2, friction: 1 } }
        ]
      }
    ]
  },

  romance: {
    mode: 'romance',
    label: 'Romance',
    section1: [
      {
        id: 's1', section: 1, format: 'forced',
        text: 'Bu kişiyi ilk gördüğünde ne hissettin?',
        options: [
          { key: 'A', text: 'Hemen dikkat çekti — gözüm gitti',                  signals: { positive: 1, magnetic: 2 } },
          { key: 'B', text: 'Merak uyandırdı — daha fazlasını öğrenmek istedim', signals: { positive: 1, magnetic: 1 } },
          { key: 'C', text: 'Zaman aldı — sonradan fark ettim',                  signals: { neutral: 1 } },
          { key: 'D', text: 'Pek fark etmedim açıkçası',                         signals: { negative: 1 } }
        ],
        routeWeight: 'primary'
      },
      {
        id: 's2', section: 1, format: 'forced',
        text: 'Romantik olarak ne hissettiriyor?',
        options: [
          { key: 'A', text: 'Heyecanlı ve güvende — ikisi bir arada',            signals: { positive: 1, trust: 1 } },
          { key: 'B', text: 'Çekici ama gizemli — tam okuyamıyorum',             signals: { magnetic: 2, mystery: 1 } },
          { key: 'C', text: 'İlgi çekici ama sinyal vermiyor',                   signals: { neutral: 1 } },
          { key: 'D', text: 'Belirsiz — ne düşündüğünü anlamak zor',             signals: { negative: 1, friction: 1 } }
        ]
      },
      {
        id: 's3', section: 1, format: 'forced',
        text: 'Flört ettiğini anlayabilir misin?',
        options: [
          { key: 'A', text: 'Evet, çok net ve doğal — kendiliğinden akıyor',    signals: { positive: 1, magnetic: 1 } },
          { key: 'B', text: 'Bazen — ince ipuçları veriyor',                     signals: { neutral: 1 } },
          { key: 'C', text: 'Zor — çok gizemli, sinyal belirsiz',                signals: { neutral: 1, mystery: 1 } },
          { key: 'D', text: 'Hayır — hiç sinyal yok',                            signals: { negative: 1 } }
        ]
      }
    ],
    section2_fixed: [
      {
        id: 's4', section: 2, format: 'forced',
        text: 'Romantik olarak en güçlü yanı ne?',
        options: [
          { key: 'A', text: 'Kendinden emin duruşu — çekim yaratıyor',           signals: { positive: 1, magnetic: 1 } },
          { key: 'B', text: 'Gerçekten dinliyor — özel hissettiriyor',           signals: { positive: 1, warmth: 1 } },
          { key: 'C', text: 'Sıcaklığı ve samimiyeti',                           signals: { positive: 1 } },
          { key: 'D', text: 'Açıkçası henüz güçlü bir yanını fark etmedim',     signals: { negative: 1, neutral: 1 } }
        ]
      },
      {
        id: 's5', section: 2, format: 'pair',
        text: 'Bu kişiyle ilgili hangisi daha doğru?',
        options: [
          { key: 'A', text: 'Fark ettiğinden daha çekici — etkisinin farkında değil', signals: { magnetic: 2, positive: 1 } },
          { key: 'B', text: 'Çekici ama bu farkındalığı mesafe yaratıyor',       signals: { magnetic: 1, friction: 1 } }
        ]
      },
      {
        id: 's6', section: 2, format: 'forced', hiddenLayer: 'attraction',
        text: 'Bu kişinin varlığı ortamda ne hissettiriyor?',
        options: [
          { key: 'A', text: 'Manyetik — gözler ona gidiyor',                     signals: { magnetic: 2, presence: 2 } },
          { key: 'B', text: 'Sıcak — yanında olmak güvende hissettiriyor',       signals: { magnetic: 1, warmth: 2 } },
          { key: 'C', text: 'Merak uyandırıcı — ama ulaşmak zor',               signals: { neutral: 1, mystery: 1 } },
          { key: 'D', text: 'Nötr — pek iz bırakmıyor',                         signals: { negative: 1, presence: -1 } }
        ]
      }
    ],
    section2_pathA: [
      {
        id: 's7a', section: 2, format: 'pair', path: 'A',
        text: 'Bu kadar çekici biri — yaklaşmak kolay mı?',
        options: [
          { key: 'A', text: 'Evet — çekici ve aynı zamanda ulaşılabilir',        signals: { positive: 1, magnetic: 1 } },
          { key: 'B', text: 'Hayır — çekici ama yaklaşmak için cesaret lazım',   signals: { magnetic: 1, friction: 1, distance: 1 } }
        ]
      },
      {
        id: 's8a', section: 2, format: 'forced', path: 'A',
        text: 'Romantik olarak en büyük etkisi ne?',
        options: [
          { key: 'A', text: 'Kendine güven veriyor — yanında iyi hissediyorsun', signals: { magnetic: 1, warmth: 1 } },
          { key: 'B', text: 'Merak ettiriyor — daha fazlasını öğrenmek istiyorsun', signals: { magnetic: 1, mystery: 1 } },
          { key: 'C', text: 'Heyecanlandırıyor — her an beklenmedik bir şey olabilir', signals: { positive: 1, energy: 1 } },
          { key: 'D', text: 'Sakinleştiriyor — güvende hissettiriyor',           signals: { positive: 1, trust: 1 } }
        ]
      }
    ],
    section2_pathB: [
      {
        id: 's7b', section: 2, format: 'forced', path: 'B',
        text: 'Romantik olarak bu mesafe nereden geliyor?',
        options: [
          { key: 'A', text: 'Kolay güvenmiyor — zamanla açılıyor',              signals: { guarded: 1, trust_delay: 1 } },
          { key: 'B', text: 'Duygusal olarak hazır değil — zamanı değil sanki',  signals: { neutral: 1, distance: 1 } },
          { key: 'C', text: 'Duygusal olarak kırılgan — korunuyor',              signals: { vulnerability_hidden: 1, sensitivity: 1 } },
          { key: 'D', text: 'İlgisiz görünüyor — romantik sinyal vermiyor',      signals: { negative: 2, distance: 2 } }
        ]
      },
      {
        id: 's8b', section: 2, format: 'pair', path: 'B',
        text: 'Bu kişiyle ilgili hangisi daha doğru?',
        options: [
          { key: 'A', text: 'Gizemli — bu mesafe aslında çekici kılıyor',        signals: { magnetic: 1, mystery: 2 } },
          { key: 'B', text: 'Zor okunuyor — bu belirsizlik yorucu',              signals: { friction: 2, negative: 1 } }
        ]
      }
    ],
    section3: [
      {
        id: 's9', section: 3, format: 'gut', weight: 1.5,
        text: 'Bu kişide seni en çok etkileyen ne?',
        options: [
          { key: 'A', text: 'Varlığı — ortama girince bir şeyler değişiyor',    signals: { magnetic: 2, presence: 2 } },
          { key: 'B', text: 'Bakışı — sanki gerçekten görüyor seni',             signals: { magnetic: 1, warmth: 1 } },
          { key: 'C', text: 'Gizemli tarafı — hiç tam anlayamadım',             signals: { neutral: 1, mystery: 1 } },
          { key: 'D', text: 'Aslında pek etkilemedi',                            signals: { negative: 2 } }
        ]
      }
    ]
  }
};

export const RESULTS = {
  contradiction: [
    { id: 'c1', text: 'İnsanlar sana doğal olarak çekiliyor — ama tam yaklaşmadan önce duraksıyorlar.', trigger: 'magnetic_distance' },
    { id: 'c2', text: 'Güçlü bir varlığın var. Ama bu güç bazen mesafe gibi algılanıyor.',              trigger: 'strength_distance' },
    { id: 'c3', text: 'Fark ettiğinden çok daha fazla iz bırakıyorsun. Ama bunu nadiren gösteriyorsun.', trigger: 'hidden_impact' },
    { id: 'c4', text: 'İnsanlar seni özlüyor — bunu söylemeden.',                                        trigger: 'silent_miss' },
    { id: 'c5', text: 'Çok veriyorsun — ama bu her zaman karşılık buluyor mu?',                         trigger: 'overgiving' },
    { id: 'c6', text: 'Enerjin çekici — ama insanlar ne bekleyeceğini bilemiyor.',                       trigger: 'unpredictable_energy' },
    { id: 'c7', text: 'Az konuşuyorsun. Ama söylediklerin akılda kalıyor.',                              trigger: 'quiet_impact' }
  ],
  magnetic: [
    'Ortama girince enerji değişiyor. Bunu fark etmiyor olabilirsin.',
    'İnsanlar kelimelerini değil, enerjini hatırlıyor.',
    'Duygusal olarak çekici — bu fiziksel çekimden daha güçlü.'
  ],
  friction: [
    'Bazıları tam yaklaşmadan önce duruyor. Duvarların olduğunu düşünüyorlar.',
    'Niyetin her zaman net değil — bu bazılarını uzak tutuyor.',
    'Güven vermek istiyorsun ama bu her zaman hissedilmiyor.'
  ],
  livePattern: {
    3:  'İlk pattern çıkıyor. Bir şey tekrar ediyor.',
    5:  '3 kişi aynı şeyi fark etti. Profil netleşiyor.',
    8:  'Güçlü bir pattern var. Tam resmi görmek için devam et.',
    12: 'Profil tamamlandı. Seni gerçekten tanıyorlar.'
  }
};

export const ROUTING = {
  computePath(s1answer, s2answer, s3answer, questions) {
    const getSignal = (q, key) => {
      const opt = q.options.find(o => o.key === key);
      if (!opt) return 'neutral';
      const sigs = opt.signals;
      if (sigs.positive) return 'positive';
      if (sigs.negative) return 'negative';
      if (sigs.magnetic) return 'positive';
      return 'neutral';
    };

    const s1q = questions.section1[0];
    const s2q = questions.section1[1];
    const s3q = questions.section1[2];

    const sig1 = getSignal(s1q, s1answer);
    const sig2 = getSignal(s2q, s2answer);
    const sig3 = getSignal(s3q, s3answer);

    if (sig1 === 'negative') return 'B';

    const positiveCount = [sig1, sig2, sig3].filter(s => s === 'positive').length;
    const negativeCount = [sig1, sig2, sig3].filter(s => s === 'negative').length;

    if (positiveCount >= 2) return 'A';
    if (negativeCount >= 2) return 'B';
    if (sig1 === 'positive') return 'A';
    return 'B';
  },

  computeSignals(answers, questions, path) {
    const allQ = [
      ...questions.section1,
      ...questions.section2_fixed,
      ...(path === 'A' ? questions.section2_pathA : questions.section2_pathB),
      ...questions.section3
    ];

    const totals = {};
    for (const q of allQ) {
      const ans = answers[q.id];
      if (!ans) continue;
      const opt = q.options.find(o => o.key === ans);
      if (!opt) continue;
      const weight = q.weight || 1;
      for (const [sig, val] of Object.entries(opt.signals)) {
        totals[sig] = (totals[sig] || 0) + (val * weight);
      }
    }
    return totals;
  },

  selectContradiction(signals) {
    const pos = (signals.positive || 0) + (signals.magnetic || 0);
    const neg = (signals.negative || 0) + (signals.friction || 0);
    const dist = signals.distance || 0;
    const recip = signals.reciprocity || 0;
    const energy = signals.energy || 0;
    const quiet = (signals.trust_delay || 0) + (signals.guarded || 0);

    if (pos >= 3 && dist >= 2)   return 'c1';
    if (pos >= 3 && neg >= 2)    return 'c2';
    if (signals.magnetic >= 3)   return 'c3';
    if (quiet >= 3)              return 'c7';
    if (recip < 0)               return 'c5';
    if (energy >= 2 && neg >= 1) return 'c6';
    if (neg >= 2)                return 'c4';
    return 'c3';
  }
};
