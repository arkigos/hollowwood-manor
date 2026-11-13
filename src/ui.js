/* Hollowwood Manor — table UI: drives the engine generator, shows what it yields, collects answers. */
(function () {
'use strict';
const HW = window.HW, R = window.HWR, CFG = HW.CFG;
const $ = s => document.querySelector(s);
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const reduce = !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
const NAMES = { brock: 'Brock', wesley: 'Wesley', lil: 'Lil\'' };
let S = null, gid = 0, auto = false, demo = true;
const V = { t: 0, anim: {}, fx: [], bubbles: [], beams: [], rings: [], reach: null, cursor: null, hover: null, input: null, active: null, target: null, shake: 0, pace: 1, status: '', tip: null, drag: null, skipAnim: null, guideOn: true, star: null, hide: null, doorOpen: false, dim: 0, cine: null };
const board = $('#board'); R.setup(board);
const now = () => performance.now() / 1000;
const speed = () => V.pace * (auto ? 0.2 : 1);
const sleep = ms => new Promise(r => setTimeout(r, Math.max(0, ms * speed())));
function tween(ms, fn) {
  ms *= speed(); if (reduce || ms <= 16) { fn(1); return Promise.resolve(); }
  return new Promise(res => { const t0 = performance.now(); (function step() { const k = Math.min(1, (performance.now() - t0) / ms); fn(k); if (k < 1) setTimeout(step, 16); else res(); })(); });
}

/* ---------- sound: a few synthesized cues, started by the first click ---------- */
const Snd = {
  on: true, ctx: null,
  init() { if (this.ctx || !this.on) return; try { this.ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { this.ctx = null; } },
  tone(f, d, o) { o = o || {}; if (!this.on || !this.ctx) return; const c = this.ctx, t = c.currentTime + (o.at || 0), os = c.createOscillator(), g = c.createGain(); os.type = o.type || 'sine'; os.frequency.setValueAtTime(f, t); if (o.to) os.frequency.exponentialRampToValueAtTime(o.to, t + d); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(o.v || 0.06, t + (o.a || 0.01)); g.gain.exponentialRampToValueAtTime(0.0001, t + d); os.connect(g); g.connect(c.destination); os.start(t); os.stop(t + d + 0.05); },
  noise(d, o) { o = o || {}; if (!this.on || !this.ctx) return; const c = this.ctx, t = c.currentTime + (o.at || 0), n = Math.floor(c.sampleRate * d), buf = c.createBuffer(1, n, c.sampleRate), ch = buf.getChannelData(0); for (let i = 0; i < n; i++) ch[i] = (Math.random() * 2 - 1) * (1 - i / n); const s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain(); s.buffer = buf; f.type = 'bandpass'; f.frequency.value = o.f || 900; f.Q.value = o.q || 1; g.gain.value = o.v || 0.08; s.connect(f); f.connect(g); g.connect(c.destination); s.start(t); },
  die() { for (let i = 0; i < 6; i++) this.noise(0.04, { at: i * 0.09 + Math.random() * 0.03, f: 1800 + Math.random() * 1500, v: 0.09 }); },
  step() { this.noise(0.05, { f: 260, v: 0.07, q: 2 }); },
  good() { this.tone(523, 0.18, { v: 0.05, type: 'triangle' }); this.tone(784, 0.3, { v: 0.05, type: 'triangle', at: 0.11 }); },
  hurt() { this.tone(110, 0.35, { to: 50, v: 0.16 }); this.noise(0.12, { f: 200, v: 0.12 }); },
  fright() { this.tone(880, 0.5, { to: 830, v: 0.03, type: 'sawtooth' }); this.tone(932, 0.5, { to: 870, v: 0.03, type: 'sawtooth' }); },
  ghost() { this.tone(660, 1.3, { to: 520, v: 0.035, a: 0.4 }); this.tone(990, 1.3, { to: 770, v: 0.02, a: 0.5 }); },
  possess() { this.tone(220, 1.6, { to: 880, v: 0.05, a: 0.6 }); this.tone(233, 1.6, { to: 910, v: 0.05, a: 0.6 }); },
  gaze() { this.tone(70, 0.9, { v: 0.14, a: 0.2 }); },
  thud() { this.tone(80, 0.3, { to: 40, v: 0.2 }); this.noise(0.2, { f: 150, v: 0.16 }); },
  snap() { this.noise(0.06, { f: 3000, v: 0.16 }); this.tone(180, 0.15, { to: 90, v: 0.12 }); },
  search() { this.noise(0.18, { f: 1200, v: 0.04, q: 0.6 }); },
  chime(n) { for (let i = 0; i < Math.min(n, 4); i++) { this.tone(392, 1.6, { at: i * 0.7, v: 0.07, type: 'triangle' }); this.tone(784, 1.2, { at: i * 0.7, v: 0.025 }); } },
  tick() { this.noise(0.02, { f: 4000, v: 0.05, q: 4 }); },
  record() { this.tone(300, 0.9, { to: 620, v: 0.05, type: 'sawtooth', a: 0.3 }); this.noise(0.9, { f: 2500, v: 0.02 }); },
  door() { this.noise(0.5, { f: 300, v: 0.12 }); this.tone(196, 0.9, { v: 0.05, type: 'triangle', at: 0.2 }); this.tone(294, 1.2, { v: 0.05, type: 'triangle', at: 0.35 }); },
};

/* ---------- log, hint, banner ---------- */
function addLog(html, cls) { const el = $('#log'), p = document.createElement('p'); if (cls) p.className = cls; p.innerHTML = html; el.appendChild(p); while (el.children.length > 140) el.removeChild(el.firstChild); el.scrollTop = el.scrollHeight; }
function say(who, text, hold) { V.bubbles = V.bubbles.filter(b => b.who !== who); V.bubbles.push({ who, text, until: now() + (hold || 2.6 * Math.max(0.6, speed()) + text.length * 0.02) }); addLog('<b>' + esc(NAMES[who]) + '</b> ' + esc(text), who === 'lil' ? 'ghost' : 'say ' + who); }
function setStatus(s) { V.status = s; renderActions(); }
function showTip(text) { V.tip = { text, until: now() + 9 }; addLog(esc(text), 'tip'); }
let lastHint = '';
function updateHint() {
  let html = '', cls = '';
  if (V.cine) html = 'Click the board or press Space to move on. Esc skips the opening.';
  else if (V.tip && V.tip.until > V.t && !(V.reach && V.reach.res)) { html = '<b>How it works</b> · ' + esc(V.tip.text); cls = 'tip'; }
  else if (V.reach && V.reach.res) { const h = S.heroes[V.reach.hero]; cls = 'move'; html = '<span><b>' + h.name + ' rolled ' + V.reach.roll + '.</b> Click a lit space, or drag ' + h.name + ' there. Up to ' + V.reach.pts + ' spaces.' + (V.star ? ' The star marks a good spot.' : '') + '</span><button class="hbtn" type="button" data-mv="stay">Stay put</button>' + (V.reach.canReroll ? '<button class="hbtn" type="button" data-mv="reroll">Reroll · 1 Insight</button>' : ''); }
  else if (V.flash && V.flash.until > V.t) html = esc(V.flash.text);
  else if (V.input) { const h = S.heroes[V.input.hero]; html = '<b>' + h.name + '</b> · ' + esc(HW.hint(S, h)); }
  else html = esc(V.status || '');
  if (html !== lastHint) { lastHint = html; const el = $('#hint'); el.innerHTML = html; el.className = cls; }
}
async function banner(text, ms) { const el = $('#banner'); el.textContent = text; el.classList.add('on'); await sleep(ms || 900); el.classList.remove('on'); await sleep(200); }

/* ---------- dice ---------- */
const PIPS = { 1: [5], 2: [1, 9], 3: [1, 5, 9], 4: [1, 3, 7, 9], 5: [1, 3, 5, 7, 9], 6: [1, 3, 4, 6, 7, 9] };
const FACE = { 1: [0, 0], 6: [0, 180], 3: [0, -90], 4: [0, 90], 5: [-90, 0], 2: [90, 0] };
function buildDie(el) { let h = '<div class="cube">'; for (let n = 1; n <= 6; n++) { h += '<div class="face f' + n + '">'; for (let i = 1; i <= 9; i++) h += '<i' + (PIPS[n].includes(i) ? ' class="p"' : '') + '></i>'; h += '</div>'; } el.innerHTML = h + '</div>'; el._k = 0; }
function spinDie(el, n) { el._k++; const tw = el._k * 720, f = FACE[n]; el.firstChild.style.transform = 'rotateX(' + (f[0] + tw) + 'deg) rotateY(' + (f[1] + tw) + 'deg)'; }
function toStage(x, y) { const c = board.getBoundingClientRect(), st = $('#stage').getBoundingClientRect(); return { x: c.left - st.left + x / R.BW * c.width, y: c.top - st.top + y / R.BH * c.height }; }
// the big die tumbles on the board, right above whoever is rolling
async function bigDie(who, value, label) {
  const el = $('#bigdie'), die = el.firstElementChild, lab = el.lastElementChild, st = $('#stage');
  const p = R.posOf(S, V, who), q = toStage(p.x, p.y - (who === 'hollow' ? 104 : 84));
  el.style.left = Math.max(70, Math.min(st.clientWidth - 70, q.x)) + 'px'; el.style.top = Math.max(56, Math.min(st.clientHeight - 60, q.y)) + 'px';
  die.className = 'die big' + (who === 'ghost' ? ' gh' : who === 'hollow' ? ' ho' : ''); lab.hidden = true; el.hidden = false;
  el.classList.remove('roll'); void el.offsetWidth; el.classList.add('roll');
  spinDie(die, value); await sleep(950); lab.innerHTML = label; lab.hidden = false; await sleep(who === 'ghost' || who === 'hollow' ? 1100 : 800); el.hidden = true;
}
async function rollDie(ev) {
  Snd.die();
  const isG = ev.who === 'ghost', isH = ev.who === 'hollow', h = isG || isH ? null : S.heroes[ev.who];
  document.querySelectorAll('#haunt td.hit').forEach(td => { if (isG ? !td.classList.contains('ho') : isH ? td.classList.contains('ho') : true) td.classList.remove('hit'); });
  const side = isG ? '#dieGhost' : isH ? '#dieHollow' : '#dieHero', who = isG ? 'Lil\'' : isH ? 'The Hollow' : h.name;
  $(side + 'T').textContent = who + ' rolls…'; spinDie($(side), ev.value);
  const what = isG || isH ? esc(ev.name) : ev.pts ? 'move up to ' + ev.pts : ev.need ? (ev.value >= ev.need ? 'free!' : 'needs ' + ev.need + '+') : '';
  await bigDie(ev.who, ev.value, '<b>' + ev.value + '</b>' + (isG || isH ? esc(who) + ': ' : '') + what);
  $(side + 'T').innerHTML = esc(who) + ': <b>' + ev.value + '</b> ' + what;
  if (isG || isH) { const td = document.querySelector('#haunt td[data-' + (isG ? 'g' : 'h') + '="' + ev.value + '"]'); if (td) td.classList.add('hit'); addLog(esc(who) + ' rolls ' + ev.value + ': ' + esc(ev.name) + '.', isG ? 'ghost' : 'hollow'); }
  else if (ev.pts) addLog(h.name + ' rolls ' + ev.value + ' and may move up to ' + ev.pts + '.');
}

/* ---------- HUD ---------- */
function ctrlLabel(h) { if (auto) return 'Auto'; if (S.opts.mode === 'coop') return h.id === 'brock' ? 'Player 1' : 'Player 2'; return h.npc ? 'Companion' : 'You'; }
function hud() {
  if (!S) return;
  let html = '';
  for (const h of HW.heroList(S)) {
    const ch = HW.CHAINS[h.chain], st = HW.stepOf(S, h), ob = HW.obj(S, S.obstacle) || {};
    let hearts = ''; for (let i = 0; i < h.maxHearts; i++) hearts += '<i class="heart' + (i < h.hearts ? '' : ' off') + '"></i>';
    let fr = ''; for (let i = 0; i < CFG.frightCap; i++) fr += '<i class="fr' + (i < h.fright ? ' on' : '') + (i === CFG.frightCap - 1 ? ' cap' : '') + '"></i>';
    let ac = ''; for (let i = 0; i < CFG.actions[h.id]; i++) ac += '<i class="act' + (S.turn === h.id && i < h.actions ? ' on' : '') + '"></i>';
    const chips = [];
    if (h.escaped) chips.push('<span class="chip">Outside</span>');
    if (h.down) chips.push('<span class="chip bad">Collapsed</span>');
    if (h.possessed) chips.push('<span class="chip ghost">Possessed</span>');
    if (h.trapped) chips.push('<span class="chip bad">Trapped</span>');
    if (h.hidden) chips.push('<span class="chip">Hidden</span>');
    if (h.holding) chips.push('<span class="chip">Holding his end</span>');
    if (h.debt) chips.push('<span class="chip">Winded: −1 action</span>');
    if (h.fright >= CFG.frightCap) chips.push('<span class="chip bad">Overcome next turn</span>');
    const cnt = {}; h.inv.forEach(i => cnt[i] = (cnt[i] || 0) + 1);
    for (const i in cnt) chips.push('<span class="chip item' + (HW.ITEMS[i].chain || i === 'masterkey' ? ' quest' : '') + '">' + esc(HW.ITEMS[i].name) + (cnt[i] > 1 ? ' ×' + cnt[i] : '') + '</span>');
    const up = (h.got && S.coopDone) || h.useDone;
    html += '<div class="hero' + (S.turn === h.id ? ' active' : '') + '" data-id="' + h.id + '">' +
      '<div class="top"><canvas width="92" height="92" data-bust="' + h.id + '"></canvas><div><div class="nm" style="color:var(--' + h.id + ')">' + h.name + '</div><div class="ctrl">' + ctrlLabel(h) + '</div></div></div>' +
      '<div class="row"><label>Hearts</label><div class="pips">' + hearts + '</div></div>' +
      '<div class="row"><label>Fright</label><div class="pips">' + fr + '</div></div>' +
      '<div class="row"><label>Actions</label><div class="pips">' + ac + '</div></div>' +
      (chips.length ? '<div class="chips">' + chips.join('') + '</div>' : '') +
      '<ol class="chain">' +
      '<li class="' + (h.got ? 'done' : st === 'find' ? 'cur' : '') + '" title="' + esc(ch.findText) + '"><i>I</i><span>' + esc(ch.findTitle) + '</span></li>' +
      '<li class="' + (S.coopDone ? 'done' : st === 'coop' ? 'cur' : '') + '" title="Both heroes stand beside it and each spends 1 action."><i>II</i><span>Together: lift the ' + esc(ob.short || 'obstacle') + '</span></li>' +
      (up ? '<li class="' + (h.useDone ? 'done' : 'cur') + '" title="' + esc(ch.useText) + '"><i>III</i><span>' + esc(ch.useTitle) + (ch.work > 1 && !h.useDone ? ' · ' + h.useWork + '/' + ch.work : '') + (ch.brain ? ' · thinking' : '') + '</span></li>'
        : '<li class="down" title="Revealed when cards I and II are done."><i>III</i><span>Face down</span></li>') +
      '</ol>' +
      '<div class="abil">' + (h.id === 'brock' ? '<b>Protection.</b> When Wesley would lose a heart, Brock may step in and take it. Costs 1 action, now or next turn.' : '<b>Insight.</b> Spend 1 to reroll any die. Spend 2 to Deduce a thinking task.') + '</div></div>';
  }
  $('#heroes').innerHTML = html;
  document.querySelectorAll('canvas[data-bust]').forEach(c => R.bust(c, c.dataset.bust));
  let b = ''; for (let i = 0; i < CFG.bondMax; i++) b += '<i class="' + (i < S.bond ? 'on' : '') + (i === 2 || i === 5 ? ' mark' : '') + '"></i>';
  $('#bond').innerHTML = b;
  $('#bondSub').textContent = S.bond >= CFG.bondFriends ? 'Friends' : S.bond >= CFG.bondBackToBack ? 'Back to Back · Friends at 6' : 'At odds · Back to Back at 3';
  let ins = ''; for (let i = 0; i < CFG.insightCap; i++) ins += '<i class="' + (i < S.insight ? 'on' : '') + '"></i>';
  $('#ins').innerHTML = ins;
  const holder = HW.heroList(S).find(h => h.inv.includes('masterkey'));
  $('#keySub').textContent = 'Master Key: ' + (S.door.open ? 'the door is open' : holder ? holder.name + ' has it' : S.key.state === 'hatch' ? 'on the Cellar Hatch' : S.key.state === 'held' ? 'on the floor!' : 'not yet revealed');
  $('#time').textContent = HW.fmtTime(S.time);
  const left = Math.max(0, Math.ceil((CFG.midnight - S.time) / CFG.minutesPerRound));
  $('#timeSub').textContent = left + (left === 1 ? ' round' : ' rounds') + ' to midnight';
  watch();
  renderActions();
}
function watch() {
  const c = $('#watch'), g = c.getContext('2d'), s = c.width / 38; g.setTransform(s, 0, 0, s, 0, 0); g.clearRect(0, 0, 38, 38);
  g.fillStyle = '#c9a45c'; g.beginPath(); g.arc(19, 20, 16, 0, 7); g.fill(); g.fillRect(17, 1, 4, 5);
  g.fillStyle = '#efe6d0'; g.beginPath(); g.arc(19, 20, 13.5, 0, 7); g.fill();
  const a0 = (S.time / 60 % 12) / 12 * Math.PI * 2 - Math.PI / 2;
  g.fillStyle = 'rgba(122,34,51,.35)'; g.beginPath(); g.moveTo(19, 20); g.arc(19, 20, 13.5, a0, Math.PI * 1.5); g.closePath(); g.fill();
  g.fillStyle = '#241810'; for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; g.fillRect(19 + Math.sin(a) * 11.5 - 0.6, 20 - Math.cos(a) * 11.5 - 0.6, 1.2, 1.2); }
  const hr = (S.time / 60 % 12) / 12 * Math.PI * 2, mn = (S.time % 60) / 60 * Math.PI * 2;
  g.strokeStyle = '#241810'; g.lineCap = 'round'; g.lineWidth = 2; g.beginPath(); g.moveTo(19, 20); g.lineTo(19 + Math.sin(hr) * 7, 20 - Math.cos(hr) * 7); g.stroke();
  g.lineWidth = 1.2; g.beginPath(); g.moveTo(19, 20); g.lineTo(19 + Math.sin(mn) * 10.5, 20 - Math.cos(mn) * 10.5); g.stroke();
}
function buildHaunt() {
  let h = '<tr><th></th><th>Lil\'</th><th>The Hollow</th></tr>';
  for (let i = 1; i <= 6; i++) h += '<tr><td>' + i + '</td><td data-g="' + i + '">' + HW.GHOST_NAMES[i] + '</td><td class="ho" data-h="' + i + '">' + HW.HOLLOW_NAMES[i] + '</td></tr>';
  $('#haunt').innerHTML = h;
}
function renderActions() {
  const el = $('#actions'); if (!S) { el.innerHTML = ''; return; }
  if (V.reach && V.reach.res) {
    el.innerHTML = '<h3>Move · up to ' + V.reach.pts + ' spaces</h3>' +
      '<button class="abtn" data-mv="stay" type="button"><kbd>Esc</kbd><span>Stay where you are</span><span class="cost"></span></button>' +
      (V.reach.canReroll ? '<button class="abtn" data-mv="reroll" type="button"><kbd>R</kbd><span>Wesley second-guesses it: reroll</span><span class="cost">1 Insight</span></button>' : '');
    return;
  }
  if (V.input) {
    const h = S.heroes[V.input.hero]; let html = '<h3>' + h.name + ' · ' + h.actions + (h.actions === 1 ? ' action' : ' actions') + ' left</h3>';
    V.input.opts.forEach((o, i) => {
      const k = o.type === 'move' || o.type === 'breakfree' ? 'M' : o.type === 'end' ? 'E' : String(i);
      html += '<button class="abtn' + (o.type === 'move' ? ' primary' : '') + (o.risky ? ' warn' : '') + '" data-i="' + i + '" type="button"' + (o.disabled ? ' disabled title="' + esc(o.why) + '"' : '') + '><kbd>' + k + '</kbd><span>' + esc(o.label) + (o.note ? ' <small>(' + esc(o.note) + ')</small>' : '') + (o.disabled ? '<br><small>' + esc(o.why) + '</small>' : '') + '</span><span class="cost">' + (o.cost ? '1 action' : '') + '</span></button>';
    });
    el.innerHTML = html; return;
  }
  el.innerHTML = '<div class="wait">' + esc(V.status || '') + '</div>';
}
/* the helper card: pops up on the board beside whoever's turn it is */
function renderGuide() {
  const el = $('#guide');
  if (!S || !V.input || !V.guideOn || auto) { el.hidden = true; return; }
  const h = S.heroes[V.input.hero], O = V.input.opts;
  let fl = ''; for (let i = 0; i < CFG.actions[h.id]; i++) fl += '<i class="act' + (i < h.actions ? ' on' : '') + '"></i>';
  let html = '<div class="g-head"><canvas width="68" height="68"></canvas><div><b style="color:var(--' + h.id + ')">' + h.name + '’s turn</b><div class="pips">' + fl + '<span>' + h.actions + (h.actions === 1 ? ' action left' : ' actions left') + '</span></div></div></div>';
  html += '<div class="g-tip">' + esc(HW.hint(S, h)) + '</div>';
  O.forEach((o, i) => {
    const roll = o.type === 'move' || o.type === 'breakfree', k = roll ? 'M' : o.type === 'end' ? 'E' : String(i);
    html += '<button type="button" class="g-btn' + (roll ? ' g-roll' : '') + (o.type === 'end' ? ' g-end' : '') + (V.input.sug === i ? ' sug' : '') + (o.risky ? ' warn' : '') + '" data-i="' + i + '"' + (o.disabled ? ' disabled' : '') + '>' +
      (roll ? '<span class="dicon"><i></i><i></i><i></i><i></i><i></i></span>' : '') + '<span class="lbl">' + esc(o.label) + (V.input.sug === i ? '<em>try this</em>' : '') + (o.note ? '<small>' + esc(o.note) + '</small>' : '') + (o.disabled ? '<small>' + esc(o.why) + '</small>' : '') + '</span><kbd>' + k + '</kbd></button>';
  });
  el.innerHTML = html; el.hidden = false; R.bust(el.querySelector('canvas'), h.id); placeGuide();
}
function placeGuide() {
  const el = $('#guide'); if (el.hidden || !V.input || !S) return;
  const st = $('#stage');
  if (st.clientWidth < 640) { el.classList.add('docked'); el.style.left = el.style.top = ''; return; }
  el.classList.remove('docked');
  const p = R.posOf(S, V, V.input.hero), q = toStage(p.x, p.y - 22), w = el.offsetWidth, hh = el.offsetHeight, sc = board.getBoundingClientRect().width / R.BW;
  const right = q.x + 34 * sc, left = q.x - 34 * sc - w; let x = right + w > st.clientWidth - 4 ? left : right;
  const y = Math.max(4, Math.min(st.clientHeight - hh - 4, q.y - hh / 2));
  if (V.target) { // keep the lit objective in view when the other side has room
    const a = toStage(V.target.x, V.target.y), b = toStage(V.target.x + V.target.w, V.target.y + V.target.h);
    const hits = xx => a.x < xx + w && b.x > xx && a.y < y + hh && b.y > y;
    if (hits(x)) { const alt = x === right ? left : right; if (alt >= 4 && alt + w <= st.clientWidth - 4 && !hits(alt)) x = alt; }
  }
  el.style.left = Math.max(4, x) + 'px'; el.style.top = y + 'px';
}
$('#guide').addEventListener('click', e => { const b = e.target.closest('button[data-i]'); if (b && !b.disabled && V.input) choose(V.input.opts[+b.dataset.i]); });
$('#hint').addEventListener('click', e => { const b = e.target.closest('button[data-mv]'); if (b) finishMove(b.dataset.mv === 'reroll' ? { reroll: true } : null); });
$('#actions').addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b || b.disabled) return;
  if (b.dataset.mv) return finishMove(b.dataset.mv === 'reroll' ? { reroll: true } : null);
  if (V.input && b.dataset.i != null) choose(V.input.opts[+b.dataset.i]);
});

