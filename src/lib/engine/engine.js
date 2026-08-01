/**
 * SQUAD v2 — Game Engine
 * Pure ES module — no DOM, no Svelte imports.
 * All game logic: state, scoring, energy, campaign, shop, helpers.
 */
import {
  PLAYERS, CHIPS_FORMULA, POSITION_ADJACENCY, TRAIT_SLOT_FIT,
  FORMATIONS, ALL_PHASES, SYNERGIES, COMBO_CHAINS, COMBO_NO_MATCH_PENALTY,
  CAMPAIGN_MATCHES, OPPONENT_TACTICS, SHOP_ITEMS,
} from './data.js';

// ─── STATE ────────────────────────────────────────────────────────────────────

export function createGameState() {
  return {
    selectedIds: [],
    slotAssignments: {},
    formation: '4-4-2',
    matchIdx: 0,
    roundIdx: 0,
    phaseIdx: 0,
    dealtPhases: [],
    pickedPhases: [],
    field: [],
    roundScore: 0,
    phaseResults: [],
    roundResults: [],
    matchResults: [],
    energy: {},
    morale: 5,
    shopBuffs: [],
    momentum: 1.0,
    campaignWon: false,
    campaignLost: false,
  };
}

export function getPlayerById(id) {
  return PLAYERS.find(p => p.id === id) || null;
}

export function getSquad(state) {
  return state.selectedIds.map(id => getPlayerById(id)).filter(Boolean);
}

// ─── ENERGY ───────────────────────────────────────────────────────────────────

function initEnergy(state) {
  const energy = { ...state.energy };
  for (const id of state.selectedIds) {
    if (!energy[id]) {
      energy[id] = { max: 3, current: 3 };
    }
  }
  return { ...state, energy };
}

export function getEnergyMultiplier(playerId, state) {
  const e = state.energy[playerId];
  if (!e) return 1.0;
  if (e.current >= 3) return 1.0;
  if (e.current === 2) return 0.85;
  if (e.current === 1) return 0.65;
  return 0.4;
}

export function usePlayerEnergy(playerId, state) {
  const energy = { ...state.energy };
  if (!energy[playerId]) energy[playerId] = { max: 3, current: 3 };
  energy[playerId] = {
    ...energy[playerId],
    current: Math.max(0, energy[playerId].current - 1),
  };
  return { ...state, energy };
}

export function recoverEnergy(playerId, state) {
  const energy = { ...state.energy };
  if (!energy[playerId]) energy[playerId] = { max: 3, current: 3 };
  energy[playerId] = { ...energy[playerId], current: energy[playerId].max };
  return { ...state, energy };
}

// ─── SCORING ──────────────────────────────────────────────────────────────────

export function calculateChips(player, fieldPosition) {
  if (!player) return 0;
  const formula = CHIPS_FORMULA[fieldPosition];
  if (!formula) return 0;
  return formula(player);
}

export function getPositionPenalty(player, fieldPosition) {
  if (!player) return 0.5;
  const nativePos = player.position;
  // GK can only play GK; non-GK cannot play GK
  if (nativePos === 'GK' && fieldPosition === 'GK') return 1.0;
  if (nativePos === 'GK' || fieldPosition === 'GK') return 0.0;
  const adj = POSITION_ADJACENCY[nativePos];
  if (!adj) return 0.7;
  if (adj.natural.includes(fieldPosition)) return 1.0;
  // Trait fit bonuses — each matching trait adds 0.05
  let base = adj.adjacent.includes(fieldPosition) ? 0.85 : 0.70;
  let bonus = 0;
  for (const trait of (player.traits || [])) {
    const fits = TRAIT_SLOT_FIT[trait] || [];
    if (fits.includes(fieldPosition)) bonus += 0.05;
  }
  // Key stat ≥ 9 adds 0.05
  const keyStat = {GK:'def_',CB:'def_',FB:'def_',CDM:'def_',CM:'pas',CAM:'pas',LW:'pac',RW:'pac',ST:'atk'}[fieldPosition];
  if (keyStat && (player[keyStat] || 0) >= 9) bonus += 0.05;
  return Math.min(base + bonus, 0.95);
}

