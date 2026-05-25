"""
Sancta Forma engine — v3 with Moon support.

Implements the locked rules from sancta-forma-rules.md:
- 3-tier scoring (same +10, safe transit 0, curve-mismatch +3)
- Asymmetric corruption budgets (Sq 2, Tri 1, Circ 1) — death at budget+1
- Cleanse resets corruption to 0
- Hunter costume + mandatory cleanse rule
- Hex/Moon/Star death pairings
"""
from collections import deque
from dataclasses import dataclass
from typing import Optional, Tuple

# Element shorthand
S, C, T = "square", "circle", "triangle"
H, M, ST = "hexagon", "moon", "star"

# Death thresholds: corruption >= this value = dead
DEATH = {S: 3, C: 2, T: 2}

# Base absorption: (player, target) -> (score_delta, corruption_op)
# corruption_op is either an integer delta or the string "cleanse" (resets to 0)
ABSORB = {
 (S, S): (10, "cleanse"),
 (S, C): (3, +1),
 (S, T): (0, 0), # safe transit (flat-flat)

 (C, C): (10, "cleanse"),
 (C, S): (3, +1),
 (C, T): (3, +1),

 (T, T): (10, "cleanse"),
 (T, C): (3, +1),
 (T, S): (0, 0), # safe transit (flat-flat)
}

# Hunter pairings: (player, hunter) -> "death" | (score_delta, "costume")
HUNTER = {
 (S, H): (-3, "costume"),
 (T, H): (-3, "costume"),
 (C, H): "death",

 (S, M): "death",
 (T, M): "death",
 (C, M): (-3, "costume"),

 (S, ST): "death",
 (C, ST): "death",
 (T, ST): (-3, "costume"),
}

HUNTERS = {H, M, ST}
SACRED = {S, C, T}

WIN_SCORE = 50
DIRS = [("U", -1, 0), ("D", 1, 0), ("L", 0, -1), ("R", 0, 1)]


@dataclass(frozen=True)
class State:
    pos: Tuple[int, int]
    element: str
    corruption: int
    score: int
    grid: tuple # tuple of tuples
    costumed: bool


def make_state(level):
    grid = tuple(tuple(row) for row in level["grid"])
    r, c = level["playerStart"]
    assert grid[r][c] is None, f"playerStart {(r,c)} must be None in grid"
    return State(
        pos=(r, c),
        element=level["playerElement"],
        corruption=0,
        score=0,
        grid=grid,
        costumed=False,
    )


def vacate(grid, r, c):
    """Return a new grid tuple with (r,c) emptied."""
    new_row = grid[r][:c] + (None,) + grid[r][c+1:]
    return grid[:r] + (new_row,) + grid[r+1:]


def step(state: State, direction: str) -> Optional[State]:
    """Apply one move. Returns new state, or None if illegal/fatal."""
    dr, dc = next((d[1], d[2]) for d in DIRS if d[0] == direction)
    nr, nc = state.pos[0] + dr, state.pos[1] + dc
    rows, cols = len(state.grid), len(state.grid[0])

    if not (0 <= nr < rows and 0 <= nc < cols):
        return None # out of bounds

    target = state.grid[nr][nc]
    if target is None:
        return None # can't move into empty cell

    new_grid = vacate(state.grid, nr, nc)

    # ----- COSTUMED: only legal move is same-element cleanse -----
    if state.costumed:
        if target != state.element:
            return None # any non-same-element move is death
        # Cleanse during costume: removes costume, resets corruption to 0,
        # scores 0 (NOT +10) per rules §5.2
        return State(
            pos=(nr, nc),
            element=state.element,
            corruption=0,
            score=state.score,
            grid=new_grid,
            costumed=False,
        )

    # ----- HUNTER ABSORPTION -----
    if target in HUNTERS:
        result = HUNTER.get((state.element, target))
        if result == "death" or result is None:
            return None
        score_delta, _ = result
        return State(
            pos=(nr, nc),
            element=state.element,
            corruption=state.corruption, # corruption unchanged by hunter
            score=state.score + score_delta,
            grid=new_grid,
            costumed=True,
        )

    # ----- SACRED SHAPE ABSORPTION -----
    score_delta, corr_op = ABSORB[(state.element, target)]
    if corr_op == "cleanse":
        new_corr = 0
    else:
        new_corr = state.corruption + corr_op

    if new_corr >= DEATH[state.element]:
        return None # corruption death

    return State(pos=(nr, nc),
                 element=state.element,
                 corruption=new_corr,
                 score=state.score + score_delta,
                 grid=new_grid,
                 costumed=False,
                 )


