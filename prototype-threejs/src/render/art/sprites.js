// 인물·소품 스프라이트. 문자 격자로 그린다(문자 → 팔레트 색). Godot에서도 같은 격자를 Image로 옮기기 쉽다.
import { P } from '../palette.js';
import { PixelCanvas } from '../pixel.js';

const LEGEND = {
  k: P.ink, K: P.night, w: P.white, m: P.mist, s: P.skin, d: P.skinD,
  b: P.indigo, B: P.indigoL, l: P.straw, L: P.strawL, n: P.wood, N: P.woodL, o: P.woodD,
  t: P.slate, T: P.stone, g: P.straw, r: P.red, R: P.redL, e: P.steel, E: P.steelL, h: P.steelH,
  q: P.earth, Q: P.earthL, y: P.yellow, O: P.orange, G: P.grass, H: P.grassL, F: P.leaf,
  z: P.stoneL, x: P.steelD, p: P.paperD, P: P.paper, a: P.sand, v: P.grassD,
};

export function fromGrid(rows, legend = LEGEND, flip = false) {
  const h = rows.length; const w = Math.max(...rows.map((r) => r.length));
  const pc = new PixelCanvas(w, h);
  rows.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      const ch = row[x];
      if (ch === '.' || ch === ' ') continue;
      const c = legend[ch];
      if (c) pc.px(flip ? w - 1 - x : x, y, c);
    }
  });
  return pc;
}

// ── 도공 (오른쪽을 본다) ─────────────────────
const SMITH_TOP = [
  '.....kk.....',
  '....kkkk....',
  '...kkkkkk...',
  '...wwwwwwww.',
  '...kkssss...',
  '...kssksd...',
  '....sssss...',
  '.....ss.....',
  '.nnnbbbbb...',
  'nNNnbbBbbb..',
  'nNNnbbBbbs..',
  'nnnnbbbbb...',
  '.nnnllllll..',
  '...nbbbbb...',
  '....bbbbb...',
];
export const SMITH_FRAMES = [
  [...SMITH_TOP,
    '....bb.bb...',
    '...bb...bb..',
    '...tt...tt..',
    '..tt.....tt.',
    '..gg.....gg.'],
  [...SMITH_TOP,
    '....bbbbb...',
    '....bb.bb...',
    '....tt.tt...',
    '....tt.tt...',
    '...ggg.gg...'],
];
export const SMITH_SIT = [
  '............',
  '.....kk.....',
  '....kkkk....',
  '...kkkkkk...',
  '...wwwwwwww.',
  '...kkssss...',
  '...kssksd...',
  '....sssss...',
  '.....ss.....',
  '....bbbbb...',
  '...bbbBbbb..',
  '...bbbBbbs..',
  '...bbbbbb...',
  '...llllll...',
  '..bbbbbbbbb.',
  '..tttttttgg.',
  '..ttttttt...',
];

// ── 벤케이 (거구의 승병) ──────────────────────
export const BENKEI = [
  '..............e.',
  '.............eEe',
  '.............eEe',
  '.....mmmmm...eE.',
  '....mmmmmmm...o.',
  '...mmmssssmm..o.',
  '...mmskksksm..o.',
  '...mmssssssm..o.',
  '....mssrrssm..o.',
  '....mmssssmm..o.',
  '..KKKkkmmkkKKKo.',
  '.KKkkkkmmkkkkKos',
  'KKkkkkrkkkkkkKo.',
  'KkkkkkkrkkkkkKo.',
  'Kkkkkkkkrkkkk.o.',
  'skkkkkkkkrkkk.o.',
  '.kkkkkkkkkkkk.o.',
  '.kkkkwwwwwkkk.o.',
  '.kkkkkkkkkkkk.o.',
  '..kkkkkkkkkk..o.',
  '..kkkkkkkkkk..o.',
  '..kkkk..kkkk..o.',
  '..ssss..ssss..o.',
  '..ssk....ssk..o.',
  '.llll....llll.o.',
];

export const TRAVELER = [
  '......l.....',
  '.....lLl....',
  '....lLLLl...',
  '...lLLLLLl..',
  '..lllllllll.',
  '....ssss....',
  '....sksk....',
  '.....ss.....',
  '...ppppppp..',
  '..ppPpppppp.',
  '..pppPppps..',
  '..ppppppp.n.',
  '..ppppppp.n.',
  '...ppppp..n.',
  '...pp.pp..n.',
  '...tt.tt..n.',
  '..gg..gg....',
];

export const MERCHANT = [
  '.NNNNNNN......',
  '.NnnnnnN......',
  '.NnRnnnN......',
  '.NnnnnnNkk....',
  '.NnnnnnNkkk...',
  '.NNNNNNNsss...',
  '.NnnnnnNksk...',
  '.NnnnnnN.s....',
  '.NNNNNNNTTT...',
  '...TTTTTTTTs..',
  '...TTTTTTTT...',
  '...TTlllTTT...',
  '....TTTTTT....',
  '....TT..TT....',
  '....tt..tt....',
  '...gg..gg.....',
];