export function getSynergyGates(formationId) {
  const formation = FORMATIONS.find(f => f.id === formationId);
  if (!formation) return new Set();
  // GK is always present (implicit) — build a slot count map
  const slotCount = { GK: 1 };
  for (const s of formation.slots) {
    slotCount[s] = (slotCount[s] || 0) + 1;
  }
  const gates = new Set();
  for (const syn of SYNERGIES) {
    if (syn.persistent) continue;
    const t = syn.trigger;
    let possible = true;
    // posA + posB pair check
    if (t.posA && !slotCount[t.posA]) possible = false;
    if (t.posB && !slotCount[t.posB]) possible = false;
    // positions array — check each needed position with count
    if (t.positions) {
      const needed = {};
      for (const pos of t.positions) needed[pos] = (needed[pos] || 0) + 1;
      for (const [pos, cnt] of Object.entries(needed)) {
        if ((slotCount[pos] || 0) < cnt) { possible = false; break; }
      }
    }
    // single position requirement
    if (t.position && !slotCount[t.position]) possible = false;
    // count-based: synergies like back_three need count CBs on field
    // back_three trigger: {stat, threshold, count:3} — needs 3 defensive players
    // we approximate: if count >= 3, need at least 3 CB slots
    if (t.count && t.count >= 3 && !t.positions && !t.posA) {
      if ((slotCount['CB'] || 0) < t.count) possible = false;
    }
    // winger: need at least one of LW/RW
    if (t.wingerPos) {
      const hasWinger = t.wingerPos.some(wp => slotCount[wp]);
      if (!hasWinger) possible = false;
    }
    if (possible) gates.add(syn.id);
  }
  return gates;
}

