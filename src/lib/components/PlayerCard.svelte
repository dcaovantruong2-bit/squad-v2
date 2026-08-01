<script>
  export let player;
  export let selected = false;
  export let onClick = null;
  export let onRemove = null;
  export let compact = false;
  export let showEnergy = false;
  export let energyLevel = 3; // 3=full, 2=tired, 1=drained, 0=exhausted

  const POS_COLORS = {
    GK: '#f59e0b', CB: '#3b82f6', FB: '#60a5fa',
    CDM: '#8b5cf6', CM: '#a78bfa', CAM: '#ec4899',
    LW: '#10b981', RW: '#10b981', ST: '#ef4444'
  };

  const STAT_COLORS = {
    atk: '#ef4444', // red
    pac: '#10b981', // green
    pas: '#3b82f6', // blue
    def_: '#8b5cf6', // purple
    spc: '#f59e0b'  // amber
  };

  const TRAIT_LABELS = {
    pacey:'⚡', clinical:'🎯', technical:'🎩', playmaker:'🧠',
    physical:'💪', destroyer:'🔨', aerial:'✈️', poacher:'🦊',
    leader:'★', journeyman:'🎒'
  };

  $: posColor = POS_COLORS[player.position] || '#aaa';

  // Stat pips 1–10
  function pips(val) {
    return Array.from({length:10}, (_,i) => ({ filled: i < val, high: i >= 7 && i < val }));
  }

  $: statRows = [
    { key:'ATK', val: player.atk, color: STAT_COLORS.atk },
    { key:'PAC', val: player.pac, color: STAT_COLORS.pac },
    { key:'PAS', val: player.pas, color: STAT_COLORS.pas },
    { key:'DEF', val: player.def_, color: STAT_COLORS.def_ },
    { key:'SPC', val: player.spc, color: STAT_COLORS.spc },
  ];

  $: cost = player.atk + player.pac + player.pas + player.def_ + player.spc;

  $: energyColor = energyLevel === 3 ? '#39ff14'
    : energyLevel === 2 ? '#ffd700'
    : energyLevel === 1 ? '#ff8c00'
    : '#ff3344';
  $: energyLabel = energyLevel === 3 ? 'FRESH'
    : energyLevel === 2 ? 'TIRED'
    : energyLevel === 1 ? 'LOW'
    : 'SPENT';
</script>

<!-- svelte-ignore a11y-click-events-have-key-events -->
<!-- svelte-ignore a11y-no-static-element-interactions -->
<div
  class="player-card"
  class:selected
  class:compact
  class:clickable={!!onClick}
  on:click={() => onClick && onClick(player)}
>
  <!-- Header -->
  <div class="card-header">
    <span class="pos-badge" style="background:{posColor}">{player.position}</span>
    <span class="player-name">{player.name}</span>
  </div>

  {#if !compact}
    <!-- Stats -->
    <div class="stats">
      {#each statRows as {key, val, color}}
        <div class="stat-row">
          <span class="stat-label">{key}</span>
          <div class="pips">
            {#each pips(val) as pip}
              <div class="pip" class:filled={pip.filled} class:high={pip.high}></div>
            {/each}
          </div>
          <span class="stat-val" style="color:{color}">{val}</span>
        </div>
      {/each}
    </div>

    <!-- Traits -->
    <div class="traits">
      {#each player.traits as trait}
        <span class="trait-badge">{TRAIT_LABELS[trait] || ''} {trait}</span>
      {/each}
    </div>

    <!-- Description -->
    <p class="desc">{player.description}</p>
  {/if}

  <!-- Footer -->
  <div class="card-footer">
    {#if showEnergy}
      <span class="energy-badge" style="color:{energyColor}">
        ◆ {energyLabel} ({energyLevel}/3)
      </span>
    {:else}
      <span class="cost">COST {cost}</span>
    {/if}

    {#if onRemove}
      <button class="remove-btn" on:click|stopPropagation={() => onRemove(player.id)}>✕</button>
    {/if}

    {#if selected && !onRemove}
      <span class="selected-badge">✓ SELECTED</span>
    {/if}
  </div>
</div>

<style>
  .player-card {
    background: var(--surface);
    border: 1.5px solid var(--border);
    border-radius: var(--r-md);
    padding: 12px;
    transition: border-color 0.15s, box-shadow 0.15s, transform 0.1s;
    user-select: none;
  }
  .player-card.clickable { cursor: pointer; }
  .player-card.clickable:hover {
    border-color: var(--border-bright);
    transform: translateY(-2px);
  }
  .player-card.selected {
    border-color: var(--accent);
    box-shadow: 0 0 12px var(--accent-glow);
  }
  .player-card.compact { padding: 8px 10px; }

  .card-header {
    display: flex; align-items: center; gap: 8px;
    margin-bottom: 10px;
  }
  .pos-badge {
    font-family: var(--font-display);
    font-size: 0.5rem;
    padding: 3px 6px;
    border-radius: 4px;
    color: #000;
    font-weight: bold;
    flex-shrink: 0;
  }
  .player-name {
    font-family: var(--font-body);
    font-size: 1.15rem;
    color: var(--gold);
    flex: 1;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .stats { display: flex; flex-direction: column; gap: 4px; margin-bottom: 10px; }
  .stat-row { display: flex; align-items: center; gap: 6px; }
  .stat-label {
    font-family: var(--font-display);
    font-size: 0.48rem;
    color: var(--muted);
    width: 28px;
    flex-shrink: 0;
  }
  .pips { display: flex; gap: 2px; flex: 1; }
  .pip {
    width: 12px; height: 8px; border-radius: 2px;
    background: var(--surface-raised);
  }
  .pip.filled { background: var(--accent-dim); }
  .pip.filled.high { background: var(--gold); }
  .stat-val {
    font-family: var(--font-display);
    font-size: 0.55rem;
    font-weight: bold;
    width: 18px;
    text-align: right;
  }

  .traits { display: flex; flex-wrap: wrap; gap: 4px; margin-bottom: 8px; }
  .trait-badge {
    font-size: 0.8rem;
    background: var(--surface-raised);
    border: 1px solid var(--border);
    border-radius: 4px;
    padding: 1px 6px;
    color: var(--fg-dim);
  }

  .desc {
    font-size: 0.9rem;
    color: var(--muted);
    font-style: italic;
    margin-bottom: 8px;
  }

  .card-footer {
    display: flex; align-items: center; justify-content: space-between;
    padding-top: 8px;
    border-top: 1px solid var(--border);
    gap: 8px;
  }
  .cost {
    font-family: var(--font-display);
    font-size: 0.5rem;
    color: var(--muted);
  }
  .energy-badge {
    font-family: var(--font-display);
    font-size: 0.5rem;
  }
  .selected-badge {
    font-family: var(--font-display);
    font-size: 0.5rem;
    color: var(--accent);
  }
  .remove-btn {
    font-family: var(--font-body);
    font-size: 1rem;
    background: transparent;
    border: 1px solid var(--danger);
    color: var(--danger);
    padding: 2px 7px;
    border-radius: 4px;
    cursor: pointer;
    line-height: 1;
    transition: background 0.15s;
  }
  .remove-btn:hover { background: var(--danger); color: #fff; }
</style>