export const BANDIT = [
  '.....kk......',
  '....kkkk.....',
  '...rrrrrrr...',
  '...kssss.....',
  '...kskskd....',
  '....ssss.....',
  '...QQQQQ...E.',
  '..QqQQQQQ.E..',
  '..QqQQQQssE..',
  '..qQQQQQ.e...',
  '...QkkkkQ....',
  '...QQQQQ.....',
  '...QQ.QQ.....',
  '...ss..ss....',
  '..ss....ss...',
  '..gg....gg...',
];

// 도장 문하생 (흰 도복, 남색 하카마, 목검)
export const PUPIL = [
  '.....kk......',
  '....kkkk.....',
  '....ssss.....',
  '....sksk.....',
  '.....ss......',
  '...wwwwww....',
  '..wwmwwwwn...',
  '..wwwmwwsn...',
  '..wwwwww.n...',
  '...bbbbbbn...',
  '...bbbbbb....',
  '..bbbbbbbb...',
  '..bbbbbbbb...',
  '..bbb..bbb...',
  '..bb....bb...',
  '..ss....ss...',
  '.gg....gg....',
];

// 떠돌이 낭인 (삿갓, 해진 회색 옷, 허리의 칼)
export const RONIN = [
  '....llll.....',
  '..lLLLLLLl...',
  '.llllllllll..',
  '....kssk.....',
  '....ssss.....',
  '.....ss......',
  '...tTTTTt....',
  '..tTTkTTTt...',
  '..tTTTkTTs...',
  '..tTTTTTxeeh.',
  '...kkkkkk....',
  '...tTTTTt....',
  '...tTTTTt....',
  '...tt..tt....',
  '...ss..ss....',
  '..gg..gg.....',
];

export const WOLF = [
  '...............',
  '.TT............',
  'TzTT...........',
  'TkTTTT.........',
  'TTTTTTTTTTTT...',
  '..TTTTTTTTTTTz.',
  '...TTzTTTTTTTzT',
  '...TTzzzzTTT..z',
  '...TT.TT.TT.TT.',
  '...tt.tt.tt.tt.',
];

export const SACK = [
  '...o.o....',
  '..kkokk...',
  '.kKKKKKk..',
  'kKKkKKKKk.',
  'kKKKKkKKk.',
  'kKkKKKKKk.',
  '.kkkkkkk..',
  'k.k..k..k.',
];

export const BERRIES = [
  '.....vvv........',
  '...vvGGGvv..v...',
  '..vGGRGGGGv.Gv..',
  '.vGGGGGRGGGvGGv.',
  'vGRGGGGGGGRGGGGv',
  'vGGGGRGGGGGGGRGv',
  '.vGGGGGGGRGGGGv.',
  '..vvGGGGGGGGvv..',
  '....vvvqqvvv....',
];

export const SAND = [
  '....xxxxxxxx......',
  '..xxkxkkxxkxxx....',
  '.xkkhkkkkkhkkxx...',
  'xkkkkkkhkkkkkkkx..',
  '.xxkkkkkkkkhkxxx..',
  '...xxxxxkkxxx.....',
];

export const ROCKS = [
  '.........TTT..........',
  '.......TTzzTT.........',
  '..TTT.TzzzzzTT...TT...',
  '.TzzTTTzzzzTTTT.TzzT..',
  'TzzzzTTTzzTTTzTTTzzzT.',
  'TTzzTTTTTTTTTTzTTTzTTT',
  'tTTTTtTTTTtTTTTTtTTTTt',
];

// 모닥불 2프레임
export const CAMPFIRE = [
  [
    '....y.....',
    '...yOy....',
    '...yOOy...',
    '..yOROy...',
    '..OROROy..',
    '.oNoNoNo..',
    'oNoNoNoNo.',
  ],
  [
    '.....y....',
    '....yOy...',
    '...yOOy...',
    '...yOROy..',
    '..yOROROy.',
    '.oNoNoNo..',
    'oNoNoNoNo.',
  ],
];

// 망치 (자루 끝이 손잡이, 머리가 위)
export const HAMMER = [
  '.xeeeeex',
  '.xEEEEEx',
  '.xeeeeex',
  '...nn...',
  '...nN...',
  '...nN...',
  '...nN...',
  '...nN...',
  '...nN...',
  '...oo...',
];

export const ART = {
  traveler: TRAVELER, merchant: MERCHANT, bandit: BANDIT, wolf: WOLF,
  charcoal: SACK, berries: BERRIES, sand: SAND, rockfall: ROCKS, benkei: BENKEI,
  pupil: PUPIL, ronin: RONIN,
};
// 사람 그림은 오른쪽을 본다 (늑대만 왼쪽)
export const FACES_LEFT = new Set(['wolf']);
