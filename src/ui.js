// ui.js — HUD, screens, and event handling. Bridges game logic + renderer.

import { initState, getValidMoves, applyMove, RULES } from './engine.js';
import * as sfx from './sfx.js';

// Per-rite background images (add more here as artwork arrives)
const LEVEL_BACKGROUNDS = {
  1: './bg_rite1.jpg',
};

function setLevelBg(levelId) {
  const starfield = document.getElementById('starfield');
  const bg = LEVEL_BACKGROUNDS[levelId];
  if (bg) {
    document.body.style.backgroundImage = `url("${bg}")`;
    document.body.style.backgroundSize  = 'cover';
    document.body.style.backgroundPosition = 'center';
    if (starfield) starfield.style.opacity = '0.12';
  } else {
    document.body.style.backgroundImage = '';
    if (starfield) starfield.style.opacity = '1';
  }
}

function clearLevelBg() {
  document.body.style.backgroundImage = '';
  const starfield = document.getElementById('starfield');
  if (starfield) starfield.style.opacity = '1';
}

import {
  createGridSVG, renderState, flashCell, showScorePopup,
  highlightValidMoves, ELEMENT_COLORS, CELL_SIZE,
} from './renderer.js';

const STORAGE_KEY = 'shape-puzzle-progress';

function loadProgress() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || { unlocked: [1], completed: [] };
  } catch { return { unlocked: [1], completed: [] }; }
}

function saveProgress(progress) {
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
  const rules = RULES[player.element];
  const color = ELEMENT_COLORS[player.element];

  hud.querySelector('.hud-level').textContent = `Level ${hud.dataset.level}`;
  hud.querySelector('.hud-score').textContent = `${player.score} / ${state.winScore}`;
  hud.querySelector('.hud-score').style.color = player.score >= state.winScore ? '#69ff47' : '#fff';

  const corrMax = rules.maxCorruption;
  const corrEl = hud.querySelector('.hud-corruption');
  corrEl.textContent = `${player.corruption} / ${corrMax}`;

  // Colour-code corruption: green→yellow→red
  if (player.corruption === 0) corrEl.style.color = '#69ff47';
  else if (player.corruption < corrMax) corrEl.style.color = '#ffcc00';
  else corrEl.style.color = '#ff4747';

  // Current form (with corruption morphing)
  _drawShapeSVG(hud.querySelector('.hud-player-mini'), player.element, player.corruption);

  // Origin shape (always shown, static clean outline)
  _drawShapeSVG(hud.querySelector('.hud-origin-svg'), player.originalElement, 0);
  const originNameEl = hud.querySelector('.hud-origin-name');
  originNameEl.textContent = player.originalElement.toUpperCase();
  originNameEl.style.color = ELEMENT_COLORS[player.originalElement];

  // Current form name
  const currentNameEl = hud.querySelector('.hud-current-name');
  const isMutated = player.corruption > 0;
  currentNameEl.textContent = isMutated
    ? `${player.originalElement.toUpperCase()} +${player.corruption}`
    : player.originalElement.toUpperCase();
  currentNameEl.style.color = isMutated ? '#ffcc00' : ELEMENT_COLORS[player.originalElement];

  // Arrow colour — warn when corrupted
  const arrow = hud.querySelector('.hud-identity-arrow');
  if (arrow) arrow.style.color = isMutated ? '#ffcc00' : '#3d4d5e';
}

// ─── Game screen ──────────────────────────────────────────────────────────

export class GameScreen {
  constructor(container, levels) {
    this.container = container;
    this.levels = levels;
    this.state = null;
    this.svg = null;
    this.hud = null;
    this.levelIndex = 0;
    this.progress = loadProgress();
    this._keyHandler = this._onKey.bind(this);
  }

  showNarrative() {
    clearLevelBg();
    this.container.innerHTML = '';
    document.removeEventListener('keydown', this._keyHandler);

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
    ];

    let passageIdx = 0;

