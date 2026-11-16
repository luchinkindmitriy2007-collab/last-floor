// Спрайты врагов глав 1–6, боссов и декора биомов.
// Симметричные существа задаются левой половиной (M) и зеркалируются.
// Семейства (рыцари, маги, големы) имеют общее тело и собственные детали
// (шлем, головной убор, оружие) + собственную палитру.

import { OUTLINE as O } from './SpriteDefs.js';

/** Зеркалирование половины: 'ab..' → 'ab....ba'. */
export const M = (half) => half.map((r) => r + r.split('').reverse().join(''));

/** Наложение строк поверх базы ('.' — прозрачно). */
export function overlay(base, over, dy = 0) {
  const out = base.map((r) => r.split(''));
  over.forEach((row, y) => {
    const ty = y + dy; if (!out[ty]) return;
    for (let x = 0; x < row.length; x++) if (row[x] !== '.') out[ty][x] = row[x] === '_' ? '.' : row[x];
  });
  return out.map((r) => r.join(''));
}

/** Второй кадр ходьбы: верх тела опускается на 1 px, ноги остаются. */
export function bob(rows, keepFrom = 12) {
  const top = rows.slice(0, keepFrom);
  const moved = ['.'.repeat(rows[0].length), ...top.slice(0, keepFrom - 1)];
  return [...moved, ...rows.slice(keepFrom)];
}

// ======================================================================
// БАЗОВЫЕ ТЕЛА СЕМЕЙСТВ
// ======================================================================
const KNIGHT = M([
  '........', '....oooo', '...ohhhh', '..ohhhhh', '..ohvvvv', '..ohhhhh', '...ohhhh', '..oooaaa',
  '.oaaaaaa', 'oaaoaaaa', 'oaaoaaaa', 'ohhoaaaa', '.oo.oaaa', '....oaao', '....oaao', '....ooo.'
]);
const KNIGHT_SHIELD = [
  '................', '................', '................', '................', '................', '................', '................',
  '.ooooo..........', 'oSSSSSo.........', 'oSsKsSo.........', 'oSKKKSo.........', 'oSsKsSo.........', '.oSSSo..........', '..ooo...........'
];
const KNIGHT_LEGS2 = ['...oaao..oaao...', '...oaao..oaao...', '...ooo....ooo...'];

const MAGE = M([
  '........', '........', '....oooo', '...ohhhh', '..ohhhhh', '..ohhfff', '..ohfeff', '...ohfff',
  '..ooohrr', '.orrrrrr', 'orRrrrrr', 'orRrrrrr', 'orRrrrrr', '.orRrrrr', '.oRRRRRR', '..oooooo'
]);

const GOLEM2 = M([
  '........', '....oooo', '...ossss', '..osssss', '..osesss', '.oosssss', 'ossosSSS', 'ossossss',
  'ossossss', 'oSSosmss', '.ooossss', '...ossoo', '...osso.', '..ossso.', '..oooo..', '........'
]);

const GHOST = M([
  '........', '........', '.....ooo', '....oggg', '...ogggg', '..oggggg', '..ogeegg', '..ogeegg',
  '..oggggg', '..ogggmm', '.ogggggg', '.ogggggg', 'oggggggg', 'oggoggog', 'o.oo.oo.', '........'
]);

