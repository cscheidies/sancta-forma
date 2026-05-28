// ui.js — HUD, screens, and event handling. Bridges game logic + renderer.

import { initState, getValidMoves, applyMove, RULES } from './engine.js';
import * as sfx from './sfx.js';
import { SFNTracker, buildSFNToken } from './sfn.js';

// Returns the actual rendered logo bottom + gap, falling back to 220px.
// window.__logoH is set (and kept current) by syncLogoH() in index.html.
function logoH() {
  return (window.__logoH || 220) + 'px';
}

// ── Orientation detection (CSS handles layout; JS only exposes the state) ───
//
// Per MDN as of 2024, window.orientation and the orientationchange event are
// deprecated. The Screen Orientation API (screen.orientation) is the modern
// standard, but matchMedia is simpler and universally supported including
// older iOS Safari.

const _orientationMQ = window.matchMedia('(orientation: landscape)');

export function isLandscape() {
  return _orientationMQ.matches;
}

// Notify any registered callbacks when orientation changes. Used by code that
// needs to react beyond CSS layout (e.g., recalculating SVG hit-test math if
// the grid resizes — currently nothing uses this, but it's wired in).
const _orientationListeners = new Set();

export function onOrientationChange(callback) {
  _orientationListeners.add(callback);
  return () => _orientationListeners.delete(callback);
}

_orientationMQ.addEventListener('change', (e) => {
  for (const cb of _orientationListeners) {
    try { cb(e.matches /* isLandscape */); } catch (err) {
      console.error('Orientation listener error:', err);
    }
  }
});

// Per-rite background images
const LEVEL_BACKGROUNDS = {
  1:  './bg_rite1.jpg',
  2:  './bg_rite2.jpg',
  3:  './bg_rite3.jpg',
  4:  './bg_rite4.jpg',
  5:  './bg_rite5.jpg',
  6:  './bg_rite6.jpg',
  7:  './bg_rite7.jpg',
  8:  './bg_rite8.jpg',
  9:  './bg_rite9.jpg',
  10: './bg_rite10.jpg',
  11: './bg_rite11.jpg',
  12: './bg_rite12.jpg',
  13: './bg_rite13.jpg',
  14: './bg_rite14.jpg',
  15: './bg_rite15.jpg',
  16: './bg_rite16.jpg',
  17: './bg_rite17.jpg',
  18: './bg_rite18.jpg',
  19: './bg_rite19.jpg',
  20: './bg_rite20.jpg',
  21: './bg_rite21.jpg',
  22: './bg_rite22.jpg',
  23: './bg_rite23.jpg',
  24: './bg_rite24.jpg',
  25: './bg_rite25.jpg',
  26: './bg_rite26.jpg',
  27: './bg_rite27.jpg',
  28: './bg_rite28.jpg',
  29: './bg_rite29.jpg',
  30: './bg_rite30.jpg',
  31: './bg_rite31.jpg',
  32: './bg_rite32.jpg',
  33: './bg_rite33.jpg',
  34: './bg_rite34.jpg',
  35: './bg_rite35.jpg',
  36: './bg_rite36.jpg',
  37: './bg_rite37.jpg',
  38: './bg_rite38.jpg',
  39: './bg_rite39.jpg',
  40: './bg_rite40.jpg',
  41: './bg_rite41.jpg',
  42: './bg_rite42.jpg',
  43: './bg_rite43.jpg',
  44: './bg_rite44.jpg',
  45: './bg_rite45.jpg',
  46: './bg_rite46.jpg',
  47: './bg_rite47.jpg',
  48: './bg_rite48.jpg',
  49: './bg_rite49.jpg',
  50: './bg_rite50.jpg',
  51: './bg_rite51.jpg',
  52: './bg_rite52.jpg',
  53: './bg_rite53.jpg',
  54: './bg_rite54.jpg',
  55: './bg_rite55.jpg',
  56: './bg_rite56.jpg',
  57: './bg_rite57.jpg',
  58: './bg_rite58.jpg',
  59: './bg_rite59.jpg',
  60: './bg_rite60.jpg',
  61: './bg_rite61.jpg',
  62: './bg_rite62.jpg',
  63: './bg_rite63.jpg',
  64: './bg_rite64.jpg',
  65: './bg_rite65.jpg',
  66: './bg_rite66.jpg',
  67: './bg_rite67.jpg',
  68: './bg_rite68.jpg',
  69: './bg_rite69.jpg',
  70: './bg_rite70.jpg',
  71: './bg_rite71.jpg',
  72: './bg_rite72.jpg',
  73: './bg_rite73.jpg',
  74: './bg_rite74.jpg',
  75: './bg_rite75.jpg',
  76: './bg_rite76.jpg',
  77: './bg_rite77.jpg',
  78: './bg_rite78.jpg',
  79: './bg_rite79.jpg',
  80: './bg_rite80.jpg',
  81: './bg_rite81.jpg',
  82: './bg_rite82.jpg',
  83: './bg_rite83.jpg',
  84: './bg_rite84.jpg',
  85: './bg_rite85.jpg',
  86: './bg_rite86.jpg',
  87: './bg_rite87.jpg',
  88: './bg_rite88.jpg',
  89: './bg_rite89.jpg',
  90: './bg_rite90.jpg',
};

// Cell fill opacity per level — higher = darker grid (use when bg is bright/light)
const LEVEL_CELL_OPACITY = {
  7:  0.52,
  8:  0.52,
  9:  0.42,
  10: 0.42,
  11: 0.42,
  12: 0.38,
  13: 0.34,  // dark misty green (dense hex columns)
  14: 0.34,
  15: 0.34,
  16: 0.34,
  17: 0.42,  // purple night, moderate
  18: 0.48,  // bright full-moon mountain sky — finale
  43: 0.22,  // Realm VIII — tune once backgrounds are in
  44: 0.26,
  45: 0.30,
  46: 0.36,
  47: 0.42,
  48: 0.48,
  49: 0.32,
  50: 0.36,
  51: 0.30,
  52: 0.38,
  53: 0.28,
  54: 0.46,
  55: 0.42,  // Realm X — collapsing star, bright accretion regions
  56: 0.40,  // crystal fracture — heavy contrast
  57: 0.36,  // eclipse — moon bright accent on dark sky
  58: 0.38,  // cell dissolution — variable
  59: 0.30,  // gravitational lens — darkest, mostly void
  60: 0.44,  // singularity snowflake — bright crystal accents
  79: 0.30,  // Realm XIV Angustia — edge-blocked moon wall, claustrophobic
  80: 0.32,
  81: 0.28,  // star wall — darker edge mass
  82: 0.30,
  83: 0.32,
  84: 0.36,  // finale — slightly brighter for the final crossing
  85: 0.82,  // Realm XV Somnium — very light sumi-e bgs, max darkness
  86: 0.82,
  87: 0.82,
  88: 0.82,
  89: 0.82,
  90: 0.85,  // finale
};
function levelCellOpacity(levelId) {
  return LEVEL_CELL_OPACITY[levelId] ?? 0.22;
}

// Active bg layer tracker (crossfade: swap between bg-a and bg-b)
let _activeBgId = 'bg-a';

function setLevelBg(levelId) {
  const bg = LEVEL_BACKGROUNDS[levelId];
  const starfield = document.getElementById('starfield');
  const titleBg = document.getElementById('bg-title');
  const nextId  = _activeBgId === 'bg-a' ? 'bg-b' : 'bg-a';
  const current = document.getElementById(_activeBgId);
  const next    = document.getElementById(nextId);

  // Fade out title bg when entering a rite
  if (titleBg) titleBg.style.opacity = '0';

  if (bg && next && current) {
    _activeBgId = nextId;
    if (starfield) starfield.style.opacity = '0.35';
    window.sfPhotoMode = true;

    // Preload the image before crossfading — prevents black-flash when not cached
    const doSwap = () => {
      next.style.backgroundImage = `url("${bg}")`;
      next.style.opacity = '0';
      requestAnimationFrame(() => requestAnimationFrame(() => {
        next.style.opacity    = '1';
        current.style.opacity = '0';
      }));
    };
    const preload = new Image();
    preload.onload  = doSwap;
    preload.onerror = doSwap; // show regardless on error
    preload.src = bg;
  } else if (current) {
    current.style.opacity = '0';
    if (starfield) starfield.style.opacity = '1';
    window.sfPhotoMode = false;
  }
}

