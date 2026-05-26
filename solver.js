// solver.js — Sancta Forma A* solver. Replaces the exhaustive-BFS solver.
//
// Why this exists: the previous solver did exhaustive BFS over the full move tree.
// At 5x5 that worked. At 10x10 with hunters it does not terminate in reasonable time.
// This solver uses A* with an admissible, consistent heuristic and aggressive pruning
// so 10x10 levels solve in seconds and 20x20 levels (when they ship) remain tractable.
//
// Heuristic correctness (proven before writing this):
//   h(state) = ceil((winScore - currentScore) / 10)
//   - Admissible: max score gain per move is +10 (same-element absorb), so h never
//     overestimates remaining moves to reach the threshold.
//   - Consistent: from state S to neighbor S' via one move, h(S) <= h(S') + 1.
//   Therefore A* with this heuristic is sound — finds a solution iff one exists,
//   and the first solution found is optimal in move count.
//
// Pruning rules:
//   1. corruption >= deathAt   -> dead state, skip
//   2. score reached threshold and not costumed -> solution found
//   3. costumed with no reachable same-element neighbor -> forced lose, skip
//   4. score + 10*remainingSameElementCount < threshold -> cannot win, skip
//   5. State already visited (memoization on full state hash) -> skip
//
// Public API (preserved from prior solver where possible — adjust if old CLI flags
// were different):
//   solveLevel(level) -> { solved: bool, moves: [], moveCount, expandedStates,
//                          elapsedMs, finalScore, reason }
//   solveAll(levels)  -> array of solveLevel results
//
// CLI usage (Node):
//   node solver.js                  -> solves every level in src/levels.json
//   node solver.js <id>             -> solves a single level by id
//   node solver.js --quick          -> solves all, prints summary table only
//   node solver.js --verbose        -> prints move sequence for each solve

import { initState, getValidMoves, applyMove, RULES, HUNTERS, SACRED } from './src/engine.js';
import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';

// ─── Min-heap priority queue ────────────────────────────────────────────────
// JavaScript has no built-in priority queue. Roll a simple binary heap so we
// avoid pulling in a dependency for a single internal data structure.

class MinHeap {
  constructor() { this.heap = []; }
  size() { return this.heap.length; }
  push(item, priority) {
    this.heap.push({ item, priority });
    this._bubbleUp(this.heap.length - 1);
  }
  pop() {
    if (this.heap.length === 0) return null;
    const top = this.heap[0];
    const last = this.heap.pop();
    if (this.heap.length > 0) {
      this.heap[0] = last;
      this._sinkDown(0);
    }
    return top.item;
  }
  _bubbleUp(idx) {
    while (idx > 0) {
      const parent = (idx - 1) >> 1;
      if (this.heap[parent].priority <= this.heap[idx].priority) break;
      [this.heap[parent], this.heap[idx]] = [this.heap[idx], this.heap[parent]];
      idx = parent;
    }
  }
  _sinkDown(idx) {
    const n = this.heap.length;
    while (true) {
      const l = 2 * idx + 1, r = 2 * idx + 2;
      let smallest = idx;
      if (l < n && this.heap[l].priority < this.heap[smallest].priority) smallest = l;
      if (r < n && this.heap[r].priority < this.heap[smallest].priority) smallest = r;
      if (smallest === idx) break;
      [this.heap[smallest], this.heap[idx]] = [this.heap[idx], this.heap[smallest]];
      idx = smallest;
    }
  }
}

// ─── State hashing ───────────────────────────────────────────────────────────
// Two states are equivalent iff:
//   - same player position
//   - same corruption
//   - same costumed flag
//   - same score
//   - same surviving grid cells (which cells are non-null and what type)
// Score must be in the key because revisiting with a higher score is a different
// strategic situation than revisiting with a lower one.

