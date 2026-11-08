// Team drivers and dialogue lines.
//
// driver:   name shown on the dialogue nameplate (empty = the team's name).
// portrait: the driver's drawings in public/drivers/, by moment (half-body pixel art, shown behind the
//           dialogue box). Each moment lists one or more files; one is picked at random
//           every time the driver talks, so two drawings in a list alternate.
//             neutral: the dialogue before the start, the menu, the radio during the race
//             win:     the dialogue after the finish, in first place (missing = podium)
//             podium:  the dialogue after the finish, on the podium (missing = end)
//             end:     the dialogue after the finish, off the podium (missing = neutral)
//           The drawings are traced at double resolution (about 110×157) and shown 1:1, to keep the
//           fine detail of hair and eyes; scale: 2 doubles a drawing made at normal resolution.
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
//   takeLead    radio when you take 1st place
//   overtake    radio when you pass someone (without reaching 1st)
//   overtaken   radio when someone passes you
//   attack      radio when you drop a BLOOD POP or send a BAT SWARM
//   slip        radio when you step on a BLOOD POP
//   batsHit     radio when the BAT SWARM reaches you
//   comeback    radio when you use PARALLEL WORLD
//   win / podium / lose   end-of-race dialogue, before the results

// Default mood for each moment.
export const DEFAULT_MOOD = {
  select: 'normal',
  start: 'normal',
  miniTurbo: 'hype',
  lightstick: 'happy',
  lastLap: 'hype',
  takeLead: 'happy',
  overtake: 'hype',
  overtaken: 'normal',
  attack: 'hype',
  slip: 'sad',
  batsHit: 'normal',
  comeback: 'hype',
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
    portrait: {
      neutral: ['mcjakey-1.png', 'mcjakey-2.png'],
      win: ['mcjakey-4.png'],
      podium: ['mcjakey-3.png'],
    },
    lines: {
      select: ["Relax. We're just going to win, that's all."],
      start: [
        ['Easy. Deep breath.', { t: "Okay. Now let's beat everyone.", mood: 'hype' }],
        ['No pressure, Engene.', { t: '…Little bit of pressure. We want P1.', mood: 'hype' }],
      ],
      miniTurbo: ['Smooth. Very smooth.'],
      lastLap: ['Final lap. Stay chill. But also, go.'],
      takeLead: ["P1. Chill. Stay chill. …Okay, but also don't lose it."],
      overtake: ["Nice. Smooth."],
      overtaken: ["Huh. He passed you. That's fine. Get him back."],
      attack: ["A little gift for whoever's behind us."],
      slip: ["Hey, that's embarrassing!"],
      batsHit: ["Bats. Cool. Cool, cool. Where's the road?"],
      comeback: ["Okay, mate! Parallel world, here I come!"],
      win: [['P1. Told you, no stress.', '…Okay, I was a little stressed.']],
      podium: ["Podium's nice. Winning's nicer. Next one."],
      lose: [['Huh. Okay.', { t: 'Rematch. Right now.', mood: 'hype' }]],
    },
  },
  {
    // Jay: F1 nerd, loves explaining things, humble, always a friend to ENGENE.
    team: 'JAYBULL RACING',
    driver: 'JAY',
    portrait: {
      neutral: ['jaybull-1.png'],
      win: ['jaybull-3.png'],
      podium: ['jaybull-2.png'],
    },
    lines: {
      select: ["I've studied this track a lot. Like, a lot. Let's go, Engene."],
      start: [
        ['Fun fact: most overtakes here happen into turn one.', { t: "So let's make one.", mood: 'hype' }],
        ['Tyres are cold for the first half lap.', 'Take it easy, then trust the grip. I trust you.'],
      ],
      miniTurbo: ['Textbook. Honestly, better than textbook.'],
      lastLap: ["Final lap. Gap's holding. Keep the lines we practiced."],
      takeLead: ["P1. Are you a Pro?"],
      overtake: ["Clean pass. Textbook, honestly."],
      overtaken: ["He had the better exit. We'll fix it next corner."],
      attack: ["Deployed."],
      slip: ["Low grip on that popsicle. Noted. Next time we avoid it."],
      batsHit: ["Visibility is zero. Trust the braking points we practiced."],
      comeback: ["Parallel world! Let's take the lead. We earned it!"],
      win: [['P1. The data said we could do it.', "But the data didn't drive. You did."]],
      podium: ["Podium. Good points. I'll go through the telemetry with you later."],
      lose: [['Not our day. It happens to the best teams.', { t: "I'll look at the data. One more vote and we go again.", mood: 'normal' }]],
    },
  },
  {
    // Sunoo: the brightest sunshine, ENGENE's best confidant. Cute, but fierce.
    team: 'ALPINOO',
    driver: 'SUNOO',
    portrait: {
      neutral: ['alpinoo-1.png', 'alpinoo-2.png'],
      podium: ['alpinoo-3.png', 'alpinoo-4.png'],
    },
    lines: {
      select: ["Engene! We're going to have so much fun. And win."],
      start: [
        ["You look nervous. It's okay, I'm right here.", { t: "Now let's show them how it's done.", mood: 'hype' }],
      ],
      miniTurbo: ['Ooh, that was pretty. And fast!'],
      lastLap: ["Final lap! I'm cheering the loudest, you know that."],
      takeLead: ["We're first! Selfie? Nah, maybe later."],
      overtake: ["Bye-bye! Sorry! Not sorry!"],
      overtaken: ["Hey, rude! Go get them back."],
      attack: ["A little treat for the ones behind us~"],
      slip: ["Whoa! Slippery! You okay?"],
      batsHit: ["It's dark! But I know you can do it blind. Go!"],
      comeback: ["Legendary! A parallel world, and we're blooming! Go go go!"],
      win: [['P1! I knew it, I knew it!', 'Victory hug. Over the radio. It counts.']],
      podium: ['Podium! You were amazing. I mean it.'],
      lose: [['Hey, look at me. You did great.', { t: "And next time? We don't lose. Promise.", mood: 'hype' }]],
    },
  },
  {
    // Sunghoon: loves the thrill. Concise, but warm.
    team: 'HOONRARI',
    driver: 'SUNGHOON',
    portrait: {
      neutral: ['hoonrari-1.png', 'hoonrari-2.png'],
      podium: ['hoonrari-3.png', 'hoonrari-4.png'],
      end: ['hoonrari-3.png'],
    },
    lines: {
      select: ["Fast laps? Let's go."],
      start: [
        ['Ready?', { t: 'Good. Me too.', mood: 'hype' }],
      ],
      miniTurbo: ['Nice. Again.'],
      lastLap: ['Last lap. Enjoy it.'],
      takeLead: ["P1. Feels good, right?"],
      overtake: ["Yes. That's the feeling."],
      overtaken: ["He's quick. Good. Make it a race."],
      attack: ["Enjoy the view from behind."],
      slip: ["Slippery. Fun. Go again."],
      batsHit: ["Can't see. I love chaos."],
      comeback: ["Parallel world. Now we're talking."],
      win: [['P1.', 'That was fun. Thank you, Engene.']],
      podium: ['Podium. Good race. I liked that one.'],
      lose: [['Close one.', { t: "Again? I'm in.", mood: 'normal' }]],
    },
  },
  {
    // Jungwon: goofy, loves ENGENEs, supportive but firm.
    team: 'MEOWCEDES',
    driver: 'JUNGWON',
    portrait: {
      neutral: ['meowcedes-1.png', 'meowcedes-2.png'],
      podium: ['meowcedes-3.png'],
    },
    lines: {
      select: ["Engene, you picked us? Good choice. Now let's not waste it."],
      start: [
        ['Radio check. Engene, you there?', "Okay. Mirrors, focus, hands on the wheel. I'm serious.", { t: "…Mostly serious. Let's go.", mood: 'hype' }],
        ['Three laps. I believe in you.', { t: 'Now prove me right.', mood: 'hype' }],
      ],
      miniTurbo: ["That's my Engene!", 'Wait, did you just— okay, that was cool.'],
      lastLap: ["Final lap. Eyes up, no silly mistakes. I'm watching."],
      takeLead: ["P1! ENGENEEE!"],
      overtake: ["Got him. Eheh"],
      overtaken: ["He passed you. Okay. Pass him back."],
      attack: ["Sorry, not sorry."],
      slip: ["You slipped on a popsicle. Really?"],
      batsHit: ["AAA Bats! Stay calm, you know this track by heart."],
      comeback: ["Parallel world, activated. Time to bloom."],
      win: [['P1! Engene, you did that!', "I'm not crying. The visor is fogged."]],
      podium: ["Podium. I'm proud of you. Next time, top step. That's an order."],
      lose: [["Hey. Don't be sad.", { t: 'We learn, we go again. Together.', mood: 'normal' }]],
    },
  },
  {
    // Ni-ki: HATES to lose. Not very vocal, but the best support: total loyalty and integrity.
    team: 'RIKSTON DRIFT',
    driver: 'NI-KI',
    portrait: {
      neutral: ['rikston-1.png', 'rikston-2.png'],
      win: ['rikston-5.png'],
      podium: ['rikston-3.png', 'rikston-4.png'],
    },
    lines: {
      select: ["…Let's win."],
      start: [
        ['Ready.', "I've got your back. Whole race."],
      ],
      miniTurbo: ['Good.'],
      lastLap: ["Last lap. Don't let them pass. Not now."],
      takeLead: ["P1. Exactly where we're supposed to be."],
      overtake: ["Let's gooo!"],
      overtaken: ["Ouch. Let's not panic!"],
      attack: ["They can follow us. If they can."],
      slip: ["Forget it. Next corner. I'm with you."],
      batsHit: ["Can't see? Don't stop. I'm here by your side."],
      comeback: ["Parallel world. Last place isn't where we end."],
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
