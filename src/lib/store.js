import { writable, derived } from 'svelte/store';
import {
  createGameState, autoFillSquad, autoRecommendFormation, calculateChips,
  getPositionPenalty, dealPhases, resolveCurrentPhase, finishRound,
  finishMatch, resetRound, buyShopItem,
} from './engine/engine.js';
import { PLAYERS, FORMATIONS, CAMPAIGN_MATCHES, POSITION_ADJACENCY } from './engine/data.js';
// ─── Current screen ───────────────────────────────────────────────────────────
export const screen = writable('title');
// screens: 'title' | 'squad' | 'phases' | 'match' | 'phase-result'
//          'shop' | 'round-result' | 'campaign-complete' | 'campaign-lost'
// NOTE: formation is now picked inside the squad builder — no separate 'formation' screen.

// ─── Game state ───────────────────────────────────────────────────────────────
export const game = writable(createGameState());

// ─── Derived helpers ─────────────────────────────────────────────────────────
export const currentMatch = derived(game, $g =>
  CAMPAIGN_MATCHES[$g.matchIdx] || null
);

export const currentFormation = derived(game, $g =>
  FORMATIONS.find(f => f.id === $g.formation) || null
);

export const squadPlayers = derived(game, $g =>
  $g.selectedIds.map(id => PLAYERS.find(p => p.id === id)).filter(Boolean)
);

// ─── Position eligibility ─────────────────────────────────────────────────────
// A player is "natural" for a slot if their native position matches.
// "Adjacent" if the slot is in their adjacency list. Otherwise not eligible.
export function slotEligibility(player, slotPos) {
  if (!player) return 'none';
  const native = player.position;
  if (native === slotPos) return 'natural';
  // GK is exclusive both ways
  if (native === 'GK' || slotPos === 'GK') return 'none';
  const adj = POSITION_ADJACENCY[native];
  if (adj && adj.adjacent.includes(slotPos)) return 'adjacent';
  return 'none';
}

// ─── Actions ─────────────────────────────────────────────────────────────────
export function navigate(to) {
  screen.set(to);
}

export function startNewGame() {
  const g = createGameState();
  g.formation = '4-4-2';
  g.slotAssignments = {}; // { slotIndex: playerId }
  game.set(g);
  screen.set('squad');
}

export function quickStart() {
  game.update(g => {
    const ids = autoFillSquad('4-4-2');
    const rec = autoRecommendFormation(ids);
    return { ...g, selectedIds: ids, formation: rec || '4-4-2' };
  });
  autoFillFormation();
  confirmSquad();
}

// ─── Squad builder: formation + slot assignment ───────────────────────────────

// Set the formation while building. Remap already-assigned players to
// compatible slots in the new formation; return incompatible players to the pool.
export function setBuilderFormation(formationId) {
  game.update(g => {
    const oldFormation = FORMATIONS.find(f => f.id === g.formation);
    const newFormation = FORMATIONS.find(f => f.id === formationId);
    if (!newFormation) return g;

    const oldAssign = g.slotAssignments || {};
    // Collect currently assigned players (in old slot order)
    const assignedPlayers = [];
    if (oldFormation) {
      oldFormation.pitchLayout.forEach((slot, idx) => {
        const pid = oldAssign[idx];
        if (pid) {
          const p = PLAYERS.find(pl => pl.id === pid);
          if (p) assignedPlayers.push(p);
        }
      });
    }

    // Greedily place players into new formation slots.
    // Pass 1: natural matches. Pass 2: adjacent matches.
    const newAssign = {};
    const placed = new Set();
    const layout = newFormation.pitchLayout;

    // Pass 1 — natural
    layout.forEach((slot, idx) => {
      if (newAssign[idx] !== undefined) return;
      const match = assignedPlayers.find(p =>
        !placed.has(p.id) && slotEligibility(p, slot.pos) === 'natural'
      );
      if (match) { newAssign[idx] = match.id; placed.add(match.id); }
    });
    // Pass 2 — adjacent
    layout.forEach((slot, idx) => {
      if (newAssign[idx] !== undefined) return;
      const match = assignedPlayers.find(p =>
        !placed.has(p.id) && slotEligibility(p, slot.pos) === 'adjacent'
      );
      if (match) { newAssign[idx] = match.id; placed.add(match.id); }
    });

    const returned = assignedPlayers.filter(p => !placed.has(p.id));

    return {
      ...g,
      formation: formationId,
      slotAssignments: newAssign,
      _lastReturnedPlayers: returned.map(p => p.name),
    };
  });
}

