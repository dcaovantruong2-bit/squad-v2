<script>
  import { game, currentMatch, pickPhase, unpickPhase, confirmPhases, navigate } from '../store.js';
  import { ALL_PHASES, COMBO_NO_MATCH_PENALTY } from '../engine/data.js';
  import { evaluateComboChains, estimatePhaseChips, getPunishedTags, getOpponentTactics } from '../engine/engine.js';

  // Phase tag → color (UI-level concern)
  const TAG_COLORS = {
    Defensive:   '#4f8fd8',
    Possession:  '#2acc10',
    Attacking:   '#ff3344',
    Transition:  '#ffa500',
    Specialist:  '#b066ff',
  };

  // Stat → color, matching the radar chart language
  const STAT_COLORS = {
    ATK: '#ff3344',
    PAC: '#39ff14',
    PAS: '#00ccff',
    DEF: '#b066ff',
    SPC: '#ffd700',
  };

  $: match = $currentMatch;
  $: deal = ($game.dealtPhases || [])
    .map(id => ALL_PHASES.find(p => p.id === id))
    .filter(Boolean);
  $: picked = ($game.pickedPhases || [])
    .map(id => ALL_PHASES.find(p => p.id === id))
    .filter(Boolean);
  $: pickedIds = ($game.pickedPhases || []);
  $: punishedTags = getPunishedTags($game);
  $: tactics = getOpponentTactics($game);
  $: chains = evaluateComboChains(pickedIds);
  $: target = match ? match.targets[$game.roundIdx] : 0;
  $: canConfirm = picked.length === 3;
  $: chipsById = Object.fromEntries(
    deal.map(p => [p.id, estimatePhaseChips($game.field, p.id, $game)])
  );

  const humanize = s => s.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

  function tagColor(phase) {
    return phase ? (TAG_COLORS[phase.tag] || '#8070a0') : '#8070a0';
  }

  function isPunished(phase) {
    return punishedTags.includes(phase.tag);
  }

  // Chain preview between consecutive picks, precomputed as a reactive array
  // so the template reads it directly (calling a function in the template
  // hides the `chains` dependency from Svelte's tracker → arrows never update).
  $: arrowInfos = [0, 1].map(i => {
    const c = chains[i];
    if (!c) return null;
    if (!c.matched) {
      return {
        matched: false,
        label: `NO LINK ×${COMBO_NO_MATCH_PENALTY}`,
        color: '#ff3344',
      };
    }
    const eff = c.chain.effect;
    let value = '';
    if (eff === 'xMult') value = `×${c.chain.value}`;
    else if (eff === 'addChips') value = `${c.chain.value > 0 ? '+' : ''}${c.chain.value}`;
    else if (eff === 'fatigueRecovery') value = 'REST';
    const good = eff !== 'addChips' || c.chain.value > 0;
    return {
      matched: true,
      label: value,
      desc: c.chain.desc,
      color: good ? '#39ff14' : '#ff3344',
    };
  });
</script>