export function detectSynergies(field, formationId) {
  const gates = getSynergyGates(formationId);
  const results = [];
  const playersByPos = {};
  for (const entry of field) {
    const pos = entry.position;
    if (!playersByPos[pos]) playersByPos[pos] = [];
    playersByPos[pos].push(entry.player);
  }

  for (const syn of SYNERGIES) {
    if (syn.persistent) continue;
    if (!gates.has(syn.id)) continue;
    const t = syn.trigger;
    let fired = false;
    let totalChips = 0;
    let addMult = 0;
    let xMult = 1.0;
    let carryover = 0;

    // clean_sheet: GK DEF + CB DEF >= threshold
    if (syn.id === 'clean_sheet') {
      const gks = playersByPos['GK'] || [];
      const cbs = playersByPos['CB'] || [];
      if (gks.length > 0 && cbs.length > 0) {
        const gkDef = gks[0].def_;
        const bestCbDef = Math.max(...cbs.map(c => c.def_));
        if (gkDef + bestCbDef >= t.threshold) fired = true;
      }
    }
    // organised_defence: 2 CBs DEF sum >= threshold
    else if (syn.id === 'organised_defence') {
      const cbs = playersByPos['CB'] || [];
      if (cbs.length >= 2) {
        const sorted = [...cbs].sort((a, b) => b.def_ - a.def_);
        if (sorted[0].def_ + sorted[1].def_ >= t.threshold) fired = true;
      }
    }
    // wingback_overlap: FB PAC + CM PAS >= threshold
    else if (syn.id === 'wingback_overlap') {
      const fbs = playersByPos['FB'] || [];
      const cms = playersByPos['CM'] || [];
      if (fbs.length > 0 && cms.length > 0) {
        const bestFbPac = Math.max(...fbs.map(f => f.pac));
        const bestCmPas = Math.max(...cms.map(c => c.pas));
        if (bestFbPac + bestCmPas >= t.threshold) fired = true;
      }
    }
    // overload: 2+ same position
    else if (syn.id === 'overload') {
      for (const [pos, players] of Object.entries(playersByPos)) {
        if (players.length >= 2) { fired = true; break; }
      }
    }
    // stretch_backline: FB PAC + LW PAC >= threshold
    else if (syn.id === 'stretch_backline') {
      const fbs = playersByPos['FB'] || [];
      const lws = playersByPos['LW'] || [];
      if (fbs.length > 0 && lws.length > 0) {
        const bestFbPac = Math.max(...fbs.map(f => f.pac));
        const bestLwPac = Math.max(...lws.map(l => l.pac));
        if (bestFbPac + bestLwPac >= t.threshold) fired = true;
      }
    }
    // route_one: CB PAS + ST PAC >= threshold
    else if (syn.id === 'route_one') {
      const cbs = playersByPos['CB'] || [];
      const sts = playersByPos['ST'] || [];
      if (cbs.length > 0 && sts.length > 0) {
        const bestCbPas = Math.max(...cbs.map(c => c.pas));
        const bestStPac = Math.max(...sts.map(s => s.pac));
        if (bestCbPas + bestStPac >= t.threshold) fired = true;
      }
    }
    // battering_ram: CB DEF + ST ATK >= threshold
    else if (syn.id === 'battering_ram') {
      const cbs = playersByPos['CB'] || [];
      const sts = playersByPos['ST'] || [];
      if (cbs.length > 0 && sts.length > 0) {
        const bestCbDef = Math.max(...cbs.map(c => c.def_));
        const bestStAtk = Math.max(...sts.map(s => s.atk));
        if (bestCbDef + bestStAtk >= t.threshold) fired = true;
      }
    }
    // defensive_duo: 2 highest DEF sum >= threshold
    else if (syn.id === 'defensive_duo') {
      const allDefs = field.map(e => e.player.def_).sort((a, b) => b - a);
      if (allDefs.length >= 2 && allDefs[0] + allDefs[1] >= t.threshold) fired = true;
    }
    // back_three: 3 players with DEF >= threshold
    else if (syn.id === 'back_three') {
      const allDefs = field.map(e => e.player.def_).filter(d => d >= t.threshold);
      if (allDefs.length >= (t.count || 3)) fired = true;
    }
    // midfield_engine: CM PAS + CM DEF >= threshold (2 CMs)
    else if (syn.id === 'midfield_engine') {
      const cms = playersByPos['CM'] || [];
      if (cms.length >= 2) {
        const sorted = [...cms].sort((a, b) => b.pas - a.pas);
        const bestCmPas = sorted[0].pas;
        const bestCmDef = Math.max(...cms.map(c => c.def_));
        if (bestCmPas + bestCmDef >= t.threshold) fired = true;
      }
    }
    // double_pivot: 2 CMs PAS sum >= threshold
    else if (syn.id === 'double_pivot') {
      const cms = playersByPos['CM'] || [];
      if (cms.length >= 2) {
        const sorted = [...cms].sort((a, b) => b.pas - a.pas);
        if (sorted[0].pas + sorted[1].pas >= t.threshold) fired = true;
      }
    }
    // covering_defender: CB with pac >= thresholdA AND def_ >= thresholdB
    else if (syn.id === 'covering_defender') {
      const cbs = playersByPos['CB'] || [];
      if (cbs.some(c => c.pac >= t.thresholdA && c.def_ >= t.thresholdB)) fired = true;
    }
    // target_man_release: ST ATK + winger PAC >= threshold
    else if (syn.id === 'target_man_release') {
      const sts = playersByPos['ST'] || [];
      const wingers = [...(playersByPos['LW'] || []), ...(playersByPos['RW'] || [])];
      if (sts.length > 0 && wingers.length > 0) {
        const bestStAtk = Math.max(...sts.map(s => s.atk));
        const bestWinPac = Math.max(...wingers.map(w => w.pac));
        if (bestStAtk + bestWinPac >= t.threshold) fired = true;
      }
    }
    // near_post_flick: CAM SPC + ST ATK >= threshold
    else if (syn.id === 'near_post_flick') {
      const cams = playersByPos['CAM'] || [];
      const sts = playersByPos['ST'] || [];
      if (cams.length > 0 && sts.length > 0) {
        const bestCamSpc = Math.max(...cams.map(c => c.spc));
        const bestStAtk = Math.max(...sts.map(s => s.atk));
        if (bestCamSpc + bestStAtk >= t.threshold) fired = true;
      }
    }
    // one_two: CM PAS + ST PAC >= threshold
    else if (syn.id === 'one_two') {
      const cms = playersByPos['CM'] || [];
      const sts = playersByPos['ST'] || [];
      if (cms.length > 0 && sts.length > 0) {
        const bestCmPas = Math.max(...cms.map(c => c.pas));
        const bestStPac = Math.max(...sts.map(s => s.pac));
        if (bestCmPas + bestStPac >= t.threshold) fired = true;
      }
    }
    // overlap: FB PAC + LW PAS >= threshold
    else if (syn.id === 'overlap') {
      const fbs = playersByPos['FB'] || [];
      const lws = playersByPos['LW'] || [];
      if (fbs.length > 0 && lws.length > 0) {
        const bestFbPac = Math.max(...fbs.map(f => f.pac));
        const bestLwPas = Math.max(...lws.map(l => l.pas));
        if (bestFbPac + bestLwPas >= t.threshold) fired = true;
      }
    }
    // set_piece_threat: any player DEF>=thresholdA and any SPC>=thresholdB
    else if (syn.id === 'set_piece_threat') {
      const hasHighDef = field.some(e => e.player.def_ >= t.thresholdA);
      const hasHighSpc = field.some(e => e.player.spc >= t.thresholdB);
      if (hasHighDef && hasHighSpc) fired = true;
    }
    // trio: CDM + 2 CMs all PAS >= threshold
    else if (syn.id === 'trio') {
      const cdms = playersByPos['CDM'] || [];
      const cms = playersByPos['CM'] || [];
      if (cdms.length > 0 && cms.length >= 2) {
        const allMid = [...cdms, ...cms];
        const qualified = allMid.filter(p => p.pas >= t.threshold);
        if (qualified.length >= 3) fired = true;
      }
    }

    if (fired) {
      const eff = syn.effect;
      if (eff.chips) totalChips += eff.chips;
      if (eff.addMult) addMult += eff.addMult;
      if (eff.xMult) xMult *= eff.xMult;
      if (eff.carryover) carryover += eff.carryover;
      results.push({ id: syn.id, name: syn.name, chips: eff.chips || 0, addMult: eff.addMult || 0, xMult: eff.xMult || 1.0, carryover });
    }
  }
  return results;
}

