// Dados do mapa (sem dependência do Pixi, fácil de testar).
export interface Cell { id: number; fx?: boolean; fy?: boolean }
export type Layer = (Cell | null)[][];

export const TILE = 64;
export const COLS = 22;
export const ROWS = 14;

const blank = (): Layer => Array.from({ length: ROWS }, () => Array(COLS).fill(null));

// ---------------------------------------------------------------------------
// Ilha de grama. Os tiles 6-9 / 22-25 / 38-41 / 54-57 formam UMA imagem 4x4:
//   6   7   8   9      cantos e bordas em volta,
//   22  23  24  25     e o miolo 23 24 / 39 40 é um único pedaço de grama
//   38  39  40  41     (claro em cima, escuro embaixo).
//   54  55  56  57
// Para ilhas maiores que 4x4 o miolo é ESPELHADO (flip), assim as bordas de
// cada tile sempre encostam numa borda igual e não aparece emenda.
// Tamanhos válidos (largura e altura): 4, 8, 12, 16...
// ---------------------------------------------------------------------------
const BLOCK = [
  [6, 7, 8, 9],
  [22, 23, 24, 25],
  [38, 39, 40, 41],
  [54, 55, 56, 57],
];

// sequência do miolo: 1, 2, 2', 1', 1, 2, 2', 1' ... (' = espelhado)
const MIRROR: [number, boolean][] = [[1, false], [2, false], [2, true], [1, true]];
const mirrorSeq = (n: number) => Array.from({ length: n }, (_, i) => MIRROR[i % 4]);

function grassIsland(w: number, h: number): Cell[][] {
  if ((w - 2) % 4 !== 2 || (h - 2) % 4 !== 2) throw new Error('Tamanho da ilha deve ser 4, 8, 12, 16...');
  const cs = mirrorSeq(w - 2);
  const rs = mirrorSeq(h - 2);
  const out: Cell[][] = [];
  for (let r = 0; r < h; r++) {
    const row: Cell[] = [];
    for (let c = 0; c < w; c++) {
      const top = r === 0, bottom = r === h - 1, left = c === 0, right = c === w - 1;
      const srcRow = top ? 0 : bottom ? 3 : rs[r - 1][0];
      const srcCol = left ? 0 : right ? 3 : cs[c - 1][0];
      const fy = top || bottom ? false : rs[r - 1][1];
      const fx = left || right ? false : cs[c - 1][1];
      row.push({ id: BLOCK[srcRow][srcCol], fx, fy });
    }
    out.push(row);
  }
  return out;
}

// Ilha de areia: 1 2 3 / 17 18 19 / 33 34 35 (miolo 18 repetido)
function sandIsland(w: number, h: number): Cell[][] {
  const out: Cell[][] = [];
  for (let r = 0; r < h; r++) {
    const row: Cell[] = [];
    for (let c = 0; c < w; c++) {
      const t = r === 0, b = r === h - 1, l = c === 0, rt = c === w - 1;
      const id = t ? (l ? 1 : rt ? 3 : 2) : b ? (l ? 33 : rt ? 35 : 34) : l ? 17 : rt ? 19 : 18;
      row.push({ id });
    }
    out.push(row);
  }
  return out;
}

function stamp(layer: Layer, top: number, left: number, cells: Cell[][]) {
  cells.forEach((row, r) => row.forEach((cell, c) => { layer[top + r][left + c] = cell; }));
}

// Faixa de água rasa: retângulo 3x3 (10 11 12 / 26 27 28 / 42 43 44)
function shallowRect(layer: Layer, c0: number, r0: number, c1: number, r1: number) {
  for (let r = r0; r <= r1; r++) {
    for (let c = c0; c <= c1; c++) {
      const t = r === r0, b = r === r1, l = c === c0, rt = c === c1;
      const id = t ? (l ? 10 : rt ? 12 : 11) : b ? (l ? 42 : rt ? 44 : 43) : l ? 26 : rt ? 28 : 27;
      layer[r][c] = { id };
    }
  }
}

// Fortaleza 8x6 (par x par, centraliza num miolo par sem meio-tile)
//  77 16 16 47 47 16 16 78
//  15 .  .  .  .  .  .  15
//  31 .  .  .  .  .  .  32     (cannons 31 / 32 nas laterais)
//  31 .  .  .  .  .  .  32
//  15 .  .  .  .  .  .  15
//  93 16 16 76 76 16 16 94     (portão de 2 pontes)
function fortress(layer: Layer, top: number, left: number) {
  const F = [
    [77, 16, 16, 47, 47, 16, 16, 78],
    [15, 0, 0, 0, 0, 0, 0, 15],
    [31, 0, 0, 0, 0, 0, 0, 32],
    [31, 0, 0, 0, 0, 0, 0, 32],
    [15, 0, 0, 0, 0, 0, 0, 15],
    [93, 16, 16, 76, 76, 16, 16, 94],
  ];
  F.forEach((row, r) => row.forEach((id, c) => { if (id) layer[top + r][left + c] = { id }; }));
}

export interface MapData {
  layers: { name: string; data: Layer }[];
  solids: { x: number; y: number; w: number; h: number }[]; // em tiles
}

export function buildMapData(): MapData {
  const shallow = blank(), ground = blank(), fort = blank(), deco = blank();

  // Ilha principal: terra nas colunas 1..12 e linhas 1..12 (12x12, miolo 10x10)
  shallowRect(shallow, 0, 0, 13, 13);
  stamp(ground, 1, 1, grassIsland(12, 12));
  // Fortaleza 8x6 no centro do miolo: sobra 1 tile nas laterais e 2 em cima/embaixo
  fortress(fort, 4, 3);

  // Ilha pequena de areia: colunas 17..20, linhas 5..8 (4 tiles de mar entre as ilhas)
  shallowRect(shallow, 16, 4, 21, 9);
  stamp(ground, 5, 17, sandIsland(4, 4));

  const put = (r: number, c: number, id: number) => { deco[r][c] = { id }; };
  // pátio da fortaleza (simétrico)
  put(5, 4, 72); put(5, 9, 72); put(8, 4, 72); put(8, 9, 72);
  // grama ao redor da fortaleza
  put(3, 3, 65); put(10, 10, 67); put(3, 10, 71); put(10, 3, 70);
  // ilha pequena
  put(6, 18, 50); put(7, 19, 72);

  return {
    layers: [
      { name: 'shallow', data: shallow },
      { name: 'ground', data: ground },
      { name: 'fortress', data: fort },
      { name: 'decor', data: deco },
    ],
    solids: [
      { x: 1, y: 1, w: 12, h: 12 },
      { x: 17, y: 5, w: 4, h: 4 },
    ],
  };
}