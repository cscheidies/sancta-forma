// renderer.js — SVG shape rendering. No game logic.
import { RULES } from './engine.js';

export const ELEMENT_COLORS = {
  // Pure forms
  square:   '#00e5ff',
  circle:   '#e040fb',
  triangle: '#69ff47',
  // Hunter shapes — muted, ominous
  hexagon:  '#c8902a',  // amber gold — imitation of order
  star:     '#cc3333',  // blood red — arrogant geometry
  moon:     '#4488aa',  // hollow blue — hollow roundness
};

const CELL_SIZE = 80;
const SHAPE_PAD = 16; // padding inside cell for grid shapes
const PLAYER_PAD = 8; // less padding — player is bigger

// ─── SVG path generators ───────────────────────────────────────────────────

function squarePath(x, y, w, h, corruption) {
  const x1 = x, y1 = y, x2 = x + w, y2 = y + h;
  const rx = w / 2; // radius for curves = half-width

  if (corruption === 0) {
    return `M ${x1},${y1} L ${x2},${y1} L ${x2},${y2} L ${x1},${y2} Z`;
  }
  if (corruption === 1) {
    // D-shape: flat left side, curved right side (right semicircle)
    const cx = x1; // flat side at left edge
    const mx = x1 + w * 0.4; // start/end of arc (centre column)
    return `M ${mx},${y1} A ${rx},${rx} 0 0 1 ${mx},${y2} L ${cx},${y2} L ${cx},${y1} Z`;
  }
  // corruption >= 2: pill/stadium (two semicircular caps, left and right)
  const midY = y1 + h / 2;
  const capR = h / 2;
  const leftCx = x1 + capR;
  const rightCx = x2 - capR;
  return `M ${leftCx},${y1} L ${rightCx},${y1} A ${capR},${capR} 0 0 1 ${rightCx},${y2} L ${leftCx},${y2} A ${capR},${capR} 0 0 1 ${leftCx},${y1} Z`;
}

function circlePath(cx, cy, r, corruption) {
  if (corruption === 0) {
    // Full circle as path (two arcs)
    return `M ${cx - r},${cy} A ${r},${r} 0 1 0 ${cx + r},${cy} A ${r},${r} 0 1 0 ${cx - r},${cy} Z`;
  }
  // corruption >= 1: D-shape — upper semicircle, flat bottom
  return `M ${cx - r},${cy} A ${r},${r} 0 0 1 ${cx + r},${cy} Z`;
}

function trianglePath(cx, cy, size, corruption) {
  // Equilateral triangle centred at (cx, cy)
  const h = size * Math.sqrt(3) / 2;
  const top   = [cx,          cy - h * 0.6];
  const botL  = [cx - size/2, cy + h * 0.4];
  const botR  = [cx + size/2, cy + h * 0.4];

  if (corruption === 0) {
    return `M ${top[0]},${top[1]} L ${botR[0]},${botR[1]} L ${botL[0]},${botL[1]} Z`;
  }
  // corruption >= 1: fan — two straight edges, bottom edge curves outward
  const arcRx = size * 0.7;
  const arcRy = size * 0.3;
  return `M ${top[0]},${top[1]} L ${botR[0]},${botR[1]} A ${arcRx},${arcRy} 0 0 1 ${botL[0]},${botL[1]} Z`;
}

// ─── SVG element factories ──────────────────────────────────────────────────

