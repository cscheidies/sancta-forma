# SANCTA FORMA — Rules

*Sacred Form.* A turn-based puzzle game of pure shapes, corruption, and restoration.

This document is the authoritative ruleset. Where it disagrees with earlier napkin notes, this document wins. Open questions are listed in §11 — they are not "details" — they are work owed.

---

## 1. The Sacred Forms

There are three pure forms: **Circle**, **Square**, and **Triangle**. They are the elemental grammar of the universe. In each rite (level), the player *is* one of these.

The forms slept for ancient reasons. The world's misuse of shape woke them. They wake diminished, and must absorb the corrupted shapes of the world to restore themselves.

## 2. The Grid

- **5×5 grid** for Realms I–III (Rites 1–18). Larger grids reserved for later realms.
- Every cell holds a shape except the player's starting cell.
- When the player moves out of a cell, that cell becomes permanently empty. The player **cannot move back** into an empty cell.

## 3. Movement

- One cell per turn.
- Cardinal directions only: up, down, left, right. No diagonals.
- A move is only legal if the destination cell holds a shape.
- If no adjacent cell holds a shape, the player has no valid moves → loss (see §8).

## 4. Absorption — the core mechanic

Moving onto a shape absorbs it. Absorption affects **score** and **corruption** simultaneously.

### 4.1 The three-tier scoring system

| Player → Absorbs | Score | Corruption |
|---|---|---|
| Same element (e.g. Square → Square) | **+10** | cleanses **all** corruption to 0 |
| Safe transit (Square ↔ Triangle — both have flat sides) | **0** | no change |
| Curve-mismatch (Circle ↔ Square, Circle ↔ Triangle) | **+3** | **+1** corruption |

**The "safe transit" tier is significant.** Square and Triangle can pass through each other without harm or reward. This is the mechanical expression of their partnership (see §10). Circle has no safe transit with any other form — Circle is alone among the three.

### 4.2 Corruption — the geometric law

> **A form can carry corruption up to half its sides, but no further. Beyond that, the form breaks.**

Formally: `corruption ≤ floor(sides / 2)` survives. One more kills.

| Form | Sides | Max corruption | Dies at |
|---|---|---|---|
| Square | 4 | **2 curves** | 3 curves |
| Triangle | 3 | **1 curve** | 2 curves |
| Circle | 2 (as D-shape composite) | **1 straight** | 2 straights |

**This asymmetry is intentional.** Square has twice the corruption budget of Circle and Triangle. The math falls out of the geometry, and the geometry is the personality (see §10).

### 4.3 Cleansing

Absorbing a same-element shape resets corruption to **0**, regardless of how much corruption you'd accumulated. This is the only way to recover.

## 5. The Hunters

Three non-sacred forms have appeared in the corrupted realms. They are not part of the grammar. Each one is fatal to two of the three Sacred Forms.

| Hunter | Death to | Absorbable by |
|---|---|---|
| **Hexagon** | Circle | Square, Triangle |
| **Moon** | Square, Triangle | Circle |
| **Star** | Circle, Square | Triangle |

### 5.1 Hunter scoring

Absorbing a hunter scores **−3 points** (the form pays a price to defeat the hunter). Hunters are never neutral — they always cost.

### 5.2 The costume rule

Immediately after absorbing a hunter, the form is **costumed** — visually distorted (Square gains a pentagonal edge; Triangle takes on a squared profile; Circle takes on a curved hunter-edge). Mechanically:

- The next move **must** be a same-element absorption (a cleanse).
- Any other move — moving onto a different element, onto another hunter, or being unable to move — is death.

The costume is removed by the cleanse. The form returns to its pure state, score unchanged from the cleanse itself (cleanse during costume scores 0, not 10).

### 5.3 Stepping onto a death hunter = instant loss

If the player moves onto a hunter that is death to their form (e.g. Circle onto Hexagon), the level ends immediately. There is no recovery.

## 6. Win Condition

A rite is won when the player reaches **50 points** OR more.

## 7. Loss Conditions

The rite is lost when any of the following occurs:

1. Corruption exceeds the form's budget (see §4.2).
2. The form moves onto a hunter that is death to it (see §5.3).
3. The form is costumed and fails to cleanse on the very next move (see §5.2).
4. No valid moves are available (all adjacent cells are empty or contain death hunters).

## 8. Realm Structure

- Each **realm** contains **6 rites**.
- Each realm has its own theme and visual identity.
- **Each Sacred Form plays 2 rites per realm**, in the order Square → Circle → Triangle (the order they wake — see §10).

### 8.1 Exception clause

If a realm's hunter is fatal to a form, that form's two rites in that realm use a **different hunter** that the form can engage with. This preserves the "two per shape per realm" rule even when raw fatality would prevent it.

### 8.2 Current realms

**Realm I — First Rites (Rites 1–6).** No hunters. The three forms wake and reclaim the basic world.
- Square: Rites 1–2
- Circle: Rites 3–4
- Triangle: Rites 5–6

