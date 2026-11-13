const path=require('path');require(path.join(__dirname,'..','src','engine.js'));const HW=globalThis.HW;
const [a,b,coop,seed]=process.argv.slice(2);
const S=HW.newGame({mode:'auto',guided:false,deal:{brock:a,wesley:b,coop},seed:+seed||1000});
const gen=HW.game(S);let res=gen.next();
while(!res.done){const ev=res.value;let ans;
 if(ev.t==='input'){ans=HW.aiAct(S,S.heroes[ev.hero]);const h=S.heroes[ev.hero];console.log(`  [${ev.hero} @${h.f}${h.c},${h.r} a${h.actions} ♥${h.hearts} f${h.fright} step:${HW.stepOf(S,h)}${h.holding?' HOLD':''}] -> ${ans.type} ${ans.obj||ans.help||ans.item||''}`);}
 else if(ev.t==='chooseMove'){ans=HW.aiMove(S,S.heroes[ev.hero],ev);console.log(`     roll ${ev.roll} pts ${ev.pts} -> ${ans?ans.f+ans.c+','+ans.r:'stay'}`);}
 else if(ev.t==='ask')ans=HW.aiAnswer(S,ev);
 else if(ev.t==='round')console.log(`R${ev.n} ${HW.fmtTime(S.time)} bond ${S.bond} ins ${S.insight}`);
 else if(ev.t==='log')console.log('     · '+ev.text);
 else if(ev.t==='card')console.log('     # '+ev.card.title);
 res=gen.next(ans);}
console.log(S.over);