export function detectSquadSynergies(squad) {
  const results = [];
  for (const syn of SYNERGIES) {
    if (!syn.persistent) continue;
    const t = syn.trigger;
    let fired = false;
    if (t.trait && !t.traits) {
      const count = squad.filter(p => p.traits.includes(t.trait)).length;
      if (count >= t.minCount) fired = true;
    } else if (t.traits) {
      const count = squad.filter(p => t.traits.some(tr => p.traits.includes(tr))).length;
      if (count >= t.minCount) fired = true;
    }
    if (fired) results.push({ id: syn.id, name: syn.name, effect: syn.effect, description: syn.description });
  }
  return results;
}

// ─── OPPONENT TACTICS ─────────────────────────────────────────────────────────

function getOpponentTactics(state) {
  const match = CAMPAIGN_MATCHES[state.matchIdx];
  if (!match || !match.tactics) return [];
  return match.tactics.map(tid => OPPONENT_TACTICS[tid]).filter(Boolean);
}

function getOpponentTacticalMultiplier(phaseId, field, state) {
  const tactics = getOpponentTactics(state);
  let mult = 1.0;
  const phase = ALL_PHASES.find(p => p.id === phaseId);
  const phaseTag = phase ? phase.tag : '';

  for (const tac of tactics) {
    if (tac.target === 'phaseTag' && tac.tags.includes(phaseTag)) {
      if (tac.effect === 'multiply') mult *= tac.value;
    }
  }
  return mult;
}

// ─── COMBO CHAINS / PHASE MULT ────────────────────────────────────────────────

function getPhaseMult(phaseId, pickedPhases) {
  if (pickedPhases.length === 0) return 1.0;
  const prevPhaseId = pickedPhases[pickedPhases.length - 1];
  const prevPhase = ALL_PHASES.find(p => p.id === prevPhaseId);
  const currPhase = ALL_PHASES.find(p => p.id === phaseId);
  if (!prevPhase || !currPhase) return COMBO_NO_MATCH_PENALTY;
  const key = `${prevPhase.tag}_${currPhase.tag}`;
  const chain = COMBO_CHAINS[key];
  if (!chain) return COMBO_NO_MATCH_PENALTY;
  if (chain.effect === 'xMult') return chain.value;
  return 1.0;
}

function getPhaseChainBonusChips(phaseId, pickedPhases) {
  if (pickedPhases.length === 0) return 0;
  const prevPhaseId = pickedPhases[pickedPhases.length - 1];
  const prevPhase = ALL_PHASES.find(p => p.id === prevPhaseId);
  const currPhase = ALL_PHASES.find(p => p.id === phaseId);
  if (!prevPhase || !currPhase) return 0;
  const key = `${prevPhase.tag}_${currPhase.tag}`;
  const chain = COMBO_CHAINS[key];
  if (chain && chain.effect === 'addChips') return chain.value;
  return 0;
}

// ─── FULL PHASE SCORING PIPELINE ─────────────────────────────────────────────

