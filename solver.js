#!/usr/bin/env node
// solver.js — Standalone BFS/DFS solver. Run: node solver.js src/levels.json [levelId]
// Returns JSON to stdout.

import { readFileSync } from 'fs';
import { initState, getValidMoves, applyMove, RULES } from './src/engine.js';

const MAX_PATHS = 100;

function solve(levelData) {
  const solutions = [];
  let nodesVisited = 0;

  function dfs(state, path) {
    nodesVisited++;
    // Grid is strictly shrinking — no cycles possible, no visited set needed.
    if (solutions.length >= MAX_PATHS) return;
    if (state.status === 'win') {
      solutions.push(path);
      return;
    }
    if (state.status !== 'playing') return;

    for (const dir of ['U', 'D', 'L', 'R']) {
      const moves = getValidMoves(state);
      if (!moves.includes(dir)) continue;
      const next = applyMove(state, dir);
      dfs(next, path + dir);
    }
  }

  dfs(initState(levelData), '');

  const shortest = solutions.length
    ? solutions.reduce((a, b) => (a.length <= b.length ? a : b))
    : null;

  // corruptionForced: EVERY winning path has ≥1 absorption with corruptionDelta !== 0
  const corruptionForced = solutions.length > 0 && solutions.every(path => {
    let state = initState(levelData);
    for (const dir of path) {
      const prev = state;
      state = applyMove(state, dir);
      if (state.lastEvent && state.lastEvent.corruptionDelta !== 0) return true;
    }
    return false;
  });

  const truncated = solutions.length >= MAX_PATHS;

  return {
    levelId: levelData.id,
    playerElement: levelData.playerElement,
    solvable: solutions.length > 0,
    solutionCount: solutions.length,
    shortestPath: shortest,
    shortestLength: shortest ? shortest.length : null,
    allPaths: solutions,
    corruptionForced,
    flagged: solutions.length > 5,
    truncated,
    nodesVisited,
    notes: [
      truncated ? `Path collection capped at ${MAX_PATHS}` : '',
      solutions.length > 5 ? 'FLAGGED: more than 5 solutions — level may be too loose' : '',
      !corruptionForced && solutions.length > 0 ? 'WARNING: some winning paths avoid corruption mechanic' : '',
    ].filter(Boolean).join('; ') || 'OK',
  };
}

// CLI entry point
const args = process.argv.slice(2);
if (args.length < 1) {
  console.error('Usage: node solver.js <levels.json> [levelId]');
  process.exit(1);
}

const levelsPath = args[0];
const levelId = args[1] ? parseInt(args[1]) : null;

let levels;
try {
  levels = JSON.parse(readFileSync(levelsPath, 'utf8'));
} catch (e) {
  console.error(`Could not read levels file: ${e.message}`);
  process.exit(1);
}

if (levelId !== null) {
  const level = levels.find(l => l.id === levelId);
  if (!level) {
    console.error(`Level ${levelId} not found`);
    process.exit(1);
  }
  console.log(JSON.stringify(solve(level), null, 2));
} else {
  // Run all levels
  const results = levels.map(solve);
  console.log(JSON.stringify(results, null, 2));

  // Summary table
  console.error('\n=== LEVEL VALIDATION REPORT ===');
  console.error('ID  Element   Solvable  Solutions  ShortestLen  CorrForced  Flagged  Notes');
  console.error('─'.repeat(85));
  for (const r of results) {
    const row = [
      String(r.levelId).padEnd(3),
      r.playerElement.padEnd(9),
      (r.solvable ? 'YES' : 'NO ').padEnd(9),
      String(r.solutionCount).padEnd(10),
      String(r.shortestLength ?? '—').padEnd(12),
      (r.corruptionForced ? 'YES' : 'NO ').padEnd(11),
      (r.flagged ? 'YES' : 'no ').padEnd(8),
      r.notes,
    ].join(' ');
    console.error(row);
  }
  console.error('─'.repeat(85));
  const passing = results.filter(r => r.solvable && r.corruptionForced && !r.flagged).length;
  console.error(`${passing}/${results.length} levels fully pass validation.`);
}
