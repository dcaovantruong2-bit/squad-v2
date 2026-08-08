/** Shared test/audit helpers for the SQUAD engine. Not shipped in the bundle. */
import { calculateChips, getPositionPenalty } from '../src/lib/engine/engine.js';
import { PLAYERS, FORMATIONS, POSITION_ADJACENCY } from '../src/lib/engine/data.js';

export const BUILDER_BUDGET = 290;
export const playerCost = (p) => p.atk + p.pac + p.pas + p.def_ + p.spc;
const slotStrength = (p, pos) => calculateChips(p, pos) * getPositionPenalty(p, pos);

const eligibility = (p, slot) => {
  if (p.position === slot) return 'natural';
  if (p.position === 'GK' || slot === 'GK') return 'none';
  const adj = POSITION_ADJACENCY[p.position];
  return adj?.adjacent.includes(slot) ? 'adjacent' : 'none';
};

/**
 * Mirrors store.autoFillFormation EXACTLY, including the pass-3 wage-budget
 * correction. Without pass 3 the field is an unaffordable dream team and every
 * balance number comes out optimistic.
 */
export function buildField(formationId, { budget = BUILDER_BUDGET } = {}) {
  const layout = FORMATIONS.find(f => f.id === formationId).pitchLayout;
  const assign = {}; // idx -> playerId
  const used = new Set();

  for (const kind of ['natural', 'adjacent']) {
    layout.forEach((slot, idx) => {
      if (assign[idx] !== undefined) return;
      const pool = PLAYERS.filter(p => !used.has(p.id) && eligibility(p, slot.pos) === kind);
      const [best] = kind === 'natural'
        ? pool.sort((a, b) => calculateChips(b, slot.pos) - calculateChips(a, slot.pos))
        : pool.sort((a, b) => slotStrength(b, slot.pos) - slotStrength(a, slot.pos));
      if (best) { assign[idx] = best.id; used.add(best.id); }
    });
  }

  // Pass 3 — budget correction (best cost-saved per strength-lost ratio).
  const byId = new Map(PLAYERS.map(p => [p.id, p]));
  const totalCost = () => Object.values(assign)
    .reduce((s, id) => s + playerCost(byId.get(id)), 0);

  let guard = 0;
  while (totalCost() > budget && guard++ < 60) {
    let bestSwap = null;
    layout.forEach((slot, idx) => {
      const current = byId.get(assign[idx]);
      if (!current) return;
      const curStr = slotStrength(current, slot.pos);
      const curCost = playerCost(current);
      const inUse = new Set(Object.values(assign));
      for (const alt of PLAYERS) {
        if (inUse.has(alt.id)) continue;
        if (eligibility(alt, slot.pos) === 'none') continue;
        if (playerCost(alt) >= curCost) continue;
        const saved = curCost - playerCost(alt);
        const lost = Math.max(0.01, curStr - slotStrength(alt, slot.pos));
        const ratio = saved / lost;
        if (!bestSwap || ratio > bestSwap.ratio) bestSwap = { idx, id: alt.id, ratio };
      }
    });
    if (!bestSwap) break;
    assign[bestSwap.idx] = bestSwap.id;
  }

  return layout
    .map((slot, idx) => ({ player: byId.get(assign[idx]), position: slot.pos }))
    .filter(e => e.player);
}

/** A fresh-legs state with a full XI for `formationId`. */
export function freshState(createGameState, formationId, matchIdx = 0, roundIdx = 0, opts) {
  const st = createGameState();
  st.formation = formationId;
  st.matchIdx = matchIdx;
  st.roundIdx = roundIdx;
  st.field = buildField(formationId, opts);
  st.selectedIds = st.field.map(e => e.player.id);
  for (const id of st.selectedIds) st.energy[id] = { max: 3, current: 3 };
  return st;
}

export const fieldCost = (field) => field.reduce((s, e) => s + playerCost(e.player), 0);