export function calculatePhaseScore(field, phaseId, state) {
  if (!field || field.length === 0) return { score: 0, breakdown: [], synergies: [] };

  const match = CAMPAIGN_MATCHES[state.matchIdx];
  const roundTarget = match ? match.targets[state.roundIdx] : 1000;

  // Base player chips
  let playerChips = 0;
  const breakdown = [];
  for (const entry of field) {
    const { player, position } = entry;
    const baseChips = calculateChips(player, position);
    const oopMult = getPositionPenalty(player, position);
    const energyMult = getEnergyMultiplier(player.id, state);
    const contrib = Math.round(baseChips * oopMult * energyMult);
    playerChips += contrib;
    breakdown.push({ player, position, baseChips, oopMult, energyMult, contrib });
  }

  // Synergies
  const synergies = detectSynergies(field, state.formation);
  let synergyChips = 0;
  let addMult = 1;
  let xMult = 1.0;
  let carryoverChips = 0;

  for (const syn of synergies) {
    synergyChips += syn.chips || 0;
    addMult += syn.addMult || 0;
    xMult *= syn.xMult || 1.0;
    carryoverChips += syn.carryover || 0;
  }

  // Squad persistent synergy effects applied to this phase
  const squad = getSquad(state);
  const squadSynergies = detectSquadSynergies(squad);
  for (const ssyn of squadSynergies) {
    const eff = ssyn.effect;
    if (eff.addChips) {
      // addChips for all
      if (eff.target === 'all') synergyChips += eff.addChips;
      // addChips for target positions
      if (eff.targetPositions) {
        for (const entry of field) {
          if (eff.targetPositions.includes(entry.position)) synergyChips += eff.addChips;
        }
      }
    }
  }

  // Shop buffs
  let shopChipsBuff = 0;
  let shopAddMultBuff = 0;
  for (const buff of (state.shopBuffs || [])) {
    if (buff.type === 'chipsBuff') shopChipsBuff += buff.value;
    if (buff.type === 'addMultBuff') shopAddMultBuff += buff.value;
  }

  // Carryover from double_pivot
  const carryover = state._carryoverChips || 0;

  // Combo chain effects
  const phaseMult = getPhaseMult(phaseId, state.pickedPhases || []);
  const chainBonusChips = getPhaseChainBonusChips(phaseId, state.pickedPhases || []);

  // Tactical opponent multiplier
  const tacMult = getOpponentTacticalMultiplier(phaseId, field, state);

  // Momentum
  const momentum = state.momentum || 1.0;

  // Final formula:
  // finalScore = (playerChips + synergyChips + chainBonus + shopChips + carryover)
  //              × (addMult + shopAddMultBuff) × xMult × momentum × phaseMult × tacMult
  const totalChips = playerChips + synergyChips + chainBonusChips + shopChipsBuff + carryover;
  const score = Math.round(totalChips * (addMult + shopAddMultBuff) * xMult * momentum * phaseMult * tacMult);

  return {
    score: Math.max(0, score),
    breakdown,
    synergies,
    squadSynergies,
    carryoverNextPhase: carryoverChips,
    phaseMult,
    chainBonusChips,
    momentum,
    tacMult,
  };
}

// ─── CAMPAIGN ─────────────────────────────────────────────────────────────────

export function checkRoundWin(score, target) {
  return score >= target;
}

export function getOpponentScore(state, roundScore) {
  const match = CAMPAIGN_MATCHES[state.matchIdx];
  const target = match ? match.targets[state.roundIdx] : 1000;
  const rand = (Math.random() * 0.2) - 0.1; // -0.1 to +0.1
  return Math.round(target * (0.65 + state.matchIdx * 0.05 + rand));
}

export function finishPhase(phaseResult, state) {
  let newState = {
    ...state,
    roundScore: (state.roundScore || 0) + phaseResult.score,
    phaseResults: [...(state.phaseResults || []), phaseResult],
    phaseIdx: (state.phaseIdx || 0) + 1,
    pickedPhases: [...(state.pickedPhases || []), phaseResult.phaseId].filter(Boolean),
    _carryoverChips: phaseResult.carryoverNextPhase || 0,
  };

  // Update momentum: +0.1 if score >= 15% of round target, cap 1.3
  const match = CAMPAIGN_MATCHES[state.matchIdx];
  const roundTarget = match ? match.targets[state.roundIdx] : 1000;
  if (phaseResult.score >= roundTarget * 0.15) {
    newState.momentum = Math.min(1.3, (state.momentum || 1.0) + 0.1);
  }

  // Drain energy for all players in field
  for (const entry of (phaseResult.field || [])) {
    newState = usePlayerEnergy(entry.player.id, newState);
  }

  return newState;
}

