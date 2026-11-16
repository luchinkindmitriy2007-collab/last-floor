// Оригинальные пиксельные спрайты, заданные строками (один символ = один пиксель).
// '.' — прозрачность, остальные символы мапятся на палитру конкретного спрайта.
// Такой формат легко правится руками и позже заменяется на PNG spritesheets.

export const OUTLINE = '#1a1220';

// ---------- Герой: тело + сменные ноги + головные уборы классов ----------
export const HERO_BODY = [
  '................',
  '.....oooooo.....',
  '....ohhhhhhoo...',
  '...ohhhhhhhhho..',
  '...ohhhhhhhhho..',
  '...ohhhssssso...',
  '...ohhssesseo...',
  '...oHhsssssso...',
  '....oHSSSSSo....',
  '...ooaaaaaaoo...',
  '..osaAaaaaaAso..',
  '..oSoAaaaaaoSo..',
  '...ooAAkkAAoo...'
];
export const HERO_LEGS = {
  stand: ['....oaaooaao....', '....obbo.obbo...', '....ooo...ooo...'],
  stepA: ['....oaaooaao....', '...obbo...obbo..', '...ooo.....ooo..'],
  stepB: ['....oaaoaao.....', '.....obbobbo....', '.....oooooo.....']
};
export const HERO_HEADGEAR = {
  guardian: [
    '.......rrr......',
    '......rrRro.....',
    '....ohhrRhhoo...',
    '...ohlhhhhhhho..',
    '...ohhhhhhhhho..',
    '...oHHHHHHHHHo..',
    '...ohhssesseo...'
  ],
  ranger: [
    '................',
    '.....oooooo.....',
    '...oohhhhhhoo...',
    '..ohhhhhhhhhho..',
    '..ohhlhhhhhhho..',
    '..oHhhssssssho..',
    '..oHhssesseho...',
    '..oHHsssssso....'
  ],
  mage: [
    '.........oo.....',
    '........ohyo....',
    '.......ohhho....',
    '......ohhhhho...',
    '.....ohhhhhhho..',
    '..oooHHHHHHHHooo',
    '...ohhssesseo...'
  ]
};
export const HERO_PALETTES = {
  guardian: { o: OUTLINE, h: '#a7b3c4', H: '#5d6a7d', l: '#e4ecf5', s: '#f0c39a', S: '#c98f6a', e: '#1a1220', a: '#3b62b0', A: '#24407a', k: '#d8ae4f', b: '#5a3d2b', r: '#d0413f', R: '#8e2430' },
  ranger: { o: OUTLINE, h: '#4f8a3c', H: '#2c5527', l: '#7fbf5a', s: '#ecb98f', S: '#c08463', e: '#1a1220', a: '#8a5a34', A: '#5c3a21', k: '#c9a24a', b: '#3b2a20' },
  mage: { o: OUTLINE, h: '#7346b0', H: '#45287a', l: '#a57de0', y: '#f5d76e', s: '#f0c8a8', S: '#c99476', e: '#1a1220', a: '#6a3fa6', A: '#3f2470', k: '#f0c45a', b: '#2a2038' },
  merchant: { o: OUTLINE, h: '#7a5232', H: '#4b311d', l: '#a37244', s: '#e7b48b', S: '#b98163', e: '#1a1220', a: '#2f6b6b', A: '#1e4747', k: '#e3b04b', b: '#3b2a20' },
  explorer: { o: OUTLINE, h: '#8b8f99', H: '#565a66', l: '#c0c4cc', s: '#d8a982', S: '#a9785c', e: '#1a1220', a: '#7a3b3b', A: '#4f2424', k: '#a0a0a0', b: '#2e2a2a' }
};