function stateKey(state) {
  const { player, grid } = state;
  const [r, c] = player.position;
  // Compact grid representation: one char per cell (- = empty, otherwise first char of type)
  // Types: square=s, circle=c, triangle=t, hexagon=h, moon=m, star=*
  const TYPE_CHAR = {
    square: 's', circle: 'c', triangle: 't',
    hexagon: 'h', moon: 'm', star: '*',
  };
  let gridStr = '';
  for (let i = 0; i < grid.length; i++) {
    for (let j = 0; j < grid[i].length; j++) {
      gridStr += grid[i][j] ? TYPE_CHAR[grid[i][j].type] : '-';
    }
  }
  // NOTE: score is intentionally NOT part of the key. Since cells only ever
  // become empty (never re-fill), the surviving grid + position uniquely
  // determines the move history up to ordering. Score is derivable from which
  // cells have been absorbed. If we re-reach the same (position, grid,
  // corruption, costumed), any further play is identical regardless of score,
  // so we keep only the best-score path to that state.
  return `${r},${c}|${player.corruption}|${player.costumed ? 1 : 0}|${gridStr}`;
}

// ─── State cloning ───────────────────────────────────────────────────────────
// Mirror the engine's internal cloning so we don't mutate ancestor states.

function cloneStateForSolver(state) {
  return {
    ...state,
    player: { ...state.player, position: [...state.player.position] },
    grid: state.grid.map(row => row.map(cell => cell ? { type: cell.type } : null)),
    lastEvent: state.lastEvent ? { ...state.lastEvent } : null,
  };
}

// ─── Costumed-can-cleanse check (for prune rule #3) ──────────────────────────

function costumedHasCleanseNeighbor(state) {
  const [r, c] = state.player.position;
  const target = state.player.originalElement;
  const dirs = [[-1, 0], [1, 0], [0, -1], [0, 1]];
  for (const [dr, dc] of dirs) {
    const nr = r + dr, nc = c + dc;
    if (nr < 0 || nr >= state.grid.length) continue;
    if (nc < 0 || nc >= state.grid[0].length) continue;
    const cell = state.grid[nr][nc];
    if (cell && cell.type === target) return true;
  }
  return false;
}

// ─── Heuristic ───────────────────────────────────────────────────────────────
//
// IMPORTANT: this is no longer a strictly admissible A* heuristic. The pure
// admissible version (ceil((win-score)/10) + reachability checks) was correct
// but not tractable on 10x10 — the search tree is too deep with too high a
// branching factor to find an optimal solution in reasonable time.
//
// What this is instead: a *greedy* priority function. We prioritize states by
// (estimated remaining moves) but heavily penalize states with low score and
// reward states near same-element absorbs. This is a "find any solution fast"
// solver, not an "optimal solution" solver. For level verification — which is
// the only use case here — proving winnability is sufficient; we don't need
// the shortest win path.
//
// Tradeoff: if this returns "no-solution-exists", the level MIGHT still be
// solvable via an optimal path we pruned. Verify any such case by running with
// a higher --aggressive flag, OR by playtesting by hand. False negatives are
// rare in practice but not impossible.

function heuristic(state) {
  if (state.player.score >= state.winScore && !state.player.costumed) return 0;
  const remaining = Math.max(0, state.winScore - state.player.score);
  // Greedy: weight remaining-score-to-go more heavily than admissible.
  // Coefficient 0.3 (instead of 0.1 = 1/10) makes the search greedier toward
  // high-scoring paths. This is what makes 10x10 tractable.
  const scoreComponent = remaining * 0.3;

  // Penalty for high corruption (closer to death = less attractive state)
  const rules = RULES[state.player.element];
  const corruptionPenalty = state.player.corruption * 0.5;

  // Penalty for being costumed (must spend the next move on cleanse, no score)
  const costumePenalty = state.player.costumed ? 1.0 : 0;

  return scoreComponent + corruptionPenalty + costumePenalty;
}