export function finishRound(state) {
  const roundScore = state.roundScore || 0;
  const match = CAMPAIGN_MATCHES[state.matchIdx];
  const target = match ? match.targets[state.roundIdx] : 1000;
  const roundWon = checkRoundWin(roundScore, target);

  const newState = {
    ...state,
    roundResults: [...(state.roundResults || []), { roundIdx: state.roundIdx, score: roundScore, won: roundWon }],
    roundScore: 0,
    phaseResults: [],
    phaseIdx: 0,
    pickedPhases: [],
    dealtPhases: [],
    momentum: 1.0,
    _carryoverChips: 0,
  };

  return { state: newState, roundWon, roundScore };
}

export function finishMatch(state) {
  const roundsWon = (state.roundResults || []).filter(r => r.won).length;
  const matchWon = roundsWon >= 2;
  let outcome;
  let newState = {
    ...state,
    matchResults: [...(state.matchResults || []), { matchIdx: state.matchIdx, won: matchWon, roundsWon }],
    roundResults: [],
    roundIdx: 0,
  };

  if (!matchWon) {
    outcome = 'campaign-lost';
    newState.campaignLost = true;
  } else if (state.matchIdx >= 4) {
    outcome = 'campaign-won';
    newState.campaignWon = true;
  } else {
    outcome = 'next-match';
    newState.matchIdx = state.matchIdx + 1;
  }

  return { state: newState, matchWon, outcome };
}

export function resetRound(state) {
  return {
    ...state,
    roundScore: 0,
    phaseResults: [],
    phaseIdx: 0,
    pickedPhases: [],
    dealtPhases: dealPhases(),
    momentum: 1.0,
    _carryoverChips: 0,
    field: [],
    roundIdx: (state.roundIdx || 0) + 1,
  };
}

// ─── SHOP ─────────────────────────────────────────────────────────────────────

export function buyShopItem(itemId, state) {
  const item = SHOP_ITEMS[itemId];
  if (!item) return { state, success: false, message: 'Unknown item.' };
  if ((state.morale || 0) < item.cost) {
    return { state, success: false, message: `Not enough morale. Need ${item.cost}, have ${state.morale || 0}.` };
  }
  let newState = { ...state, morale: (state.morale || 0) - item.cost };
  const eff = item.effect;

  if (eff.type === 'morale') {
    newState.morale += eff.value;
  } else if (eff.type === 'momentumBoost') {
    newState.momentum = Math.max(newState.momentum, eff.value);
  } else if (eff.type === 'fullReset') {
    // Reset fatigue/energy for one player - apply to lowest energy player
    const lowestId = Object.entries(newState.energy || {})
      .sort((a, b) => a[1].current - b[1].current)[0]?.[0];
    if (lowestId) newState = recoverEnergy(lowestId, newState);
  } else {
    // Buffer the effect for next round/phase
    newState.shopBuffs = [...(newState.shopBuffs || []), { type: eff.type, value: eff.value, itemId }];
  }

  return { state: newState, success: true, message: `Bought ${item.name}.` };
}

// ─── HELPERS ──────────────────────────────────────────────────────────────────

export function dealPhases() {
  const ids = ALL_PHASES.map(p => p.id);
  // Fisher-Yates shuffle, return 8 (all phases in random order)
  const arr = [...ids];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr.slice(0, 8);
}

export function evaluateComboChains(pickedPhases) {
  if (!pickedPhases || pickedPhases.length < 2) return [];
  const results = [];
  for (let i = 1; i < pickedPhases.length; i++) {
    const prev = ALL_PHASES.find(p => p.id === pickedPhases[i - 1]);
    const curr = ALL_PHASES.find(p => p.id === pickedPhases[i]);
    if (!prev || !curr) continue;
    const key = `${prev.tag}_${curr.tag}`;
    const chain = COMBO_CHAINS[key];
    results.push({
      from: prev.id,
      to: curr.id,
      key,
      chain: chain || null,
      matched: !!chain,
    });
  }
  return results;
}

