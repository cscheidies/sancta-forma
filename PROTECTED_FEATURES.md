# Protected Features — DO NOT REVERT WITHOUT RESTORING

When reverting `index.html` or `src/ui.js`, you MUST verify these features survive.
Run `node scripts/verify-features.js` after any revert. Fix before deploying.

## index.html

### 1. Fog Rendering (commits 2745cd4, 15026b5)
- `drawFogOnCtx` must use `m.ox * W` in the drift calculation
- The render loop must call `drawMist(now)` — NOT `drawMistLayer`
- grep check: `grep "m.ox \* W" index.html && grep "drawMist(now)" index.html`

### 2. Glowing "Restore the Balance" text (commit fc36f52)
- The `.restore-cta` element must exist with `animation: restorePulse`
- grep check: `grep "restorePulse" index.html`

## src/ui.js

### 3. Roman numeral realm labels (commit 2745cd4)
- `const ROMAN = [` and `function realmLabel(` must exist
- grep check: `grep "realmLabel" src/ui.js`

### 4. Realm VI + Realm VII definitions (bffb0cf)
- REALMS array must contain id:6 and id:7 entries
- grep check: `grep "Star Journey\|Realm VI" src/ui.js`

### 5. Background map for L19-42 (bffb0cf, 3fead01)
- LEVEL_BACKGROUNDS must have keys 19-30 and 31-42
- grep check: `grep "bg_rite42" src/ui.js`

### 6. Unlock chain fix (bffb0cf)
- `isRealmUnlocked` must use `.filter(r => r.id < realmId).sort(` not `r.id === realmId - 1`
- grep check: `grep "filter.*id < realmId" src/ui.js`

---

## Revert Protocol

**NEVER** do `git checkout <old-commit> -- index.html` or `-- src/ui.js` for a whole-file revert.

**INSTEAD:** Use `git diff <old> <new> -- <file>` to isolate the change you want to undo,
then apply only that delta with `edit` tool. If you must use cherry-pick, immediately
run the grep checks above and fix anything missing.

**After any revert:**
```bash
grep "m.ox \* W" index.html             # fog fix
grep "tagline-breathe" index.html        # glowing text (.sf-tagline animation)
grep "realmLabel" src/ui.js              # roman numerals
grep "Star Journey" src/ui.js            # realm VII
grep "bg_rite42" src/ui.js               # bg map
grep "filter.*id < realmId" src/ui.js    # unlock chain
grep "state.grid.length" src/engine.js   # variable-grid (engine)
grep "grid\.length" src/renderer.js      # variable-grid (renderer — uses grid after destructuring)
grep "state.grid.length" src/ui.js       # variable-grid (ui)
```

All 9 must return results. If any fail — fix before `npm run build && npx vercel deploy --prod`.

**Also verify before every deploy:**
```bash
grep "base: '\./'\\|base: \"\\./\"" vite.config.js   # must be ./ not /dev/
```
⚠️ Merging from dev will pull `base: '/dev/'` — always reset to `'./'` on master before building.

## Realm VIII — The Threshold Rites (Rites 43–48)

Added 2026-05-25. Six 10×10 levels. Requires variable-grid patch.

```bash
grep "id: 8" src/ui.js                # Realm VIII entry
grep "The Threshold Rites" src/ui.js  # realm name
grep "bg_rite48" src/ui.js            # bg map complete through 48
grep '"id": 43' src/levels.json       # first 10x10 level present
grep '"id": 48' src/levels.json       # finale present
grep "Threshold" src/ui.js            # narrative passage
```

All 6 must return results after any revert touching ui.js or levels.json.

## Realm IX — The Outer Pattern (Rites 49–54)

Added 2026-05-25. Six 10×10 levels. First realm with death-hunters at 10×10 scale.

```bash
grep "id: 9" src/ui.js                # Realm IX entry
grep "The Outer Pattern" src/ui.js    # realm name
grep "bg_rite54" src/ui.js            # bg map complete through 54
grep '"id": 49' src/levels.json       # first rite present
grep '"id": 54' src/levels.json       # finale present
grep "Wider" src/ui.js                # narrative passage
```

## Realm X — The Pattern Speaks (Rites 55–60)

Added 2026-05-25. Six 10×10 medium-difficulty levels. First realm with custom start positions (edge/corner, not [4,4]). Solver-verified (A* solver).

```bash
grep "id: 10" src/ui.js                # Realm X entry
grep "The Pattern Speaks" src/ui.js    # realm name
grep "bg_rite60" src/ui.js             # bg map complete through 60
grep '"id": 55' src/levels.json        # first rite present
grep '"id": 60' src/levels.json        # finale present
grep "Speaks" src/ui.js                # narrative passage
```

All 6 must return results after any revert touching ui.js or levels.json.


## Orientation-aware layout

The game adapts to landscape and portrait via CSS media queries.

In landscape: HUD sits to the right of the grid.
In portrait: HUD sits below the grid (current behavior).

```bash
grep "@media (orientation: landscape)" index.html
grep "isLandscape" src/ui.js
grep "onOrientationChange" src/ui.js
```

All 3 must return results after any revert touching index.html or src/ui.js.

## Landscape layout — logo clearance

Landscape layout uses `--logo-offset` (set by `syncLogoH()`) as `padding-top` on the
wrapper so the grid never collides with the fixed-position logo.

```bash
grep "padding-top: calc(var(--logo-offset" index.html
grep -- "--logo-offset" index.html
grep "syncLogoH" index.html
```

## Dev mode unlock-all

The /dev path unlocks every level and skips localStorage persistence.
Regex: `^/dev(/|$)` — /dev-build and /development do NOT activate it.

```bash
grep "isDevMode" src/ui.js
grep "_devModeOverride" src/ui.js
```
