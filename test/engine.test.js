import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { initState, getValidMoves, applyMove, RULES } from '../src/engine.js';

// Minimal level for unit tests
function makeLevel(playerElement, playerStart, grid) {
  return { id: 0, playerElement, playerStart, winScore: 50, grid };
}

// 5×5 grid: all nulls except specified cells
function blankGrid(playerStart, cells = {}) {
  const g = Array.from({ length: 5 }, () => Array(5).fill(null));
  for (const [key, val] of Object.entries(cells)) {
    const [r, c] = key.split(',').map(Number);
    g[r][c] = val;
  }
  return g;
}

describe('SQUARE absorption rules', () => {
  it('absorbs square: +10 score, -1 corruption (clamped at 0)', () => {
    const grid = blankGrid([2, 2], { '1,2': 'square' });
    const level = makeLevel('square', [2, 2], grid);
    const state = initState(level);
    const next = applyMove(state, 'U');
    assert.equal(next.player.score, 10);
    assert.equal(next.player.corruption, 0); // clamped, was already 0
  });

  it('absorbs circle: +3 score, +1 corruption', () => {
    const grid = blankGrid([2, 2], { '1,2': 'circle' });
    const state = initState(makeLevel('square', [2, 2], grid));
    const next = applyMove(state, 'U');
    assert.equal(next.player.score, 3);
    assert.equal(next.player.corruption, 1);
  });

  it('absorbs triangle: +0 score, no corruption change (safe transit)', () => {
    const grid = blankGrid([2, 2], { '1,2': 'triangle' });
    const state = initState(makeLevel('square', [2, 2], grid));
    const next = applyMove(state, 'U');
    assert.equal(next.player.score, 0);
    assert.equal(next.player.corruption, 0);
  });

  it('safe transit cell is cleared (triangle absorbed, cell becomes null)', () => {
    const grid = blankGrid([2, 2], { '1,2': 'triangle' });
    const state = initState(makeLevel('square', [2, 2], grid));
    const next = applyMove(state, 'U');
    assert.equal(next.grid[1][2], null);
    assert.deepEqual(next.player.position, [1, 2]);
  });

  it('corruption is clamped at 0 (does not go negative from square absorb)', () => {
    const grid = blankGrid([2, 2], { '1,2': 'square', '0,2': 'square' });
    const state = initState(makeLevel('square', [2, 2], grid));
    const s1 = applyMove(state, 'U');  // absorb square, corruption stays 0
    assert.equal(s1.player.corruption, 0);
    const s2 = applyMove(s1, 'U');    // absorb another square
    assert.equal(s2.player.corruption, 0); // still clamped at 0
  });

  it('dies when corruption reaches 3 (deathAt=3)', () => {
    // Path: R→R→U → three circles in an L-shape
    const grid = blankGrid([2, 2], { '2,3': 'circle', '2,4': 'circle', '1,4': 'circle' });
    const state = initState(makeLevel('square', [2, 2], grid));
    const s1 = applyMove(state, 'R'); // c=1, score=3
    assert.equal(s1.player.corruption, 1);
    assert.equal(s1.status, 'playing');
    const s2 = applyMove(s1, 'R'); // c=2, score=6, still alive (deathAt=3)
    assert.equal(s2.player.corruption, 2);
    assert.equal(s2.status, 'playing');
    const s3 = applyMove(s2, 'U'); // c=3 → death
    assert.equal(s3.player.corruption, 3);
    assert.equal(s3.status, 'lose-death');
  });

  it('score recorded before death check (dying move still scores)', () => {
    // Same L-path: three circles, death on 3rd
    const grid = blankGrid([2, 2], { '2,3': 'circle', '2,4': 'circle', '1,4': 'circle' });
    const state = initState(makeLevel('square', [2, 2], grid));
    const s1 = applyMove(state, 'R');
    const s2 = applyMove(s1, 'R');
    const s3 = applyMove(s2, 'U'); // c=3 → death
    assert.equal(s3.status, 'lose-death');
    assert.equal(s3.player.score, 9); // 3 circles × 3 pts
  });
});

describe('CIRCLE absorption rules', () => {
  it('absorbs circle: +10 score, -1 corruption (clamped at 0)', () => {
    const grid = blankGrid([2, 2], { '1,2': 'circle' });
    const state = initState(makeLevel('circle', [2, 2], grid));
    const next = applyMove(state, 'U');
    assert.equal(next.player.score, 10);
    assert.equal(next.player.corruption, 0);
  });

  it('absorbs square: +3 score, +1 corruption', () => {
    const grid = blankGrid([2, 2], { '1,2': 'square' });
    const state = initState(makeLevel('circle', [2, 2], grid));
    const next = applyMove(state, 'U');
    assert.equal(next.player.score, 3);
    assert.equal(next.player.corruption, 1);
  });

  it('absorbs triangle: +3 score, +1 corruption', () => {
    const grid = blankGrid([2, 2], { '1,2': 'triangle' });
    const state = initState(makeLevel('circle', [2, 2], grid));
    const next = applyMove(state, 'U');
    assert.equal(next.player.score, 3);
    assert.equal(next.player.corruption, 1);
  });

  it('dies when corruption reaches 2 (deathAt=2)', () => {
    // Two squares in a vertical line above player
    const grid = blankGrid([2, 2], { '1,2': 'square', '0,2': 'square' });
    const state = initState(makeLevel('circle', [2, 2], grid));
    const s1 = applyMove(state, 'U'); // c=1, playing
    assert.equal(s1.player.corruption, 1);
    assert.equal(s1.status, 'playing');
    const s2 = applyMove(s1, 'U'); // c=2 → death
    assert.equal(s2.player.corruption, 2);
    assert.equal(s2.status, 'lose-death');
  });
});

