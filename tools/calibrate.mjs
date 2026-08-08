/**
 * Search the difficulty curve for targets that produce the win rates we want.
 *
 * The first pass at targets was derived from an achievable-median measurement
 * plus an assumed "growth" factor for shop items. Simulated playthroughs then
 * showed optimal play winning only ~17% — the assumption was wrong, so this
 * tool tunes against measured win rates instead of a model.
 *
 * Goal: optimal play usually wins, decent play is a coin flip, clueless loses.
 *
 * Usage: node tools/calibrate.mjs [runs-per-eval]
 */
import { freshState } from './harness.mjs';
import {
  createGameState, calculatePhaseScore, finishPhase,
} from '../src/lib/engine/engine.js';
import { ALL_PHASES, CAMPAIGN_MATCHES, FORMATIONS } from '../src/lib/engine/data.js';

const RUNS = Number(process.argv[2] || 60);

// Optimal play is deterministic here (best formation, best phase every time),
// so its win rate is a step function — it's 100% for any reachable target and
// 0% past it. Asking for 88% was unreachable by construction. What we actually
// want is: perfect play reliably wins, a decent player wins about half the
// time, and careless play almost never does. The decent rate is the real knob.
const GOAL = { optimal: 1.00, decent: 0.45, clueless: 0.04 };
const WEIGHT = { optimal: 1.0, decent: 3.0, clueless: 1.0 };

const pick = (ranked, skill) => {
  if (skill === 'optimal') return ranked[0];
  if (skill === 'decent') return ranked[Math.floor(Math.random() * Math.ceil(ranked.length / 2))];
  return ranked[Math.floor(Math.random() * ranked.length)];
};

// Play one round and return its score, independent of any target.
function roundScore(state, skill) {
  let st = { ...state, phaseIdx: 0, _carryoverChips: 0, momentum: 1.0 };
  const remaining = ALL_PHASES.map(p => p.id);
  const seq = [];
  let total = 0;

  for (let i = 0; i < 3; i++) {
    const ranked = remaining
      .map(id => ({ id, s: calculatePhaseScore(st.field, id, { ...st, pickedPhases: [...seq, id], phaseIdx: i }).score }))
      .sort((a, b) => b.s - a.s).map(x => x.id);
    const chosen = pick(ranked, skill);
    seq.push(chosen);
    remaining.splice(remaining.indexOf(chosen), 1);

    const ctx = { ...st, pickedPhases: seq, phaseIdx: i };
    const scored = calculatePhaseScore(st.field, chosen, ctx);
    total += scored.score;
    st = finishPhase({
      ...scored, phaseId: chosen, phaseIndex: i,
      field: scored.breakdown.map(r => ({ player: r.player, position: r.position })),
    }, ctx);
  }
  return total;
}

// Collect raw round scores per (match, round) so win rates can be evaluated
// against ANY candidate targets without re-simulating.
//
// Squad progression is modelled: an optimal/decent player banks morale from
// round wins and buys permanent upgrades, so later matches are played with a
// stronger squad. Sampling without this was the flaw in the first attempt —
// targets got tuned against a player who never improved, so a rising curve was
// unreachable by construction.
function progressionBuffs(skill, matchIdx) {
  if (skill === 'clueless') return [];              // never wins enough to shop
  // ~1 permanent upgrade per match cleared, weaker players buy fewer.
  const rate = skill === 'optimal' ? 1 : 0.5;
  const n = Math.floor(matchIdx * rate);
  // value is a BONUS FRACTION (matches SHOP_ITEMS.formation_tweak = 0.05).
  return Array.from({ length: n }, () => ({ type: 'formMult', value: 0.05 }));
}

// Formation is a CHOICE, not a dice roll. Sampling a random formation for every
// skill level was a modelling error: it capped "optimal" at the fraction of
// formations that happen to clear the target, which is why the win rate stuck at
// 50% no matter how low the targets went. A skilled player picks a strong shape.
function chooseFormation(skill) {
  const ranked = FORMATIONS.map(f => {
    const st = freshState(() => createGameState(), f.id, 0, 0);
    const s = ALL_PHASES
      .map(p => calculatePhaseScore(st.field, p.id, { ...st, pickedPhases: [p.id], phaseIdx: 0 }).score)
      .sort((a, b) => b - a);
    return { id: f.id, strength: s[0] + s[1] + s[2] };
  }).sort((a, b) => b.strength - a.strength);

  if (skill === 'optimal') return ranked[0].id;
  if (skill === 'decent') return ranked[Math.floor(Math.random() * Math.ceil(ranked.length / 2))].id;
  return ranked[Math.floor(Math.random() * ranked.length)].id;
}

