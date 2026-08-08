/**
 * Balance measurement: what can a competent player actually score per round?
 *
 * Drives the real engine. For each match (which sets the opponent tactics) and
 * each formation, plays the best-scoring legal 3-phase sequence and reports the
 * round total. Used to set CAMPAIGN_MATCHES targets from measured reality
 * instead of guesses.
 *
 * Usage: node tools/balance.mjs
 */
import { freshState } from './harness.mjs';
import { calculatePhaseScore } from '../src/lib/engine/engine.js';
import { ALL_PHASES, CAMPAIGN_MATCHES, FORMATIONS } from '../src/lib/engine/data.js';

const FRESH = () => ({
  formation: '4-4-2', matchIdx: 0, roundIdx: 0,
  energy: {}, field: [], selectedIds: [], shopBuffs: [],
  pickedPhases: [], phaseIdx: 0, momentum: 1.0, _carryoverChips: 0,
});

// Best 3-phase sequence by exhaustive search over ordered triples (8*7*6=336),
// scoring each phase in sequence so combo chains and carryover apply. This is
// the ceiling a player reaches with perfect knowledge — targets should sit
// below it, not at it.
function bestRound(formationId, matchIdx, roundIdx) {
  const base = freshState(FRESH, formationId, matchIdx, roundIdx);
  let best = { total: -1, seq: [] };
  const ids = ALL_PHASES.map(p => p.id);

  for (const a of ids) for (const b of ids) for (const c of ids) {
    if (a === b || b === c || a === c) continue;
    const seq = [a, b, c];
    let st = { ...base, pickedPhases: seq, phaseIdx: 0, momentum: 1.0, _carryoverChips: 0 };
    let total = 0;
    for (let i = 0; i < 3; i++) {
      const r = calculatePhaseScore(st.field, seq[i], { ...st, phaseIdx: i });
      total += r.score;
      // carry momentum/carryover forward the way the real round does
      st = { ...st, _carryoverChips: r.carryoverNextPhase || 0,
             momentum: Math.min(1.3, (st.momentum || 1) + (r.score >= 0.15 * (CAMPAIGN_MATCHES[matchIdx].targets[roundIdx]) ? 0.1 : 0)) };
    }
    if (total > best.total) best = { total, seq };
  }
  return best;
}

console.log('Measured round ceilings (best 3-phase sequence, fresh legs, no shop items)\n');
const rows = [];
for (let m = 0; m < CAMPAIGN_MATCHES.length; m++) {
  for (let r = 0; r < 3; r++) {
    const per = FORMATIONS.map(f => ({ f: f.id, ...bestRound(f.id, m, r) }));
    per.sort((x, y) => y.total - x.total);
    const median = per[Math.floor(per.length / 2)].total;
    const target = CAMPAIGN_MATCHES[m].targets[r];
    rows.push({ m: m + 1, r: r + 1, target, median, ceiling: per[0].total, bestF: per[0].f });
    console.log(
      `M${m + 1} R${r + 1}  target ${String(target).padStart(6)}` +
      `  median ${String(median).padStart(6)}  ceiling ${String(per[0].total).padStart(6)} (${per[0].f})` +
      `  → median/target ${(median / target).toFixed(2)}x`
    );
  }
}

// The round ceiling is roughly flat across the campaign (~15-22k), because the
// squad doesn't grow — so difficulty has to come from the TARGET climbing as a
// share of what's achievable. A flat multiplier would make the final match
// easier than the first, which is exactly the bug the old targets had.
//
// This curve runs from "clears comfortably with a sensible XI" to "needs the
// right build, the right phases in the right order, and shop help".
// Measured with fresh legs and NO shop items. By the later matches the player
// has banked shop purchases (chip buffs, xMult, momentum) and knows the combo
// table, so real capability is above this baseline. GROWTH models that earned
// headroom; without it the curve plateaus and matches 3-5 feel identical.
const GROWTH = [1.00, 1.10, 1.22, 1.34, 1.46];

const DIFFICULTY = [
  [0.34, 0.44, 0.54],   // Group Stage — learn the systems
  [0.44, 0.54, 0.63],   // Round of 16
  [0.50, 0.60, 0.70],   // Quarter Final
  [0.56, 0.67, 0.78],   // Semi Final
  [0.63, 0.76, 0.88],   // THE FINAL — the last round should hurt
];

console.log('\nSuggested targets: median achievable x rising difficulty curve');
const out = [];
for (const row of rows) {
  const frac = DIFFICULTY[row.m - 1][row.r - 1];
  const capability = row.median * GROWTH[row.m - 1];
  const suggested = Math.round(capability * frac / 250) * 250;
  out.push(suggested);
  console.log(
    `M${row.m} R${row.r}: ${String(row.target).padStart(6)} → ${String(suggested).padStart(6)}` +
    `  (${(frac * 100).toFixed(0)}% of median ${row.median}, ceiling ${row.ceiling})`
  );
}
// Targets must never dip as the campaign advances. Raw measurement produces
// dips because match 3's tactics (high_press + counter_attack) bite harder than
// match 4's, so its achievable median is lower — correct per-match, wrong as a
// progression. A player reaching the semi-final after clearing 13000 would feel
// cheated by a 10000 target. Ratchet upward.
console.log('\nMonotonic pass (targets may only rise):');
let floor = 0;
const final = out.map(v => { const x = Math.max(v, floor + 250); floor = x; return x; });

console.log('\nPaste into CAMPAIGN_MATCHES:');
for (let m = 0; m < 5; m++) {
  console.log(`  M${m + 1} targets:[${final.slice(m * 3, m * 3 + 3).join(',')}]`);
}