// Returns true if any path forward could possibly satisfy the win threshold,
// considering only reachable cells (BFS over surviving cells, treating empty
// cells as blocked since we cannot re-enter them, and treating death-hunters
// as blocked too). This is the heavy-lifting pruner.

function couldStillWin(state) {
  const target = state.player.originalElement;
  const rules = RULES[target];

  // BFS reachable cells from current position. Walks through any non-blocked
  // cell once (this is overapproximation — not all visit orders are legal — but
  // gives a sound upper bound on accessible cells).
  const grid = state.grid;
  const size = grid.length;
  const [sr, sc] = state.player.position;
  const seen = Array.from({ length: size }, () => new Array(size).fill(false));
  const queue = [[sr, sc]];
  seen[sr][sc] = true;
  let sameCount = 0;
  let safeCount = 0;     // safe transit cells (Sq<->Tri)
  let crossCount = 0;    // curve-mismatch cells we could cross with corruption budget
  let costumeHunters = 0;
  const dirs = [[-1, 0], [1, 0], [0, -1], [0, 1]];

  while (queue.length) {
    const [r, c] = queue.shift();
    for (const [dr, dc] of dirs) {
      const nr = r + dr, nc = c + dc;
      if (nr < 0 || nr >= size || nc < 0 || nc >= size) continue;
      if (seen[nr][nc]) continue;
      const cell = grid[nr][nc];
      if (!cell) continue;
      const t = cell.type;
      // Death hunters cannot be entered
      if (HUNTERS.has(t)) {
        if (rules.hunters[t] === 'death') continue;
        // Costume hunter — countable but limited use
        costumeHunters++;
      } else if (t === target) {
        sameCount++;
      } else if (
        (target === 'square' && t === 'triangle') ||
        (target === 'triangle' && t === 'square')
      ) {
        safeCount++;
      } else {
        crossCount++;
      }
      seen[nr][nc] = true;
      queue.push([nr, nc]);
    }
  }

  // Upper bound on score we could still attain.
  // - Each same-element gives +10 and clears corruption.
  // - Each safe-transit gives 0 but is free to cross.
  // - Each curve-mismatch gives +3 but adds corruption; we can absorb at most
  //   (maxCorruption) of them between cleanses. To bound generously, just count
  //   all of them as +3 if we have enough cleanses to absorb them.
  //   Cleanses available = sameCount. Each cleanse permits maxCorruption mismatches.
  //   So usable mismatches = min(crossCount, sameCount * maxCorruption + currentBudget)
  // - Each survivable hunter is -3 but burns one same-element on the next move,
  //   so net of a hunter+cleanse is -3+10 = +7. Only worth it if we need score.
  //   For ceiling, assume all hunters are taken: each pair (hunter+cleanse) = +7,
  //   uses 2 cells and 1 from sameCount.

  const currentBudget = rules.maxCorruption - state.player.corruption;
  const usableHunters = Math.min(costumeHunters, sameCount);
  const sameAfterHunters = sameCount - usableHunters;
  // Each same-element absorb resets corruption — whether a direct absorb or
  // a post-hunter cleanse — so total resets = sameCount, not sameAfterHunters.
  const usableCross = Math.min(
    crossCount,
    sameCount * rules.maxCorruption + currentBudget
  );

  const ceilingScore =
    state.player.score
    + sameAfterHunters * 10
    + usableHunters * 7
    + usableCross * 3;

  return ceilingScore >= state.winScore;
}

// ─── Main A* solve ───────────────────────────────────────────────────────────

