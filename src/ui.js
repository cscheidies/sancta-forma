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
    next.style.backgroundImage = `url("${bg}")`;
    next.style.opacity = '0';
    requestAnimationFrame(() => requestAnimationFrame(() => {
      next.style.opacity    = '1';
      current.style.opacity = '0';
    }));
    _activeBgId = nextId;
    // Stars/shooting stars still visible over rite bg
    if (starfield) starfield.style.opacity = '0.35';
    window.sfPhotoMode = true;
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
const ROMAN = ['I','II','III','IV','V','VI','VII','VIII','IX','X'];
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
];

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
    this.container.innerHTML = '';
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
    `;

    this.container.appendChild(screen);
    requestAnimationFrame(() => screen.classList.add('visible'));

    screen.querySelector('#title-how').addEventListener('click', () => this.showHowToPlay());
    screen.querySelector('#title-begin').addEventListener('click', () => this.showLevelSelect());
    screen.querySelector('#title-why').addEventListener('click', () => this.showNarrative());
  }

  showHowToPlay() {
    clearLevelBg();
    this.container.innerHTML = '';
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
    this.container.innerHTML = '';
    document.removeEventListener('keydown', this._keyHandler);
    if (this.svg && this._tapHandler) this.svg.removeEventListener('pointerdown', this._tapHandler);
    if (this._orientationUnsub) { this._orientationUnsub(); this._orientationUnsub = null; }

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
        heading: 'Threshold',
        lines: [
          'The small field is behind you.',
          'What you learned there',
          'you will need now.',
          'The world is larger than you remember.',
          'All three hunters walk it together.',
          'Past is prologue.',
        ],
      },
      {
        heading: 'Wider',
        lines: [
          'The pattern is older than the field.',
          'It rises in the stars.',
          'It hides in the cells beneath your foot.',
          'What hunted you in the small field',
          'hunts you here in different bodies.',
          'Learn to see them before they reach you.',
        ],
      },
      {
        heading: 'Speaks',
        lines: [
          'You have walked the pattern long enough.',
          'Now it walks toward you.',
          'You begin where the field places you,',
          'not where you choose.',
          'The hunters are not waiting.',
          'They are arriving.',
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
      inner.innerHTML = `
        <div class="narr-heading">${p.heading}</div>
        <div class="narr-lines" style="margin-top:10px">
          ${p.lines.map((l,i) => `<p class="narr-line" style="animation-delay:${0.2 + i*stagger}s">${l}</p>`).join('')}
        </div>
        <div class="narr-actions" style="animation-delay:0.35s">
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

  showLevelSelect(realmId) {
    if (realmId !== undefined) this.currentRealm = realmId;
    const realm = REALMS.find(r => r.id === this.currentRealm) || REALMS[0];
    clearLevelBg();
    this.container.innerHTML = '';
    document.removeEventListener('keydown', this._keyHandler);
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
        <button class="title-btn" id="ls-why">WHY</button>
      </div>
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
      card.style.setProperty('--elem-color', ELEMENT_COLORS[level.playerElement]);

      const roman = ['I','II','III','IV','V','VI'][riteIndex(level.id)] ?? level.id;
      card.innerHTML = `
        <div class="card-rite">Rite</div>
        <div class="card-num">${roman}</div>
        <div class="card-elem">${level.playerElement.toUpperCase()}</div>
        <div class="card-status">${isCompleted ? '✦' : isUnlocked ? '◈' : '⬡'}</div>
      `;
      if (isUnlocked) card.addEventListener('click', () => this.startLevel(level.id));
      grid.appendChild(card);
    }

    // Realm navigation
    const prevBtn = screen.querySelector('#realm-prev');
    const nextBtn = screen.querySelector('#realm-next');
    const prevRealm = REALMS.find(r => r.id === this.currentRealm - 1);
    const nextRealm = REALMS.find(r => r.id === this.currentRealm + 1);

    if (!prevRealm) prevBtn.classList.add('realm-arrow-hidden');
    else prevBtn.addEventListener('click', () => this.showLevelSelect(prevRealm.id));

    if (!nextRealm || !isRealmUnlocked(nextRealm.id, this.progress)) {
      nextBtn.classList.add('realm-arrow-hidden');
    } else {
      nextBtn.addEventListener('click', () => this.showLevelSelect(nextRealm.id));
    }

    screen.querySelector('#ls-how').addEventListener('click', () => this.showHowToPlay());
    screen.querySelector('#ls-why').addEventListener('click', () => this.showNarrative());
    this.container.appendChild(screen);
  }

  startLevel(levelId) {
    const level = this.levels.find(l => l.id === levelId);
    if (!level) return;

    setLevelBg(levelId);
    this.container.innerHTML = '';
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

    // SFN trace strip
    this.tracker = new SFNTracker('hud-trace-strip');
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

    const ROMAN = ['I','II','III','IV','V','VI','VII','VIII','IX','X','XI','XII'];
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
    });
  }

  _showLose(reason) {
    document.removeEventListener('keydown', this._keyHandler);
    if (this.svg && this._tapHandler) this.svg.removeEventListener('pointerdown', this._tapHandler);
    const id = parseInt(this.hud.dataset.level);
    const isDeath = reason === 'lose-death';

    const deathSkull = `
      <div class="death-dissolve">
        <div class="d-puff"></div>
        <div class="d-puff"></div>
        <div class="d-puff"></div>
        <div class="d-puff"></div>
        <div class="d-core"></div>
      </div>`;

    const roman = ['I','II','III','IV','V','VI','VII','VIII','IX','X'][id - 1] || id;
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
      <div class="overlay-icon bound-icon">⬡</div>
      <h2 class="eerie-h2">BOUND</h2>
      <p class="overlay-reason">No path remains — your form is trapped</p>
      <p class="overlay-score">Essence gathered: ${this.state.player.score}</p>
      <button class="btn-primary" id="btn-retry">↺ Perform the Rite Again</button>
      <button class="btn-ghost" id="btn-levels">← Return to the Rites</button>
    `;

    this._showOverlay(isDeath ? 'death' : 'lose', content, () => {
      document.getElementById('btn-retry')?.addEventListener('click', () => this.startLevel(id));
      document.getElementById('btn-levels')?.addEventListener('click', () => this.showLevelSelect());
    });
  }

  _showOverlay(type, html, setup) {
    const existing = this.container.querySelector('.overlay');
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.className = `overlay overlay-${type}`;
    overlay.innerHTML = `<div class="overlay-box">${html}</div>`;
    this.container.appendChild(overlay);
    if (setup) setup();
  }
}