export function assignPlayerToSlot(slotIndex, playerId) {
  game.update(g => {
    const assign = { ...(g.slotAssignments || {}) };
    // Remove this player from any other slot first (no duplicates)
    for (const idx of Object.keys(assign)) {
      if (assign[idx] === playerId) delete assign[idx];
    }
    assign[slotIndex] = playerId;
    return { ...g, slotAssignments: assign, _lastReturnedPlayers: [] };
  });
}

export function clearSlot(slotIndex) {
  game.update(g => {
    const assign = { ...(g.slotAssignments || {}) };
    delete assign[slotIndex];
    return { ...g, slotAssignments: assign, _lastReturnedPlayers: [] };
  });
}

const BUILDER_BUDGET = 290;
function playerCost(p) { return p.atk + p.pac + p.pas + p.def_ + p.spc; }
function slotStrength(p, pos) { return calculateChips(p, pos) * getPositionPenalty(p, pos); }

export function autoFillFormation() {
  game.update(g => {
    const formation = FORMATIONS.find(f => f.id === g.formation);
    if (!formation) return g;
    const layout = formation.pitchLayout;
    const assign = {};
    const used = new Set();

    // Pass 1 — best natural player per slot (by chips)
    layout.forEach((slot, idx) => {
      const candidates = PLAYERS
        .filter(p => !used.has(p.id) && slotEligibility(p, slot.pos) === 'natural')
        .sort((a, b) => calculateChips(b, slot.pos) - calculateChips(a, slot.pos));
      if (candidates.length) { assign[idx] = candidates[0].id; used.add(candidates[0].id); }
    });
    // Pass 2 — fill remaining slots with best adjacent
    layout.forEach((slot, idx) => {
      if (assign[idx] !== undefined) return;
      const candidates = PLAYERS
        .filter(p => !used.has(p.id) && slotEligibility(p, slot.pos) === 'adjacent')
        .sort((a, b) => slotStrength(b, slot.pos) - slotStrength(a, slot.pos));
      if (candidates.length) { assign[idx] = candidates[0].id; used.add(candidates[0].id); }
    });

    // Pass 3 — budget correction. While over budget, find the single swap
    // (replace a slot's player with a cheaper eligible unused player) that
    // saves the most cost per unit of strength lost. Repeat until within budget.
    const totalCost = () => Object.values(assign).reduce((s, id) => {
      const p = PLAYERS.find(pl => pl.id === id); return s + (p ? playerCost(p) : 0);
    }, 0);

    let guard = 0;
    while (totalCost() > BUILDER_BUDGET && guard++ < 60) {
      let bestSwap = null; // { idx, id, ratio }
      layout.forEach((slot, idx) => {
        const currentId = assign[idx];
        if (!currentId) return;
        const current = PLAYERS.find(pl => pl.id === currentId);
        const curStr = slotStrength(current, slot.pos);
        const curCost = playerCost(current);
        const inUse = new Set(Object.values(assign));
        const alts = PLAYERS.filter(p =>
          !inUse.has(p.id) &&
          slotEligibility(p, slot.pos) !== 'none' &&
          playerCost(p) < curCost
        );
        for (const alt of alts) {
          const saved = curCost - playerCost(alt);
          const lost = Math.max(0.01, curStr - slotStrength(alt, slot.pos));
          const ratio = saved / lost; // higher = better (save more, lose less)
          if (!bestSwap || ratio > bestSwap.ratio) {
            bestSwap = { idx, id: alt.id, ratio };
          }
        }
      });
      if (!bestSwap) break; // no cheaper option anywhere
      assign[bestSwap.idx] = bestSwap.id;
    }

    return { ...g, slotAssignments: assign, _lastReturnedPlayers: [] };
  });
}

// Finalize the squad: flatten slot assignments into selectedIds + field, go to phases.
export function confirmSquad() {
  game.update(g => {
    const formation = FORMATIONS.find(f => f.id === g.formation);
    if (!formation) return g;
    const assign = g.slotAssignments || {};
    const ids = [];
    const field = [];
    formation.pitchLayout.forEach((slot, idx) => {
      const pid = assign[idx];
      if (pid) {
        const p = PLAYERS.find(pl => pl.id === pid);
        if (p) { ids.push(pid); field.push({ player: p, position: slot.pos }); }
      }
    });
    return { ...g, selectedIds: ids, field };
  });
  startPhaseSelection();
}

