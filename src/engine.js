// engine.js — Pure game logic. No DOM. Works in Node and browser.
// Narrative: the three pure forms (circle, square, triangle) vs the three hunters
// (moon hunts circle, hexagon hunts square, star hunts triangle)

export const RULES = {
  square: {
    nemesis: 'hexagon',
    absorb: {
      square:   { score: 10, corruptionDelta: -1 },
      circle:   { score:  3, corruptionDelta:  1 },
      triangle: { score:  0, corruptionDelta:  0 }, // safe transit
      hexagon:  { score:  8, corruptionDelta:  2 }, // nemesis — dangerous but rewarding
      star:     { score:  3, corruptionDelta:  1 },
      moon:     { score:  3, corruptionDelta:  1 },
    },
    deathAt: 3,
    corruptionName: 'Curves',
    maxCorruption: 2,
  },
  circle: {
    nemesis: 'moon',
    absorb: {
      circle:   { score: 10, corruptionDelta: -1 },
      square:   { score:  3, corruptionDelta:  1 },
      triangle: { score:  3, corruptionDelta:  1 },
      hexagon:  { score:  3, corruptionDelta:  1 },
      star:     { score:  3, corruptionDelta:  1 },
      moon:     { score:  8, corruptionDelta:  2 }, // nemesis — instant death
    },
    deathAt: 2,
    corruptionName: 'Straights',
    maxCorruption: 1,
  },
  triangle: {
    nemesis: 'star',
    absorb: {
      triangle: { score: 10, corruptionDelta: -1 },
      circle:   { score:  3, corruptionDelta:  1 },
      square:   { score:  0, corruptionDelta:  0 }, // safe transit
      hexagon:  { score:  3, corruptionDelta:  1 },
      star:     { score:  8, corruptionDelta:  2 }, // nemesis — instant death
      moon:     { score:  3, corruptionDelta:  1 },
    },
    deathAt: 2,
    corruptionName: 'Curves',
    maxCorruption: 1,
  },
};

export const DIRS = { U: [-1, 0], D: [1, 0], L: [0, -1], R: [0, 1] };
export const DIR_KEYS = ['U', 'D', 'L', 'R'];

export function initState(level) {
  const grid = level.grid.map(row =>
    row.map(cell => (cell ? { type: cell } : null))
  );
  // Player's starting cell is cleared — levels can now fill all 25 cells
  grid[level.playerStart[0]][level.playerStart[1]] = null;
  return {
    player: {
      element: level.playerElement,
      originalElement: level.playerElement,
      corruption: 0,
      position: [...level.playerStart],
      score: 0,
      transformed: false,  // true after absorbing a transit cell — must absorb original type next
    },
    grid,
    winScore: level.winScore ?? 50,
    status: 'playing',
    lastEvent: null,
  };
}

export function getValidMoves(state) {
  if (state.status !== 'playing') return [];
  const [r, c] = state.player.position;
  return DIR_KEYS.filter(dir => {
    const [dr, dc] = DIRS[dir];
    const nr = r + dr, nc = c + dc;
    if (nr < 0 || nr >= 5 || nc < 0 || nc >= 5) return false;
    const cell = state.grid[nr][nc];
    return cell !== null; // any non-empty cell is enterable; applyMove handles death
  });
}

export function applyMove(state, dir) {
  if (state.status !== 'playing') return state;
  const validMoves = getValidMoves(state);
  if (!validMoves.includes(dir)) return state;

  const [dr, dc] = DIRS[dir];
  const [r, c] = state.player.position;
  const nr = r + dr, nc = c + dc;

  const absorbedType = state.grid[nr][nc].type;
  const currentEl  = state.player.element;
  const originalEl = state.player.originalElement;

  // Transit pairs: square ↔ triangle (circle has no safe-transit)
  const TRANSIT_MAP = { square: 'triangle', triangle: 'square' };
  const transitTarget = TRANSIT_MAP[currentEl]; // what type transforms this player

  let rule, newElement, newTransformed, absorbType;

  if (state.player.transformed) {
    // ── TRANSFORMED STATE ────────────────────────────────────────────────
    if (absorbedType === currentEl) {
      // Absorbing same-as-current while transformed → instant death
      const newGrid2 = state.grid.map(row => row.map(c => c ? { type: c.type } : null));
      newGrid2[nr][nc] = null;
      const killPlayer = { ...state.player, position: [nr, nc] };
      const killEvent  = { dir, absorbed: absorbedType, type: 'nemesis', scoreDelta: 0, corruptionDelta: 0, newScore: state.player.score, newCorruption: state.player.corruption };
      return { ...state, player: killPlayer, grid: newGrid2, lastEvent: killEvent, status: 'lose-death' };
    } else if (absorbedType === originalEl) {
      // Absorbing original element while transformed → REVERT, award kin bonus
      rule         = RULES[originalEl].absorb[originalEl]; // kin rule (+10, -1 corr)
      newElement   = originalEl;
      newTransformed = false;
      absorbType   = 'same';
    } else {
      // Absorbing a cross/neutral cell — normal rules for current (transformed) element
      rule         = RULES[currentEl].absorb[absorbedType];
      newElement   = currentEl;
      newTransformed = true;
      absorbType   = RULES[currentEl].nemesis === absorbedType ? 'nemesis' : 'cross';
    }
  } else if (transitTarget && absorbedType === transitTarget) {
    // ── TRANSIT ABSORPTION → TRANSFORM ──────────────────────────────────
    rule         = { score: 0, corruptionDelta: 0 }; // no score or corruption for transit
    newElement   = transitTarget;
    newTransformed = true;
    absorbType   = 'transform';
  } else {
    // ── NORMAL ABSORPTION ────────────────────────────────────────────────
    rule         = RULES[currentEl].absorb[absorbedType];
    newElement   = currentEl;
    newTransformed = false;
    const isNemesis = RULES[currentEl].nemesis === absorbedType;
    absorbType   = absorbedType === currentEl ? 'same'
      : isNemesis ? 'nemesis'
      : rule.score === 0 && rule.corruptionDelta === 0 ? 'safe'
      : 'cross';
  }

  const newGrid = state.grid.map(row => row.map(cell => cell ? { type: cell.type } : null));
  newGrid[nr][nc] = null;

  const newScore      = state.player.score + rule.score;
  const newCorruption = Math.max(0, state.player.corruption + rule.corruptionDelta);

  const newPlayer = {
    ...state.player,
    element:     newElement,
    transformed: newTransformed,
    position:    [nr, nc],
    score:       newScore,
    corruption:  newCorruption,
  };

  const event = {
    dir, absorbed: absorbedType, type: absorbType,
    scoreDelta: rule.score, corruptionDelta: rule.corruptionDelta,
    newScore, newCorruption,
    transformed: newTransformed,
  };

  const newState = { ...state, player: newPlayer, grid: newGrid, lastEvent: event };

  if (newScore >= newState.winScore)                            return { ...newState, status: 'win' };
  if (newCorruption >= RULES[newElement].deathAt)              return { ...newState, status: 'lose-death' };
  if (getValidMoves(newState).length === 0)                    return { ...newState, status: 'lose-stuck' };

  return newState;
}

export function cloneState(state) {
  return {
    ...state,
    player: { ...state.player, position: [...state.player.position] },
    grid: state.grid.map(row => row.map(cell => cell ? { type: cell.type } : null)),
    lastEvent: state.lastEvent ? { ...state.lastEvent } : null,
  };
}
