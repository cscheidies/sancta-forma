# SANCTA FORMA — Rules

*Sacred Form.* A turn-based puzzle game of pure shapes, corruption, and restoration.

This document is the authoritative ruleset for design intent. Where it disagrees with earlier sketches, this document wins. Where it disagrees with the shipped code in src/engine.js / src/renderer.js, the code is operational truth and this document is out of date — file an issue and reconcile. Open questions are listed in §11.

---

## 1. The Sacred Forms

There are three pure forms: Circle, Square, and Triangle. They are the elemental grammar of the universe. In each rite (level), the player *is* one of these.

The forms slept for ancient reasons. The world's misuse of shape woke them. They wake diminished, and must absorb the corrupted shapes of the world to restore themselves.

## 2. The Grid

The game ships in three grid sizes, each used for a distinct section of the campaign:

- **5×5** — Realms I–VII (Rites 1–42). The foundational form. The full grammar of absorption, costuming, and the three hunters is taught and practiced at this size.
- **10×10** — Realms VIII–XIII (Rites 43–78). The expanded board. Any combination of sacred forms and hunters may appear on any level. This is where strategic play deepens.
- **5×5 again** — color-introduction realms (post-XIII, undesigned). The color mechanic enters at 5×5 because it is itself a new grammar that deserves its own teaching size.
- **20×20** — reserved for late-game realms (undesigned).

Every cell holds a shape, a wormhole, or is the player's starting cell (empty). When the player moves out of a cell, that cell becomes permanently empty. The player cannot move back into an empty cell.

## 3. Movement

- One cell per turn.
- Cardinal directions only: up, down, left, right. No diagonals.
- A move is only legal if the destination cell holds a shape or a wormhole (and isn't a death-hunter for the current form, and isn't violating the costume rule — see §5.2).
- If no adjacent cell holds a legal target, the player has no valid moves → loss (see §7).
- The player's starting cell is set per level via the `playerStart` field in level data and may be any cell on the grid — not constrained to center. Used as a difficulty lever in 10×10 medium-difficulty realms (X–XI) and beyond.

## 3.5 Wormholes

Some levels contain wormhole pairs — two linked cells with no shape underneath. Stepping onto a wormhole entrance instantly relocates the player to the wormhole's exit cell. Both cells become empty after a single use. Wormhole travel scores nothing and does not change corruption or costume state. A costumed player stepping onto a wormhole dies — a wormhole step is not a same-element absorption and cannot serve as the mandatory cleanse (per §5.2).

## 4. Absorption — the core mechanic

Moving onto a shape absorbs it. Absorption affects score and corruption simultaneously.

### 4.1 The three-tier scoring system

| Player → Absorbs | Score | Corruption |
|---|---|---|
| Same element (e.g. Square → Square) | **+10** | cleanses all corruption to 0 |
| Safe transit (Square ↔ Triangle — both have flat sides) | **0** | no change |
| Curve-mismatch (Circle ↔ Square, Circle ↔ Triangle) | **+3** | **+1** corruption |

The "safe transit" tier is significant. Square and Triangle can pass through each other without harm or reward. This is the mechanical expression of their partnership (see §9). Circle has no safe transit with any other form — Circle is alone among the three.

### 4.2 Corruption — the geometric law

> A form can carry corruption up to half its sides, but no further. Beyond that, the form breaks.

Formally: corruption ≤ floor(sides / 2) survives. One more kills.

| Form | Sides | Max corruption | Dies at |
|---|---|---|---|
| Square | 4 | **2 curves** | 3 curves |
| Triangle | 3 | **1 curve** | 2 curves |
| Circle | 2 (as D-shape composite) | **1 straight** | 2 straights |

This asymmetry is intentional. Square has twice the corruption budget of Circle and Triangle. The math falls out of the geometry, and the geometry is the personality (see §9).

### 4.3 Cleansing

Absorbing a same-element shape resets corruption to 0, regardless of how much corruption you'd accumulated. This is the only way to recover.

## 5. The Hunters

Three non-sacred forms have appeared in the corrupted realms. They are not part of the grammar. Each one is fatal to two of the three Sacred Forms.