// ======================================================================
// ВРАГИ
// ======================================================================
export const ENEMY_ART = {
  // ---------- Глава 1
  rat: {
    frames: [[
      '................', '................', '................', '................', '................', '................', '................',
      '..........o.o...', '.........opopo..', '...oooooooffffo.', '..offffffffffeo.', '.offfffffffffffn', '.oFfffffffffffo.',
      'o.oFFFFFFFFFFo..', 'ot.oFo...oFo....', 'tt.oo.....oo....'
    ]],
    legs2: ['ot..oFo.oFo.....', 'tt...oo..oo.....'],
    pal: { o: O, f: '#7a6a5a', F: '#4e4238', p: '#d88a8a', e: '#ff4a4a', n: '#e88a9a', t: '#c88a8a' }
  },
  statue: {
    half: ['........', '.....ooo', '....osss', '...ossss', '...osess', '...ossss', '....osSS', '..ooosss',
      '.ossssss', 'osSoosss', 'osSoosss', 'oSSoossS', '.oo.ossS', '....osSo', '....oSSo', '...ooooo'],
    pal: { o: O, s: '#9a958a', S: '#5e5a52', e: '#ffcf4a' }
  },

  // ---------- Глава 2
  fire_slime: {
    base: 'slime',
    over: ['................', '................', '......y..y......', '.....yfyyfy.....', '......ffff......'],
    pal: { o: O, g: '#e8582a', G: '#9a2a14', l: '#ffd070', e: '#2a0a08', w: '#fff0c0', y: '#ffe08a', f: '#ff9a2a' }
  },
  demon: {
    half: ['..o.....', '..oho...', '...oho..', '....oooo', '....orrr', '....orer', 'oo..orrr', 'owwo.orr',
      'owwoorrr', 'owworrrr', '.oRRorrr', '..oRoRrr', '....orRo', '....oro.', '...oko..', '...oo...'],
    pal: { o: O, h: '#e8d8b0', r: '#c0303a', R: '#7a1820', e: '#ffe04a', w: '#5a2a5a', k: '#2a1a1a' }
  },
  lava_golem: {
    base: 'golem2',
    over: ['................', '....oo....oo....', '...oho....oho...', '................', '................', '................', '......m..m......', '.......mm.......', '......m..m......'],
    pal: { o: O, s: '#4a3a36', S: '#2a201e', e: '#ffd04a', m: '#ff7a2a', h: '#2a201e' }
  },
  fire_beetle: {
    half: ['........', '....o...', '.....o..', '......oo', '.....okk', '.o..okek', '..o.oooo', '...ossss',
      'o.oslsss', '.ooslsss', '..ossssd', 'o.ossssd', '.oosssSd', '...oSSSd', '..o.oooo', '.o......'],
    pal: { o: O, k: '#3a2a2a', e: '#ffe04a', s: '#d8501a', S: '#8a2a10', l: '#ffb060', d: '#ffd84a' }
  },
  ash_mage: {
    base: 'mage',
    over: ['.......oo.......', '......ohho......', '.....ohhhho.....', '....ohhhhhho....', '...ohhhhhhhho...', '', '', '', '', '', '...yy...........', '..yfyo..........', '..ofo...........'],
    pal: { o: O, h: '#4a4048', f: '#2a2028', e: '#ff8a2a', r: '#6a5a5e', R: '#3a3036', y: '#ffd04a' }
  },
  imp: {
    half: ['........', '........', '........', '...o....', '...oo...', '....oooo', '....orer', 'oo..orrr',
      'owo.orrr', '.owoorrr', '..o.oRRr', '....o.oo', '........', '........', '........', '........'],
    pal: { o: O, r: '#e05030', R: '#902818', e: '#ffff8a', w: '#ff9a4a' },
    flying: true
  },

  // ---------- Глава 3
  ice_wolf: {
    frames: [[
      '................', '................', '................', '................',
      '..........o.o...', '.........owowo..', '.o.......owwwwo.', 'owo.....owwewwwo', '.owo..oooowwwwnn',
      '..owwwwwwwwwwoo.', '..owwwwwwwwwwwo.', '..oWwwwwwwwwWWo.', '...oWWWWWWWWWo..',
      '...ow.ow..ow.ow.', '...ow.ow..ow.ow.', '...oo.oo..oo.oo.'
    ]],
    legs2: ['..ow..ow.ow..ow.', '..ow..ow.ow..ow.', '..oo..oo.oo..oo.'],
    pal: { o: O, w: '#d8e8f0', W: '#8aa8c0', e: '#4ad8ff', n: '#2a3a50' }
  },
  snow_ghost: { base: 'ghost', pal: { o: '#3a5a7a', g: '#e8f4ff', e: '#2a4a8a', m: '#8ab0d8' } },
  ice_mage: {
    base: 'mage',
    over: ['...c..c..c..c...', '...cooccoocc....', '....occcccco....', '................', '................', '', '', '', '', '', '..cc............', '.olco...........', '..oo............'],
    pal: { o: O, h: '#d8f0ff', f: '#8ab0c8', e: '#2ae0ff', r: '#3a7ad0', R: '#1e4a8a', c: '#bff4ff', l: '#ffffff' }
  },
  frozen_knight: {
    base: 'knight',
    over: ['...i.i....i.i...', '...ioi....ioi...'],
    pal: { o: O, h: '#a8d0e8', v: '#1a3a5a', a: '#5a8ab0', S: '#3a6a90', s: '#8ac0e0', K: '#e8f8ff', i: '#e8fbff' }
  },
  ice_elemental: {
    half: ['........', '......oc', '.....ocl', '....occl', '...occcc', '..occcec', '..occccc', '.oCcccco',
      'oCcccccc', 'oCccoccc', '.oCo.occ', '..o..oCc', '.....oCc', '....oCCc', '....oooo', '........'],
    pal: { o: O, c: '#8ae0ff', C: '#3a8ac0', l: '#ffffff', e: '#1a4a8a' }
  },
  ice_shard: {
    half: ['........', '........', '........', '........', '........', '.......o', '......oc', '.....ocl',
      '....occc', '....ocec', '.....occ', '......oC', '.......o', '........', '........', '........'],
    pal: { o: O, c: '#bff0ff', C: '#5aa8d8', l: '#ffffff', e: '#2a5a9a' }
  },

  // ---------- Глава 4
  zombie: {
    half: ['........', '.....ooo', '....ozzz', '...ozzzz', '...ozdzz', '...ozezz', '....ozzz', '..ooozcc',
      'ozzocccc', 'ozzocccc', '.oo.occC', '....occC', '....oCCo', '....oCCo', '...oddo.', '...ooo..'],
    pal: { o: O, z: '#8aa870', d: '#4a5a3a', e: '#ffe04a', c: '#5a4a6a', C: '#3a2a4a' }
  },
  skeleton_knight: {
    base: 'knight',
    over: ['................', '................', '................', '................', '...ohrrhhhrrho..', '...ohhhhhhhhho..'],
    pal: { o: O, h: '#e8e0c8', v: '#2a2030', r: '#ff3a4a', a: '#5a5a6a', S: '#3a3040', s: '#7a6a8a', K: '#c0a050' }
  },
  reaper: {
    frames: [[
      '..........oo....', '.........osso...', '........osooo...', '.....oooos......', '....occcos......', '...occccco......',
      '...ocdeedco.....', '...occddcco.....', '..occcccccco....', '..occcccccso....', '.occccccccso....', '.occcccccco.s...',
      '.oCccccccCo..s..', '..oCcCcCcCo...s.', '...o.o.o.o......', '................'
    ]],
    pal: { o: O, c: '#2a2238', C: '#14101e', d: '#0a0810', e: '#b8ff7a', s: '#c8c8d0' },
    flying: true
  },
  cursed_soul: {
    half: ['........', '.......f', '....f.ff', '...ffyff', '..fyyyyf', '...ooooo', '..owwwww', '..owddww',
      '..owddww', '..owwwwd', '...owwww', '...owdwd', '....oooo', '........', '........', '........'],
    pal: { o: O, w: '#d8c8f0', d: '#2a1a3a', f: '#7a3ab0', y: '#c08aff' },
    flying: true
  },
  necromancer: {
    base: 'mage',
    over: ['..o..........o..', '..ho........oh..', '...hoooooooh....', '....ohhhhhho....', '', '', '', '', '', '', '..ww............', '.owdo...........', '..oo............'],
    pal: { o: O, h: '#2a1a30', f: '#c8c0b0', e: '#8aff6a', r: '#3a2048', R: '#1e1028', w: '#e8e0c8', d: '#2a2030' }
  },

  // ---------- Глава 5
  crystal_golem: {
    base: 'golem2',
    over: ['....c......c....', '...ocl....lco...', '...occ....cco...', '................', '................', '................', 'cl............lc', 'occ..........cco'],
    pal: { o: O, s: '#5a7a9a', S: '#34506a', e: '#ff7af0', m: '#8af0ff', c: '#8af0ff', l: '#ffffff' }
  },
  magic_sphere: {
    half: ['........', '........', '....oooo', '...ollpp', '..olpppp', '..olpppp', '.olppeep', '.oppped.',
      '.oppppee', '..oppppp', '..oPpppp', '...oPPPP', '....oooo', '..r.....', '...r....', '....rr..'],
    pal: { o: O, p: '#b884ff', P: '#6a3aa8', l: '#f0e0ff', e: '#ffffff', d: '#3a1a6a', r: '#ff8af0' },
    flying: true
  },
  crystal_spider: {
    half: ['........', '........', '........', 'o.o.....', '.o.o...o', '..o.o.oc', 'o..ooocc', '.oo.occc',
      '...oceec', 'o.oocccc', '.o.occcc', '..o.occC', '.o..ocCC', 'o..o.oCC', '..o...oo', '........'],
    pal: { o: O, c: '#ff8ad8', C: '#a83a8a', e: '#ffffff' }
  },
  blinker: {
    half: ['........', '...o....', '....o...', '.....ooo', '....oppp', '...opppp', '..oppooo', '..opoeee',
      '..opoeed', '..opoeee', '..oppooo', '...opppp', '....oppp', '.....ooo', '....o...', '...o....'],
    pal: { o: O, p: '#5ae0c8', e: '#ffffff', d: '#1a2a3a' },
    flying: true
  },
  magic_guardian: {
    half: ['.......o', '......oy', '.......o', '.....ooo', '....occc', '...occlc', '...occcc', '..oocccc',
      '.ooooooo', '...ommmm', '...omKmm', '...ommmm', '...omKmm', '....ommm', '.....ooo', '......oo'],
    pal: { o: O, c: '#8af0ff', l: '#ffffff', m: '#6a6a8a', K: '#ffd04a', y: '#ffe08a' },
    flying: true
  },

  // ---------- Глава 6
  ancient_guardian: {
    base: 'golem2',
    over: ['..oooooooooooo..', '..oKKKKKKKKKKo..', '................', '................', '................', '................', '.......KK.......', '......K..K......', '.......KK.......'],
    pal: { o: O, s: '#4a4060', S: '#2a2238', e: '#ff4a6a', m: '#ffd04a', K: '#c8a040' }
  },
  shadow: {
    half: ['........', '....o...', '....od..', '....oddo', '...odddd', '...odedd', '...odddd', '..oddddd',
      '.oddoddd', 'odd.oddd', 'od..oddd', 'o...oddd', '...oddDd', '...odDdD', '...o.D.p', '......p.'],
    pal: { o: '#0a0610', d: '#2a1a3a', D: '#4a2a6a', e: '#ffffff', p: '#7a4aa8' }
  },
  soul_devourer: {
    half: ['........', '........', '...ooooo', '..oppppp', '.opppPpp', '.oppeepp', 'oppppppp', 'opptoooo',
      'oppowtwt', 'opporrrr', 'oppowtwt', '.oppoooo', '.oPpppPp', '..oPPPPP', '...ooooo', '........'],
    pal: { o: O, p: '#6a2a8a', P: '#3a1450', e: '#ff4af0', r: '#e02a4a', w: '#f0e0ff', t: '#2a0a20' },
    flying: true
  },
  elite_knight: {
    base: 'knight',
    over: ['..g..........g..', '..go........og..', '...goooooooog...'],
    pal: { o: O, h: '#2a2a3a', v: '#ff4a6a', a: '#8a2a4a', S: '#4a1a2a', s: '#c8a040', K: '#ffe08a', g: '#e0b040' }
  },
  twisted: {
    frames: [[
      '................', '......oooo......', '....oommmmoo....', '...ommmemmmmo.oo', '..ommmmmmmmmmoeo', '.ommoommmmmmmmmo', '.omo.ommmmememmo',
      'ommo.omtwtwtmmo.', 'om...omrrrrrmmo.', 'oo...omtwtwtmmmo', '.....ommmmmmMMmo', '....oMmmmMMmMo.o', '...oMMoMMoMMMo..', '...oo.oo.oMo....',
      '.........oo.....', '................'
    ]],
    pal: { o: O, m: '#7a4a6a', M: '#4a2a40', e: '#ffd04a', t: '#1a0a14', w: '#f0e0d0', r: '#c02a3a' }
  }
};

