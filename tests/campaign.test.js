import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createGameState,
  resolveCurrentPhase,
  resetRound,
  finishRound,
  finishMatch,
} from '../src/lib/engine/engine.js';
import { PLAYERS, FORMATIONS } from '../src/lib/engine/data.js';

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

test('resetRound preserves the selected field and advances the round', () => {
  const state = playableState();
  const next = resetRound({ ...state, roundIdx: 0, roundScore: 1234 });

  assert.equal(next.roundIdx, 1);
  assert.deepEqual(next.field, state.field);
  assert.deepEqual(next.selectedIds, state.selectedIds);
  assert.equal(next.roundScore, 0);
});

test('finishRound records the result and clears only round-scoped scoring state', () => {
  const state = { ...playableState(), roundScore: 2500 };
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
