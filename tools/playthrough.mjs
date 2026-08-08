/**
 * Simulated playthroughs at three skill levels. Answers the question the audit
 * raised: is the campaign winnable by a good player and losable by a bad one?
 *
 * Usage: node tools/playthrough.mjs [runs]
 */
import { freshState } from './harness.mjs';
import {
  createGameState, calculatePhaseScore, finishPhase, finishRound, finishMatch,
} from '../src/lib/engine/engine.js';
import { ALL_PHASES, CAMPAIGN_MATCHES, FORMATIONS } from '../src/lib/engine/data.js';

const RUNS = Number(process.argv[2] || 200);

// Skill = how well the player picks phases.
//   optimal  — always the highest-scoring remaining phase (perfect knowledge)
//   decent   — picks from the top half
//   clueless — picks at random
const pick = (ranked, skill) => {
  if (skill === 'optimal') return ranked[0];
  if (skill === 'decent') return ranked[Math.floor(Math.random() * Math.ceil(ranked.length / 2))];
  return ranked[Math.floor(Math.random() * ranked.length)];
};

function playRound(state, skill) {
  let st = { ...state, roundScore: 0, phaseIdx: 0, phaseResults: [], _carryoverChips: 0, momentum: 1.0 };
  const remaining = ALL_PHASES.map(p => p.id);
  const seq = [];

  for (let i = 0; i < 3; i++) {
    const ranked = remaining
      .map(id => ({ id, score: calculatePhaseScore(st.field, id, { ...st, pickedPhases: [...seq, id], phaseIdx: i }).score }))
      .sort((a, b) => b.score - a.score)
      .map(x => x.id);
    const chosen = pick(ranked, skill);
    seq.push(chosen);
    remaining.splice(remaining.indexOf(chosen), 1);

    const ctx = { ...st, pickedPhases: seq, phaseIdx: i };
    const scored = calculatePhaseScore(st.field, chosen, ctx);
    st = finishPhase({
      ...scored, phaseId: chosen, phaseIndex: i,
      field: scored.breakdown.map(r => ({ player: r.player, position: r.position })),
    }, ctx);
  }
  return finishRound(st);
}

function playCampaign(skill, formationId) {
  let state = freshState(() => createGameState(), formationId, 0, 0);
  for (let m = 0; m < CAMPAIGN_MATCHES.length; m++) {
    state = { ...state, matchIdx: m, roundIdx: 0, roundResults: [], injured: [] };
    for (let r = 0; r < 3; r++) {
      state = { ...state, roundIdx: r };
      // fresh legs each round (the game restores energy between rounds)
      for (const id of state.selectedIds) state.energy[id] = { max: 3, current: 3 };
      const out = playRound(state, skill);
      state = out.state;
    }
    const res = finishMatch(state);
    state = res.state;
    if (!res.matchWon) return { won: false, failedAt: m + 1 };
  }
  return { won: true, failedAt: null };
}

console.log(`Simulated playthroughs (${RUNS} runs per skill level)\n`);
for (const skill of ['optimal', 'decent', 'clueless']) {
  let wins = 0;
  const failures = {};
  for (let i = 0; i < RUNS; i++) {
    const f = FORMATIONS[Math.floor(Math.random() * FORMATIONS.length)].id;
    const r = playCampaign(skill, f);
    if (r.won) wins++;
    else failures[r.failedAt] = (failures[r.failedAt] || 0) + 1;
  }
  const rate = ((wins / RUNS) * 100).toFixed(1);
  const where = Object.entries(failures)
    .sort((a, b) => a[0] - b[0])
    .map(([m, n]) => `M${m}:${n}`)
    .join(' ');
  console.log(`${skill.padEnd(9)} win rate ${rate.padStart(6)}%   failures by match → ${where || 'none'}`);
}