// ---------- Враги ----------
export const SLIME = {
  w: 16, h: 16,
  frames: [[
    '................', '................', '................', '................', '................',
    '......oooo......',
    '....oogllggoo...',
    '...ogllgggggGo..',
    '..oglgggggggGGo.',
    '..ogggeggggeGGo.',
    '.ogggwgggggwgGGo',
    '.ogggggggggggGGo',
    '.oGgggggggggGGGo',
    '..oGGGGGGGGGGGo.',
    '...ooooooooooo..',
    '................'
  ]]
};
export const BAT = {
  w: 16, h: 16,
  frames: [[
    '................', '................',
    '.o............o.',
    '.oo..........oo.',
    '.opo..o..o..opo.',
    '.oppo.obbo.oppo.',
    '.opPpobbbbopPpo.',
    '..oPpbebbebpPo..',
    '...opbbbbbbbpo..',
    '....obbwwbbo....',
    '.....obbbbo.....',
    '......oooo......',
    '................', '................', '................', '................'
  ], [
    '................', '................', '................', '................',
    '......o..o......',
    '......obbo......',
    '.....obbbbo.....',
    '..ooobebbebooo..',
    '.opPpbbbbbbbpPo.',
    '.oPpoobwwboopPo.',
    '.opo..obbo..opo.',
    '.oo....oo....oo.',
    '.o............o.',
    '................', '................', '................'
  ]]
};
export const SKELETON = {
  w: 16, h: 16,
  frames: [[
    '................',
    '.....oooooo.....',
    '....owwwwwwo....',
    '...owwwwwwwWo...',
    '...owddwwddWo...',
    '...owdrwwdrWo...',
    '...owwwwwwwWo...',
    '....oWwdwdWo....',
    '.....owwwwo.....',
    '....oooWWooo....',
    '...owowwwwowo...',
    '..owo.odwdo.owo.',
    '..oo..owdwo..oo.',
    '.....owoowo.....',
    '.....ow..wo.....',
    '....oWo..oWo....'
  ], [
    '................',
    '.....oooooo.....',
    '....owwwwwwo....',
    '...owwwwwwwWo...',
    '...owddwwddWo...',
    '...owdrwwdrWo...',
    '...owwwwwwwWo...',
    '....oWwdwdWo....',
    '.....owwwwo.....',
    '....oooWWooo....',
    '...owowwwwowo...',
    '..owo.odwdo.owo.',
    '..oo..owdwo..oo.',
    '.....owoowo.....',
    '....ow....wo....',
    '...oWo....oWo...'
  ]]
};
export const SENTRY = {
  w: 16, h: 16,
  frames: [[
    '......oooo......',
    '.....ossSSo.....',
    '.....osssSo.....',
    '....ossssSSo....',
    '....osrssSSo....',
    '....osssssSo....',
    '....osoggoSo....',
    '....osgGGgSo....',
    '....osoggoSo....',
    '....osssssSo....',
    '....osrssrSo....',
    '...ossssssSSo...',
    '..oddddddddddo..',
    '..osssssssssSo..',
    '..oSSSSSSSSSSo..',
    '...oooooooooo...'
  ]]
};
export const GOLEM = {
  w: 16, h: 16,
  frames: [[
    '................',
    '.....oooooo.....',
    '....osssssSo....',
    '...ossmssssSo...',
    '...osggsssggSo..',
    '..oosssssssSSoo.',
    '.ossoSSSSSSSoSSo',
    '.osssosssssSoSSo',
    '.osmsossrssSosSo',
    '.oSSSosssssSoSSo',
    '..ooooSSSSSSooo.',
    '....osssoossSo..',
    '....osSSo.osSo..',
    '...ossSo..ossSo.',
    '...oooo...oooo..',
    '................'
  ], [
    '................',
    '.....oooooo.....',
    '....osssssSo....',
    '...ossmssssSo...',
    '...osggsssggSo..',
    '..oosssssssSSoo.',
    '.ossoSSSSSSSoSSo',
    '.osssosssssSoSSo',
    '.osmsossrssSosSo',
    '.oSSSosssssSoSSo',
    '..ooooSSSSSSooo.',
    '....osssoossSo..',
    '...ossSSo.osSo..',
    '...osSo...ossSo.',
    '...ooo....oooo..',
    '................'
  ]]
};

export const ENEMY_PALETTES = {
  slime: { o: OUTLINE, g: '#6cc04a', G: '#3c7d34', l: '#c4f08a', e: '#1a1220', w: '#ffffff' },
  slime_big: { o: OUTLINE, g: '#4fae6c', G: '#2b6b44', l: '#a6e8b0', e: '#1a1220', w: '#ffffff' },
  bat: { o: OUTLINE, b: '#4a3560', p: '#6c4f8c', P: '#9b7fc0', e: '#ff5a4a', w: '#f2e6c9' },
  skeleton: { o: OUTLINE, w: '#e8e1cc', W: '#a99f86', d: '#2a2030', r: '#7cff8a' },
  archer: { o: OUTLINE, w: '#d9cfae', W: '#968a6a', d: '#2a2030', r: '#ffb84a' },
  sentry: { o: OUTLINE, s: '#8c8f86', S: '#5b5e58', d: '#2f3130', r: '#6fe08a', g: '#5fe07f', G: '#d8ffe0' },
  golem: { o: OUTLINE, s: '#8a8c7c', S: '#565a4e', m: '#5d9a3c', g: '#7cff8a', r: '#6fe08a' },
  mimic: null // строится из сундука
};