function clearLevelBg() {
  const a = document.getElementById('bg-a');
  const b = document.getElementById('bg-b');
  if (a) a.style.opacity = '0';
  if (b) b.style.opacity = '0';
  // Restore title bg on non-game screens
  const titleBg = document.getElementById('bg-title');
  if (titleBg) requestAnimationFrame(() => requestAnimationFrame(() => {
    titleBg.style.opacity = '1';
  }));
  const starfield = document.getElementById('starfield');
  if (starfield) starfield.style.opacity = '0.65';
  window.sfPhotoMode = true;
  document.getElementById('lore-overlay')?.remove();
}

import {
  createGridSVG, renderState, flashCell, showScorePopup,
  highlightValidMoves, ELEMENT_COLORS, CELL_SIZE,
} from './renderer.js';

// ── Realm definitions ─────────────────────────────────────────────────────
const ROMAN = ['I','II','III','IV','V','VI','VII','VIII','IX','X','XI','XII','XIII','XIV'];
function realmLabel(realm) {
  return `Realm ${ROMAN[realm.id - 1] || realm.id} — ${realm.name}`;
}

const REALMS = [
  { id: 1, name: 'The First Rites',   levelIds: [1,2,3,4,5,6]          },
  { id: 2, name: 'The Hexagon Rites', levelIds: [7,8,9,10,11,12]       },
  { id: 3, name: 'The Hexagon Chase', levelIds: [13,14,15,16,17,18]    },
  { id: 4, name: 'Moon Rites',        levelIds: [19,20,21,22,23,24]    },
  { id: 5, name: 'Moon Passage',      levelIds: [25,26,27,28,29,30]    },
  { id: 6, name: 'The Star Rites',    levelIds: [31,32,33,34,35,36]    },
  { id: 7, name: 'The Star Journey',    levelIds: [37,38,39,40,41,42]    },
  { id: 8, name: 'The Threshold Rites', levelIds: [43,44,45,46,47,48]    },
  { id: 9,  name: 'The Outer Pattern',    levelIds: [49,50,51,52,53,54]    },
  { id: 10, name: 'The Pattern Speaks',  levelIds: [55,56,57,58,59,60]    },
  { id: 11, name: 'In Medias Res',       levelIds: [61,62,63,64,65,66]    },
  { id: 12, name: 'Acies',              levelIds: [67,68,69,70,71,72]    },
  { id: 13, name: 'Ultima Vigilia',     levelIds: [73,74,75,76,77,78]    },
  { id: 14, name: 'Angustia',           levelIds: [79,80,81,82,83,84]    },
  { id: 15, name: 'Somnium',            levelIds: [85,86,87,88,89,90]    },
];

// Per-form narrative beats shown before the first rite of each form in a realm.
const PRE_LEVEL_BEATS = {
  79: {
    heading: 'The Narrow Place',
    lines: [
      'The ground had not given up. The ground had merely contracted.',
      'The Square contracted with it, and stood.',
    ],
  },
  81: {
    heading: 'The After',
    lines: [
      'The Circle had outlasted what came before this.',
      'The Circle did not yet know if it would outlast the after.',
    ],
  },
  83: {
    heading: 'Direction',
    lines: [
      'The horizon was closer. The Triangle still pointed.',
      'Distance was not the test. Direction was.',
    ],
  },
  73: {
    heading: 'The Stones Were Whole',
    lines: [
      'The Square remembered when the stones had been whole.',
      'The Square remembered when remembering was easy.',
    ],
  },
  75: {
    heading: 'Every Watch Before',
    lines: [
      'The Circle had outlasted every watch before this one.',
      'The Circle did not assume it would outlast this one.',
    ],
  },
  77: {
    heading: 'No Words',
    lines: [
      'The Triangle pointed at what was coming.',
      'There were no words for what was coming.',
    ],
  },
  67: {
    heading: 'The Ground',
    lines: [
      'The ground beneath the Square did not move.',
      'This was the whole point of being the Square.',
    ],
  },
  69: {
    heading: 'The Lines',
    lines: [
      'The Circle had seen many lines.',
      'The Circle had outlasted some of them.',
      'Not all.',
    ],
  },
  71: {
    heading: 'The Point',
    lines: [
      'A point does not flinch.',
      'The Triangle was not made for flinching.',
    ],
  },
  61: {
    heading: 'The Stones',
    lines: [
      'The stones had been here longer than the Square',
      'remembered being the Square.',
      'They had not asked to hold the line.',
      'Holding was what they were.',
    ],
  },
  63: {
    heading: 'The Pool',
    lines: [
      'The pool had not been still in a long time.',
      'Whatever passed across the moon\'s face',
      'passed also across the pool,',
      'and the Circle saw both without choosing.',
    ],
  },
  65: {
    heading: 'The Peaks',
    lines: [
      'The peaks were sharper than the Triangle.',
      'They always had been.',
      'The Triangle did not envy them.',
      'The Triangle pointed.',
    ],
  },
  85: {
    heading: 'The Ground That Folds',
    lines: [
      'The ground was still ground. The Square was relieved.',
      'But the ground sometimes folded, and the Square had not been',
      'built for ground that folded.',
    ],
  },
  87: {
    heading: 'The Pool',
    lines: [
      'The pool reflected something it had not been built to reflect.',
      'The Circle accepted this without comment.',
      'The Circle had outlasted stranger things.',
    ],
  },
  89: {
    heading: 'The Reachable Horizon',
    lines: [
      'The horizon could be reached by pointing at it directly.',
      'The Triangle did not know how to feel about this.',
    ],
  },
};

function getRealmForLevel(levelId) {
  return REALMS.find(r => r.levelIds.includes(levelId)) || REALMS[0];
}

// Returns the 0-based position of a level within its realm (0–5 → Rite I–VI)
function riteIndex(levelId) {
  const realm = getRealmForLevel(levelId);
  return realm.levelIds.indexOf(levelId); // -1 if not found → fallback
}

function isRealmUnlocked(realmId, progress) {
  if (realmId === 1) return true;
  // Find the highest-id realm that comes before this one (handles non-sequential ids)
  const prev = REALMS.filter(r => r.id < realmId).sort((a, b) => b.id - a.id)[0];
  if (!prev) return true;
  return prev.levelIds.every(id => progress.completed.includes(id));
}

// Return the first unlocked-but-incomplete level id, in realm order.
// Falls back to the last unlocked level if everything is done.
function getLatestRiteId(progress) {
  const ordered = REALMS.flatMap(r => r.levelIds);
  const frontier = ordered.find(id =>
    progress.unlocked.includes(id) && !progress.completed.includes(id)
  );
  if (frontier) return frontier;
  // All done — return last unlocked
  const unlocked = ordered.filter(id => progress.unlocked.includes(id));
  return unlocked[unlocked.length - 1] ?? 1;
}

const STORAGE_KEY = 'shape-puzzle-progress';

// Detect dev mode by URL path. Anything matching /dev or /dev/* activates
// unlock-all behavior. Production at sanctaforma.com (no /dev) keeps the
// normal unlock chain. /dev-build or /development paths do NOT activate this.
function isDevMode() {
  if (typeof window === 'undefined') return false;
  return /^\/dev(\/|$)/.test(window.location.pathname);
}

function loadProgress() {
  // Dev mode: every level unlocked and completed for friction-free testing.
  if (isDevMode()) {
    const allLevelIds = REALMS.flatMap(r => r.levelIds);
    return {
      unlocked:  allLevelIds.slice(),
      completed: allLevelIds.slice(),
      _devModeOverride: true,
    };
  }
  // Production: load from localStorage as before.
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || { unlocked: [1], completed: [] };
  } catch { return { unlocked: [1], completed: [] }; }
}

function saveProgress(progress) {
  if (isDevMode()) return; // don't clobber real progress with dev sessions
  localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
}

// ─── Shape SVG helper ─────────────────────────────────────────────────────