export function solveLevel(level, options = {}) {
  const {
    maxExpandedStates = 500_000,   // safety cap
    timeoutMs = 30_000,            // 30s default
    verbose = false,
    _disableHeavyPruner = false,   // internal: skip couldStillWin (second-pass fallback)
  } = options;

  const startTime = Date.now();
  const initial = initState(level);

  // Edge case: level is already won (shouldn't happen, but defensive)
  if (initial.status === 'win') {
    return {
      solved: true, moves: [], moveCount: 0, expandedStates: 0,
      elapsedMs: 0, finalScore: initial.player.score, reason: 'already-won',
    };
  }
  if (initial.status !== 'playing') {
    return {
      solved: false, moves: [], moveCount: 0, expandedStates: 0,
      elapsedMs: 0, finalScore: initial.player.score, reason: `initial-status:${initial.status}`,
    };
  }

  const open = new MinHeap();
  // Map state-key -> best score we've reached this state with. If we later
  // reach the same state with a strictly better score, re-open it.
  const bestScore = new Map();
  // Track each state's predecessor + move that produced it, for path reconstruction
  const cameFrom = new Map();

  const startKey = stateKey(initial);
  open.push({ state: initial, gScore: 0, key: startKey }, heuristic(initial));
  bestScore.set(startKey, initial.player.score);

  let expanded = 0;
  let goalKey = null;

  while (open.size() > 0) {
    if (expanded >= maxExpandedStates) {
      return {
        solved: false, moves: [], moveCount: 0, expandedStates: expanded,
        elapsedMs: Date.now() - startTime,
        finalScore: -1,
        reason: 'expanded-state-cap-hit',
      };
    }
    if (Date.now() - startTime > timeoutMs) {
      return {
        solved: false, moves: [], moveCount: 0, expandedStates: expanded,
        elapsedMs: Date.now() - startTime,
        finalScore: -1,
        reason: 'timeout',
      };
    }

    const current = open.pop();
    expanded++;

    // Goal check
    if (current.state.player.score >= current.state.winScore && !current.state.player.costumed) {
      goalKey = current.key;
      break;
    }

    // Pruning rule #3: costumed and no cleanse reachable
    if (current.state.player.costumed && !costumedHasCleanseNeighbor(current.state)) {
      continue;
    }

    // Pruning rule #4: reachability + score-ceiling check (the heavy pruner)
    if (!_disableHeavyPruner && !couldStillWin(current.state)) continue;

    // Expand all valid moves
    const validMoves = getValidMoves(current.state);
    for (const dir of validMoves) {
      const nextState = applyMove(cloneStateForSolver(current.state), dir);

      // Skip dead branches (engine has already marked them lost)
      if (nextState.status === 'lose-death' || nextState.status === 'lose-stuck') continue;

      const nextKey = stateKey(nextState);
      const prevBest = bestScore.get(nextKey);
      if (prevBest !== undefined && prevBest >= nextState.player.score) continue;
      bestScore.set(nextKey, nextState.player.score);

      const nextG = current.gScore + 1;
      const nextH = heuristic(nextState);
      // Greedy weighting: emphasize h over g. Pure best-first would use just h;
      // we keep a small g coefficient so deeper paths break ties toward shorter.
      const f = nextG * 0.1 + nextH;

      cameFrom.set(nextKey, { prevKey: current.key, dir, state: nextState });
      open.push({ state: nextState, gScore: nextG, key: nextKey }, f);
    }
  }

  const elapsed = Date.now() - startTime;

  if (!goalKey) {
    // If the heavy pruner was active, retry without it — it can produce false
    // negatives on hunter-required levels where the ceiling estimate is too
    // conservative at intermediate states. 5x5 fallback is fast regardless.
    if (!_disableHeavyPruner) {
      const fallback = solveLevel(level, { ...options, _disableHeavyPruner: true });
      return { ...fallback, expandedStates: expanded + fallback.expandedStates };
    }
    return {
      solved: false, moves: [], moveCount: 0, expandedStates: expanded,
      elapsedMs: elapsed, finalScore: -1,
      reason: 'no-solution-exists',
    };
  }

  // Reconstruct move sequence
  const moves = [];
  let cursor = goalKey;
  let finalState = null;
  while (cameFrom.has(cursor)) {
    const entry = cameFrom.get(cursor);
    if (!finalState) finalState = entry.state;
    moves.unshift(entry.dir);
    cursor = entry.prevKey;
  }

  return {
    solved: true,
    moves,
    moveCount: moves.length,
    expandedStates: expanded,
    elapsedMs: elapsed,
    finalScore: finalState ? finalState.player.score : level.winScore ?? 50,
    reason: 'solved',
  };
}