    const screen = document.createElement('div');
    screen.className = 'screen narrative-screen';
    screen.innerHTML = `
      <div class="narrative-wrap">
        <div class="sf-logo" style="margin-bottom:20px">
          <span class="sf-sancta" style="font-size:0.75rem">SANCTA</span>
          <span class="sf-forma" style="font-size:1.4rem">FORMA</span>
        </div>
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
      inner.querySelector('#narr-skip')?.addEventListener('click',  () => advance(() => this.showLevelSelect()));
    };

    renderPassage(passageIdx);
  }

  showLevelSelect() {
    clearLevelBg();
    this.container.innerHTML = '';
    document.removeEventListener('keydown', this._keyHandler);

    const screen = document.createElement('div');
    screen.className = 'screen level-select';

    screen.innerHTML = `
      <div class="screen-header">
        <div class="sf-logo">
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

          <div class="sf-title">
            <span class="sf-sancta">SANCTA</span>
            <span class="sf-forma">FORMA</span>
          </div>
          <p class="sf-tagline">Six rites of absorption</p>
        </div>
      </div>
      <div class="level-grid"></div>
    `;

    const grid = screen.querySelector('.level-grid');
    for (const level of this.levels) {
      const card = document.createElement('button');
      card.className = 'level-card';
      const isUnlocked = this.progress.unlocked.includes(level.id);
      const isCompleted = this.progress.completed.includes(level.id);

      if (!isUnlocked) card.classList.add('locked');
      if (isCompleted) card.classList.add('completed');

      const color = ELEMENT_COLORS[level.playerElement];
      card.style.setProperty('--elem-color', color);

      const roman = ['I','II','III','IV','V','VI','VII','VIII','IX','X'][level.id - 1] || level.id;
      card.innerHTML = `
        <div class="card-rite">Rite</div>
        <div class="card-num">${roman}</div>
        <div class="card-elem">${level.playerElement.toUpperCase()}</div>
        <div class="card-status">${isCompleted ? '✦' : isUnlocked ? '◈' : '⬡'}</div>
      `;

      if (isUnlocked) {
        card.addEventListener('click', () => this.startLevel(level.id));
      }
      grid.appendChild(card);
    }

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
    `;
    this.hud.querySelector('.hud-back').addEventListener('click', () => this.showLevelSelect());

    // Grid SVG
    this.svg = createGridSVG();

    // Direction buttons (mobile)
    const dpad = document.createElement('div');
    dpad.className = 'dpad';
    dpad.innerHTML = `
      <div class="dpad-row">
        <button class="dpad-btn" data-dir="U">▲</button>
      </div>
      <div class="dpad-row">
        <button class="dpad-btn" data-dir="L">◀</button>
        <button class="dpad-btn dpad-center" data-dir="">·</button>
        <button class="dpad-btn" data-dir="R">▶</button>
      </div>
      <div class="dpad-row">
        <button class="dpad-btn" data-dir="D">▼</button>
      </div>
    `;
    dpad.querySelectorAll('[data-dir]').forEach(btn => {
      if (btn.dataset.dir) {
        btn.addEventListener('click', () => this._move(btn.dataset.dir));
      }
    });

    wrapper.appendChild(this.hud);
    wrapper.appendChild(this.svg);
    wrapper.appendChild(dpad);
    this.container.appendChild(wrapper);

    // Keyboard
    document.addEventListener('keydown', this._keyHandler);

    this._render();
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

    const valid = getValidMoves(this.state);
    if (!valid.includes(dir)) { sfx.blocked(); return; }

    // Pre-absorb data for FX
    const [dr, dc] = { U: [-1, 0], D: [1, 0], L: [0, -1], R: [0, 1] }[dir];
    const [pr, pc] = this.state.player.position;
    const targetRow = pr + dr, targetCol = pc + dc;

    const prevScore = this.state.player.score;
    this.state = applyMove(this.state, dir);

    // Sound effects
    const event = this.state.lastEvent;
    if (event) {
      if (event.type === 'same')         sfx.absorbSame(this.state.player.originalElement);
      else if (event.type === 'nemesis') sfx.absorbNemesis(event.absorbed);
      else if (event.type === 'cross')   sfx.absorbCross(event.absorbed);
      else if (event.type === 'safe')    sfx.absorbSafe();

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
      flashCell(this.svg, targetRow, targetCol, cellColor);
      showScorePopup(this.svg, targetRow, targetCol, event.scoreDelta);
    }

    this._render();