export const BASES = { knight: KNIGHT, mage: MAGE, golem2: GOLEM2, ghost: GHOST };
export const BASE_OVERLAYS = { knight: KNIGHT_SHIELD };
export const BASE_LEGS2 = { knight: KNIGHT_LEGS2 };

// ======================================================================
// БОССЫ (половины шириной 16 → 32 px)
// ======================================================================
export const BOSS_ART = {
  ash_lord: {
    half: [
      '...o............', '..oHo...........', '..oHHo..........', '...ohHo.......y.', '....ohHo.....yfy', '.....ohHo..yffff', '......ohooooffff',
      '......orrrrrrrrr', '.....orrRrrrrrrr', '.....orRoeeorrrr', '.....orrRrrrrrrr', '.....orrrrommmmm', '......orrrrrrrrr', '..ooo..orrrrrrrr',
      '.orrRoooorrrrrrr', 'orrrRRrrrrmrrrrr', 'orrRRrrrrmrrrrrr', 'orRRoorrrrmmrrrr', 'orRo.orrrrrmrrrr', 'oRRo.oRrrrrrmrrr',
      'offo.oRRrrrrrrrr', 'ofyfo.oRRrrrrrrr', '.ofo..oRRRRRRRRR', '..o.....oRRRo...', '........oRRRo...', '.......oRRRRo...',
      '......ohhhhho...', '......ooooooo...'
    ],
    pal: { o: O, h: '#2a2028', H: '#6a5a60', r: '#9a2a1a', R: '#4a1410', m: '#ffb040', y: '#fff0a0', f: '#ff6a20', e: '#fff4a0' },
    glow: { m: '#ffe08a', e: '#ffffff', f: '#ffd040' },
    rage: { r: '#c83a1a', R: '#6a1a10', m: '#ffffff', f: '#ffffff' }
  },
  ice_queen: {
    half: [
      '...........c...c', '..........ocCocC', '.........ocCCCCC', '........ohhhhhhh', '.......ohhhsssss', '.......ohhssssss',
      '......ohhsseesss', '......ohhsssssss', '.....ohhhhSsssss', '....ohhhhoooosss', '...ohhhhoggggggg', '...ohhhoggllgggg',
      '..ohhhoggglggggg', '..ohho.oSggggggg', '..oho.oSsoGggggg', '...o..osSoggglgg', '......ooogGggggg', '.......oggGggggg',
      '......oggggGgggg', '......ogglggGggg', '.....ogglgggGggg', '.....oglggggGggg', '....oglgggggGGgg', '....ollggggggGgg',
      '...olgggggggggGg', '...oGGGGGGGGGGGG', '....oooooooooooo'
    ],
    pal: { o: O, c: '#e8f8ff', C: '#8ad8ff', s: '#dfe8f0', S: '#a0b0c8', h: '#f0f8ff', g: '#5a8ad8', G: '#2a4a90', l: '#a8d0ff', e: '#3ae0ff' },
    glow: { e: '#ffffff', c: '#ffffff', l: '#e8f8ff' },
    rage: { g: '#8a5ae0', G: '#4a2a90', l: '#d8b8ff', e: '#ff4af0' }
  },
  king_dead: {
    half: [
      '.........k..k..k', '.........kk.kk.k', '.........kkkkkkk', '.........oKKKKKK', '........owwwwwww', '.......owwdddwww',
      '.......owwdrdwww', '........owwwwwwd', '........owwwwwww', '........owdwdwdw', '.........owwwwww', '...occcoooommmmm',
      '..occcccomwwwmmm', '.occcCccomwwmmww', '.occcCcomwmmwwmm', 'occcCCcomwwmmwwm', 'occcCCcommmmmmmm', 'occcCCcomwKKKKKK',
      'occCCCcommmmmmmm', 'occCCCcoommmmmmm', 'ocCCCCco.ommmo..', 'ocCCCCo..ommmo..', '.oCCCo...ommmo..', '..ooo...owwwwo..',
      '........oooooo..'
    ],
    pal: { o: O, w: '#e8e0c8', d: '#2a2030', r: '#ff3a4a', k: '#e0b040', K: '#9a7020', c: '#4a2a6a', C: '#2a1640', m: '#5a5a6e' },
    glow: { r: '#ffffff', k: '#fff0a0' },
    rage: { r: '#8aff6a', c: '#2a5a3a', C: '#14301e' }
  },
  crystal_guardian: {
    half: [
      '..............oo', '.............olc', '............olcc', '...........olccc', '..........olcccc', '.........olccccc',
      '........olccoooo', '.......olccoeeee', '.......olccoeedd', '.......olccoeeee', '........olccoooo', '.........oCcccCC',
      '..........oCcccC', '..olco.....oCCCC', '.olcco....oCcccc', 'olccCo...oCccccc', 'oCcCo...oCcccccc', '.oCo...oCcccpccc',
      '......oCccpplpcc', '.olo...oCcccpccc', 'olcco...oCcccccc', '.oCo.....oCccccc', '..o.......oCcccc', '...........oCccc',
      '............oCcc', '.............oCc', '..............oo'
    ],
    pal: { o: O, c: '#8af0ff', C: '#3aa8d8', l: '#e8ffff', d: '#1a5a8a', e: '#ff4af0', p: '#b884ff' },
    glow: { e: '#ffffff', p: '#ffffff', l: '#ffffff' },
    rage: { c: '#ff8ad8', C: '#a83a8a', e: '#ffff8a', p: '#ffffff' }
  },
  tower_heart: {
    half: [
      '................', '....ooooo.......', '...olllrro....oo', '..ollrrrrro..orr', '.olrrrrrrrrooorr', '.olrrrvrrrrrrrrr',
      'olrrrrvvrrrrrrrr', 'olrrrrrvrrrooooo', 'orrrrrrrrrooeeee', 'orrrrrrrrooeeedd', 'orrrrvrrrooeeedd', 'orrrrvrrrrooeeee',
      'oRrrrrvrrrrooooo', '.oRrrrrvvrrrrrrr', '.oRRrrrrrrrrrrrr', '..oRRrrrrrrvrrrr', '...oRRrrrrrvrrrr', '....oRRrrrrrvrrr',
      '.....oRRRrrrrrrr', '......ooRRRrrrrr', '..tt.....ooRRRRR', '.tTt...t...ooRRR', '.tt...tTt....ooo', '..t..tTt....t...',
      '...ttt.....tTt..', '..........tt....'
    ],
    pal: { o: O, r: '#a02040', R: '#5a1028', l: '#ff6a8a', v: '#ffcf6a', e: '#fff8d0', d: '#1a0a14', t: '#4a1a40', T: '#2a0a28' },
    glow: { v: '#ffffff', l: '#ffb0c0', e: '#ffffff' },
    rage: { r: '#d02a5a', v: '#ff4af0', e: '#ff4a6a', d: '#ffffff' }
  }
};

