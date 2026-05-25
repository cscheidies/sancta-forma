// engine.js — Sancta Forma v3. Pure game logic. No DOM. Works in Node and browser.
// Rules source: RULES.md (authoritative). Python solver: solver.py.
//
// Hunter death pairings (from RULES.md §5):
//   Hexagon → kills Circle      (Square, Triangle absorb for -3 + costume)
//   Moon    → kills Square, Triangle  (Circle absorbs for -3 + costume)
//   Star    → kills Circle, Square    (Triangle absorbs for -3 + costume)

// ── Scoring & corruption per RULES.md §4 ─────────────────────────────────────
// Same element:       +10, cleanse (corruption → 0)
// Safe transit:       0,   no corruption  (Square ↔ Triangle, flat-flat partners)
// Curve-mismatch:     +3,  +1 corruption  (any other cross-element)
// Hunter absorbed:    -3,  no corruption change, costumed
// Hunter (death):     instant loss — blocked in getValidMoves

export const RULES = {
  square: {
    deathAt:        3,          // dies at corruption 3 (budget = 2)
    corruptionName: 'Curves',
    maxCorruption:  2,
    hunters: {
      hexagon: 'costume',   // Square absorbs hexagon → -3, costumed
      moon:    'death',     // Moon kills Square
      star:    'death',     // Star kills Square
    },
  },
  circle: {
    deathAt:        2,          // dies at corruption 2 (budget = 1)
    corruptionName: 'Straights',
    maxCorruption:  1,
    hunters: {
      hexagon: 'death',     // Hexagon kills Circle
      moon:    'costume',   // Circle absorbs moon → -3, costumed
      star:    'death',     // Star kills Circle
    },
  },
  triangle: {
    deathAt:        2,          // dies at corruption 2 (budget = 1)
    corruptionName: 'Curves',
    maxCorruption:  1,
    hunters: {
      hexagon: 'costume',   // Triangle absorbs hexagon → -3, costumed
      moon:    'death',     // Moon kills Triangle
      star:    'costume',   // Triangle absorbs star → -3, costumed
    },
  },
};

// Sacred shape absorb table — (player, target) → { score, corruptionDelta }
// corruptionDelta 'cleanse' = reset to 0; number = add to current
const ABSORB = {
  square: {
    square:   { score: 10, corruptionDelta: 'cleanse' },
    circle:   { score:  3, corruptionDelta: 1 },
    triangle: { score:  0, corruptionDelta: 0 },  // safe transit
  },
  circle: {
    circle:   { score: 10, corruptionDelta: 'cleanse' },
    square:   { score:  3, corruptionDelta: 1 },
    triangle: { score:  3, corruptionDelta: 1 },
  },
  triangle: {
    triangle: { score: 10, corruptionDelta: 'cleanse' },
    circle:   { score:  3, corruptionDelta: 1 },
    square:   { score:  0, corruptionDelta: 0 },  // safe transit
  },
};

export const HUNTERS = new Set(['hexagon', 'moon', 'star']);
export const SACRED  = new Set(['square', 'circle', 'triangle']);

export const DIRS     = { U: [-1, 0], D: [1, 0], L: [0, -1], R: [0, 1] };
export const DIR_KEYS = ['U', 'D', 'L', 'R'];

// ── State initialisation ──────────────────────────────────────────────────────
export function initState(level) {
  const grid = level.grid.map(row =>
    row.map(cell => (cell ? { type: cell } : null))
  );
  grid[level.playerStart[0]][level.playerStart[1]] = null;
  return {
    player: {
      element:         level.playerElement,
      originalElement: level.playerElement,
      corruption:      0,
      position:        [...level.playerStart],
      score:           0,
      costumed:        false,  // true after absorbing a survivable hunter
    },
    grid,
    winScore:  level.winScore ?? 50,
    status:    'playing',
    lastEvent: null,
  };
}

