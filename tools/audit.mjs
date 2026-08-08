/**
 * Balance + data audit harness. Runs the REAL engine headlessly.
 * Usage: node tools/audit.mjs
 */
import {
  createGameState, autoFillSquad, autoRecommendFormation, calculateChips,
  getPositionPenalty, dealPhases, resolveCurrentPhase, finishRound, finishMatch,
  resetRound, detectSynergies, detectSquadSynergies, getSynergyGates,
  estimatePhaseChips, calculatePhaseScore, getPlayerById,
} from '../src/lib/engine/engine.js';
import {
  PLAYERS, FORMATIONS, ALL_PHASES, SYNERGIES, COMBO_CHAINS,
  CAMPAIGN_MATCHES, CHIPS_FORMULA, POSITION_ADJACENCY, TRAIT_SLOT_FIT,
} from '../src/lib/engine/data.js';
import { buildField } from './harness.mjs';

const line = (s='') => console.log(s);
const H = (s) => { line(); line('='.repeat(72)); line(s); line('='.repeat(72)); };


// ── 1. BALANCE: simulate campaign, greedy-optimal phase picks
function simMatch(matchIdx, formationId, strategy='greedy') {
  let st = createGameState();
  st.formation = formationId;
  st.matchIdx = matchIdx;
  st.field = buildField(formationId);
  st.selectedIds = st.field.map(e => e.player.id);
  for (const id of st.selectedIds) st.energy[id] = { max:3, current:3 };

  const rounds = [];
  for (let r = 0; r < 3; r++) {
    st.roundIdx = r;
    const dealt = dealPhases(5);
    // greedy: pick 3 by best estimated chips (a naive player's likely behaviour)
    let picks;
    if (strategy === 'greedy') {
      picks = [...dealt].sort((a,b) => estimatePhaseChips(st.field,b,st) - estimatePhaseChips(st.field,a,st)).slice(0,3);
    } else {
      picks = dealt.slice(0,3); // random-ish (dealt is already shuffled)
    }
    st.pickedPhases = picks; st.phaseIdx = 0; st.roundScore = 0; st.phaseResults = [];
    for (let p = 0; p < 3; p++) {
      const res = resolveCurrentPhase(st);
      st = res.state;
    }
    const target = CAMPAIGN_MATCHES[matchIdx].targets[r];
    const fr = finishRound(st);
    rounds.push({ score: fr.roundScore, target, won: fr.roundWon, ratio: fr.roundScore/target });
    st = fr.state;
    st = { ...st, roundIdx: r };
  }
  return rounds;
}

H('1. BALANCE — greedy play, per formation, 200 runs each');
line('ratio = roundScore / target.  1.0 = exactly on target.');
for (const f of FORMATIONS) {
  const acc = [[],[],[]];
  let matchWins = 0, N = 200;
  for (let n = 0; n < N; n++) {
    for (let m = 0; m < 5; m++) {
      const rs = simMatch(m, f.id);
      rs.forEach((r,i) => acc[i].push({ ...r, m }));
      if (rs.filter(r=>r.won).length >= 2) matchWins++;
    }
  }
  const all = acc.flat();
  const byMatch = [0,1,2,3,4].map(m => {
    const s = all.filter(x=>x.m===m);
    return (s.reduce((a,b)=>a+b.ratio,0)/s.length).toFixed(2);
  });
  const winRate = (all.filter(x=>x.won).length/all.length*100).toFixed(0);
  line(`${f.id.padEnd(8)} round-win ${winRate.padStart(3)}%  match-win ${(matchWins/(N*5)*100).toFixed(0).padStart(3)}%  mean ratio by match: ${byMatch.join('  ')}`);
}

H('2. TARGET vs ACHIEVABLE — single best-case phase score, match 5 round 3');
{
  const f = '4-2-3-1';
  let st = createGameState();
  st.formation = f; st.matchIdx = 4; st.roundIdx = 2;
  st.field = buildField(f);
  st.selectedIds = st.field.map(e=>e.player.id);
  for (const id of st.selectedIds) st.energy[id] = {max:3,current:3};
  st.pickedPhases = ['defensive_block','counter','set_piece']; st.phaseIdx = 0;
  let tot = 0;
  for (let i=0;i<3;i++){ const r = resolveCurrentPhase(st); tot += r.result.score; st = r.state; }
  line(`Fresh-legs 3-phase total (Def→Transition chain): ${tot}  vs target 14500  → ${(tot/14500).toFixed(2)}x`);
}

