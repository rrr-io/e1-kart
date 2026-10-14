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
    'The ENGENEs lit up their lightsticks: boost!',
    'This boost comes straight from the stands.',
    'Lightstick on, heart on, engine too.',
  ],
  lastLap: [
    'Final lap! Now or never.',
  ],
};

export const DRIVERS = [
  {
    team: 'MCJAKEY',
    driver: '',
    portrait: null,
    lines: {
      select: ['Papaya ready, tyres ready. Pick me and the podium turns orange.'],
      start: [
        ['Radio check… can you hear me? Perfect.', 'Three laps, zero excuses. Full throttle!'],
        ['Warm tyres, papaya engine.', { t: "Let's go get that P1!", mood: 'hype' }],
      ],
      miniTurbo: ['Nice drift! Orange and fast, just how we like it.'],
      lastLap: ["Final lap! Papaya isn't stopping now."],
      win: [['P1! The finish line just turned orange.', 'This one goes to everyone who voted: every vote was extra horsepower in the engine.']],
      podium: ["Podium! It's not gold, but orange goes with everything."],
      lose: [['Rough day. Even papaya is sometimes unripe.', { t: "Another vote, another run. We'll bounce back.", mood: 'normal' }]],
    },
  },
  {
    team: 'JAYBULL RACING',
    driver: '',
    portrait: null,
    lines: {
      select: ['JAYBULL gives you wings. On track, of course.'],
      start: [
        ['Strategy: start strong, finish stronger.', { t: "We've got the wings. Let's see if they fly.", mood: 'hype' }],
      ],
      miniTurbo: ['There are the wings! Textbook mini-turbo.'],
      lastLap: ['Final lap. Everything left in the tank, right now.'],
      win: [['P1! Told you the wings worked.', 'Yellow looks great on the top step.']],
      podium: ['Podium. The wings were there, we just ran out of track.'],
      lose: [['The wings were in for servicing today.', { t: "Upload another certificate: we'll swap them and get back on track.", mood: 'normal' }]],
    },
  },
  {
    team: 'ALPINOO',
    driver: '',
    portrait: null,
    lines: {
      select: ["Pink on track, pink on the podium. It's a style, not a colour."],
      start: [
        ['The cutest kart on the grid is about to become the fastest.', { t: "Three laps. Let's make them pink.", mood: 'hype' }],
      ],
      miniTurbo: ['Candy-pink mini-turbo, delivered.'],
      lastLap: ["Final lap! Don't ruin the look now."],
      win: [['P1! The finish line is pink tonight.', "Fast and cute: they're not mutually exclusive."]],
      podium: ['Podium! And this suit looks amazing in the photo.'],
      lose: [['The kart was cute, the lap time less so.', { t: "One vote and we're back on the grid. Pink never gives up.", mood: 'normal' }]],
    },
  },
  {
    team: 'HOONRARI',
    driver: '',
    portrait: null,
    lines: {
      select: ['HOONRARI: red, elegant, and a pit wall that always has a plan.'],
      start: [
        ['The box says stay calm.', 'The box always says that.'],
        ['Plan A: win.', { t: 'Plan B: win anyway.', mood: 'hype' }],
      ],
      miniTurbo: ['That drift is going in the museum.'],
      lastLap: ['Final lap. The pit wall says manage it. I say push.'],
      win: [["P1! The fans won't sleep tonight.", 'The plan worked. Mark the date.']],
      podium: ['Podium. The pit wall calls it “a great team result”.'],
      lose: [['We dropped out of the strategy. Or the strategy dropped us.', { t: "We'll analyse the data, one more vote and we go again.", mood: 'normal' }]],
    },
  },
  {
    team: 'MEOWCEDES',
    driver: '',
    portrait: null,
    lines: {
      select: ['Nine lives, three laps. The maths checks out.'],
      start: [
        ['Ears up, paws on the wheel.', { t: 'No purring until we cross the line.', mood: 'hype' }],
      ],
      miniTurbo: ['Landed on my feet, as always.'],
      lastLap: ["Final lap. We've still got eight lives: let's use one."],
      win: [["P1! Now I'm purring.", 'The fastest cat of the night.']],
      podium: ["Podium! Not the top step, but it's comfy as a cushion."],
      lose: [['I got distracted by the stars. Happens to cats.', { t: "One life lost, eight to go. Another vote and we're off again.", mood: 'normal' }]],
    },
  },
  {
    team: 'RIKSTON DRIFT',
    driver: '',
    portrait: null,
    lines: {
      select: ["The team name is no accident: corners are taken sideways."],
      start: [
        ['Warm tyres, steady hands.', { t: 'Green, like the lights in a moment.', mood: 'hype' }],
      ],
      miniTurbo: ['Now that was a RIKSTON drift.'],
      lastLap: ['Final lap! Last corners to take sideways, in style.'],
      win: [['P1! I even crossed the line sideways.', 'Green means go. And go we did.']],
      podium: ['Podium! One more drift and it was P1.'],
      lose: [['Too much sideways, not enough forward.', { t: "Another vote, another run. We'll fix the drift.", mood: 'normal' }]],
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