function svgEl(tag, attrs, children = []) {
  const el = document.createElementNS('http://www.w3.org/2000/svg', tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  for (const child of children) el.appendChild(child);
  return el;
}

// Hunter shape paths
function hexagonPath(cx, cy, r) {
  const pts = Array.from({length:6}, (_,i) => {
    const a = i * Math.PI / 3 - Math.PI / 6;
    return `${(cx + r*Math.cos(a)).toFixed(2)},${(cy + r*Math.sin(a)).toFixed(2)}`;
  });
  return `M ${pts.join(' L ')} Z`;
}

function starPath(cx, cy, outerR, innerR) {
  const pts = Array.from({length:10}, (_,i) => {
    const r = i%2===0 ? outerR : innerR;
    const a = i * Math.PI/5 - Math.PI/2;
    return `${(cx + r*Math.cos(a)).toFixed(2)},${(cy + r*Math.sin(a)).toFixed(2)}`;
  });
  return `M ${pts.join(' L ')} Z`;
}

function moonPath(cx, cy, r) {
  const ty = cy - r, by = cy + r;
  // Outer left arc + inner right arc (crescent facing right)
  return `M ${cx},${ty} A ${r},${r} 0 1 0 ${cx},${by} A ${(r*0.75).toFixed(1)},${(r*0.85).toFixed(1)} 0 1 1 ${cx},${ty} Z`;
}

// Draw a grid-cell shape (outline only, dimmer)
function drawGridShape(type, col, row) {
  const cx = col * CELL_SIZE + CELL_SIZE / 2;
  const cy = row * CELL_SIZE + CELL_SIZE / 2;
  const color = ELEMENT_COLORS[type];
  const x = col * CELL_SIZE + SHAPE_PAD;
  const y = row * CELL_SIZE + SHAPE_PAD;
  const w = CELL_SIZE - SHAPE_PAD * 2;
  const h = CELL_SIZE - SHAPE_PAD * 2;
  const r = w / 2;

  const isHunter = ['hexagon','star','moon'].includes(type);
  const opacity  = isHunter ? '0.85' : '0.70';
  const sw       = isHunter ? '1.8'  : '1.8';

  // Hunter shapes also get a faint ominous fill
  const fill       = isHunter ? color : 'none';
  const fillOpacity= isHunter ? '0.08' : '0';

  let pathD;
  if      (type === 'square')  return svgEl('rect', { x, y, width:w, height:h, fill, 'fill-opacity':fillOpacity, stroke:color, 'stroke-width':sw, opacity });
  else if (type === 'circle')  return svgEl('circle', { cx, cy, r, fill, 'fill-opacity':fillOpacity, stroke:color, 'stroke-width':sw, opacity });
  else if (type === 'triangle') pathD = trianglePath(cx, cy, w, 0);
  else if (type === 'hexagon')  pathD = hexagonPath(cx, cy, r * 0.92);
  else if (type === 'star')     pathD = starPath(cx, cy, r * 0.92, r * 0.40);
  else if (type === 'moon')     pathD = moonPath(cx, cy, r * 0.85);

  return svgEl('path', { d: pathD, fill, 'fill-opacity':fillOpacity, stroke:color, 'stroke-width':sw, opacity });
}

// Draw the player shape with corruption state applied
function drawPlayer(element, corruption, col, row) {
  const cx = col * CELL_SIZE + CELL_SIZE / 2;
  const cy = row * CELL_SIZE + CELL_SIZE / 2;
  const color = ELEMENT_COLORS[element];
  const x = col * CELL_SIZE + PLAYER_PAD;
  const y = row * CELL_SIZE + PLAYER_PAD;
  const w = CELL_SIZE - PLAYER_PAD * 2;
  const h = CELL_SIZE - PLAYER_PAD * 2;

  let pathD;
  if (element === 'square') {
    pathD = squarePath(x, y, w, h, corruption);
  } else if (element === 'circle') {
    const r = w / 2;
    pathD = circlePath(cx, cy, r, corruption);
  } else {
    pathD = trianglePath(cx, cy, w, corruption);
  }

  const g = svgEl('g', { class: 'player-shape' });

  // Glow effect
  g.appendChild(svgEl('path', {
    d: pathD,
    fill: color,
    'fill-opacity': '0.18',
    stroke: color,
    'stroke-width': '4',
    filter: 'url(#glow)',
  }));
  // Solid inner stroke
  g.appendChild(svgEl('path', {
    d: pathD,
    fill: 'none',
    stroke: color,
    'stroke-width': '2.5',
  }));

  return g;
}

// Draw ghost of original element in top-left corner of cell
function drawOriginalGhost(originalElement, col, row) {
  const ghostSize = 18;
  const gx = col * CELL_SIZE + 4;
  const gy = row * CELL_SIZE + 4;
  const color = ELEMENT_COLORS[originalElement];

  const gcx = gx + ghostSize / 2;
  const gcy = gy + ghostSize / 2;

  const attrs = { fill: 'none', stroke: color, 'stroke-width': '1.5', opacity: '0.45' };

  if (originalElement === 'square') {
    return svgEl('rect', { x: gx, y: gy, width: ghostSize, height: ghostSize, ...attrs });
  } else if (originalElement === 'circle') {
    return svgEl('circle', { cx: gcx, cy: gcy, r: ghostSize / 2, ...attrs });
  } else {
    const path = trianglePath(gcx, gcy, ghostSize, 0);
    return svgEl('path', { d: path, ...attrs });
  }
}

// ─── Public API ────────────────────────────────────────────────────────────

export function createGridSVG() {
  const size = CELL_SIZE * 5;
  const svg = svgEl('svg', {
    viewBox: `0 0 ${size} ${size}`,
    width: size,
    height: size,
    class: 'game-grid',
  });

  // Defs: glow filter
  const defs = svgEl('defs', {});
  const filter = svgEl('filter', { id: 'glow', x: '-30%', y: '-30%', width: '160%', height: '160%' });
  const blur = svgEl('feGaussianBlur', { stdDeviation: '3', result: 'blur' });
  const composite = svgEl('feComposite', { in: 'SourceGraphic', in2: 'blur', operator: 'over' });
  filter.appendChild(blur);
  filter.appendChild(composite);
  defs.appendChild(filter);
  svg.appendChild(defs);

  // Grid background cells — dark stone/obsidian
  for (let r = 0; r < 5; r++) {
    for (let c = 0; c < 5; c++) {
      // Base cell — semi-transparent so background art shows through
      svg.appendChild(svgEl('rect', {
        x: c * CELL_SIZE + 1,
        y: r * CELL_SIZE + 1,
        width: CELL_SIZE - 2,
        height: CELL_SIZE - 2,
        fill: 'rgba(8,6,15,0.22)',
        stroke: 'rgba(50,30,90,0.50)',
        'stroke-width': '1',
        rx: '3',
      }));
      // Inner subtle frame (engraved look)
      svg.appendChild(svgEl('rect', {
        x: c * CELL_SIZE + 5,
        y: r * CELL_SIZE + 5,
        width: CELL_SIZE - 10,
        height: CELL_SIZE - 10,
        fill: 'none',
        stroke: 'rgba(80,40,160,0.12)',
        'stroke-width': '0.5',
        rx: '2',
      }));
    }
  }

  // Corner rune marks on each cell (tiny cross-hatch at corners)
  for (let r = 0; r < 5; r++) {
    for (let c = 0; c < 5; c++) {
      const x0 = c * CELL_SIZE, y0 = r * CELL_SIZE;
      const corners = [[x0+2,y0+2],[x0+CELL_SIZE-2,y0+2],[x0+2,y0+CELL_SIZE-2],[x0+CELL_SIZE-2,y0+CELL_SIZE-2]];
      for (const [cx2, cy2] of corners) {
        svg.appendChild(svgEl('circle', { cx:cx2, cy:cy2, r:'1', fill:'rgba(100,60,180,0.20)' }));
      }
    }
  }

  // Layers (populated by renderState)
  svg.appendChild(svgEl('g', { id: 'layer-shapes' }));
  svg.appendChild(svgEl('g', { id: 'layer-player' }));
  svg.appendChild(svgEl('g', { id: 'layer-fx' }));

  return svg;
}

export function renderState(svg, state) {
  const shapesLayer = svg.querySelector('#layer-shapes');
  const playerLayer = svg.querySelector('#layer-player');

  // Clear layers
  shapesLayer.innerHTML = '';
  playerLayer.innerHTML = '';

  const { grid, player } = state;
  const nemesisType = RULES[player.element].nemesis;

  // Draw all grid shapes
  for (let r = 0; r < 5; r++) {
    for (let c = 0; c < 5; c++) {
      const cell = grid[r][c];
      if (cell) {
        shapesLayer.appendChild(drawGridShape(cell.type, c, r));

        // Danger overlay: nemesis cells are impassable walls — mark them clearly
        if (cell.type === nemesisType) {
          const dangerRect = svgEl('rect', {
            x: c * CELL_SIZE + 2,
            y: r * CELL_SIZE + 2,
            width:  CELL_SIZE - 4,
            height: CELL_SIZE - 4,
            fill:   'rgba(220,30,30,0.08)',
            stroke: 'rgba(220,30,30,0.50)',
            'stroke-width': '1.5',
            rx: '4',
            'pointer-events': 'none',
          });
          shapesLayer.appendChild(dangerRect);
        }
      }
    }
  }

  // Draw player
  const [pr, pc] = player.position;
  playerLayer.appendChild(drawPlayer(player.element, player.corruption, pc, pr));

  // Draw ghost of original element (only if corrupted)
  if (player.corruption > 0) {
    playerLayer.appendChild(drawOriginalGhost(player.originalElement, pc, pr));
  }

}

export function flashCell(svg, row, col, color) {
  const fxLayer = svg.querySelector('#layer-fx');
  const flash = svgEl('rect', {
    x: col * CELL_SIZE + 1,
    y: row * CELL_SIZE + 1,
    width: CELL_SIZE - 2,
    height: CELL_SIZE - 2,
    fill: color,
    'fill-opacity': '0.4',
    rx: '4',
  });
  fxLayer.appendChild(flash);
  flash.animate([{ opacity: 0.4 }, { opacity: 0 }], { duration: 200, fill: 'forwards' })
    .onfinish = () => flash.remove();
}

export function showScorePopup(svg, row, col, delta) {
  const fxLayer = svg.querySelector('#layer-fx');
  const isTransit = delta === 0;

  const text = svgEl('text', {
    x: col * CELL_SIZE + CELL_SIZE / 2,
    y: row * CELL_SIZE + CELL_SIZE / 2,
    'text-anchor': 'middle',
    fill: isTransit ? 'rgba(255,255,255,0.35)' : delta > 0 ? '#69ff47' : '#ff4747',
    'font-size': isTransit ? '13' : '18',
    'font-family': 'Share Tech Mono, monospace',
    'font-weight': 'bold',
  });
  text.textContent = isTransit ? 'PASS' : delta > 0 ? `+${delta}` : `${delta}`;
  fxLayer.appendChild(text);
  text.animate(
    [
      { transform: 'translateY(0px)', opacity: isTransit ? 0.5 : 1 },
      { transform: 'translateY(-22px)', opacity: 0 },
    ],
    { duration: isTransit ? 400 : 550, fill: 'forwards' }
  ).onfinish = () => text.remove();
}

export function highlightValidMoves(svg, validMoves, state) {
  const fxLayer = svg.querySelector('#layer-fx');
  // Remove existing highlights
  fxLayer.querySelectorAll('.move-hint').forEach(el => el.remove());

  const DIRS = { U: [-1, 0], D: [1, 0], L: [0, -1], R: [0, 1] };
  const [pr, pc] = state.player.position;

  for (const dir of validMoves) {
    const [dr, dc] = DIRS[dir];
    const nr = pr + dr, nc = pc + dc;
    const cellType = state.grid[nr][nc]?.type;

    // Determine if this move is lethal
    const currentEl = state.player.element;
    const corr      = state.player.corruption;
    let lethal = false;
    if (cellType && RULES[currentEl]?.absorb[cellType]) {
      const delta = RULES[currentEl].absorb[cellType].corruptionDelta;
      const newCorr = Math.max(0, corr + delta);
      if (newCorr >= RULES[currentEl].deathAt) lethal = true;
    }
    // While transformed: absorbing same-as-current = instant death
    if (state.player.transformed && cellType === currentEl) lethal = true;

    const borderColor = lethal ? '#ff3030' : '#c070ff';
    const fillColor   = lethal ? 'rgba(255,30,30,0.10)' : 'rgba(160,80,255,0.12)';
    const arrowColor  = lethal ? 'rgba(255,100,100,0.70)' : 'rgba(200,140,255,0.55)';

    // Full-cell tap target
    fxLayer.appendChild(svgEl('rect', {
      x: nc * CELL_SIZE, y: nr * CELL_SIZE,
      width: CELL_SIZE, height: CELL_SIZE,
      fill: 'transparent',
      class: 'move-hint move-hint-tap',
      style: 'cursor:pointer',
    }));

    // Pulsing border (purple = safe, red = lethal)
    fxLayer.appendChild(svgEl('rect', {
      x: nc * CELL_SIZE + 3, y: nr * CELL_SIZE + 3,
      width: CELL_SIZE - 6, height: CELL_SIZE - 6,
      fill: fillColor,
      stroke: borderColor,
      'stroke-width': '2',
      rx: '4',
      class: 'move-hint move-hint-pulse',
      style: 'pointer-events:none',
    }));

    // Direction arrow
    const arrowMap = { U:'↑', D:'↓', L:'←', R:'→' };
    const cx = nc * CELL_SIZE + CELL_SIZE / 2;
    const cy = nr * CELL_SIZE + CELL_SIZE / 2 + 5;
    const arrowEl = svgEl('text', {
      x: cx, y: cy,
      'text-anchor': 'middle',
      'font-size': '22',
      fill: arrowColor,
      class: 'move-hint',
      style: 'pointer-events:none; user-select:none;',
    });
    arrowEl.textContent = arrowMap[dir];
    fxLayer.appendChild(arrowEl);
  }
}

export { CELL_SIZE };
