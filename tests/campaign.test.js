import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createGameState,
  resolveCurrentPhase,
  resetRound,
  finishRound,
  finishMatch,
  playerPhaseContribution,
  swapFieldEntries,
  calculateChips,
  getPositionPenalty,
  getEnergyMultiplier,
} from '../src/lib/engine/engine.js';
import { PLAYERS, FORMATIONS, CAMPAIGN_MATCHES } from '../src/lib/engine/data.js';

function playableState() {
  const formation = FORMATIONS.find(f => f.id === '4-4-2');
  const field = formation.pitchLayout.map((slot, index) => ({
    player: PLAYERS[index],
    position: slot.pos,
  }));
  return {
    ...createGameState(),
    formation: '4-4-2',
    selectedIds: field.map(e => e.player.id),
    field,
    pickedPhases: ['goal_kick', 'build_up', 'wide_attack'],
  };
}

test('playerPhaseContribution counts slot positions and zeroes rest slots', () => {
  const state = playableState();
  const gkSlot = state.field[0]; // GK slot — goal_kick counts GK
  const cmSlot = state.field.find(e => e.position === 'CM');
  const expected = Math.round(
    calculateChips(gkSlot.player, gkSlot.position) *
    getPositionPenalty(gkSlot.player, gkSlot.position) *
    getEnergyMultiplier(gkSlot.player.id, state)
  );
  assert.equal(playerPhaseContribution(gkSlot.player, gkSlot.position, 'goal_kick', state), expected);
  // A CM doesn't count in goal_kick (GK/CB only) — that slot is a rest opportunity.
  assert.equal(playerPhaseContribution(cmSlot.player, cmSlot.position, 'goal_kick', state), 0);
});

test('swapFieldEntries is a pure permutation — XI stays complete, positions stay with slots', () => {
  const field = playableState().field;
  const swapped = swapFieldEntries(field, 0, 5);
  assert.equal(swapped.length, 11);
  assert.equal(swapped[0].player.id, field[5].player.id);
  assert.equal(swapped[5].player.id, field[0].player.id);
  assert.equal(swapped[0].position, field[0].position); // slot 0 keeps its position
  assert.equal(swapped[5].position, field[5].position);
  assert.equal(new Set(swapped.map(e => e.player.id)).size, 11); // no duplicates
  // Original is untouched
  assert.equal(field[0].player.id, playableState().field[0].player.id);
  // No-op cases
  assert.equal(swapFieldEntries(field, 2, 2), field);
  assert.equal(swapFieldEntries(field, 0, 99), field);
});

test('resolveCurrentPhase resolves the selected phase without mutating the three-phase plan', () => {
  const state = playableState();
  const resolved = resolveCurrentPhase(state);

  assert.equal(resolved.result.phaseId, 'goal_kick');
  assert.equal(resolved.state.phaseIdx, 1);
  assert.deepEqual(resolved.state.pickedPhases, state.pickedPhases);
  assert.equal(resolved.done, false);
  assert.ok(resolved.result.score >= 0);
});

test('resolveCurrentPhase completes after the third selected phase', () => {
  let state = playableState();
  state = resolveCurrentPhase(state).state;
  state = resolveCurrentPhase(state).state;
  const third = resolveCurrentPhase(state);

  assert.equal(third.state.phaseIdx, 3);
  assert.equal(third.done, true);
  assert.equal(third.state.phaseResults.length, 3);
});

test('first phase has no chain penalty and later phases use their actual predecessor', () => {
  const state = playableState();
  const first = resolveCurrentPhase(state);
  assert.equal(first.result.phaseMult, 1);

  const second = resolveCurrentPhase(first.state);
  assert.equal(second.result.phaseId, 'build_up');
  assert.equal(second.result.phaseMult, 0.9);
});

test('only players contributing to a phase spend energy', () => {
  const state = playableState();
  const resolved = resolveCurrentPhase(state);
  const participating = new Set(resolved.result.breakdown.map(row => row.player.id));

  for (const entry of state.field) {
    const energy = resolved.state.energy[entry.player.id]?.current;
    if (participating.has(entry.player.id)) assert.equal(energy, 2);
    else assert.equal(energy, undefined);
  }
});

test('round-scoped buffs expire after the round while match buffs survive', () => {
  const state = {
    ...playableState(),
    roundScore: 2500,
    shopBuffs: [
      { type: 'chipsBuff', value: 40, itemId: 'set_piece_drill' },
      { type: 'formMult', value: 0.05, itemId: 'formation_tweak' },
    ],
  };
  const outcome = finishRound(state);
  assert.deepEqual(outcome.state.shopBuffs, [
    { type: 'formMult', value: 0.05, itemId: 'formation_tweak' },
  ]);
});

test('consumables expire at the final whistle, permanent upgrades do not', () => {
  // Permanent upgrades deliberately carry across matches — that squad
  // progression is what makes the rising difficulty curve clearable.
  const state = {
    ...playableState(),
    roundResults: [{ won:true }, { won:true }],
    shopBuffs: [
      { type: 'formMult', value: 0.05, itemId: 'formation_tweak' },
      { type: 'chipsBuff', value: 50, itemId: 'some_consumable' },
    ],
  };
  const after = finishMatch(state).state.shopBuffs;
  assert.deepEqual(after, [{ type: 'formMult', value: 0.05, itemId: 'formation_tweak' }]);
});

test('fatigue shield prevents energy drain for its next round', () => {
  const state = {
    ...playableState(),
    shopBuffs: [{ type: 'fatigueShield', value: 1, itemId: 'double_session' }],
  };
  const resolved = resolveCurrentPhase(state);
  assert.deepEqual(resolved.state.energy, {});
});

test('resetRound preserves the selected field and advances the round', () => {
  const state = playableState();
  const next = resetRound({ ...state, roundIdx: 0, roundScore: 1234 });

  assert.equal(next.roundIdx, 1);
  assert.deepEqual(next.field, state.field);
  assert.deepEqual(next.selectedIds, state.selectedIds);
  assert.equal(next.roundScore, 0);
});

test('finishRound records the result and clears only round-scoped scoring state', () => {
  // Derive the winning score from the data instead of hardcoding one: targets
  // are re-measured by tools/balance.mjs and a literal here goes stale silently.
  const base = playableState();
  const target = CAMPAIGN_MATCHES[base.matchIdx || 0].targets[base.roundIdx || 0];
  const state = { ...base, roundScore: target + 1 };
  const outcome = finishRound(state);

  assert.equal(outcome.roundWon, true);
  assert.equal(outcome.state.roundResults.length, 1);
  assert.deepEqual(outcome.state.field, state.field);
  assert.equal(outcome.state.phaseResults.length, 0);
});

test('finishMatch requires two round wins and advances a winning campaign match', () => {
  const state = {
    ...playableState(),
    matchIdx: 0,
    roundResults: [
      { roundIdx: 0, score: 2500, won: true },
      { roundIdx: 1, score: 4000, won: true },
      { roundIdx: 2, score: 100, won: false },
    ],
  };
  const outcome = finishMatch(state);

  assert.equal(outcome.matchWon, true);
  assert.equal(outcome.outcome, 'next-match');
  assert.equal(outcome.state.matchIdx, 1);
});