**Realm II — Hexagon Rites (Rites 7–12).** The Hexagon enters. All three forms can survive a hexagon-touched world: Square and Triangle absorb hexagons, Circle navigates around them (Hexagon is death to Circle, so Circle's rites in this realm contain few or zero hexagons placed only in avoidable positions).
- Square: Rites 7–8
- Circle: Rites 9–10
- Triangle: Rites 11–12

**Realm III — [name TBD; current placeholder "Hexagon Chase" no longer fits] (Rites 13–18).** Hexagon AND Moon both appear. The pairing is forced by the exception clause (§8.1): Circle needs a hunter to fight, and Moon is the only hunter that is not fatal to Circle.
- Square: Rites 13–14 (Hexagons absorbable; Moons are death — must be avoided)
- Circle: Rites 15–16 (Moons absorbable; Hexagons are death — must be avoided)
- Triangle: Rites 17–18 (Hexagons absorbable; Moons are death — must be avoided)

**Restructure note:** The existing Rites 13–18 files were designed before this rule was locked. Current layout is 3 Square + 3 Triangle, no Circle. Two existing rites (one Square, one Triangle) need to be cut and replaced with two new Circle rites featuring the Moon hunter. The solver must re-verify all six.

## 9. Personalities — direction locked, prose pending

Personalities are conveyed **multi-channel**: through narrator prose, environment art, and movement animation. **The Sacred Forms have no voices.** They never speak. Their identity is delivered by what surrounds them, how the world describes them, and how they move.

### 9.1 The three forms

- **Square — *holds*.** The foundation. Wakes first because it bears the weight. Mechanically the tank (2-corruption budget). Environment: moor, standing stones, ground. Partner to Triangle (safe transit).

- **Circle — *remembers*.** The eldest of the three. Watches. Has outlasted everything it once leaned on. Mechanically the most isolated (no safe transit with any form, 1-corruption budget). Environment: the reflecting pool, the moon. Wakes second, summoned by Square's stirring.

- **Triangle — *points*.** The actor. Chose its direction long ago and has not turned since. Mechanically the partner to Square (safe transit), 1-corruption budget. Environment: peaks, spear-stones, ascent. Wakes third, when the call to act is unambiguous.

### 9.2 The waking order = the tutorial order = the genealogy

Square → Circle → Triangle is not arbitrary. It is the order in which the forms wake from the long sleep, and the order in which the player meets them. The youngest (Square) wakes first because it bears the weight. The eldest (Circle) wakes second because the youngest's stirring summoned it. The middle (Triangle) wakes third because the actor only acts when called.

### 9.3 The relationship structure

- **Square + Triangle are paired** (safe transit between them).
- **Circle is the lonely third** (no safe transit with anyone).

This is encoded directly in the mechanics, not just the prose.

## 10. Hidden rules (currently in the engine, not previously documented)

These are mechanics the engine enforces that the napkin doc never stated. Codifying them here so future contributors don't trip over them:

- **Cleanse during costume = 0 points.** A cleanse that removes a hunter costume does not score the normal +10. It scores 0. The cleanse exists to save the form, not to score.
- **Corruption resets on cleanse, not decrements.** Two curves followed by a cleanse → 0 curves, not 1 curve.
- **The player's element is fixed for the rite.** Hunter costumes change the *appearance* of the form, not the *element*. A pentagon-costumed Square is still a Square and still needs to absorb a Square to cleanse (not a pentagon, not anything else).
- **Triangle and Square see "Triangle ↔ Square" as safe transit; Circle does not get a safe transit with any form.** This must be visible to the player somehow — current build has not solved this UI problem.

## 11. Open Questions (work owed)

These are not nice-to-haves. They are unresolved.



3. **Movement animation per shape.** The "multi-channel personality" promise (§9) includes movement. Currently all three forms move identically in the build. Triangle's anticipation/orientation, Square's settle, Circle's already-there beat — none of these exist yet. This is a frontend project, not a prompt.

4. **Per-shape per-realm narrative snippets.** Roughly **9 short prose fragments** are needed (3 realms × 3 forms), delivered the first time the player meets a form in a given realm. Tone: third person, sparse, no dialogue.

5. **Hunter-costume visual specifications.** Pentagon-Square exists conceptually. Square-costumed Triangle exists conceptually. The other costumes (Circle absorbing Moon, Triangle absorbing Star) have no defined visual yet.

6. **Realms IV+.** When does the Star enter? What's the climax? The current narrative implies "the disrespect was emergent, not a single villain" — but if the game ends in 18 rites with no final encounter, that's a design statement. If it ends with a final encounter, that encounter has not been designed.

7. **The 50-point threshold.** Constant across all 18 rites. Is it constant forever, or does it scale with grid size in later realms? Current build assumes constant.

8. **Stuck-loss UX.** What does the player see when they have no valid moves? "Level failed" with no explanation, or an explicit "No moves remaining"?

---

*This document supersedes all prior rule sketches. Update this document, not the older ones, when rules change.*
