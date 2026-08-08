/**
 * Regression tests for the scoring fixes. Every test here corresponds to a bug
 * that shipped: each one fails against the pre-fix engine.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createGameState, calculatePhaseScore, detectSynergies, relevantSynergies,
  lookupChain, getChainFatigueRecovery, getPersistentPlayerMult,
  getManMarkedPlayerId, finishPhase, finishRound, finishMatch, estimatePhaseChips,
  detectSquadSynergies, isInjured,
} from '../src/lib/engine/engine.js';
import {
  ALL_PHASES, SYNERGIES, COMBO_CHAINS, CAMPAIGN_MATCHES, PLAYERS,
  describeSynergy, describeEffect, OFF_TAG_CHIP_RATE,
} from '../src/lib/engine/data.js';
import { freshState, buildField, BUILDER_BUDGET, fieldCost } from '../tools/harness.mjs';

const FRESH = () => createGameState();
const state442 = (matchIdx = 0, roundIdx = 0) => freshState(FRESH, '4-4-2', matchIdx, roundIdx);

// ─── phase-tag gating ────────────────────────────────────────────────────────

test('synergies only pay multipliers in phases matching their tag', () => {
  const st = state442();
  const all = detectSynergies(st.field, st.formation);
  assert.ok(all.length > 0, 'expected the auto-filled XI to fire some synergies');

  const attacking = ALL_PHASES.find(p => p.tag === 'Attacking');
  const gated = relevantSynergies(all, attacking.id);

  for (const s of gated) {
    if (s.onTag) continue;
    assert.equal(s.addMult, 0, `${s.id} is off-tag and must not add mult`);
    assert.equal(s.xMult, 1.0, `${s.id} is off-tag and must not multiply`);
  }
  assert.ok(gated.some(s => !s.onTag), 'expected at least one off-tag synergy');
});

test('off-tag synergies still pay reduced chips', () => {
  const syn = { id: 'x', tag: 'defensive', chips: 100, addMult: 5, xMult: 2 };
  const attacking = ALL_PHASES.find(p => p.tag === 'Attacking');
  const [gated] = relevantSynergies([syn], attacking.id);
  assert.equal(gated.chips, Math.round(100 * OFF_TAG_CHIP_RATE));
});

test('phase choice changes the score (it used to be uniform)', () => {
  const st = state442();
  const scores = ALL_PHASES.map(p =>
    calculatePhaseScore(st.field, p.id, { ...st, pickedPhases: [p.id], phaseIdx: 0 }).score);
  const spread = Math.max(...scores) / Math.max(1, Math.min(...scores));
  assert.ok(spread > 3, `expected phases to differ meaningfully, got spread ${spread.toFixed(2)}x`);
});

// ─── overload stacking ───────────────────────────────────────────────────────

test('overload stacks per duplicate player, not once per squad', () => {
  const overload = SYNERGIES.find(s => s.id === 'overload');
  assert.ok(overload, 'overload synergy must exist');

  const cb = PLAYERS.find(p => p.position === 'CB');
  const cbs = PLAYERS.filter(p => p.position === 'CB').slice(0, 3);
  assert.ok(cbs.length >= 3, 'need 3 CBs in the player pool for this test');

  const two = detectSynergies(cbs.slice(0, 2).map(p => ({ player: p, position: 'CB' })), '4-4-2');
  const three = detectSynergies(cbs.map(p => ({ player: p, position: 'CB' })), '4-4-2');
  const grab = rs => rs.find(r => r.id === 'overload');

  assert.ok(grab(two), 'two same-position players should fire overload');
  assert.equal(grab(two).stacks, 1);
  assert.equal(grab(three).stacks, 2, 'three CBs = two extra players = 2 stacks');
  assert.ok(grab(three).addMult > grab(two).addMult, 'more duplicates must pay more');
});

// ─── combo chain matrix ──────────────────────────────────────────────────────

test('Specialist_Any is treated as a wildcard, not a literal tag', () => {
  assert.ok(COMBO_CHAINS['Specialist_Any'], 'wildcard entry should exist in data');
  // No phase has the tag "Any", so a literal lookup could never match.
  assert.ok(!ALL_PHASES.some(p => p.tag === 'Any'));
  // A specialist followed by anything must resolve to some chain.
  for (const tag of [...new Set(ALL_PHASES.map(p => p.tag))]) {
    assert.ok(lookupChain('Specialist', tag), `Specialist -> ${tag} must resolve`);
  }
});

test('every ordered pair of phase tags has a defined chain', () => {
  const tags = [...new Set(ALL_PHASES.map(p => p.tag))];
  const missing = [];
  for (const a of tags) for (const b of tags) {
    if (!lookupChain(a, b)) missing.push(`${a}_${b}`);
  }
  assert.deepEqual(missing, [], `unhandled chains: ${missing.join(', ')}`);
});

test('fatigueRecovery chains are readable by the round logic', () => {
  const defensive = ALL_PHASES.filter(p => p.tag === 'Defensive');
  assert.ok(defensive.length >= 2, 'need two defensive phases');
  const seq = [defensive[0].id, defensive[1].id];
  const rec = getChainFatigueRecovery(seq[1], seq, 1);
  assert.ok(rec > 0, 'defensive->defensive should recover fatigue');
  assert.equal(getChainFatigueRecovery(seq[0], seq, 0), 0, 'first phase has no chain');
});

test('back-to-back defensive phases actually restore energy', () => {
  const defensive = ALL_PHASES.filter(p => p.tag === 'Defensive');
  const st = state442();
  const seq = [defensive[0].id, defensive[1].id];
  const field = st.field.slice(0, 6);
  // drain everyone by one pip first
  const energy = {};
  for (const e of field) energy[e.player.id] = { max: 3, current: 1 };
  const before = Object.values(energy).reduce((s, e) => s + e.current, 0);

  const after = finishPhase(
    { phaseId: seq[1], phaseIndex: 1, score: 0, field, carryoverNextPhase: 0 },
    { ...st, energy, pickedPhases: seq, shopBuffs: [{ type: 'fatigueShield' }] }
  );
  const total = Object.values(after.energy).reduce((s, e) => s + e.current, 0);
  assert.ok(total > before, `expected recovery, went from ${before} to ${total}`);
});

// ─── persistent squad synergies ──────────────────────────────────────────────

test('playerMult and positionMult from persistent synergies are applied', () => {
  const player = PLAYERS.find(p => p.traits.length > 0);
  const trait = player.traits[0];
  const synergies = [
    { effect: { playerMult: 2.0, targetTrait: trait } },
    { effect: { positionMult: 1.5, targetPositions: ['CB'] } },
  ];
  assert.equal(getPersistentPlayerMult(player, 'ST', synergies), 2.0);
  assert.equal(getPersistentPlayerMult(player, 'CB', synergies), 3.0, 'both should compound');
  const plain = PLAYERS.find(p => !p.traits.includes(trait) && p.position !== 'CB');
  assert.equal(getPersistentPlayerMult(plain, 'ST', synergies), 1.0);
});

test('no persistent synergy effect key is silently ignored', () => {
  // Every effect key present in the data must be handled somewhere in the
  // engine. This guards against new data outrunning the scorer again.
  const handled = new Set([
    'chips', 'addMult', 'xMult', 'carryover', 'addChips', 'target',
    'targetPositions', 'playerMult', 'targetTrait', 'positionMult', 'special',
  ]);
  const unknown = new Set();
  for (const s of SYNERGIES) {
    for (const k of Object.keys(s.effect || {})) if (!handled.has(k)) unknown.add(k);
  }
  assert.deepEqual([...unknown], []);
});

// ─── opponent tactics ────────────────────────────────────────────────────────

test('man_mark suppresses the best player', () => {
  // Semi Final (idx 3) carries man_mark.
  const st = state442(3, 0);
  const markedId = getManMarkedPlayerId(st.field, st);
  assert.ok(markedId, 'man_mark match should nominate a player');

  const noMark = state442(0, 0);   // Group Stage has no man_mark
  assert.equal(getManMarkedPlayerId(noMark.field, noMark), null);

  const phase = ALL_PHASES[0];
  const marked = calculatePhaseScore(st.field, phase.id, { ...st, pickedPhases: [phase.id], phaseIdx: 0 });
  const row = marked.breakdown.find(r => r.player.id === markedId);
  if (row) assert.ok(row.markMult < 1, 'marked player must be penalised');
});

test('time_waste devalues the final phase of the round', () => {
  const st = state442(3, 0);   // Semi Final has time_waste on phase index 2
  const phase = ALL_PHASES.find(p => p.tag === 'Attacking');
  const seq = [phase.id, phase.id, phase.id];
  const early = calculatePhaseScore(st.field, phase.id, { ...st, pickedPhases: seq, phaseIdx: 0 });
  const late  = calculatePhaseScore(st.field, phase.id, { ...st, pickedPhases: seq, phaseIdx: 2 });
  assert.ok(late.score < early.score, `late phase ${late.score} should score under early ${early.score}`);
});

test('dirty_team can injure exhausted players, and injuries zero their output', () => {
  const st = state442(4, 0);   // THE FINAL carries dirty_team
  const field = st.field.slice(0, 5);
  const energy = {};
  for (const e of field) energy[e.player.id] = { max: 3, current: 0 };  // exhausted

  // dirty_team is probabilistic; over many trials at least one injury must land.
  let sawInjury = false;
  for (let i = 0; i < 200 && !sawInjury; i++) {
    const after = finishPhase(
      { phaseId: ALL_PHASES[0].id, phaseIndex: 0, score: 0, field, carryoverNextPhase: 0 },
      { ...st, energy, pickedPhases: [ALL_PHASES[0].id], shopBuffs: [{ type: 'fatigueShield' }] }
    );
    if ((after.injured || []).length > 0) sawInjury = true;
  }
  assert.ok(sawInjury, 'dirty_team should eventually injure an exhausted player');

  // An injured player contributes nothing.
  const victim = field[0].player.id;
  const injuredState = { ...st, injured: [victim], pickedPhases: [ALL_PHASES[0].id], phaseIdx: 0 };
  assert.ok(isInjured(victim, injuredState));
  const res = calculatePhaseScore(st.field, ALL_PHASES[0].id, injuredState);
  const row = res.breakdown.find(r => r.player.id === victim);
  if (row) assert.equal(row.contrib, 0, 'injured player must contribute 0 chips');
});

test('injuries persist across rounds but clear between matches', () => {
  const st = { ...state442(4, 0), injured: ['someone'] };
  const { state: afterMatch } = finishMatch(st);
  assert.deepEqual(afterMatch.injured, [], 'a new match starts with a clean bill of health');
});

// ─── derived descriptions ────────────────────────────────────────────────────

test('synergy descriptions are derived from the effect values', () => {
  for (const syn of SYNERGIES) {
    const desc = describeSynergy(syn);
    assert.ok(desc && !desc.includes('undefined'), `${syn.id}: bad description "${desc}"`);
    assert.notEqual(describeEffect(syn), 'no effect', `${syn.id} has no readable effect`);
  }
});

test('described numbers match the actual effect numbers', () => {
  for (const syn of SYNERGIES) {
    const text = describeEffect(syn);
    const e = syn.effect;
    if (e.chips)   assert.match(text, new RegExp(`\\+${e.chips} chips`), syn.id);
    if (e.addMult) assert.match(text, new RegExp(`\\+${e.addMult} mult`), syn.id);
    if (e.xMult)   assert.match(text, new RegExp(`x${e.xMult}`.replace('.', '\\.')), syn.id);
  }
});

// ─── balance ─────────────────────────────────────────────────────────────────

test('targets rise within each match', () => {
  for (const m of CAMPAIGN_MATCHES) {
    for (let r = 1; r < m.targets.length; r++) {
      assert.ok(m.targets[r] > m.targets[r - 1],
        `${m.name} round ${r + 1} (${m.targets[r]}) must exceed round ${r} (${m.targets[r - 1]})`);
    }
  }
});

test('the campaign trends harder overall', () => {
  // Deliberately NOT a strict global ratchet: match 3's tactics bite harder than
  // match 4's, so its achievable scores are lower and a rising line there would
  // be unreachable. What must hold is the trend — the final asks far more than
  // the group stage.
  const first = CAMPAIGN_MATCHES[0].targets;
  const last = CAMPAIGN_MATCHES[CAMPAIGN_MATCHES.length - 1].targets;
  const avg = a => a.reduce((s, x) => s + x, 0) / a.length;
  assert.ok(avg(last) > avg(first) * 3,
    `the final (avg ${avg(last)}) should demand much more than the opener (avg ${avg(first)})`);
});

test('morale is earned for winning rounds so the shop is usable', () => {
  const st = state442();
  const target = CAMPAIGN_MATCHES[0].targets[0];
  const won = finishRound({ ...st, roundScore: target + 1, morale: 0 });
  assert.ok(won.state.morale > 0, 'winning a round must pay morale');

  const lost = finishRound({ ...st, roundScore: 0, morale: 0 });
  assert.equal(lost.state.morale, 0, 'losing pays nothing');

  const crushed = finishRound({ ...st, roundScore: target * 3, morale: 0 });
  assert.ok(crushed.state.morale > won.state.morale, 'overshooting should pay a bonus');
});

test('permanent upgrades survive the match boundary', () => {
  const st = {
    ...state442(),
    roundResults: [{ won: true }, { won: true }],
    shopBuffs: [{ type: 'formMult', value: 0.05 }, { type: 'chipsBuff', value: 50 }],
  };
  const { state: after } = finishMatch(st);
  assert.ok(after.shopBuffs.some(b => b.type === 'formMult'), 'permanent upgrade must carry');
  assert.ok(!after.shopBuffs.some(b => b.type === 'chipsBuff'), 'consumable must be spent');
});

test('formMult treats its value as a bonus fraction, not a multiplier', () => {
  const st = state442();
  const phase = ALL_PHASES[0];
  const ctx = { ...st, pickedPhases: [phase.id], phaseIdx: 0 };
  const plain = calculatePhaseScore(st.field, phase.id, ctx).score;
  const buffed = calculatePhaseScore(st.field, phase.id,
    { ...ctx, shopBuffs: [{ type: 'formMult', value: 0.05 }] }).score;
  const ratio = buffed / plain;
  assert.ok(ratio > 1.0 && ratio < 1.12,
    `one 5% upgrade should be a small gain, got ${ratio.toFixed(3)}x`);
});

test('round 1 is winnable and the final is not trivial', () => {
  const best = (matchIdx, roundIdx) => {
    const st = freshState(FRESH, '4-4-2', matchIdx, roundIdx);
    const scores = ALL_PHASES
      .map(p => calculatePhaseScore(st.field, p.id, { ...st, pickedPhases: [p.id], phaseIdx: 0 }).score)
      .sort((a, b) => b - a);
    return scores[0] + scores[1] + scores[2];
  };
  const first = best(0, 0) / CAMPAIGN_MATCHES[0].targets[0];
  const last  = best(4, 2) / CAMPAIGN_MATCHES[4].targets[2];
  // Calibrated headroom: the opener is generous, the final leaves little slack.
  assert.ok(first > 2.0, `opening round should be comfortably winnable, got ${first.toFixed(2)}x`);
  assert.ok(last < first, `the final should squeeze harder than the opener (${last.toFixed(2)}x vs ${first.toFixed(2)}x)`);
});

test('the auto-filled XI respects the wage budget', () => {
  for (const f of ['4-4-2', '4-3-3', '5-3-2', '4-2-3-1']) {
    const cost = fieldCost(buildField(f));
    assert.ok(cost <= BUILDER_BUDGET, `${f} costs ${cost}, over budget ${BUILDER_BUDGET}`);
  }
});

// ─── preview honesty ─────────────────────────────────────────────────────────

test('the chip estimate shown to the player matches what scoring pays', () => {
  const st = state442();
  for (const p of ALL_PHASES) {
    const ctx = { ...st, pickedPhases: [p.id], phaseIdx: 0 };
    const est = estimatePhaseChips(st.field, p.id, ctx);
    const real = calculatePhaseScore(st.field, p.id, ctx);
    assert.equal(est, real.chips,
      `${p.name}: preview said ${est}, scoring used ${real.chips}`);
  }
});