function sampleScores(skill, runs) {
  const samples = CAMPAIGN_MATCHES.map(() => [[], [], []]);
  for (let i = 0; i < runs; i++) {
    const f = chooseFormation(skill);
    for (let m = 0; m < CAMPAIGN_MATCHES.length; m++) {
      const base = freshState(() => createGameState(), f, m, 0);
      for (let r = 0; r < 3; r++) {
        const st = { ...base, matchIdx: m, roundIdx: r, shopBuffs: progressionBuffs(skill, m) };
        for (const id of st.selectedIds) st.energy[id] = { max: 3, current: 3 };
        samples[m][r].push(roundScore(st, skill));
      }
    }
  }
  return samples;
}

// A match needs 2 of 3 rounds won; the campaign needs all 5 matches.
function winRate(samples, targets, runs) {
  let wins = 0;
  for (let i = 0; i < runs; i++) {
    let alive = true;
    for (let m = 0; m < CAMPAIGN_MATCHES.length && alive; m++) {
      let roundsWon = 0;
      for (let r = 0; r < 3; r++) {
        const pool = samples[m][r];
        // Draw a random sample rather than indexing by run number: `i % length`
        // correlated every match to the same sample position, so one unlucky
        // draw failed the whole campaign deterministically.
        const score = pool[Math.floor(Math.random() * pool.length)];
        if (score >= targets[m][r]) roundsWon++;
      }
      if (roundsWon < 2) alive = false;
    }
    if (alive) wins++;
  }
  return wins / runs;
}

console.log(`Calibrating targets against simulated play (${RUNS} runs per skill)\n`);
console.log('Sampling round scores...');
const samples = {
  optimal: sampleScores('optimal', RUNS),
  decent: sampleScores('decent', RUNS),
  clueless: sampleScores('clueless', RUNS),
};

// Targets are a FRACTION of what optimal play scores in that round, rising
// across the campaign. Deriving them as a percentile of the optimal
// distribution was degenerate: optimal play is deterministic, so its
// distribution has no spread and any percentile equalled the exact score, which
// the +250 ratchet then pushed out of reach. A fraction of the achievable score
// is both non-degenerate and directly interpretable ("the final asks for 82% of
// a perfect round").
const median = arr => {
  const s = [...arr].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
};

function buildTargets(startP, endP) {
  const flat = [];
  const steps = 15;
  for (let i = 0; i < steps; i++) {
    const m = Math.floor(i / 3), r = i % 3;
    const frac = startP + (endP - startP) * (i / (steps - 1));
    flat.push(Math.round(median(samples.optimal[m][r]) * frac / 250) * 250);
  }
  // Ratchet WITHIN each match only. A global ratchet was the second flaw in the
  // first attempt: match 3's tactics make it genuinely harder than match 4, so
  // forcing a globally rising line pushed match-3 targets above what any squad
  // could score. Rounds rise inside a tie; across ties, difficulty comes from
  // the percentile curve and the opponent's tactics.
  const out = [];
  for (let m = 0; m < 5; m++) {
    let floor = 0;
    out.push(flat.slice(m * 3, m * 3 + 3).map(v => {
      const x = Math.max(v, floor + 250); floor = x; return x;
    }));
  }
  return out;
}

let best = null;
for (let startP = 0.08; startP <= 0.70; startP += 0.02) {
  for (let endP = 0.30; endP <= 0.98; endP += 0.02) {
    if (endP <= startP) continue;
    const targets = buildTargets(startP, endP);
    const rates = {
      optimal: winRate(samples.optimal, targets, RUNS),
      decent: winRate(samples.decent, targets, RUNS),
      clueless: winRate(samples.clueless, targets, RUNS),
    };
    const err = Math.abs(rates.optimal - GOAL.optimal) * WEIGHT.optimal
              + Math.abs(rates.decent - GOAL.decent) * WEIGHT.decent
              + Math.abs(rates.clueless - GOAL.clueless) * WEIGHT.clueless;
    if (!best || err < best.err) best = { err, startP, endP, targets, rates };
  }
}

console.log(`\nBest curve: percentile ${best.startP.toFixed(2)} → ${best.endP.toFixed(2)}`);
console.log(`  optimal  ${(best.rates.optimal * 100).toFixed(1)}%  (goal ${GOAL.optimal * 100}%)`);
console.log(`  decent   ${(best.rates.decent * 100).toFixed(1)}%  (goal ${GOAL.decent * 100}%)`);
console.log(`  clueless ${(best.rates.clueless * 100).toFixed(1)}%  (goal ${GOAL.clueless * 100}%)`);

const ok = best.rates.optimal >= 0.95
        && best.rates.decent > 0.25 && best.rates.decent < 0.70
        && best.rates.clueless < 0.15;
console.log(ok ? '\n✓ within tolerance' : '\n⚠ outside tolerance — widen the search or revisit scoring');

console.log('\nPaste into CAMPAIGN_MATCHES:');
best.targets.forEach((t, m) => console.log(`  M${m + 1} targets:[${t.join(',')}]`));