def is_win(state: State) -> bool:
    return state.score >= WIN_SCORE


def has_valid_move(state: State) -> bool:
    for d, _, _ in DIRS:
        if step(state, d) is not None:
            return True
    return False


def solve(level, max_depth=30, max_states=200000):
    """BFS through state space. Returns dict with solvability info."""
    start = make_state(level)
    if is_win(start):
        return {"solvable": True, "shortest_path": [], "depth": 0,
                "states_explored": 1, "any_corrupt": False, "any_hunter": False,
                "corruption_required": False, "hunter_required": False}

    # BFS for shortest winning path
    queue = deque([(start, [])])
    visited = {start: 0}
    winning_paths = []
    states_explored = 0

    while queue and states_explored < max_states:
        state, path = queue.popleft()
        states_explored += 1
        if len(path) >= max_depth:
            continue

        for d, _, _ in DIRS:
            nxt = step(state, d)
            if nxt is None:
                continue
            new_path = path + [d]
            if is_win(nxt):
                winning_paths.append((nxt, new_path))
                continue # don't expand winners
            if nxt not in visited or visited[nxt] > len(new_path):
                visited[nxt] = len(new_path)
                queue.append((nxt, new_path))

    if not winning_paths:
        return {"solvable": False, "states_explored": states_explored}

    # Sort by length
    winning_paths.sort(key=lambda x: len(x[1]))
    shortest = winning_paths[0]

    # Check corruption-required and hunter-required across all shortest-equiv paths
    shortest_len = len(shortest[1])
    short_paths = [p for p in winning_paths if len(p[1]) == shortest_len]

    # Check if ANY winning path avoids corruption / hunters
    any_path_avoids_corruption = False
    any_path_avoids_hunters = False

    for end_state, path in winning_paths[:500]: # sample
        # Replay to check if this path took corruption or absorbed hunters
        took_corruption = False
        took_hunter = False
        s = start
        for d in path:
            prev_corr = s.corruption
            prev_cost = s.costumed
            s = step(s, d)
            if s.costumed and not prev_cost:
                took_hunter = True
            if s.corruption > 0:
                took_corruption = True
        if not took_corruption:
            any_path_avoids_corruption = True
        if not took_hunter:
            any_path_avoids_hunters = True

    return {
        "solvable": True,
        "shortest_path": shortest[1],
        "depth": shortest_len,
        "states_explored": states_explored,
        "num_winning_paths": len(winning_paths),
        "corruption_required": not any_path_avoids_corruption,
        "hunter_required": not any_path_avoids_hunters,
    }


def render(level):
    """Pretty-print a level grid with the player marker."""
    grid = level["grid"]
    pr, pc = level["playerStart"]
    glyph = {S: "S", C: "C", T: "T", H: "H", M: "M", ST: "*", None: "."}
    lines = []
    for r, row in enumerate(grid):
        cells = []
        for c, cell in enumerate(row):
            if (r, c) == (pr, pc):
                cells.append("P")
            else:
                cells.append(glyph.get(cell, "?"))
        lines.append(" ".join(cells))
    return "\n".join(lines)


if __name__ == "__main__":
    # Smoke test with a simple known-solvable level
    test = {
        "id": "smoke",
        "playerElement": S,
        "playerStart": (2, 2),
        "grid": [
            [S, S, S, S, S],
            [S, T, T, T, S],
            [S, T, None, T, S],
            [S, T, T, T, S],
            [S, S, S, S, S],
        ],
    }
    print(render(test))
    print()
    result = solve(test)
    print(f"Solvable: {result['solvable']}")
    if result['solvable']:
        print(f"Shortest path: {result['shortest_path']} ({result['depth']} moves)")
        print(f"Corruption required: {result['corruption_required']}")
        print(f"Hunter required: {result['hunter_required']}")