/* ---------- modal cards ---------- */
const KICK = { story: 'The Manor', scene: 'Brock & Wesley', clue: 'Clue', memory: 'Lil\' remembers', ask: 'A choice', end: 'Chapter I' };
function cardHTML(card, buttons) {
  let h = '<div class="card ' + (card.kind || 'story') + (card.cls ? ' ' + card.cls : '') + '" role="dialog" aria-modal="true"><div class="kick">' + esc(card.sub || KICK[card.kind] || '') + '</div><h2>' + esc(card.title) + '</h2>';
  if (card.text) h += '<p>' + esc(card.text) + '</p>';
  if (card.lines) h += '<div class="dlg">' + card.lines.map(l => '<div class="' + l[0] + '"><b>' + esc(NAMES[l[0]]) + '</b>' + esc(l[1]) + '</div>').join('') + '</div>';
  if (card.html) h += card.html;
  if (card.effect) h += '<div class="fx">' + esc(card.effect) + '</div>';
  h += '<div class="btns">' + buttons.map((b, i) => '<button type="button" data-v="' + i + '"' + (b.alt ? ' class="alt"' : '') + '>' + esc(b.label) + '</button>').join('') + '</div></div>';
  return h;
}
function showCard(card, buttons) {
  buttons = buttons || [{ label: 'Continue', value: true }];
  if (auto) return sleep(1500).then(() => buttons[0].value);
  return new Promise(res => {
    const m = $('#modal'); m.innerHTML = cardHTML(card, buttons); m.hidden = false;
    if (card.kind === 'memory') Snd.ghost();
    const first = m.querySelector('button:not(.alt)') || m.querySelector('button'); setTimeout(() => first && first.focus(), 30);
    m.onclick = e => { const b = e.target.closest('button[data-v]'); if (!b) return; m.hidden = true; m.innerHTML = ''; m.onclick = null; res(buttons[+b.dataset.v].value); };
  });
}
async function ask(ev) {
  const h = S.heroes[ev.hero];
  if (h.npc || auto) return HW.aiAnswer(S, ev);
  if (ev.kind === 'protect') {
    const src = ev.why === 'record' ? 'The hand from the record player' : 'Lil\'s touch';
    return showCard({ kind: 'ask', title: 'Protection', sub: 'Brock decides', text: src + ' is about to cost Wesley a heart. Brock can step in front of him and take it instead.',
      effect: ev.free ? 'Friends: this costs Brock no action. He still loses the heart.' : ev.own ? 'Costs Brock 1 heart and 1 action this turn.' : 'Costs Brock 1 heart now, and 1 action from his next turn.' },
    [{ label: 'Step in', value: true }, { label: 'Let it land', value: false, alt: true }]);
  }
  if (ev.kind === 'reroll') return showCard({ kind: 'ask', title: 'Second Guess', sub: 'Wesley decides', text: ev.what, effect: 'Wesley can spend 1 Insight to make ' + (ev.who === 'ghost' ? 'Lil\'' : 'the Hollow') + ' roll again. You have ' + S.insight + '.' },
    [{ label: 'Reroll · 1 Insight', value: true }, { label: 'Let it stand', value: false, alt: true }]);
  if (ev.kind === 'abandon') { const o = S.heroes[ev.other]; return showCard({ kind: 'ask', title: 'Leave him?', sub: h.name + ' decides', text: o.name + ' is lying somewhere behind you. If ' + h.name + ' steps through that door now, he goes alone.' }, [{ label: 'Stay', value: false }, { label: 'Leave him', value: true, alt: true }]); }
  return false;
}

