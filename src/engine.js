/* Hollowwood Manor — Chapter I rules engine.
   Pure logic, no DOM. The whole game is one generator (HW.game) that yields
   events; a driver (the UI, or a headless test) answers the ones that need input. */
(function (root) {
'use strict';

/* ---------- provisional values: tune here ---------- */
const CFG = {
  actions: { brock: 2, wesley: 2 },
  speed: { brock: 5, wesley: 5 },
  hearts: { brock: 4, wesley: 3 },
  frightCap: 5, frightReset: 2,
  startTime: 21 * 60, minutesPerRound: 10, midnight: 24 * 60,
  ghostMove: 3, ghostMoveLate: 4, ghostLateAt: 22 * 60, ghostDrift: 1,
  hollowMove: 1, hollowMoveLate: 2, hollowLateAt: 23 * 60,
  gazeRange: 5, gazeFright: 1, forcedGazeFright: 2, senseSteps: 2,
  chillDamage: 1, dreadRange: 2, dreadFright: 1,
  dollRange: 2, dollFright: 1,
  recordTimer: 3, recordRange: 2, recordDamage: 1,
  trapNotice: 5, trapDormant: 2, trapBreak: { brock: 3, wesley: 4 },
  insightStart: 1, insightCap: 4, rerollCost: 1, deduceCost: 2,
  bondMax: 6, bondBackToBack: 3, bondFriends: 6,
  calmAmount: 2, saltsAmount: 2, bandageAmount: 1,
  entrancedRounds: 2, clockRewind: 30,
  shoveFright: 2,
};

/* ---------- the manor ---------- */
const W = 19, H = 9;
const MAPS = {
  G: [
    '###################',
    '#.................#',
    '#.................#',
    '###+#####+#####+###',
    '#.....#......#....#',
    '#.....+......#....#',
    '#.....#......#....#',
    '#.....#......#....#',
    '###################',
  ],
  U: [
    '###################',
    '#.....#......#....#',
    '#.....#......#....#',
    '#.....#......#....#',
    '#.....+......+....#',
    '#.....#......+....#',
    '#.....#......#....#',
    '#.....#......#....#',
    '###################',
  ],
};
const DIRS = [[0, -1], [1, 0], [0, 1], [-1, 0]]; // N E S W
const key = (f, c, r) => (typeof f === 'object' ? f.f + f.c + ',' + f.r : f + c + ',' + r);
const same = (a, b) => a.f === b.f && a.c === b.c && a.r === b.r;
const cheb = (a, b) => Math.max(Math.abs(a.c - b.c), Math.abs(a.r - b.r));
const manh = (a, b) => Math.abs(a.c - b.c) + Math.abs(a.r - b.r);

const STAIRS = {};
function link(a, b) { STAIRS[key(a)] = b; STAIRS[key(b)] = a; }
link({ f: 'G', c: 11, r: 4 }, { f: 'U', c: 11, r: 7 });
link({ f: 'G', c: 12, r: 4 }, { f: 'U', c: 12, r: 7 });
link({ f: 'G', c: 17, r: 1 }, { f: 'U', c: 17, r: 1 });

const HIDES = { 'G7,7': 'velvet curtain', 'U5,1': 'wardrobe drapes', 'U7,1': 'window drapes' };
const EXITS = [{ f: 'G', c: 9, r: 8 }, { f: 'G', c: 10, r: 8 }];
const DOORFRONT = [{ f: 'G', c: 9, r: 7 }, { f: 'G', c: 10, r: 7 }];
const isExit = p => p.f === 'G' && p.r === 8 && (p.c === 9 || p.c === 10);
const isDoorFront = p => p.f === 'G' && p.r === 7 && (p.c === 9 || p.c === 10);

function roomAt(f, c, r) {
  if (f === 'G') {
    if (r <= 2) return 'Servants\' Passage';
    if (c <= 5) return 'Library';
    if (c <= 12) return 'Entrance Hall';
    return 'Study';
  }
  if (c <= 5) return 'Lil\'s Bedroom';
  if (c <= 12) return 'Gallery';
  return 'Music Room';
}

function buildObjects(variant) {
  const o = [
    { id: 'hatch', f: 'G', t: [[1, 1]], kind: 'hatch', name: 'Cellar Hatch' },
    { id: 'shelfW', f: 'G', t: [[1, 4], [2, 4]], kind: 'shelf', name: 'West Bookshelves', search: true },
    { id: 'shelfE', f: 'G', t: [[4, 4], [5, 4]], kind: 'shelf', name: 'East Bookshelves', search: true },
    { id: 'strongbox', f: 'G', t: [[1, 7]], kind: 'strongbox', name: 'Iron Strongbox' },
    { id: 'armchairL', f: 'G', t: [[5, 7]], kind: 'armchair', name: 'Reading Chair' },
    { id: 'clock', f: 'G', t: [[7, 4]], kind: 'gclock', name: 'Grandfather Clock' },
    { id: 'console', f: 'G', t: [[12, 6]], kind: 'console', name: 'Hall Console', search: true },
    { id: 'desk', f: 'G', t: [[16, 4], [17, 4]], kind: 'desk', name: 'Writing Desk', search: true },
    { id: 'chest', f: 'G', t: [[14, 7]], kind: 'chest', name: 'Study Chest', search: true },
    { id: 'armchairS', f: 'G', t: [[17, 7]], kind: 'armchair', name: 'Armchair' },
    { id: 'bed', f: 'U', t: [[1, 1], [2, 1]], kind: 'bed', name: 'Bed', search: true },
    { id: 'vanity', f: 'U', t: [[4, 1]], kind: 'vanity', name: 'Vanity', search: true },
    { id: 'toychest', f: 'U', t: [[1, 6]], kind: 'chest', name: 'Toy Chest', search: true },
    { id: 'doll', f: 'U', t: [[3, 4]], kind: 'doll', name: 'Weeping Doll' },
    { id: 'portrait', f: 'U', t: [[9, 0], [10, 0]], kind: 'portrait', name: 'Family Portrait', wall: true },
    { id: 'case', f: 'U', t: [[8, 4]], kind: 'case', name: 'Display Case', search: true },
    { id: 'bust', f: 'U', t: [[11, 2]], kind: 'bust', name: 'Marble Bust' },
    { id: 'gramophone', f: 'U', t: [[16, 5]], kind: 'gramophone', name: 'Haunted Record Player' },
    { id: 'piano', f: 'U', t: [[14, 6], [15, 6]], kind: 'piano', name: 'Piano', search: true },
    { id: 'musiccab', f: 'U', t: [[14, 1]], kind: 'musiccab', name: 'Music Cabinet', search: true },
    { id: 'harp', f: 'U', t: [[17, 7]], kind: 'harp', name: 'Harp' },
  ];
  if (variant === 'A') o.push({ id: 'cabinet', f: 'G', t: [[11, 1], [11, 2]], kind: 'cabinet', name: 'Fallen Cabinet', short: 'cabinet', obstacle: true });
  else {
    o.push({ id: 'cabinet', f: 'G', t: [[11, 1]], kind: 'cabinetUp', name: 'Glass Cabinet' });
    o.push({ id: 'chandelier', f: 'U', t: [[13, 4], [13, 5]], kind: 'chandelier', name: 'Fallen Chandelier', short: 'chandelier', obstacle: true });
  }
  return o;
}

/* ---------- cards and words ---------- */
const ITEMS = {
  cipher: { name: 'Cipher Page', chain: 'cipher' },
  fragment: { name: 'Portrait Fragment', chain: 'portrait' },
  record: { name: 'Lil\'s Record', chain: 'lullaby' },
  windkey: { name: 'Winding Key', chain: 'clock' },
  salts: { name: 'Smelling Salts', use: true },
  bandage: { name: 'Bandage', use: true },
  masterkey: { name: 'Master Key' },
};

const CHAINS = {
  cipher: {
    name: 'The Cipher', item: 'cipher', find: 'desk', use: 'strongbox', work: 2, brain: true,
    findTitle: 'The Cipher Page', findText: 'Search the Writing Desk in the Study.',
    useTitle: 'Decode the Strongbox', useText: 'Work the cipher on the Iron Strongbox in the Library.', useVerb: 'Decode the strongbox',
    reward: 'Gain 2 Insight.',
  },
  portrait: {
    name: 'The Portrait', item: 'fragment', find: 'shelfW', use: 'portrait', work: 1,
    findTitle: 'The Torn Fragment', findText: 'Search the West Bookshelves in the Library.',
    useTitle: 'Restore the Portrait', useText: 'Fit the fragment into the Family Portrait in the Gallery.', useVerb: 'Restore the portrait',
    reward: 'Lil\' is entranced for 2 rounds.',
  },
  lullaby: {
    name: 'The Lullaby', item: 'record', find: 'toychest', use: 'gramophone', work: 1,
    findTitle: 'Lil\'s Record', findText: 'Search the Toy Chest in Lil\'s Bedroom.',
    useTitle: 'Play the Lullaby', useText: 'Put Lil\'s record on the Haunted Record Player in the Music Room.', useVerb: 'Play Lil\'s record',
    reward: 'The record player is calmed for good.',
  },
  clock: {
    name: 'The Hour', item: 'windkey', find: 'piano', use: 'clock', work: 2, brain: true,
    findTitle: 'The Winding Key', findText: 'Search the Piano in the Music Room.',
    useTitle: 'Set the Hour', useText: 'Wind the Grandfather Clock in the Entrance Hall back to the hour it stopped.', useVerb: 'Wind the clock',
    reward: 'The night turns back 30 minutes.',
  },
};

const CLUES = {
  mother: {
    title: 'A Letter Never Sent',
    text: 'Pressed inside a hymnal, in an old woman\'s hand: “It is forty years since we lost both our girls in one night. We bolted the cellar and grew old above it. I brushed Lil\'s hair a hundred strokes each evening. I cannot recall that I ever once brushed her sister\'s.”',
    lines: [['wesley', 'Both girls. Everyone only ever writes about the one.'], ['brock', 'Forty years living on top of that cellar.']],
  },
  lucien: {
    title: 'Lucien\'s Reply',
    text: '“Miss Hollowood, you do me great honour, and I am sorry for it. I cannot return what you feel. Pray give my regards to your sister, whose company at dinner was a kindness.” The paper has been crumpled and smoothed flat many times.',
    lines: [['brock', '“Regards to your sister.” That\'s cold.'], ['wesley', 'He\'s being polite. That\'s worse.']],
  },
  diary: {
    title: 'Lil\'s Diary',
    text: '“Lady has stopped speaking to me except to ask what I love best. I said Mother, and my white dress, and her. She wrote it down. I think she is planning a surprise.”',
    lines: [['wesley', 'She wrote it down.'], ['brock', 'I don\'t like that. I really don\'t like that.']],
  },
  ritual: {
    title: 'A Page in Lady\'s Hand',
    text: 'Copied out fair, like a recipe: “Task the First: chalk from a grave. Task the Second: a door beneath the house. Task the Third: the thing most loved in it. Then ask, and he will make Lucien love me.” Beneath, in different ink: “He says it must be tonight.”',
    lines: [['wesley', '“He.” Who is “he”? Not Lucien.'], ['brock', 'Whoever was telling her what to do.']],
  },
  father: {
    title: 'The Cellar Account',
    text: 'A ledger page among the household bills: “Found below: our Lil\', cold. Chalk. A candle burnt to nothing. Of our elder daughter, no trace but blood that is not her sister\'s. Cellar bolted this day. Not to be opened.”',
    lines: [['brock', 'So what happened to the other one?'], ['wesley', 'The books say she ran away. I don\'t think she ran.']],
  },
  hatch: {
    title: 'The Cellar Hatch',
    text: 'Iron bolts as thick as a wrist, driven home from above. Chalk dust has crept up between the boards in a pattern that is almost a letter. From below, faint and patient, something scrapes, as if counting.',
    lines: [['brock', 'Rats.'], ['wesley', 'Rats don\'t count, Brock.']],
  },
};

const MEMORIES = [
  'Mother brushed my hair every night. One hundred strokes. Lady stood in the doorway and counted along, and never came in.',
  'Lucien came to dinner. Lady wore the green dress and laughed at everything. He asked me what I was reading.',
  'She woke me with a candle. “A game, Lil\'. In the cellar. Don\'t tell.” I was so pleased she wanted to play with me.',
  'Chalk on the cellar floor. Lady asking the dark what came next. And the dark answering her.',
  'She was crying when she did it. “He promised,” she said. “He promised Lucien would love me.” Then it was cold, and I was standing beside myself.',
  'I saw what it did to her after. It laughed. It put the knife in her too, and made her into something else. She doesn\'t remember. I remember for both of us.',
];

const STORY = {
  intro: [
    { kind: 'story', title: 'Hollowwood Manor', sub: 'Chapter I · The Sisters',
      text: 'The last Hollowoods died in their beds, old and quiet, and the house has stood shut ever since. People say two daughters lived here once. People only ever name one of them.' },
    { kind: 'scene', title: 'The Dare',
      lines: [['brock', 'Ten minutes inside. That\'s the dare. Then I never call you a coward again.'],
        ['wesley', 'I\'m not here for your dare. The Hollowood library has been sealed for sixty years.'],
        ['brock', 'So it\'s dust. You came for dust.'],
        ['wesley', 'I came for— you know what, never mind. After you.']] },
    { kind: 'story', title: 'The Door',
      text: 'The front door closes behind them. It is not a slam. It is a careful, deliberate click, like someone turning a key from the other side.',
      lines: [['brock', 'Wind.'], ['wesley', 'That was a lock, Brock.']],
      effect: 'Finish what the house sets you, find the Master Key, and get both of them out the front door before midnight.' },
  ],
  truce: { kind: 'scene', title: 'A Truce, More or Less',
    lines: [['wesley', 'You didn\'t have to do that.'], ['brock', 'Yeah, well. Don\'t make it weird.'],
      ['wesley', 'I\'m not making it weird, you\'re the one who— fine. Thank you.'], ['brock', 'You\'re welcome, Wes.']],
    effect: 'Bond 3 · Back to Back: when either ends a turn beside the other, both lose 1 Fright.' },
  friends: { kind: 'scene', title: 'Friends',
    lines: [['brock', 'If we get out, tell everyone I was terrified.'], ['wesley', 'You were terrified.'],
      ['brock', 'I know. It sounds better coming from you.']],
    effect: 'Bond 6 · Friends: Brock\'s Protection costs no action, and they can help each other from 2 spaces away.' },
  uses: {
    portrait: { kind: 'story', title: 'The Portrait, Restored',
      text: 'The torn piece fits. Four Hollowoods: Father, Mother, and between them a small girl in white, every brushstroke lavished on her. At the frame\'s edge, half in shadow, stands the elder daughter. Someone painted her last, and quickly.',
      effect: 'Lil\' drifts to the portrait and is still. She will not haunt for 2 rounds.' },
    cipher: { kind: 'story', title: 'The Strongbox Opens',
      text: 'Inside lies a bundle of letters in one furious hand, every one addressed to Lucien, none of them sent. The last breaks off mid-line: “It does not matter that you do not love me yet. I have found someone who can arrange it.”',
      effect: 'Gain 2 Insight.' },
    lullaby: { kind: 'story', title: 'Lil\'s Lullaby',
      text: 'The needle drops. Two children\'s voices, one sure and one wandering, sing a counting song through the crackle. The pale hand in the horn goes slack, then draws back inside like a held breath let go.',
      effect: 'The record player is calmed for good.' },
    clock: { kind: 'story', title: 'The Hour It Stopped',
      text: 'The stopped hands say a quarter past eleven. You wind them back and the whole house seems to lean with them. Somewhere below, the scraping loses its place and begins again from one.',
      effect: 'The night turns back 30 minutes.' },
  },
  lifted: {
    cabinet: { kind: 'story', title: 'Together, Then', text: 'Glass shifts and settles. The cabinet comes up off the boards between them and stands against the wall. The servants\' passage is open end to end.', effect: 'Shared task complete. The passage is clear.' },
    chandelier: { kind: 'story', title: 'Together, Then', text: 'Brass arms scrape the floor. Between them they drag the chandelier clear of the doorway, and the Music Room stands open.', effect: 'Shared task complete. The Gallery door is clear.' },
  },
  keyReveal: { kind: 'memory', title: 'The Master Key',
    text: 'Lil\' is standing by the cellar hatch. She has set something small and cold on the iron. She points to the front door. Then to the boards under her feet. She shakes her head slowly, the way you warn a child.',
    lines: [['lil', 'She forgets. I don\'t. Go, before she remembers me.']],
    effect: 'The Master Key waits on the Cellar Hatch in the Servants\' Passage.' },
  keyTaken: { kind: 'story', title: 'Under the Hatch',
    text: 'The key is so cold it sticks to your palm. As you lift it, the scraping under the hatch stops. Something down there has stopped counting, and started listening.',
    effect: 'Unlock the front door from the mat in the Entrance Hall, then get both of them out.' },
  doorOpen: { kind: 'story', title: 'The Lock Turns', text: 'The Master Key turns as if the door had been waiting. Night air comes in, ordinary and enormous.', effect: 'Step through the front door. Both of them.' },
  chime22: { kind: 'story', title: 'Ten O\'Clock', text: 'Every clock in the house strikes, a little out of step. Upstairs, a child\'s footsteps quicken.', effect: 'From now on Lil\' moves up to 3 spaces.' },
  chime23: { kind: 'story', title: 'Eleven O\'Clock', text: 'The chimes come from the wrong rooms. The Hollow straightens, as though someone had said his name.', effect: 'From now on the Hollow moves 2 spaces. One hour remains.' },
  endings: {
    escaped: [
      'They leave by the same door and walk home on opposite sides of the road. But on Monday, when someone laughs at Wesley, Brock doesn\'t join in.',
      'On the gravel, Brock holds out a hand. Wesley, after a moment, takes it. Neither of them says anything clever.',
      'They sit on the manor steps until the sun comes up, because neither wants to be the first to go home. “Same time next week?” says Brock. Wesley laughs so hard his glasses fall off.',
    ],
    coda: 'In an upstairs window, a girl in white watches them go. Beneath the house, something that has forgotten its own name remembers hers.',
    midnight: 'Midnight. Every clock in the manor strikes at once. In the passage, the bolts on the cellar hatch draw back by themselves: one, two, three. What climbs out does not remember being Lady Hollowood. It remembers the knife.',
    taken: 'The candles gutter. Two more shapes lie still on the floor of Hollowwood Manor, and a girl in white sits down between them to wait. She has always wanted someone to stay.',
    abandoned: '{X} runs. The door swings shut on {Y}\'s name. Outside, the night is ordinary and enormous, and {X} will hear that door close for the rest of his life.',
  },
};

// LINES[key][who] = [at odds, allies, friends]
const LINES = {
  dust: { brock: ['Dust. Great. Love dust.', 'Nothing. Moving on.', 'Nothing here, Wes.'], wesley: ['Nothing. Moths and regret.', 'Empty. Pity.', 'Nothing in here, Brock.'] },
  loot: { brock: ['Finders keepers.', 'This\'ll come in handy.', 'Got something for us.'], wesley: ['Oh. This could be useful.', 'This could be useful.', 'Brock, look what I found.'] },
  found: { brock: ['Got it. Try to keep up, Wes.', 'Got it! Wes, I got it!', 'Got it. Your turn, professor.'], wesley: ['Found it. No thanks to anyone.', 'Found it! I actually found it!', 'Found it! Brock, look!'] },
  foundOther: { brock: ['Hey. This is Wes\'s thing.', 'This is the piece Wes needs.', 'Wes! Found yours!'], wesley: ['This is what Brock\'s after.', 'This is the piece Brock needs.', 'Brock! I\'ve got yours!'] },
  hurt: { brock: ['I\'m fine! Don\'t look at me.', 'Ow. Okay. That one counted.', 'Still standing, Wes.'], wesley: ['I\'m all right. I said I\'m all right!', 'That really hurt.', 'I\'m okay! Mostly!'] },
  fright: { brock: ['I\'m not scared. You\'re scared.', 'Okay. That\'s a little unsettling.', 'Yeah, I\'m scared. Keep moving.'], wesley: ['Don\'t look at it, don\'t look at it.', 'Breathe. Just breathe.', 'Brock? Stay close?'] },
  panic: { brock: ['Hands won\'t stop shaking. Give me a second.', 'Hands won\'t stop shaking. Give me a second.', 'Wes, I need a second.'], wesley: ['I can\'t. I need a moment.', 'I can\'t. I need a moment.', 'Brock, I need a moment.'] },
  protect: { brock: ['Move, four-eyes!', 'Not him!', 'Get behind me, Wes!'] },
  protected: { wesley: ['I didn\'t ask you to do that!', 'You— why would you do that?', 'Brock! Thank you.'] },
  snap: { brock: ['Hey! HEY! Wesley! Knock it off!', 'Wes. It\'s me. Come back.', 'Come on, Wes. I\'ve got you.'], wesley: ['Brock, stop, this isn\'t funny. Oh. Oh no.', 'Brock! Look at me!', 'Brock. You\'re you. Come back.'] },
  snapped: { brock: ['What did I do? Did I do something?', 'What did I do?', 'Thanks, Wes. I\'m back.'], wesley: ['I saw… she showed me… I\'m here.', 'She showed me something. I\'m here.', 'I\'m here. I\'m here. Thank you.'] },
  witness: { brock: ['Wes? Quit messing around.', 'Wes? That\'s not Wes.', 'Wes, hang on. I\'m coming.'], wesley: ['Brock? Very funny. Brock?', 'Brock? Your eyes…', 'Brock, hold on. I\'m coming.'] },
  dropped: { brock: ['What the hell, Wes?!', 'Not your fault. Hers.', 'Not your fault, Wes.'], wesley: ['You dropped it ON me! On purpose!', 'That wasn\'t you. I know that wasn\'t you.', 'That wasn\'t you. I know.'] },
  threw: { brock: ['Why is my hand empty?', 'Why is my hand empty?', 'Wes, I think I threw it.'], wesley: ['I threw it? Why would I—', 'I threw it? Why would I—', 'Brock, I\'m sorry, I threw it.'] },
  shoved: { brock: ['Hands off, Wes!', 'That\'s not you pushing. I know.', 'It\'s all right, Wes.'], wesley: ['Don\'t touch me!', 'That isn\'t you. It isn\'t.', 'It\'s all right, Brock.'] },
  revive: { brock: ['Up. Get up. I\'m not carrying you.', 'Hey! Eyes open, Wes.', 'I\'ve got you. Up we get.'], wesley: ['Don\'t you dare. Get up!', 'Brock! Please!', 'Not without you. Up!'] },
  free: { brock: ['Hold still. Don\'t look at the eyes.', 'Hold still. Nearly got it.', 'Got you. Easy.'], wesley: ['There\'s a release pin. There!', 'There\'s a release pin. There!', 'Got it. You\'re out.'] },
  calm: { brock: ['Breathe. You\'re embarrassing us both.', 'Easy. In and out.', 'I\'m right here. Breathe.'], wesley: ['You\'re hyperventilating. Stop it.', 'Count backward with me.', 'It\'s all right. I\'m here too.'] },
  liftTake: { brock: ['I\'ve got this end.', 'I\'ve got this end.', 'Got my end, Wes.'], wesley: ['Ready when you are.', 'Ready when you are.', 'Ready, Brock.'] },
  liftDone: { brock: ['See? Easy. You barely helped.', 'Ha! Good lift, Wes.', 'That\'s us. Good lift.'], wesley: ['I did most of that.', 'We did it!', 'We did it!'] },
  give: { brock: ['Here. Don\'t lose it.', 'Here. Yours.', 'Here you go, Wes.'], wesley: ['Here. Take it.', 'Here. Take it.', 'Here, Brock.'] },
  trapped: { brock: ['It\'s got my leg! It\'s LOOKING at me!', 'It\'s got my leg!', 'Wes! Trap!'], wesley: ['It has eyes. Why does it have eyes?!', 'It has eyes. Why does it have eyes?!', 'Brock! It\'s got me!'] },
  gaze: { brock: ['Don\'t stare back.', 'Don\'t stare back.', 'Eyes down, Wes.'], wesley: ['It hasn\'t got any eyes. Why can I feel it looking?', 'Why can I feel it looking?', 'Don\'t look, Brock.'] },
  thrown: { brock: ['What— where am I?', 'What— where am I?', 'Wes? Where\'d you go?'], wesley: ['The hand. It threw me.', 'The hand. It threw me.', 'Brock? Brock!'] },
  down: { brock: ['Wes… go…', 'Wes…', 'Wes…'], wesley: ['Brock…', 'Brock…', 'Brock…'] },
  key: { brock: ['Tell me that\'s the key.', 'That\'s it. That\'s the key.', 'That\'s our way out, Wes.'], wesley: ['She left it for us. Why?', 'She\'s letting us go.', 'She\'s letting us go, Brock.'] },
  praise: { brock: ['Huh. Not bad, four-eyes.', 'Nice work, Wes.', 'That\'s my guy.'], wesley: ['Fine. That was competent.', 'That was actually brilliant.', 'Brilliant, Brock!'] },
  deduce: { wesley: ['Obviously. It\'s a substitution cipher. Obviously.', 'Wait. I\'ve read about this.', 'I\'ve got it. Brock, I\'ve got it!'] },
};
const LIL_CHILL = ['“You\'re warm. I remember warm.”', '“Stay. I have so many games.”', '“Hold my hand. It only hurts at first.”'];
const LIL_FINALE = ['“Go. Before she counts to a hundred.”', '“Don\'t look back at me.”'];

/* ---------- small helpers ---------- */
function mulberry32(a) {
  return function () {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
const d6 = S => (S.forceDice && S.forceDice.length ? S.forceDice.shift() : 1 + Math.floor(S.rng() * 6));
const rint = (S, n) => Math.floor(S.rng() * n);
const pickOf = (S, a) => a[rint(S, a.length)];
function shuffle(S, a) { for (let i = a.length - 1; i > 0; i--) { const j = rint(S, i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; }
const heroList = S => [S.heroes.brock, S.heroes.wesley];
const partner = (S, h) => (h.id === 'brock' ? S.heroes.wesley : S.heroes.brock);
const awake = h => !h.down && !h.escaped;
const tier = S => (S.bond >= CFG.bondFriends ? 2 : S.bond >= CFG.bondBackToBack ? 1 : 0);
const obj = (S, id) => S.objs.find(o => o.id === id);
const fmtTime = t => { const h = Math.floor(t / 60) % 24, m = t % 60; const hh = h % 12 === 0 ? 12 : h % 12; return hh + ':' + (m < 10 ? '0' : '') + m + (h >= 12 && h < 24 ? ' PM' : ' AM'); };

function rebuildBlock(S) {
  S.block = new Set();
  for (const o of S.objs) if (!o.wall && o.block !== false) for (const [c, r] of o.t) S.block.add(key(o.f, c, r));
}
function isFloor(S, f, c, r) {
  if (c < 0 || r < 0 || c >= W || r >= H) return false;
  if (MAPS[f][r][c] !== '#') return true;
  return S.door.open && isExit({ f, c, r });
}
const walkable = (S, f, c, r) => isFloor(S, f, c, r) && !S.block.has(key(f, c, r));
function neighbors(S, p) {
  const out = [];
  for (const [dc, dr] of DIRS) { const c = p.c + dc, r = p.r + dr; if (walkable(S, p.f, c, r)) out.push({ f: p.f, c, r }); }
  const s = STAIRS[key(p)]; if (s) out.push(s);
  return out;
}
const activeTrapAt = (S, p) => S.traps.find(t => !t.holding && t.dormant <= 0 && same(t, p));

// Breadth-first search. Active traps and exits can be entered but not passed through.
function bfs(S, sources, opt) {
  opt = opt || {};
  const m = new Map(); const q = [];
  for (const s of sources) { m.set(key(s), { pos: { f: s.f, c: s.c, r: s.r }, d: 0, prev: null }); q.push(key(s)); }
  for (let i = 0; i < q.length; i++) {
    const k = q[i], n = m.get(k);
    if (opt.max != null && n.d >= opt.max) continue;
    if (n.d > 0 && (isExit(n.pos) || activeTrapAt(S, n.pos))) continue;
    for (const nb of neighbors(S, n.pos)) {
      const nk = key(nb);
      if (m.has(nk)) continue;
      if (opt.noTraps && activeTrapAt(S, nb)) continue;
      m.set(nk, { pos: nb, d: n.d + 1, prev: k }); q.push(nk);
    }
  }
  return m;
}
function pathTo(m, dest) {
  const out = []; let k = key(dest);
  while (k && m.get(k) && m.get(k).prev !== null) { out.unshift(m.get(k).pos); k = m.get(k).prev; }
  return out;
}
function movePts(h, roll) { const s = CFG.speed[h.id]; return Math.max(1, roll <= 2 ? s - 1 : roll <= 4 ? s : s + 1); }
function reach(S, h, pts) {
  const m = bfs(S, [h], { max: pts });
  const p = partner(S, h); const tiles = [];
  for (const n of m.values()) {
    if (n.d === 0) continue;
    if (!p.escaped && same(p, n.pos)) continue;
    if (same(S.hollow, n.pos) || same(S.ghost, n.pos)) continue;
    tiles.push({ f: n.pos.f, c: n.pos.c, r: n.pos.r, d: n.d, trap: !!activeTrapAt(S, n.pos), exit: isExit(n.pos) });
  }
  return { map: m, tiles };
}
const adjObj = (h, o) => h.f === o.f && o.t.some(([c, r]) => Math.abs(c - h.c) + Math.abs(r - h.r) === 1);
function adjTilesOfObj(S, o) {
  const out = [];
  for (const [c, r] of o.t) for (const [dc, dr] of DIRS) { const p = { f: o.f, c: c + dc, r: r + dr }; if (walkable(S, p.f, p.c, p.r) && !out.some(q => same(q, p))) out.push(p); }
  return out;
}
const adjHeroes = (a, b) => a.f === b.f && manh(a, b) === 1;
function helpInRange(S, h, p) {
  if (h.f !== p.f || p.escaped) return false;
  if (manh(h, p) === 1) return true;
  if (S.bond >= CFG.bondFriends) { const m = bfs(S, [h], { max: 2 }); return m.has(key(p)); }
  return false;
}
function los(S, f, a, b) {
  let x0 = a.c, y0 = a.r; const x1 = b.c, y1 = b.r;
  const dx = Math.abs(x1 - x0), dy = Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
  let err = dx - dy;
  for (;;) {
    if (!(x0 === a.c && y0 === a.r) && !(x0 === x1 && y0 === y1) && MAPS[f][y0][x0] === '#') return false;
    if (x0 === x1 && y0 === y1) return true;
    const e2 = 2 * err;
    if (e2 > -dy) { err -= dy; x0 += sx; }
    if (e2 < dx) { err += dx; y0 += sy; }
  }
}
function inCone(o, dir, p) {
  const dx = p.c - o.c, dy = p.r - o.r; const [fx, fy] = DIRS[dir];
  const along = dx * fx + dy * fy, perp = Math.abs(dx * fy - dy * fx);
  return along >= 1 && perp <= along && Math.max(Math.abs(dx), Math.abs(dy)) <= CFG.gazeRange;
}
function gazeTiles(S) {
  const o = S.hollow, out = [];
  for (let r = 1; r < H - 1; r++) for (let c = 1; c < W - 1; c++) {
    if (MAPS[o.f][r][c] === '#') continue;
    const p = { c, r }; if (inCone(o, o.dir, p) && los(S, o.f, o, p)) out.push({ f: o.f, c, r });
  }
  return out;
}
const stepOf = (S, h) => (!h.got ? 'find' : !S.coopDone ? 'coop' : !h.useDone ? 'use' : 'done');
const chainsDone = S => heroList(S).every(h => h.useDone) && S.coopDone;
const ghostSpeed = S => (S.time >= CFG.ghostLateAt ? CFG.ghostMoveLate : CFG.ghostMove) + (S.key.state !== 'hidden' ? 1 : 0);
const hollowSpeed = S => (S.time >= CFG.hollowLateAt ? CFG.hollowMoveLate : CFG.hollowMove);
function locate(S, item) {
  for (const h of heroList(S)) if (h.inv.includes(item)) return { where: 'hero', id: h.id };
  const g = S.ground.find(x => x.item === item); if (g) return { where: 'ground', pos: g };
  for (const id in S.loot) if (!S.searched[id] && S.loot[id].item === item) return { where: 'obj', id };
  return null;
}
const canReroll = S => S.insight >= CFG.rerollCost && awake(S.heroes.wesley) && !S.heroes.wesley.possessed;

/* ---------- setup ---------- */
function newGame(opts) {
  opts = Object.assign({ mode: 'solo', human: 'wesley', guided: true, seed: (Date.now() ^ (Math.random() * 1e9)) >>> 0 }, opts || {});
  const S = { opts, rng: mulberry32(opts.seed), round: 1, time: CFG.startTime, bond: 0, insight: CFG.insightStart };
  let deal = opts.deal;
  if (!deal) {
    if (opts.guided) deal = { brock: 'portrait', wesley: 'cipher', coop: 'A' };
    else { const ids = shuffle(S, Object.keys(CHAINS)); deal = { brock: ids[0], wesley: ids[1], coop: S.rng() < 0.5 ? 'A' : 'B' }; }
  }
  S.deal = deal; S.variant = deal.coop;
  S.objs = buildObjects(S.variant);
  S.obstacle = S.variant === 'A' ? 'cabinet' : 'chandelier';
  S.door = { open: false }; rebuildBlock(S);
  const mk = (id, name, c) => ({ id, name, f: 'G', c, r: 7, hearts: CFG.hearts[id], maxHearts: CFG.hearts[id], fright: 0, actions: 0, inv: [], chain: deal[id], got: false, useWork: 0, useDone: false, holding: false, possessed: false, trapped: false, hidden: false, down: false, escaped: false, debt: 0, protectedRound: false, npc: false });
  S.heroes = { brock: mk('brock', 'Brock', 9), wesley: mk('wesley', 'Wesley', 10) };
  if (opts.mode === 'solo') S.heroes[opts.human === 'brock' ? 'wesley' : 'brock'].npc = true;
  if (opts.mode === 'auto') { S.heroes.brock.npc = true; S.heroes.wesley.npc = true; }
  S.ghost = { f: 'U', c: 3, r: 6, dir: 2, entranced: 0 };
  S.hollow = { f: 'U', c: 9, r: 2, dir: 2, sensed: false };
  S.traps = [{ id: 0, f: 'G', c: 4, r: 1, dormant: 0, holding: null }, { id: 1, f: 'U', c: 9, r: 5, dormant: 0, holding: null }];
  S.record = { timer: CFG.recordTimer, calmed: false };
  S.coopDone = false; S.searched = {}; S.ground = []; S.clues = {}; S.memories = 0;
  S.key = { state: 'hidden' }; S.over = null; S.turn = null; S.scenes = {}; S.tips = {}; S.bondRound = {};
  S.script = { possession: !!opts.guided };
  S.done = {}; S.ai = { brock: {}, wesley: {} };
  // what is inside the furniture
  S.loot = { shelfE: { k: 'clue', id: 'mother' }, chest: { k: 'clue', id: 'lucien' }, vanity: { k: 'clue', id: 'diary' }, case: { k: 'clue', id: 'ritual' }, console: { k: 'clue', id: 'father' } };
  for (const id of ['brock', 'wesley']) { const ch = CHAINS[deal[id]]; S.loot[ch.find] = { k: 'chain', item: ch.item }; }
  const pool = shuffle(S, ['salts', 'salts', 'bandage', 'bandage', 'scare', 'dust']);
  for (const o of S.objs) if (o.search && !S.loot[o.id]) { const x = pool.pop(); S.loot[o.id] = x === 'scare' || x === 'dust' ? { k: x } : { k: 'loot', item: x }; }
  return S;
}

/* ---------- what a hero may do right now ---------- */
function deduceTarget(S) {
  const w = S.heroes.wesley;
  for (const h of [w, S.heroes.brock]) {
    const ch = CHAINS[h.chain];
    if (!ch.brain || h.useDone || !h.got || !S.coopDone || !h.inv.includes(ch.item) || !awake(h)) continue;
    if (h === w || helpInRange(S, w, h)) return h;
  }
  return null;
}
function options(S, h) {
  const o = []; if (!awake(h)) return o;
  const p = partner(S, h), ch = CHAINS[h.chain];
  if (h.trapped) o.push({ type: 'breakfree', label: 'Break free of the trap', cost: 1, note: 'roll ' + CFG.trapBreak[h.id] + '+' });
  else o.push({ type: 'move', label: h.holding ? 'Let go and move' : 'Roll to move', cost: 1 });
  for (const ob of S.objs) {
    if (!adjObj(h, ob)) continue;
    if (ob.search && !S.searched[ob.id]) o.push({ type: 'search', obj: ob.id, label: 'Search the ' + ob.name, cost: 1 });
    if (ob.id === 'hatch') {
      if (S.key.state === 'hatch') o.push({ type: 'takekey', obj: 'hatch', label: 'Take the Master Key', cost: 1 });
      else if (!S.clues.hatch) o.push({ type: 'examine', obj: 'hatch', label: 'Examine the Cellar Hatch', cost: 1 });
    }
    if (ob.obstacle && !S.coopDone && !h.holding) {
      if (p.holding && p.possessed) o.push({ type: 'lift', obj: ob.id, label: 'Lift with ' + p.name + ' (he is possessed!)', cost: 1, risky: true });
      else o.push({ type: 'lift', obj: ob.id, label: p.holding ? 'Lift the ' + ob.short + ' with ' + p.name : 'Take your end of the ' + ob.short, cost: 1 });
    }
    if (ob.id === ch.use && !h.useDone) {
      const base = { type: 'work', obj: ob.id, label: ch.useVerb + (ch.work > 1 ? ' (' + h.useWork + '/' + ch.work + ')' : ''), cost: 1 };
      if (!h.inv.includes(ch.item)) o.push(Object.assign(base, { disabled: true, why: 'You need the ' + ITEMS[ch.item].name + ' first.' }));
      else if (!S.coopDone) o.push(Object.assign(base, { disabled: true, why: 'Your cards are in order: lift the ' + obj(S, S.obstacle).short + ' together first.' }));
      else o.push(base);
    }
  }
  if (!p.escaped && helpInRange(S, h, p)) {
    if (p.down) o.push({ type: 'help', help: 'revive', label: 'Revive ' + p.name, cost: 1 });
    else {
      if (p.possessed) o.push({ type: 'help', help: 'snap', label: 'Snap ' + p.name + ' out of it', cost: 1 });
      if (p.trapped) o.push({ type: 'help', help: 'free', label: 'Free ' + p.name + ' from the trap', cost: 1 });
      if (p.fright >= 2 && !p.hidden) o.push({ type: 'help', help: 'calm', label: 'Steady ' + p.name + ' (−' + CFG.calmAmount + ' Fright)', cost: 1 });
    }
  }
  const uniq = [...new Set(h.inv)];
  if (!p.escaped && !p.down && adjHeroes(h, p)) {
    for (const it of uniq) o.push({ type: 'give', item: it, label: 'Give ' + ITEMS[it].name + ' to ' + p.name, cost: 1 });
    if (h.inv.includes('bandage') && p.hearts < p.maxHearts) o.push({ type: 'useitem', item: 'bandage', target: p.id, label: 'Bandage ' + p.name + ' (+1 heart)', cost: 1 });
  }
  if (h.inv.includes('salts') && h.fright > 0) o.push({ type: 'useitem', item: 'salts', target: h.id, label: 'Use Smelling Salts (−' + CFG.saltsAmount + ' Fright)', cost: 1 });
  if (h.inv.includes('bandage') && h.hearts < h.maxHearts) o.push({ type: 'useitem', item: 'bandage', target: h.id, label: 'Use Bandage (+1 heart)', cost: 1 });
  if (HIDES[key(h)] && !h.hidden && !h.trapped) o.push({ type: 'hide', label: 'Hide behind the ' + HIDES[key(h)], cost: 1 });
  if (h.id === 'wesley' && S.insight >= CFG.deduceCost) { const t = deduceTarget(S); if (t) o.push({ type: 'deduce', target: t.id, label: 'Deduce: solve ' + (t === h ? 'your' : t.name + '\'s') + ' puzzle (−' + CFG.deduceCost + ' Insight)', cost: 1 }); }
  if (isDoorFront(h) && !S.door.open) {
    if (h.inv.includes('masterkey')) o.push({ type: 'unlock', label: 'Unlock the front door', cost: 1 });
    else if (S.key.state !== 'hidden') o.push({ type: 'unlock', label: 'Unlock the front door', cost: 1, disabled: true, why: 'Locked. Whoever holds the Master Key opens it.' });
  }
  o.push({ type: 'end', label: 'End turn', cost: 0 });
  return o;
}
const sameOpt = (a, b) => a.type === b.type && a.obj === b.obj && a.help === b.help && a.item === b.item && a.target === b.target;

function hint(S, h) {
  const p = partner(S, h), ch = CHAINS[h.chain];
  if (h.trapped) return 'Caught in the trap. Break free (roll ' + CFG.trapBreak[h.id] + '+), or ' + p.name + ' can free you.';
  if (p.possessed && awake(p)) return p.name + ' is possessed. Stand beside him and snap him out of it before his turn, or Lil\' gets one act of sabotage.';
  if (p.down) return p.name + ' is down. Reach him and revive him.';
  if (S.key.state === 'hatch') return 'The Master Key is on the Cellar Hatch, at the west end of the Servants\' Passage.';
  if (S.key.state !== 'hidden') {
    if (S.door.open) return 'The front door is open. Walk both of them out.';
    return h.inv.includes('masterkey') ? 'Stand on the mat inside the front door and unlock it.' : 'Get to the front door. Whoever holds the Master Key unlocks it.';
  }
  const st = stepOf(S, h);
  const where = it => { const l = locate(S, it); if (!l) return ''; if (l.where === 'ground') return 'It was thrown. Walk over it to pick it up.'; if (l.where === 'hero' && l.id !== h.id) return p.name + ' is carrying it. Stand beside him so he can hand it over.'; return ''; };
  if (st === 'find') return ch.findTitle + ': ' + (where(ch.item) || ch.findText);
  if (st === 'coop') { const ob = obj(S, S.obstacle); return 'Shared task: meet ' + p.name + ' at the ' + ob.name + ' and lift it together. One action each.'; }
  if (st === 'use') return ch.useTitle + ': ' + (h.inv.includes(ch.item) ? ch.useText : where(ch.item));
  return 'Your cards are done. Help ' + p.name + ', or search the rooms for clues.';
}

/* ---------- effects ---------- */
function* say(S, who, k) { const e = LINES[k] && LINES[k][who]; if (e) yield { t: 'say', who, text: e[tier(S)] }; }
function* tip(S, id, text) { if (S.opts.guided && !S.tips[id]) { S.tips[id] = true; yield { t: 'tip', text }; } }
function* addBond(S, n, why) {
  if (n > 0) { if (S.bondRound[why]) return; S.bondRound[why] = true; }
  const before = S.bond; S.bond = Math.max(0, Math.min(CFG.bondMax, S.bond + n));
  if (S.bond === before) return;
  yield { t: 'bond', delta: S.bond - before };
  if (before < CFG.bondBackToBack && S.bond >= CFG.bondBackToBack && !S.scenes.truce) { S.scenes.truce = true; yield { t: 'card', card: STORY.truce }; }
  if (before < CFG.bondFriends && S.bond >= CFG.bondFriends && !S.scenes.friends) { S.scenes.friends = true; yield { t: 'card', card: STORY.friends }; }
}
function* addInsight(S, n) { const b = S.insight; S.insight = Math.max(0, Math.min(CFG.insightCap, S.insight + n)); if (S.insight !== b) yield { t: 'insight', delta: S.insight - b }; }
function* scare(S, h, amt, why) {
  if (!awake(h) || amt <= 0) return;
  const b = h.fright; h.fright = Math.min(CFG.frightCap, h.fright + amt);
  if (h.fright === b) return;
  yield { t: 'fx', kind: 'fright', id: h.id, amt: h.fright - b, why };
  if (h.fright >= CFG.frightCap) { yield* say(S, h.id, 'panic'); yield* tip(S, 'panic', 'Fright has reached 5. Unless it is brought down before his next turn, he loses an action and resets to 2.'); }
  else if (b < 3 && h.fright >= 3) yield* say(S, h.id, 'fright');
}
function* soothe(S, h, amt) { const b = h.fright; h.fright = Math.max(0, h.fright - amt); if (b !== h.fright) yield { t: 'fx', kind: 'calm', id: h.id, amt: b - h.fright }; }
function releaseTrap(S, h) { const tr = S.traps.find(t => t.holding === h.id); if (tr) { tr.holding = null; tr.dormant = CFG.trapDormant; } h.trapped = false; }
function canProtect(S, w) {
  const b = S.heroes.brock;
  if (!awake(b) || b.possessed || b.trapped || b.hidden || b.protectedRound) return false;
  return !!protectSpot(S, w, b);
}
function protectSpot(S, w, b) {
  const c = neighbors(S, w).filter(p => p.f === w.f && !activeTrapAt(S, p) && !same(p, S.hollow) && (same(p, b) || true));
  if (!c.length) return null;
  c.sort((x, y) => (same(x, b) ? -1 : 0) - (same(y, b) ? -1 : 0));
  return c[0];
}
function* hurt(S, h, amt, why) {
  if (!awake(h)) return;
  h.hearts = Math.max(0, h.hearts - amt);
  yield { t: 'fx', kind: 'hurt', id: h.id, amt, why };
  if (h.hearts <= 0) {
    yield* say(S, h.id, 'down');
    h.down = true; h.holding = false; h.possessed = false; h.hidden = false; releaseTrap(S, h);
    yield { t: 'log', cls: 'bad', text: h.name + ' collapses.' };
    yield* tip(S, 'down', 'A collapsed hero skips turns until his partner stands beside him and revives him. If both are down, the night is over.');
  } else yield* say(S, h.id, 'hurt');
  yield* hollowSense(S, h);
}
// The Hollow senses harm, and comes to see.
function* hollowSense(S, h) {
  const o = S.hollow; if (o.sensed) return; o.sensed = true;
  const m = bfs(S, [h]); const n = m.get(key(o)); if (!n || n.d <= 1) return;
  const path = []; let k = key(o);
  for (let i = 0; i < CFG.senseSteps; i++) { const cur = m.get(k); if (!cur || cur.prev === null) break; const nx = m.get(cur.prev); if (nx.d === 0 || heroList(S).some(x => awake(x) && same(x, nx.pos))) break; path.push(nx.pos); k = cur.prev; }
  if (!path.length) return;
  const from = { f: o.f, c: o.c, r: o.r }, last = path[path.length - 1], prev = path.length > 1 ? path[path.length - 2] : from;
  if (last.f === prev.f) { const dc = last.c - prev.c, dr = last.r - prev.r; o.dir = DIRS.findIndex(d => d[0] === dc && d[1] === dr); if (o.dir < 0) o.dir = 2; }
  Object.assign(o, last);
  yield { t: 'log', cls: 'hollow', text: 'The Hollow turns his blank face toward ' + h.name + '\'s pain, and comes to see.' };
  yield { t: 'move', id: 'hollow', path, from };
  yield* tip(S, 'sense', 'The Hollow senses harm. Whenever a hero loses a heart, he walks 2 spaces toward them. He means no ill, but his gaze frightens.');
}
function* damage(S, h, amt, why, opt) {
  if (!awake(h)) return 'none';
  if (h.id === 'wesley' && !(opt && opt.noProtect) && canProtect(S, h)) {
    const ans = yield { t: 'ask', kind: 'protect', hero: 'brock', why, free: S.bond >= CFG.bondFriends, own: S.turn === 'brock' };
    if (ans) { yield* protect(S, h, why); return 'protected'; }
  }
  yield* hurt(S, h, amt, why);
  return 'hurt';
}
function* protect(S, w, why) {
  const b = S.heroes.brock; const spot = protectSpot(S, w, b); const from = { f: b.f, c: b.c, r: b.r };
  b.protectedRound = true; b.holding = false;
  Object.assign(b, { f: spot.f, c: spot.c, r: spot.r });
  yield* say(S, 'brock', 'protect');
  if (!same(from, spot)) yield { t: 'teleport', id: 'brock', from };
  let cost = '';
  if (S.bond < CFG.bondFriends) { if (S.turn === 'brock' && b.actions > 0) { b.actions--; cost = ' It costs him an action.'; } else { b.debt = 1; cost = ' It will cost him an action next turn.'; } }
  yield { t: 'log', cls: 'good', text: 'Protection: Brock steps into the blow meant for Wesley.' + cost };
  yield* hurt(S, b, 1, why);
  yield* say(S, 'wesley', 'protected');
  yield* addBond(S, 1, 'protect');
}
function* gainItem(S, h, item) {
  h.inv.push(item);
  const ch = CHAINS[h.chain];
  if (item === ch.item && !h.got) { h.got = true; yield { t: 'step', hero: h.id }; }
}
function* pickup(S, h, g) {
  S.ground.splice(S.ground.indexOf(g), 1);
  yield { t: 'log', text: h.name + ' picks up the ' + ITEMS[g.item].name + '.' };
  yield* gainItem(S, h, g.item);
}
function* snapTrap(S, tr, h) {
  tr.holding = h.id; tr.f = h.f; tr.c = h.c; tr.r = h.r; h.trapped = true; h.holding = false;
  yield { t: 'fx', kind: 'trap', id: h.id };
  yield { t: 'log', cls: 'bad', text: 'The Entity Trap snaps shut on ' + h.name + '. He cannot move.' };
  yield* say(S, h.id, 'trapped');
  yield* scare(S, h, 1, 'trap');
  yield* tip(S, 'trap', 'A trapped hero cannot move. He can spend an action to roll free, or his partner can free him from an adjacent space.');
}
function* revealKey(S) {
  if (S.key.state !== 'hidden') return;
  S.key.state = 'hatch';
  const g = S.ghost, from = { f: g.f, c: g.c, r: g.r };
  Object.assign(g, { f: 'G', c: 2, r: 1 }); g.entranced = Math.max(g.entranced, 1);
  yield { t: 'teleport', id: 'ghost', from };
  yield { t: 'card', card: STORY.keyReveal };
  yield { t: 'step', hero: 'both' };
}
function* completeUse(S, h) {
  const ch = CHAINS[h.chain];
  h.useDone = true; h.useWork = ch.work; S.done[ch.use] = true;
  const i = h.inv.indexOf(ch.item); if (i >= 0) h.inv.splice(i, 1);
  yield { t: 'step', hero: h.id };
  yield { t: 'card', card: STORY.uses[h.chain] };
  if (h.chain === 'cipher') yield* addInsight(S, 2);
  if (h.chain === 'portrait') { const g = S.ghost, from = { f: g.f, c: g.c, r: g.r }; Object.assign(g, { f: 'U', c: 9, r: 1 }); if (same(g, h)) g.c = 10; g.entranced = CFG.entrancedRounds; yield { t: 'teleport', id: 'ghost', from }; }
  if (h.chain === 'lullaby') S.record.calmed = true;
  if (h.chain === 'clock') { S.time = Math.max(CFG.startTime, S.time - CFG.clockRewind); yield { t: 'clock' }; }
  const p = partner(S, h); if (awake(p)) yield* say(S, p.id, 'praise');
  yield* addBond(S, 1, 'use' + h.id);
  if (chainsDone(S)) yield* revealKey(S);
}

/* ---------- hero actions ---------- */
function* doMove(S, h) {
  h.actions--;
  if (h.holding) { h.holding = false; yield { t: 'log', text: h.name + ' lets go of the ' + obj(S, S.obstacle).short + '.' }; }
  let roll = d6(S), rerolled = false;
  yield { t: 'die', who: h.id, value: roll, pts: movePts(h, roll) };
  for (;;) {
    const pts = movePts(h, roll), R = reach(S, h, pts);
    const ans = yield { t: 'chooseMove', hero: h.id, roll, pts, tiles: R.tiles, canReroll: !rerolled && canReroll(S) };
    if (ans && ans.reroll && !rerolled && canReroll(S)) {
      rerolled = true; yield* addInsight(S, -CFG.rerollCost); roll = d6(S);
      yield { t: 'log', text: 'Wesley second-guesses the roll.' };
      yield { t: 'die', who: h.id, value: roll, pts: movePts(h, roll) }; continue;
    }
    if (!ans || same(ans, h)) return;
    const tile = R.tiles.find(x => same(x, ans)); if (!tile) return;
    const path = pathTo(R.map, tile);
    if (tile.exit) {
      const p = partner(S, h);
      if (p.down) {
        const a = yield { t: 'ask', kind: 'abandon', hero: h.id, other: p.id };
        if (!a) return;
        const from = { f: h.f, c: h.c, r: h.r }; Object.assign(h, { f: tile.f, c: tile.c, r: tile.r }); h.escaped = true;
        yield { t: 'move', id: h.id, path, from }; S.over = { result: 'abandoned', who: h.id }; return;
      }
    }
    yield* walk(S, h, path); return;
  }
}
function* walk(S, h, path) {
  const from = { f: h.f, c: h.c, r: h.r }, last = path[path.length - 1];
  const passed = path.some(p => same(p, S.hollow));
  Object.assign(h, { f: last.f, c: last.c, r: last.r });
  yield { t: 'move', id: h.id, path, from };
  if (passed) yield { t: 'log', cls: 'hollow', text: 'The Hollow steps aside for ' + h.name + ', almost courteous.' };
  for (const p of path) { const g = S.ground.find(x => same(x, p)); if (g) yield* pickup(S, h, g); }
  if (isExit(last)) { h.escaped = true; yield { t: 'log', cls: 'good', text: h.name + ' is out of the manor.' }; return; }
  const tr = activeTrapAt(S, last); if (tr) yield* snapTrap(S, tr, h);
}
function* doSearch(S, h, o) {
  h.actions--; S.searched[o.id] = true;
  const L = S.loot[o.id] || { k: 'dust' };
  yield { t: 'search', hero: h.id, obj: o.id };
  if (L.k === 'chain') {
    const mine = CHAINS[h.chain].item === L.item;
    yield { t: 'log', cls: 'good', text: h.name + ' finds the ' + ITEMS[L.item].name + ' in the ' + o.name + '.' };
    yield* gainItem(S, h, L.item);
    yield* say(S, h.id, mine ? 'found' : 'foundOther');
    if (!mine) yield* tip(S, 'other', 'That item belongs to the other hero\'s cards. Stand beside him and hand it over.');
  } else if (L.k === 'clue') yield* clue(S, h, L.id);
  else if (L.k === 'loot') {
    yield { t: 'log', cls: 'good', text: h.name + ' finds ' + (L.item === 'salts' ? 'Smelling Salts' : 'a Bandage') + ' in the ' + o.name + '.' };
    yield* gainItem(S, h, L.item); yield* say(S, h.id, 'loot');
  } else if (L.k === 'scare') {
    yield { t: 'log', cls: 'bad', text: 'Something cold closes round ' + h.name + '\'s wrist inside the ' + o.name + ', and lets go.' };
    yield* scare(S, h, 1, 'search');
  } else { yield { t: 'log', text: h.name + ' searches the ' + o.name + '. Nothing.' }; yield* say(S, h.id, 'dust'); }
}
function* clue(S, h, id) {
  S.clues[id] = true;
  yield { t: 'card', card: Object.assign({ kind: 'clue', effect: 'Clue found. Gain 1 Insight.' }, CLUES[id]) };
  yield* addInsight(S, 1);
  yield* tip(S, 'insight', 'Insight belongs to Wesley. Spend 1 to reroll any die, including the haunt\'s. Spend 2 to Deduce a thinking task without doing the work.');
}
function* doLift(S, h, o) {
  const p = partner(S, h);
  h.actions--;
  if (p.holding && p.possessed) { // sabotage: he lets it fall
    p.holding = false; p.possessed = false;
    yield { t: 'fx', kind: 'slam', obj: o.id };
    yield { t: 'log', cls: 'bad', text: 'Sabotage. As ' + h.name + ' lifts, ' + p.name + ' smiles a small girl\'s smile and lets his end fall.' };
    yield* hurt(S, h, 1, 'cabinet');
    if (awake(h)) yield* say(S, h.id, 'dropped');
    if (S.bond < CFG.bondBackToBack) yield* addBond(S, -1, 'sabotage');
    yield* say(S, p.id, 'snapped');
    return;
  }
  if (p.holding) {
    h.holding = false; p.holding = false; S.coopDone = true;
    if (o.id === 'cabinet') { o.t = [[11, 1]]; o.kind = 'cabinetUp'; o.obstacle = false; o.name = 'Glass Cabinet'; }
    else { o.block = false; o.obstacle = false; o.kind = 'debris'; }
    rebuildBlock(S);
    yield { t: 'fx', kind: 'lift', obj: o.id };
    yield { t: 'step', hero: 'both' };
    yield* say(S, h.id, 'liftDone');
    yield { t: 'card', card: STORY.lifted[o.id] };
    yield* addBond(S, 1, 'lift');
    return;
  }
  h.holding = true;
  yield { t: 'log', text: h.name + ' takes his end of the ' + o.short + ' and waits for ' + p.name + '.' };
  yield* say(S, h.id, 'liftTake');
  if (S.script.possession) { S.script.possession = false; yield* scriptedPossession(S, h); }
}
function* possess(S, t) {
  t.possessed = true;
  const mem = MEMORIES[Math.min(S.memories, MEMORIES.length - 1)]; S.memories++;
  yield { t: 'fx', kind: 'possess', id: t.id };
  yield { t: 'card', card: { kind: 'memory', title: 'What Lil\' Remembers', text: mem, effect: t.name + ' is possessed. Lil\' will take one act of sabotage through him unless his partner snaps him out of it first. Her memory grants 1 Insight.' } };
  yield* addInsight(S, 1);
  const p = partner(S, t); if (awake(p)) yield* say(S, p.id, 'witness');
  yield* tip(S, 'possess', 'Possessed heroes act last. Their partner goes first and can spend 1 action beside them to snap them out of it.');
}
function* scriptedPossession(S, h) {
  const g = S.ghost, from = { f: g.f, c: g.c, r: g.r };
  const spots = [[-1, 0], [1, 0], [-1, 1], [1, 1], [0, 1], [0, -1]].map(([dc, dr]) => ({ f: h.f, c: h.c + dc, r: h.r + dr })).filter(p => p.c >= 1 && p.c <= 17 && p.r >= 1 && p.r <= 7 && !heroList(S).some(x => same(x, p)));
  Object.assign(g, spots[0] || { f: h.f, c: h.c, r: h.r }); g.entranced = 0;
  yield { t: 'log', cls: 'ghost', text: 'The air goes cold. A girl in white rises through the floorboards beside ' + h.name + '.' };
  yield { t: 'teleport', id: 'ghost', from };
  yield { t: 'whisper', text: '“Let me show you.”' };
  yield* possess(S, h);
  h.actions = 0; g.entranced = 1; // she lingers for the coming haunt
}
function* sabotage(S, h) {
  const p = partner(S, h);
  h.possessed = false; h.actions = Math.max(0, h.actions - 1);
  yield { t: 'log', cls: 'ghost', text: 'Lil\' moves ' + h.name + '\'s hands for him.' };
  if (h.holding) {
    h.holding = false;
    yield { t: 'fx', kind: 'slam', obj: S.obstacle };
    yield { t: 'log', cls: 'bad', text: 'Sabotage. ' + h.name + ' lets his end of the ' + obj(S, S.obstacle).short + ' crash to the floor.' };
  } else if (h.inv.length) {
    const pri = ['masterkey', 'cipher', 'fragment', 'record', 'windkey', 'bandage', 'salts'];
    const item = pri.find(i => h.inv.includes(i));
    h.inv.splice(h.inv.indexOf(item), 1);
    const m = bfs(S, [h], { max: 4, noTraps: true });
    let spots = [...m.values()].filter(n => n.d >= 2 && n.pos.f === h.f && !STAIRS[key(n.pos)] && !isExit(n.pos) && !heroList(S).some(x => same(x, n.pos)) && !S.ground.some(x => same(x, n.pos))).map(n => n.pos);
    if (!spots.length) spots = [...m.values()].filter(n => n.d >= 1).map(n => n.pos);
    const spot = spots.length ? pickOf(S, spots) : { f: h.f, c: h.c, r: h.r };
    S.ground.push({ item, f: spot.f, c: spot.c, r: spot.r });
    yield { t: 'fx', kind: 'throw', id: h.id, to: spot, item };
    yield { t: 'log', cls: 'bad', text: 'Sabotage. ' + h.name + ' hurls the ' + ITEMS[item].name + ' across the room.' };
    yield* say(S, h.id, 'threw');
    yield* tip(S, 'thrown', 'Thrown items stay on the board. Either hero can walk over one to pick it up.');
  } else if (awake(p) && !p.hidden && h.f === p.f && bfs(S, [h], { max: 2 }).has(key(p))) {
    yield { t: 'fx', kind: 'shove', id: p.id };
    yield { t: 'log', cls: 'bad', text: 'Sabotage. ' + h.name + ' turns on ' + p.name + ' with someone else\'s eyes.' };
    yield* scare(S, p, CFG.shoveFright, 'shove');
    yield* say(S, p.id, 'shoved');
    if (S.bond < CFG.bondBackToBack) yield* addBond(S, -1, 'sabotage');
  } else {
    const R = reach(S, h, 2).tiles.filter(t => !t.trap && !t.exit);
    if (R.length && !h.trapped) { const t = pickOf(S, R); const m = bfs(S, [h], { max: 2 }); const path = pathTo(m, t), from = { f: h.f, c: h.c, r: h.r }; Object.assign(h, { f: t.f, c: t.c, r: t.r }); yield { t: 'move', id: h.id, path, from }; }
    yield { t: 'log', cls: 'bad', text: h.name + ' wanders where she walks him, and wakes somewhere else.' };
    yield* scare(S, h, 1, 'possess');
  }
  yield* say(S, h.id, 'snapped');
}
function* doHelp(S, h, kind) {
  const p = partner(S, h); h.actions--;
  if (kind === 'revive') { p.down = false; p.hearts = 1; p.fright = Math.min(p.fright, 3); yield* say(S, h.id, 'revive'); yield { t: 'fx', kind: 'heal', id: p.id, amt: 1 }; yield { t: 'log', cls: 'good', text: h.name + ' gets ' + p.name + ' back on his feet.' }; }
  if (kind === 'snap') { p.possessed = false; yield* say(S, h.id, 'snap'); yield { t: 'fx', kind: 'snap', id: p.id }; yield { t: 'log', cls: 'good', text: h.name + ' snaps ' + p.name + ' out of it. Lil\' loses her hold.' }; yield* say(S, p.id, 'snapped'); }
  if (kind === 'free') { releaseTrap(S, p); yield* say(S, h.id, 'free'); yield { t: 'log', cls: 'good', text: h.name + ' springs the trap. ' + p.name + ' is free. The trap lies shut for ' + CFG.trapDormant + ' rounds.' }; }
  if (kind === 'calm') { yield* say(S, h.id, 'calm'); yield* soothe(S, p, CFG.calmAmount); }
  yield* addBond(S, 1, kind);
}
function* doGive(S, h, item) {
  const p = partner(S, h); h.actions--;
  h.inv.splice(h.inv.indexOf(item), 1);
  yield* say(S, h.id, 'give');
  yield { t: 'log', text: h.name + ' hands the ' + ITEMS[item].name + ' to ' + p.name + '.' };
  yield* gainItem(S, p, item);
  yield* addBond(S, 1, 'give');
}
function* doUseItem(S, h, item, targetId) {
  const t = S.heroes[targetId]; h.actions--;
  h.inv.splice(h.inv.indexOf(item), 1);
  if (item === 'salts') { yield { t: 'log', text: h.name + ' uses the Smelling Salts.' }; yield* soothe(S, t, CFG.saltsAmount); }
  else { t.hearts = Math.min(t.maxHearts, t.hearts + CFG.bandageAmount); yield { t: 'fx', kind: 'heal', id: t.id, amt: 1 }; yield { t: 'log', cls: 'good', text: h.name + ' bandages ' + (t === h ? 'himself' : t.name) + '.' }; if (t !== h) yield* addBond(S, 1, 'bandage'); }
}
function* doBreakFree(S, h) {
  h.actions--;
  let roll = d6(S); const need = CFG.trapBreak[h.id];
  yield { t: 'die', who: h.id, value: roll, need };
  if (roll >= need) { releaseTrap(S, h); yield { t: 'log', cls: 'good', text: h.name + ' wrenches free. The trap lies shut for ' + CFG.trapDormant + ' rounds.' }; }
  else yield { t: 'log', cls: 'bad', text: h.name + ' strains at the jaws. They hold. (Needed ' + need + '+.)' };
}
function* perform(S, h, act) {
  const real = options(S, h).find(o => sameOpt(o, act));
  if (!real || real.disabled || h.actions < real.cost) return false;
  switch (real.type) {
    case 'move': yield* doMove(S, h); break;
    case 'search': yield* doSearch(S, h, obj(S, real.obj)); break;
    case 'examine': h.actions--; yield* clue(S, h, 'hatch'); break;
    case 'takekey': h.actions--; S.key.state = 'held'; yield* gainItem(S, h, 'masterkey'); yield* say(S, h.id, 'key'); yield { t: 'card', card: STORY.keyTaken }; break;
    case 'lift': yield* doLift(S, h, obj(S, real.obj)); break;
    case 'work': {
      h.actions--; h.useWork++; const ch = CHAINS[h.chain];
      yield { t: 'fx', kind: 'work', id: h.id, obj: real.obj };
      if (h.useWork >= ch.work) yield* completeUse(S, h);
      else { yield { t: 'log', text: h.name + ' works at it. ' + h.useWork + ' of ' + ch.work + '.' }; if (ch.brain) yield* tip(S, 'brain', 'This is a thinking task. Wesley can Deduce it for 2 Insight instead of spending the second action.'); }
      break;
    }
    case 'help': yield* doHelp(S, h, real.help); break;
    case 'give': yield* doGive(S, h, real.item); break;
    case 'useitem': yield* doUseItem(S, h, real.item, real.target); break;
    case 'hide': h.actions--; h.hidden = true; h.holding = false; yield { t: 'log', text: h.name + ' slips behind the ' + HIDES[key(h)] + '. Nothing can find him until his next turn.' }; break;
    case 'breakfree': yield* doBreakFree(S, h); break;
    case 'deduce': { h.actions--; yield* addInsight(S, -CFG.deduceCost); yield* say(S, 'wesley', 'deduce'); const t = S.heroes[real.target]; yield { t: 'log', cls: 'good', text: 'Deduction. Wesley solves it in his head.' }; yield* completeUse(S, t); break; }
    case 'unlock': h.actions--; S.door.open = true; yield { t: 'fx', kind: 'door' }; yield { t: 'card', card: STORY.doorOpen }; break;
  }
  return true;
}

/* ---------- the haunt ---------- */
const ghostTargets = (S, f) => heroList(S).filter(h => h.f === f && awake(h) && !h.hidden);
function nearest(S, from, list) {
  let best = [], bd = 1e9;
  for (const h of list) { const d = cheb(from, h); if (d < bd) { bd = d; best = [h]; } else if (d === bd) best.push(h); }
  return best.length > 1 ? pickOf(S, best) : best[0];
}
const chillAt = (S, f, p) => ghostTargets(S, f).filter(h => cheb(h, p) <= 1).map(h => h.id);
function ghostPlan(S, roll, t) {
  const g = S.ghost;
  if (!t) {
    const other = ghostTargets(S, g.f === 'G' ? 'U' : 'G');
    return other.length && roll !== 5 ? { kind: 'shift' } : { kind: 'stay', chills: [] };
  }
  if (roll === 6) return { kind: 'possess', target: t.id };
  if (roll === 5) return { kind: 'stay', chills: chillAt(S, g.f, g) };
  const dx = t.c - g.c, dy = t.r - g.r;
  const fwd = Math.abs(dx) >= Math.abs(dy) ? (dx >= 0 ? 1 : 3) : (dy >= 0 ? 2 : 0);
  const dir = (fwd + [0, 3, 1, 2][roll - 1]) % 4;
  let c = g.c, r = g.r; const path = [];
  for (let i = 0; i < ghostSpeed(S); i++) {
    if (roll === 1 && cheb({ c, r }, t) <= 1) break;
    const nc = c + DIRS[dir][0], nr = r + DIRS[dir][1];
    if (nc < 1 || nc > W - 2 || nr < 1 || nr > H - 2) break;
    if (heroList(S).some(h => !h.escaped && h.f === g.f && h.c === nc && h.r === nr)) break;
    c = nc; r = nr; path.push({ f: g.f, c, r });
  }
  return { kind: 'move', dir, c, r, path, chills: chillAt(S, g.f, { c, r }) };
}
const GHOST_NAMES = ['', 'Forward', 'Left', 'Right', 'Backward', 'Stay still', 'Possession'];
const HOLLOW_NAMES = ['', 'Right', 'Forced Gaze', 'Backward', 'Stay still', 'Forward', 'Left'];
function* ghostPhase(S) {
  const g = S.ghost;
  if (g.entranced > 0) {
    g.entranced--;
    yield { t: 'log', cls: 'ghost', text: S.key.state !== 'hidden' ? 'Lil\' keeps her place beside the cellar hatch, watching the boards.' : 'Lil\' stands quite still, looking at something only she can see.' };
    return;
  }
  const t = nearest(S, g, ghostTargets(S, g.f));
  if (t && CFG.ghostDrift && cheb(t, g) > 1) { // drawn to the living: a slow, certain drift before her die
    const from = { f: g.f, c: g.c, r: g.r }, path = [];
    for (let i = 0; i < CFG.ghostDrift && cheb(t, g) > 1; i++) { g.c += Math.sign(t.c - g.c); g.r += Math.sign(t.r - g.r); path.push({ f: g.f, c: g.c, r: g.r }); }
    yield { t: 'move', id: 'ghost', path, from, drift: true };
  }
  let roll = d6(S), plan = ghostPlan(S, roll, t);
  yield { t: 'die', who: 'ghost', value: roll, name: GHOST_NAMES[roll] };
  const bad = p => p.kind === 'possess' || (p.chills && p.chills.length);
  if (bad(plan) && canReroll(S)) {
    const what = plan.kind === 'possess' ? 'Possession: she will take ' + S.heroes[plan.target].name + '.' : GHOST_NAMES[roll] + ': her touch will reach ' + plan.chills.map(i => S.heroes[i].name).join(' and ') + '.';
    const ans = yield { t: 'ask', kind: 'reroll', hero: 'wesley', who: 'ghost', what };
    if (ans) { yield* addInsight(S, -CFG.rerollCost); roll = d6(S); plan = ghostPlan(S, roll, t); yield { t: 'log', text: 'Wesley second-guesses the haunt.' }; yield { t: 'die', who: 'ghost', value: roll, name: GHOST_NAMES[roll] }; }
  }
  if (plan.kind === 'shift') {
    const from = { f: g.f, c: g.c, r: g.r }; g.f = g.f === 'G' ? 'U' : 'G';
    const nh = nearest(S, g, ghostTargets(S, g.f));
    if (nh && cheb(nh, g) > 4) { // she surfaces within earshot, never on top of anyone
      const cand = [];
      for (let r = 1; r < H - 1; r++) for (let c = 1; c < W - 1; c++) if (cheb(nh, { c, r }) === 4 && !heroList(S).some(h => h.f === g.f && cheb(h, { c, r }) < 3)) cand.push({ c, r });
      if (cand.length) { cand.sort((a, b) => cheb(a, g) - cheb(b, g)); g.c = cand[0].c; g.r = cand[0].r; }
    }
    if (heroList(S).some(h => same(h, g))) g.c = Math.min(W - 2, g.c + 1);
    yield { t: 'log', cls: 'ghost', text: g.f === 'G' ? 'Lil\' sinks through the floor, following the sound of the living.' : 'Lil\' rises through the ceiling, following the sound of the living.' };
    yield { t: 'teleport', id: 'ghost', from };
    return;
  }
  if (plan.kind === 'possess') {
    yield { t: 'whisper', text: '“Let me show you.”' };
    yield* possess(S, S.heroes[plan.target]);
    return;
  }
  if (plan.kind === 'move' && plan.path.length) {
    const from = { f: g.f, c: g.c, r: g.r }; g.c = plan.c; g.r = plan.r; g.dir = plan.dir;
    yield { t: 'move', id: 'ghost', path: plan.path, from };
  }
  const victims = chillAt(S, g.f, g);
  if (victims.length) {
    yield { t: 'whisper', text: pickOf(S, S.key.state !== 'hidden' ? LIL_FINALE : LIL_CHILL) };
    for (const id of victims) {
      const h = S.heroes[id]; if (!awake(h) || cheb(h, g) > 1 || h.f !== g.f) continue;
      yield { t: 'log', cls: 'bad', text: 'Lil\' reaches for ' + h.name + '. Her touch is winter.' };
      yield* damage(S, h, CFG.chillDamage, 'chill');
    }
    yield* tip(S, 'chill', 'Ending the haunt next to Lil\' costs a heart. Keep a space between you, hide, or let Brock take it.');
  }
  for (const h of ghostTargets(S, g.f)) if (!victims.includes(h.id) && cheb(h, g) <= CFG.dreadRange) {
    yield { t: 'log', cls: 'ghost', text: 'Lil\' is close enough for ' + h.name + ' to hear her humming.' };
    yield* scare(S, h, CFG.dreadFright, 'dread');
    yield* tip(S, 'dread', 'Lil\' frightens anyone within 2 spaces when the haunt ends. Her touch costs a heart to anyone right beside her.');
  }
}
function gazedAt(S, pos, dir) { return heroList(S).filter(h => h.f === pos.f && awake(h) && !h.hidden && inCone(pos, dir, h) && los(S, pos.f, pos, h)).map(h => h.id); }
function hollowPlan(S, roll) {
  const o = S.hollow;
  if (roll === 2) {
    const c = heroList(S).filter(h => h.f === o.f && awake(h) && !h.hidden && los(S, o.f, o, h));
    return { kind: 'forced', target: c.length ? nearest(S, o, c).id : null };
  }
  if (roll === 4) return { kind: 'stay', dir: o.dir, pos: o, gazed: gazedAt(S, o, o.dir) };
  const dir = (o.dir + { 1: 1, 3: 2, 5: 0, 6: 3 }[roll]) % 4;
  let c = o.c, r = o.r; const path = [];
  for (let i = 0; i < hollowSpeed(S); i++) {
    const nc = c + DIRS[dir][0], nr = r + DIRS[dir][1];
    if (!walkable(S, o.f, nc, nr) || isExit({ f: o.f, c: nc, r: nr })) break;
    if (heroList(S).some(h => !h.escaped && h.f === o.f && h.c === nc && h.r === nr)) break;
    c = nc; r = nr; path.push({ f: o.f, c, r });
  }
  const pos = { f: o.f, c, r };
  return { kind: 'move', dir, pos, path, gazed: gazedAt(S, pos, dir) };
}
function* hollowPhase(S) {
  const o = S.hollow;
  let roll = d6(S), plan = hollowPlan(S, roll);
  yield { t: 'die', who: 'hollow', value: roll, name: HOLLOW_NAMES[roll] };
  const bad = p => (p.kind === 'forced' && p.target) || (p.gazed && p.gazed.length);
  if (bad(plan) && canReroll(S)) {
    const what = plan.kind === 'forced' ? 'Forced Gaze: ' + S.heroes[plan.target].name + ' gains ' + CFG.forcedGazeFright + ' Fright.' : HOLLOW_NAMES[roll] + ': his gaze will fall on ' + plan.gazed.map(i => S.heroes[i].name).join(' and ') + '.';
    const ans = yield { t: 'ask', kind: 'reroll', hero: 'wesley', who: 'hollow', what };
    if (ans) { yield* addInsight(S, -CFG.rerollCost); roll = d6(S); plan = hollowPlan(S, roll); yield { t: 'log', text: 'Wesley second-guesses the haunt.' }; yield { t: 'die', who: 'hollow', value: roll, name: HOLLOW_NAMES[roll] }; }
  }
  if (plan.kind === 'forced') {
    if (!plan.target) { yield { t: 'log', cls: 'hollow', text: 'The Hollow turns his head slowly from side to side, and finds no one.' }; return; }
    const h = S.heroes[plan.target]; const dx = h.c - o.c, dy = h.r - o.r;
    o.dir = Math.abs(dx) >= Math.abs(dy) ? (dx >= 0 ? 1 : 3) : (dy >= 0 ? 2 : 0);
    yield { t: 'fx', kind: 'gaze', id: h.id, forced: true };
    yield { t: 'log', cls: 'hollow', text: 'Forced Gaze. ' + h.name + ' cannot look away from the Hollow\'s empty sockets.' };
    yield* scare(S, h, CFG.forcedGazeFright, 'gaze');
    yield* say(S, h.id, 'gaze');
    yield* tip(S, 'gaze', 'The Hollow frightens whoever stands in the pale cone in front of him, up to 5 spaces, when the haunt ends. Walls block it. Stay behind him.');
    return;
  }
  o.dir = plan.dir;
  if (plan.kind === 'move' && plan.path.length) { const from = { f: o.f, c: o.c, r: o.r }; Object.assign(o, plan.pos); yield { t: 'move', id: 'hollow', path: plan.path, from }; }
  else if (plan.kind === 'stay') yield { t: 'log', cls: 'hollow', text: 'The Hollow tilts his head, listening to the house.' };
  else yield { t: 'turnface', id: 'hollow' };
  const seen = gazedAt(S, o, o.dir);
  for (const id of seen) {
    const h = S.heroes[id];
    yield { t: 'fx', kind: 'gaze', id };
    yield { t: 'log', cls: 'hollow', text: 'The Hollow\'s empty sockets settle on ' + h.name + '.' };
    yield* scare(S, h, CFG.gazeFright, 'gaze');
  }
  if (seen.length) yield* tip(S, 'gaze', 'The Hollow frightens whoever stands in the pale cone in front of him, up to 5 spaces, when the haunt ends. Walls block it. Stay behind him.');
}
function trapOK(S, f, c, r) {
  if (MAPS[f][r][c] !== '.' || S.block.has(key(f, c, r)) || STAIRS[key(f, c, r)] || HIDES[key(f, c, r)]) return false;
  for (const [dc, dr] of DIRS) { const ch = MAPS[f][r + dr] && MAPS[f][r + dr][c + dc]; if (ch === '+' || STAIRS[key(f, c + dc, r + dr)]) return false; }
  return true;
}
function* hazardPhase(S) {
  // Entity Traps creep toward anyone close
  for (const tr of S.traps) {
    if (tr.holding) continue;
    if (tr.dormant > 0) { tr.dormant--; if (tr.dormant > 0) continue; const on = heroList(S).find(h => awake(h) && same(h, tr)); if (on) { yield* snapTrap(S, tr, on); } continue; }
    const m = new Map([[key(tr), { pos: { f: tr.f, c: tr.c, r: tr.r }, d: 0, prev: null }]]); const q = [key(tr)];
    let target = null;
    for (let i = 0; i < q.length && !target; i++) {
      const n = m.get(q[i]); if (n.d >= CFG.trapNotice) continue;
      for (const [dc, dr] of DIRS) {
        const p = { f: tr.f, c: n.pos.c + dc, r: n.pos.r + dr }, k = key(p); if (m.has(k)) continue;
        const hero = heroList(S).find(h => awake(h) && !h.hidden && !h.trapped && same(h, p));
        if (hero && trapOK(S, p.f, p.c, p.r)) { m.set(k, { pos: p, d: n.d + 1, prev: q[i] }); target = { hero, k }; break; }
        if (!trapOK(S, p.f, p.c, p.r) || S.traps.some(x => x !== tr && same(x, p))) continue;
        m.set(k, { pos: p, d: n.d + 1, prev: q[i] }); q.push(k);
      }
    }
    if (!target) continue;
    const path = pathTo(m, m.get(target.k).pos); const step = path[0], from = { f: tr.f, c: tr.c, r: tr.r };
    tr.c = step.c; tr.r = step.r;
    yield { t: 'move', id: 'trap' + tr.id, path: [step], from };
    if (same(step, target.hero)) yield* snapTrap(S, tr, target.hero);
    else { yield { t: 'log', cls: 'hazard', text: 'The Entity Trap inches toward ' + target.hero.name + '. Two white eyes blink in its dark.' }; yield* tip(S, 'creep', 'Entity Traps creep 1 space toward any hero within ' + CFG.trapNotice + ' spaces. They cannot cross doorways or stairs.'); }
  }
  // The Haunted Record Player
  const rec = S.record, gp = obj(S, 'gramophone').t[0], gpos = { f: 'U', c: gp[0], r: gp[1] };
  if (!rec.calmed) {
    rec.timer--;
    if (rec.timer <= 0) {
      rec.timer = CFG.recordTimer;
      const victims = heroList(S).filter(h => h.f === 'U' && awake(h) && !h.hidden && cheb(h, gpos) <= CFG.recordRange);
      yield { t: 'fx', kind: 'record', hit: victims.length > 0 };
      if (victims.length || heroList(S).some(h => h.f === 'U' && awake(h))) yield { t: 'log', cls: 'hazard', text: 'The record player turns by itself. A pale blue hand gropes out of the horn' + (victims.length ? '.' : ' and closes on nothing.') };
      for (const h of victims) {
        const res = yield* damage(S, h, CFG.recordDamage, 'record');
        if (res !== 'hurt' || !awake(h)) continue;
        const spots = []; for (let r = 1; r < H - 1; r++) for (let c = 1; c < W - 1; c++) { const p = { f: 'U', c, r }; if (walkable(S, 'U', c, r) && !STAIRS[key(p)] && !S.traps.some(t => same(t, p)) && !heroList(S).some(x => same(x, p)) && !same(p, S.hollow) && cheb(p, S.ghost) > 1 && cheb(p, gpos) > CFG.recordRange) spots.push(p); }
        const to = pickOf(S, spots), from = { f: h.f, c: h.c, r: h.r };
        releaseTrap(S, h); h.holding = false; Object.assign(h, to);
        yield { t: 'teleport', id: h.id, from, thrown: true };
        yield { t: 'log', cls: 'bad', text: 'The hand flings ' + h.name + ' clear across the floor, into the ' + roomAt(to.f, to.c, to.r) + '.' };
        yield* say(S, h.id, 'thrown');
      }
      yield* tip(S, 'record', 'The record player counts down 3, 2, 1. When it plays, anyone within 2 spaces loses a heart and is thrown somewhere on that floor.');
    }
  }
  // The Weeping Doll
  const dp = obj(S, 'doll').t[0], dpos = { c: dp[0], r: dp[1] };
  for (const h of heroList(S)) if (h.f === 'U' && awake(h) && !h.hidden && cheb(h, dpos) <= CFG.dollRange) {
    yield { t: 'log', cls: 'hazard', text: 'The Weeping Doll\'s sobbing gets inside ' + h.name + '\'s head.' };
    yield* scare(S, h, CFG.dollFright, 'doll');
    yield* tip(S, 'doll', 'The Weeping Doll adds 1 Fright to anyone within 2 spaces when the haunt ends.');
  }
}
function* clockPhase(S) {
  S.time += CFG.minutesPerRound;
  yield { t: 'clock' };
  if (S.time >= CFG.midnight) { S.over = { result: 'midnight' }; return; }
  if (S.time === 22 * 60 && !S.scenes.c22) { S.scenes.c22 = true; yield { t: 'card', card: STORY.chime22, chime: 10 }; }
  if (S.time === 23 * 60 && !S.scenes.c23) { S.scenes.c23 = true; yield { t: 'card', card: STORY.chime23, chime: 11 }; }
}
function* checkEnd(S) {
  if (S.over) return;
  const [a, b] = heroList(S);
  if (a.escaped && b.escaped) { S.over = { result: 'escaped' }; return; }
  if (a.down && b.down) { S.over = { result: 'taken' }; return; }
  for (const h of [a, b]) {
    const p = partner(S, h);
    if (h.escaped && p.down) { // he comes back for him
      const spot = DOORFRONT.find(q => !same(q, p)) || DOORFRONT[0];
      h.escaped = false; Object.assign(h, spot);
      yield { t: 'log', cls: 'good', text: h.name + ' hears ' + p.name + ' fall, and runs back inside.' };
      yield { t: 'teleport', id: h.id, from: EXITS[0] };
    }
  }
}
function* entityPhase(S) {
  yield { t: 'phase', name: 'haunt' };
  S.turn = null; S.hollow.sensed = false;
  yield* ghostPhase(S); yield* checkEnd(S); if (S.over) return;
  yield* hollowPhase(S);
  yield* hazardPhase(S);
  yield* checkEnd(S); if (S.over) return;
  yield* clockPhase(S);
}
function* heroTurn(S, h) {
  if (!awake(h)) return;
  S.turn = h.id; h.hidden = false; S.hollow.sensed = false;
  h.actions = CFG.actions[h.id];
  yield { t: 'turn', hero: h.id };
  if (h.fright >= CFG.frightCap) { h.actions--; h.fright = CFG.frightReset; yield { t: 'log', cls: 'bad', text: h.name + ' is overcome with Fright. He loses an action, and steadies to ' + CFG.frightReset + '.' }; yield { t: 'fx', kind: 'panic', id: h.id }; }
  if (h.debt) { h.actions = Math.max(0, h.actions - h.debt); h.debt = 0; yield { t: 'log', text: 'Brock is still winded from stepping in. He has one action fewer this turn.' }; }
  if (h.possessed) { yield* sabotage(S, h); yield* checkEnd(S); }
  let guard = 0;
  while (h.actions > 0 && !S.over && awake(h) && !h.possessed && guard++ < 40) {
    const act = yield { t: 'input', hero: h.id };
    if (!act || act.type === 'end') break;
    yield* perform(S, h, act);
    yield* checkEnd(S);
  }
  if (!S.over && awake(h)) { // Back to Back
    const p = partner(S, h);
    if (S.bond >= CFG.bondBackToBack && awake(p) && adjHeroes(h, p) && (h.fright > 0 || p.fright > 0)) {
      yield { t: 'log', cls: 'good', text: 'Back to Back: they steady each other.' };
      yield* soothe(S, h, 1); yield* soothe(S, p, 1);
    }
  }
  S.turn = null;
  yield { t: 'turnend', hero: h.id };
}
function turnOrder(S) {
  const b = S.heroes.brock, w = S.heroes.wesley;
  return b.possessed && !w.possessed ? ['wesley', 'brock'] : ['brock', 'wesley'];
}
function* game(S) {
  yield { t: 'start' };
  while (!S.over) {
    S.bondRound = {}; for (const h of heroList(S)) h.protectedRound = false;
    yield { t: 'round', n: S.round };
    for (const id of turnOrder(S)) { if (S.over) break; yield* heroTurn(S, S.heroes[id]); }
    if (S.over) break;
    yield* entityPhase(S);
    S.round++;
    if (S.round > 200) S.over = { result: 'stalled' };
  }
  yield { t: 'end', result: S.over };
}

/* ---------- the teammate's mind (also drives headless tests) ---------- */
function aiGoal(S, h) {
  const p = partner(S, h), opts = options(S, h), ch = CHAINS[h.chain];
  const find = (t, f) => opts.find(o => o.type === t && !o.disabled && (!f || f(o)));
  const adjP = () => neighbors(S, p).filter(q => q.f === p.f);
  const distTo = tiles => { if (!tiles.length) return 1e9; const m = bfs(S, tiles, { noTraps: true }); const n = m.get(key(h)); return n ? n.d : 1e9; };
  if (h.trapped) return { act: find('breakfree') };
  if (!p.escaped) {
    if (p.down) { const o = find('help', x => x.help === 'revive'); return o ? { act: o } : { go: adjP() }; }
    if (p.possessed) { const o = find('help', x => x.help === 'snap'); if (o) return { act: o }; if (distTo(adjP()) <= 5) return { go: adjP() }; }
    if (p.trapped) { const o = find('help', x => x.help === 'free'); if (o) return { act: o }; if (distTo(adjP()) <= 5) return { go: adjP() }; }
  }
  if (h.hearts <= 1) { const o = find('useitem', x => x.item === 'bandage' && x.target === h.id); if (o) return { act: o }; }
  if (h.fright >= 4) { const o = find('useitem', x => x.item === 'salts'); if (o) return { act: o }; }
  if (awake(p) && p.hearts <= 1) { const o = find('useitem', x => x.item === 'bandage' && x.target === p.id); if (o) return { act: o }; }
  if (awake(p) && p.fright >= 4) { const o = find('help', x => x.help === 'calm'); if (o) return { act: o }; }
  // hand over what belongs to the partner
  const theirs = CHAINS[p.chain].item;
  if (h.inv.includes(theirs) && !p.useDone && awake(p)) { const o = find('give', x => x.item === theirs); return o ? { act: o } : { go: adjP() }; }
  const fetch = item => { // go to wherever an item is
    const l = locate(S, item); if (!l) return null;
    if (l.where === 'ground') return { go: [l.pos] };
    if (l.where === 'obj') { const o = find('search', x => x.obj === l.id); return o ? { act: o } : { go: adjTilesOfObj(S, obj(S, l.id)) }; }
    if (l.where === 'hero' && l.id !== h.id) return { go: adjP() };
    return null;
  };
  // finale
  if (S.key.state !== 'hidden') {
    if (S.door.open) return { go: EXITS };
    if (h.inv.includes('masterkey')) { const o = find('unlock'); return o ? { act: o } : { go: DOORFRONT.filter(q => !same(q, p)) }; }
    if (p.inv.includes('masterkey')) return isDoorFront(h) || distTo(DOORFRONT) <= 1 ? { act: find('end') } : { go: DOORFRONT.filter(q => !same(q, p)) };
    const tk = find('takekey'); if (tk) return { act: tk };
    const g = S.ground.find(x => x.item === 'masterkey');
    const goal = g ? [g] : adjTilesOfObj(S, obj(S, 'hatch'));
    const mine = distTo(goal), m2 = bfs(S, goal, { noTraps: true }).get(key(p)), his = awake(p) && m2 ? m2.d : 1e9;
    if (mine < his || (mine === his && h.id === 'brock')) return { go: goal };
    return { go: DOORFRONT };
  }
  const ob = obj(S, S.obstacle);
  const coop = () => { if (h.holding) return { act: find('end') }; if (p.possessed) return adjObj(h, ob) ? { act: find('end') } : { go: adjTilesOfObj(S, ob) }; const o = find('lift'); return o ? { act: o } : { go: adjTilesOfObj(S, ob) }; };
  if (!S.coopDone && p.holding && !h.holding && !p.possessed && distTo(adjTilesOfObj(S, ob)) <= 6) return coop();
  const st = stepOf(S, h);
  if (st === 'find') { const g = fetch(ch.item); if (g) return g; }
  if (st === 'coop') return coop();
  if (st === 'use') {
    if (!h.inv.includes(ch.item)) { const g = fetch(ch.item); if (g) return g; return { act: find('end') }; }
    const d = find('deduce', x => x.target === h.id); if (d) return { act: d };
    const o = find('work'); return o ? { act: o } : { go: adjTilesOfObj(S, obj(S, ch.use)) };
  }
  // own cards done
  const d = find('deduce'); if (d) return { act: d };
  if (!S.coopDone) return coop();
  const s = find('search'); if (s) return { act: s };
  let best = null, bd = 12;
  for (const o of S.objs) if (o.search && !S.searched[o.id]) { const t = adjTilesOfObj(S, o), dd = distTo(t); if (dd < bd) { bd = dd; best = t; } }
  if (best) return { go: best };
  const ex = find('examine'); if (ex) return { act: ex };
  if (!S.clues.hatch) return { go: adjTilesOfObj(S, obj(S, 'hatch')) };
  return { act: find('end') };
}
function aiAct(S, h) {
  const g = aiGoal(S, h); S.ai[h.id] = g || {};
  if (g && g.act) return g.act;
  if (g && g.go) { const p = partner(S, h); g.go = g.go.filter(q => p.escaped || !same(q, p)); }
  if (g && g.go && g.go.length) {
    if (g.go.some(q => same(q, h))) return { type: 'end' };
    if (h.trapped) return { type: 'end' };
    return { type: 'move' };
  }
  return { type: 'end' };
}
function aiMove(S, h, ev) {
  const g = S.ai[h.id]; if (!g || !g.go || !g.go.length) return null;
  const m = bfs(S, g.go, { noTraps: true });
  const gp = obj(S, 'gramophone').t[0], dp = obj(S, 'doll').t[0];
  const gaze = new Set(gazeTiles(S).map(key));
  const score = t => {
    const n = m.get(key(t)); let s = (n ? n.d : 999) * 10;
    if (t.trap) s += 2000;
    if (t.exit) s -= 5;
    if (t.f === S.ghost.f && cheb(t, S.ghost) <= 1 && S.ghost.entranced <= 0) s += 14;
    if (t.f === 'U' && !S.record.calmed && S.record.timer <= 1 && Math.max(Math.abs(t.c - gp[0]), Math.abs(t.r - gp[1])) <= CFG.recordRange) s += 25;
    if (gaze.has(key(t))) s += 6;
    if (t.f === 'U' && Math.max(Math.abs(t.c - dp[0]), Math.abs(t.r - dp[1])) <= CFG.dollRange) s += 5;
    for (const tr of S.traps) if (!tr.holding && tr.f === t.f && manh(tr, t) === 1 && tr.dormant <= 0) s += 9;
    return s;
  };
  let best = null, bs = score({ f: h.f, c: h.c, r: h.r });
  for (const t of ev.tiles) { const s = score(t); if (s < bs) { bs = s; best = t; } }
  return best;
}
function aiAnswer(S, ev) {
  if (ev.kind === 'protect') return S.heroes.brock.hearts >= 2;
  if (ev.kind === 'abandon') return false;
  if (ev.kind === 'reroll') {
    const want = heroList(S).some(h => CHAINS[h.chain].brain && !h.useDone);
    return S.insight >= (want ? CFG.deduceCost + CFG.rerollCost : CFG.rerollCost);
  }
  return false;
}

root.HW = { CFG, MAPS, W, H, DIRS, STAIRS, HIDES, EXITS, DOORFRONT, ITEMS, CHAINS, CLUES, STORY, LINES, GHOST_NAMES, HOLLOW_NAMES,
  key, same, cheb, roomAt, newGame, game, options, hint, reach, gazeTiles, stepOf, tier, obj, fmtTime, locate, adjObj, adjTilesOfObj, isExit, isDoorFront,
  aiAct, aiMove, aiAnswer, canReroll, movePts, partner, heroList, awake, bfs };
})(typeof window !== 'undefined' ? window : globalThis);