// ── Valid move filter ─────────────────────────────────────────────────────────
export function getValidMoves(state) {
  if (state.status !== 'playing') return [];
  const [r, c] = state.player.position;
  const { element, costumed } = state.player;

  return DIR_KEYS.filter(dir => {
    const [dr, dc] = DIRS[dir];
    const nr = r + dr, nc = c + dc;
    if (nr < 0 || nr >= 5 || nc < 0 || nc >= 5) return false;
    const cell = state.grid[nr][nc];
    if (!cell) return false;

    const t = cell.type;

    // Costumed: ONLY the player's base element is legal
    if (costumed) return t === element;

    // Hunters: check death vs costume
    if (HUNTERS.has(t)) {
      return RULES[element].hunters[t] === 'costume'; // death hunters are illegal
    }

    return true; // sacred shapes always legal (when not costumed)
  });
}

// ── Apply one move ────────────────────────────────────────────────────────────
export function applyMove(state, dir) {
  if (state.status !== 'playing') return state;
  const validMoves = getValidMoves(state);
  if (!validMoves.includes(dir)) return state;

  const [dr, dc] = DIRS[dir];
  const [r, c]   = state.player.position;
  const nr = r + dr, nc = c + dc;

  const absorbedType = state.grid[nr][nc].type;
  const { element, originalElement, corruption, score, costumed } = state.player;

  const newGrid = state.grid.map(row => row.map(cell => cell ? { type: cell.type } : null));
  newGrid[nr][nc] = null;

  let scoreDelta, newCorruption, newCostumed, absorbType;

  // ── 1. COSTUMED MANDATORY CLEANSE ────────────────────────────────────────
  if (costumed) {
    // Only same-element move is legal (enforced above).
    // Per RULES §5.2: scores 0 (not +10), resets corruption to 0.
    scoreDelta    = 0;
    newCorruption = 0;
    newCostumed   = false;
    absorbType    = 'cleanse';

  // ── 2. HUNTER ABSORPTION → COSTUME ───────────────────────────────────────
  } else if (HUNTERS.has(absorbedType)) {
    // Death hunters already blocked in getValidMoves; this is survivable.
    scoreDelta    = -3;
    newCorruption = corruption; // hunter absorption doesn't change corruption
    newCostumed   = true;
    absorbType    = 'costume';

  // ── 3. SACRED SHAPE ABSORPTION ───────────────────────────────────────────
  } else {
    const rule = ABSORB[element][absorbedType];
    scoreDelta    = rule.score;
    newCorruption = rule.corruptionDelta === 'cleanse' ? 0 : corruption + rule.corruptionDelta;
    newCostumed   = false;
    absorbType    = absorbedType === element            ? 'same'
                  : rule.score === 0                   ? 'safe'
                  : 'cross';
  }

  const newScore  = score + scoreDelta;
  const newPlayer = {
    ...state.player,
    position:   [nr, nc],
    score:      newScore,
    corruption: newCorruption,
    costumed:   newCostumed,
  };

  const event = {
    dir, absorbed: absorbedType, type: absorbType,
    scoreDelta, corruptionDelta: newCorruption - corruption,
    newScore, newCorruption, costumed: newCostumed,
  };

  const newState = { ...state, player: newPlayer, grid: newGrid, lastEvent: event };

  if (newScore >= newState.winScore && !newCostumed)    return { ...newState, status: 'win' };
  if (newCorruption >= RULES[element].deathAt)          return { ...newState, status: 'lose-death' };
  if (getValidMoves(newState).length === 0)             return { ...newState, status: 'lose-stuck' };

  return newState;
}

export function cloneState(state) {
  return {
    ...state,
    player:    { ...state.player, position: [...state.player.position] },
    grid:      state.grid.map(row => row.map(cell => cell ? { type: cell.type } : null)),
    lastEvent: state.lastEvent ? { ...state.lastEvent } : null,
  };
}

// Backwards-compat export (renderer uses this to colour hexagon cells)
export const HEXAGON_ELEMENTS = new Set(['hexagon', 'moon', 'star']);