/* ---------- animation of yielded events ---------- */
const P = (id) => R.posOf(S, V, id);
function ring(x, y, col, Rr, dur) { V.rings.push({ x, y, col, R: Rr || 40, t0: now(), dur: (dur || 0.7) }); }
function float(id, text, col, dy) { const p = typeof id === 'string' ? P(id) : id; V.fx.push({ x: p.x, y: p.y - (dy == null ? 54 : dy), text, col, t0: now() + V.fx.filter(f => now() - f.t0 < 0.3).length * 0.25, dur: 1.5 }); }
async function animMove(ev) {
  const id = ev.id;
  if (V.skipAnim === id) { V.skipAnim = null; delete V.anim[id]; return; }
  const per = id === 'ghost' ? 170 : id === 'hollow' ? 300 : id.indexOf('trap') === 0 ? 420 : 105;
  let prev = ev.from;
  for (const p of ev.path) {
    const a = { x: R.cx(prev.c), y: R.cy(prev.f, prev.r) }, b = { x: R.cx(p.c), y: R.cy(p.f, p.r) };
    if (p.f !== prev.f) { await tween(170, k => { V.anim[id] = { f: prev.f, x: a.x, y: a.y, a: 1 - k }; }); await tween(170, k => { V.anim[id] = { f: p.f, x: b.x, y: b.y, a: k }; }); }
    else await tween(per, k => { V.anim[id] = { f: p.f, x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k - (id === 'brock' || id === 'wesley' ? Math.sin(k * Math.PI) * 3 : 0), a: 1 }; });
    if (id === 'brock' || id === 'wesley') Snd.step();
    prev = p;
  }
  delete V.anim[id];
  if (id === 'ghost' && ev.drift) await sleep(120);
}
async function animTeleport(ev) {
  const id = ev.id, a = { x: R.cx(ev.from.c), y: R.cy(ev.from.f, ev.from.r) }, e = id === 'ghost' ? S.ghost : id === 'hollow' ? S.hollow : S.heroes[id], b = { x: R.cx(e.c), y: R.cy(e.f, e.r) };
  if (ev.thrown) { Snd.thud(); await tween(520, k => { V.anim[id] = { f: e.f, x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k - Math.sin(k * Math.PI) * 60, a: 1 }; }); V.shake = now() + 0.25; }
  else { if (id === 'ghost') Snd.ghost(); await tween(260, k => { V.anim[id] = { f: ev.from.f, x: a.x, y: a.y - k * 10, a: 1 - k }; }); ring(b.x, b.y, id === 'ghost' ? 'rgba(200,228,255,A)' : 'rgba(255,217,138,A)', 34); await tween(260, k => { V.anim[id] = { f: e.f, x: b.x, y: b.y - (1 - k) * 10, a: k }; }); }
  delete V.anim[id];
}
async function fx(ev) {
  const p = ev.id ? P(ev.id) : null, ob = ev.obj ? R.objBox(HW.obj(S, ev.obj)) : null;
  switch (ev.kind) {
    case 'hurt': float(ev.id, '−' + ev.amt + ' heart', '#ff8a7a'); ring(p.x, p.y - 14, 'rgba(220,98,83,A)', 44); V.shake = now() + 0.3; Snd.hurt(); break;
    case 'fright': float(ev.id, '+' + ev.amt + ' Fright', '#c3aefc'); Snd.fright(); break;
    case 'calm': float(ev.id, '−' + ev.amt + ' Fright', '#9fe0af'); break;
    case 'heal': float(ev.id, '+1 heart', '#9fe0af'); Snd.good(); break;
    case 'possess': ring(p.x, p.y - 14, 'rgba(200,228,255,A)', 90, 1.2); ring(p.x, p.y - 14, 'rgba(200,228,255,A)', 50, 0.8); float(ev.id, 'Possessed', '#e6f1ff'); V.shake = now() + 0.4; Snd.possess(); await sleep(500); break;
    case 'trap': ring(p.x, p.y, 'rgba(200,205,215,A)', 36); float(ev.id, 'Trapped', '#ffb7ac'); Snd.snap(); V.shake = now() + 0.2; break;
    case 'gaze': V.beams.push({ id: ev.id, t0: now(), dur: 1.1, forced: ev.forced }); Snd.gaze(); await sleep(350); break;
    case 'record': { const b = R.objBox(HW.obj(S, 'gramophone')); ring(b.x + b.w / 2, b.y + b.h - 10, 'rgba(120,190,255,A)', 110, 1.1); Snd.record(); await sleep(450); break; }
    case 'slam': V.shake = now() + 0.5; Snd.thud(); if (ob) ring(ob.x + ob.w / 2, ob.y + ob.h / 2, 'rgba(255,255,255,A)', 60); break;
    case 'lift': if (ob) ring(ob.x + ob.w / 2, ob.y + ob.h / 2, 'rgba(255,217,138,A)', 70); Snd.thud(); Snd.good(); break;
    case 'throw': float(ev.id, 'Thrown!', '#ffb7ac'); ring(R.cx(ev.to.c), R.cy(ev.to.f, ev.to.r), 'rgba(255,217,138,A)', 30); Snd.snap(); break;
    case 'shove': V.shake = now() + 0.3; Snd.thud(); break;
    case 'snap': ring(p.x, p.y - 14, 'rgba(255,255,255,A)', 60); float(ev.id, 'Himself again', '#e6f1ff'); Snd.good(); break;
    case 'panic': float(ev.id, 'Overcome: −1 action', '#c3aefc'); break;
    case 'work': if (ob) ring(ob.x + ob.w / 2, ob.y + ob.h / 2, 'rgba(255,217,138,A)', 34); Snd.search(); break;
    case 'door': Snd.door(); ring(R.tx(10), R.ty('G', 8), 'rgba(190,220,255,A)', 120, 1.2); break;
  }
  await sleep(420);
}

