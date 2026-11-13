// Targeted rule checks. Each test builds a position by hand and drives the engine with scripted answers.
const path = require('path');
require(path.join(__dirname, '..', 'src', 'engine.js'));
const HW = globalThis.HW;
let pass = 0, fail = 0;
function ok(cond, name) { if (cond) { pass++; console.log('  ok   ' + name); } else { fail++; console.log('  FAIL ' + name); process.exitCode = 1; } }

// Drive until `until(ev, S)` is true or the game ends. `on` answers input/chooseMove/ask events.
function mk(opts, prep) {
  const S = HW.newGame(Object.assign({ mode: 'coop', guided: false, seed: 42, deal: { brock: 'portrait', wesley: 'cipher', coop: 'A' } }, opts));
  if (prep) prep(S);
  const gen = HW.game(S); const log = [];
  let res = gen.next();
  return {
    S, log,
    run(on, until, max) {
      let n = 0;
      while (!res.done && n++ < (max || 5000)) {
        const ev = res.value; log.push(ev);
        if (until && until(ev, S)) return ev;
        let ans; if (ev.t === 'input' || ev.t === 'chooseMove' || ev.t === 'ask') ans = on(ev, S);
        res = gen.next(ans);
      }
      return null;
    },
    step(ans) { res = gen.next(ans); },
  };
}
const end = { type: 'end' };
const at = (e, f, c, r) => Object.assign(e, { f, c, r });

console.log('Protection outside Brock\'s turn costs an action from his next turn');
{
  const g = mk({}, S => { at(S.heroes.brock, 'G', 7, 5); at(S.heroes.wesley, 'G', 11, 6); at(S.ghost, 'G', 12, 6); S.forceDice = [5, 4]; });
  let asked = null, brockActions = [];
  g.run((ev, S) => {
    if (ev.t === 'ask' && ev.kind === 'protect') { asked = ev; return true; }
    if (ev.t === 'input') { if (ev.hero === 'brock') brockActions.push(S.heroes.brock.actions); return end; }
  }, (ev, S) => ev.t === 'round' && ev.n === 3);
  const b = g.S.heroes.brock, w = g.S.heroes.wesley;
  ok(asked && asked.own === false, 'Brock is offered the intercept during the haunt');
  ok(b.hearts === 3 && w.hearts === 3, 'Brock loses the heart, Wesley does not');
  ok(Math.abs(b.c - w.c) + Math.abs(b.r - w.r) === 1 && b.f === w.f, 'Brock has teleported beside Wesley and stays there');
  ok(brockActions[0] === 2 && brockActions[1] === 1, 'Brock has 2 actions in round 1 and only 1 in round 2 (' + brockActions.slice(0, 2) + ')');
  ok(g.S.bond >= 1, 'Protection raises Bond');
}

console.log('Protection is once per round, and declined hits land on Wesley');
{
  const g = mk({}, S => { at(S.heroes.brock, 'G', 7, 5); at(S.heroes.wesley, 'G', 11, 6); at(S.ghost, 'G', 12, 6); S.forceDice = [5, 4]; });
  g.run(ev => (ev.t === 'ask' ? false : end), ev => ev.t === 'round' && ev.n === 2);
  ok(g.S.heroes.wesley.hearts === 2 && g.S.heroes.brock.hearts === 4, 'Declining lets the chill land on Wesley');
}

console.log('Possession sabotage: a carried item is thrown, stays on the board, and can be recovered');
{
  const g = mk({}, S => { const w = S.heroes.wesley; at(w, 'G', 9, 5); at(S.heroes.brock, 'G', 3, 6); w.possessed = true; w.inv.push('cipher'); w.got = true; at(S.ghost, 'U', 16, 2); S.ghost.entranced = 9; S.traps = []; });
  let order = [], thrown = null, wesActions = null;
  g.run((ev, S) => {
    if (ev.t === 'input') { order.push(ev.hero); if (ev.hero === 'wesley' && wesActions == null) { wesActions = S.heroes.wesley.actions; thrown = S.ground.find(x => x.item === 'cipher'); return { type: 'move' }; } return end; }
    if (ev.t === 'chooseMove') return ev.tiles.find(t => thrown && HW.same(t, thrown)) || null;
  }, ev => ev.t === 'phase');
  ok(order[0] === 'brock', 'The un-possessed partner acts first');
  ok(!!thrown, 'The Cipher Page lands on a board space');
  ok(wesActions === 1, 'Sabotage spends one of the possessed hero\'s actions');
  ok(!g.S.heroes.wesley.possessed, 'Possession ends after one sabotage');
  ok(g.S.heroes.wesley.inv.includes('cipher') && !g.S.ground.length, 'Walking over the thrown item picks it back up');
}