export function autoFillSquad(formation) {
  const f = typeof formation === 'string' ? FORMATIONS.find(fm => fm.id === formation) : formation;
  if (!f) return PLAYERS.slice(0, 11).map(p => p.id);

  const slots = [...f.slots, 'GK']; // always need a GK
  const needed = {};
  for (const slot of slots) {
    needed[slot] = (needed[slot] || 0) + 1;
  }

  const used = new Set();
  const selected = [];

  // For each slot, pick the best available player by native position chips
  for (const [pos, count] of Object.entries(needed)) {
    const candidates = PLAYERS
      .filter(p => p.position === pos && !used.has(p.id))
      .sort((a, b) => calculateChips(b, pos) - calculateChips(a, pos));
    for (let i = 0; i < count && i < candidates.length; i++) {
      used.add(candidates[i].id);
      selected.push(candidates[i].id);
    }
  }

  // Fill any remaining slots with best available
  if (selected.length < 11) {
    const remaining = PLAYERS
      .filter(p => !used.has(p.id))
      .sort((a, b) => calculateChips(b, b.position) - calculateChips(a, a.position));
    for (const p of remaining) {
      if (selected.length >= 11) break;
      selected.push(p.id);
    }
  }

  return selected.slice(0, 11);
}

export function autoRecommendFormation(selectedIds) {
  const squad = selectedIds.map(id => getPlayerById(id)).filter(Boolean);
  const positions = squad.map(p => p.position);
  const counts = {};
  for (const pos of positions) counts[pos] = (counts[pos] || 0) + 1;

  // Score each formation by how many slots can be filled by natural/adjacent positions
  let bestFormation = FORMATIONS[0];
  let bestScore = -1;

  for (const formation of FORMATIONS) {
    const slotNeeds = [...formation.slots, 'GK'];
    let score = 0;
    const tempCounts = { ...counts };
    for (const slot of slotNeeds) {
      if (tempCounts[slot] > 0) {
        score += 2;
        tempCounts[slot]--;
      } else {
        // Check adjacency
        const adj = POSITION_ADJACENCY[slot];
        if (adj) {
          const adjMatch = adj.adjacent.find(ap => (tempCounts[ap] || 0) > 0);
          if (adjMatch) { score += 1; tempCounts[adjMatch]--; }
        }
      }
    }
    if (score > bestScore) {
      bestScore = score;
      bestFormation = formation;
    }
  }

  return bestFormation.id;
}

// ─── BUILDER SYNERGY STATUS ──────────────────────────────────────────────────
// Returns active + available synergies for the squad-builder pitch.
// field = [{ player, position }] from slot assignments.

function formatPEffect(eff) {
  if (eff.chips) return `+${eff.chips} chips`;
  if (eff.addMult) return `+${eff.addMult} mult`;
  if (eff.xMult) return `x${eff.xMult}`;
  if (eff.carryover) return `+${eff.carryover} carry`;
  if (eff.playerMult) return `x${eff.playerMult}`;
  if (eff.positionMult) return `x${eff.positionMult}`;
  if (eff.addChips) return `+${eff.addChips} chips`;
  return '';
}
function formatSEffect(s) {
  const parts = [];
  if (s.chips) parts.push(`+${s.chips} chips`);
  if (s.addMult) parts.push(`+${s.addMult} mult`);
  if (s.xMult && s.xMult !== 1.0) parts.push(`x${s.xMult}`);
  if (s.carryover) parts.push(`+${s.carryover} carry`);
  return parts.join(' · ') || '';
}

export function getBuilderSynergyStatus(field, formationId) {
  if (!field || field.length === 0) return { active: [], available: [] };

  const squad = field.map(e => e.player);
  const gates = getSynergyGates(formationId);

  const activePersistent = detectSquadSynergies(squad);
  const activePairs = detectSynergies(field, formationId);

  const active = [
    ...activePersistent.map(s => ({
      id: s.id,
      name: s.name,
      effect: formatPEffect(s.effect),
    })),
    ...activePairs.map(s => ({
      id: s.id,
      name: s.name,
      effect: formatSEffect(s),
    })),
  ];

  const activeIds = new Set([
    ...activePersistent.map(s => s.id),
    ...activePairs.map(s => s.id),
  ]);

  // Available: gated by formation, not yet active
  const available = [];
  for (const syn of SYNERGIES) {
    if (activeIds.has(syn.id)) continue;

    if (syn.persistent) {
      // Close if trait count > 0 but < minCount
      const t = syn.trigger;
      let count = 0;
      if (t.trait && !t.traits) {
        count = squad.filter(p => p.traits.includes(t.trait)).length;
      } else if (t.traits) {
        count = squad.filter(p => t.traits.some(tr => p.traits.includes(tr))).length;
      }
      if (count > 0 && count < t.minCount) {
        available.push({
          id: syn.id,
          name: syn.name,
          hint: `need ${t.minCount - count} more`,
        });
      }
    } else if (gates.has(syn.id)) {
      available.push({
        id: syn.id,
        name: syn.name,
        hint: syn.description.replace(/^[^:]*:\s*/, ''),
      });
    }
  }

  return { active, available };
}

