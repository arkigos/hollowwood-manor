// Headless playtests: every objective deal, both co-op layouts, AI on both seats.
const path = require('path');
require(path.join(__dirname, '..', 'src', 'engine.js'));
const HW = globalThis.HW;

function run(opts, hook) {
  const S = HW.newGame(Object.assign({ mode: 'auto' }, opts));
  const gen = HW.game(S); let res = gen.next(), n = 0; const seen = {};
  while (!res.done) {
    const ev = res.value; let ans;
    seen[ev.t] = (seen[ev.t] || 0) + 1;
    if (ev.t === 'fx') seen['fx:' + ev.kind] = (seen['fx:' + ev.kind] || 0) + 1;
    if (ev.t === 'input') ans = HW.aiAct(S, S.heroes[ev.hero]);
    else if (ev.t === 'chooseMove') ans = HW.aiMove(S, S.heroes[ev.hero], ev);
    else if (ev.t === 'ask') ans = HW.aiAnswer(S, ev);
    if (hook) { const o = hook(ev, S, ans); if (o !== undefined) ans = o; }
    res = gen.next(ans);
    if (++n > 300000) throw new Error('runaway game ' + JSON.stringify(opts));
  }
  S.seen = seen; return S;
}

const chains = Object.keys(HW.CHAINS);
const N = +process.argv[2] || 150;
let total = 0, wins = 0; const causes = {}; const rows = []; const agg = {};
for (const a of chains) for (const b of chains) {
  if (a === b || (!HW.CHAINS[a].brain && !HW.CHAINS[b].brain)) continue; // every deal has one thinking task
  for (const coop of ['A', 'B']) {
    let w = 0, rounds = 0, stalled = 0; const c = {};
    for (let i = 0; i < N; i++) {
      const S = run({ guided: false, deal: { brock: a, wesley: b, coop }, seed: 1000 + i * 7919 });
      const r = S.over.result; c[r] = (c[r] || 0) + 1; causes[r] = (causes[r] || 0) + 1;
      if (r === 'escaped') { w++; rounds += S.round; }
      if (r === 'stalled') stalled++;
      total++; for (const k in S.seen) if (k.startsWith('fx:')) agg[k] = (agg[k] || 0) + S.seen[k]; agg.bond = (agg.bond || 0) + S.bond; agg.clues = (agg.clues || 0) + Object.keys(S.clues).length;
    }
    wins += w;
    rows.push(`${a.padEnd(9)}${b.padEnd(9)}${coop}  win ${(100 * w / N).toFixed(0).padStart(3)}%  avg rounds ${(rounds / Math.max(1, w)).toFixed(1).padStart(5)}  ${JSON.stringify(c)}`);
    if (!w) { console.error('DEAL NEVER WON:', a, b, coop); process.exitCode = 1; }
    if (stalled) { console.error('STALLED:', a, b, coop, stalled); process.exitCode = 1; }
  }
}
console.log(rows.join('\n'));
console.log('per game:', JSON.stringify(Object.fromEntries(Object.entries(agg).map(([k, v]) => [k, +(v / total).toFixed(2)]))));
console.log(`\nALL: ${wins}/${total} = ${(100 * wins / total).toFixed(1)}%`, causes);

// guided (showcase) deal
let gw = 0, sab = 0, snaps = 0;
for (let i = 0; i < N; i++) {
  let sawPossess = false;
  const S = run({ guided: true, seed: 5 + i * 31 }, ev => { if (ev.t === 'fx' && ev.kind === 'possess') sawPossess = true; });
  if (S.over.result === 'escaped') gw++;
  if (sawPossess) sab++;
  snaps += S.seen['fx:snap'] || 0;
}
console.log(`GUIDED: win ${(100 * gw / N).toFixed(0)}%, scripted possession seen in ${sab}/${N}, snap-outs ${snaps}`);