// Legacy helpers kept for compatibility with other screens
export function selectPlayer(playerId) {
  game.update(g => {
    if (g.selectedIds.includes(playerId)) return g;
    if (g.selectedIds.length >= 11) return g;
    return { ...g, selectedIds: [...g.selectedIds, playerId] };
  });
}

export function removePlayer(playerId) {
  game.update(g => ({
    ...g,
    selectedIds: g.selectedIds.filter(id => id !== playerId)
  }));
}

export function setFormation(formationId) {
  game.update(g => ({ ...g, formation: formationId }));
}

// ─── Phase selection ──────────────────────────────────────────────────────────

// Enter the phases screen: deal this round's phases (5, pick 3).
export function startPhaseSelection() {
  game.update(g => {
    const scout = (g.shopBuffs || []).some(b => b.type === 'scout');
    return {
      ...g,
      dealtPhases: dealPhases(scout ? 8 : 5),
      pickedPhases: [],
      shopBuffs: (g.shopBuffs || []).filter(b => b.type !== 'scout'),
    };
  });
  screen.set('phases');
}

// Append a phase to the sequence (max 3). Tapping a card fills the next
// empty slot — pick order matters because combo chains fire between
// consecutive picks.
export function pickPhase(phaseId) {
  game.update(g => {
    if ((g.pickedPhases || []).length >= 3) return g;
    if (g.pickedPhases.includes(phaseId)) return g;
    return { ...g, pickedPhases: [...g.pickedPhases, phaseId] };
  });
}

// Remove a phase from the sequence at a given slot (tap the filled slot).
export function unpickPhase(slotIndex) {
  game.update(g => {
    const picked = [...(g.pickedPhases || [])];
    if (slotIndex < 0 || slotIndex >= picked.length) return g;
    picked.splice(slotIndex, 1);
    return { ...g, pickedPhases: picked };
  });
}

export function confirmPhases() {
  game.update(g => ({ ...g, phaseIdx: 0, phaseResults: [], roundScore: 0 }));
  screen.set('match');
}

export function playCurrentPhase() {
  let done = false;
  game.update(g => {
    const resolved = resolveCurrentPhase(g);
    done = resolved.done;
    return {
      ...resolved.state,
      lastPhaseResult: resolved.result,
    };
  });
  screen.set('phase-result');
  return done;
}

export function continueAfterPhase() {
  let done = false;
  game.update(g => {
    done = (g.phaseIdx || 0) >= (g.pickedPhases || []).length;
    return g;
  });
  if (done) {
    settleRound();
    screen.set('round-result');
  } else {
    screen.set('match');
  }
}

export function settleRound() {
  let outcome = null;
  game.update(g => {
    outcome = finishRound(g);
    return { ...outcome.state, lastRoundOutcome: { won: outcome.roundWon, score: outcome.roundScore } };
  });
  return outcome;
}

export function continueAfterRound() {
  let nextScreen = 'phases';
  game.update(g => {
    const results = g.roundResults || [];
    const wins = results.filter(r => r.won).length;
    const losses = results.length - wins;
    const matchDecided = wins >= 2 || losses >= 2 || results.length >= 3;
    if (matchDecided) {
      const outcome = finishMatch(g);
      if (!outcome.matchWon) nextScreen = 'campaign-lost';
      else if (outcome.outcome === 'campaign-won') nextScreen = 'campaign-complete';
      else nextScreen = 'shop';
      return { ...outcome.state, morale: Math.min(20, (outcome.state.morale || 0) + 3), lastMatchOutcome: { won: outcome.matchWon, roundsWon: wins } };
    }
    return resetRound(g);
  });
  if (nextScreen === 'phases') startPhaseSelection();
  else screen.set(nextScreen);
}

export function purchaseItem(itemId) {
  let response;
  game.update(g => {
    response = buyShopItem(itemId, g);
    return { ...response.state, shopMessage: response.message };
  });
  return response;
}

export function continueFromShop() {
  startPhaseSelection();
}