// ─── SYNERGY DETAILS (builder panels) ─────────────────────────────────────────
// Given a synergy, the current field, and the pool of unassigned players,
// return who contributes now (active) and who to pick to trigger it (available).

const POS_KEY_STAT = { GK:'def_', CB:'def_', FB:'def_', CDM:'def_', CM:'pas', CAM:'pas', LW:'pac', RW:'pac', ST:'atk' };

export function getSynergyDetails(syn, field, pool) {
  if (!syn) return { contributors: [], picks: [] };
  const t = syn.trigger;
  const contributors = [];
  const picks = [];

  // Persistent trait synergies — the trait itself is the lever
  if (syn.persistent) {
    const trait = t.trait || null;
    const traits = t.traits || null;
    const hasTrait = p => trait ? p.traits.includes(trait) : (traits && traits.some(tr => p.traits.includes(tr)));
    const detail = trait || (traits ? traits.join('+') : '');
    for (const e of field) {
      if (hasTrait(e.player)) contributors.push({ name: e.player.name, pos: e.position, detail });
    }
    const poolTrait = pool.filter(p => hasTrait(p)).slice(0, 5);
    for (const p of poolTrait) picks.push({ name: p.name, pos: p.position, detail });
    return { contributors, picks };
  }

  // Position/stat synergies — figure out which positions+stats are involved
  const involvements = []; // { pos, stat }
  if (t.posA) involvements.push({ pos: t.posA, stat: t.statA || POS_KEY_STAT[t.posA] || 'atk' });
  if (t.posB) involvements.push({ pos: t.posB, stat: t.statB || POS_KEY_STAT[t.posB] || 'pas' });
  if (t.position) involvements.push({ pos: t.position, stat: t.statA || POS_KEY_STAT[t.position] || 'atk' });
  if (t.positions) {
    for (const pos of t.positions) involvements.push({ pos, stat: t.stat || POS_KEY_STAT[pos] || 'pas' });
  }
  if (t.wingerPos) {
    for (const wp of t.wingerPos) involvements.push({ pos: wp, stat: t.statB || 'pac' });
  }
  if (t.stat && involvements.length === 0) {
    // stat+count triggers (back_three, defensive_duo) — any position, that stat
    involvements.push({ pos: 'ANY', stat: t.stat });
  }

  // Contributors: field players sitting in involved positions (dedupe by id)
  const seenC = new Set();
  for (const inv of involvements) {
    for (const e of field) {
      if (inv.pos !== 'ANY' && e.position !== inv.pos) continue;
      if (seenC.has(e.player.id)) continue;
      seenC.add(e.player.id);
      contributors.push({ name: e.player.name, pos: e.position, detail: `${inv.stat.toUpperCase()} ${e.player[inv.stat]}` });
    }
  }

  // Picks: best unassigned players per involved position, sorted by the trigger stat
  const seenP = new Set();
  for (const inv of involvements) {
    const candidates = pool
      .filter(p => inv.pos === 'ANY' || p.position === inv.pos)
      .sort((a, b) => b[inv.stat] - a[inv.stat])
      .slice(0, 2);
    for (const c of candidates) {
      if (seenP.has(c.id)) continue;
      seenP.add(c.id);
      picks.push({ name: c.name, pos: c.position, detail: `${inv.stat.toUpperCase()} ${c[inv.stat]}` });
    }
    if (picks.length >= 6) break;
  }

  return { contributors, picks };
}

export function getScoutingReport(matchIdx) {
  const match = CAMPAIGN_MATCHES[matchIdx];
  if (!match) return 'No scouting data available.';
  const tacDescriptions = (match.tactics || [])
    .map(tid => OPPONENT_TACTICS[tid]?.desc)
    .filter(Boolean)
    .join(' ');
  return `[${match.tier}] vs ${match.opponent}: ${match.intro} Tactics: ${tacDescriptions || 'Unknown.'}`;
}