    // End conditions
    if (this.state.status === 'win') {
      sfx.win();
      setTimeout(() => this._showWin(), 400);
    } else if (this.state.status === 'lose-death') {
      sfx.death();
      setTimeout(() => this._showLose(this.state.status), 400);
    } else if (this.state.status === 'lose-stuck') {
      sfx.stuck();
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
    const levelId = this.levels.find(l =>
      l.playerElement === this.state.player.originalElement
    )?.id ?? this.hud.dataset.level;
    const id = parseInt(this.hud.dataset.level);

    // Update progress
    if (!this.progress.completed.includes(id)) this.progress.completed.push(id);
    const nextId = id + 1;
    if (nextId <= this.levels.length && !this.progress.unlocked.includes(nextId)) {
      this.progress.unlocked.push(nextId);
    }
    saveProgress(this.progress);

    const winRoman = ['I','II','III','IV','V','VI','VII','VIII','IX','X'][id - 1] || id;
    const nextRoman = ['I','II','III','IV','V','VI','VII','VIII','IX','X'][nextId - 1] || nextId;
    this._showOverlay('win', `
      <div class="overlay-icon win-icon">✦</div>
      <h2 class="eerie-h2">Rite ${winRoman} <span class="win-sub-title">Complete</span></h2>
      <p class="overlay-score">Essence gathered: ${this.state.player.score}</p>
      ${nextId <= this.levels.length
        ? `<button class="btn-primary" id="btn-next">Enter Rite ${nextRoman} →</button>`
        : `<p class="overlay-sub">All rites performed. The form is sanctified.</p>`
      }
      <button class="btn-ghost" id="btn-levels">← Return to the Rites</button>
    `, () => {
      document.getElementById('btn-next')?.addEventListener('click', () => this.startLevel(nextId));
      document.getElementById('btn-levels')?.addEventListener('click', () => this.showLevelSelect());
    });
  }

  _showLose(reason) {
    document.removeEventListener('keydown', this._keyHandler);
    const id = parseInt(this.hud.dataset.level);
    const isDeath = reason === 'lose-death';

    const deathSkull = `
      <svg class="death-skull" viewBox="0 0 80 80" width="80" height="80" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <filter id="skull-glow">
            <feGaussianBlur stdDeviation="2.5" result="blur"/>
            <feComposite in="SourceGraphic" in2="blur" operator="over"/>
          </filter>
          <radialGradient id="skull-grad" cx="45%" cy="38%" r="55%">
            <stop offset="0%"  stop-color="#ff3a3a"/>
            <stop offset="60%" stop-color="#990000"/>
            <stop offset="100%" stop-color="#440000"/>
          </radialGradient>
        </defs>
        <!-- Cranium -->
        <ellipse cx="40" cy="34" rx="26" ry="24" fill="url(#skull-grad)" filter="url(#skull-glow)"/>
        <!-- Jaw -->
        <rect x="20" y="50" width="40" height="14" rx="4" fill="url(#skull-grad)" filter="url(#skull-glow)"/>
        <!-- Jaw teeth gaps -->
        <rect x="27" y="56" width="6"  height="10" rx="2" fill="#0d1117"/>
        <rect x="37" y="56" width="6"  height="10" rx="2" fill="#0d1117"/>
        <rect x="47" y="56" width="6"  height="10" rx="2" fill="#0d1117"/>
        <!-- Eye sockets -->
        <ellipse cx="29" cy="36" rx="8" ry="9" fill="#0d1117"/>
        <ellipse cx="51" cy="36" rx="8" ry="9" fill="#0d1117"/>
        <!-- Eye glow (red pupils) -->
        <ellipse cx="29" cy="37" rx="4" ry="4.5" fill="#ff2020" opacity="0.7" filter="url(#skull-glow)"/>
        <ellipse cx="51" cy="37" rx="4" ry="4.5" fill="#ff2020" opacity="0.7" filter="url(#skull-glow)"/>
        <!-- Nose cavity -->
        <path d="M 37,46 L 40,42 L 43,46 Z" fill="#0d1117"/>
        <!-- Crack -->
        <path d="M 40,10 L 38,22 L 42,30 L 40,38" stroke="#ff4444" stroke-width="1.2" fill="none" opacity="0.6"/>
      </svg>`;

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