console.log('Snapping a partner out prevents the sabotage');
{
  const g = mk({}, S => { const w = S.heroes.wesley; at(w, 'G', 9, 5); at(S.heroes.brock, 'G', 9, 6); w.possessed = true; w.inv.push('cipher'); w.got = true; S.ghost.entranced = 9; });
  g.run((ev, S) => { if (ev.t === 'input') { if (ev.hero === 'brock') { const o = HW.options(S, S.heroes.brock).find(x => x.help === 'snap'); if (o && S.heroes.wesley.possessed) return o; } return end; } }, ev => ev.t === 'phase');
  ok(!g.S.heroes.wesley.possessed && g.S.heroes.wesley.inv.includes('cipher') && !g.S.ground.length, 'Wesley is freed and keeps his item');
  ok(g.S.bond === 1, 'Snapping out raises Bond');
}

console.log('A recovered item can be handed back by the partner');
{
  const g = mk({}, S => { at(S.heroes.wesley, 'G', 9, 5); at(S.heroes.brock, 'G', 9, 6); S.heroes.brock.inv.push('cipher'); S.ghost.entranced = 9; });
  g.run((ev, S) => { if (ev.t === 'input') { const o = HW.options(S, S.heroes[ev.hero]).find(x => x.type === 'give' && x.item === 'cipher'); return ev.hero === 'brock' && o ? o : end; } }, ev => ev.t === 'phase');
  ok(g.S.heroes.wesley.inv.includes('cipher') && g.S.heroes.wesley.got, 'Handing it over completes Wesley\'s first card');
}

console.log('Showcase: the staged possession, the dropped cabinet, and the recovery');
{
  const g = mk({ guided: true }, S => { at(S.heroes.brock, 'G', 10, 1); at(S.heroes.wesley, 'G', 10, 2); });
  const lift = (S, id) => HW.options(S, S.heroes[id]).find(x => x.type === 'lift');
  let phase = 0;
  g.run((ev, S) => {
    if (ev.t !== 'input') return ev.t === 'ask' ? false : null;
    if (ev.hero === 'brock' && phase === 0) { phase = 1; return lift(S, 'brock'); }
    if (ev.hero === 'wesley' && phase === 1) { phase = 2; return lift(S, 'wesley'); } // lifts with a possessed partner
    return end;
  }, ev => ev.t === 'phase');
  ok(g.log.some(e => e.t === 'fx' && e.kind === 'possess'), 'Taking the first end triggers the scripted possession');
  ok(g.log.some(e => e.t === 'fx' && e.kind === 'slam') && !g.S.coopDone, 'The possessed holder drops his end on the lift attempt');
  ok(g.S.heroes.wesley.hearts === 2, 'The lifter is hurt and the action is spent');
  ok(!g.S.heroes.brock.possessed && !g.S.heroes.brock.holding, 'Possession is spent after the one sabotage');
  phase = 10;
  g.run((ev, S) => { if (ev.t !== 'input') return ev.t === 'ask' ? false : null; const o = lift(S, ev.hero); return o && !S.coopDone ? o : end; }, (ev, S) => ev.t === 'phase' && S.round === 2);
  ok(g.S.coopDone, 'They recover: the next clean lift succeeds');
  ok(HW.reach(g.S, g.S.heroes.brock, 3).tiles.some(t => t.c === 12), 'The passage beyond the cabinet is now open');
}

console.log('Showcase recovery by snapping out first');
{
  const g = mk({ guided: true }, S => { at(S.heroes.brock, 'G', 10, 1); at(S.heroes.wesley, 'G', 10, 2); });
  g.run((ev, S) => {
    if (ev.t !== 'input') return ev.t === 'ask' ? false : null;
    const O = HW.options(S, S.heroes[ev.hero]);
    if (ev.hero === 'wesley') return O.find(x => x.help === 'snap') || (S.heroes.brock.holding ? O.find(x => x.type === 'lift') : end) || end;
    return S.heroes.brock.holding ? end : O.find(x => x.type === 'lift') || end;
  }, (ev, S) => S.coopDone);
  ok(g.S.coopDone && g.S.heroes.wesley.hearts === 3, 'Snap out, then lift: no one is hurt');
}