/* ---------- input ---------- */
const human = id => !auto && !S.heroes[id].npc;
function targetBox(h) {
  const st = HW.stepOf(S, h), ch = HW.CHAINS[h.chain];
  const ob = id => R.objBox(HW.obj(S, id));
  const item = it => { const l = HW.locate(S, it); if (!l) return null; if (l.where === 'obj') return ob(l.id); if (l.where === 'ground') return { x: R.tx(l.pos.c) + 4, y: R.ty(l.pos.f, l.pos.r), w: 32, h: 30 }; return null; };
  if (S.key.state === 'hatch') return ob('hatch');
  if (S.key.state !== 'hidden') { if (!HW.heroList(S).some(x => x.inv.includes('masterkey'))) return item('masterkey'); return { x: R.tx(9) + 2, y: R.ty('G', 8) - 20, w: 76, h: 50 }; }
  if (st === 'find') return item(ch.item);
  if (st === 'coop') return ob(S.obstacle);
  if (st === 'use') return h.inv.includes(ch.item) ? ob(ch.use) : item(ch.item);
  return null;
}
function getInput(h) {
  return new Promise(res => {
    const opts = HW.options(S, h); let sug = -1;
    if (V.guideOn) { const a = HW.aiAct(S, h); sug = opts.findIndex(o => !o.disabled && o.type === a.type && o.obj === a.obj && o.help === a.help && o.item === a.item && o.target === a.target); }
    V.input = { hero: h.id, opts, res, sug }; V.target = targetBox(h); V.status = ''; hud(); renderGuide();
  });
}
function choose(o) { if (!V.input || !o || o.disabled) return; const r = V.input.res; V.input = null; V.target = null; V.hover = null; hidePop(); $('#guide').hidden = true; renderActions(); r(o); }
function getMove(ev) { return new Promise(res => { V.star = V.guideOn ? HW.aiMove(S, S.heroes[ev.hero], ev) : null; V.reach = { hero: ev.hero, tiles: ev.tiles, pts: ev.pts, roll: ev.roll, canReroll: ev.canReroll, res }; V.cursor = null; renderActions(); }); }
function finishMove(x) { if (!V.reach || !V.reach.res) return; const r = V.reach.res; V.reach = null; V.cursor = null; V.hover = null; V.star = null; renderActions(); r(x); }
const reachTile = tl => V.reach && tl && V.reach.tiles.find(x => HW.same(x, tl));
function optsFor(pk) {
  if (!V.input || !pk) return [];
  const h = S.heroes[V.input.hero], p = HW.partner(S, h), O = V.input.opts;
  if (pk.kind === 'mini' && pk.id === h.id) return O.filter(o => o.type === 'move' || o.type === 'breakfree' || o.type === 'hide' || (o.type === 'useitem' && o.target === h.id));
  if (pk.kind === 'mini') return O.filter(o => o.type === 'help' || o.type === 'give' || (o.type === 'useitem' && o.target === p.id) || (o.type === 'deduce' && o.target === p.id));
  if (pk.kind === 'obj') return O.filter(o => o.obj === pk.id);
  if (pk.kind === 'door') return O.filter(o => o.type === 'unlock');
  if (pk.kind === 'tile' && HW.same(pk, h)) return O.filter(o => o.type === 'hide' || o.type === 'move');
  return [];
}
function local(e) { const r = board.getBoundingClientRect(); return { x: (e.clientX - r.left) / r.width * R.BW, y: (e.clientY - r.top) / r.height * R.BH }; }
function hidePop() { const p = $('#pop'); p.hidden = true; p.innerHTML = ''; }
function showPop(list, e) {
  const p = $('#pop'), st = $('#stage').getBoundingClientRect();
  p.innerHTML = list.map((o, i) => '<button class="abtn" type="button" data-p="' + i + '"' + (o.disabled ? ' disabled' : '') + '><kbd>' + (i + 1) + '</kbd><span>' + esc(o.label) + '</span><span class="cost">' + (o.cost ? '1 action' : '') + '</span></button>').join('');
  p.hidden = false; p.style.left = Math.max(4, Math.min(st.width - 290, e.clientX - st.left - 20)) + 'px'; p.style.top = Math.max(4, Math.min(st.height - list.length * 40 - 10, e.clientY - st.top + 12)) + 'px';
  p.onclick = ev => { const b = ev.target.closest('button[data-p]'); if (b && !b.disabled) choose(list[+b.dataset.p]); };
}
const INFO = { doll: 'Weeping Doll: +1 Fright within 2 spaces', gramophone: 'Haunted Record Player: plays on a count of 3', hatch: 'Cellar Hatch', bust: 'Marble Bust', harp: 'Harp', armchairL: 'Reading Chair', armchairS: 'Armchair' };
function onHover(p) {
  if (!S || demo || V.cine) { V.hover = null; return; }
  if (V.reach && V.reach.res) {
    const tl = R.tileAt(p.x, p.y), rt = reachTile(tl); V.cursor = rt || null;
    V.hover = rt ? { x: R.cx(rt.c), y: R.cy(rt.f, rt.r), label: (rt.trap ? 'The Entity Trap is here!' : rt.exit ? 'Step outside' : rt.d + (rt.d === 1 ? ' space' : ' spaces')) + (V.star && HW.same(V.star, rt) ? ' · a good spot' : '') } : null;
    board.style.cursor = rt ? 'pointer' : 'default'; return;
  }
  const pk = R.pick(S, V, p.x, p.y); let label = '', box = pk && pk.box, act = false;
  for (const id of ['ghost', 'hollow']) { const q = P(id); if (Math.abs(p.x - q.x) < 13 && p.y > q.y - 66 && p.y < q.y + 8) { label = id === 'ghost' ? 'Lil\': drifts 1 toward the nearest hero, then rolls' : 'The Hollow: frightens whoever stands in his pale cone'; box = null; } }
  if (!label) for (const tr of S.traps) if (Math.abs(p.x - R.cx(tr.c)) < 14 && Math.abs(p.y - R.cy(tr.f, tr.r)) < 9) label = tr.dormant > 0 ? 'Entity Trap: shut for now' : 'Entity Trap: creeps toward anyone within ' + CFG.trapNotice;
  if (!label && pk) {
    const list = optsFor(pk).filter(o => !o.disabled), dis = optsFor(pk).find(o => o.disabled);
    if (list.length === 1) { label = list[0].label + (list[0].cost ? ' · 1 action' : ''); act = true; }
    else if (list.length > 1) { label = list.length + ' actions here'; act = true; }
    else if (dis) label = dis.why;
    else if (pk.kind === 'obj') { const o = HW.obj(S, pk.id); label = INFO[pk.id] || (o.search && S.searched[o.id] ? o.name + ' (searched)' : V.input && o.search ? o.name + ': stand beside it to search' : o.name); }
    else if (pk.kind === 'mini') { const h = S.heroes[pk.id]; label = h.name; box = null; }
    else if (pk.kind === 'door') label = S.door.open ? 'The front door, open' : 'The front door, locked';
    else if (pk.kind === 'tile' && HW.HIDES[HW.key(pk)]) label = 'Hiding place: ' + HW.HIDES[HW.key(pk)];
    else if (pk.kind === 'tile' && HW.STAIRS[HW.key(pk)]) label = 'Stairs';
  }
  V.hover = label ? { x: p.x, y: box ? box.y + 4 : p.y - 12, label, box: act ? box : null } : null;
  board.style.cursor = act ? 'pointer' : 'default';
}
function onClick(p, e) {
  if (!S || demo) return;
  if (V.cine) { if (V.cine.next) V.cine.next(); return; }
  hidePop();
  if (V.reach && V.reach.res) { const tl = R.tileAt(p.x, p.y), rt = reachTile(tl); if (rt) return finishMove(rt); return; }
  if (!V.input) return;
  const pk = R.pick(S, V, p.x, p.y), all = optsFor(pk), list = all.filter(o => !o.disabled);
  if (list.length === 1) return choose(list[0]);
  if (list.length > 1) return showPop(list, e);
  const dis = all.find(o => o.disabled);
  V.flash = { text: dis ? dis.why : pk && pk.kind === 'obj' ? 'Stand on a space beside it first.' : 'Roll to move first: click your miniature, or press M.', until: now() + 3 };
}
board.addEventListener('pointermove', e => { const p = local(e); if (V.drag) { V.drag.moved = true; V.anim[V.drag.id] = { f: S.heroes[V.drag.id].f, x: p.x, y: p.y + 14, a: 0.9 }; } onHover(p); });
board.addEventListener('pointerleave', () => { if (!V.drag) { V.hover = null; V.cursor = null; } });
board.addEventListener('pointerdown', e => {
  Snd.init(); const p = local(e);
  if (S && V.reach && V.reach.res) { const pk = R.pick(S, V, p.x, p.y); if (pk && pk.kind === 'mini' && pk.id === V.reach.hero) { V.drag = { id: pk.id, moved: false }; try { board.setPointerCapture(e.pointerId); } catch (x) { /* fine */ } } }
});
board.addEventListener('pointerup', e => {
  const p = local(e);
  if (V.drag) { const d = V.drag; V.drag = null; delete V.anim[d.id]; if (d.moved) { const rt = reachTile(R.tileAt(p.x, p.y)); if (rt) { V.skipAnim = d.id; finishMove(rt); } return; } }
  onClick(p, e);
});
function moveCursor(dc, dr) {
  const h = S.heroes[V.reach.hero], cur = V.cursor || { f: h.f, c: h.c, r: h.r }; const ok = t => reachTile(t) || (HW.same(t, h) ? t : null);
  for (let k = 1; k <= 5; k++) { const t = ok({ f: cur.f, c: cur.c + dc * k, r: cur.r + dr * k }); if (t) { V.cursor = t; return; } }
  const link = HW.STAIRS[HW.key(cur)]; if (link && ok(link)) { V.cursor = ok(link); return; }
  let best = null, bd = 1e9; for (const t of V.reach.tiles) { const vx = t.c - cur.c, vy = t.r - cur.r; if (t.f !== cur.f || vx * dc + vy * dr <= 0) continue; const d = Math.abs(vx) + Math.abs(vy); if (d < bd) { bd = d; best = t; } }
  if (best) V.cursor = best;
}
document.addEventListener('keydown', e => {
  Snd.init();
  const k = e.key, typing = e.target && /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName);
  if (!$('#notes').hidden) { if (k === 'Escape') closeNotes(); return; }
  if (e.ctrlKey || e.metaKey || e.altKey || typing) return;
  if ((k === 'n' || k === 'N') && $('#modal').hidden) { openNotes(); e.preventDefault(); return; }
  if (!S || demo || !$('#modal').hidden) return;
  if (V.cine) { if (k === 'Escape') skipIntro(); else if (k === ' ' || k === 'Enter') { if (V.cine.next) V.cine.next(); e.preventDefault(); } return; }
  if (V.reach && V.reach.res) {
    const d = { ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0] }[k];
    if (d) { moveCursor(d[0], d[1]); e.preventDefault(); }
    else if (k === 'PageUp' || k === 'PageDown' || k === 'f' || k === 'F') { const cur = V.cursor || S.heroes[V.reach.hero]; const other = V.reach.tiles.filter(t => t.f !== cur.f); if (other.length) { other.sort((a, b) => a.d - b.d); V.cursor = other[0]; } e.preventDefault(); }
    else if (k === 'Enter' || k === ' ') { if (document.activeElement && document.activeElement.tagName === 'BUTTON') return; const h = S.heroes[V.reach.hero]; if (V.cursor) finishMove(HW.same(V.cursor, h) ? null : V.cursor); e.preventDefault(); }
    else if (k === 'Escape') finishMove(null);
    else if ((k === 'r' || k === 'R') && V.reach.canReroll) finishMove({ reroll: true });
    return;
  }
  if (!V.input) return;
  if (!$('#pop').hidden) { const b = $('#pop').querySelector('button[data-p="' + (parseInt(k, 10) - 1) + '"]'); if (b) { b.click(); return; } if (k === 'Escape') hidePop(); }
  const O = V.input.opts;
  if (k === 'm' || k === 'M') { const o = O.find(x => x.type === 'move' || x.type === 'breakfree'); if (o) choose(o); }
  else if (k === 'e' || k === 'E') choose(O.find(x => x.type === 'end'));
  else if (/^[1-9]$/.test(k)) { const o = O[+k]; if (o && !o.disabled && o.type !== 'end') choose(o); }
});