// ---------- Босс «Каменный Привратник», собирается из частей ----------
export const BOSS_PARTS = {
  head: [
    '..oooooooooo..',
    '.ossssmmssSSo.',
    'ossssssssssSSo',
    'osoeeossoeeoSo',
    'osoeeossoeeoSo',
    'ossoossssooSSo',
    'osssdddddddsSo',
    '.oooooooooooo.'
  ],
  torso: [
    '..oooooooooooooooo..',
    '.ossssssssssssssSSo.',
    'osssssssggssssssSSSo',
    'ossssssgsgsssssSSSSo',
    'ossmmssggggssssSSSSo',
    'osssssssggsssssSSSSo',
    'ossssssssssssssSSSSo',
    'oddddddddddddddddddo',
    '.osssssssssssssSSSo.',
    '.ossssssssssssSSSSo.',
    '..oSSSSSSSSSSSSSSo..',
    '...oooooooooooooo...'
  ],
  arm: [
    '..oooo.',
    '.ossSSo',
    'ossssSo',
    'osmssSo',
    'ossssSo',
    '.osssSo',
    '.ossSo.',
    '.osSSo.',
    'ossssSo',
    'osgsgSo',
    'ossssSo',
    'oSSSSSo',
    '.ooooo.'
  ],
  leg: [
    '.osssSo',
    '.osssSo',
    '.osSSSo',
    'ossssSo',
    'osssSSo',
    'osssSSo',
    'odddddo',
    'ooooooo'
  ]
};
export const BOSS_PALETTE = { o: OUTLINE, s: '#9a9c8a', S: '#5e6256', d: '#2c2e2a', m: '#5d9a3c', g: '#7cff8a', e: '#b8ffc4' };
export const BOSS_PALETTE_RAGE = { o: OUTLINE, s: '#a39282', S: '#66544a', d: '#2c2220', m: '#7a6a3c', g: '#ff7a4a', e: '#ffd0a0' };

// ---------- Объекты ----------
export const CHEST = {
  w: 16, h: 16,
  frames: [[
    '................', '................', '................',
    '..oooooooooooo..',
    '.owwwwwwwwwwwwo.',
    '.owWWWWWWWWWWwo.',
    '.oggggggggggggo.',
    '.owwwwwoowwwwwo.',
    '.owwwwoggowwwwo.',
    '.oWWWWoGGoWWWWo.',
    '.owwwwwoowwwwwo.',
    '.owwwwwwwwwwwwo.',
    '.oWWWWWWWWWWWWo.',
    '.oggggggggggggo.',
    '..oooooooooooo..',
    '................'
  ], [
    '................',
    '..oooooooooooo..',
    '.oWWWWWWWWWWWWo.',
    '.oddddddddddddo.',
    '.oggggggggggggo.',
    '.oddyydyyydyddo.',
    '.oggggggggggggo.',
    '.owwwwwoowwwwwo.',
    '.owwwwoggowwwwo.',
    '.oWWWWoGGoWWWWo.',
    '.owwwwwoowwwwwo.',
    '.owwwwwwwwwwwwo.',
    '.oWWWWWWWWWWWWo.',
    '.oggggggggggggo.',
    '..oooooooooooo..',
    '................'
  ]]
};
export const CHEST_PALETTES = {
  wood: { o: OUTLINE, w: '#9a6236', W: '#6a3f22', g: '#c9a04a', G: '#8a6a2a', d: '#2a1a14', y: '#ffe08a' },
  gold: { o: OUTLINE, w: '#e0b040', W: '#a6781e', g: '#fff2b0', G: '#c8a050', d: '#3a2410', y: '#ffffff' },
  cursed: { o: OUTLINE, w: '#5a3d78', W: '#3a2550', g: '#9be07a', G: '#5a9a4a', d: '#1a1020', y: '#c8ff9a' },
  mimic: { o: OUTLINE, w: '#9a6236', W: '#6a3f22', g: '#ffffff', G: '#c04040', d: '#c02838', y: '#ffffff' }
};

