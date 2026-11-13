/* Hollowwood Manor — board renderer. Oblique cutaway of two floors on a baize table. */
(function () {
'use strict';
const HW = window.HW, CFG = HW.CFG, MAPS = HW.MAPS, W = HW.W, H = HW.H, DIRS = HW.DIRS;
const T = 40, TY = 32, MX = 20, BW = W * T + MX * 2, BH = 700, TALL = 30, LOW = 9;
const OY = { U: 46, G: 386 };
const tx = c => MX + c * T, ty = (f, r) => OY[f] + r * TY, cx = c => tx(c) + T / 2, cy = (f, r) => ty(f, r) + TY / 2;
const TAU = Math.PI * 2;

let board, ctx, px = 1;
const stat = document.createElement('canvas'), sctx = stat.getContext('2d');
const lightC = document.createElement('canvas'); lightC.width = BW; lightC.height = BH; const lctx = lightC.getContext('2d');

/* ---------- tiny drawing kit ---------- */
const ell = (g, x, y, rx, ry) => { g.beginPath(); g.ellipse(x, y, rx, ry, 0, 0, TAU); };
const circ = (g, x, y, r) => { g.beginPath(); g.arc(x, y, r, 0, TAU); };
function poly(g, p) { g.beginPath(); g.moveTo(p[0], p[1]); for (let i = 2; i < p.length; i += 2) g.lineTo(p[i], p[i + 1]); g.closePath(); }
function rrect(g, x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
const hsh = (a, b, c) => { const x = Math.sin(a * 127.1 + b * 311.7 + (c || 0) * 74.7) * 43758.5453; return x - Math.floor(x); };
function shade(hex, k) { const n = parseInt(hex.slice(1), 16); const f = v => Math.max(0, Math.min(255, Math.round(v * (1 + k)))); return 'rgb(' + f(n >> 16) + ',' + f((n >> 8) & 255) + ',' + f(n & 255) + ')'; }
// a box standing on the floor: footprint (x,y,w,d), raised h
function box(g, x, y, w, d, h, top, front) {
  g.fillStyle = front; g.fillRect(x, y + d - h, w, h);
  g.fillStyle = top; g.fillRect(x, y - h, w, d);
  g.fillStyle = 'rgba(255,255,255,.07)'; g.fillRect(x, y + d - h, w, 1);
  g.fillStyle = 'rgba(0,0,0,.28)'; g.fillRect(x, y + d - 1.5, w, 1.5);
}
function flame(g, x, y, t, s) {
  s = s || 1; const fl = 1 + Math.sin(t * 9 + x) * 0.12 + Math.sin(t * 23 + y) * 0.06;
  g.fillStyle = 'rgba(255,170,60,.9)'; g.beginPath(); g.ellipse(x, y - 3 * s * fl, 2.2 * s, 4.2 * s * fl, 0, 0, TAU); g.fill();
  g.fillStyle = '#fff3c4'; g.beginPath(); g.ellipse(x, y - 2 * s, 1.1 * s, 2.2 * s * fl, 0, 0, TAU); g.fill();
}
function candle(g, x, y) { g.fillStyle = '#8a6f3c'; g.fillRect(x - 3, y - 1, 6, 2); g.fillStyle = '#e9e1cc'; g.fillRect(x - 1.5, y - 8, 3, 7); }

/* ---------- rooms ---------- */
function roomKind(f, c, r) {
  if (MAPS[f][r][c] === '+') return 'door';
  if (f === 'G') return r <= 2 ? 'passage' : c <= 5 ? 'library' : c <= 12 ? 'hall' : 'study';
  return c <= 5 ? 'bedroom' : c <= 12 ? 'gallery' : 'music';
}
function planks(g, x, y, vert, col, seed) {
  g.fillStyle = col;
  if (vert) { for (let i = 0; i < T; i += 10) g.fillRect(x + i, y, 1, TY); g.fillRect(x, y + (seed > 0.5 ? 11 : 22), T, 1); }
  else { for (let i = 0; i < TY; i += 8) g.fillRect(x, y + i, T, 1); g.fillRect(x + (seed > 0.5 ? 13 : 27), y, 1, TY); }
}
function floorTile(g, f, c, r) {
  const x = tx(c), y = ty(f, r), k = roomKind(f, c, r), n = hsh(c, r, f === 'G' ? 1 : 2);
  const fill = col => { g.fillStyle = shade(col, (n - 0.5) * 0.16); g.fillRect(x, y, T, TY); };
  switch (k) {
    case 'passage': fill('#3b2b21'); planks(g, x, y, false, 'rgba(0,0,0,.3)', n); break;
    case 'library': fill('#4d3221'); planks(g, x, y, (c + r) % 2 === 0, 'rgba(0,0,0,.26)', n); break;
    case 'hall':
      g.fillStyle = (c + r) % 2 ? shade('#9d9482', (n - 0.5) * 0.1) : shade('#2c2a31', (n - 0.5) * 0.2); g.fillRect(x, y, T, TY);
      g.strokeStyle = 'rgba(255,255,255,.05)'; g.lineWidth = 1; g.beginPath(); g.moveTo(x + n * T, y); g.lineTo(x + (1 - n) * T, y + TY); g.stroke();
      g.strokeStyle = 'rgba(0,0,0,.35)'; g.strokeRect(x + 0.5, y + 0.5, T - 1, TY - 1); break;
    case 'study': fill('#402c1e'); planks(g, x, y, true, 'rgba(0,0,0,.28)', n); break;
    case 'bedroom': fill('#5a4841'); planks(g, x, y, true, 'rgba(0,0,0,.2)', n); break;
    case 'gallery': fill('#34251e'); planks(g, x, y, false, 'rgba(0,0,0,.32)', n); break;
    case 'music': fill('#6a4b2b'); planks(g, x, y, (c + r) % 2 === 0, 'rgba(0,0,0,.22)', n); break;
    case 'door': g.fillStyle = '#2a1c14'; g.fillRect(x, y, T, TY); g.fillStyle = '#8a6f3c'; g.fillRect(x, y + TY / 2 - 1, T, 2); break;
  }
}
const RUGS = [
  { f: 'G', c: 2, r: 5, w: 3, h: 2, col: '#5c1a24', edge: '#c9a45c' },
  { f: 'G', c: 9, r: 5, w: 2, h: 3, col: '#6e1f2e', edge: '#c9a45c', runner: true },
  { f: 'G', c: 14.4, r: 5.1, w: 2.3, h: 1.8, col: '#1f3d33', edge: '#a8925a' },
  { f: 'U', c: 2, r: 3, w: 3, h: 3, col: '#7d5460', edge: '#e6d3c0', round: true },
  { f: 'U', c: 8, r: 2, w: 4, h: 5, col: '#5f1d28', edge: '#c9a45c' },
  { f: 'U', c: 14.5, r: 2.1, w: 2.5, h: 1.8, col: '#2c3f55', edge: '#b9c7d8' },
];
function rug(g, R) {
  const x = tx(R.c) + 3, y = ty(R.f, R.r) + 3, w = R.w * T - 6, h = R.h * TY - 6;
  if (R.round) {
    g.fillStyle = R.col; ell(g, x + w / 2, y + h / 2, w / 2, h / 2); g.fill();
    g.strokeStyle = R.edge; g.globalAlpha = 0.5; g.lineWidth = 1.2; ell(g, x + w / 2, y + h / 2, w / 2 - 5, h / 2 - 4); g.stroke(); ell(g, x + w / 2, y + h / 2, w / 4, h / 4); g.stroke(); g.globalAlpha = 1; return;
  }
  g.fillStyle = R.col; g.fillRect(x, y, w, h);
  g.strokeStyle = R.edge; g.globalAlpha = 0.55; g.lineWidth = 1.2; g.strokeRect(x + 4, y + 4, w - 8, h - 8); g.lineWidth = 0.7; g.strokeRect(x + 8, y + 7, w - 16, h - 14);
  g.fillStyle = R.edge; g.globalAlpha = 0.28;
  for (let i = 0; i < Math.floor(w / 26); i++) for (let j = 0; j < Math.floor(h / 22); j++) { const mx = x + 18 + i * 26, my = y + 16 + j * 22; poly(g, [mx, my - 5, mx + 6, my, mx, my + 5, mx - 6, my]); g.fill(); }
  g.globalAlpha = 0.5; for (let i = 2; i < w; i += 4) { g.fillRect(x + i, y - 2, 1, 2); g.fillRect(x + i, y + h, 1, 2); }
  g.globalAlpha = 1;
}
const WINDOWS = [2, 4, 8, 11, 15, 16], SCONCES = [6, 13, 16], PICTURES = [4, 8];
const WALLCANDLES = [{ f: 'G', c: 6, r: 6 }, { f: 'G', c: 13, r: 6 }, { f: 'G', c: 6, r: 4 }, { f: 'U', c: 6, r: 6 }, { f: 'U', c: 13, r: 2 }, { f: 'U', c: 13, r: 7 }];
function wallTile(g, f, c, r) {
  const x = tx(c), y = ty(f, r);
  if (r === 0) { // the tall back wall
    const paper = f === 'U' ? '#343a4f' : '#4b272c';
    g.fillStyle = '#18110f'; g.fillRect(x, y - TALL, T, TY);
    g.fillStyle = paper; g.fillRect(x, y + TY - TALL, T, TALL);
    g.fillStyle = 'rgba(255,255,255,.055)'; for (let i = 0; i < 3; i++) for (let j = 0; j < 2; j++) { const mx = x + 7 + i * 13 + (j % 2) * 6, my = y + TY - TALL + 6 + j * 9; poly(g, [mx, my - 3, mx + 3, my, mx, my + 3, mx - 3, my]); g.fill(); }
    g.fillStyle = '#2b1a12'; g.fillRect(x, y + TY - 9, T, 9); g.fillStyle = 'rgba(255,255,255,.07)'; g.fillRect(x, y + TY - 9, T, 1); g.fillStyle = 'rgba(0,0,0,.3)'; g.fillRect(x + T - 1, y + TY - 8, 1, 8);
    return;
  }
  const south = r + 1 >= H || MAPS[f][r + 1][c] !== '#';
  const outer = r === H - 1;
  g.fillStyle = outer ? '#1a1210' : '#211718'; g.fillRect(x, y - LOW, T, TY);
  g.fillStyle = 'rgba(255,255,255,.05)'; g.fillRect(x, y - LOW, T, 1);
  if (south) { g.fillStyle = outer ? '#33211b' : (f === 'U' ? '#3d4258' : '#55323a'); g.fillRect(x, y + TY - LOW, T, LOW); g.fillStyle = 'rgba(0,0,0,.35)'; g.fillRect(x, y + TY - 2, T, 2); }
}
function stairsStatic(g) {
  // grand stair, ground: four steps rising north
  let x = tx(11), y = ty('G', 4);
  for (let i = 0; i < 4; i++) { const sy = y + i * 8, h = (4 - i) * 4.5; box(g, x + 2, sy, 2 * T - 4, 8, h, '#6d4c31', '#49301f'); g.fillStyle = '#6e1f2e'; g.fillRect(x + 22, sy - h, 36, 8); g.fillStyle = 'rgba(201,164,92,.5)'; g.fillRect(x + 22, sy - h, 1, 8); g.fillRect(x + 57, sy - h, 1, 8); }
  g.fillStyle = '#2b1a12'; g.fillRect(x, y - 20, 3, TY + 20); g.fillRect(x + 2 * T - 3, y - 20, 3, TY + 20);
  g.fillStyle = '#c9a45c'; circ(g, x + 1.5, y - 21, 2.5); g.fill(); circ(g, x + 2 * T - 1.5, y - 21, 2.5); g.fill();
  // grand stair, upper: the well
  x = tx(11); y = ty('U', 7);
  const gr = g.createLinearGradient(0, y, 0, y + TY); gr.addColorStop(0, '#4a3020'); gr.addColorStop(1, '#090605'); g.fillStyle = gr; g.fillRect(x + 2, y + 1, 2 * T - 4, TY - 1);
  g.fillStyle = 'rgba(0,0,0,.4)'; for (let i = 1; i < 4; i++) g.fillRect(x + 2, y + i * 8, 2 * T - 4, 1.5);
  g.fillStyle = 'rgba(110,31,46,.75)'; g.fillRect(x + 22, y + 1, 36, TY - 1); const g2 = g.createLinearGradient(0, y, 0, y + TY); g2.addColorStop(0, 'rgba(0,0,0,0)'); g2.addColorStop(1, 'rgba(0,0,0,.85)'); g.fillStyle = g2; g.fillRect(x + 2, y + 1, 2 * T - 4, TY - 1);
  g.fillStyle = '#2b1a12'; g.fillRect(x - 1, y - 14, 3, TY + 14); g.fillRect(x + 2 * T - 2, y - 14, 3, TY + 14);
  // back stairs: a tight spiral on both floors
  for (const f of ['G', 'U']) {
    const X = cx(17), Y = cy(f, 1);
    for (let i = 0; i < 8; i++) { g.fillStyle = i % 2 ? '#5a3d28' : '#3d281a'; g.beginPath(); g.moveTo(X, Y); g.ellipse(X, Y, 17, 13, 0, i * TAU / 8, (i + 1) * TAU / 8); g.closePath(); g.fill(); }
    g.fillStyle = f === 'U' ? '#070504' : '#8a6f3c'; ell(g, X, Y, 4, 3); g.fill();
  }
}
function drawStatic() {
  const g = sctx; g.setTransform(px, 0, 0, px, 0, 0);
  const bg = g.createRadialGradient(BW / 2, BH / 2, 80, BW / 2, BH / 2, 560); bg.addColorStop(0, '#1c2b25'); bg.addColorStop(1, '#0a100e');
  g.fillStyle = bg; g.fillRect(0, 0, BW, BH);
  g.fillStyle = 'rgba(255,255,255,.018)'; for (let i = 0; i < 900; i++) g.fillRect(hsh(i, 1) * BW, hsh(i, 2) * BH, 1.2, 1.2);
  for (const f of ['U', 'G']) {
    const top = OY[f] - TALL;
    g.fillStyle = 'rgba(0,0,0,.55)'; g.fillRect(MX - 2, top + 5, W * T + 8, H * TY + TALL + 6);
    g.fillStyle = '#241812'; g.fillRect(MX - 3, top - 2, W * T + 6, H * TY + TALL + 5);
    for (let r = 1; r < H - 1; r++) for (let c = 1; c < W - 1; c++) if (MAPS[f][r][c] !== '#') floorTile(g, f, c, r);
    for (const R of RUGS) if (R.f === f) rug(g, R);
    // doormat
    if (f === 'G') { g.fillStyle = '#3a2d20'; g.fillRect(tx(9) + 4, ty('G', 7) + 12, 72, 17); g.strokeStyle = 'rgba(201,164,92,.45)'; g.lineWidth = 1; g.strokeRect(tx(9) + 7, ty('G', 7) + 15, 66, 11); }
    // the built-in movement spaces
    g.lineWidth = 1;
    for (let r = 1; r < H - 1; r++) for (let c = 1; c < W - 1; c++) if (MAPS[f][r][c] !== '#' && !HW.STAIRS[HW.key(f, c, r)]) { g.strokeStyle = MAPS[f][r][c] === '+' ? 'rgba(214,178,110,.4)' : 'rgba(214,178,110,.2)'; ell(g, cx(c), cy(f, r), 10, 5.6); g.stroke(); }
    for (let r = 0; r < H; r++) for (let c = 0; c < W; c++) if (MAPS[f][r][c] === '#') wallTile(g, f, c, r);
    // dressing on the back wall
    const wy = OY[f] + TY - TALL;
    if (f === 'U') for (const c of WINDOWS) {
      const x = cx(c); const gl = g.createLinearGradient(0, wy, 0, wy + 20); gl.addColorStop(0, '#c7dcf2'); gl.addColorStop(1, '#5d82b3');
      g.fillStyle = '#1a1412'; rrect(g, x - 9, wy + 1, 18, 21, 7); g.fill(); g.fillStyle = gl; rrect(g, x - 7, wy + 3, 14, 18, 6); g.fill();
      g.fillStyle = '#1a1412'; g.fillRect(x - 0.6, wy + 3, 1.2, 18); g.fillRect(x - 7, wy + 12, 14, 1.2);
    } else {
      for (const c of SCONCES) { const x = cx(c); g.fillStyle = '#8a6f3c'; g.fillRect(x - 4, wy + 14, 8, 2); g.fillRect(x - 1, wy + 14, 2, 5); candle(g, x, wy + 14); }
      for (const c of PICTURES) { const x = cx(c); g.fillStyle = '#b8923f'; g.fillRect(x - 9, wy + 4, 18, 14); g.fillStyle = hsh(c, 9) > 0.5 ? '#26352e' : '#33251f'; g.fillRect(x - 7, wy + 6, 14, 10); g.fillStyle = 'rgba(255,255,255,.12)'; ell(g, x, wy + 11, 3, 4); g.fill(); }
    }
    for (const wc of WALLCANDLES) if (wc.f === f) { const x = cx(wc.c), y = cy(f, wc.r) - LOW; g.fillStyle = '#8a6f3c'; ell(g, x, y + 1, 5, 2.5); g.fill(); candle(g, x, y + 1); }
    // plaques
    g.font = '600 9px "Alegreya Sans", sans-serif'; g.fillStyle = 'rgba(214,178,110,.75)'; g.textBaseline = 'middle';
    g.save(); g.translate(MX + 6, top + 9); g.fillText(spaced(f === 'U' ? 'UPPER FLOOR' : 'GROUND FLOOR'), 0, 0); g.restore();
  }
  stairsStatic(g);
  const lab = (f, c, r, s) => { g.font = 'italic 10px "IM Fell English", Georgia, serif'; g.fillStyle = 'rgba(234,223,196,.34)'; g.textBaseline = 'alphabetic'; g.textAlign = 'left'; g.fillText(s, tx(c) + 4, ty(f, r) + TY - 5); };
  lab('G', 4, 2, 'Servants’ Passage'); lab('G', 2, 7, 'Library'); lab('G', 7, 7, 'Entrance Hall'); lab('G', 15, 7, 'Study');
  lab('U', 2, 7, 'Lil’s Bedroom'); lab('U', 7, 7, 'Gallery'); lab('U', 15, 7, 'Music Room');
}
const spaced = s => s.split('').join(' ');

/* ---------- furniture ---------- */
function bounds(o) {
  let c0 = 99, c1 = -1, r0 = 99, r1 = -1; for (const [c, r] of o.t) { c0 = Math.min(c0, c); c1 = Math.max(c1, c); r0 = Math.min(r0, r); r1 = Math.max(r1, r); }
  return { x: tx(c0), y: ty(o.f, r0), w: (c1 - c0 + 1) * T, d: (r1 - r0 + 1) * TY, r1 };
}
const HEIGHT = { shelf: 38, desk: 20, chest: 16, strongbox: 18, armchair: 26, gclock: 50, console: 24, cabinet: 13, cabinetUp: 42, hatch: 0, bed: 22, vanity: 30, doll: 24, case: 26, bust: 36, chandelier: 10, debris: 0, gramophone: 36, piano: 19, musiccab: 30, harp: 44 };
const BOOKS = ['#6e1f2e', '#27483f', '#3b4a6b', '#8a6a2f', '#4a2d4f', '#7a5a3a', '#1f2d3a', '#5c3a1a'];
const DRAW = {
  shelf(g, o, b, S) {
    box(g, b.x + 2, b.y + 5, b.w - 4, TY - 8, 36, '#24150d', '#35200f');
    const fx = b.x + 2, fy = b.y + 5 + TY - 8 - 36;
    for (let row = 0; row < 3; row++) {
      const by = fy + 3 + row * 11; let xx = fx + 3, i = 0;
      g.fillStyle = '#150c06'; g.fillRect(fx + 2, by, b.w - 8, 10);
      while (xx < fx + b.w - 9) { const n = hsh(o.t[0][0] * 7 + row, i++, 3), w = 2.5 + n * 3, h = 6.5 + hsh(i, row, 5) * 3; if (!(S.searched[o.id] && row === 1 && i > 3 && i < 7)) { g.fillStyle = BOOKS[Math.floor(n * 97) % BOOKS.length]; g.fillRect(xx, by + 10 - h, w, h); g.fillStyle = 'rgba(255,220,150,.25)'; g.fillRect(xx, by + 12 - h, w, 0.8); } xx += w + 0.6; }
    }
  },
  desk(g, o, b, S, t) {
    box(g, b.x + 3, b.y + 7, b.w - 6, TY - 11, 14, '#5d3c23', '#412818');
    const ty0 = b.y - 7; g.fillStyle = '#1f4a3c'; g.fillRect(b.x + b.w / 2 - 15, ty0 + 4, 30, 13);
    g.save(); g.translate(b.x + b.w / 2 + 3, ty0 + 10); g.rotate(-0.15); g.fillStyle = '#e9e1cc'; g.fillRect(-7, -5, 13, 9); g.restore();
    g.fillStyle = '#141018'; circ(g, b.x + b.w - 14, ty0 + 8, 2.6); g.fill(); g.strokeStyle = '#e9e1cc'; g.lineWidth = 1; g.beginPath(); g.moveTo(b.x + b.w - 14, ty0 + 7); g.lineTo(b.x + b.w - 8, ty0 - 4); g.stroke();
    const fy = b.y + 7 + TY - 11 - 14; for (let i = 0; i < 3; i++) { const dx = b.x + 8 + i * ((b.w - 16) / 3); const pull = S.searched[o.id] && i === 1 ? 3 : 0; g.fillStyle = pull ? '#6b4628' : '#553420'; g.fillRect(dx, fy + 3 + pull, (b.w - 16) / 3 - 4, 8); g.fillStyle = '#c9a45c'; circ(g, dx + (b.w - 16) / 6 - 2, fy + 7 + pull, 1.3); g.fill(); }
    candle(g, b.x + 13, ty0 + 8); flame(g, b.x + 13, ty0 - 1, t);
  },
  chest(g, o, b, S) {
    const open = S.searched[o.id];
    if (open) { g.fillStyle = '#3a2414'; g.fillRect(b.x + 6, b.y - 14, T - 12, 13); g.fillStyle = '#8a6f3c'; g.fillRect(b.x + 11, b.y - 14, 2, 13); g.fillRect(b.x + T - 13, b.y - 14, 2, 13); }
    box(g, b.x + 6, b.y + 10, T - 12, TY - 15, 13, open ? '#120c08' : '#704828', '#4c2f1a');
    g.fillStyle = '#8a6f3c'; g.fillRect(b.x + 11, b.y + 14, 2, 13); g.fillRect(b.x + T - 13, b.y + 14, 2, 13); if (!open) { g.fillRect(b.x + 11, b.y - 3, 2, 17); g.fillRect(b.x + T - 13, b.y - 3, 2, 17); }
    g.fillStyle = '#c9a45c'; g.fillRect(b.x + T / 2 - 2, b.y + 16, 4, 5);
  },
  strongbox(g, o, b, S) {
    box(g, b.x + 7, b.y + 9, T - 14, TY - 13, 17, '#444a53', '#2a2e35');
    const fy = b.y + 9 + TY - 13 - 17; g.fillStyle = '#5a616c'; for (const [dx, dy] of [[3, 3], [T - 18, 3], [3, 13], [T - 18, 13]]) { circ(g, b.x + 7 + dx, fy + dy, 1); g.fill(); }
    if (S.done.strongbox) { g.fillStyle = '#0b0c0f'; g.fillRect(b.x + 12, fy + 3, T - 24, 11); g.fillStyle = '#e9e1cc'; g.fillRect(b.x + 14, fy + 9, 9, 4); }
    else { g.strokeStyle = '#c9a45c'; g.lineWidth = 1.5; circ(g, b.x + T / 2, fy + 8.5, 4); g.stroke(); g.beginPath(); g.moveTo(b.x + T / 2, fy + 8.5); g.lineTo(b.x + T / 2 + 2, fy + 6); g.stroke(); }
  },
  armchair(g, o, b) {
    box(g, b.x + 7, b.y + 6, T - 14, 6, 24, '#4f1522', '#6b1d2d'); box(g, b.x + 7, b.y + 12, T - 14, TY - 17, 9, '#822639', '#571624');
    box(g, b.x + 5, b.y + 11, 4, TY - 16, 14, '#6b1d2d', '#4f1522'); box(g, b.x + T - 9, b.y + 11, 4, TY - 16, 14, '#6b1d2d', '#4f1522');
  },
  gclock(g, o, b, S, t) {
    box(g, b.x + 10, b.y + 8, T - 20, TY - 14, 50, '#2c1a10', '#46291a');
    const fx = b.x + 10, fy = b.y + 8 + TY - 14 - 50;
    g.fillStyle = '#e9e1cc'; circ(g, fx + 10, fy + 11, 7.5); g.fill(); g.strokeStyle = '#c9a45c'; g.lineWidth = 1.2; g.stroke();
    const m = S.time % 60, hr = (S.time / 60) % 12; g.strokeStyle = '#1a120c'; g.lineCap = 'round';
    g.lineWidth = 1.4; g.beginPath(); g.moveTo(fx + 10, fy + 11); g.lineTo(fx + 10 + Math.sin(hr / 12 * TAU) * 4, fy + 11 - Math.cos(hr / 12 * TAU) * 4); g.stroke();
    g.lineWidth = 1; g.beginPath(); g.moveTo(fx + 10, fy + 11); g.lineTo(fx + 10 + Math.sin(m / 60 * TAU) * 6, fy + 11 - Math.cos(m / 60 * TAU) * 6); g.stroke(); g.lineCap = 'butt';
    g.fillStyle = '#120a06'; g.fillRect(fx + 5, fy + 23, 10, 20);
    const sw = Math.sin(t * 2.2) * 3; g.strokeStyle = '#c9a45c'; g.lineWidth = 1; g.beginPath(); g.moveTo(fx + 10, fy + 24); g.lineTo(fx + 10 + sw, fy + 37); g.stroke(); g.fillStyle = '#c9a45c'; circ(g, fx + 10 + sw, fy + 38, 2.6); g.fill();
  },
  console(g, o, b, S, t) {
    box(g, b.x + 4, b.y + 12, T - 8, TY - 18, 13, '#50331f', '#382214');
    g.fillStyle = '#382214'; g.fillRect(b.x + 16, b.y + 19, 8, 6); g.fillStyle = '#c9a45c'; circ(g, b.x + 20, b.y + 22, 1.2); g.fill();
    const y = b.y + 2; g.fillStyle = '#8a6f3c'; g.fillRect(b.x + 19, y - 6, 2, 8); g.fillRect(b.x + 12, y - 6, 16, 1.5);
    for (const dx of [12, 20, 28]) { candle(g, b.x + dx, y - 6); flame(g, b.x + dx, y - 15, t, 0.85); }
  },
  cabinet(g, o, b) {
    box(g, b.x + 3, b.y + 3, T - 6, 2 * TY - 7, 14, '#6a4427', '#3c2414');
    const tyy = b.y - 11; g.strokeStyle = '#3c2414'; g.lineWidth = 2; g.strokeRect(b.x + 6, tyy + 3, T - 12, 2 * TY - 13);
    g.fillStyle = 'rgba(160,195,205,.38)'; g.fillRect(b.x + 8, tyy + 5, T - 16, 22); g.fillRect(b.x + 8, tyy + 30, T - 16, 20);
    g.fillStyle = '#3c2414'; g.fillRect(b.x + 6, tyy + 27, T - 12, 3);
    g.strokeStyle = 'rgba(235,245,255,.7)'; g.lineWidth = 0.9; g.beginPath(); g.moveTo(b.x + 10, tyy + 7); g.lineTo(b.x + 21, tyy + 16); g.lineTo(b.x + 17, tyy + 25); g.moveTo(b.x + 21, tyy + 16); g.lineTo(b.x + 30, tyy + 12); g.moveTo(b.x + 12, tyy + 48); g.lineTo(b.x + 20, tyy + 38); g.lineTo(b.x + 30, tyy + 41); g.stroke();
    g.fillStyle = '#c9a45c'; circ(g, b.x + T / 2, tyy + 28.5, 1.6); g.fill();
    g.fillStyle = '#2a180c'; g.fillRect(b.x + 5, b.y + 2 * TY - 6, 4, 4); g.fillRect(b.x + T - 9, b.y + 2 * TY - 6, 4, 4);
    g.fillStyle = 'rgba(215,235,255,.7)'; for (let i = 0; i < 9; i++) { const sx = b.x - 5 + hsh(i, 4) * (T + 10), sy = b.y + 2 * TY - 6 + hsh(i, 8) * 8; poly(g, [sx, sy, sx + 3.4, sy - 1.6, sx + 2, sy + 2.2]); g.fill(); }
    g.fillStyle = '#e9e1cc'; ell(g, b.x - 3, b.y + 20, 3, 1.8); g.fill(); ell(g, b.x + T + 2, b.y + 40, 2.6, 1.6); g.fill();
  },
  cabinetUp(g, o, b) {
    box(g, b.x + 4, b.y + 6, T - 8, TY - 11, 42, '#2f1c10', '#5a3a22');
    const fy = b.y + 6 + TY - 11 - 42; g.fillStyle = 'rgba(150,180,190,.25)'; g.fillRect(b.x + 8, fy + 4, 11, 26); g.fillRect(b.x + 21, fy + 4, 11, 26);
    g.fillStyle = '#2f1c10'; g.fillRect(b.x + 8, fy + 16, 24, 1.2); g.fillStyle = 'rgba(233,225,204,.7)'; for (let i = 0; i < 4; i++) { ell(g, b.x + 11 + i * 6, fy + 14, 2, 1.2); g.fill(); }
    g.strokeStyle = 'rgba(230,240,255,.4)'; g.lineWidth = 0.7; g.beginPath(); g.moveTo(b.x + 9, fy + 6); g.lineTo(b.x + 17, fy + 20); g.stroke();
  },
  hatch(g, o, b, S, t) {
    const x = b.x + 4, y = b.y + 3, w = T - 8, h = TY - 6;
    g.strokeStyle = 'rgba(235,235,225,.3)'; g.lineWidth = 1; g.beginPath(); g.ellipse(b.x + T / 2, b.y + TY / 2, 23, 17, 0, 0.4, 2.6); g.stroke(); g.beginPath(); g.ellipse(b.x + T / 2, b.y + TY / 2, 23, 17, 0, 3.6, 5.6); g.stroke();
    g.fillStyle = `rgba(190,40,40,${0.2 + Math.sin(t * 1.3) * 0.1})`; g.fillRect(x - 1, y - 1, w + 2, h + 2);
    g.fillStyle = '#2a2320'; g.fillRect(x, y, w, h); g.fillStyle = 'rgba(0,0,0,.4)'; for (let i = 8; i < w; i += 8) g.fillRect(x + i, y, 1, h);
    g.fillStyle = '#4a4d52'; g.fillRect(x, y + 4, w, 4); g.fillRect(x, y + h - 8, w, 4); g.fillStyle = '#6d727a'; g.fillRect(x + w - 11, y + h / 2 - 2, 11, 4);
    g.strokeStyle = '#8d949c'; g.lineWidth = 1.6; ell(g, x + 9, y + h / 2, 4, 3); g.stroke();
    if (S.key.state === 'hatch') { g.save(); g.shadowColor = '#ffd98a'; g.shadowBlur = 10 + Math.sin(t * 4) * 4; glyph(g, 'masterkey', x + w / 2, y + h / 2 - 2, 1.5); g.restore(); }
  },
  bed(g, o, b, S) {
    box(g, b.x + 2, b.y + 4, 5, TY - 7, 22, '#3a2416', '#58371f');
    box(g, b.x + 7, b.y + 7, b.w - 10, TY - 11, 10, '#f0ebe0', '#c5bdad');
    g.fillStyle = '#fff'; rrect(g, b.x + 10, b.y, 14, 15, 3); g.fill();
    g.fillStyle = '#dfe7f2'; g.fillRect(b.x + 30, b.y - 3, b.w - 34, TY - 11); g.fillStyle = '#b9c7dd'; g.fillRect(b.x + 30, b.y - 3, 3, TY - 11);
    g.fillStyle = S.searched[o.id] ? '#0f0a08' : '#2a1c14'; g.fillRect(b.x + 9, b.y + TY - 5, b.w - 14, 2);
  },
  vanity(g, o, b, S, t) {
    g.fillStyle = '#b8923f'; ell(g, b.x + T / 2, b.y - 8, 9, 12); g.fill();
    const gl = g.createLinearGradient(b.x + 12, b.y - 18, b.x + 28, b.y + 2); gl.addColorStop(0, '#dfe9f2'); gl.addColorStop(1, '#6f8296'); g.fillStyle = gl; ell(g, b.x + T / 2, b.y - 8, 7, 10); g.fill();
    g.fillStyle = `rgba(255,255,255,${0.12 + Math.sin(t * 0.9) * 0.08})`; ell(g, b.x + T / 2, b.y - 9, 2.5, 5); g.fill(); // something white, far back in the glass
    box(g, b.x + 6, b.y + 12, T - 12, TY - 17, 13, '#6f4d3c', '#4c3327');
    g.fillStyle = '#c9a45c'; circ(g, b.x + 14, b.y + 20, 1.2); g.fill(); circ(g, b.x + 26, b.y + 20, 1.2); g.fill();
  },
  doll(g, o, b, S, t) {
    const X = b.x + T / 2, Y = b.y + TY / 2 + 6;
    g.fillStyle = 'rgba(0,0,0,.4)'; ell(g, X, Y + 2, 11, 5); g.fill();
    box(g, X - 8, Y - 6, 16, 8, 6, '#5a3a22', '#3c2414'); g.fillStyle = '#3c2414'; g.fillRect(X - 8, Y - 20, 2, 16); g.fillRect(X + 6, Y - 20, 2, 16); g.fillRect(X - 8, Y - 21, 16, 2);
    g.fillStyle = '#24304f'; poly(g, [X - 3, Y - 16, X + 3, Y - 16, X + 7, Y - 5, X - 7, Y - 5]); g.fill(); g.fillStyle = '#e9e1cc'; g.fillRect(X - 6, Y - 6, 12, 1.5);
    g.fillStyle = '#2a1c14'; circ(g, X, Y - 20, 5.6); g.fill(); g.fillStyle = '#f4ede4'; circ(g, X, Y - 19.5, 4.6); g.fill();
    g.fillStyle = 'rgba(230,130,130,.5)'; circ(g, X - 2.8, Y - 17.8, 1.1); g.fill(); circ(g, X + 2.8, Y - 17.8, 1.1); g.fill();
    g.fillStyle = '#12100f'; circ(g, X - 1.8, Y - 20, 0.9); g.fill(); circ(g, X + 1.8, Y - 20, 0.9); g.fill();
    g.strokeStyle = '#8fc4f2'; g.lineWidth = 0.9; g.beginPath(); g.moveTo(X - 1.8, Y - 19); g.lineTo(X - 1.8, Y - 15.5); g.moveTo(X + 1.8, Y - 19); g.lineTo(X + 1.8, Y - 15.5); g.stroke();
    const d = (t * 0.8) % 1; g.fillStyle = `rgba(143,196,242,${1 - d})`; circ(g, X - 1.8, Y - 15 + d * 9, 1.1); g.fill(); const d2 = (t * 0.8 + 0.5) % 1; g.fillStyle = `rgba(143,196,242,${1 - d2})`; circ(g, X + 1.8, Y - 15 + d2 * 9, 1.1); g.fill();
  },
  portrait(g, o, b, S) {
    const x = tx(9) + 4, y = OY.U + TY - TALL + 1, w = 72, h = 20;
    g.fillStyle = '#b8923f'; g.fillRect(x, y, w, h); g.fillStyle = '#8a6a26'; g.fillRect(x + 1, y + 1, w - 2, h - 2); g.fillStyle = '#241915'; g.fillRect(x + 3, y + 3, w - 6, h - 6);
    const fig = (fx, col, hc, hh) => { g.fillStyle = col; poly(g, [fx - 4, y + h - 3, fx - 3, y + h - 3 - hh, fx + 3, y + h - 3 - hh, fx + 4, y + h - 3]); g.fill(); g.fillStyle = hc; circ(g, fx, y + h - 4 - hh, 2.2); g.fill(); };
    fig(x + 20, '#15161c', '#c9a98c', 9); fig(x + 50, '#5a1c2a', '#d6b79b', 8); fig(x + 64, '#1d2c22', '#6f6557', 7);
    if (S.done.portrait) { g.save(); g.shadowColor = '#fff'; g.shadowBlur = 6; fig(x + 35, '#f6f8fc', '#fbfcff', 5.5); g.restore(); }
    else { g.fillStyle = '#0a0706'; poly(g, [x + 28, y + 3, x + 41, y + 3, x + 43, y + 9, x + 40, y + h - 3, x + 30, y + h - 3, x + 27, y + 10]); g.fill(); g.strokeStyle = 'rgba(233,225,204,.5)'; g.lineWidth = 0.6; g.stroke(); }
  },
  case(g, o, b, S) {
    box(g, b.x + 7, b.y + 10, T - 14, TY - 14, 11, '#4d3222', '#33200f');
    if (!S.searched[o.id]) { g.fillStyle = '#e9e1cc'; g.save(); g.translate(b.x + T / 2, b.y + 6); g.rotate(0.2); g.fillRect(-5, -4, 10, 7); g.restore(); }
    g.fillStyle = 'rgba(170,205,215,.16)'; g.fillRect(b.x + 8, b.y - 14, T - 16, TY - 2); g.strokeStyle = 'rgba(210,235,245,.45)'; g.lineWidth = 0.8; g.strokeRect(b.x + 8.5, b.y - 13.5, T - 17, TY - 3);
    g.beginPath(); g.moveTo(b.x + 12, b.y - 10); g.lineTo(b.x + 18, b.y + 6); g.stroke();
  },
  bust(g, o, b) {
    box(g, b.x + 13, b.y + 12, T - 26, TY - 19, 18, '#8e8983', '#66615b');
    const X = b.x + T / 2, Y = b.y - 6; g.fillStyle = '#c4c0b8'; ell(g, X, Y, 7, 4); g.fill(); g.fillRect(X - 1.5, Y - 6, 3, 5); circ(g, X, Y - 10, 4.6); g.fill(); g.fillStyle = 'rgba(0,0,0,.18)'; ell(g, X + 2, Y - 10, 2.4, 4.4); g.fill();
  },
  chandelier(g, o, b, S, t) {
    const X = b.x + T / 2, Y = b.y + b.d / 2;
    g.strokeStyle = '#6d5526'; g.lineWidth = 4; ell(g, X + 1, Y + 2, 15, 22); g.stroke(); g.strokeStyle = '#c9a45c'; g.lineWidth = 2.4; ell(g, X, Y, 15, 22); g.stroke(); ell(g, X, Y, 6, 9); g.stroke();
    for (let i = 0; i < 6; i++) { const a = i * TAU / 6 + 0.3; g.beginPath(); g.moveTo(X + Math.cos(a) * 6, Y + Math.sin(a) * 9); g.lineTo(X + Math.cos(a) * 17, Y + Math.sin(a) * 25); g.stroke(); g.fillStyle = '#e9e1cc'; g.fillRect(X + Math.cos(a) * 17 - 1.5, Y + Math.sin(a) * 25 - 5, 3, 5); }
    for (let i = 0; i < 12; i++) { const sx = b.x + 2 + hsh(i, 21) * (T - 4), sy = b.y + hsh(i, 22) * b.d; g.fillStyle = `rgba(215,232,255,${0.5 + Math.sin(t * 2 + i) * 0.25})`; poly(g, [sx, sy - 2.5, sx + 1.8, sy, sx, sy + 2.5, sx - 1.8, sy]); g.fill(); }
  },
  debris(g, o, b) { g.fillStyle = 'rgba(215,232,255,.4)'; for (let i = 0; i < 6; i++) { const sx = b.x + 3 + hsh(i, 31) * 10, sy = b.y + hsh(i, 32) * b.d; poly(g, [sx, sy - 2, sx + 1.5, sy, sx, sy + 2, sx - 1.5, sy]); g.fill(); } },
  gramophone(g, o, b, S, t) {
    const X = b.x + T / 2, rec = S.record;
    box(g, b.x + 8, b.y + 10, T - 16, TY - 15, 14, '#4d2e19', '#341e10');
    const ty0 = b.y + 4; g.fillStyle = '#0d0c0e'; ell(g, X + 2, ty0, 9.5, 5); g.fill(); g.fillStyle = '#7a2233'; ell(g, X + 2, ty0, 3, 1.6); g.fill();
    const sp = rec.calmed ? t * 2.2 : rec.timer <= 1 ? t * 7 : t * 0.6; g.strokeStyle = 'rgba(255,255,255,.3)'; g.lineWidth = 0.8; g.beginPath(); g.ellipse(X + 2, ty0, 7, 3.7, 0, sp, sp + 0.9); g.stroke();
    const mx = X - 7, my = b.y - 22; // the horn
    g.fillStyle = '#8a6f3c'; poly(g, [X + 6, ty0 - 1, X + 9, ty0 - 3, mx + 9, my - 6, mx - 6, my + 8]); g.fill();
    g.fillStyle = '#c9a45c'; ell(g, mx, my, 11, 9.5); g.fill(); g.fillStyle = '#e3c684'; ell(g, mx - 1, my - 1, 9, 7.5); g.fill(); g.fillStyle = '#120c08'; ell(g, mx, my, 6.5, 5.5); g.fill();
    if (rec.calmed) { g.fillStyle = 'rgba(233,225,204,.8)'; g.font = '11px serif'; g.textAlign = 'center'; for (let i = 0; i < 2; i++) { const k = (t * 0.4 + i * 0.5) % 1; g.globalAlpha = 1 - k; g.fillText('♪', mx - 6 - k * 10 + i * 12, my - 6 - k * 16); } g.globalAlpha = 1; return; }
    const reachK = (CFG.recordTimer - rec.timer) / (CFG.recordTimer - 1), len = 4 + reachK * 15 + Math.sin(t * 3) * 1.5;
    if (reachK > 0) {
      const hx = mx - len * 0.75, hy = my + len * 0.7;
      g.strokeStyle = '#a9d8ff'; g.lineCap = 'round'; g.lineWidth = 3.4; g.beginPath(); g.moveTo(mx, my); g.quadraticCurveTo(mx - len * 0.2, my + len * 0.6, hx, hy); g.stroke();
      g.lineWidth = 1.3; for (let i = 0; i < 4; i++) { const a = 2.0 + i * 0.32 + Math.sin(t * 5 + i) * 0.12; g.beginPath(); g.moveTo(hx, hy); g.lineTo(hx + Math.cos(a) * 6, hy + Math.sin(a) * 6); g.stroke(); }
      g.lineCap = 'butt'; g.fillStyle = '#c9e7ff'; circ(g, hx, hy, 2.4); g.fill();
    }
    for (let i = 0; i < CFG.recordTimer; i++) { g.fillStyle = i < rec.timer ? '#a9d8ff' : 'rgba(169,216,255,.2)'; circ(g, X - 6 + i * 7, b.y - 38, 2.2); g.fill(); }
  },
  piano(g, o, b) {
    box(g, b.x + 3, b.y + 4, b.w - 6, TY - 8, 19, '#0e0d10', '#1b1a20');
    const fy = b.y + 4 + TY - 8 - 19; g.fillStyle = '#efe6d0'; g.fillRect(b.x + 7, fy + 1, b.w - 14, 5); g.fillStyle = '#0e0d10'; for (let i = 0; i < 16; i++) if (i % 7 !== 2 && i % 7 !== 6) g.fillRect(b.x + 9 + i * 4, fy + 1, 2, 3);
    g.fillStyle = 'rgba(255,255,255,.08)'; g.fillRect(b.x + 5, b.y - 13, b.w - 10, 2); g.fillStyle = '#e9e1cc'; g.fillRect(b.x + b.w / 2 - 8, b.y - 11, 16, 9); g.fillStyle = '#555'; for (let i = 0; i < 3; i++) g.fillRect(b.x + b.w / 2 - 6, b.y - 9 + i * 2.5, 12, 0.7);
  },
  musiccab(g, o, b, S) {
    box(g, b.x + 6, b.y + 8, T - 12, TY - 12, 30, '#39220f', '#4f301c');
    const fy = b.y + 8 + TY - 12 - 30; g.strokeStyle = '#2a180a'; g.lineWidth = 1; g.strokeRect(b.x + 9.5, fy + 3.5, 9, 23); g.strokeRect(b.x + 21.5, fy + 3.5, 9, 23);
    g.fillStyle = '#c9a45c'; circ(g, b.x + 18, fy + 15, 1.1); g.fill(); circ(g, b.x + 22, fy + 15, 1.1); g.fill();
    if (S.searched[o.id]) { g.fillStyle = '#0f0906'; g.fillRect(b.x + 21.5, fy + 3.5, 9, 23); }
  },
  harp(g, o, b) {
    const x = b.x + 10, y = b.y + TY - 8; g.fillStyle = 'rgba(0,0,0,.4)'; ell(g, b.x + T / 2, y + 2, 13, 5); g.fill();
    g.strokeStyle = '#c9a45c'; g.lineWidth = 3; g.beginPath(); g.moveTo(x, y); g.lineTo(x, y - 42); g.quadraticCurveTo(x + 14, y - 50, x + 22, y - 30); g.stroke(); g.lineWidth = 2.2; g.beginPath(); g.moveTo(x + 22, y - 30); g.lineTo(x + 3, y); g.stroke();
    g.strokeStyle = 'rgba(233,225,204,.55)'; g.lineWidth = 0.5; for (let i = 1; i < 7; i++) { const k = i / 7; g.beginPath(); g.moveTo(x + 1 + k * 20, y - 42 - Math.sin(k * 3) * 5 + k * 13); g.lineTo(x + 1 + k * 3, y - 2); g.stroke(); }
  },
};
function drapes(g, f, c, r, col, front) {
  const x = tx(c), y = ty(f, r);
  if (!front) { g.fillStyle = '#0a0706'; g.fillRect(x + 4, y - 28, T - 8, TY + 22); }
  g.fillStyle = '#8a6f3c'; g.fillRect(x + 1, y - 31, T - 2, 2.5);
  const fold = (fx, w) => { for (let i = 0; i < w; i += 5) { g.fillStyle = i % 10 ? col : shade(col, -0.3); g.fillRect(fx + i, y - 29, 5, TY + 24 - (i % 10 ? 0 : 1)); } };
  if (front) fold(x + 2, T - 4); else { fold(x + 2, 10); fold(x + T - 12, 10); }
}
const DRAPE = { 'G7,7': '#6b1d2d', 'U5,1': '#3d4f2f', 'U7,1': '#2b3d5e' };

/* ---------- item glyphs and tokens ---------- */
function glyph(g, item, x, y, s) {
  g.save(); g.translate(x, y); g.scale(s || 1, s || 1);
  switch (item) {
    case 'cipher': g.fillStyle = '#e9e1cc'; g.fillRect(-4, -5, 8, 10); g.fillStyle = '#555'; for (let i = 0; i < 4; i++) g.fillRect(-2.5, -3.5 + i * 2.2, 5, 0.7); break;
    case 'fragment': g.fillStyle = '#b8923f'; poly(g, [-5, -4, 4, -5, 5, 3, -1, 5, -4, 1]); g.fill(); g.fillStyle = '#f6f8fc'; circ(g, 0, -0.5, 2); g.fill(); break;
    case 'record': g.fillStyle = '#0d0c0e'; circ(g, 0, 0, 5.5); g.fill(); g.fillStyle = '#dfe7f2'; circ(g, 0, 0, 2); g.fill(); g.fillStyle = '#0d0c0e'; circ(g, 0, 0, 0.6); g.fill(); break;
    case 'windkey': g.strokeStyle = '#c9a45c'; g.lineWidth = 1.5; circ(g, -3.5, 0, 2); g.stroke(); circ(g, -3.5, -3.6, 2); g.stroke(); g.beginPath(); g.moveTo(-1.5, -1.8); g.lineTo(5, -1.8); g.stroke(); g.fillStyle = '#c9a45c'; g.fillRect(3.5, -3, 2, 2.6); break;
    case 'masterkey': g.strokeStyle = '#ffd98a'; g.lineWidth = 1.7; circ(g, -3.5, 0, 2.6); g.stroke(); g.beginPath(); g.moveTo(-0.9, 0); g.lineTo(6, 0); g.moveTo(4, 0); g.lineTo(4, 2.8); g.moveTo(6, 0); g.lineTo(6, 2.2); g.stroke(); break;
    case 'salts': g.fillStyle = '#7fb3a8'; g.fillRect(-2.5, -2, 5, 7); g.fillStyle = '#c9a45c'; g.fillRect(-1.5, -5, 3, 3); break;
    case 'bandage': g.fillStyle = '#efe6d0'; rrect(g, -5, -2.5, 10, 5, 2); g.fill(); g.fillStyle = '#dc6253'; g.fillRect(-0.8, -2.2, 1.6, 4.4); g.fillRect(-2.2, -0.8, 4.4, 1.6); break;
  }
  g.restore();
}
function token(g, it, t) {
  const x = cx(it.c), y = cy(it.f, it.r), p = Math.sin(t * 4) * 0.5 + 0.5;
  g.strokeStyle = `rgba(255,217,138,${0.4 + p * 0.5})`; g.lineWidth = 1.5; ell(g, x, y, 11 + p * 2, 6 + p); g.stroke();
  g.fillStyle = '#16100c'; ell(g, x, y + 1.5, 8.5, 5); g.fill(); g.fillStyle = '#3a2a1c'; ell(g, x, y, 8.5, 5); g.fill();
  glyph(g, it.item, x, y - 5 - p * 1.5, 1.15);
}
function trap(g, tr, S, t, front) {
  const x = cx(tr.c), y = cy(tr.f, tr.r), held = !!tr.holding, asleep = tr.dormant > 0 && !held;
  const teeth = (yy, up, a0, a1) => { g.fillStyle = '#b9c0c8'; for (let i = 0; i <= 8; i++) { const a = a0 + (a1 - a0) * i / 8, px = x + Math.cos(a) * 12, py = yy + Math.sin(a) * 6; poly(g, [px - 1.6, py, px + 1.6, py, px, py - up]); g.fill(); } };
  if (front) { if (!held) return; g.strokeStyle = '#8d949c'; g.lineWidth = 2.4; g.beginPath(); g.ellipse(x, y - 5, 13, 6.5, 0, 0, Math.PI); g.stroke(); teeth(y - 5, 5, 0.1, Math.PI - 0.1); return; }
  g.fillStyle = 'rgba(0,0,0,.4)'; ell(g, x, y + 2, 15, 8); g.fill();
  if (asleep) { g.strokeStyle = '#6d727a'; g.lineWidth = 2.4; g.beginPath(); g.moveTo(x - 12, y); g.lineTo(x + 12, y); g.stroke(); g.fillStyle = '#8d949c'; for (let i = -4; i <= 4; i++) poly(g, [x + i * 2.6 - 1.3, y, x + i * 2.6 + 1.3, y, x + i * 2.6, y + (i % 2 ? 3 : -3)]), g.fill(); return; }
  g.fillStyle = '#000'; ell(g, x, y, 11, 5.6); g.fill();
  g.strokeStyle = '#8d949c'; g.lineWidth = 2.4; ell(g, x, y, 13, 6.8); g.stroke(); g.strokeStyle = '#5a6068'; g.lineWidth = 1; ell(g, x, y + 1.6, 13, 6.8); g.stroke();
  if (held) { g.strokeStyle = '#8d949c'; g.lineWidth = 2.4; g.beginPath(); g.ellipse(x, y - 5, 13, 6.5, 0, Math.PI, TAU); g.stroke(); return; }
  teeth(y, -3.4, 0.25, Math.PI - 0.25); teeth(y, 3.4, Math.PI + 0.25, TAU - 0.25);
}
function trapEyes(g, tr, S, t) {
  if (tr.holding || tr.dormant > 0) return;
  const x = cx(tr.c), y = cy(tr.f, tr.r); let lx = 0, ly = 0, best = 99;
  for (const h of HW.heroList(S)) if (h.f === tr.f && HW.awake(h)) { const d = HW.cheb(h, tr); if (d < best) { best = d; const dx = h.c - tr.c, dy = h.r - tr.r, m = Math.hypot(dx, dy) || 1; lx = dx / m * 1.6; ly = dy / m * 0.9; } }
  if (Math.sin(t * 0.9 + tr.id * 2) > 0.97) return; // blink
  g.fillStyle = '#fff'; g.shadowColor = '#fff'; g.shadowBlur = 5; ell(g, x - 3.2 + lx, y + ly, 1.5, 1.9); g.fill(); ell(g, x + 3.2 + lx, y + ly, 1.5, 1.9); g.fill(); g.shadowBlur = 0;
}

/* ---------- miniatures ---------- */
function mbase(g, x, y, rim, dark) {
  g.fillStyle = 'rgba(0,0,0,.5)'; ell(g, x + 1.5, y + 4.5, 15, 7); g.fill();
  g.fillStyle = dark ? '#050506' : '#120e0c'; ell(g, x, y + 3, 13, 6.2); g.fill(); g.fillRect(x - 13, y, 26, 3);
  g.fillStyle = dark ? '#151518' : '#2a211b'; ell(g, x, y, 13, 6.2); g.fill();
  g.strokeStyle = rim; g.lineWidth = 1.5; ell(g, x, y, 11.6, 5.4); g.stroke();
}
function figBrock(g, x, y, o) {
  g.fillStyle = '#262a36'; g.fillRect(x - 6, y - 16, 5, 14); g.fillRect(x + 1, y - 16, 5, 14);
  g.fillStyle = '#17130f'; g.fillRect(x - 7.5, y - 3.5, 7, 3.5); g.fillRect(x + 0.5, y - 3.5, 7, 3.5);
  g.strokeStyle = '#6d4220'; g.lineWidth = 5; g.lineCap = 'round'; g.lineJoin = 'round';
  g.beginPath(); g.moveTo(x - 10, y - 29); g.lineTo(x - 15, y - 22); g.lineTo(x - 9, y - 17); g.moveTo(x + 10, y - 29); g.lineTo(x + 15, y - 22); g.lineTo(x + 9, y - 17); g.stroke(); g.lineCap = 'butt';
  g.fillStyle = '#7d4c24'; poly(g, [x - 11.5, y - 31, x + 11.5, y - 31, x + 9, y - 14, x - 9, y - 14]); g.fill();
  g.fillStyle = '#d9d0be'; g.fillRect(x - 2.6, y - 30, 5.2, 16); g.fillStyle = '#5a3518'; g.fillRect(x - 3.4, y - 30, 1, 16); g.fillRect(x + 2.4, y - 30, 1, 16);
  g.fillStyle = '#e0b089'; circ(g, x - 9, y - 16.5, 2.3); g.fill(); circ(g, x + 9, y - 16.5, 2.3); g.fill();
  g.fillStyle = '#f1e6cd'; for (let i = -3; i <= 3; i++) { circ(g, x + i * 3.5, y - 31.5 + Math.abs(i) * 0.9, 3.5); g.fill(); } g.fillStyle = '#d6c8a8'; for (let i = -3; i <= 3; i++) { circ(g, x + i * 3.5 + 1, y - 30.3 + Math.abs(i) * 0.9, 1.3); g.fill(); }
  g.fillStyle = '#e0b089'; circ(g, x, y - 39.5, 6.3); g.fill();
  g.fillStyle = '#5a3a1e'; poly(g, [x - 7, y - 39, x - 8.5, y - 45.5, x - 4.5, y - 43.5, x - 3.5, y - 49, x - 0.5, y - 45, x + 3, y - 49.5, x + 4.8, y - 44.5, x + 9, y - 47, x + 7, y - 39, x + 4, y - 43, x - 2, y - 42]); g.fill();
  face(g, x, y - 39.5, o, '#231a14', false);
  if (!o.possessed) { g.strokeStyle = '#7a4a3a'; g.lineWidth = 1; g.beginPath(); g.moveTo(x - 1.5, y - 36); g.quadraticCurveTo(x + 1, y - 35, x + 3, y - 36.8); g.stroke(); }
}
function figWesley(g, x, y, o) {
  g.fillStyle = '#4a4034'; g.fillRect(x - 5, y - 15, 4.2, 13); g.fillRect(x + 0.8, y - 15, 4.2, 13);
  g.fillStyle = '#2a1c14'; g.fillRect(x - 6, y - 3, 5.8, 3); g.fillRect(x + 0.4, y - 3, 5.8, 3);
  g.fillStyle = '#e8e3d6'; poly(g, [x - 8, y - 29, x + 8, y - 29, x + 7, y - 13, x - 7, y - 13]); g.fill();
  g.fillStyle = '#2f6b5e'; poly(g, [x - 7.5, y - 28.5, x - 1, y - 21, x - 1, y - 13, x - 7, y - 13]); g.fill(); poly(g, [x + 7.5, y - 28.5, x + 1, y - 21, x + 1, y - 13, x + 7, y - 13]); g.fill();
  g.fillStyle = '#c9a45c'; circ(g, x, y - 19, 0.8); g.fill(); circ(g, x, y - 16, 0.8); g.fill();
  g.strokeStyle = '#e8e3d6'; g.lineWidth = 3.6; g.lineCap = 'round'; g.lineJoin = 'round'; g.beginPath(); g.moveTo(x - 8, y - 28); g.lineTo(x - 10.5, y - 21); g.lineTo(x - 4, y - 18); g.moveTo(x + 8, y - 28); g.lineTo(x + 10.5, y - 21); g.lineTo(x + 4, y - 18); g.stroke(); g.lineCap = 'butt';
  g.fillStyle = '#6e1f2e'; g.fillRect(x - 5.5, y - 23, 11, 7.5); g.fillStyle = '#e9e1cc'; g.fillRect(x - 5.5, y - 16.3, 11, 1); g.fillStyle = '#c9a45c'; g.fillRect(x - 0.5, y - 23, 1, 6.5);
  g.fillStyle = '#f0c9a4'; circ(g, x - 5, y - 18.5, 1.9); g.fill(); circ(g, x + 5, y - 18.5, 1.9); g.fill();
  g.fillStyle = '#7a2233'; poly(g, [x - 3, y - 30.5, x, y - 29, x + 3, y - 30.5, x + 3, y - 27.5, x, y - 29, x - 3, y - 27.5]); g.fill();
  g.fillStyle = '#f0c9a4'; circ(g, x, y - 36, 6); g.fill();
  g.fillStyle = '#b08a5a'; for (const [dx, dy, r] of [[-5.5, -39, 2.8], [-3, -42, 2.9], [0.3, -43, 3], [3.5, -42, 2.9], [5.8, -39, 2.8], [-6.6, -36, 2.1], [6.6, -36, 2.1], [-1.5, -40.5, 2.4], [2, -40.5, 2.4]]) { circ(g, x + dx, y + dy, r); g.fill(); }
  g.fillStyle = '#9a744a'; for (const [dx, dy] of [[-4, -41], [1, -42.5], [5, -40]]) { circ(g, x + dx, y + dy, 1); g.fill(); }
  face(g, x, y - 36, o, '#231a14', true);
  if (!o.possessed) { g.strokeStyle = '#8a5a4a'; g.lineWidth = 0.9; g.beginPath(); g.moveTo(x - 1.6, y - 32.4); g.lineTo(x + 1.6, y - 32.6); g.stroke(); }
}
function face(g, x, y, o, col, glasses) {
  if (o.possessed) { g.fillStyle = '#fff'; g.shadowColor = '#bfe0ff'; g.shadowBlur = 8; circ(g, x - 2.5, y, 1.7); g.fill(); circ(g, x + 2.5, y, 1.7); g.fill(); g.shadowBlur = 0; }
  else { g.fillStyle = col; g.fillRect(x - 3.3, y - 0.6, 1.7, 1.9); g.fillRect(x + 1.6, y - 0.6, 1.7, 1.9); }
  if (glasses) { g.fillStyle = 'rgba(200,230,255,.28)'; circ(g, x - 2.6, y + 0.2, 2.5); g.fill(); circ(g, x + 2.6, y + 0.2, 2.5); g.fill(); g.strokeStyle = '#1d1612'; g.lineWidth = 1; circ(g, x - 2.6, y + 0.2, 2.6); g.stroke(); circ(g, x + 2.6, y + 0.2, 2.6); g.stroke(); g.fillStyle = 'rgba(255,255,255,.8)'; g.fillRect(x - 3.8, y - 1.2, 1, 1); }
}
function figLil(g, x, y, t, reachOut) {
  const sway = Math.sin(t * 1.7) * 1.2;
  g.fillStyle = '#eef3fa'; g.beginPath(); g.moveTo(x - 6.5, y - 37); g.quadraticCurveTo(x - 11 + sway * 0.4, y - 22, x - 8 + sway, y - 11); g.lineTo(x + 8 + sway, y - 11); g.quadraticCurveTo(x + 11 + sway * 0.4, y - 22, x + 6.5, y - 37); g.closePath(); g.fill();
  const dg = g.createLinearGradient(0, y - 31, 0, y - 1); dg.addColorStop(0, '#ffffff'); dg.addColorStop(0.7, 'rgba(240,246,255,.95)'); dg.addColorStop(1, 'rgba(225,238,255,0)');
  g.fillStyle = dg; g.beginPath(); g.moveTo(x - 4, y - 31); g.lineTo(x + 4, y - 31); g.lineTo(x + 10 + sway, y - 4); g.quadraticCurveTo(x + 5 + sway, y - 0.5, x + sway, y - 4); g.quadraticCurveTo(x - 5 + sway, y - 0.5, x - 10 + sway, y - 4); g.closePath(); g.fill();
  g.fillStyle = 'rgba(190,210,235,.6)'; g.fillRect(x - 4.5, y - 25, 9, 1.4);
  g.strokeStyle = '#fafcff'; g.lineWidth = 2; g.lineCap = 'round'; const up = reachOut ? -7 : 0;
  g.beginPath(); g.moveTo(x - 4, y - 29); g.lineTo(x - 8.5, y - 20 + up); g.moveTo(x + 4, y - 29); g.lineTo(x + 8.5, y - 20 + up); g.stroke(); g.lineCap = 'butt';
  g.fillStyle = '#fbfcff'; circ(g, x, y - 36, 5.6); g.fill();
  g.fillStyle = '#eef3fa'; g.beginPath(); g.arc(x, y - 37, 6.2, Math.PI * 1.02, Math.PI * 1.98); g.quadraticCurveTo(x + 2, y - 39, x, y - 39.5); g.quadraticCurveTo(x - 3, y - 38.5, x - 6.2, y - 36.5); g.closePath(); g.fill();
  g.fillStyle = 'rgba(120,140,180,.35)'; ell(g, x - 2.2, y - 34.6, 1.9, 2.4); g.fill(); ell(g, x + 2.2, y - 34.6, 1.9, 2.4); g.fill();
  g.fillStyle = '#141b2c'; ell(g, x - 2.2, y - 35, 1.25, 1.7); g.fill(); ell(g, x + 2.2, y - 35, 1.25, 1.7); g.fill();
}
function figHollow(g, x, y, t, dir) {
  g.fillStyle = '#050506'; ell(g, x - 4, y - 1.5, 4.2, 2.2); g.fill(); ell(g, x + 4, y - 1.5, 4.2, 2.2); g.fill();
  g.fillStyle = '#09090b'; poly(g, [x - 6, y - 52, x + 6, y - 52, x + 8.5, y - 4, x - 8.5, y - 4]); g.fill();
  g.strokeStyle = '#26262e'; g.lineWidth = 0.9; g.beginPath(); g.moveTo(x, y - 30); g.lineTo(x, y - 4); g.moveTo(x - 4, y - 51); g.lineTo(x, y - 42); g.lineTo(x + 4, y - 51); g.stroke();
  g.fillStyle = '#26262e'; circ(g, x, y - 38, 0.8); g.fill(); circ(g, x, y - 34, 0.8); g.fill();
  g.strokeStyle = '#09090b'; g.lineWidth = 3.4; g.lineCap = 'round'; g.beginPath(); g.moveTo(x - 6, y - 50); g.lineTo(x - 10.5, y - 25); g.moveTo(x + 6, y - 50); g.lineTo(x + 10.5, y - 25); g.stroke(); g.lineCap = 'butt';
  g.fillStyle = '#f4f4f4'; ell(g, x - 10.8, y - 21.5, 2.4, 3.6); g.fill(); ell(g, x + 10.8, y - 21.5, 2.4, 3.6); g.fill();
  g.fillStyle = '#09090b'; g.fillRect(x - 1.5, y - 56, 3, 5);
  g.save(); g.translate(x, y - 62); g.rotate(Math.sin(t * 0.7) * 0.13 + (dir === 1 ? 0.08 : dir === 3 ? -0.08 : 0));
  g.fillStyle = '#f6f6f6'; ell(g, 0, 0, 7.2, 8.2); g.fill(); g.fillStyle = 'rgba(0,0,0,.1)'; ell(g, 2.5, 1, 4.5, 7); g.fill();
  if (dir !== 0) { const sx = dir === 1 ? 1.4 : dir === 3 ? -1.4 : 0; g.fillStyle = '#000'; ell(g, -2.9 + sx, -1, 2.1, 2.9); g.fill(); ell(g, 2.9 + sx, -1, 2.1, 2.9); g.fill(); g.strokeStyle = '#b4b4b4'; g.lineWidth = 0.9; g.beginPath(); g.moveTo(sx, 1.6); g.lineTo(sx - 0.8, 4.4); g.lineTo(sx + 0.9, 4.4); g.stroke(); }
  g.restore();
}
function drawMini(g, id, x, y, S, t, a) {
  g.save(); if (a != null && a < 1) g.globalAlpha = Math.max(0, a);
  if (id === 'ghost') {
    const gh = S.ghost, bob = Math.sin(t * 2) * 2, near = HW.heroList(S).some(h => h.f === gh.f && HW.awake(h) && HW.cheb(h, gh) <= 1);
    g.fillStyle = 'rgba(0,0,0,.25)'; ell(g, x, y + 3, 10, 4.5); g.fill();
    g.strokeStyle = 'rgba(220,238,255,.55)'; g.lineWidth = 1.2; ell(g, x, y + 1, 11, 5); g.stroke(); g.fillStyle = 'rgba(220,238,255,.12)'; g.fill();
    g.strokeStyle = 'rgba(220,238,255,.35)'; g.beginPath(); g.moveTo(x, y); g.lineTo(x, y - 8); g.stroke();
    g.globalAlpha *= gh.entranced > 0 ? 0.72 : 0.94; figLil(g, x, y - 7 + bob, t, near);
  } else if (id === 'hollow') { mbase(g, x, y, '#e8e8e8', true); const d = DIRS[S.hollow.dir]; g.fillStyle = '#f4f4f4'; poly(g, [x + d[0] * 15, y + d[1] * 8, x + d[0] * 10 - d[1] * 4, y + d[1] * 5 - d[0] * 2.4, x + d[0] * 10 + d[1] * 4, y + d[1] * 5 + d[0] * 2.4]); g.fill(); figHollow(g, x, y, t, S.hollow.dir); }
  else {
    const h = S.heroes[id]; mbase(g, x, y, id === 'brock' ? '#e09a4c' : '#58b8a3');
    if (h.possessed) { g.fillStyle = `rgba(200,228,255,${0.2 + Math.sin(t * 5) * 0.08})`; ell(g, x, y - 20, 17, 27); g.fill(); }
    if (h.down) { g.translate(x + 3, y - 3); g.rotate(1.42); g.translate(-x, -y); }
    (id === 'brock' ? figBrock : figWesley)(g, x, y, h);
  }
  g.restore();
}

/* ---------- the frame ---------- */
function posOf(S, V, id) {
  const a = V.anim[id]; if (a) return a;
  const e = id === 'ghost' ? S.ghost : id === 'hollow' ? S.hollow : S.heroes[id];
  return { f: e.f, x: cx(e.c), y: cy(e.f, e.r), a: 1 };
}
function lights(S, V, t) {
  const L = [];
  for (const c of SCONCES) L.push({ x: cx(c), y: OY.G + TY - 6, R: 96, a: 0.85, warm: 1, fl: 1 });
  for (const w of WALLCANDLES) L.push({ x: cx(w.c), y: cy(w.f, w.r) - LOW - 6, R: 92, a: 0.85, warm: 1, fl: 1 });
  L.push({ x: cx(9) + 20, y: cy('G', 5) + 16, R: 120, a: 0.55, warm: 1 }, { x: tx(16) + 13, y: ty('G', 4) - 8, R: 84, a: 0.9, warm: 1, fl: 1 }, { x: cx(12), y: ty('G', 6) - 12, R: 90, a: 0.9, warm: 1, fl: 1 });
  for (const c of WINDOWS) L.push({ x: cx(c), y: OY.U + TY + 34, R: 78, a: 0.6, cool: 1, sx: 0.62 });
  for (const id of ['brock', 'wesley']) { const h = S.heroes[id]; if (h.escaped || (V.hide && V.hide[id])) continue; const p = posOf(S, V, id); L.push({ x: p.x, y: p.y - 14, R: 108, a: 0.97, warm: 0.6 }); }
  const gp = posOf(S, V, 'ghost'); L.push({ x: gp.x, y: gp.y - 22, R: 62, a: 0.8, ghost: 1 });
  const hp = posOf(S, V, 'hollow'); L.push({ x: hp.x, y: hp.y - 56, R: 26, a: 0.75 });
  L.push({ x: cx(1), y: cy('G', 1), R: 46, a: 0.6 });
  for (const o of S.objs) if (o.obstacle) { const b = bounds(o); L.push({ x: b.x + b.w / 2, y: b.y + b.d / 2, R: 58, a: 0.6 }); }
  if (S.key.state === 'hatch') L.push({ x: cx(1), y: cy('G', 1), R: 55, a: 0.9, warm: 1 });
  if (S.door.open || V.doorOpen) L.push({ x: tx(10), y: ty('G', 8) + 10, R: 90, a: 0.9, cool: 1 });
  if (V.reach) for (const tl of V.reach.tiles) L.push({ x: cx(tl.c), y: cy(tl.f, tl.r), R: 24, a: 0.6 });
  for (const it of S.ground) L.push({ x: cx(it.c), y: cy(it.f, it.r), R: 30, a: 0.7 });
  return L;
}
function drawLight(S, V, t) {
  const g = lctx; g.setTransform(1, 0, 0, 1, 0, 0); g.globalCompositeOperation = 'source-over'; g.clearRect(0, 0, BW, BH);
  g.fillStyle = 'rgba(7,5,14,' + (0.5 + (V.dim || 0)) + ')'; g.fillRect(0, 0, BW, BH);
  g.fillStyle = 'rgba(10,18,40,.12)'; g.fillRect(0, 0, BW, OY.G - TALL - 8);
  g.globalCompositeOperation = 'destination-out';
  const L = lights(S, V, t);
  for (const l of L) {
    const R = l.R * (l.fl ? 1 + Math.sin(t * 7 + l.x) * 0.035 + Math.sin(t * 17 + l.y) * 0.02 : 1);
    g.save(); g.translate(l.x, l.y); if (l.sx) g.scale(l.sx, 1.35);
    const gr = g.createRadialGradient(0, 0, 0, 0, 0, R); gr.addColorStop(0, `rgba(0,0,0,${l.a})`); gr.addColorStop(0.55, `rgba(0,0,0,${l.a * 0.5})`); gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr; g.beginPath(); g.arc(0, 0, R, 0, TAU); g.fill(); g.restore();
  }
  ctx.drawImage(lightC, 0, 0, BW, BH);
  ctx.globalCompositeOperation = 'lighter';
  for (const l of L) {
    if (!l.warm && !l.cool && !l.ghost) continue;
    const col = l.ghost ? '150,190,255' : l.cool ? '110,160,255' : '255,160,70', k = l.ghost ? 0.2 : l.cool ? 0.1 : 0.11 * l.warm;
    ctx.save(); ctx.translate(l.x, l.y); if (l.sx) ctx.scale(l.sx, 1.35);
    const gr = ctx.createRadialGradient(0, 0, 0, 0, 0, l.R * 0.8); gr.addColorStop(0, `rgba(${col},${k})`); gr.addColorStop(1, `rgba(${col},0)`);
    ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(0, 0, l.R * 0.8, 0, TAU); ctx.fill(); ctx.restore();
  }
  ctx.globalCompositeOperation = 'source-over';
}
function tileRing(g, f, c, r, stroke, fill, lw) { ell(g, cx(c), cy(f, r), 15, 9); if (fill) { g.fillStyle = fill; g.fill(); } if (stroke) { g.strokeStyle = stroke; g.lineWidth = lw || 1.5; g.stroke(); } }
function wrap(g, text, maxW) {
  const words = text.split(' '), lines = []; let cur = '';
  for (const w of words) { const tt = cur ? cur + ' ' + w : w; if (g.measureText(tt).width > maxW && cur) { lines.push(cur); cur = w; } else cur = tt; }
  if (cur) lines.push(cur); return lines;
}
function bubble(g, x, y, text, kind) {
  g.font = (kind === 'lil' ? 'italic ' : '') + '13px "Alegreya Sans", sans-serif';
  const lines = wrap(g, text, 168), w = Math.max(...lines.map(l => g.measureText(l).width)) + 16, h = lines.length * 15 + 10;
  let bx = Math.max(4, Math.min(BW - w - 4, x - w / 2)), by = Math.max(4, y - h - 8);
  g.fillStyle = 'rgba(0,0,0,.45)'; rrect(g, bx + 2, by + 3, w, h, 6); g.fill();
  g.fillStyle = kind === 'lil' ? '#e9f1fb' : '#efe4c9'; rrect(g, bx, by, w, h, 6); g.fill(); poly(g, [x - 5, by + h - 1, x + 5, by + h - 1, x, by + h + 6]); g.fill();
  g.fillStyle = kind === 'brock' ? '#e09a4c' : kind === 'wesley' ? '#3f9c88' : '#7da0d6'; g.fillRect(bx, by + 5, 2.5, h - 10);
  g.fillStyle = kind === 'lil' ? '#16203a' : '#241810'; g.textAlign = 'left'; g.textBaseline = 'top';
  lines.forEach((l, i) => g.fillText(l, bx + 9, by + 6 + i * 15));
}
function render(S, V) {
  const t = V.t, g = ctx;
  g.setTransform(px, 0, 0, px, 0, 0);
  if (V.shake > t) g.translate((Math.random() - 0.5) * 5, (Math.random() - 0.5) * 5);
  g.drawImage(stat, 0, 0, BW, BH);

  // floor overlays
  if (!S.hollow._hide) for (const p of HW.gazeTiles(S)) { g.fillStyle = `rgba(238,238,255,${0.09 + Math.sin(t * 2 + p.c + p.r) * 0.025})`; g.fillRect(tx(p.c) + 1, ty(p.f, p.r) + 1, T - 2, TY - 2); }
  const gp = HW.obj(S, 'gramophone').t[0];
  if (!S.record.calmed && S.record.timer <= 1) for (let r = 1; r < H - 1; r++) for (let c = 1; c < W - 1; c++) if (MAPS.U[r][c] !== '#' && Math.max(Math.abs(c - gp[0]), Math.abs(r - gp[1])) <= CFG.recordRange) { g.fillStyle = `rgba(120,190,255,${0.14 + Math.sin(t * 6) * 0.06})`; g.fillRect(tx(c) + 1, ty('U', r) + 1, T - 2, TY - 2); }
  const dp = HW.obj(S, 'doll').t[0];
  if (HW.heroList(S).some(h => h.f === 'U' && h.c <= 6 && HW.awake(h))) for (let r = 1; r < H - 1; r++) for (let c = 1; c < 6; c++) if (Math.max(Math.abs(c - dp[0]), Math.abs(r - dp[1])) <= CFG.dollRange) { g.fillStyle = 'rgba(143,196,242,.07)'; g.fillRect(tx(c) + 1, ty('U', r) + 1, T - 2, TY - 2); }
  if (V.reach) for (const tl of V.reach.tiles) {
    const p = Math.sin(t * 4 + tl.c * 0.7 + tl.r) * 0.5 + 0.5;
    if (tl.trap) tileRing(g, tl.f, tl.c, tl.r, 'rgba(220,98,83,.95)', 'rgba(220,98,83,.2)');
    else if (tl.exit) tileRing(g, tl.f, tl.c, tl.r, '#bfe0ff', 'rgba(160,200,255,.4)', 2);
    else tileRing(g, tl.f, tl.c, tl.r, `rgba(255,217,138,${0.65 + p * 0.3})`, `rgba(255,200,110,${0.16 + p * 0.1})`);
  }
  if (V.cursor) tileRing(g, V.cursor.f, V.cursor.c, V.cursor.r, '#fff', 'rgba(255,255,255,.2)', 2.4);
  if (V.active && S.heroes[V.active] && !S.heroes[V.active].escaped && !(V.hide && V.hide[V.active])) { const p = posOf(S, V, V.active), k = Math.sin(t * 3) * 0.5 + 0.5; g.strokeStyle = `rgba(255,217,138,${0.5 + k * 0.4})`; g.lineWidth = 2; ell(g, p.x, p.y + 1, 17 + k * 2, 9 + k); g.stroke(); }

  // everything that stands up, back to front
  const items = [];
  for (const o of S.objs) { if (V.hideObj === o.id) continue; if (o.wall) { DRAW[o.kind](g, o, null, S, t); continue; } const b = bounds(o); items.push({ y: b.y + b.d - 1, fn: () => DRAW[o.kind](g, o, b, S, t) }); }
  for (const k in HW.HIDES) { const f = k[0], [c, r] = k.slice(1).split(',').map(Number); items.push({ y: ty(f, r) + 3, fn: () => drapes(g, f, c, r, DRAPE[k], false) }); if (HW.heroList(S).some(h => h.hidden && HW.key(h) === k)) items.push({ y: ty(f, r) + TY - 1, fn: () => drapes(g, f, c, r, DRAPE[k], true) }); }
  for (const tr of S.traps) { const a = V.anim['trap' + tr.id]; const draw = front => { if (a) { g.save(); g.translate(a.x - cx(tr.c), a.y - cy(tr.f, tr.r)); trap(g, tr, S, t, front); g.restore(); } else trap(g, tr, S, t, front); }; items.push({ y: cy(tr.f, tr.r) - 2, fn: () => draw(false) }); items.push({ y: cy(tr.f, tr.r) + 2, fn: () => draw(true) }); }
  for (const it of S.ground) items.push({ y: cy(it.f, it.r) - 3, fn: () => token(g, it, t) });
  items.push({ y: ty('G', 8) + TY, fn: () => frontDoor(g, S, t, V.doorOpen) });
  for (const id of ['brock', 'wesley', 'ghost', 'hollow']) {
    if ((id === 'brock' || id === 'wesley') && S.heroes[id].escaped && !V.anim[id]) continue;
    if (V.hide && V.hide[id]) continue;
    const p = posOf(S, V, id); const hid = S.heroes[id] && S.heroes[id].hidden;
    let nx = 0; // miniatures standing one behind another lean apart so both stay readable
    for (const o2 of ['brock', 'wesley', 'ghost', 'hollow']) { if (o2 === id || (S.heroes[o2] && S.heroes[o2].escaped)) continue; const q = posOf(S, V, o2); if (q.f === p.f && Math.abs(q.x - p.x) < 8 && Math.abs(q.y - p.y) > 4 && Math.abs(q.y - p.y) < TY * 1.4) nx = q.y > p.y ? -7 : 7; }
    items.push({ y: p.y + (id === 'ghost' ? 0.2 : 0), fn: () => drawMini(g, id, p.x + nx, p.y, S, t, hid ? 0.85 : p.a) });
  }
  items.sort((a, b) => a.y - b.y);
  for (const it of items) it.fn();
  for (const c of SCONCES) flame(g, cx(c), OY.G + TY - TALL + 7, t);
  for (const w of WALLCANDLES) flame(g, cx(w.c), cy(w.f, w.r) - LOW - 6, t);

  drawLight(S, V, t);

  // things that show in the dark
  for (const tr of S.traps) if (!V.anim['trap' + tr.id]) trapEyes(g, tr, S, t);
  // face-down search tokens sit on every piece of furniture that has not been searched
  g.font = '700 9px "Alegreya Sans", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  for (const o of S.objs) if (V.hideObj !== o.id && ((o.search && !S.searched[o.id]) || (o.id === 'hatch' && !S.clues.hatch && S.key.state === 'hidden'))) {
    const b = objBox(o), x = b.x + b.w - 8, y = b.y + 8;
    g.fillStyle = 'rgba(0,0,0,.55)'; circ(g, x + 1, y + 2, 6.5); g.fill(); g.fillStyle = '#3a2a1c'; circ(g, x, y, 6.2); g.fill(); g.strokeStyle = '#c9a45c'; g.lineWidth = 1.3; g.stroke(); g.fillStyle = '#ffd98a'; g.fillText('?', x, y + 0.5);
  }
  if (V.target) { const o = V.target, k = Math.sin(t * 3.5) * 0.5 + 0.5; g.strokeStyle = `rgba(255,217,138,${0.5 + k * 0.5})`; g.lineWidth = 2; g.setLineDash([5, 4]); g.lineDashOffset = -t * 12; rrect(g, o.x - 2, o.y - 2, o.w + 4, o.h + 4, 5); g.stroke(); g.setLineDash([]); g.fillStyle = '#ffd98a'; const mx = o.x + o.w / 2, my = o.y - 9 - k * 4; poly(g, [mx - 5, my - 5, mx + 5, my - 5, mx, my + 2]); g.fill(); }
  if (V.star) { const x = cx(V.star.c), y = cy(V.star.f, V.star.r), k = Math.sin(t * 4) * 0.5 + 0.5; g.strokeStyle = 'rgba(255,255,255,.95)'; g.lineWidth = 2.2; ell(g, x, y, 16 + k * 2, 9.5 + k); g.stroke(); g.fillStyle = '#ffd98a'; g.strokeStyle = 'rgba(0,0,0,.7)'; g.lineWidth = 1; const my = y - 15 - k * 4; g.beginPath(); for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? 3 : 7; g.lineTo(x + Math.cos(a) * rr, my + Math.sin(a) * rr); } g.closePath(); g.fill(); g.stroke(); }
  if (V.hover && V.hover.box) { const o = V.hover.box; g.strokeStyle = '#fff'; g.lineWidth = 1.6; rrect(g, o.x - 1, o.y - 1, o.w + 2, o.h + 2, 4); g.stroke(); }
  for (const bm of V.beams) { const k = 1 - (t - bm.t0) / bm.dur; if (k <= 0) continue; const a = posOf(S, V, 'hollow'), b = posOf(S, V, bm.id); g.strokeStyle = `rgba(245,245,255,${k * (bm.forced ? 0.9 : 0.6)})`; g.lineWidth = bm.forced ? 3 : 1.6; g.beginPath(); g.moveTo(a.x - 3, a.y - 63); g.lineTo(b.x, b.y - 36); g.moveTo(a.x + 3, a.y - 63); g.lineTo(b.x, b.y - 36); g.stroke(); }
  for (const r of V.rings) { const k = (t - r.t0) / r.dur; if (k >= 1 || k < 0) continue; g.strokeStyle = r.col.replace('A', String((1 - k) * 0.9)); g.lineWidth = 3 * (1 - k) + 1; ell(g, r.x, r.y, r.R * k, r.R * k * 0.62); g.stroke(); }
  for (const b of V.bubbles) { if (b.until < t) continue; const p = posOf(S, V, b.who === 'lil' ? 'ghost' : b.who); bubble(g, p.x, p.y - (b.who === 'lil' ? 52 : 50), b.text, b.who); }
  g.textAlign = 'center'; g.textBaseline = 'middle';
  for (const fx of V.fx) { const k = (t - fx.t0) / fx.dur; if (k >= 1 || k < 0) continue; g.globalAlpha = k < 0.75 ? 1 : (1 - k) * 4; g.font = '700 15px "Alegreya Sans", sans-serif'; g.lineWidth = 3.5; g.strokeStyle = 'rgba(0,0,0,.85)'; g.strokeText(fx.text, fx.x, fx.y - k * 26); g.fillStyle = fx.col; g.fillText(fx.text, fx.x, fx.y - k * 26); g.globalAlpha = 1; }
  if (V.hover && V.hover.label) { g.font = '600 12.5px "Alegreya Sans", sans-serif'; const w = g.measureText(V.hover.label).width + 14; const x = Math.max(4, Math.min(BW - w - 4, V.hover.x - w / 2)), y = Math.max(4, V.hover.y - 30); g.fillStyle = 'rgba(13,10,14,.92)'; rrect(g, x, y, w, 20, 4); g.fill(); g.strokeStyle = '#c9a45c'; g.lineWidth = 1; g.stroke(); g.fillStyle = '#eadfc4'; g.textAlign = 'left'; g.fillText(V.hover.label, x + 7, y + 10.5); }
}
function frontDoor(g, S, t, forceOpen) {
  const x = tx(9), y = ty('G', 8);
  if (S.door.open || forceOpen) {
    const gr = g.createLinearGradient(0, y - 6, 0, y + TY); gr.addColorStop(0, 'rgba(190,220,255,.75)'); gr.addColorStop(1, 'rgba(120,160,230,.25)'); g.fillStyle = gr; g.fillRect(x + 3, y - LOW, 2 * T - 6, TY + LOW);
    box(g, x - 4, y + 2, 6, TY - 4, 26, '#2a1a10', '#4a2e1a'); box(g, x + 2 * T - 2, y + 2, 6, TY - 4, 26, '#2a1a10', '#4a2e1a');
    return;
  }
  box(g, x + 2, y + 6, 2 * T - 4, TY - 8, 26, '#2a1a10', '#4f321c');
  const fy = y + 6 + TY - 8 - 26; g.fillStyle = '#3a2314'; g.fillRect(x + 6, fy + 3, 31, 20); g.fillRect(x + 43, fy + 3, 31, 20); g.fillStyle = '#1a0f08'; g.fillRect(x + 39.5, fy, 1, 26);
  g.fillStyle = '#c9a45c'; circ(g, x + 35, fy + 14, 1.8); g.fill(); circ(g, x + 45, fy + 14, 1.8); g.fill();
  if (S.key.state !== 'hidden') { g.fillStyle = `rgba(255,217,138,${0.5 + Math.sin(t * 4) * 0.4})`; circ(g, x + 40, fy + 19, 2); g.fill(); }
}

/* ---------- hit testing ---------- */
function objBox(o) {
  if (o.wall) return { x: tx(9) + 2, y: OY.U, w: 76, h: TY };
  const b = bounds(o), h = HEIGHT[o.kind] || 10; return { x: b.x + 2, y: b.y - h + 4, w: b.w - 4, h: b.d + h - 6 };
}
function tileAt(lx, ly) {
  for (const f of ['U', 'G']) { if (ly >= OY[f] && ly < OY[f] + H * TY) { const c = Math.floor((lx - MX) / T), r = Math.floor((ly - OY[f]) / TY); if (c >= 0 && c < W) return { f, c, r }; } }
  return null;
}
function pick(S, V, lx, ly) {
  for (const id of ['brock', 'wesley']) { const h = S.heroes[id]; if (h.escaped) continue; const p = posOf(S, V, id); if (Math.abs(lx - p.x) < 14 && ly > p.y - 50 && ly < p.y + 9) return { kind: 'mini', id }; }
  const list = S.objs.map(o => ({ o, b: objBox(o) })).sort((a, b) => (b.b.y + b.b.h) - (a.b.y + a.b.h));
  for (const { o, b } of list) if (lx >= b.x && lx <= b.x + b.w && ly >= b.y && ly <= b.y + b.h) return { kind: 'obj', id: o.id, box: b };
  const dx = tx(9), dy = ty('G', 8); if (lx >= dx && lx <= dx + 2 * T && ly >= dy - 22 && ly <= dy + TY) return { kind: 'door', box: { x: dx + 2, y: dy - 20, w: 2 * T - 4, h: TY + 18 } };
  const tl = tileAt(lx, ly); return tl ? Object.assign({ kind: 'tile' }, tl) : null;
}
function setup(canvas) { board = canvas; ctx = canvas.getContext('2d'); }
function resize(cssW) {
  const dpr = Math.min(2, window.devicePixelRatio || 1), cssH = Math.round(cssW * BH / BW);
  board.style.width = cssW + 'px'; board.style.height = cssH + 'px';
  board.width = Math.round(cssW * dpr); board.height = Math.round(cssH * dpr);
  px = board.width / BW; stat.width = board.width; stat.height = board.height; drawStatic();
}
function bust(canvas, id) {
  const g = canvas.getContext('2d'), s = canvas.width / 46; g.setTransform(s, 0, 0, s, 0, 0); g.clearRect(0, 0, 46, 46);
  g.fillStyle = id === 'brock' ? '#3a2416' : '#1c3a33'; g.fillRect(0, 0, 46, 46);
  g.save(); g.translate(23, 96); g.scale(1.75, 1.75); (id === 'brock' ? figBrock : figWesley)(g, 0, 0, {}); g.restore();
}
window.HWR = { setup, resize, render, pick, tileAt, objBox, posOf, drawStatic, bust, glyph, BW, BH, T, TY, OY, cx, cy, tx, ty };
})();
