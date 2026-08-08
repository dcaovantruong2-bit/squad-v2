import { createGameState, calculatePhaseScore, calculateChips, detectSynergies, getPositionPenalty } from '../src/lib/engine/engine.js';
import { PLAYERS, FORMATIONS, ALL_PHASES } from '../src/lib/engine/data.js';
import { buildField } from './harness.mjs';


const f = '4-3-3';
let st = createGameState();
st.formation = f; st.matchIdx = 0; st.roundIdx = 0;
st.field = buildField(f);
st.selectedIds = st.field.map(e=>e.player.id);
for (const id of st.selectedIds) st.energy[id]={max:3,current:3};
st.pickedPhases = ['build_up']; st.phaseIdx = 0;

const r = calculatePhaseScore(st.field, 'build_up', st);
console.log('=== build_up, 4-3-3, fresh legs, match 1 round 1 (target 2000) ===');
console.log('contributors:');
for (const b of r.breakdown) console.log(`   ${b.position.padEnd(4)} ${b.player.name.padEnd(20)} base ${String(b.baseChips).padStart(3)} oop ${b.oopMult} energy ${b.energyMult} → ${b.contrib}`);
const playerChips = r.breakdown.reduce((a,b)=>a+b.contrib,0);
console.log(`\nplayerChips total: ${playerChips}`);
console.log('\nsynergies fired (' + r.synergies.length + '):');
let addMult=1, xMult=1, synChips=0;
for (const s of r.synergies) { console.log(`   ${s.id.padEnd(22)} chips+${s.chips} addMult+${s.addMult} xMult×${s.xMult}`); synChips+=s.chips; addMult+=s.addMult; xMult*=s.xMult; }
console.log('\nsquad (persistent) synergies fired:');
for (const s of r.squadSynergies) console.log(`   ${s.id.padEnd(22)} ${JSON.stringify(s.effect)}`);
console.log(`\nsynergyChips ${synChips}   addMult ${addMult}   xMult ${xMult.toFixed(3)}`);
console.log(`phaseMult ${r.phaseMult}  momentum ${r.momentum}  tacMult ${r.tacMult}`);
console.log(`\nFINAL SCORE ${r.score}  (target for this round: 2000) → ${(r.score/2000).toFixed(1)}x the WHOLE round target in ONE phase`);

console.log('\n=== ADD-MULT is the culprit? break it down ===');
console.log(`Additive mult sources: overload(+10 per... actually flat +10), defensive_duo(+8), midfield_engine(+8), covering_defender(+8)`);
console.log(`addMult starts at 1, so 1+10+8+8+8 = ${addMult} → multiplies EVERYTHING`);
console.log(`\nIf addMult were 1.0: score would be ~${Math.round(r.score/addMult)}`);

console.log('\n=== overload check: does it stack per duplicate pair? ===');
const byPos = {};
for (const e of st.field) { byPos[e.position]=(byPos[e.position]||0)+1; }
console.log('position counts on field:', byPos);
console.log('overload fires ONCE (breaks on first dup) regardless of how many dups — desc says "+15 mult each"');