/* ---------- the driver ---------- */
async function handle(ev) {
  switch (ev.t) {
    case 'start': await intro(); break;
    case 'round': addLog(HW.fmtTime(S.time) + ' · Round ' + ev.n, 'rd'); break;
    case 'turn': { V.active = ev.hero; const h = S.heroes[ev.hero]; V.status = h.npc || auto ? h.name + ' is taking his turn.' : ''; hud(); if (S.opts.mode === 'coop' && !auto) await banner(h.name + '’s turn', 650); else await sleep(200); break; }
    case 'turnend': V.active = null; break;
    case 'input': { const h = S.heroes[ev.hero]; if (!human(ev.hero)) { await sleep(480); return HW.aiAct(S, h); } return getInput(h); }
    case 'chooseMove': { const h = S.heroes[ev.hero]; if (!human(ev.hero)) { await sleep(220); return HW.aiMove(S, h, ev); } return getMove(ev); }
    case 'ask': return ask(ev);
    case 'die': await rollDie(ev); break;
    case 'move': await animMove(ev); break;
    case 'teleport': await animTeleport(ev); break;
    case 'say': say(ev.who, ev.text); await sleep(1000); break;
    case 'whisper': say('lil', ev.text); Snd.ghost(); await sleep(1200); break;
    case 'log': addLog(esc(ev.text), ev.cls); await sleep(ev.cls ? 600 : 300); break;
    case 'tip': showTip(ev.text); break;
    case 'card': if (ev.chime) Snd.chime(ev.chime); hud(); await showCard(ev.card); break;
    case 'fx': hud(); await fx(ev); break;
    case 'bond': { const a = P('brock'), b = P('wesley'); float({ x: (a.x + b.x) / 2, y: Math.min(a.y, b.y) }, (ev.delta > 0 ? 'Bond +' : 'Bond ') + ev.delta, ev.delta > 0 ? '#ffd98a' : '#ff8a7a', 70); if (ev.delta > 0) Snd.good(); addLog('Bond ' + (ev.delta > 0 ? 'rises' : 'falls') + ' to ' + S.bond + '.', ev.delta > 0 ? 'good' : 'bad'); await sleep(350); break; }
    case 'insight': addLog('Insight ' + (ev.delta > 0 ? '+' : '') + ev.delta + ' (now ' + S.insight + ').', ev.delta > 0 ? 'good' : ''); break;
    case 'clock': hud(); Snd.tick(); await sleep(200); break;
    case 'step': Snd.good(); break;
    case 'phase': V.active = null; V.status = 'The haunt: Lil\' and the Hollow take their turn.'; hud(); await banner('The Haunt'); break;
    case 'search': { const b = R.objBox(HW.obj(S, ev.obj)); ring(b.x + b.w / 2, b.y + b.h / 2, 'rgba(255,217,138,A)', 30); Snd.search(); await sleep(350); break; }
    case 'turnface': await sleep(250); break;
    case 'end': await ending(ev.result); break;
  }
  hud();
}
async function drive(me) {
  const gen = HW.game(S); let res = gen.next();
  while (!res.done && me === gid) {
    let ans;
    try { ans = await handle(res.value); } catch (err) { console.error(err); addLog('Something went wrong: ' + esc(err.message), 'bad'); }
    if (me !== gid) return;
    res = gen.next(ans);
  }
}
function advance(ms) { return new Promise(res => { const C = V.cine; if (!C) return res(); const done = () => { clearTimeout(tm); if (C.next === done) C.next = null; res(); }; const tm = setTimeout(done, ms * Math.max(0.7, V.pace)); C.next = done; }); }
function skipIntro() { if (V.cine) { V.cine.skip = true; if (V.cine.next) V.cine.next(); } }
// The opening plays on the board itself: the boys come in, the door locks, and something upstairs notices.
async function intro() {
  if (auto) return;
  const me = gid, C = V.cine = { skip: false, next: null }, live = () => !C.skip && me === gid;
  const cap = t => { const el = $('#caption'); if (t) { el.textContent = t; el.classList.add('on'); } else el.classList.remove('on'); };
  const beat = async ms => { if (live()) await advance(ms); };
  const line = async (who, text) => { if (!live()) return; say(who, text, 90); await beat(1700 + text.length * 62); V.bubbles = V.bubbles.filter(b => b.who !== who); };
  const stand = (id, c, r) => { V.anim[id] = { f: 'G', x: R.cx(c), y: R.cy('G', r), a: 1 }; };
  const walk = async (id, c, r0, r1) => { if (!live()) return; await tween(460, k => { V.anim[id] = { f: 'G', x: R.cx(c), y: R.cy('G', r0 + (r1 - r0) * k) - Math.sin(k * Math.PI) * 3, a: 1 }; }); Snd.step(); };
  V.hide = { brock: true, wesley: true }; V.doorOpen = true; V.dim = 0.22; V.status = ''; $('#skip').hidden = false;
  cap('Hollowwood Manor has stood shut for sixty years. People say two daughters lived here once. People only ever name one of them.'); await beat(7500); cap('');
  if (live()) { V.hide.brock = false; stand('brock', 9, 8); await beat(400); await walk('brock', 9, 8, 7); }
  await line('brock', 'Ten minutes. In, look around, out. Then nobody gets to say I\'m all talk.');
  if (live()) { V.hide.wesley = false; stand('wesley', 10, 8); }
  await line('wesley', 'Nobody says that. They say you\'re loud.');
  await line('brock', 'Loud, and inside a haunted house. Where are you standing, Wes?');
  await walk('wesley', 10, 8, 7);
  await line('wesley', 'Inside. For the library. Sixty years sealed, Brock. Not for you.');
  if (live()) {
    V.doorOpen = false; V.shake = now() + 0.45; Snd.thud(); V.dim = 0.45;
    cap('Behind them the front door closes. It is not a slam. It is one careful click, like a key turned from the other side.');
    await tween(1100, k => { V.dim = 0.45 - 0.27 * k; }); await beat(5600); cap('');
  }
  await line('brock', 'Wind.');
  await line('wesley', 'Wind doesn\'t turn a key.');
  if (live()) { const g = R.posOf(S, V, 'ghost'); ring(g.x, g.y - 20, 'rgba(200,228,255,A)', 90, 1.5); ring(g.x, g.y - 20, 'rgba(200,228,255,A)', 50, 1); Snd.ghost(); }
  await line('lil', '“Someone\'s come to play.”');
  await line('brock', 'Tell me you didn\'t hear that.');
  await line('wesley', 'I didn\'t hear that. Neither did you. Let\'s find a key.');
  if (live()) { cap('Finish what the house sets you. Find the Master Key. Get both of them out before midnight.'); await beat(6500); }
  if (V.cine === C) { V.cine = null; V.hide = null; V.doorOpen = false; V.dim = 0; delete V.anim.brock; delete V.anim.wesley; V.bubbles = []; cap(''); $('#skip').hidden = true; }
  if (me !== gid) return;
  if (S.opts.guided) showTip('The card that pops up beside your hero is your helper. It lists what you can do right now and marks one thing worth trying. You can also click things on the board.');
}
async function ending(res) {
  const E = HW.STORY.endings, t = HW.tier(S); let title, text, sub = 'Chapter I';
  if (res.result === 'escaped') { title = 'Out Before Midnight'; text = E.escaped[t]; Snd.good(); }
  else if (res.result === 'midnight') { title = 'Midnight'; text = E.midnight; Snd.chime(4); }
  else if (res.result === 'taken') { title = 'The House Keeps Them'; text = E.taken; Snd.possess(); }
  else if (res.result === 'abandoned') { const x = S.heroes[res.who], y = HW.partner(S, x); title = 'One Set of Footsteps'; text = E.abandoned.replace(/\{X\}/g, x.name).replace(/\{Y\}/g, y.name); }
  else { title = 'The Night Ends'; text = ''; }
  const stat = (v, l) => '<div><b>' + esc(v) + '</b>' + esc(l) + '</div>';
  const html = (res.result === 'escaped' ? '<p><i>' + esc(E.coda) + '</i></p>' : '') + '<div class="stats">' + stat(HW.fmtTime(Math.min(S.time, CFG.midnight)), 'on the clock') + stat(['At odds', 'Allies', 'Friends'][t], 'Brock and Wesley') + stat(Object.keys(S.clues).length + ' of 6', 'clues found') + stat(Math.min(S.memories, 6) + ' of 6', 'of Lil\'s memories') + '</div>';
  auto = false;
  await showCard({ kind: 'end', cls: res.result === 'escaped' ? '' : 'memory', title, sub: res.result === 'escaped' ? 'Chapter I complete' : 'The night is lost', text, html, effect: res.result === 'escaped' ? 'To be continued below the house.' : 'The house resets its board. Try another night.' }, [{ label: 'Play again', value: true }]);
  startScreen();
}