console.log('Early help on the shared card earns credit, and the chain stays in order');
{
  const g = mk({}, S => { at(S.heroes.brock, 'G', 10, 1); at(S.heroes.wesley, 'G', 10, 2); S.ghost.entranced = 9; });
  g.run((ev, S) => { if (ev.t === 'input') return HW.options(S, S.heroes[ev.hero]).find(x => x.type === 'lift') || end; }, (ev, S) => S.coopDone);
  const w = g.S.heroes.wesley;
  ok(g.S.coopDone && HW.stepOf(g.S, w) === 'find', 'Lifted before either first card: both get credit, and card I is still next');
  w.inv.push('cipher'); w.got = true;
  ok(HW.stepOf(g.S, w) === 'use', 'After card I, the hero goes straight to card III');
  const g2 = mk({}, S => { const h = S.heroes.wesley; at(h, 'G', 2, 7); h.inv.push('cipher'); h.got = true; });
  const o = HW.options(g2.S, g2.S.heroes.wesley).find(x => x.type === 'work');
  ok(o && o.disabled, 'Card III cannot be worked before the shared card is done');
}

console.log('Thinking tasks, Deduction and rewards');
{
  const g = mk({}, S => { const h = S.heroes.wesley; at(h, 'G', 12, 7); at(S.heroes.brock, 'G', 7, 7); h.inv.push('cipher'); h.got = true; S.coopDone = true; S.insight = 2; S.ghost.entranced = 9; });
  g.run((ev, S) => { if (ev.t === 'input') return (ev.hero === 'wesley' && HW.options(S, S.heroes.wesley).find(x => x.type === 'deduce')) || end; }, ev => ev.t === 'phase');
  ok(g.S.heroes.wesley.useDone && g.S.insight === 2, 'Deduce solves the strongbox from across the house (2 spent, 2 gained from the letters)');
  const g2 = mk({ deal: { brock: 'clock', wesley: 'lullaby', coop: 'B' } }, S => { const b = S.heroes.brock, w = S.heroes.wesley; at(b, 'G', 8, 4); at(w, 'U', 16, 4); b.inv.push('windkey'); b.got = true; w.inv.push('record'); w.got = true; S.coopDone = true; S.time += 60; S.ghost.entranced = 9; });
  const t0 = g2.S.time;
  g2.run((ev, S) => { if (ev.t === 'input') return HW.options(S, S.heroes[ev.hero]).find(x => x.type === 'work' && !x.disabled) || end; }, ev => ev.t === 'phase');
  ok(g2.S.heroes.brock.useDone && g2.S.time === t0 - 30, 'Winding the clock takes 2 actions and turns the night back 30 minutes');
  ok(g2.S.heroes.wesley.useDone && g2.S.record.calmed, 'Playing the lullaby calms the record player');
  ok(g2.S.key.state === 'hatch', 'Both chains done reveals the Master Key');
}

console.log('Traps, collapse and revival');
{
  const g = mk({}, S => { at(S.heroes.wesley, 'G', 5, 1); at(S.heroes.brock, 'G', 4, 2); S.ghost.entranced = 9; S.traps = [{ id: 0, f: 'G', c: 4, r: 1, dormant: 0, holding: null }]; });
  g.run((ev, S) => { if (ev.t === 'input') return ev.hero === 'wesley' && !S.heroes.wesley.trapped ? { type: 'move' } : end; if (ev.t === 'chooseMove') return ev.tiles.find(t => t.trap) || null; }, ev => ev.t === 'turnend' && ev.hero === 'wesley');
  ok(g.S.heroes.wesley.trapped, 'Stepping onto the Entity Trap immobilises the hero');
  ok(!HW.options(g.S, g.S.heroes.wesley).some(x => x.type === 'move'), 'A trapped hero has no move action');
  g.run((ev, S) => { if (ev.t === 'input') return HW.options(S, S.heroes[ev.hero]).find(x => x.help === 'free') || end; }, (ev, S) => ev.t === 'round' && ev.n === 3);
  ok(!g.S.heroes.wesley.trapped, 'His partner frees him from an adjacent space');
  const g2 = mk({}, S => { const w = S.heroes.wesley; at(w, 'G', 9, 5); at(S.heroes.brock, 'G', 9, 6); w.hearts = 0; w.down = true; S.ghost.entranced = 9; });
  g2.run((ev, S) => { if (ev.t === 'input') return HW.options(S, S.heroes[ev.hero]).find(x => x.help === 'revive') || end; }, ev => ev.t === 'phase');
  ok(!g2.S.heroes.wesley.down && g2.S.heroes.wesley.hearts === 1, 'A collapsed hero is revived with 1 heart');
}