function _drawShapeSVG(svgEl, element, corruption) {
  const ns = 'http://www.w3.org/2000/svg';
  svgEl.innerHTML = '';
  const color = ELEMENT_COLORS[element];
  const c = corruption;
  let pathD;

  if (element === 'square') {
    if (c === 0)      pathD = `M 4,4 L 32,4 L 32,32 L 4,32 Z`;
    else if (c === 1) pathD = `M 18,4 A 14,14 0 0 1 18,32 L 4,32 L 4,4 Z`;
    else              pathD = `M 10,4 L 26,4 A 14,14 0 0 1 26,32 L 10,32 A 14,14 0 0 1 10,4 Z`;
  } else if (element === 'circle') {
    if (c === 0) pathD = `M 4,18 A 14,14 0 1 0 32,18 A 14,14 0 1 0 4,18 Z`;
    else         pathD = `M 4,18 A 14,14 0 0 1 32,18 Z`;
  } else { // triangle
    if (c === 0) pathD = `M 18,4 L 32,32 L 4,32 Z`;
    else         pathD = `M 18,4 L 32,32 A 18,9 0 0 1 4,32 Z`;
  }

  const el = document.createElementNS(ns, 'path');
  el.setAttribute('d', pathD);
  el.setAttribute('fill', color);
  el.setAttribute('fill-opacity', '0.25');
  el.setAttribute('stroke', color);
  el.setAttribute('stroke-width', '2.5');
  svgEl.appendChild(el);
}

// ─── HUD ──────────────────────────────────────────────────────────────────

function updateHUD(hud, state) {
  const { player } = state;
  const rules      = RULES[player.element];
  const corrMax    = rules.deathAt - 1; // max safe corruption (deathAt is instant kill)
  const _rIdx = riteIndex(parseInt(hud.dataset.level));
  const roman = ['I','II','III','IV','V','VI'][_rIdx] ?? hud.dataset.level;

  hud.querySelector('.hud-level').textContent = `✦ Rite ${roman}`;
  hud.querySelector('.hud-score').textContent = `${player.score} / ${state.winScore}`;
  hud.querySelector('.hud-score').style.color = player.score >= state.winScore ? '#69ff47' : '#fff';

  const corrEl = hud.querySelector('.hud-corruption');
  corrEl.textContent = `${player.corruption} / ${corrMax}`;
  if      (player.corruption === 0)        corrEl.style.color = '#69ff47';
  else if (player.corruption < corrMax)    corrEl.style.color = '#ffcc00';
  else                                     corrEl.style.color = '#ff4747';

  // Origin shape (always static)
  _drawShapeSVG(hud.querySelector('.hud-origin-svg'), player.originalElement, 0);
  const originNameEl = hud.querySelector('.hud-origin-name');
  originNameEl.textContent = player.originalElement.toUpperCase();
  originNameEl.style.color = ELEMENT_COLORS[player.originalElement];

  // Current manifest form
  _drawShapeSVG(hud.querySelector('.hud-player-mini'), player.element, player.corruption);
  const currentNameEl = hud.querySelector('.hud-current-name');
  const arrow         = hud.querySelector('.hud-identity-arrow');

  if (player.costumed) {
    // Costumed — orange-red alarm, must cleanse next move
    currentNameEl.textContent = `${player.element.toUpperCase()} ✦ CLEANSE`;
    currentNameEl.style.color = '#ff6020';
    if (arrow) arrow.style.color = '#ff6020';
    hud.style.boxShadow = '0 0 22px rgba(255,80,20,0.55), inset 0 0 20px rgba(200,60,0,0.15)';
  } else if (player.corruption > 0) {
    currentNameEl.textContent = player.element.toUpperCase();
    currentNameEl.style.color = '#ffcc00';
    if (arrow) arrow.style.color = '#ffcc00';
    hud.style.boxShadow = '';
  } else {
    currentNameEl.textContent = player.element.toUpperCase();
    currentNameEl.style.color = ELEMENT_COLORS[player.element];
    if (arrow) arrow.style.color = '#3d4d5e';
    hud.style.boxShadow = '';
  }
}

// ─── Game screen ──────────────────────────────────────────────────────────

export class GameScreen {
  constructor(container, levels) {
    this.container = container;
    this.levels = levels;
    this.currentRealm = 1;
    this.state = null;
    this.svg = null;
    this.hud = null;
    this.levelIndex = 0;
    this.progress = loadProgress();
    this._keyHandler = this._onKey.bind(this);
  }

  showTitle() {
    clearLevelBg();
    this._removeOverlay(); this.container.innerHTML = '';
    document.removeEventListener('keydown', this._keyHandler);
    if (this.svg && this._tapHandler) this.svg.removeEventListener('pointerdown', this._tapHandler);
    if (this._orientationUnsub) { this._orientationUnsub(); this._orientationUnsub = null; }

    const screen = document.createElement('div');
    screen.className = 'screen title-screen';
    screen.innerHTML = `
      <div style="flex:1"></div>
      <p class="sf-tagline">Restore the balance</p>
      <div class="title-btn-row" style="margin-top:32px">
        <button class="title-btn" id="title-how">HOW</button>
        <button class="title-btn primary" id="title-begin">ENTER THE RITES</button>
        <button class="title-btn" id="title-why">WHY</button>
      </div>
      <div class="title-btn-row" style="margin-top:14px">
        <button class="title-btn" id="title-forge">◇ THE FORGE</button>
      </div>
    `;

    this.container.appendChild(screen);
    requestAnimationFrame(() => screen.classList.add('visible'));

    screen.querySelector('#title-how').addEventListener('click', () => this.showHowToPlay());
    screen.querySelector('#title-begin').addEventListener('click', () => this.showLevelSelect());
    screen.querySelector('#title-why').addEventListener('click', () => this.showNarrative());
    screen.querySelector('#title-forge').addEventListener('click', () => {
      window.location.href = window.location.pathname.startsWith('/dev') ? '/forge.html' : '/forge.html';
    });
  }

