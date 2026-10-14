// Team drivers and dialogue lines.
//
// driver:   name shown on the dialogue nameplate (empty = the team's name).
// portrait: prefix of the portraits in public/drivers/. With portrait: 'alpinoo' the game loads
//           drivers/alpinoo-normal.png, -happy.png, -sad.png, -hype.png (missing ones fall back to -normal).
//           null = placeholder silhouette drawn by the game.
//
// Each key of "lines" is a list of variants: one is picked at random.
// A variant is a string (a single line) or a list of consecutive lines.
// A line can be { t: 'text', mood: 'happy' } to change the expression.
//
// Moments:
//   select      menu preview when you pick the team
//   start       dialogue before the lights (advance by tapping)
//   miniTurbo   in-race radio after a mini-turbo
//   lightstick  in-race radio when you use the lightstick boost
//   lastLap     radio at the start of the last lap
//   win / podium / lose   end-of-race dialogue, before the results

// Default mood for each moment.
export const DEFAULT_MOOD = {
  select: 'normal',
  start: 'normal',
  miniTurbo: 'hype',
  lightstick: 'happy',
  lastLap: 'hype',
  win: 'happy',
  podium: 'happy',
  lose: 'sad',
};

// Fallback lines used when a team doesn't have its own for that moment.
export const COMMON = {
  lightstick: [
    'ENGENEs in the stands just lit their lightsticks. Boost.',
    'Boost from the grandstand. Thank them later.',
    'Copy, boost received.',
  ],
  lastLap: [
    'Final lap. No mistakes.',
  ],
};

// Each team is inspired by an ENHYPEN member; the lines follow that member's personality.
// The player is always an ENGENE talking to their driver over the team radio.
export const DRIVERS = [
  {
    // Jake: chill, but secretly very competitive.
    team: 'MCJAKEY',
    driver: 'JAKE',
    portrait: null,
    lines: {
      select: ["Relax. We're just going to win, that's all."],
      start: [
        ['Easy. Deep breath.', { t: "Okay. Now let's beat everyone.", mood: 'hype' }],
        ['No pressure, Engene.', { t: '…Little bit of pressure. We want P1.', mood: 'hype' }],
      ],
      miniTurbo: ['Smooth. Very smooth.'],
      lastLap: ['Final lap. Stay chill. But also, go.'],
      win: [['P1. Told you, no stress.', '…Okay, I was a little stressed.']],
      podium: ["Podium's nice. Winning's nicer. Next one."],
      lose: [['Huh. Okay.', { t: 'Rematch. Right now.', mood: 'hype' }]],
    },
  },
  {
    // Jay: F1 nerd, loves explaining things, humble, always a friend to ENGENE.
    team: 'JAYBULL RACING',
    driver: 'JAY',
    portrait: null,
    lines: {
      select: ["I've studied this track a lot. Like, a lot. Let's go, Engene."],
      start: [
        ['Fun fact: most overtakes here happen into turn one.', { t: "So let's make one.", mood: 'hype' }],
        ['Tyres are cold for the first half lap.', 'Take it easy, then trust the grip. I trust you.'],
      ],
      miniTurbo: ['Textbook. Honestly, better than textbook.'],
      lastLap: ["Final lap. Gap's holding. Keep the lines we practiced."],
      win: [['P1. The data said we could do it.', "But the data didn't drive. You did."]],
      podium: ["Podium. Good points. I'll go through the telemetry with you later."],
      lose: [['Not our day. It happens to the best teams.', { t: "I'll look at the data. One more vote and we go again.", mood: 'normal' }]],
    },
  },
  {
    // Sunoo: the brightest sunshine, ENGENE's best confidant. Cute, but fierce.
    team: 'ALPINOO',
    driver: 'SUNOO',
    portrait: null,
    lines: {
      select: ["Engene! We're going to have so much fun. And win."],
      start: [
        ["You look nervous. It's okay, I'm right here.", { t: "Now let's show them how it's done.", mood: 'hype' }],
      ],
      miniTurbo: ['Ooh, that was pretty. And fast!'],
      lastLap: ["Final lap! I'm cheering the loudest, you know that."],
      win: [['P1! I knew it, I knew it!', 'Victory hug. Over the radio. It counts.']],
      podium: ['Podium! You were amazing. I mean it.'],
      lose: [['Hey, look at me. You did great.', { t: "And next time? We don't lose. Promise.", mood: 'hype' }]],
    },
  },
  {
    // Sunghoon: loves the thrill. Concise, but warm.
    team: 'HOONRARI',
    driver: 'SUNGHOON',
    portrait: null,
    lines: {
      select: ["Fast laps? Let's go."],
      start: [
        ['Ready?', { t: 'Good. Me too.', mood: 'hype' }],
      ],
      miniTurbo: ['Nice. Again.'],
      lastLap: ['Last lap. Enjoy it.'],
      win: [['P1.', 'That was fun. Thank you, Engene.']],
      podium: ['Podium. Good race. I liked that one.'],
      lose: [['Close one.', { t: "Again? I'm in.", mood: 'normal' }]],
    },
  },
  {
    // Jungwon: goofy, loves ENGENEs, supportive but firm.
    team: 'MEOWCEDES',
    driver: 'JUNGWON',
    portrait: null,
    lines: {
      select: ["Engene, you picked us? Good choice. Now let's not waste it."],
      start: [
        ['Radio check. Engene, you there?', "Okay. Mirrors, focus, hands on the wheel. I'm serious.", { t: "…Mostly serious. Let's go.", mood: 'hype' }],
        ['Three laps. I believe in you.', { t: 'Now prove me right.', mood: 'hype' }],
      ],
      miniTurbo: ["That's my Engene!", 'Wait, did you just— okay, that was cool.'],
      lastLap: ["Final lap. Eyes up, no silly mistakes. I'm watching."],
      win: [['P1! Engene, you did that!', "I'm not crying. The visor is fogged."]],
      podium: ["Podium. I'm proud of you. Next time, top step. That's an order."],
      lose: [["Hey. Don't be sad.", { t: 'We learn, we go again. Together.', mood: 'normal' }]],
    },
  },
  {
    // Ni-ki: HATES to lose. Not very vocal, but the best support: total loyalty and integrity.
    team: 'RIKSTON DRIFT',
    driver: 'NI-KI',
    portrait: null,
    lines: {
      select: ["…Let's win."],
      start: [
        ['Ready.', "I've got your back. Whole race."],
      ],
      miniTurbo: ['Good.'],
      lastLap: ["Last lap. Don't let them pass. Not now."],
      win: [['P1.', '…Knew you could.']],
      podium: ['Podium. Not enough. Again.'],
      lose: [['No.', { t: "Again. I'm not leaving until we win. You're not either.", mood: 'hype' }]],
    },
  },
];

/** A random variant for the team and moment, as a list of { t, mood }. */
export function pickLines(teamIdx, key) {
  const d = DRIVERS[teamIdx];
  const pool = (d && d.lines[key]) || COMMON[key];
  if (!pool || !pool.length) return [];
  const variant = pool[(Math.random() * pool.length) | 0];
  const list = Array.isArray(variant) ? variant : [variant];
  const mood = DEFAULT_MOOD[key] || 'normal';
  return list.map((l) => (typeof l === 'string' ? { t: l, mood } : { t: l.t, mood: l.mood || mood }));
}
