// sfn.js — Sacred Form Notation: tracker, token builder, coordinate helpers.
// Spec: sancta-forma-notation.md (companion to RULES.md).

// Skip 'i' per locked coordinate decision (SFN §2).
export const SFN_COLS = 'abcdefghjklmnopqrstu';

// Engine element names → SFN glyphs (SFN §3.1)
export const ELEMENT_TO_SFN = {
  square:  'S',
  circle:  'C',
  triangle:'T',
  hexagon: 'H',
  moon:    'M',
  star:    'St',
};

/** Convert a zero-indexed column to its SFN letter. */
export function sfnCol(colIdx) {
  return SFN_COLS[colIdx] ?? '?';
}

/**
 * Build a regular-move token from zero-indexed coordinates.
 * rowIdx=0 is the top row (SFN row 1).
 * absorbed is an SFN glyph: 'S' | 'C' | 'T' | 'H' | 'M' | 'St'
 * opts: { hunter, cleansing, fatal }
 */
export function buildMoveToken(colIdx, rowIdx, absorbed, opts = {}) {
  let tok = sfnCol(colIdx) + (rowIdx + 1) + absorbed;
  if      (opts.hunter)    tok += '!';
  else if (opts.cleansing) tok += '*';
  else if (opts.fatal)     tok += '#';
  return tok;
}

/** Build a wormhole-transit token: "c3>g5" (no absorbed glyph, no suffix). */
export function buildWormholeToken(fromCol, fromRow, toCol, toRow) {
  return sfnCol(fromCol) + (fromRow + 1) + '>' + sfnCol(toCol) + (toRow + 1);
}

/**
 * Build an SFN token from a post-move engine event + resulting state status.
 * col/row are zero-indexed destination coordinates.
 */
export function buildSFNToken(col, row, event, stateStatus) {
  const glyph = ELEMENT_TO_SFN[event.absorbed] ?? '?';
  const opts  = {};
  if (event.type === 'costume')     opts.hunter    = true;
  if (event.type === 'cleanse')     opts.cleansing = true;
  if (stateStatus === 'lose-death') opts.fatal     = true;
  return buildMoveToken(col, row, glyph, opts);
}

/* ─────────────────────────────────────────────────────────────────────────────
   SFNTracker — live trace recorder and HUD strip renderer.
   ───────────────────────────────────────────────────────────────────────────── */
export class SFNTracker {
  constructor(elementOrId) {
    this.el = !elementOrId ? null
      : (typeof elementOrId === 'string'
          ? document.getElementById(elementOrId)
          : elementOrId);
    this.tokens = [];
    this._render();
  }

  /**
   * Append a formatted SFN move token.
   * Examples: 'c2T', 'd3H!', 'b2S*', 'e3M#', 'c3>g5'
   */
  add(token) {
    const n = this._moveCount() + 1;
    this.tokens.push({ kind: 'move', n, text: token });
    this._render(true);
  }

  /** Mark a shift event tied to the current move count. */
  shift() {
    const n = this._moveCount();
    if (n === 0) return;
    this.tokens.push({ kind: 'shift', n });
    this._render(true);
  }

  win() {
    this.tokens.push({ kind: 'outcome', flavor: 'win' });
    this._render(true);
  }

  loss(reason) {
    this.tokens.push({ kind: 'outcome', flavor: 'loss', reason: reason || 'unknown' });
    this._render(true);
  }

  reset() {
    this.tokens = [];
    this._render();
  }

  /** Full SFN trace as a plain string (one token per line). Spec-compliant. */
  toString() {
    return this.tokens.map(t => {
      if (t.kind === 'move')    return `${t.n}. ${t.text}`;
      if (t.kind === 'shift')   return `[~${t.n}]`;
      if (t.kind === 'outcome') return t.flavor === 'win' ? '* WIN' : `* LOSS:${t.reason}`;
      return '';
    }).join('\n');
  }

  _moveCount() {
    return this.tokens.reduce((c, t) => c + (t.kind === 'move' ? 1 : 0), 0);
  }

  _render(autoscroll = false) {
    if (!this.el) return;

    if (this.tokens.length === 0) {
      this.el.innerHTML = '<span class="empty-state">awaiting first move\u2026</span>';
      return;
    }

    // Latest move glows; outcome tokens don't take the glow.
    let latestMoveIdx = -1;
    for (let i = this.tokens.length - 1; i >= 0; i--) {
      if (this.tokens[i].kind === 'move') { latestMoveIdx = i; break; }
    }
    const hasOutcome = this.tokens.some(t => t.kind === 'outcome');

    const parts = this.tokens.map((t, i) => {
      if (t.kind === 'move') {
        const cls = (i === latestMoveIdx && !hasOutcome) ? 'move move-latest' : 'move';
        return `<span class="${cls}">${t.n}.${t.text}</span>`;
      }
      if (t.kind === 'shift') {
        return `<span class="move move-shift">[~${t.n}]</span>`;
      }
      if (t.kind === 'outcome') {
        if (t.flavor === 'win') return `<span class="move-outcome-win">&#9733; WIN</span>`;
        return `<span class="move-outcome-loss">&#10007; ${t.reason}</span>`;
      }
      return '';
    });

    this.el.innerHTML = parts.join('');
    if (autoscroll) this.el.scrollTop = this.el.scrollHeight;
  }
}