  showHowToPlay() {
    clearLevelBg();
    this._removeOverlay(); this.container.innerHTML = '';
    if (this._orientationUnsub) { this._orientationUnsub(); this._orientationUnsub = null; }

    const screen = document.createElement('div');
    screen.className = 'screen';
    screen.innerHTML = `
      <div style="height:${logoH()};flex-shrink:0"></div>
      <div class="howto-screen">
        <div class="screen-header">
          <h2 class="eerie-h2" style="margin-bottom:4px">How to Play</h2>
          <p class="sf-tagline" style="margin-bottom:20px">The grammar of absorption</p>
        </div>

        <div class="howto-section">
          <div class="howto-label">The Three Forms</div>
          <p class="howto-rule"><span class="arcane" style="color:#e040fb">●</span> Circle &nbsp;&nbsp;<span class="arcane" style="color:#00e5ff">■</span> Square &nbsp;&nbsp;<span class="arcane" style="color:#69ff47">▲</span> Triangle</p>
          <p class="howto-rule">You begin as one pure form. Absorb shapes by moving into them.</p>
        </div>

        <div class="howto-section">
          <div class="howto-label">Purity &amp; Death</div>
          <p class="howto-rule"><span class="danger">Each element must remain itself.</span> A form that loses its nature dies.</p>
          <p class="howto-rule"><span class="good">Absorb your own kind</span> — Essence <span>+10</span>, Corruption clears.</p>
          <p class="howto-rule"><span class="warn">Absorb a foreign shape</span> — Essence <span>+3</span>, Corruption <span>+1</span>.</p>
          <p class="howto-rule"><span class="danger">Corruption at the threshold</span> — purity fails. The form dissolves.</p>
        </div>

        <div class="howto-section">
          <div class="howto-label">Transit &amp; Transformation</div>
          <p class="howto-rule">Squares and triangles are <span class="arcane">transit pairs</span>.</p>
          <p class="howto-rule">Stepping into your transit shape <span class="arcane">transforms</span> you — no cost, no score.</p>
          <p class="howto-rule">While transformed you are <span class="danger">impure</span>. Absorb your <span class="good">original form</span> immediately to cleanse.</p>
          <p class="howto-rule"><span class="danger">Fail to cleanse</span> and the corruption of lost identity kills you.</p>
        </div>

        <div class="howto-section">
          <div class="howto-label">Victory</div>
          <p class="howto-rule">Gather enough Essence to complete the rite. The threshold is shown in your panel.</p>
        </div>

        <div class="howto-section">
          <div class="howto-label">Keyboard Controls</div>
          <p class="howto-rule" style="margin-bottom:10px">The entire game is playable without touching the screen.</p>
          <div class="howto-keys">
            <div class="howto-keys-keys">
              <span class="kbd">↑</span> <span class="kbd">↓</span> <span class="kbd">←</span> <span class="kbd">→</span>
            </div>
            <div class="howto-keys-action">Move — absorb the shape in that direction</div>

            <div class="howto-keys-keys">
              <span class="kbd">W</span> <span class="kbd">A</span> <span class="kbd">S</span> <span class="kbd">D</span>
            </div>
            <div class="howto-keys-action">Move — same as arrow keys</div>

            <div class="howto-keys-keys">
              <span class="kbd">1</span> – <span class="kbd">6</span>
            </div>
            <div class="howto-keys-action">Select rite 1–6 in the current realm</div>

            <div class="howto-keys-keys">
              <span class="kbd">Enter</span>
            </div>
            <div class="howto-keys-action">Launch focused rite · Retry after death or being bound · Advance after victory</div>

            <div class="howto-keys-keys">
              <span class="kbd">Space</span>
            </div>
            <div class="howto-keys-action">Launch focused rite (level select)</div>

            <div class="howto-keys-keys">
              <span class="kbd">Esc</span>
            </div>
            <div class="howto-keys-action">Return to title from any menu screen</div>
          </div>
        </div>

        <div class="howto-section">
          <div class="howto-label">Sancta Forma Notation</div>
          <p class="howto-rule">The HUD trace strip records your moves in <span class="arcane">SFN</span> — a compact notation for replaying or analysing a rite.</p>
          <p class="howto-rule" style="margin-top:8px">Each token is <span class="arcane">column · row · glyph · suffix</span>:</p>
          <p class="howto-rule" style="margin:8px 0 4px">
            <span class="sfn-token">c2T</span> moved to c2, absorbed a Triangle
          </p>
          <p class="howto-rule" style="margin:4px 0">
            <span class="sfn-token hunter">d3H!</span> absorbed a Hunter (Hexagon)
          </p>
          <p class="howto-rule" style="margin:4px 0">
            <span class="sfn-token cleanse">b1S*</span> cleansing absorption — corruption reset
          </p>
          <p class="howto-rule" style="margin:4px 0">
            <span class="sfn-token fatal">e5C#</span> fatal move — the form dissolved
          </p>
          <p class="howto-rule" style="margin-top:10px">Columns run <span class="arcane">a – e</span> left to right on a 5×5 grid, <span class="arcane">a – j</span> (no i) on a 10×10. Rows run <span class="arcane">1</span> (top) to <span class="arcane">5</span> or <span class="arcane">10</span> (bottom). Every fifth move the trace indents — a visual breath between groups.</p>
          <div class="sfn-grid-legend" style="margin-top:10px">
            <p class="howto-rule" style="margin:0"><span class="arcane">S</span> — Square</p>
            <p class="howto-rule" style="margin:0"><span class="arcane">C</span> — Circle</p>
            <p class="howto-rule" style="margin:0"><span class="arcane">T</span> — Triangle</p>
            <p class="howto-rule" style="margin:0"><span class="arcane">H</span> — Hexagon</p>
            <p class="howto-rule" style="margin:0"><span class="arcane">M</span> — Moon</p>
            <p class="howto-rule" style="margin:0"><span class="arcane">St</span> — Star</p>
          </div>
        </div>

        <div style="text-align:center; margin-top:32px; padding-bottom:40px">
          <button class="title-btn primary" id="howto-back">← Return</button>
        </div>
      </div>
    `;

    this.container.appendChild(screen);
    requestAnimationFrame(() => screen.classList.add('visible'));
    screen.querySelector('#howto-back').addEventListener('click', () => this.showTitle());
  }

  showNarrative() {
    clearLevelBg();
    this._removeOverlay(); this.container.innerHTML = '';
    document.removeEventListener('keydown', this._keyHandler);
    if (this.svg && this._tapHandler) this.svg.removeEventListener('pointerdown', this._tapHandler);
    if (this._orientationUnsub) { this._orientationUnsub(); this._orientationUnsub = null; }

    // Intro-only passages — shown when player taps WHY or on first play.
    // Realm-milestone passages live in PRE_LEVEL_BEATS; do not add them here.
    const passages = [
      {
        heading: 'Before',
        lines: [
          'There were three forms.',
          'The Circle, perfect and unbroken.',
          'The Square, balanced and certain.',
          'The Triangle, sharp and resolute.',
          'Every star, every stone, every living thing',
          'was built from these.',
          'They were the grammar of reality.',
        ],
      },
      {
        heading: 'Forgetting',
        lines: [
          'But the world forgot what the three forms were.',
          'The sacred forms went unhonored.',
          'The disrespect built and built.',
        ],
      },
      {
        heading: 'Waking',
        lines: [
          'Into the silence, new shapes had come.',
          'The Hexagon, with its imitation of order.',
          'The Star, with its arrogant geometry.',
          'The Moon, hollow where roundness should be.',
          'Each one a hunter.',
          'The universe had drifted from grammar into noise.',
        ],
      },
      {
        heading: 'Reclaiming',
        lines: [
          'The three forms wake small.',
          'They must walk the line',
          'between strength and dissolution.',
          'To restore the universe,',
          'they must outlast the hunters.',
        ],
      },
      {
        heading: 'Angustia',
        lines: [
          'They had thought it was the last watch.',
          'Ultima vigilia, they had named it, because the word for "end"',
          'had been the only word that fit what they were feeling.',
          'The forms had been correct about the feeling',
          'and wrong about the end.',
          'The watch had been kept. The end had not come.',
          'The world that came after the watch',
          'was not the same world they had been defending,',
          'but it was also not no world.',
          'It was a tighter world.',
          'The Square stood on ground that was smaller than the ground had been.',
          'The Circle held water in a basin that had been re-walled, narrower.',
          'The Triangle pointed at a horizon that was closer than it should be.',
          'They had thought it was the last watch.',
          'It had been the last watch of one kind.',
          'They had not understood that other kinds were possible.',
          'Angustia. The narrow place.',
        ],
      },
      {
        heading: 'Somnium',
        lines: [
          'The narrow place opened.',
          'It did not open by widening. It opened by folding.',
          'The forms walked one moment in a moor that had been moor since',
          'before any of them remembered, and the next moment they were',
          'standing somewhere else — somewhere that had not been adjacent',
          'to the moor, somewhere that may not have been anywhere',
          'in the sense the word had previously meant.',
          'The world they had defended had been a continuous world.',
          'They had taken its continuity for granted.',
          'The world that came after the defense was not continuous.',
          'It folded. It opened sideways.',
          'Two places could become one passage. A step could be a journey.',
          'Somnium. The dream-world. The world after the defense.',
          'And the forms, who had survived everything continuous,',
          'found themselves having to learn to walk again.',
        ],
      },
    ];

    let passageIdx = 0;

    const screen = document.createElement('div');
    screen.className = 'screen narrative-screen';
    screen.innerHTML = `
      <div class="narrative-wrap">
        <div style="height:${logoH()};flex-shrink:0"></div>
        <div class="narr-wrap-inner narr-entering" id="narr-inner"></div>
      </div>
    `;
    this.container.appendChild(screen);

    const inner = screen.querySelector('#narr-inner');

    const renderPassage = (idx) => {
      const p = passages[idx];
      const stagger = 0.18;
      const btnDelay = (0.2 + p.lines.length * stagger).toFixed(2);
      inner.innerHTML = `
        <div class="narr-heading">${p.heading}</div>
        <div class="narr-lines" style="margin-top:14px">
          ${p.lines.map((l,i) => `<p class="narr-line" style="animation-delay:${(0.2 + i*stagger).toFixed(2)}s">${l}</p>`).join('')}
        </div>
        <div class="narr-actions" style="animation-delay:${btnDelay}s">
          ${idx < passages.length - 1
            ? `<button class="btn-primary" id="narr-next">Continue →</button>`
            : `<button class="btn-primary" id="narr-begin">✦ Begin the Rites</button>`
          }
          <button class="btn-ghost" id="narr-skip">Skip</button>
        </div>
      `;

      // Trigger enter animation
      requestAnimationFrame(() => {
        inner.classList.remove('narr-entering');
        inner.classList.add('narr-entered');
      });

      const advance = (dest) => {
        inner.classList.remove('narr-entered');
        inner.classList.add('narr-exiting');
        setTimeout(() => {
          inner.classList.remove('narr-exiting', 'narr-entered');
          inner.classList.add('narr-entering');
          if (dest === 'next') { passageIdx++; renderPassage(passageIdx); }
          else dest();
        }, 720);
      };

      inner.querySelector('#narr-next')?.addEventListener('click', () => advance('next'));
      inner.querySelector('#narr-begin')?.addEventListener('click', () => advance(() => this.showLevelSelect()));
      inner.querySelector('#narr-skip')?.addEventListener('click',  () => this.showTitle());
    };

    renderPassage(passageIdx);
  }