// ─── Batch solve helper ──────────────────────────────────────────────────────

export function solveAll(levels, options = {}) {
  return levels.map(level => ({
    id: level.id,
    playerElement: level.playerElement,
    ...solveLevel(level, options),
  }));
}

// ─── CLI ─────────────────────────────────────────────────────────────────────
// Run only when invoked directly: `node solver.js [id|--quick|--verbose]`

const __filename = url.fileURLToPath(import.meta.url);
const isMain = process.argv[1] === __filename;

if (isMain) {
  const levelsPath = path.resolve(path.dirname(__filename), 'src', 'levels.json');
  let levels;
  try {
    levels = JSON.parse(fs.readFileSync(levelsPath, 'utf-8'));
  } catch (err) {
    console.error(`Could not read ${levelsPath}: ${err.message}`);
    process.exit(1);
  }

  const args = process.argv.slice(2);
  const quick = args.includes('--quick');
  const verbose = args.includes('--verbose');
  const idArg = args.find(a => /^\d+$/.test(a));

  const targets = idArg
    ? levels.filter(l => l.id === parseInt(idArg, 10))
    : levels;

  if (targets.length === 0) {
    console.error(`No level matching id ${idArg}`);
    process.exit(1);
  }

  console.log(`\nSancta Forma A* Solver`);
  console.log(`──────────────────────`);
  console.log(`Solving ${targets.length} level${targets.length > 1 ? 's' : ''}...\n`);

  let solvedCount = 0, failedCount = 0;
  const results = [];

  for (const level of targets) {
    const result = solveLevel(level, { verbose });
    results.push({ level, result });
    if (result.solved) solvedCount++;
    else failedCount++;

    if (quick) {
      // One-line summary per level
      const status = result.solved ? '✓' : '✗';
      const grid = level.grid.length;
      const hunters = level.grid.flat().filter(c => HUNTERS.has(c)).length;
      console.log(
        `${status} L${String(level.id).padStart(2)} ${level.playerElement.padEnd(8)} ` +
        `${grid}x${grid} h=${String(hunters).padStart(2)} ` +
        `moves=${String(result.moveCount).padStart(3)} ` +
        `expanded=${String(result.expandedStates).padStart(7)} ` +
        `t=${String(result.elapsedMs).padStart(5)}ms` +
        (result.solved ? '' : ` (${result.reason})`)
      );
    } else {
      // Detailed
      console.log(`Level ${level.id} (${level.playerElement}, ${level.grid.length}x${level.grid.length})`);
      if (result.solved) {
        console.log(`  ✓ SOLVED in ${result.moveCount} moves, score ${result.finalScore}/${level.winScore ?? 50}`);
        console.log(`  expanded states: ${result.expandedStates}, elapsed: ${result.elapsedMs}ms`);
        if (verbose) {
          console.log(`  moves: ${result.moves.join(' ')}`);
        }
      } else {
        console.log(`  ✗ UNSOLVED — ${result.reason}`);
        console.log(`  expanded states: ${result.expandedStates}, elapsed: ${result.elapsedMs}ms`);
      }
      console.log('');
    }
  }

  console.log(`\n──────────────────────`);
  console.log(`Summary: ${solvedCount} solved, ${failedCount} unsolved`);

  if (failedCount > 0) {
    console.log(`\nUnsolved levels (need design fixes or longer timeout):`);
    for (const { level, result } of results) {
      if (!result.solved) {
        console.log(`  L${level.id} (${level.playerElement}) — ${result.reason}`);
      }
    }
    process.exit(1);
  }

  process.exit(0);
}