/* ---------- playtest notes: saved in this browser, copied out or sent as a GitHub issue ---------- */
const NOTES_REPO = 'arkigos/hollowwood-manor'; // "owner/repo" when hosted on GitHub Pages; leave empty to hide the issue button
const TAGS = ['Confusing', 'Bug', 'Too hard', 'Too easy', 'Loved it', 'Idea'];
const Notes = { list: [] };
function notesBadge() { $('#btnNotes').textContent = 'Notes' + (Notes.list.length ? ' (' + Notes.list.length + ')' : ''); }
function notesLoad() { try { const r = localStorage.getItem('hw-notes'); if (r) Notes.list = JSON.parse(r) || []; } catch (e) { Notes.list = []; } notesBadge(); }
function notesSave() { try { localStorage.setItem('hw-notes', JSON.stringify(Notes.list)); } catch (e) { /* storage blocked: notes last for this visit */ } notesBadge(); }
function noteContext() {
  if (!S || demo) return { line: 'On the title screen', who: '', before: [] };
  const hero = h => h.name + ' in the ' + (h.escaped ? 'garden, outside' : HW.roomAt(h.f, h.c, h.r)) + ', ' + h.hearts + ' hearts, Fright ' + h.fright + (h.possessed ? ', possessed' : '') + (h.trapped ? ', trapped' : '') + (h.down ? ', collapsed' : '');
  return { line: HW.fmtTime(S.time) + ', round ' + S.round + ' · ' + (S.opts.guided ? 'First Night' : 'Another Night') + ' · ' + (S.opts.mode === 'coop' ? 'two players' : 'solo as ' + NAMES[S.opts.human]) + ' · cards ' + S.deal.brock + ' / ' + S.deal.wesley + ' / route ' + S.deal.coop + (V.cine ? ' · during the opening' : ''),
    who: HW.heroList(S).map(hero).join(' · ') + ' · Bond ' + S.bond + ' · Insight ' + S.insight, before: [...document.querySelectorAll('#log p:not(.tip)')].slice(-5).map(p => p.textContent) };
}
function notesText() {
  let t = 'Hollowwood Manor playtest notes (' + Notes.list.length + ')\n';
  Notes.list.forEach((n, i) => { t += '\n[' + (i + 1) + '] ' + n.when + (n.tag ? ' · ' + n.tag : '') + '\n' + n.ctx.line + '\n' + (n.ctx.who ? n.ctx.who + '\n' : '') + (n.ctx.before && n.ctx.before.length ? 'Just before: ' + n.ctx.before.join(' / ') + '\n' : '') + '> ' + n.text + '\n'; });
  return t;
}
function closeNotes() { const el = $('#notes'); el.hidden = true; el.innerHTML = ''; board.focus({ preventScroll: true }); }
function openNotes(view) {
  const el = $('#notes'), n = Notes.list.length;
  if (view === 'list') {
    const items = n ? Notes.list.map((x, i) => '<div><small>' + (i + 1) + ' · ' + esc(x.when) + (x.tag ? ' · <b>' + esc(x.tag) + '</b>' : '') + ' · ' + esc(x.ctx.line) + '</small>' + esc(x.text) + '</div>').join('') : '<div>No notes yet.</div>';
    const issue = NOTES_REPO && n ? '<a class="btn" target="_blank" rel="noopener" href="https://github.com/' + NOTES_REPO + '/issues/new?title=' + encodeURIComponent('Playtest notes, ' + new Date().toLocaleDateString()) + '&body=' + encodeURIComponent(notesText().slice(0, 5500)) + '">Send as a GitHub issue</a>' : '';
    el.innerHTML = '<div class="card dark" role="dialog" aria-modal="true"><div class="kick">Playtest notes</div><h2>All notes</h2><p>Notes are kept in this browser only. When you are done playing, copy them and send them over' + (NOTES_REPO ? ', or post them as a GitHub issue' : '') + '.</p><div class="notelist">' + items + '</div><textarea id="noteOut" readonly hidden aria-label="All notes as text"></textarea>' +
      '<div class="btns"><button type="button" class="alt" data-n="close">Close</button>' + (n ? '<button type="button" class="alt" data-n="clear">Delete all</button>' : '') + '<button type="button" class="alt" data-n="write">Write a note</button>' + issue + (n ? '<button type="button" data-n="copy">Copy all notes</button>' : '') + '</div></div>';
  } else {
    const ctx = noteContext();
    el.innerHTML = '<form class="card dark" id="noteForm" role="dialog" aria-modal="true"><div class="kick">Playtest notes</div><h2>Leave a note</h2><p>Say what just happened, or what you were trying to do. The game writes down where you were.</p>' +
      '<div class="notectx">' + esc(ctx.line) + (ctx.who ? '<br>' + esc(ctx.who) : '') + '</div>' +
      '<fieldset><legend>What kind of note</legend><div class="seg tags">' + TAGS.map((t, i) => '<label><input type="radio" name="tag" id="tag' + i + '" value="' + t + '"><span>' + t + '</span></label>').join('') + '</div></fieldset>' +
      '<label class="lab" for="noteText">Your note</label><textarea id="noteText" required placeholder="I thought I could…"></textarea>' +
      '<div class="btns"><button type="button" class="alt" data-n="close">Close</button><button type="button" class="alt" data-n="list">All notes' + (n ? ' (' + n + ')' : '') + '</button><button type="submit">Save note</button></div></form>';
    const f = $('#noteForm'); f._ctx = ctx;
    f.onsubmit = e => { e.preventDefault(); const text = $('#noteText').value.trim(); if (!text) return; const tag = new FormData(f).get('tag') || ''; Notes.list.push({ when: new Date().toLocaleString(), tag, text, ctx: f._ctx }); notesSave(); closeNotes(); V.flash = { text: 'Note saved. That makes ' + Notes.list.length + '. Press N any time to add another.', until: now() + 5 }; };
    setTimeout(() => { const t = $('#noteText'); if (t) t.focus(); }, 30);
  }
  el.hidden = false;
  el.onclick = e => {
    const b = e.target.closest('[data-n]'); if (!b) return; const a = b.dataset.n;
    if (a === 'close') closeNotes(); else if (a === 'list') openNotes('list'); else if (a === 'write') openNotes();
    else if (a === 'clear') { b.dataset.n = 'clearyes'; b.textContent = 'Really delete all?'; }
    else if (a === 'clearyes') { Notes.list = []; notesSave(); openNotes('list'); }
    else if (a === 'copy') { const text = notesText(), fall = () => { const o = $('#noteOut'); o.hidden = false; o.value = text; o.focus(); o.select(); b.textContent = 'Select and copy below'; }; try { navigator.clipboard.writeText(text).then(() => { b.textContent = 'Copied'; }, fall); } catch (x) { fall(); } }
  };
}