<div class="screen phases-screen">
  <!-- Opponent strip -->
  {#if match}
    <div class="opponent-card card">
      <div class="opp-head">
        <div class="opp-meta">
          <span class="tier badge badge-gold">{match.tier}</span>
          <span class="opp-name">{match.opponent}</span>
        </div>
        <span class="target">TARGET <b>{target.toLocaleString()}</b></span>
      </div>
      <p class="intro">{match.intro}</p>
      <div class="tactic-row">
        {#each tactics as tac}
          <span class="tactic-badge" title={tac.desc}>{humanize(tac.id || '')}</span>
        {/each}
      </div>
    </div>
  {/if}

  <!-- Sequence slots -->
  <div class="sequence" aria-label="Picked phase sequence">
    {#each [0, 1, 2] as slotIdx}
      <div class="slot-wrap">
        <button
          class="slot card"
          class:filled={picked[slotIdx]}
          class:empty={!picked[slotIdx]}
          on:click={() => picked[slotIdx] && unpickPhase(slotIdx)}
          style={picked[slotIdx] ? `border-color:${tagColor(picked[slotIdx])};` : ''}
        >
          {#if picked[slotIdx]}
            <span class="slot-phase" style={`color:${tagColor(picked[slotIdx])};`}>{picked[slotIdx].name}</span>
            <span class="slot-tag" style={`background:${tagColor(picked[slotIdx])};`}>{picked[slotIdx].tag}</span>
            <span class="slot-hint">tap to release</span>
          {:else}
            <span class="slot-empty">PHASE {slotIdx + 1}</span>
            <span class="slot-hint">tap a card below</span>
          {/if}
        </button>

        {#if slotIdx < 2}
          {@const info = arrowInfos[slotIdx]}
          <div class="arrow">
            {#if info}
              <span class="chain-value" style={`color:${info.color};`}>{info.label}</span>
              {#if info.desc}<span class="chain-desc">{info.desc}</span>{/if}
            {:else}
              <span class="chain-empty">—</span>
            {/if}
          </div>
        {/if}
      </div>
    {/each}
  </div>

  <!-- Dealt hand -->
  <div class="hand-section">
    <p class="hand-title">THE DEAL — PICK {picked.length}/3</p>
    <div class="hand">
      {#each deal as phase}
        <button
          class="phase-card card"
          class:punished={isPunished(phase)}
          class:picked={pickedIds.includes(phase.id)}
          class:disabled={pickedIds.includes(phase.id) || (picked.length >= 3 && !pickedIds.includes(phase.id))}
          on:click={() => pickPhase(phase.id)}
          style={`border-top:4px solid ${tagColor(phase)};`}
        >
          <div class="pc-top">
            <span class="pc-tag" style={`color:${tagColor(phase)};`}>{phase.tag}</span>
            {#if isPunished(phase)}<span class="warn-badge" title="Opponent punishes this style">⚠</span>{/if}
          </div>
          <div class="pc-name">{phase.name}</div>
          <div class="pc-rows">
            <span class="pc-weight" style={`color:${STAT_COLORS[phase.weight] || '#fff'};`}>{phase.weight}</span>
            <span class="pc-slots">{phase.slots.flat().join(' · ')}</span>
          </div>
          <div class="pc-est">
            <span class="est-num">{chipsById[phase.id] ?? 0}</span>
            <span class="est-label">base pts</span>
          </div>
          <div class="pc-desc">{phase.desc}</div>
        </button>
      {/each}
    </div>
  </div>

  <!-- Footer -->
  <div class="footer">
    <button class="btn-secondary" on:click={() => navigate('title')}>← TITLE</button>
    <button class="btn-primary kickoff" disabled={!canConfirm} on:click={confirmPhases}>
      ▶ KICK OFF
    </button>
  </div>
</div>

<style>
  .phases-screen {
    gap: 14px;
    max-width: 560px;
  }

  /* ── Opponent strip ─────────────────────────────── */
  .opponent-card { padding: 12px 14px; }
  .opp-head {
    display: flex; justify-content: space-between; align-items: center;
    gap: 10px; margin-bottom: 6px;
  }
  .opp-meta { display: flex; align-items: center; gap: 8px; min-width: 0; }
  .opp-name {
    font-family: var(--font-display); font-size: 0.6rem;
    color: var(--fg); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  }
  .target {
    font-family: var(--font-display); font-size: 0.5rem;
    color: var(--muted); white-space: nowrap;
  }
  .target b { color: var(--gold); }
  .intro { font-size: 0.95rem; color: var(--fg-dim); margin-bottom: 8px; }
  .tactic-row { display: flex; flex-wrap: wrap; gap: 6px; }
  .tactic-badge {
    font-family: var(--font-display); font-size: 0.45rem;
    color: var(--warn); background: rgba(255,165,0,0.12);
    border: 1px solid rgba(255,165,0,0.4);
    padding: 3px 8px; border-radius: 4px;
    cursor: help;
  }

  /* ── Sequence slots ─────────────────────────────── */
  .sequence {
    display: flex; flex-direction: column; gap: 6px;
  }
  .slot-wrap { display: flex; align-items: stretch; }
  .slot {
    flex: 1; min-width: 0; display: flex; flex-direction: column;
    align-items: center; justify-content: center; gap: 4px;
    padding: 10px; cursor: default; border-radius: var(--r-md);
  }
  .slot.filled { cursor: pointer; background: var(--surface-raised); }
  .slot.empty {
    border-style: dashed; border-color: var(--border);
    background: transparent;
  }
  .slot-phase {
    font-family: var(--font-display); font-size: 0.62rem;
    text-align: center; line-height: 1.4;
  }
  .slot-tag {
    font-family: var(--font-display); font-size: 0.45rem;
    color: #000; padding: 2px 8px; border-radius: 4px;
  }
  .slot-empty {
    font-family: var(--font-display); font-size: 0.55rem;
    color: var(--muted);
  }
  .slot-hint { font-size: 0.8rem; color: var(--muted); }

  .arrow {
    display: flex; flex-direction: column; align-items: center; justify-content: center;
    min-width: 88px; max-width: 88px; padding: 2px 6px;
    border-top: 2px dashed var(--border); border-bottom: 2px dashed var(--border);
    border-radius: 4px;
    gap: 2px;
  }
  .chain-value {
    font-family: var(--font-display); font-size: 0.55rem;
    white-space: nowrap;
  }
  .chain-desc {
    font-size: 0.68rem; color: var(--muted); text-align: center;
    line-height: 1.15;
  }
  .chain-empty { color: var(--border-bright); }

  /* ── Hand ───────────────────────────────────────── */
  .hand-section { display: flex; flex-direction: column; gap: 8px; }
  .hand-title {
    font-family: var(--font-display); font-size: 0.5rem;
    color: var(--gold); letter-spacing: 0.12em;
  }
  .hand {
    display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
    gap: 10px;
  }
  .phase-card {
    text-align: left; padding: 10px; cursor: pointer;
    display: flex; flex-direction: column; gap: 5px;
    background: var(--surface);
    transition: transform 0.1s, box-shadow 0.2s;
  }
  .phase-card:not(:disabled):hover { transform: translateY(-2px); box-shadow: 0 4px 14px rgba(0,0,0,0.4); }
  .phase-card:disabled { cursor: not-allowed; opacity: 0.35; }
  .phase-card.picked {
    border-color: var(--accent); box-shadow: 0 0 10px var(--accent-glow);
    opacity: 1;
  }
  .phase-card.punished:not(:disabled) { box-shadow: inset 0 0 0 1px rgba(255,51,68,0.35); }

  .pc-top { display: flex; justify-content: space-between; align-items: center; }
  .pc-tag {
    font-family: var(--font-display); font-size: 0.42rem;
    letter-spacing: 0.08em;
  }
  .warn-badge {
    font-size: 0.9rem; color: var(--danger);
    text-shadow: 0 0 8px var(--danger-glow);
    cursor: help;
  }
  .pc-name {
    font-family: var(--font-display); font-size: 0.58rem;
    color: var(--fg); line-height: 1.35;
  }
  .pc-rows { display: flex; align-items: baseline; gap: 6px; }
  .pc-weight {
    font-family: var(--font-display); font-size: 0.6rem;
  }
  .pc-slots { font-size: 0.8rem; color: var(--fg-dim); }
  .pc-est {
    display: flex; align-items: baseline; gap: 5px;
    background: var(--bg-deep); border-radius: 4px; padding: 2px 8px;
  }
  .est-num {
    font-family: var(--font-display); font-size: 0.62rem; color: var(--gold);
  }
  .est-label { font-size: 0.75rem; color: var(--muted); }
  .pc-desc { font-size: 0.8rem; color: var(--muted); line-height: 1.25; }

  /* ── Footer ─────────────────────────────────────── */
  .footer {
    display: flex; gap: 10px; justify-content: space-between;
    margin-top: auto; padding-top: 6px;
  }
  .kickoff { flex: 1; }
  .kickoff:disabled {
    background: var(--surface-raised); color: var(--muted);
    box-shadow: none; cursor: not-allowed;
  }
</style>