export const FOUNTAIN = {
  w: 16, h: 16,
  frames: [[
    '................',
    '......oooo......',
    '.....osSSso.....',
    '......oblo......',
    '.....olbbbo.....',
    '......osso......',
    '......osSo......',
    '...oooosSoooo...',
    '..osssssssssSo..',
    '.osbbblbbbbbbSo.',
    '.osblbbbbblbbSo.',
    '.oSsbbbbbbbbsSo.',
    '..oSSsssssssSo..',
    '...oSSSSSSSSo...',
    '....oooooooo....',
    '................'
  ], [
    '................',
    '......oooo......',
    '.....osSSso.....',
    '......olbo......',
    '.....obblbo.....',
    '......osso......',
    '......osSo......',
    '...oooosSoooo...',
    '..osssssssssSo..',
    '.osbbbbbblbbbSo.',
    '.osbbblbbbbblSo.',
    '.oSsbbbbbbbbsSo.',
    '..oSSsssssssSo..',
    '...oSSSSSSSSo...',
    '....oooooooo....',
    '................'
  ]]
};
export const FOUNTAIN_PALETTE = { o: OUTLINE, s: '#9fa2a0', S: '#666a68', b: '#3f8ad0', l: '#bfe6ff' };
export const FOUNTAIN_DRY = { o: OUTLINE, s: '#8a8c8a', S: '#565a58', b: '#3a3438', l: '#4a4248' };

export const ALTAR = {
  w: 16, h: 16,
  frames: [[
    '................',
    '.......oo.......',
    '......orro......',
    '.....orRrro.....',
    '.....orrRro.....',
    '......orro......',
    '.......oo.......',
    '................',
    '..oooooooooooo..',
    '.osssssssssssSo.',
    '.oSSSSSSSSSSSSo.',
    '...osrsssrsSo...',
    '...ossssssssSo..',
    '..osssssssssSSo.',
    '..ooooooooooooo.',
    '................'
  ]]
};
export const ALTAR_PALETTES = {
  blood: { o: OUTLINE, s: '#7d7880', S: '#4b4650', r: '#e0404a', R: '#ffb0a0' },
  wish: { o: OUTLINE, s: '#8a8f9a', S: '#535866', r: '#4ab0e0', R: '#d8f4ff' },
  spent: { o: OUTLINE, s: '#5a5660', S: '#36323a', r: '#3a3440', R: '#4a4450' }
};

export const TORCH = {
  w: 8, h: 12,
  frames: [
    ['...y....', '..yfy...', '..yfy...', '.yfwfy..', '.yfwfy..', '.rffffr.', '..rffr..', '..omMo..', '...mo...', '...mo...', '...oo...', '........'],
    ['....y...', '...yf...', '..yffy..', '.yfwwfy.', '.yfwfy..', '.rfffr..', '..rffr..', '..omMo..', '...mo...', '...mo...', '...oo...', '........'],
    ['..y.....', '..yf....', '.yffy...', '.yfwfy..', '.yfwwfy.', '.rffffr.', '..rffr..', '..omMo..', '...mo...', '...mo...', '...oo...', '........']
  ]
};
export const TORCH_PALETTE = { o: OUTLINE, y: '#d6ffb0', f: '#7cff8a', r: '#2f9a4a', w: '#ffffff', m: '#6a5a4a', M: '#a08a6a' };

export const COIN = {
  w: 8, h: 8,
  frames: [['..oooo..', '.oyyyYo.', 'oyywyyYo', 'oywyyyYo', 'oyyyyyYo', 'oyyyyYYo', '.oYYYYo.', '..oooo..']]
};
export const COIN_PALETTE = { o: OUTLINE, y: '#ffd24a', Y: '#c8901e', w: '#fff6c8' };
export const HEART = {
  w: 8, h: 8,
  frames: [['.oo.oo..', 'orrorro.', 'orwrrro.', 'orrrrro.', '.orrro..', '..oro...', '...o....', '........']]
};
export const HEART_PALETTE = { o: OUTLINE, r: '#e8404a', w: '#ffc0c0' };
export const SHARD = {
  w: 8, h: 8,
  frames: [['...o....', '..olo...', '..oldo..', '.olcdo..', '.occdo..', '..ocdo..', '..odo...', '...o....']]
};
export const SHARD_PALETTE = { o: OUTLINE, l: '#e8fbff', c: '#62d6ff', d: '#2a78b8' };

export const NOTE = {
  w: 12, h: 12,
  frames: [['............', '..oooooooo..', '..olllllldo.', '..olddddldo.', '..ollllllo..', '..olddddlo..', '..ollllllo..', '..olddldlo..', '..ollllllo..', '.olllllldo..', '.oooooooo...', '............']]
};
export const NOTE_PALETTE = { o: OUTLINE, l: '#efe1b8', d: '#a08a62' };