console.log('Endings');
{
  const g = mk({}, S => { S.time = 23 * 60 + 50; S.scenes.c22 = S.scenes.c23 = true; S.ghost.entranced = 9; });
  const e = g.run(() => end, ev => ev.t === 'end');
  ok(e && e.result.result === 'midnight', 'Midnight ends the night');
  const g2 = mk({}, S => { const b = S.heroes.brock, w = S.heroes.wesley; at(b, 'G', 7, 5); at(w, 'G', 11, 6); b.hearts = 0; b.down = true; w.hearts = 1; at(S.ghost, 'G', 12, 6); S.forceDice = [5, 4]; });
  const e2 = g2.run(() => end, ev => ev.t === 'end');
  ok(e2 && e2.result.result === 'taken', 'Both heroes down ends the night');
  const g3 = mk({}, S => { const b = S.heroes.brock, w = S.heroes.wesley; at(b, 'G', 9, 7); at(w, 'G', 10, 7); b.inv.push('masterkey'); S.key.state = 'held'; S.coopDone = true; b.got = w.got = b.useDone = w.useDone = true; S.ghost.entranced = 9; });
  const e3 = g3.run((ev, S) => { if (ev.t === 'input') { const O = HW.options(S, S.heroes[ev.hero]); return O.find(x => x.type === 'unlock' && !x.disabled) || (S.door.open ? { type: 'move' } : end); } if (ev.t === 'chooseMove') return ev.tiles.find(t => t.exit) || null; }, ev => ev.t === 'end');
  ok(e3 && e3.result.result === 'escaped', 'Unlocking the door and walking both heroes out wins');
  const g4 = mk({}, S => { const b = S.heroes.brock, w = S.heroes.wesley; at(b, 'G', 9, 7); at(w, 'G', 3, 6); w.hearts = 0; w.down = true; S.door.open = true; S.key.state = 'held'; S.ghost.entranced = 9; });
  let asked = false;
  const e4 = g4.run((ev) => { if (ev.t === 'input') return { type: 'move' }; if (ev.t === 'chooseMove') return ev.tiles.find(t => t.exit) || null; if (ev.t === 'ask' && ev.kind === 'abandon') { asked = true; return true; } }, ev => ev.t === 'end');
  ok(asked && e4 && e4.result.result === 'abandoned', 'Leaving a collapsed partner asks first, then gives the lonely ending');
}