  _showPreLevelBeat(beat, onContinue) {
    if (this._orientationUnsub) { this._orientationUnsub(); this._orientationUnsub = null; }
    this._removeOverlay(); this.container.innerHTML = '';
    const screen = document.createElement('div');
    screen.className = 'screen narrative-screen';
    screen.innerHTML = `
      <div class="narrative-wrap">
        <div class="narr-wrap-inner narr-entered">
          <div class="narr-heading">${beat.heading}</div>
          <div class="narr-lines">
            ${beat.lines.map(l => `<p class="narr-line">${l}</p>`).join('')}
          </div>
          <div class="narr-actions" style="margin-top:40px">
            <button class="btn-primary" id="beat-continue">Continue</button>
          </div>
        </div>
      </div>
    `;
    this.container.appendChild(screen);
    screen.querySelector('#beat-continue').addEventListener('click', onContinue);
  }

  showLevelSelect(realmId) {
    if (realmId !== undefined) this.currentRealm = realmId;
    const realm = REALMS.find(r => r.id === this.currentRealm) || REALMS[0];
    clearLevelBg();
    this._removeOverlay(); this.container.innerHTML = '';
    document.removeEventListener('keydown', this._keyHandler);
    if (this._lsKeyCleanup) { this._lsKeyCleanup(); this._lsKeyCleanup = null; }
    if (this._orientationUnsub) { this._orientationUnsub(); this._orientationUnsub = null; }
    if (this.svg && this._tapHandler) this.svg.removeEventListener('pointerdown', this._tapHandler);

    const screen = document.createElement('div');
    screen.className = 'screen level-select';

    screen.innerHTML = `
      <div class="screen-header" style="height:${logoH()};flex-shrink:0"></div>

      <!-- REMOVED inline sigil — replaced by #global-logo fixed element -->
      <div style="display:none">
        <svg class="sf-sigil" viewBox="0 0 220 200" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <filter id="sf-glow" x="-40%" y="-40%" width="180%" height="180%">
                <feGaussianBlur stdDeviation="3.5" result="blur"/>
                <feComposite in="SourceGraphic" in2="blur" operator="over"/>
              </filter>
              <filter id="sf-glow-sm" x="-30%" y="-30%" width="160%" height="160%">
                <feGaussianBlur stdDeviation="2" result="blur"/>
                <feComposite in="SourceGraphic" in2="blur" operator="over"/>
              </filter>
            </defs>

            <!-- Outer sacred circle -->
            <circle cx="110" cy="98" r="82"
              fill="none" stroke="rgba(140,60,220,0.22)" stroke-width="0.8"/>

            <!-- Inner circle -->
            <circle cx="110" cy="98" r="54"
              fill="none" stroke="rgba(140,60,220,0.12)" stroke-width="0.5"/>

            <!-- Inscribed equilateral triangle (pointing up) -->
            <polygon points="110,16 186,138 34,138"
              fill="none" stroke="rgba(160,80,255,0.30)" stroke-width="0.8"/>

            <!-- Inverted inner triangle -->
            <polygon points="110,180 34,58 186,58"
              fill="none" stroke="rgba(160,80,255,0.14)" stroke-width="0.5"/>

            <!-- Cross-connections (dim lines between the three shapes) -->
            <line x1="110" y1="16"  x2="186" y2="138" stroke="rgba(200,150,255,0.10)" stroke-width="0.6"/>
            <line x1="110" y1="16"  x2="34"  y2="138" stroke="rgba(200,150,255,0.10)" stroke-width="0.6"/>
            <line x1="186" y1="138" x2="34"  y2="138" stroke="rgba(200,150,255,0.10)" stroke-width="0.6"/>
            <!-- Lines to centre -->
            <line x1="110" y1="98" x2="110" y2="16"  stroke="rgba(224,64,251,0.15)" stroke-width="0.5"/>
            <line x1="110" y1="98" x2="186" y2="138" stroke="rgba(0,229,255,0.15)"   stroke-width="0.5"/>
            <line x1="110" y1="98" x2="34"  y2="138" stroke="rgba(105,255,71,0.15)"  stroke-width="0.5"/>

            <!-- ── CIRCLE at apex ── -->
            <circle cx="110" cy="16" r="13"
              fill="rgba(224,64,251,0.08)" stroke="#e040fb" stroke-width="1.8"
              filter="url(#sf-glow)"/>

            <!-- ── SQUARE at bottom-right ── -->
            <rect x="176" y="128" width="20" height="20"
              fill="rgba(0,229,255,0.08)" stroke="#00e5ff" stroke-width="1.8"
              filter="url(#sf-glow)"/>

            <!-- ── TRIANGLE at bottom-left ── -->
            <polygon points="34,140 44,122 24,122"
              fill="rgba(105,255,71,0.08)" stroke="#69ff47" stroke-width="1.8"
              filter="url(#sf-glow)"/>

            <!-- Central sigil dot -->
            <circle cx="110" cy="98" r="3.5"
              fill="#a060ff" filter="url(#sf-glow)" opacity="0.9"/>
            <!-- Tiny cross at centre -->
            <line x1="104" y1="98" x2="116" y2="98" stroke="rgba(180,120,255,0.5)" stroke-width="0.7"/>
            <line x1="110" y1="92" x2="110" y2="104" stroke="rgba(180,120,255,0.5)" stroke-width="0.7"/>

            <!-- Rune marks at outer ring (small dashes at 12 positions) -->
            ${Array.from({length:12},(_,i)=>{
              const a=(i/12)*Math.PI*2-Math.PI/2;
              const r1=80,r2=86;
              const x1=110+r1*Math.cos(a), y1=98+r1*Math.sin(a);
              const x2=110+r2*Math.cos(a), y2=98+r2*Math.sin(a);
              return `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" stroke="rgba(180,120,255,0.35)" stroke-width="${i%3===0?1.4:0.7}"/>`;
            }).join('')}
          </svg>

        </svg>
      </div>

      <div class="realm-nav-row">
        <button class="realm-arrow" id="realm-prev" aria-label="Previous realm">&#8249;</button>
        <div class="realm-center">
          <div class="level-grid" id="realm-grid"></div>
        </div>
        <button class="realm-arrow" id="realm-next" aria-label="Next realm">&#8250;</button>
      </div>
      <div class="realm-label" id="realm-name">${realmLabel(realm).toUpperCase()}</div>

      <div class="title-btn-row" style="margin-top:20px; padding-bottom:8px">
        <button class="title-btn" id="ls-how">HOW</button>
        <button class="title-btn primary" id="ls-latest">LATEST RITE</button>
        <button class="title-btn" id="ls-why">WHY</button>
      </div>
      <div class="ls-idle-lore" id="ls-idle-lore"></div>
    `;

    // Populate grid with this realm's levels
    const grid = screen.querySelector('#realm-grid');
    for (const levelId of realm.levelIds) {
      const level = this.levels.find(l => l.id === levelId);
      const card = document.createElement('button');
      card.className = 'level-card';

      if (!level) {
        // Level not yet loaded — show as locked placeholder
        card.classList.add('locked');
        card.innerHTML = `<div class="card-rite">Rite</div><div class="card-num">?</div><div class="card-elem">—</div><div class="card-status">⬡</div>`;
        grid.appendChild(card);
        continue;
      }

      const isUnlocked = this.progress.unlocked.includes(level.id);
      const isCompleted = this.progress.completed.includes(level.id);
      if (!isUnlocked) card.classList.add('locked');
      if (isCompleted) card.classList.add('completed');
      if (isUnlocked && !isCompleted) card.classList.add('unlocked-unplayed');
      card.style.setProperty('--elem-color', ELEMENT_COLORS[level.playerElement]);

      const roman = ['I','II','III','IV','V','VI'][riteIndex(level.id)] ?? level.id;
      const col = ELEMENT_COLORS[level.playerElement];
      const shapeIcon = (() => {
        const e = level.playerElement;
        const s = isCompleted ? col : isUnlocked ? 'rgba(80,120,255,0.7)' : 'rgba(120,120,140,0.4)';
        if (e === 'square')
          return `<svg width="14" height="14" viewBox="0 0 14 14"><rect x="1" y="1" width="12" height="12" rx="1.5" fill="${s}" fill-opacity="0.25" stroke="${s}" stroke-width="1.5"/></svg>`;
        if (e === 'circle')
          return `<svg width="14" height="14" viewBox="0 0 14 14"><circle cx="7" cy="7" r="5.5" fill="${s}" fill-opacity="0.25" stroke="${s}" stroke-width="1.5"/></svg>`;
        if (e === 'triangle')
          return `<svg width="14" height="14" viewBox="0 0 14 14"><polygon points="7,1.5 13,12.5 1,12.5" fill="${s}" fill-opacity="0.25" stroke="${s}" stroke-width="1.5" stroke-linejoin="round"/></svg>`;
        return `<svg width="14" height="14" viewBox="0 0 14 14"><polygon points="7,1 13,7 7,13 1,7" fill="${s}" fill-opacity="0.25" stroke="${s}" stroke-width="1.5"/></svg>`;
      })();
      card.innerHTML = `
        <div class="card-rite">Rite</div>
        <div class="card-num">${roman}</div>
        <div class="card-elem">${level.playerElement.toUpperCase()}</div>
        <div class="card-status">${shapeIcon}</div>
      `;
      if (isUnlocked) card.addEventListener('click', () => {
        sfx.riteSelect?.(riteIndex(level.id), level.playerElement);
        this.startLevel(level.id);
      });
      grid.appendChild(card);
    }

    // Realm navigation
    const prevBtn = screen.querySelector('#realm-prev');
    const nextBtn = screen.querySelector('#realm-next');
    const prevRealm = REALMS.find(r => r.id === this.currentRealm - 1);
    const nextRealm = REALMS.find(r => r.id === this.currentRealm + 1);

    if (!prevRealm) prevBtn.classList.add('realm-arrow-hidden');
    else prevBtn.addEventListener('click', () => { sfx.realmNav?.('prev'); this.showLevelSelect(prevRealm.id); });

    if (!nextRealm || (!isDevMode() && !isRealmUnlocked(nextRealm.id, this.progress))) {
      nextBtn.classList.add('realm-arrow-hidden');
    } else {
      nextBtn.addEventListener('click', () => { sfx.realmNav?.('next'); this.showLevelSelect(nextRealm.id); });
    }

    screen.querySelector('#ls-how').addEventListener('click', () => this.showHowToPlay());
    screen.querySelector('#ls-why').addEventListener('click', () => this.showNarrative());
    screen.querySelector('#ls-latest').addEventListener('click', () => {
      this.startLevel(getLatestRiteId(this.progress));
    });

    // ── Keyboard navigation for level select ──────────────────────────────
    // Cards are laid out in a 3×2 grid (3 cols). Arrow keys move focus;
    // Enter/Space starts the focused unlocked rite.
    const cards = Array.from(grid.querySelectorAll('.level-card'));
    const COLS = 3;
    let lsFocus = -1; // -1 = no keyboard focus yet

    const setFocus = (idx) => {
      cards.forEach(c => c.classList.remove('ls-focused'));
      lsFocus = Math.max(0, Math.min(cards.length - 1, idx));
      cards[lsFocus].classList.add('ls-focused');
      cards[lsFocus].scrollIntoView({ block: 'nearest' });
    };

    const lsKey = (e) => {
      if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
        e.preventDefault();
        if (lsFocus === -1) { setFocus(0); return; }
        const next = lsFocus + 1;
        if (next < cards.length) setFocus(next);
        else if (nextRealm && (isDevMode() || isRealmUnlocked(nextRealm.id, this.progress))) {
          document.removeEventListener('keydown', lsKey);
          this.showLevelSelect(nextRealm.id);
        }
      } else if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
        e.preventDefault();
        if (lsFocus === -1) { setFocus(cards.length - 1); return; }
        const prev = lsFocus - 1;
        if (prev >= 0) setFocus(prev);
        else if (prevRealm) {
          document.removeEventListener('keydown', lsKey);
          this.showLevelSelect(prevRealm.id);
        }
      } else if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') {
        e.preventDefault();
        if (lsFocus === -1) { setFocus(0); return; }
        const down = lsFocus + COLS;
        if (down < cards.length) setFocus(down);
      } else if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') {
        e.preventDefault();
        if (lsFocus === -1) { setFocus(0); return; }
        const up = lsFocus - COLS;
        if (up >= 0) setFocus(up);
      } else if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        if (lsFocus === -1) { setFocus(0); return; }
        const card = cards[lsFocus];
        if (!card.classList.contains('locked')) card.click();
      } else if (e.key >= '1' && e.key <= '6') {
        e.preventDefault();
        const idx = parseInt(e.key, 10) - 1;
        if (idx < cards.length) {
          setFocus(idx);
          if (!cards[idx].classList.contains('locked')) cards[idx].click();
        }
      } else if (e.key === 'Escape') {
        document.removeEventListener('keydown', lsKey);
        this.showTitle();
      }
    };
    document.addEventListener('keydown', lsKey);
    // Clean up when navigating away
    this._lsKeyCleanup = () => document.removeEventListener('keydown', lsKey);

    // ── Idle lore — after 30s, fade realm narrative lines in/out ──────────
    const loreLine  = screen.querySelector('#ls-idle-lore');
    const firstLevel = this.levels.find(l => l.id === realm.levelIds[0]);
    const loreLines  = firstLevel?.lore ?? [];
    let idleTimer = null, loreTimeout = null, loreIdx = 0, loreRunning = false;

    const stopLore = () => {
      loreRunning = false;
      clearTimeout(loreTimeout);
      loreLine.classList.remove('visible');
    };

    const showNextLine = () => {
      if (!loreRunning || !loreLines.length) return;
      loreLine.classList.remove('visible');
      loreTimeout = setTimeout(() => {
        loreLine.textContent = loreLines[loreIdx % loreLines.length];
        loreLine.classList.add('visible');
        loreIdx++;
        loreTimeout = setTimeout(showNextLine, 4200);
      }, 700);
    };

    const startIdle = () => {
      if (loreRunning || !loreLines.length) return;
      loreRunning = true;
      loreIdx = 0;
      showNextLine();
    };

    const resetIdle = () => {
      clearTimeout(idleTimer);
      stopLore();
      idleTimer = setTimeout(startIdle, 30000);
    };

    ['pointermove','pointerdown','keydown','touchstart'].forEach(evt =>
      screen.addEventListener(evt, resetIdle, { passive: true })
    );

    idleTimer = setTimeout(startIdle, 30000);

    this._lsIdleCleanup = () => {
      clearTimeout(idleTimer);
      clearTimeout(loreTimeout);
      loreRunning = false;
    };
    const origCleanup = this._lsKeyCleanup;
    this._lsKeyCleanup = () => { origCleanup(); this._lsIdleCleanup?.(); };

    this.container.appendChild(screen);
  }

  startLevel(levelId) {
    const level = this.levels.find(l => l.id === levelId);
    if (!level) return;

    // Show a brief narrative beat before certain levels (first rite of each form in a realm).
    // The beat is shown once per session per level — tracked in _beatsShown set.
    if (!this._beatsShown) this._beatsShown = new Set();
    const beat = PRE_LEVEL_BEATS[levelId];
    if (beat && !this._beatsShown.has(levelId)) {
      this._beatsShown.add(levelId);
      this._showPreLevelBeat(beat, () => this.startLevel(levelId));
      return;
    }

    if (this._lsKeyCleanup) { this._lsKeyCleanup(); this._lsKeyCleanup = null; }
    setLevelBg(levelId);
    this._removeOverlay(); this.container.innerHTML = '';
    this.state = initState(level);

    // Build layout
    const wrapper = document.createElement('div');
    wrapper.className = 'game-wrapper';
    if (isLandscape()) wrapper.classList.add('orientation-landscape');
    else wrapper.classList.add('orientation-portrait');

    // Keep the class hint in sync if user rotates mid-game
    this._orientationUnsub = onOrientationChange((landscape) => {
      wrapper.classList.toggle('orientation-landscape', landscape);
      wrapper.classList.toggle('orientation-portrait', !landscape);
    });

    // HUD
    this.hud = document.createElement('div');
    this.hud.className = 'hud';
    this.hud.dataset.level = level.id;
    const roman = ['I','II','III','IV','V','VI','VII','VIII','IX','X'][level.id - 1] || level.id;
    this.hud.innerHTML = `
      <div class="hud-row hud-top">
        <span class="hud-level">✦ Rite ${roman}</span>
        <button class="hud-back btn-ghost">← Rites</button>
      </div>
      <div class="hud-identity">
        <div class="hud-identity-col">
          <div class="hud-identity-label">True Form</div>
          <div class="hud-identity-shape">
            <svg class="hud-origin-svg" viewBox="0 0 36 36" width="32" height="32"></svg>
            <span class="hud-origin-name"></span>
          </div>
        </div>
        <div class="hud-identity-arrow">→</div>
        <div class="hud-identity-col">
          <div class="hud-identity-label">Manifest</div>
          <div class="hud-identity-shape">
            <svg class="hud-player-mini" viewBox="0 0 36 36" width="32" height="32"></svg>
            <span class="hud-current-name"></span>
          </div>
        </div>
      </div>
      <div class="hud-row hud-stats-row">
        <div class="hud-stat">
          <span class="hud-stat-label">Corruption</span>
          <span class="hud-corruption"></span>
        </div>
        <div class="hud-stat hud-stat-right">
          <span class="hud-stat-label">Essence</span>
          <span class="hud-score"></span>
        </div>
      </div>
      <div class="hud-trace">
        <span class="hud-trace-label">Trace</span>
        <div class="hud-trace-strip" id="hud-trace-strip"></div>
      </div>
    `;
    this.hud.querySelector('.hud-back').addEventListener('click', () => this.showLevelSelect());

    // SFN trace strip — pass the element directly (hud isn't in the DOM yet,
    // so getElementById would return null; querySelector on hud works immediately)
    this.tracker = new SFNTracker(this.hud.querySelector('#hud-trace-strip'));
    this._sfnMoveCount = 0;

    // Grid SVG
    this.svg = createGridSVG({
      cellFillOpacity: levelCellOpacity(levelId),
      size: this.state.grid.length,
    });

    // Spacer so the grid sits below the fixed global logo
    const logoWrap = document.createElement('div');
    logoWrap.className = 'game-logo-wrap';
    logoWrap.style.height = logoH();
    logoWrap.style.flexShrink = '0';
    // Order: spacer → grid → HUD
    wrapper.insertBefore(logoWrap, wrapper.firstChild);
    wrapper.appendChild(this.svg);
    wrapper.appendChild(this.hud);  // HUD moves below grid
    this.container.appendChild(wrapper);

    // Tap-to-move: translate pointer position → grid cell → direction
    this._tapHandler = (e) => {
      if (this.state.status !== 'playing') return;
      e.preventDefault();
      const rect = this.svg.getBoundingClientRect();
      const clientX = e.touches ? e.touches[0].clientX : e.clientX;
      const clientY = e.touches ? e.touches[0].clientY : e.clientY;
      const svgW = rect.width;
      const svgH = rect.height;
      const size = this.state.grid.length;
      // SVG viewBox is (CELL_SIZE*size) x (CELL_SIZE*size), map to logical coords
      const lx = (clientX - rect.left) / svgW * (CELL_SIZE * size);
      const ly = (clientY - rect.top)  / svgH * (CELL_SIZE * size);
      const tappedCol = Math.floor(lx / CELL_SIZE);
      const tappedRow = Math.floor(ly / CELL_SIZE);
      const [pr, pc] = this.state.player.position;
      const dr = tappedRow - pr;
      const dc = tappedCol - pc;
      const dirMap = { '-1,0': 'U', '1,0': 'D', '0,-1': 'L', '0,1': 'R' };
      const dir = dirMap[`${dr},${dc}`];
      if (dir) this._move(dir);
    };
    this.svg.addEventListener('pointerdown', this._tapHandler);
    this.svg.style.touchAction = 'none'; // prevent scroll-on-drag eating taps

    // Keyboard
    document.addEventListener('keydown', this._keyHandler);

    this._render();

    // Lore overlay — fade each line in/out over the background
    this._playLoreOverlay(level.lore);
  }

  _showTransformHint(nowEl, revertEl) {
    document.getElementById('transform-hint')?.remove();
    const el = document.createElement('div');
    el.id = 'transform-hint';
    el.textContent = nowEl === 'costumed'
      ? `Hexagon absorbed — absorb ${revertEl.toUpperCase()} immediately to cleanse`
      : `Transformed → ${nowEl.toUpperCase()} — absorb ${revertEl.toUpperCase()} to cleanse`;
    document.body.appendChild(el);
    requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add('visible')));
    setTimeout(() => {
      el.classList.remove('visible');
      setTimeout(() => el.remove(), 700);
    }, 2200);
  }

  _playLoreOverlay(lines) {
    // Remove any existing overlay
    document.getElementById('lore-overlay')?.remove();

    const overlay = document.createElement('div');
    overlay.id = 'lore-overlay';
    document.body.appendChild(overlay);

    const text = document.createElement('p');
    overlay.appendChild(text);

    let i = 0;
    const FADE_MS  = 1100;
    const HOLD_MS  = 2600;

    const next = () => {
      if (!document.body.contains(overlay)) return; // navigated away
      if (i >= lines.length) { overlay.remove(); return; }

      text.textContent = lines[i];
      text.style.opacity = '1';

      setTimeout(() => {
        text.style.opacity = '0';
        setTimeout(() => { i++; next(); }, FADE_MS);
      }, HOLD_MS);
    };

    // Brief pause so the bg crossfade starts first
    setTimeout(next, 700);
  }

  _onKey(e) {
    const map = {
      ArrowUp: 'U', ArrowDown: 'D', ArrowLeft: 'L', ArrowRight: 'R',
      w: 'U', s: 'D', a: 'L', d: 'R',
      W: 'U', S: 'D', A: 'L', D: 'R',
    };
    if (map[e.key]) {
      e.preventDefault();
      this._move(map[e.key]);
    }
  }

  _move(dir) {
    if (!this.state || this.state.status !== 'playing') return;
    // First move dismisses the lore overlay immediately
    document.getElementById('lore-overlay')?.remove();

    const valid = getValidMoves(this.state);
    if (!valid.includes(dir)) { sfx.blocked(); return; }

    // Pre-absorb data for FX
    const [dr, dc] = { U: [-1, 0], D: [1, 0], L: [0, -1], R: [0, 1] }[dir];
    const [pr, pc] = this.state.player.position;
    const targetRow = pr + dr, targetCol = pc + dc;

    const prevScore = this.state.player.score;
    this.state = applyMove(this.state, dir);

    // SFN trace — record move immediately after state update
    if (this.tracker && this.state.lastEvent) {
      const token = buildSFNToken(targetCol, targetRow, this.state.lastEvent, this.state.status);
      this.tracker.add(token);
      this._sfnMoveCount++;
      if (this._sfnMoveCount % 5 === 0) this.tracker.shift();
    }

    // Sound effects
    const event = this.state.lastEvent;
    if (event) {
      if (event.type === 'same')         sfx.absorbSame(this.state.player.originalElement);
      else if (event.type === 'cross')   sfx.absorbCross(event.absorbed);
      else if (event.type === 'safe')    sfx.absorbSafe();
      else if (event.type === 'costume') {
        sfx.costume?.();
        this._showTransformHint('costumed', this.state.player.originalElement);
      }
      else if (event.type === 'cleanse') {
        sfx.cleanse?.();
      }
      else if (event.type === 'wormhole') {
        // Flash exit cell in addition to the entrance flash below
        if (event.wormholeTo) flashCell(this.svg, event.wormholeTo[0], event.wormholeTo[1], '#e0b8ff', this.state.player.originalElement);
      }

      // Near-death warning: fire when corruption first reaches deathAt-1
      if (this.state.status === 'playing' && event.corruptionDelta > 0) {
        const el      = this.state.player.element;
        const warnAt  = RULES[el].deathAt - 1;
        if (this.state.player.corruption === warnAt) {
          sfx.nearDeath(el);
        }
      }
    }

    // Visual FX
    if (event) {
      const cellColor = ELEMENT_COLORS[event.absorbed] || '#fff';
      flashCell(this.svg, targetRow, targetCol, cellColor, this.state.player.originalElement);
      showScorePopup(this.svg, targetRow, targetCol, event.scoreDelta);
    }

    this._render();

    // End conditions
    if (this.state.status === 'win') {
      sfx.win();
      this.tracker?.win();
      setTimeout(() => this._showWin(), 400);
    } else if (this.state.status === 'lose-death') {
      sfx.death();
      this.tracker?.loss('corruption');
      setTimeout(() => this._showLose(this.state.status), 400);
    } else if (this.state.status === 'lose-stuck') {
      sfx.stuck();
      // costumed + no cleanse available → LOSS:costume; plain dead-end → LOSS:stuck
      this.tracker?.loss(this.state.player.costumed ? 'costume' : 'stuck');
      setTimeout(() => this._showLose(this.state.status), 400);
    }
  }

  _render() {
    renderState(this.svg, this.state);
    highlightValidMoves(this.svg, getValidMoves(this.state), this.state);
    updateHUD(this.hud, this.state);
  }

  _showWin() {
    document.removeEventListener('keydown', this._keyHandler);
    if (this.svg && this._tapHandler) this.svg.removeEventListener('pointerdown', this._tapHandler);
    const levelId = this.levels.find(l =>
      l.playerElement === this.state.player.originalElement
    )?.id ?? this.hud.dataset.level;
    const id = parseInt(this.hud.dataset.level);

    // Update progress
    if (!this.progress.completed.includes(id)) this.progress.completed.push(id);
    const nextId = id + 1;
    const nextLevel = this.levels.find(l => l.id === nextId);
    if (nextLevel && !this.progress.unlocked.includes(nextId)) {
      this.progress.unlocked.push(nextId);
    }
    saveProgress(this.progress);

    const ROMAN = ['I','II','III','IV','V','VI','VII','VIII','IX','X','XI','XII','XIII','XIV'];
    const winRoman  = ROMAN[id - 1]     || id;
    const nextRoman = ROMAN[nextId - 1] || nextId;

    // Check if this was the last level of a realm → offer realm advance
    const currentRealm  = getRealmForLevel(id);
    const realmComplete = currentRealm.levelIds.every(lid => this.progress.completed.includes(lid));
    const nextRealm     = REALMS.find(r => r.id === currentRealm.id + 1);
    const isLastInRealm = currentRealm.levelIds[currentRealm.levelIds.length - 1] === id;

    let nextBtn = '';
    if (nextLevel) {
      nextBtn = `<button class="btn-primary" id="btn-next">Enter Rite ${nextRoman} →</button>`;
    } else if (realmComplete && nextRealm) {
      nextBtn = `<button class="btn-primary" id="btn-next-realm">Enter ${nextRealm.name} →</button>`;
    } else {
      nextBtn = `<p class="overlay-sub">All rites performed. The form is sanctified.</p>`;
    }

    this._showOverlay('win', `
      <div class="overlay-icon win-icon">✦</div>
      <h2 class="eerie-h2">Rite ${winRoman} <span class="win-sub-title">Complete</span></h2>
      <p class="overlay-score">Essence gathered: ${this.state.player.score}</p>
      ${isLastInRealm && realmComplete && nextRealm
        ? `<p class="overlay-sub" style="color:rgba(200,160,255,0.8);margin-bottom:4px">${realmLabel(currentRealm)} — all rites sanctified.</p>`
        : ''}
      ${nextBtn}
      <button class="btn-ghost" id="btn-levels">← Return to the Rites</button>
    `, () => {
      document.getElementById('btn-next')?.addEventListener('click', () => this.startLevel(nextId));
      document.getElementById('btn-next-realm')?.addEventListener('click', () => this.showLevelSelect(nextRealm?.id));
      document.getElementById('btn-levels')?.addEventListener('click', () => this.showLevelSelect());

      // Enter key fires the primary next button from the win screen
      const winKey = (e) => {
        if (e.key !== 'Enter') return;
        e.preventDefault();
        document.removeEventListener('keydown', winKey);
        const btnNext = document.getElementById('btn-next');
        const btnRealm = document.getElementById('btn-next-realm');
        if (btnNext) btnNext.click();
        else if (btnRealm) btnRealm.click();
        else this.showLevelSelect();
      };
      document.addEventListener('keydown', winKey);
    });
  }

  _showLose(reason) {
    document.removeEventListener('keydown', this._keyHandler);
    if (this.svg && this._tapHandler) this.svg.removeEventListener('pointerdown', this._tapHandler);
    const id = parseInt(this.hud.dataset.level);
    const isDeath = reason === 'lose-death';

    const deathSkull = `
      <div class="death-dissolve">
        <div class="d-base"></div>
        <div class="d-puff"></div>
        <div class="d-puff"></div>
        <div class="d-puff"></div>
        <div class="d-puff"></div>
        <div class="d-ember"></div>
        <div class="d-ember"></div>
        <div class="d-ember"></div>
        <div class="d-ember"></div>
        <div class="d-ember"></div>
        <div class="d-ember"></div>
        <div class="d-ember"></div>
        <div class="d-shard sq"></div>
        <div class="d-shard ci"></div>
        <div class="d-shard tr"></div>
        <div class="d-shard sq"></div>
        <div class="d-shard tr"></div>
        <div class="d-shard ci"></div>
        <div class="d-shard sq"></div>
        <div class="d-shard ci"></div>
        <div class="d-shard tr"></div>
      </div>`;

    const roman = ['I','II','III','IV','V','VI','VII','VIII','IX','X'][id - 1] || id;
    const boundAnim = `
      <div class="bound-header">
        <svg class="bound-anim" viewBox="0 0 100 100">
          <polygon class="bh-ring bh-ring-1" points="50,4 92,28 92,72 50,96 8,72 8,28"/>
          <polygon class="bh-ring bh-ring-2" points="50,14 82,33 82,67 50,86 18,67 18,33"/>
          <polygon class="bh-ring bh-ring-3" points="50,26 70,38 70,62 50,74 30,62 30,38"/>
          <line class="bh-spoke bh-spoke-1" x1="50" y1="4"  x2="50" y2="50"/>
          <line class="bh-spoke bh-spoke-2" x1="92" y1="28" x2="50" y2="50"/>
          <line class="bh-spoke bh-spoke-3" x1="92" y1="72" x2="50" y2="50"/>
          <line class="bh-spoke bh-spoke-4" x1="50" y1="96" x2="50" y2="50"/>
          <line class="bh-spoke bh-spoke-5" x1="8"  y1="72" x2="50" y2="50"/>
          <line class="bh-spoke bh-spoke-6" x1="8"  y1="28" x2="50" y2="50"/>
          <circle class="bh-dot" cx="50" cy="50" r="5"/>
        </svg>
        <h2 class="bound-title">BOUND</h2>
      </div>`;

    const content = isDeath ? `
      <div class="death-header">
        ${deathSkull}
        <h2 class="death-title">DEATH</h2>
        <p class="death-sub">The corruption consumed you</p>
      </div>
      <p class="overlay-score">Essence gathered: ${this.state.player.score}</p>
      <button class="btn-danger" id="btn-retry">↺ Perform the Rite Again</button>
      <button class="btn-ghost" id="btn-levels">← Return to the Rites</button>
    ` : `
      ${boundAnim}
      <p class="overlay-reason">No path remains — your form is trapped</p>
      <p class="overlay-score">Essence gathered: ${this.state.player.score}</p>
      <button class="btn-primary" id="btn-retry">↺ Perform the Rite Again</button>
      <button class="btn-ghost" id="btn-levels">← Return to the Rites</button>
    `;

    this._showOverlay(isDeath ? 'death' : 'lose', content, () => {
      const retryKey = (e) => {
        if (e.key !== 'Enter') return;
        e.preventDefault();
        document.removeEventListener('keydown', retryKey);
        this.startLevel(id);
      };
      document.addEventListener('keydown', retryKey);

      document.getElementById('btn-retry')?.addEventListener('click', () => {
        document.removeEventListener('keydown', retryKey);
        this.startLevel(id);
      });
      document.getElementById('btn-levels')?.addEventListener('click', () => {
        document.removeEventListener('keydown', retryKey);
        this.showLevelSelect();
      });
    });
  }

  _removeOverlay() {
    if (this._activeOverlay) { this._activeOverlay.remove(); this._activeOverlay = null; }
    // also clean up any stray overlays in container (legacy)
    this.container.querySelector('.overlay')?.remove();
  }

  _showOverlay(type, html, setup) {
    this._removeOverlay();

    // On win: hide game board so card floats over the rite background
    // On death/lose: keep board visible so player sees where they ended up
    if (type === 'win') {
      const wrapper = this.container.querySelector('.game-wrapper');
      if (wrapper) wrapper.style.display = 'none';
    }

    const overlay = document.createElement('div');
    overlay.className = `overlay overlay-${type}`;
    overlay.innerHTML = `<div class="overlay-box">${html}</div>`;
    // Append to body so it's in the root stacking context (above fog-layer z-index:20)
    document.body.appendChild(overlay);
    this._activeOverlay = overlay;
    if (setup) setup();
  }
}
