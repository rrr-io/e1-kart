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
//           thumb: zoom-out of the small square portrait (menu bubble, radio), e.g. 1.1 = head 10% farther.
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
    'Is that our FANCHANT? BOOOst!',
    'Copy, boost received.',
  ],
  lastLap: [
    'Final lap. GAME ON!',
  ],
};

// Each team is inspired by an ENHYPEN member; the lines follow that member's personality.
// Same order as TEAMS in config.js (the members by age).
// The player is always an ENGENE talking to their driver over the team radio.
export const DRIVERS = [
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
      select: ["I've studied this track a lot. Like, a LOT. Let's go, Engene!"],
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
      lose: [['Not our day. It happens to the best teams.', { t: "I'll look at the data. We can do it next time.", mood: 'normal' }]],
    },
  },
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
      select: ["Engene, relax. We're just going to win!"],
      start: [
        ['Easy. Deep breath.', { t: "Okay. Now let's beat everyone.", mood: 'hype' }],
        ['No pressure, Engene.', { t: '…Little bit of pressure. We want P1.', mood: 'hype' }],
      ],
      miniTurbo: ['Smooth. Very smooth.'],
      lastLap: ['Final lap. Stay chill. But also, go.'],
      takeLead: ["P1. Chill. Stay chill. …Okay, but also don't let them pass you."],
      overtake: ["Nice. Smooth."],
      overtaken: ["Huh. He passed you. That's fine. Get him back."],
      attack: ["A little gift for whoever's behind us."],
      slip: ["Oh, no! That's embarrassing!"],
      batsHit: ["Bats. Cool. Cool, cool. Where's the road?"],
      comeback: ["Okay, mate! Parallel world, here I come!"],
      win: [['P1. No wayyy.', 'You were amazing.']],
      podium: ["Podium's nice. Winning's nicer. Next one."],
      lose: [['Huh. Okay. No problem.', { t: 'Rematch. We can do it, together.', mood: 'hype' }]],
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
      select: ["Engene, fast laps? Let's go. We can do it."],
      start: [
        ['Ready?', { t: 'Good. Me too.', mood: 'hype' }],
      ],
      miniTurbo: ['Nice. Again!'],
      lastLap: ['Last lap. Enjoy it.'],
      takeLead: ["P1. Feels good, right?"],
      overtake: ["Yes. That's the feeling."],
      overtaken: ["He's quick. But we're better!"],
      attack: ["Enjoy the view from behind."],
      slip: ["Slippery. Fun. Go again."],
      batsHit: ["UAAA! I can't see."],
      comeback: ["Parallel world. Now we're talking."],
      win: [['P1.', 'That was fun. Thank you, Engene.']],
      podium: ['Podium. Good race. I liked that one.'],
      lose: [['Close one.', { t: "Again? I'm in.", mood: 'normal' }]],
    },
  },
  {
    // Sunoo: the brightest sunshine, ENGENE's best confidant. Cute, but fierce.
    team: 'ALPINOO',
    driver: 'SUNOO',
    portrait: {
      neutral: ['alpinoo-1.png', 'alpinoo-2.png'],
      win: ['alpinoo-4.png'],
      podium: ['alpinoo-3.png', 'alpinoo-4.png'],
      thumb: 1.1,
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
      comeback: ["Legendary! A parallel world, go go go!"],
      win: [['P1! I knew it, I knew it!', 'Mint choco ice cream to celebrate?']],
      podium: ['Podium! You were amazing. I mean it.'],
      lose: [['Hey, look at me. You did great.', { t: "And next time? We'll show our speed.", mood: 'hype' }]],
    },
  },
  {
    // Jungwon: goofy, loves ENGENEs, supportive but firm.
    team: 'MEOWCEDES',
    driver: 'JUNGWON',
    portrait: {
      neutral: ['meowcedes-1.png', 'meowcedes-2.png'],
      podium: ['meowcedes-3.png'],
      thumb: 1.1,
    },
    lines: {
      select: ["Engene, you picked us? Good choice."],
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
      comeback: ["YOIII Parallel world, activated."],
      win: [['P1! Engene, you did that!', "I'm not crying. The visor is fogged."]],
      podium: ["Podium. I'm proud of you. Next time, top step."],
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
      select: ["Engene. Let's win. Together."],
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
      win: [['P1.', "…Knew you could. You're amazing, Engene."]],
      podium: ['Podium. Not bad. What about 1st place next time?'],
      lose: [['Uhm.', { t: "I'm not leaving until we win, because Engene deserves 1st place.", mood: 'hype' }]],
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