console.log('What never moves: traps, the blue hand, the Weeping Doll');
{
  const trapAt = (f, c, r) => [{ id: 0, f, c, r, dormant: 0, holding: null }];
  const g = mk({}, S => { S.ghost.entranced = 99; });
  const before = JSON.stringify(g.S.traps.map(t => [t.f, t.c, t.r]));
  g.run(() => end, ev => ev.t === 'round' && ev.n === 6);
  ok(g.S.traps.length === 5 && JSON.stringify(g.S.traps.map(t => [t.f, t.c, t.r])) === before, 'Five Entity Traps are set out and none of them moves');

  const walkIn = (prep, protect) => {
    const x = mk({ deal: { brock: 'clock', wesley: 'lullaby', coop: 'B' } }, S => { at(S.heroes.wesley, 'U', 14, 4); at(S.heroes.brock, 'G', 3, 6); S.ghost.entranced = 99; at(S.hollow, 'U', 2, 7); S.forceDice = [4, 3]; if (prep) prep(S); });
    let moved = false;
    x.run((ev, S) => {
      if (ev.t === 'input') { if (ev.hero === 'wesley' && !moved) { moved = true; return { type: 'move' }; } return end; }
      if (ev.t === 'chooseMove') return ev.tiles.find(t => HW.inRec(S, t)) || null;
      if (ev.t === 'ask') return !!protect;
    }, ev => ev.t === 'turnend' && ev.hero === 'wesley');
    return x;
  };
  const a = walkIn(), w = a.S.heroes.wesley;
  ok(w.hearts === 2 && w.f === 'U' && w.c === HW.MARKS[2][0] && w.r === HW.MARKS[2][1], 'Coming within 2 spaces of the record player costs a heart and throws him to the rolled chalk mark');
  ok(a.log.some(e => e.t === 'die' && e.what === 'thrown to mark 3'), 'The throw is decided by a die roll');
  ok(a.log.some(e => e.t === 'chooseMove' && e.tiles.some(t => t.hand)), 'Spaces in the hand\'s reach are flagged before he chooses');
  const b = walkIn(S => { S.heroes.wesley.inv.push('record'); S.heroes.wesley.got = true; });
  ok(b.S.heroes.wesley.hearts === 3 && HW.inRec(b.S, b.S.heroes.wesley), 'Whoever carries Lil\'s Record is safe from the hand');
  const c = walkIn(null, true);
  ok(c.S.heroes.wesley.hearts === 3 && c.S.heroes.brock.hearts === 3 && HW.inRec(c.S, c.S.heroes.wesley), 'Brock can take the hand\'s grip for him, and then nobody is thrown');

  const d = mk({}, S => { at(S.heroes.wesley, 'U', 5, 4); at(S.heroes.brock, 'G', 3, 6); S.ghost.entranced = 99; at(S.ghost, 'G', 17, 7); at(S.hollow, 'U', 16, 7); S.hollow.dir = 1; S.traps = []; S.forceDice = [4, 4, 4, 4]; });
  let n = 0; const fr = [];
  d.run((ev, S) => {
    if (ev.t === 'input') { if (ev.hero !== 'wesley') return end; fr.push(S.heroes.wesley.fright); return n++ < 4 ? { type: 'move' } : end; }
    if (ev.t === 'chooseMove') { const inside = HW.inDoll(S, S.heroes.wesley); return ev.tiles.find(t => t.c <= 5 && t.f === 'U' && HW.inDoll(S, t) !== inside) || null; }
  }, ev => ev.t === 'round' && ev.n === 3);
  ok(fr[1] === 1, 'Coming within 2 spaces of the Weeping Doll gives 1 Fright at once (' + fr + ')');
  ok(fr[2] === 1 && fr[3] === 2, 'She frightens a hero once a round, and again the next round');
  const e = mk({}, S => { at(S.heroes.wesley, 'U', 5, 4); S.ghost.entranced = 99; S.traps = []; });
  const R = HW.reach(e.S, e.S.heroes.wesley, 5).tiles;
  ok(R.some(t => t.doll) && R.some(t => t.r === 1 && t.c === 5 && !t.doll), 'The board offers a way round the doll where there is one');

  const f = mk({}, S => { const w2 = S.heroes.wesley; at(w2, 'G', 11, 6); at(S.heroes.brock, 'G', 3, 6); w2.possessed = true; w2.inv.push('cipher'); w2.got = true; S.traps = trapAt('G', 10, 5); at(S.ghost, 'U', 16, 2); S.ghost.entranced = 99; });
  f.run(() => end, ev => ev.t === 'phase');
  ok(f.S.heroes.wesley.trapped && f.S.heroes.wesley.inv.includes('cipher'), 'A possessed hero near a trap is walked into it');
}