describe('TRIANGLE absorption rules', () => {
  it('absorbs triangle: +10 score, -1 corruption (clamped at 0)', () => {
    const grid = blankGrid([2, 2], { '1,2': 'triangle' });
    const state = initState(makeLevel('triangle', [2, 2], grid));
    const next = applyMove(state, 'U');
    assert.equal(next.player.score, 10);
    assert.equal(next.player.corruption, 0);
  });

  it('absorbs circle: +3 score, +1 corruption', () => {
    const grid = blankGrid([2, 2], { '1,2': 'circle' });
    const state = initState(makeLevel('triangle', [2, 2], grid));
    const next = applyMove(state, 'U');
    assert.equal(next.player.score, 3);
    assert.equal(next.player.corruption, 1);
  });

  it('absorbs square: +0 score, no corruption change (safe transit)', () => {
    const grid = blankGrid([2, 2], { '1,2': 'square' });
    const state = initState(makeLevel('triangle', [2, 2], grid));
    const next = applyMove(state, 'U');
    assert.equal(next.player.score, 0);
    assert.equal(next.player.corruption, 0);
    assert.equal(next.grid[1][2], null); // cell cleared
    assert.deepEqual(next.player.position, [1, 2]);
  });

  it('dies when corruption reaches 2 (deathAt=2)', () => {
    // Two circles in a vertical line above player
    const grid = blankGrid([2, 2], { '1,2': 'circle', '0,2': 'circle' });
    const state = initState(makeLevel('triangle', [2, 2], grid));
    const s1 = applyMove(state, 'U'); // c=1
    assert.equal(s1.player.corruption, 1);
    const s2 = applyMove(s1, 'U');   // c=2 → death
    assert.equal(s2.status, 'lose-death');
  });
});

describe('Win condition', () => {
  it('status becomes win when score reaches winScore', () => {
    // 5 squares in a horizontal row: player at [2,0], squares at [2,1..4] + [1,4]
    const grid = blankGrid([2, 0], {
      '2,1': 'square', '2,2': 'square', '2,3': 'square', '2,4': 'square',
      '1,4': 'square',
    });
    const state = initState(makeLevel('square', [2, 0], grid));
    let s = state;
    s = applyMove(s, 'R'); // 10
    s = applyMove(s, 'R'); // 20
    s = applyMove(s, 'R'); // 30
    s = applyMove(s, 'R'); // 40
    s = applyMove(s, 'U'); // 50 → win
    assert.equal(s.status, 'win');
    assert.equal(s.player.score, 50);
  });

  it('win is checked before death on the same move', () => {
    // Score is 48, absorb a circle (score→51, corruption→3=death)
    // Win should take priority (score checked first)
    const grid = blankGrid([2, 2], { '1,2': 'circle' });
    const level = makeLevel('square', [2, 2], grid);
    const state = initState(level);
    // Manually set score near win and corruption near death
    const mangled = {
      ...state,
      player: { ...state.player, score: 48, corruption: 2 },
    };
    const next = applyMove(mangled, 'U'); // +3 score = 51 ≥ 50, AND corruption = 3
    assert.equal(next.status, 'win'); // win, not lose-death
    assert.equal(next.player.score, 51);
  });
});

describe('No valid moves (lose-stuck)', () => {
  it('status becomes lose-stuck when all adjacent cells are empty', () => {
    // Player surrounded by null cells
    const grid = blankGrid([2, 2], { '1,2': 'circle' });
    const state = initState(makeLevel('square', [2, 2], grid));
    const next = applyMove(state, 'U'); // absorb last shape → no more moves
    assert.equal(next.status, 'lose-stuck');
  });
});

describe('getValidMoves', () => {
  it('only returns directions with shapes', () => {
    const grid = blankGrid([2, 2], { '1,2': 'circle', '2,3': 'square' });
    const state = initState(makeLevel('square', [2, 2], grid));
    const moves = getValidMoves(state);
    assert.deepEqual(moves.sort(), ['R', 'U'].sort());
  });

  it('does not include out-of-bounds directions', () => {
    const grid = blankGrid([0, 0], { '0,1': 'circle', '1,0': 'square' });
    const state = initState(makeLevel('square', [0, 0], grid));
    const moves = getValidMoves(state);
    assert.ok(!moves.includes('U'));
    assert.ok(!moves.includes('L'));
    assert.ok(moves.includes('R'));
    assert.ok(moves.includes('D'));
  });
});