// Короны/детали мини-боссов поверх базового врага (16×16)
export const MINIBOSS_ART = {
  rat_king: { base: 'rat', over: ['................', '................', '................', '................', '................', '.........k.k.k..', '.........kkkkk..', '.........kKkKk..'], pal: { k: '#e0b040', K: '#ff4a4a' } },
  inferno_brute: { base: 'demon', over: ['.y............y.', 'yfy..........yfy', '.y............y.'], pal: { y: '#ffe08a', f: '#ff6a20' } },
  wolf_alpha: { base: 'ice_wolf', over: ['................', '................', '................', '..........kk....', '.........kkkk...', '................', '................', '.........r..r...'], pal: { k: '#5ae0ff', r: '#ff4a4a' } },
  executioner: { base: 'skeleton_knight', over: ['...............x', '..............xx', '.............xx.', '............xx..', '...........xx...', '..........xx....'], pal: { x: '#c8c8d0' } },
  brood_mother: { base: 'crystal_spider', over: ['................', '................', '.......kk.......', '......kKKk......'], pal: { k: '#ffffff', K: '#ff8ad8' } },
  void_knight: { base: 'elite_knight', over: ['................', '................', '................', '................', '...ovvvvvvvvo...'], pal: { v: '#b884ff' } }
};

// ======================================================================
// ДЕКОР БИОМОВ (16×16, нижняя часть тайла)
// ======================================================================
const E8 = '................';
export const DECOR_ART = {
  lavarock: { rows: [E8, E8, E8, E8, E8, E8, E8, E8, E8, '......oooo......', '....oossSSoo....', '...osmsssSSSo...', '..ossmmsSSSSSo..', '..oSSSmSSSSSSo..', '...oooooooooo...', E8], pal: { o: O, s: '#4a3a36', S: '#2a201e', m: '#ff7a2a' } },
  icicle: { rows: [E8, E8, E8, E8, E8, E8, '.......o........', '......olo.......', '......olo...o...', '.....olco..olo..', '.o...occo..oco..', 'olo.olccco.occo.', 'occoocccco.occo.', 'oCCoCCCCCooCCCo.', '.ooooooooooooo..', E8], pal: { o: O, l: '#ffffff', c: '#8ae0ff', C: '#3a8ac0' } },
  tombstone: { rows: [E8, E8, E8, E8, E8, '.....oooooo.....', '....osssssSo....', '....osdsdsSo....', '....ossdssSo....', '....osdsdsSo....', '....osssssSo....', '....osssssSo....', '...oossssSSoo...', '..ommmmmmmmmmo..', '...oooooooooo...', E8], pal: { o: O, s: '#7a7684', S: '#4a4652', d: '#3a3642', m: '#3a5a2a' } },
  candles: { rows: [E8, E8, E8, E8, E8, E8, E8, E8, '....y.....y.....', '...yfy...yfy..y.', '....w.....w..yfy', '...owo...owo..w.', '...owo...owo.owo', '...owo...owo.owo', '..oooo..ooooooo.', E8], pal: { o: O, w: '#e8e0c8', y: '#fff0a0', f: '#ff9a2a' } },
  crystal: { rows: [E8, E8, E8, E8, E8, '......o.........', '.....olo....o...', '.....olco..olo..', '..o..occo..oco..', '.olo.olcco.occo.', '.occoocccoocCco.', '.oCCooCCCooCCCo.', '..ooooooooooooo.', E8, E8, E8], pal: { o: O, l: '#ffffff', c: '#ff8ad8', C: '#a83a8a' } },
  crystal_b: { rows: [E8, E8, E8, E8, E8, E8, '........o.......', '.......olo......', '...o...olco.....', '..olo..occo..o..', '..occo.occo.olo.', '..oCCo.oCCo.oCo.', '...oo...oo...o..', E8, E8, E8], pal: { o: O, l: '#ffffff', c: '#8af0ff', C: '#3aa8d8' } },
  voidrune: { rows: [E8, E8, E8, E8, E8, E8, E8, '......vvvv......', '....vv....vv....', '...v..vvvv..v...', '...v.v....v.v...', '...v..vvvv..v...', '....vv....vv....', '......vvvv......', E8, E8], pal: { v: '#7a4aa8' } },
  ashpile: { rows: [E8, E8, E8, E8, E8, E8, E8, E8, E8, E8, '.......oo.......', '.....oaaaao.....', '...oaaAaaaaao...', '..oaAAaaaAaaao..', '...ooooooooooo..', E8], pal: { o: O, a: '#5a5258', A: '#3a3438' } }
};