console.log('The hunt: card I names a room, and the tokens decide the rest');
{
  let bad = 0;
  for (const a of Object.keys(HW.CHAINS)) for (const b of Object.keys(HW.CHAINS)) for (let seed = 1; seed < 40; seed++) {
    if (a === b) continue;
    const S = HW.newGame({ guided: false, seed, deal: { brock: a, wesley: b, coop: seed % 2 ? 'A' : 'B' } });
    const L = Object.values(S.loot), n = k => L.filter(x => x.k === k).length;
    if (L.length !== 15 || n('chain') !== 2 || n('clue') !== 3 || n('loot') !== 8 || n('scare') !== 2) bad++;
    for (const id of [a, b]) { const ch = HW.CHAINS[id], holder = Object.keys(S.loot).find(o => S.loot[o].item === ch.item); if (!HW.roomPieces(S, ch.room).some(o => o.id === holder)) bad++; }
  }
  ok(bad === 0, 'Every night has 15 tokens: 2 objective items in their own rooms, 8 items, 3 lore, 2 cold hands');
  let brainless = 0; for (let seed = 1; seed < 300; seed++) { const S = HW.newGame({ guided: false, seed }); if (!HW.CHAINS[S.deal.brock].brain && !HW.CHAINS[S.deal.wesley].brain) brainless++; }
  ok(brainless === 0, 'Every shuffled deal includes a thinking task for Wesley\'s Deduction');
  const g = mk({ guided: true }, S => { at(S.heroes.wesley, 'G', 15, 4); at(S.heroes.brock, 'G', 3, 6); S.ghost.entranced = 99; });
  const l0 = HW.locate(g.S, 'cipher');
  ok(l0.where === 'room' && l0.room === 'Study' && l0.objs.length === 3, 'Before any search the Cipher Page is known only to be in the Study');
  g.run((ev, S) => { if (ev.t === 'input') return (ev.hero === 'wesley' && HW.options(S, S.heroes.wesley).find(x => x.type === 'search' && x.obj === 'desk')) || end; }, ev => ev.t === 'turnend' && ev.hero === 'wesley');
  ok(!g.S.heroes.wesley.got && g.S.clues.lucien && HW.locate(g.S, 'cipher').objs.length === 2, 'A wrong token still gives something (here, lore), and narrows the hunt');
  ok(g.S.insight === 3, 'Wesley starts with 2 Insight, and lore gives him 1 more');
}

console.log('Found items: the Lucky Sixpence and the Pouch of Salt');
{
  const g = mk({}, S => { S.insight = 4; S.ghost.entranced = 99; S.forceDice = [1, 6]; });
  let offered = null;
  g.run((ev) => { if (ev.t === 'input') return ev.hero === 'brock' ? { type: 'move' } : end; if (ev.t === 'chooseMove') { offered = ev.canReroll; return null; } }, ev => ev.t === 'turnend' && ev.hero === 'brock');
  ok(offered === false, 'Insight no longer rerolls dice');
  const g2 = mk({}, S => { S.heroes.wesley.inv.push('sixpence'); S.ghost.entranced = 99; S.forceDice = [1, 6]; });
  const rolls = [];
  g2.run((ev) => { if (ev.t === 'input') return ev.hero === 'brock' && !rolls.length ? { type: 'move' } : end; if (ev.t === 'chooseMove') { rolls.push(ev.roll); return ev.canReroll ? { reroll: true } : null; } }, ev => ev.t === 'turnend' && ev.hero === 'brock');
  ok(rolls.join() === '1,6' && !g2.S.heroes.wesley.inv.includes('sixpence'), 'The Lucky Sixpence rerolls one die for either hero and is discarded');
  const g3 = mk({}, S => { at(S.heroes.brock, 'G', 9, 5); at(S.heroes.wesley, 'G', 3, 6); at(S.ghost, 'G', 11, 5); S.heroes.brock.inv.push('salt'); S.traps = []; S.forceDice = [1]; });
  g3.run((ev, S) => { if (ev.t === 'input') return (ev.hero === 'brock' && HW.options(S, S.heroes.brock).find(x => x.item === 'salt')) || end; if (ev.t === 'ask') return false; }, ev => ev.t === 'round' && ev.n === 2);
  ok(g3.S.ghost.c === 11 && g3.S.ghost.r === 5 && g3.S.heroes.brock.hearts === 4 && !g3.S.heroes.brock.inv.includes('salt'), 'The Pouch of Salt holds Lil\' where she stands for one haunt');
}

console.log('Modes');
{
  ok(HW.newGame({ mode: 'solo', human: 'wesley' }).heroes.brock.npc && !HW.newGame({ mode: 'solo', human: 'wesley' }).heroes.wesley.npc, 'Solo as Wesley: Brock is the companion');
  ok(HW.newGame({ mode: 'solo', human: 'brock' }).heroes.wesley.npc, 'Solo as Brock: Wesley is the companion');
  const c = HW.newGame({ mode: 'coop' }); ok(!c.heroes.brock.npc && !c.heroes.wesley.npc, 'Two players: both heroes are human');
  const s = HW.newGame({ guided: true }); ok(s.deal.wesley === 'cipher' && s.deal.brock === 'portrait' && s.deal.coop === 'A', 'First Night uses the set deal');
}
console.log(`\n${pass} passed, ${fail} failed`);
