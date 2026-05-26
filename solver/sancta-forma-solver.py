"""
Sancta Forma A* solver — Realm XI build.

Rules implemented per sancta-forma-rules.md:
- §4.1  three-tier scoring (same +10/cleanse, safe-transit S<->T 0/0, curve-mismatch +3/+1)
- §4.2  asymmetric corruption budgets (S:2, C:1, T:1; death at budget+1)
- §4.3  cleanse resets corruption to 0
- §5    hunter pairings (Hex death-to-C, Moon death-to-S/T, Star death-to-C/S)
- §5.2  costume rule: next move must be same-element cleanse, else death
- §10   cleanse-during-costume scores 0, still clears corruption and costume
- Win:  score >= winScore (default 100 for 10×10)

Usage:
    python sancta-forma-solver.py 61        # solve rite 61
    python sancta-forma-solver.py 66        # solve rite 66

    import json
    from sancta_forma_solver import solve, count_paths, render
    with open('../src/levels.json') as f:
        levels = json.load(f)
    result = solve(levels[60])   # Rite 61 (0-indexed)
"""
from dataclasses import dataclass
from typing import Optional, Tuple
import heapq

S, C, T   = 'square', 'circle', 'triangle'
H, M, ST  = 'hexagon', 'moon', 'star'

DEATH = {S: 3, C: 2, T: 2}

ABSORB = {
    (S, S): (10, 'cleanse'), (S, C): (3, +1), (S, T): (0, 0),
    (C, C): (10, 'cleanse'), (C, S): (3, +1), (C, T): (3, +1),
    (T, T): (10, 'cleanse'), (T, C): (3, +1), (T, S): (0, 0),
}

HUNTER = {
    (S, H): (-3, 'costume'), (T, H): (-3, 'costume'), (C, H): 'death',
    (S, M): 'death',         (T, M): 'death',         (C, M): (-3, 'costume'),
    (S, ST): 'death',        (C, ST): 'death',        (T, ST): (-3, 'costume'),
}

HUNTERS = {H, M, ST}
DIRS = [('U', -1, 0), ('D', 1, 0), ('L', 0, -1), ('R', 0, 1)]


@dataclass(frozen=True)
class State:
    pos: Tuple[int, int]
    element: str
    corruption: int
    score: int
    grid: tuple
    costumed: bool


def make_state(level):
    grid = tuple(tuple(row) for row in level['grid'])
    r, c = level['playerStart']
    assert grid[r][c] is None, f"playerStart {(r,c)} must be null in grid"
    return State(pos=(r, c), element=level['playerElement'],
                 corruption=0, score=0, grid=grid, costumed=False)


def vacate(grid, r, c):
    row = grid[r][:c] + (None,) + grid[r][c+1:]
    return grid[:r] + (row,) + grid[r+1:]


def step(state: State, direction: str) -> Optional[State]:
    dr, dc = next((dr, dc) for d, dr, dc in DIRS if d == direction)
    r, c = state.pos[0] + dr, state.pos[1] + dc
    if not (0 <= r < len(state.grid) and 0 <= c < len(state.grid[0])):
        return None
    target = state.grid[r][c]
    if target is None:
        return None

    if target in HUNTERS:
        result = HUNTER.get((state.element, target))
        if result == 'death' or state.costumed:
            return None
        score_delta, _ = result
        return State(pos=(r, c), element=state.element,
                     corruption=state.corruption, score=state.score + score_delta,
                     grid=vacate(state.grid, r, c), costumed=True)

    score_delta, op = ABSORB[(state.element, target)]
    if state.costumed:
        if target != state.element:
            return None
        return State(pos=(r, c), element=state.element, corruption=0,
                     score=state.score, grid=vacate(state.grid, r, c), costumed=False)

    new_corr = 0 if op == 'cleanse' else state.corruption + op
    if new_corr >= DEATH[state.element]:
        return None
    return State(pos=(r, c), element=state.element, corruption=new_corr,
                 score=state.score + score_delta,
                 grid=vacate(state.grid, r, c), costumed=False)


def is_win(state, win_score):
    return not state.costumed and state.score >= win_score


def heuristic(state, win_score):
    return max(0, (win_score - state.score + 9) // 10)


def solve(level, max_iter=1_500_000):
    start = make_state(level)
    win_score = level.get('winScore', 100)
    if is_win(start, win_score):
        return {'solvable': True, 'depth': 0, 'path': [], 'iter': 0}
    uid = [0]
    def nxt(): uid[0] += 1; return uid[0]
    queue = [(heuristic(start, win_score), nxt(), 0, start, [])]
    best_g = {start: 0}
    counter = 0
    while queue and counter < max_iter:
        f, _, g, state, path = heapq.heappop(queue)
        counter += 1
        if best_g.get(state, float('inf')) < g:
            continue
        for d, _, _ in DIRS:
            ns = step(state, d)
            if ns is None:
                continue
            ng = g + 1
            if is_win(ns, win_score):
                return {'solvable': True, 'depth': ng, 'path': path + [d], 'iter': counter}
            if best_g.get(ns, float('inf')) <= ng:
                continue
            best_g[ns] = ng
            heapq.heappush(queue, (ng + heuristic(ns, win_score), nxt(), ng, ns, path + [d]))
    return {'solvable': False, 'iter': counter}


def count_paths(level, max_depth=None, max_paths=10000, time_limit=None):
    import time
    start = make_state(level)
    win_score = level.get('winScore', 100)
    if max_depth is None:
        sol = solve(level)
        if not sol['solvable']:
            return 0
        max_depth = sol['depth']
    paths = 0
    queue = [(start, [])]
    t0 = time.time()
    while queue:
        if time_limit and time.time() - t0 > time_limit:
            return paths
        state, path = queue.pop()
        if len(path) >= max_depth:
            continue
        for d, _, _ in DIRS:
            ns = step(state, d)
            if ns is None:
                continue
            if is_win(ns, win_score):
                paths += 1
                if paths >= max_paths:
                    return paths
                continue
            queue.append((ns, path + [d]))
    return paths


def render(level):
    grid, (pr, pc) = level['grid'], level['playerStart']
    g = {S:'S',C:'C',T:'T',H:'H',M:'M',ST:'*',None:'.'}
    return '\n'.join(' '.join('P' if (r,c)==(pr,pc) else g.get(cell,'?')
                              for c, cell in enumerate(row))
                     for r, row in enumerate(grid))


if __name__ == '__main__':
    import json, sys
    with open('../src/levels.json') as f:
        levels = json.load(f)
    target = int(sys.argv[1]) if len(sys.argv) > 1 else 61
    level = next(l for l in levels if l['id'] == target)
    print(f"Rite {target} — {level['playerElement']}, winScore {level['winScore']}")
    print(render(level)); print()
    result = solve(level)
    print(f"Solve: {result}")
    if result['solvable']:
        p = count_paths(level, max_depth=result['depth'], time_limit=5.0)
        print(f"Paths at depth {result['depth']}: {p}+")