/* ---------- start, rules, chrome ---------- */
function begin(opts) {
  gid++; demo = false; S = HW.newGame(opts);
  Object.assign(V, { anim: {}, fx: [], bubbles: [], beams: [], rings: [], reach: null, cursor: null, hover: null, input: null, active: null, target: null, tip: null, status: '', star: null, hide: null, doorOpen: false, dim: 0, cine: null });
  $('#guide').hidden = true; $('#bigdie').hidden = true; $('#skip').hidden = true; $('#caption').classList.remove('on');
  $('#log').innerHTML = ''; $('#start').hidden = true; $('#modal').hidden = true; hidePop();
  document.querySelectorAll('#haunt td.hit').forEach(td => td.classList.remove('hit'));
  R.drawStatic(); hud(); drive(gid);
}
function startScreen() {
  gid++; demo = true; auto = false; S = HW.newGame({ guided: true, seed: 7 });
  Object.assign(V, { input: null, reach: null, target: null, active: null, status: '', star: null, hide: null, doorOpen: false, dim: 0, cine: null, anim: {}, bubbles: [] });
  $('#guide').hidden = true; $('#bigdie').hidden = true; $('#skip').hidden = true; $('#caption').classList.remove('on'); hud();
  const el = $('#start');
  el.innerHTML = '<form class="card" id="startForm"><div class="kick">Chapter I · The Sisters</div><h2>Hollowwood Manor</h2>' +
    '<p>Two boys, a locked door, and a house that remembers. Finish what it sets you, find the Master Key, and get Brock and Wesley out before midnight. The girl in white will try to keep you. She will also try to tell you why.</p>' +
    '<fieldset><legend>Who is playing</legend><div class="seg">' +
    '<label><input type="radio" name="mode" value="wesley" id="mW" checked><span>Solo as Wesley<small>Brock plays himself</small></span></label>' +
    '<label><input type="radio" name="mode" value="brock" id="mB"><span>Solo as Brock<small>Wesley plays himself</small></span></label>' +
    '<label><input type="radio" name="mode" value="coop" id="mC"><span>Two players<small>One screen, one hero each</small></span></label></div></fieldset>' +
    '<fieldset><legend>Which night</legend><div class="seg">' +
    '<label><input type="radio" name="night" value="first" id="nF" checked><span>First Night<small>Guided, with a set deal and one staged haunting</small></span></label>' +
    '<label><input type="radio" name="night" value="another" id="nA"><span>Another Night<small>Cards and the blocked route are shuffled</small></span></label></div></fieldset>' +
    '<div class="btns"><button type="button" class="alt" id="startRules">How to play</button><button type="submit">Open the door</button></div></form>';
  el.hidden = false;
  $('#startForm').onsubmit = e => { e.preventDefault(); Snd.init(); const f = new FormData(e.target), m = f.get('mode'); begin({ mode: m === 'coop' ? 'coop' : 'solo', human: m === 'coop' ? 'wesley' : m, guided: f.get('night') === 'first' }); };
  $('#startRules').onclick = rules;
}
function rules() {
  const html = '<h4>The night</h4><p>Each round both heroes take a turn, then the haunt moves. A round is 10 minutes. At midnight the cellar opens and the night is lost. It is also lost if both heroes are collapsed at once.</p>' +
    '<h4>Your turn</h4><ul><li>You have 2 actions. Click things on the board, use the buttons, or press the key shown on each button.</li><li><b>The helper card</b> beside your hero lists everything you can do and marks one thing worth trying. Turn it off with the Helper button if you would rather find your own way.</li><li><b>Roll to move</b>: 1–2 moves up to 4, 3–4 up to 5, 5–6 up to 6. Click a lit space or drag the miniature. Stairs link the floors.</li><li><b>Search</b> furniture from a space beside it. Each piece can be searched once. Some hide clues, some hide supplies.</li><li><b>Help your partner</b> from beside him: revive, free from a trap, snap out of possession, steady his nerves, hand over an item.</li><li><b>Hide</b> on a draped space: nothing can touch or see you until your next turn.</li></ul>' +
    '<h4>Cards</h4><p>Each hero has three cards, done in order: find something, lift the blocked route together, then use what you found. The shared lift needs both heroes beside it, one action each, and it counts for both even if one of you has not finished card I. When both sets are done, the Master Key appears. Unlock the front door from the mat and walk both heroes out.</p>' +
    '<h4>The haunt</h4><ul><li><b>Lil\'</b> drifts 1 space toward the nearest hero, then rolls. She passes through walls. Ending within 2 spaces of her adds 1 Fright; ending beside her costs a heart. On a 6 she possesses the nearest hero on her floor.</li><li><b>Possession</b>: the possessed hero acts last, and Lil\' spends his first action on sabotage: dropping his end of a lift, throwing an item, or turning on his partner. Snap him out of it first and nothing happens. Either way she shows you a memory, worth 1 Insight.</li><li><b>The Hollow</b> turns and steps by his die. Anyone standing in the pale cone in front of him when the haunt ends gains 1 Fright. Forced Gaze gives 2 to the nearest hero he can see. Whenever a hero loses a heart, he walks 2 spaces toward them.</li><li><b>Fright</b> at 5: lose an action next turn, then reset to 2.</li><li><b>Entity Traps</b> creep 1 space toward anyone within 5. <b>The record player</b> counts 3, 2, 1, then throws anyone within 2 spaces and takes a heart. <b>The Weeping Doll</b> adds 1 Fright within 2 spaces.</li></ul>' +
    '<h4>Brock and Wesley</h4><ul><li><b>Brock, Protection</b>: when Wesley would lose a heart, Brock may appear beside him and take it. It costs 1 action, from this turn or his next. Once a round.</li><li><b>Wesley, Insight</b>: spend 1 to reroll any die, including the haunt\'s. Spend 2 to Deduce a thinking task instantly. Clues and Lil\'s memories give Insight.</li><li><b>Bond</b> grows when they help each other and finish cards. At 3, ending a turn side by side removes 1 Fright from each. At 6, Protection is free and help reaches 2 spaces.</li></ul>';
  showCard({ kind: 'story', cls: 'rules', title: 'How to Play', sub: 'Rules of the house', html }, [{ label: 'Close', value: true }]);
}
$('#btnRules').onclick = rules;
$('#btnGuide').onclick = e => { V.guideOn = !V.guideOn; e.target.textContent = 'Helper: ' + (V.guideOn ? 'on' : 'off'); if (!V.guideOn) V.star = null; if (V.input) { V.input.sug = -1; renderGuide(); } };
$('#btnNotes').onclick = () => openNotes();
$('#skip').onclick = skipIntro;
$('#btnSound').onclick = e => { Snd.on = !Snd.on; if (Snd.on) Snd.init(); e.target.textContent = 'Sound: ' + (Snd.on ? 'on' : 'off'); };
$('#btnPace').onclick = e => { V.pace = V.pace === 1 ? 0.5 : 1; e.target.textContent = 'Pace: ' + (V.pace === 1 ? 'steady' : 'brisk'); };
$('#btnNew').onclick = async () => { if (demo) return; if (!$('#modal').hidden) return; const v = await showCard({ kind: 'ask', title: 'Leave this night?', sub: 'New night', text: 'The board will be reset and this night forgotten.' }, [{ label: 'Keep playing', value: false }, { label: 'New night', value: true, alt: true }]); if (v) startScreen(); };
document.addEventListener('pointerdown', () => Snd.init(), { once: true });

