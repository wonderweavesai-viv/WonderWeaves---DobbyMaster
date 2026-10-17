import { WeaveClass } from './formats';

/**
 * Work out what kind of weave a structure is. `structure[row][col]` is true where the warp is on top.
 * The result only has to be good enough for filtering a design library, so it uses the minimal repeat
 * and a few simple geometric tests.
 */

const rowKey = (r: boolean[]) => r.map(c => (c ? '1' : '0')).join('');

const minPeriod = (items: string[]): number => {
  const n = items.length;
  for (let p = 1; p <= n; p++) {
    if (n % p !== 0) continue;
    let ok = true;
    for (let i = p; i < n; i++) if (items[i] !== items[i - p]) { ok = false; break; }
    if (ok) return p;
  }
  return n;
};

export const minimalRepeat = (grid: boolean[][]): boolean[][] => {
  if (!grid.length || !grid[0].length) return grid;
  const rowsP = minPeriod(grid.map(rowKey));
  const cols = grid[0].length;
  const colKeys: string[] = [];
  for (let c = 0; c < cols; c++) colKeys.push(grid.map(r => (r[c] ? '1' : '0')).join(''));
  const colsP = minPeriod(colKeys);
  return grid.slice(0, rowsP).map(r => r.slice(0, colsP));
};

const shiftOf = (a: boolean[], b: boolean[]): number | null => {
  const n = a.length;
  for (let s = 0; s < n; s++) {
    let ok = true;
    for (let i = 0; i < n; i++) if (a[i] !== b[(i + s) % n]) { ok = false; break; }
    if (ok) return s;
  }
  return null;
};

export const classifyStructure = (structure: boolean[][]): WeaveClass => {
  if (!structure || !structure.length || !structure[0]?.length) return 'Dobby';
  const g = minimalRepeat(structure);
  const rows = g.length;
  const cols = g[0].length;

  // Plain: 2x2 checkerboard.
  if (rows === 2 && cols === 2 && g[0][0] !== g[0][1] && g[1][0] !== g[0][0]) return 'Plain';

  // Rib: only one direction repeats at 1 (all rows alike or all columns alike).
  if (rows === 1 || cols === 1) return 'Rib';

  const ups = g.map(r => r.filter(Boolean).length);

  // Satin: exactly one raised (or one sunk) interlacing per row and column, spread out.
  const oneUp = ups.every(u => u === 1);
  const oneDown = ups.every(u => u === cols - 1);
  if (rows >= 5 && cols >= 5 && (oneUp || oneDown)) {
    const pos = g.map(r => (oneUp ? r.findIndex(Boolean) : r.findIndex(c => !c)));
    const colsSeen = new Set(pos);
    if (colsSeen.size === rows) {
      const steps = pos.map((p, i) => (pos[(i + 1) % rows] - p + cols) % cols);
      const nonAdjacent = steps.every(s => s !== 1 && s !== cols - 1);
      if (nonAdjacent) return 'Satin';
    }
  }

  // Twill: every row is the previous row shifted by a constant step of 1 (either direction).
  const shifts = g.map((r, i) => shiftOf(r, g[(i + 1) % rows]));
  if (shifts.every(s => s !== null)) {
    const first = shifts[0] as number;
    const same = shifts.every(s => s === first);
    if (same && (first === 1 || first === cols - 1) && cols >= 3) return 'Twill';
  }
  // Broken and herringbone twills: each step is 1 either way.
  if (shifts.every(s => s === 1 || s === (cols - 1)) && cols >= 4 && rows >= 4) return 'Twill';

  // Basket: a plain weave drawn with blocks (each interlacing is a block of >1 threads).
  const blockR = rows >= 4 && g[0].join() === g[1].join();
  const blockC = cols >= 4 && g.every(r => r[0] === r[1]);
  if (blockR && blockC && ups.every(u => u === cols / 2)) return 'Basket';

  return 'Dobby';
};