| Hunter | Death to | Absorbable by |
|---|---|---|
| **Hexagon** | Circle | Square, Triangle |
| **Moon** | Square, Triangle | Circle |
| **Star** | Circle, Square | Triangle |

### 5.1 Hunter scoring

Absorbing a hunter scores −3 points (the form pays a price to defeat the hunter). Hunters are never neutral — they always cost.

### 5.2 The costume rule

Immediately after absorbing a hunter, the form is costumed — visually distorted (Square gains a pentagonal edge; Triangle takes on a squared profile; Circle takes on a curved hunter-edge). Mechanically:

- The next move must be a same-element absorption (a cleanse).
- Any other move — moving onto a different element, onto another hunter, or being unable to move — is death.

The costume is removed by the cleanse. The form returns to its pure state, score unchanged from the cleanse itself (cleanse during costume scores 0, not 10).

### 5.3 Stepping onto a death hunter = instant loss

If the player moves onto a hunter that is death to their form (e.g. Circle onto Hexagon), the level ends immediately. There is no recovery.

## 6. Win Condition

A rite is won when the player reaches the level's win threshold OR more AND is not currently costumed.

The threshold scales with grid size:

> Win Threshold = 10 × N, where N is the grid side length.

| Grid | Threshold |
|---|---|
| 5×5 | 50 |
| 10×10 | 100 |
| 20×20 | 200 |

The threshold is stored per-level in the `winScore` field of level data; the formula above is the design rule, not a runtime check. Special rites may carry custom thresholds.

Cleansing a hunter costume does NOT score the win. If a player reaches threshold by absorbing a hunter and entering costume, the win is held until the next-move cleanse resolves. The cleanse itself scores 0 — but if pre-cleanse score was already ≥ threshold, the level ends with the cleanse.

## 7. Loss Conditions

The rite is lost when any of the following occurs:

1. Corruption exceeds the form's budget (see §4.2).
2. The form moves onto a hunter that is death to it (see §5.3).
3. The form is costumed and fails to cleanse on the very next move (see §5.2).
4. No valid moves are available (all adjacent cells are empty, contain death hunters, or — if costumed — contain non-cleanse cells).

## 8. Realm Structure

- Each realm contains 6 rites.
- Each realm has its own theme, visual identity, and per-rite background art.
- Sacred Form distribution within a realm is per-realm and varies. The earlier "two rites per form per realm" rule from prior drafts is not enforced as a hard constraint.

### 8.1 Realms I–VII (5×5, shipped)

**Realm I — The First Rites** (Rites 1–6). No hunters. The three forms wake and reclaim the basic world.

**Realm II — The Hexagon Rites** (Rites 7–12). Hexagon hunter introduced. Square and Triangle absorb hexagons; Circle navigates around them.

**Realm III — The Hexagon Chase** (Rites 13–18). Hexagon-only. Higher density and more constrained boards than Realm II.

**Realm IV — Moon Rites** (Rites 19–24). Moon hunter introduced. Circle absorbs Moons; Square and Triangle must navigate around them.

**Realm V — Moon Passage** (Rites 25–30). Second Moon realm. Higher difficulty.

**Realm VI — The Star Rites** (Rites 31–36). Star hunter introduced. Triangle absorbs Stars; Circle and Square must navigate around them.

**Realm VII — The Star Journey** (Rites 37–42). Star-only. Finale of the 5×5 prologue.

### 8.2 Realms VIII–XIV (10×10)

The 10×10 layer is the actual game — Realms I–VII are designed as prologue. Realms VIII–XIV are complete:

- **Realm VIII** — *The Threshold Rites* (Rites 43–48). Easy 10×10. Any combination of sacred forms and hunters per level.
- **Realm IX** — *The Outer Pattern* (Rites 49–54). Easy 10×10. Death-hunters introduced at 10×10 scale.
- **Realm X** — *The Pattern Speaks* (Rites 55–60). Medium 10×10. Custom start positions — `playerStart` no longer defaults to center.
- **Realm XI** — *In Medias Res* (Rites 61–66). Medium 10×10.
- **Realm XII** — *Acies* (Rites 67–72). Hard 10×10.
- **Realm XIII** — *Ultima Vigilia* (Rites 73–78). Hard 10×10. Original designed finale.
- **Realm XIV** — *Angustia* (Rites 79–84). Hard 10×10. Edge-block mechanic: outer two rings are death walls. Player confined to 6×6 interior. Every rite forces at least one hunter absorption. Win threshold: 100 points.