function fit() {
  const st = $('#stage'), wide = window.innerWidth > 1020, w = st.clientWidth, h = wide ? st.clientHeight : 1e9;
  R.resize(Math.max(240, Math.floor(Math.min(w, h * R.BW / R.BH))));
  placeGuide();
}
let fitT = 0; window.addEventListener('resize', () => { clearTimeout(fitT); fitT = setTimeout(fit, 80); });
let hintT = 0;
function frame() {
  V.t = now();
  if (S) { try { R.render(S, V); } catch (err) { if (!frame.err) { frame.err = true; console.error(err); } } if (V.t - hintT > 0.15) { hintT = V.t; updateHint(); } }
  V.fx = V.fx.filter(f => V.t - f.t0 < f.dur); V.rings = V.rings.filter(r => V.t - r.t0 < r.dur); V.beams = V.beams.filter(b => V.t - b.t0 < b.dur); V.bubbles = V.bubbles.filter(b => b.until > V.t);
  requestAnimationFrame(frame);
}
function boot() {
  ['#dieHero', '#dieGhost', '#dieHollow', '#bigdie .die'].forEach(s => buildDie($(s))); buildHaunt(); notesLoad();
  startScreen(); fit(); requestAnimationFrame(frame);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => R.drawStatic());
  if (location.hash === '#auto') { auto = true; V.pace = 0.5; begin({ mode: 'auto', guided: true }); }
}
window.HWUI = { begin, state: () => S, view: V };
if (window.claude && window.claude.hot && window.claude.hot.ready) window.claude.hot.ready(boot); else boot();
})();