// ---------- Иконки предметов 12×12 ----------
export const ICONS = {
  sword: ['..........oo', '.........olo', '........olmo', '.......olmo.', '......olmo..', '.....olmo...', '.oo.olmo....', '.oaoomo.....', '..oaao......', '..odaao.....', '.odo.oao....', '.oo...oo....'],
  dagger: ['............', '............', '............', '........oo..', '.......olo..', '......olmo..', '.....olmo...', '..o.olmo....', '..oaomo.....', '...oao......', '..odoao.....', '..oo..o.....'],
  staff: ['........ooo.', '.......oalao', '.......oaaao', '........ooo.', '........odo.', '.......odo..', '......odo...', '.....odo....', '....odo.....', '...odo......', '..odo.......', '..oo........'],
  ring: ['............', '.....oo.....', '....oaao....', '.....oo.....', '...oommoo...', '..olmoomdo..', '..omo..odo..', '..omo..odo..', '..omdoomdo..', '...oddddo...', '....oooo....', '............'],
  amulet: ['..o......o..', '..o......o..', '...o....o...', '...o....o...', '....o..o....', '....oooo....', '...ommmmo...', '..omlaamdo..', '..omaaaado..', '...omaado...', '....omdo....', '.....oo.....'],
  potion: ['....oooo....', '....oddo....', '....oooo....', '.....olo....', '....olmmo...', '...olmmmmo..', '..olammmmmo.', '..olmmmmmdo.', '..ommmmmmdo.', '..ommmmmddo.', '...odddddo..', '....ooooo...'],
  boots: ['............', '..oooo......', '..omlo......', '..omlo......', '..ommo......', '..oaao......', '..ommo......', '..ommmoo....', '..ommmmmo...', '..ommmmmmo..', '..odddddddo.', '..ooooooooo.'],
  shield: ['.oooooooooo.', '.ommmammmdo.', '.olmmammmdo.', '.olmmammmdo.', '.oaaaaaaaao.', '.olmmammmdo.', '..ommammdo..', '..ommammdo..', '...omamdo...', '...omado....', '....odo.....', '.....o......'],
  armor: ['............', '..oo....oo..', '.olmo..omdo.', '.olmmoommdo.', '.olmmmmmmdo.', '..olmaamdo..', '..olmaamdo..', '..olmmmmdo..', '..oaaaaaao..', '..olmmmmdo..', '..ommmmmdo..', '..oooooooo..'],
  book: ['............', '.oooooooooo.', '.ommmmmmmlo.', '.ommaaammlo.', '.omammmamlo.', '.ommaaammlo.', '.ommmmmmmlo.', '.ommmmmmmlo.', '.ommmmmmmlo.', '.oddddddddo.', '.ollllllllo.', '.oooooooooo.'],
  gem: ['............', '............', '...oooooo...', '..ollmmmdo..', '.ollmmmmmdo.', '.oooooooooo.', '..olmmmmdo..', '...olmmdo...', '....omdo....', '.....oo.....', '............', '............'],
  skull: ['............', '...oooooo...', '..ollmmmdo..', '.olmmmmmmdo.', '.omddmmddmo.', '.omddmmddmo.', '.ommmddmmmo.', '..ommmmmmo..', '...omdmdo...', '...oooooo...', '............', '............'],
  feather: ['..........o.', '.........olo', '........olmo', '.......olmo.', '......olmmo.', '.....olmmo..', '....olmmo...', '...olmmo....', '...ommo.....', '..odoo......', '.odo........', '.oo.........'],
  eye: ['............', '............', '............', '....oooo....', '..oolmmmoo..', '.olmaaaamdo.', '.olmaooamdo.', '.olmaaaamdo.', '..oommmmoo..', '....oooo....', '............', '............'],
  orb: ['............', '....oooo....', '..oollmmoo..', '.olllmmmmdo.', '.ollmmmmmdo.', 'olmmmammmmdo', 'ommmaaammmdo', 'ommmmammmddo', '.ommmmmmddo.', '.oddmmmmddo.', '..ooddddoo..', '....oooo....'],
  heart: ['............', '..ooo..ooo..', '.ollmoommmo.', '.olmmmmmmmo.', '.ommmmmmmdo.', '.ommmmmmmdo.', '..ommmmmdo..', '...ommmdo...', '....omdo....', '.....oo.....', '............', '............'],
  crown: ['............', '............', '..o..oo..o..', '.oao.oao.oao', '.omo.omo.omo', '.ommmmmmmmmo', '.omammammamo', '.ommmmmmmmdo', '.odddddddddo', '.ooooooooooo', '............', '............'],
  hourglass: ['.oooooooooo.', '.oddddddddo.', '..olllllo...', '..ommmmmo...', '...ommmo....', '....oao.....', '....oao.....', '...olaao....', '..olaaaao...', '..ommmmmo...', '.oddddddddo.', '.oooooooooo.']
};