H('3. DEAD DATA — content that can never fire');
{
  // 3a. Synergies never gated in by ANY formation
  const everGated = new Set();
  for (const f of FORMATIONS) for (const id of getSynergyGates(f.id)) everGated.add(id);
  const posSyn = SYNERGIES.filter(s=>!s.persistent);
  const neverGated = posSyn.filter(s=>!everGated.has(s.id));
  line(`Position synergies never gated by any formation: ${neverGated.length ? neverGated.map(s=>s.id).join(', ') : 'none'}`);

  // 3b. Synergies gated but with NO detection branch in detectSynergies
  const handled = new Set(['clean_sheet','organised_defence','wingback_overlap','overload','stretch_backline','route_one','battering_ram','defensive_duo','back_three','midfield_engine','double_pivot','covering_defender','target_man_release','near_post_flick','one_two','overlap','set_piece_threat','trio']);
  const unhandled = posSyn.filter(s=>!handled.has(s.id));
  line(`Position synergies with no detection branch: ${unhandled.length ? unhandled.map(s=>s.id).join(', ') : 'none'}`);

  // 3c. per-formation gate counts
  for (const f of FORMATIONS) {
    const g = getSynergyGates(f.id);
    line(`  ${f.id.padEnd(8)} gates ${String(g.size).padStart(2)}/${posSyn.length}  [${[...g].join(' ')}]`);
  }

  // 3d. Phases unplayable per formation (slots not in formation)
  line();
  for (const f of FORMATIONS) {
    const slots = new Set([...f.slots,'GK']);
    const dead = ALL_PHASES.filter(ph => !ph.slots.some(s => Array.isArray(s) ? s.some(x=>slots.has(x)) : slots.has(s)));
    const partial = ALL_PHASES.filter(ph => {
      const need = ph.slots.flat();
      return need.some(s=>!slots.has(s)) && !dead.includes(ph);
    });
    line(`  ${f.id.padEnd(8)} fully dead phases: ${dead.map(p=>p.id).join(',')||'none'} | partial: ${partial.map(p=>p.id).join(',')||'none'}`);
  }

  // 3e. persistent synergies reachable? effects actually applied?
  line();
  const applied = new Set(['addChips']); // engine only reads eff.addChips
  for (const s of SYNERGIES.filter(x=>x.persistent)) {
    const keys = Object.keys(s.effect);
    const used = keys.some(k=>applied.has(k));
    line(`  ${s.id.padEnd(22)} effect{${keys.join(',')}}  ${used?'APPLIED':'*** NEVER APPLIED ***'}`);
  }
}

H('4. TRAIT / STAT DISTRIBUTION');
{
  const traitCount = {};
  for (const p of PLAYERS) for (const t of p.traits) traitCount[t] = (traitCount[t]||0)+1;
  line('trait counts: ' + Object.entries(traitCount).sort((a,b)=>b[1]-a[1]).map(([k,v])=>`${k}:${v}`).join('  '));
  const posCount = {};
  for (const p of PLAYERS) posCount[p.position] = (posCount[p.position]||0)+1;
  line('position counts: ' + Object.entries(posCount).sort((a,b)=>b[1]-a[1]).map(([k,v])=>`${k}:${v}`).join('  '));
  line(`total players: ${PLAYERS.length}`);
  // slots demanded across formations vs supply
  const demand = {};
  for (const f of FORMATIONS) for (const s of [...f.slots,'GK']) demand[s]=Math.max(demand[s]||0, f.slots.filter(x=>x===s).length + (s==='GK'?1:0));
  line('max simultaneous demand: ' + Object.entries(demand).map(([k,v])=>`${k}:${v}`).join('  '));
  // CAM supply check
  line(`CAM players: ${PLAYERS.filter(p=>p.position==='CAM').length} — only 4-2-3-1 uses a CAM slot`);
}

H('5. CHIPS CURVE — best/worst player value per slot');
for (const pos of Object.keys(CHIPS_FORMULA)) {
  const vals = PLAYERS.filter(p=>p.position===pos).map(p=>({n:p.name,c:calculateChips(p,pos)})).sort((a,b)=>b.c-a.c);
  if (!vals.length) { line(`${pos.padEnd(4)} (no native players)`); continue; }
  line(`${pos.padEnd(4)} best ${String(vals[0].c).padStart(3)} (${vals[0].n})  worst ${String(vals[vals.length-1].c).padStart(3)} (${vals[vals.length-1].n})  spread ${vals[0].c - vals[vals.length-1].c}`);
}

H('6. DATA INTEGRITY — description vs actual threshold mismatches');
for (const s of SYNERGIES) {
  const d = s.description || '';
  const t = s.trigger || {};
  const nums = (d.match(/\d+(\.\d+)?/g)||[]).map(Number);
  const tvals = [t.threshold, t.thresholdA, t.thresholdB, t.minCount, t.count].filter(v=>v!==undefined);
  const evals = Object.values(s.effect||{}).filter(v=>typeof v==='number');
  const claimed = new Set(nums);
  const actual = [...tvals, ...evals];
  const missing = actual.filter(v => !claimed.has(v));
  if (missing.length) line(`  ${s.id.padEnd(22)} desc "${d}" ← actual values not in desc: ${missing.join(', ')}`);
}

H('7. COMBO CHAIN COVERAGE');
{
  const tags = [...new Set(ALL_PHASES.map(p=>p.tag))];
  const missing = [];
  for (const a of tags) for (const b of tags) {
    const k = `${a}_${b}`;
    if (!COMBO_CHAINS[k]) missing.push(k);
  }
  line(`tags: ${tags.join(', ')}`);
  line(`chain keys defined: ${Object.keys(COMBO_CHAINS).length}, tag pairs possible: ${tags.length**2}`);
  line(`MISSING (fall through to x${0.95} penalty): ${missing.join(', ')||'none'}`);
  line(`Note "Specialist_Any" is a literal key — only matches a phase literally tagged "Any".`);
  const specialistPairs = tags.map(t=>`Specialist_${t}`).filter(k=>!COMBO_CHAINS[k]);
  line(`  → dead Specialist chains: ${specialistPairs.join(', ')}`);
  // fatigueRecovery effect handled?
  line(`Defensive_Defensive effect "fatigueRecovery" — engine only reads xMult/addChips → NEVER APPLIED`);
}

H('8. PHASE SLOT COVERAGE — how many of the 11 score per phase');
for (const ph of ALL_PHASES) {
  const per = FORMATIONS.map(f => {
    const field = buildField(f.id);
    const n = field.filter(e => ph.slots.some(s => Array.isArray(s)?s.includes(e.position):s===e.position)).length;
    return `${f.id}:${n}`;
  });
  line(`${ph.id.padEnd(16)} tag=${ph.tag.padEnd(11)} slots=${JSON.stringify(ph.slots).padEnd(30)} contributors ${per.join(' ')}`);
}