The original prologue arc spans Realms I–XIII (78 rites). Curated realms continue beyond as the game develops. A community level editor is planned to enable user-generated levels as the long tail.

### 8.3 Future expansion

- **Color mechanic** — drops back to 5×5 for color-introduction realms (post-XIII). See §11.2.
- **20×20** — reserved for late-game realms after color is fully integrated.
- **Tile mutation** — every-5-moves mutation rule planned for a future realm group. See §11.1.

### 8.4 Unlock chain

Levels and realms unlock progressively: Realm N unlocks when every rite in Realm N−1 is completed. Progress is stored in localStorage under the `shape-puzzle-progress` key. The unlock chain is strict — 10×10 (Realm VIII) requires completion of all 42 rites of Realms I–VII first.

## 9. Personalities

Personalities are conveyed multi-channel: through narrator prose, environment art, and movement animation. The Sacred Forms have no voices. They never speak. Their identity is delivered by what surrounds them, how the world describes them, and how they move.

### 9.1 The three forms

- **Square** — *holds*. The foundation. Wakes first because it bears the weight. Mechanically the tank (2-corruption budget). Environment: moor, standing stones, ground. Partner to Triangle (safe transit).
- **Circle** — *remembers*. The eldest of the three. Watches. Has outlasted everything it once leaned on. Mechanically the most isolated (no safe transit with any form, 1-corruption budget). Environment: the reflecting pool, the moon. Wakes second, summoned by Square's stirring.
- **Triangle** — *points*. The actor. Chose its direction long ago and has not turned since. Mechanically the partner to Square (safe transit), 1-corruption budget. Environment: peaks, spear-stones, ascent. Wakes third, when the call to act is unambiguous.

### 9.2 The waking order = the tutorial order = the genealogy

Square → Circle → Triangle is the order in which the forms wake from the long sleep, and the order in which the player meets them. The youngest (Square) wakes first because it bears the weight. The eldest (Circle) wakes second because the youngest's stirring summoned it. The middle (Triangle) wakes third because the actor only acts when called.

### 9.3 The relationship structure

- Square + Triangle are paired (safe transit between them).
- Circle is the lonely third (no safe transit with anyone).

This is encoded directly in the mechanics, not just the prose.

## 10. Engine behaviors and configurable fields

These are mechanics enforced by `src/engine.js` that aren't obvious from the high-level rules above:

- Cleanse during costume scores 0, not +10. The cleanse exists to save the form, not to score.
- Corruption resets on cleanse, not decrements. Two curves followed by a cleanse → 0 curves.
- The player's element is fixed for the rite. Hunter costumes change the *appearance* of the form, not the *element*. A pentagon-costumed Square is still a Square and still needs to absorb a Square to cleanse.
- The player cannot win while costumed. Score threshold checks include `!newCostumed` — reaching threshold via a hunter absorb does not end the level until the cleanse resolves.
- Triangle and Square see "Triangle ↔ Square" as safe transit; Circle does not get a safe transit with any form. This is conveyed in the UI by the score popup showing "PASS" for safe transits and +3 or +10 for scoring absorptions.

### 10.1 Level-configurable fields

Set per-level in `src/levels.json`:

- `id` — integer level number (1–42 currently, 43+ planned).
- `playerElement` — `square` / `circle` / `triangle`. Locked for the rite.
- `playerStart` — `[row, col]` for the player's start cell. Any non-hunter cell is legal. Engine and renderer derive grid size from `grid.length`, so this can target any cell on any size board.
- `grid` — 2D array of cell-type strings (`square` / `circle` / `triangle` / `hexagon` / `moon` / `star`) or `null` (for the player's start cell). Grid size is implicit in array length — engine and renderer adapt automatically.
- `winScore` — number, default 50. Per-level override of the win threshold. For 10×10 levels, set to 100; for 20×20 levels, set to 200 (per §6).
- `lore` — array of prose strings shown as fade-in overlay text on level start.

## 11. Open Questions

### 11.1 Tile mutation mechanic

Cadence locked: every 5 player moves. Rule undefined. Three candidates discussed: decay (a random sacred shape becomes a hunter), drift (mismatch shapes shift to other shapes), spread (hunters propagate to adjacent cells). Implementation hook (`evolveBoard()` in `engine.js`) is queued — wires into `applyMove` after the new state is constructed but before win/loss checks. Decision deferred until 10×10 is stable.

### 11.2 Color mechanic

Direction locked: 5×5 introduction realms post-XIII. Mechanic undefined. Architectural slot exists on every cell (the color slot in the cell object — engine ignores it for now). Open: whether colors mix, clash, or layer with shapes — and whether color carries its own corruption budget.

### 11.3 20×20 grid design

The engine supports it once the variable-grid patch lands. Threshold is 200 by formula. Hunter density, level count, and realm structure all undefined. May need a camera/pan/zoom UX since 20×20 cells become small in landscape on mobile (~26px per cell). Defer until after Realms VIII–XIII ship.

### 11.4 Movement animation per shape

The "multi-channel personality" promise (§9) includes movement. Currently all three forms move identically. Triangle's anticipation/orientation, Square's settle, Circle's already-there beat — none of these exist yet.

### 11.5 Difficulty grading axes for Realms VIII–XIII

"Easy / medium / hard" needs concrete definition before levels are designed. Candidate axes: hunter density (% of cells that are hunters), cleanse availability (% of cells that are same-element), death-hunter count per board, required move count to reach threshold, path constraints (forced corridors vs. open boards). Pick which axes scale across difficulty tiers — otherwise designs will be vibe-graded and inconsistent.

### 11.6 10×10 solver

`solver.js` does exhaustive BFS and will not terminate on 99-cell boards with hunters in reasonable time. Two paths: build a heuristic A* solver with corruption-aware cost (algorithmic verification, fast), or hand-verify every Realm VIII–XIII level (no algorithmic guarantee, slower per level but more honest about difficulty curve). Decide before level design starts.

### 11.7 Hunter-costume visual specifications

Pentagon-Square (Square absorbing Hexagon) and squared-Triangle (Triangle absorbing Hexagon or Star) shipped. Circle-costumed-by-Moon and the visual diff between Triangle-costumed-by-Hexagon vs Triangle-costumed-by-Star still need design.

### 11.8 Per-shape per-realm narrative snippets

Approximately 21 short prose fragments (7 realms × 3 forms) needed, delivered the first time the player meets a form in a given realm. Tone: third person, sparse, no dialogue. `level.lore` array exists; content needs writing.

### 11.9 Wormhole mechanic — shipped in Realm XV (Somnium)

One-way auto-teleport: stepping onto a wormhole cell instantly relocates the player to a designer-specified destination cell. Wormhole disappears after single use (like an absorbed cell). Wormhole itself scores 0 points and does not affect corruption.

**Resolved (2026-05-27):** The destination cell is vacated (empty) on arrival — the exit cell is cleared, not absorbed. The player simply appears on an empty cell. Both entrance and exit cells are consumed in a single wormhole use. Full mechanic is defined in §3.5 and shipped in Realm XV (Rites 85–90).

---

### Closed questions (preserved for record)

- **Star entry** — closed; Star enters at Realm VI (The Star Rites), continues to VII (The Star Journey).
- **Realm III restructure** — closed; III stays as "The Hexagon Chase," hexagon-only, no Moon. Moon got its own realms IV (Moon Rites) and V (Moon Passage). The earlier proposal to mix Circle + Moon into Realm III was rejected.
- **Win threshold scaling** — closed; threshold = 10 × N per §6 (50 / 100 / 200 for 5×5 / 10×10 / 20×20).
- **Stuck-loss UX** — closed; "BOUND" overlay with "No path remains — your form is trapped" copy shipped.
- **Custom start positions** — closed; the engine has always supported arbitrary `playerStart`; this becomes a level-design lever in Realms X–XI without any code change.

---

*This document supersedes all prior rule sketches. Update this document — not the older ones — when rules change. When in doubt, the shipped code in `src/engine.js` and `src/renderer.js` is the operational authority; this document is the design intent.*
