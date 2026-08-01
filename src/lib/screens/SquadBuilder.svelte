<script>
  import { game, screen, setBuilderFormation, assignPlayerToSlot, clearSlot, autoFillFormation, confirmSquad, slotEligibility } from '../store.js';
  import { PLAYERS, CHIPS_FORMULA, FORMATIONS, SYNERGIES } from '../engine/data.js';
  import { getBuilderSynergyStatus, getSynergyDetails } from '../engine/engine.js';
  import PlayerCard from '../components/PlayerCard.svelte';

  const MAX_SQUAD = 11;
  const BUDGET = 290;

  const POS_COLORS = {
    GK: '#f59e0b', CB: '#3b82f6', FB: '#60a5fa',
    CDM: '#8b5cf6', CM: '#a78bfa', CAM: '#ec4899',
    LW: '#10b981', RW: '#10b981', ST: '#ef4444'
  };
  const STAT_COLORS = {
    atk: '#ef4444', pac: '#10b981', pas: '#3b82f6', def_: '#8b5cf6', spc: '#f59e0b'
  };
  const TRAIT_ICONS = {
    pacey:'⚡', clinical:'🎯', technical:'🎩', playmaker:'🧠',
    physical:'💪', destroyer:'🔨', aerial:'✈️', poacher:'🦊',
    leader:'★', journeyman:'🎒'
  };
  // Stat order for mini bars / header — ATK top, clockwise per radar
  const STAT_KEYS = ['atk','pac','pas','def_','spc'];
  const STAT_LABELS = { atk:'ATK', pac:'PAC', pas:'PAS', def_:'DEF', spc:'SPC' };

  // ─── State ───────────────────────────────────────────────────────────────
  let openSlot = null;
  let overlaySearch = '';
  let overlaySort = 'value';
  let inspectPlayerId = null;
  let expandedSyn = null;   // synergy id currently expanded in side panels

  $: formation = FORMATIONS.find(f => f.id === $game.formation) || FORMATIONS[0];
  $: layout = formation.pitchLayout;
  $: assign = $game.slotAssignments || {};
  $: filledCount = Object.values(assign).filter(Boolean).length;
  $: canProceed = filledCount === MAX_SQUAD;
  $: assignedIds = new Set(Object.values(assign).filter(Boolean));

  $: squadCost = [...assignedIds].reduce((sum, id) => {
    const p = PLAYERS.find(p => p.id === id);
    return sum + (p ? p.atk + p.pac + p.pas + p.def_ + p.spc : 0);
  }, 0);
  $: budgetLeft = BUDGET - squadCost;
  $: budgetPct = Math.max(0, Math.min(100, (budgetLeft / BUDGET) * 100));

  $: returnedNotice = ($game._lastReturnedPlayers && $game._lastReturnedPlayers.length)
    ? $game._lastReturnedPlayers : null;

  // Build a field array from slot assignments for synergy detection
  $: builderField = layout.map((slot, idx) => {
    const pid = assign[idx];
    if (!pid) return null;
    const p = PLAYERS.find(pl => pl.id === pid);
    return p ? { player: p, position: slot.pos } : null;
  }).filter(Boolean);

  $: synergies = getBuilderSynergyStatus(builderField, formation.id);

  // Unassigned pool for synergy "who to pick" suggestions
  $: poolPlayers = PLAYERS.filter(p => !assignedIds.has(p.id));

  // Details for the currently expanded synergy
  $: expandedDetails = (() => {
    if (!expandedSyn) return null;
    const syn = SYNERGIES.find(s => s.id === expandedSyn);
    if (!syn) return null;
    return getSynergyDetails(syn, builderField, poolPlayers);
  })();

  function toggleSynergy(id) {
    expandedSyn = expandedSyn === id ? null : id;
  }

  function getChips(player, pos) {
    const f = CHIPS_FORMULA[pos];
    return f ? f(player) : 0;
  }
  function cost(p) { return p.atk + p.pac + p.pas + p.def_ + p.spc; }
  function canAfford(p) {
    if (assignedIds.has(p.id)) return true;
    return budgetLeft >= cost(p);
  }

  // ─── Overlay eligible list ───────────────────────────────────────────────
  $: openSlotPos = openSlot !== null ? layout[openSlot].pos : null;
  $: eligible = (() => {
    if (openSlot === null) return { natural: [], adjacent: [] };
    const pos = layout[openSlot].pos;
    const currentInSlot = assign[openSlot];
    const matchSearch = p => !overlaySearch || p.name.toLowerCase().includes(overlaySearch.toLowerCase());
    const sortFn = (a, b) => {
      if (overlaySort === 'name') return a.name.localeCompare(b.name);
      if (overlaySort === 'cost') return cost(b) - cost(a);
      return getChips(b, pos) - getChips(a, pos);
    };
    const natural = [], adjacent = [];
    for (const p of PLAYERS) {
      if (!matchSearch(p)) continue;
      const elig = slotEligibility(p, pos);
      if (elig === 'natural') natural.push(p);
      else if (elig === 'adjacent') adjacent.push(p);
    }
    natural.sort(sortFn); adjacent.sort(sortFn);
    return { natural, adjacent, currentInSlot };
  })();

  function openSlotOverlay(idx) { openSlot = idx; overlaySearch = ''; inspectPlayerId = null; }
  function closeOverlay() { openSlot = null; inspectPlayerId = null; }

  function pickPlayer(p) {
    if (openSlot === null) return;
    if (!assignedIds.has(p.id) && !canAfford(p)) return;
    assignPlayerToSlot(openSlot, p.id);
    closeOverlay();
  }
  function removeFromOpenSlot() {
    if (openSlot === null) return;
    clearSlot(openSlot);
    closeOverlay();
  }
  function inspect(e, playerId) {
    e.preventDefault();
    e.stopPropagation();
    inspectPlayerId = inspectPlayerId === playerId ? null : playerId;
  }

  function playerById(id) { return PLAYERS.find(p => p.id === id) || null; }
  function statLine(p) {
    return [
      { v: p.atk, c: STAT_COLORS.atk },
      { v: p.pac, c: STAT_COLORS.pac },
      { v: p.pas, c: STAT_COLORS.pas },
      { v: p.def_, c: STAT_COLORS.def_ },
      { v: p.spc, c: STAT_COLORS.spc },
    ];
  }
  function isOutOfPosition(p, slotPos) {
    return slotEligibility(p, slotPos) === 'adjacent';
  }

  // ─── Radar chart (colored spokes + rings + numbers) ──────────────────────
  // 5 axes: ATK (top), PAC (top-right), PAS (bottom-right), DEF (bottom-left), SPC (top-left)
  const RADAR_AXES = [
    { key: 'atk',  label: 'ATK', anchor: 'middle', color: STAT_COLORS.atk,  angle: -Math.PI / 2 },
    { key: 'pac',  label: 'PAC', anchor: 'end',    color: STAT_COLORS.pac,  angle: -Math.PI / 2 + (2 * Math.PI) / 5 },
    { key: 'pas',  label: 'PAS', anchor: 'end',    color: STAT_COLORS.pas,  angle: -Math.PI / 2 + (4 * Math.PI) / 5 },
    { key: 'def_', label: 'DEF', anchor: 'start',  color: STAT_COLORS.def_, angle: -Math.PI / 2 + (6 * Math.PI) / 5 },
    { key: 'spc',  label: 'SPC', anchor: 'start',  color: STAT_COLORS.spc,  angle: -Math.PI / 2 + (8 * Math.PI) / 5 },
  ];
  function radarGeometry(p, size) {
    const cx = size / 2, cy = size / 2;
    const rMax = size / 2 - 20;
    const rHalf = rMax * 0.5;
    const corner = (r, a) => ({ x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r });
    const axes = RADAR_AXES.map(axis => {
      const val = p[axis.key];
      const v = Math.max(0, Math.min(10, val)) / 10;
      return {
        ...axis, val,
        full: corner(rMax, axis.angle),
        half: corner(rHalf, axis.angle),
        data: corner(rMax * v, axis.angle),
        // Top axis (ATK) label inside the chart to avoid clipping at the SVG edge;
        // all others sit just outside the outer ring.
        labelPos: corner(axis.key === 'atk' ? rMax - 14 : rMax + 14, axis.angle),
      };
    });
    return {
      axes,
      dataPoly: axes.map(a => `${a.data.x},${a.data.y}`).join(' '),
      ringFull: axes.map(a => `${a.full.x},${a.full.y}`).join(' '),
      ringHalf: axes.map(a => `${a.half.x},${a.half.y}`).join(' '),
      cx, cy,
    };
  }
</script>

<div class="screen builder-screen">
  <!-- Header -->
  <div class="header">
    <button class="back-btn btn-secondary" on:click={() => screen.set('title')}>← BACK</button>
    <div class="formation-picker">
      {#each FORMATIONS as f}
        <button
          class="form-btn"
          class:active={f.id === formation.id}
          on:click={() => setBuilderFormation(f.id)}
        >{f.name}</button>
      {/each}
    </div>
    <div class="squad-count" class:full={canProceed}>
      <span class="count">{filledCount}</span><span class="max">/{MAX_SQUAD}</span>
    </div>
  </div>

  <!-- Budget + actions bar -->
  <div class="subbar">
    <div class="budget">
      <span class="budget-label">BUDGET</span>
      <div class="budget-bar">
        <div class="budget-fill" class:low={budgetLeft < 40} class:danger={budgetLeft < 0} style="width:{budgetPct}%"></div>
      </div>
      <span class="budget-num" class:low={budgetLeft < 40} class:danger={budgetLeft < 0}>{budgetLeft}/{BUDGET}</span>
    </div>
    <button class="btn-secondary action-btn" on:click={autoFillFormation}>⚡ AUTO-FILL</button>
    <button class="btn-primary action-btn confirm" disabled={!canProceed || budgetLeft < 0} on:click={confirmSquad}>
      CONFIRM →
    </button>
  </div>

  {#if returnedNotice}
    <div class="toast">Formation changed — returned to pool: {returnedNotice.join(', ')}</div>
  {/if}

  <!-- Pitch + side panels -->
  <div class="pitch-wrap">
    <!-- Left: Active synergies -->
    <div class="side-panel left-panel">
      <div class="panel-title active">ACTIVE</div>
      <div class="panel-list">
        {#if synergies.active.length === 0}
          <div class="panel-empty">No synergies yet</div>
        {:else}
          {#each synergies.active as s}
            <div class="syn-item active-item">
              <button class="syn-toggle" on:click={() => toggleSynergy(s.id)}>
                <span class="syn-check">✓</span>
                <span class="syn-body">
                  <span class="syn-name">{s.name}</span>
                  <span class="syn-act-eff">{s.effect}</span>
                </span>
                <span class="syn-caret">{expandedSyn === s.id ? '−' : '+'}</span>
              </button>
              {#if expandedSyn === s.id && expandedDetails}
                <div class="syn-detail">
                  {#if expandedDetails.contributors.length}
                    <div class="syn-detail-label">CONTRIBUTING</div>
                    {#each expandedDetails.contributors.slice(0, 6) as c}
                      <div class="syn-player"><span class="syn-pos" style="color:{POS_COLORS[c.pos] || '#888'}">{c.pos}</span> <span class="syn-pname">{c.name}</span></div>
                    {/each}
                  {:else}
                    <div class="syn-detail-empty">No direct contributors</div>
                  {/if}
                </div>
              {/if}
            </div>
          {/each}
        {/if}
      </div>
    </div>

    <!-- Pitch -->
    <div class="pitch">
      <div class="pline centre-circle"></div>
      <div class="pline centre-line"></div>
      <div class="pline pbox top"></div>
      <div class="pline pbox bottom"></div>
      <div class="pline six top"></div>
      <div class="pline six bottom"></div>

      {#each layout as slot, idx}
        {@const pid = assign[idx]}
        {@const p = pid ? playerById(pid) : null}
        {@const oop = p ? isOutOfPosition(p, slot.pos) : false}
        <button
          class="slot"
          class:filled={!!p}
          class:open={openSlot === idx}
          class:empty={!p}
          style="left:{slot.x}%; top:{slot.y}%; --slot-color:{POS_COLORS[slot.pos] || '#888'}"
          on:click={() => openSlotOverlay(idx)}
        >
          {#if p}
            <span class="slot-badge" style="background:{POS_COLORS[slot.pos]}">{slot.pos}</span>
            <span class="slot-name">{p.name}</span>
            {@const rg = radarGeometry(p, 96)}
            <svg class="slot-radar" viewBox="0 0 96 96" width="96" height="96">
              <!-- guide rings -->
              <polygon class="rg-ring" points={rg.ringFull} />
              <polygon class="rg-ring half" points={rg.ringHalf} />
              <!-- colored spokes -->
              {#each rg.axes as ax}
                <line class="rg-spoke" x1={rg.cx} y1={rg.cy} x2={ax.full.x} y2={ax.full.y} style="--sc:{ax.color}" />
              {/each}
              <!-- data polygon -->
              <polygon class="rg-data" points={rg.dataPoly} style="--rc:{POS_COLORS[slot.pos] || '#39ff14'}" />
              <!-- vertex dots + numbers -->
              {#each rg.axes as ax}
                <circle class="rg-vertex" cx={ax.data.x} cy={ax.data.y} r="2.5" style="--vc:{ax.color}" />
                <text class="rg-num" x={ax.data.x} y={ax.data.y} style="fill:{ax.color}">{p[ax.key]}</text>
              {/each}
              <!-- axis labels -->
              {#each rg.axes as ax}
                <text class="rg-axis" x={ax.labelPos.x} y={ax.labelPos.y} text-anchor={ax.anchor} style="fill:{ax.color}">{ax.label}</text>
              {/each}
            </svg>
            {#if oop}<span class="oop" title="Out of position — reduced output">⚠</span>{/if}
          {:else}
            <span class="slot-pos-label">{slot.pos}</span>
            <span class="slot-plus">+</span>
          {/if}
        </button>
      {/each}
    </div>

    <!-- Right: Available / gated synergies -->
    <div class="side-panel right-panel">
      <div class="panel-title avail">AVAILABLE</div>
      <div class="panel-list">
        {#if synergies.available.length === 0}
          <div class="panel-empty">All clear — or no slots filled yet</div>
        {:else}
          {#each synergies.available as s}
            <div class="syn-item avail-item">
              <button class="syn-toggle" on:click={() => toggleSynergy(s.id)}>
                <span class="syn-dot">◇</span>
                <span class="syn-body">
                  <span class="syn-name">{s.name}</span>
                  <span class="syn-hint">{s.hint}</span>
                </span>
                <span class="syn-caret">{expandedSyn === s.id ? '−' : '+'}</span>
              </button>
              {#if expandedSyn === s.id && expandedDetails}
                <div class="syn-detail">
                  {#if expandedDetails.picks.length}
                    <div class="syn-detail-label">PICK TO TRIGGER</div>
                    {#each expandedDetails.picks.slice(0, 6) as c}
                      <div class="syn-player"><span class="syn-pos" style="color:{POS_COLORS[c.pos] || '#888'}">{c.pos}</span> {c.name} <span class="syn-stat">{c.detail}</span></div>
                    {/each}
                  {:else}
                    <div class="syn-detail-empty">No unassigned picks available</div>
                  {/if}
                </div>
              {/if}
            </div>
          {/each}
        {/if}
      </div>
    </div>

    {#if filledCount === 0}
      <div class="hint">Tap any position to pick a player — start with your GK!</div>
    {/if}
  </div>
</div>

<!-- Overlay -->
{#if openSlot !== null}
  <!-- svelte-ignore a11y-click-events-have-key-events a11y-no-static-element-interactions -->
  <div class="overlay-backdrop" on:click={closeOverlay}>
    <!-- svelte-ignore a11y-click-events-have-key-events a11y-no-static-element-interactions -->
    <div class="overlay" on:click|stopPropagation>
      <div class="overlay-head">
        <button class="ov-close" on:click={closeOverlay}>◄</button>
        <span class="ov-title" style="color:{POS_COLORS[openSlotPos]}">
          SELECT {openSlotPos}
        </span>
        <span class="ov-count">{eligible.natural.length} natural · {eligible.adjacent.length} adjacent</span>
      </div>

      <div class="overlay-controls">
        <input class="ov-search" placeholder="Search..." bind:value={overlaySearch} />
        <select class="ov-sort" bind:value={overlaySort}>
          <option value="value">Value</option>
          <option value="cost">Cost</option>
          <option value="name">Name</option>
        </select>
      </div>

      <div class="overlay-list">
        <!-- Sticky header row -->
        <div class="prow header-row">
          <span class="pr-badge-h">POS</span>
          <span class="pr-name-h">NAME</span>
          <span class="pr-traits-h">TRAITS</span>
          {#each STAT_KEYS as k}
            <span class="pr-stat-h" style="color:{STAT_COLORS[k]}">{STAT_LABELS[k]}</span>
          {/each}
          <span class="pr-cost-h">COST</span>
          <span class="pr-info-h"></span>
        </div>

        {#if eligible.currentInSlot}
          <div class="section-label">CURRENTLY IN SLOT</div>
          {@const cp = playerById(eligible.currentInSlot)}
          {#if cp}
            <div class="prow current">
              <span class="pr-badge" style="background:{POS_COLORS[cp.position]}">{cp.position}</span>
              <span class="pr-name">{cp.name}</span>
              <span class="pr-traits">{#each cp.traits as t}{TRAIT_ICONS[t] || ''}{/each}</span>
              <span class="pr-stats">{#each statLine(cp) as s}<span style="color:{s.c}">{s.v}</span>{/each}</span>
              <span class="pr-cost">{cost(cp)}</span>
              <span class="pr-info-spacer"></span>
            </div>
          {/if}
        {/if}

        {#if eligible.natural.length}
          <div class="section-label">NATURAL</div>
          {#each eligible.natural as p (p.id)}
            {@const used = assignedIds.has(p.id) && assign[openSlot] !== p.id}
            {@const afford = canAfford(p)}
            <!-- svelte-ignore a11y-click-events-have-key-events a11y-no-static-element-interactions -->
            <div class="prow" class:used class:cant={!afford && !used} on:click={() => !used && pickPlayer(p)}>
              <span class="pr-badge" style="background:{POS_COLORS[p.position]}">{p.position}</span>
              <span class="pr-name">{p.name}</span>
              <span class="pr-traits">{#each p.traits as t}{TRAIT_ICONS[t] || ''}{/each}</span>
              <span class="pr-stats">{#each statLine(p) as s}<span style="color:{s.c}">{s.v}</span>{/each}</span>
              <span class="pr-cost" class:over={!afford && !used}>{cost(p)}</span>
              <button class="pr-info" on:click={(e) => inspect(e, p.id)}>ⓘ</button>
              {#if used}<span class="pr-flag">IN USE</span>{/if}
            </div>
            {#if inspectPlayerId === p.id}
              <div class="inspect"><PlayerCard player={p} compact={false} /></div>
            {/if}
          {/each}
        {/if}

        {#if eligible.adjacent.length}
          <div class="section-label adj">ADJACENT (out of position)</div>
          {#each eligible.adjacent as p (p.id)}
            {@const used = assignedIds.has(p.id) && assign[openSlot] !== p.id}
            {@const afford = canAfford(p)}
            <!-- svelte-ignore a11y-click-events-have-key-events a11y-no-static-element-interactions -->
            <div class="prow adj-row" class:used class:cant={!afford && !used} on:click={() => !used && pickPlayer(p)}>
              <span class="pr-badge" style="background:{POS_COLORS[p.position]}">{p.position}</span>
              <span class="pr-name">{p.name}</span>
              <span class="pr-traits">{#each p.traits as t}{TRAIT_ICONS[t] || ''}{/each}</span>
              <span class="pr-stats">{#each statLine(p) as s}<span style="color:{s.c}">{s.v}</span>{/each}</span>
              <span class="pr-cost" class:over={!afford && !used}>{cost(p)}</span>
              <button class="pr-info" on:click={(e) => inspect(e, p.id)}>ⓘ</button>
              {#if used}<span class="pr-flag">IN USE</span>{/if}
            </div>
            {#if inspectPlayerId === p.id}
              <div class="inspect"><PlayerCard player={p} compact={false} /></div>
            {/if}
          {/each}
        {/if}

        {#if !eligible.natural.length && !eligible.adjacent.length}
          <div class="empty-state">No eligible players for this position.</div>
        {/if}
      </div>

      {#if assign[openSlot]}
        <div class="overlay-foot">
          <button class="btn-danger remove-slot" on:click={removeFromOpenSlot}>✕ REMOVE PLAYER</button>
        </div>
      {/if}
    </div>
  </div>
{/if}

<style>
  .builder-screen {
    height: 100vh; max-width: none;
    padding: 10px 12px; gap: 8px;
    display: flex; flex-direction: column; overflow: hidden;
  }

  /* Header */
  .header { display: flex; align-items: center; gap: 10px; flex-shrink: 0; }
  .back-btn { padding: 6px 12px; font-size: 0.5rem; width: auto; }
  .formation-picker { display: flex; gap: 4px; flex: 1; flex-wrap: wrap; justify-content: center; }
  .form-btn {
    font-family: var(--font-display); font-size: 0.45rem;
    padding: 5px 9px; background: var(--surface-raised);
    color: var(--muted); border: 1px solid var(--border);
    border-radius: 4px; width: auto;
  }
  .form-btn.active { background: var(--accent); color: #000; border-color: var(--accent); box-shadow: 0 0 8px var(--accent-glow); }
  .squad-count { font-family: var(--font-display); padding: 6px 12px; background: var(--surface-raised); border: 1px solid var(--border); border-radius: var(--r-sm); }
  .squad-count.full { border-color: var(--accent); box-shadow: 0 0 8px var(--accent-glow); }
  .squad-count .count { font-size: 0.8rem; color: var(--accent); }
  .squad-count .max { font-size: 0.55rem; color: var(--muted); }

  /* Subbar */
  .subbar { display: flex; align-items: center; gap: 10px; flex-shrink: 0; }
  .budget { display: flex; align-items: center; gap: 8px; flex: 1; }
  .budget-label { font-family: var(--font-display); font-size: 0.45rem; color: var(--muted); }
  .budget-bar { flex: 1; height: 8px; background: var(--surface-raised); border-radius: 4px; overflow: hidden; max-width: 260px; }
  .budget-fill { height: 100%; background: var(--accent); transition: width 0.3s; }
  .budget-fill.low { background: var(--warn); }
  .budget-fill.danger { background: var(--danger); }
  .budget-num { font-family: var(--font-display); font-size: 0.5rem; color: var(--accent); }
  .budget-num.low { color: var(--warn); }
  .budget-num.danger { color: var(--danger); }
  .action-btn { padding: 8px 12px; font-size: 0.5rem; width: auto; }
  .confirm:disabled { opacity: 0.4; cursor: not-allowed; box-shadow: none; }
  .toast { flex-shrink: 0; background: rgba(255,165,0,0.12); border: 1px solid var(--warn); color: var(--warn); font-family: var(--font-body); font-size: 0.9rem; padding: 6px 10px; border-radius: var(--r-sm); text-align: center; }

  /* Pitch wrap with side panels */
  .pitch-wrap { flex: 1; min-height: 0; display: flex; align-items: stretch; gap: 8px; position: relative; }

  .side-panel {
    flex: 0 0 220px;
    display: flex; flex-direction: column;
    background: var(--surface); border: 1px solid var(--border);
    border-radius: var(--r-md); overflow: hidden;
  }
  .panel-title { font-family: var(--font-display); font-size: 0.5rem; padding: 8px 10px; border-bottom: 1px solid var(--border); letter-spacing: 0.05em; }
  .panel-title.active { color: var(--accent); }
  .panel-title.avail { color: var(--fg-dim); }
  .panel-list { flex: 1; overflow-y: auto; padding: 6px; }
  .panel-empty { color: var(--muted); font-family: var(--font-body); font-size: 0.9rem; text-align: center; padding: 16px 6px; }

  .syn-item { border-bottom: 1px solid rgba(58,40,96,0.3); }
  .syn-item:last-child { border-bottom: none; }
  .syn-toggle {
    display: flex; align-items: center; gap: 6px;
    width: 100%; text-align: left;
    background: none; border: none; padding: 6px 8px;
    font-family: var(--font-body);
    cursor: pointer; border-radius: 4px;
  }
  .syn-toggle:hover { background: var(--surface-raised); }
  .syn-check { color: var(--accent); font-weight: bold; font-size: 0.85rem; flex-shrink: 0; }
  .syn-dot { color: var(--fg-dim); flex-shrink: 0; }
  .syn-body { flex: 1; min-width: 0; }
  .syn-name { font-family: var(--font-body); font-size: 0.95rem; color: var(--gold); display: block; line-height: 1.15; }
  .syn-act-eff { font-family: var(--font-display); font-size: 0.42rem; color: var(--accent); display: block; margin-top: 2px; }
  .syn-hint { font-family: var(--font-body); font-size: 0.85rem; color: var(--muted); display: block; margin-top: 2px; line-height: 1.3; }
  .syn-caret { font-family: var(--font-display); font-size: 0.5rem; color: var(--muted); flex-shrink: 0; }
  .syn-detail { padding: 4px 8px 8px 22px; border-top: 1px dashed rgba(58,40,96,0.4); }
  .syn-detail-label { font-family: var(--font-display); font-size: 0.4rem; color: var(--muted); letter-spacing: 0.05em; margin: 6px 0 4px; }
  .syn-player { font-family: var(--font-body); font-size: 0.9rem; color: var(--fg); line-height: 1.3; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .syn-pname { color: var(--fg); }
  .syn-pos { font-family: var(--font-display); font-size: 0.38rem; margin-right: 3px; }
  .syn-stat { font-family: var(--font-display); font-size: 0.4rem; color: var(--fg-dim); margin-left: 4px; }
  .syn-detail-empty { font-family: var(--font-body); font-size: 0.85rem; color: var(--muted); padding: 4px 0; }

  /* Pitch */
  .pitch {
    flex: 1; position: relative;
    height: 100%; max-height: 100%;
    aspect-ratio: 82/100; margin: 0 auto;
    background: linear-gradient(0deg, #0a2818 0%, #0d3320 50%, #0a2818 100%);
    border-radius: var(--r-md); border: 2px solid var(--pitch-line);
    box-shadow: inset 0 0 40px rgba(0,0,0,0.4);
  }
  .pline { position: absolute; border: 1.5px solid var(--pitch-line); background: transparent; }
  .centre-circle { width: 22%; aspect-ratio: 1; border-radius: 50%; top: 50%; left: 50%; transform: translate(-50%,-50%); }
  .centre-line { width: 100%; height: 0; top: 50%; left: 0; border: none; border-top: 1.5px solid var(--pitch-line); }
  .pbox { width: 46%; height: 14%; left: 50%; transform: translateX(-50%); }
  .pbox.top { top: 0; border-top: none; }
  .pbox.bottom { bottom: 0; border-bottom: none; }
  .six { width: 24%; height: 6%; left: 50%; transform: translateX(-50%); }
  .six.top { top: 0; border-top: none; }
  .six.bottom { bottom: 0; border-bottom: none; }

  .slot {
    position: absolute; transform: translate(-50%, -50%);
    width: 128px; height: 150px;
    border-radius: 12px;
    border: 2px dashed rgba(255,255,255,0.25);
    background: rgba(0,0,0,0.35);
    display: flex; flex-direction: column; align-items: center; justify-content: center;
    gap: 1px; padding: 4px;
    cursor: pointer; z-index: 2;
    transition: transform 0.12s, border-color 0.12s, box-shadow 0.12s;
  }
  .slot.empty:hover { border-color: var(--accent); transform: translate(-50%,-50%) scale(1.06); }
  .slot.open { border-color: var(--accent); border-style: solid; box-shadow: 0 0 14px var(--accent-glow); }
  .slot.filled {
    border-style: solid; border-color: var(--slot-color);
    background: color-mix(in srgb, var(--slot-color) 22%, #0a0a0a);
    box-shadow: 0 2px 8px rgba(0,0,0,0.5);
  }
  .slot.filled:hover { transform: translate(-50%,-50%) scale(1.06); box-shadow: 0 0 12px rgba(0,0,0,0.6); }
  .slot-pos-label { font-family: var(--font-display); font-size: 0.5rem; color: rgba(255,255,255,0.6); }
  .slot-plus { font-family: var(--font-display); font-size: 0.7rem; color: rgba(255,255,255,0.35); }
  .slot-badge { font-family: var(--font-display); font-size: 0.32rem; color: #000; padding: 1px 4px; border-radius: 3px; font-weight: bold; }
  .slot-name {
    font-family: var(--font-body); font-size: 0.88rem; color: var(--gold);
    text-align: center; line-height: 0.95; max-width: 140px;
    overflow: hidden; text-overflow: ellipsis; display: -webkit-box;
    -webkit-line-clamp: 1; -webkit-box-orient: vertical; white-space: nowrap;
  }
  .slot-radar { pointer-events: none; flex-shrink: 0; }
  .rg-ring { fill: none; stroke: rgba(255,255,255,0.10); stroke-width: 1; }
  .rg-ring.half { stroke: rgba(255,255,255,0.07); stroke-dasharray: 2,2; }
  .rg-spoke { stroke: var(--sc, #888); stroke-width: 1; opacity: 0.45; }
  .rg-data { fill: color-mix(in srgb, var(--rc, #39ff14) 22%, transparent); stroke: var(--rc, #39ff14); stroke-width: 1.5; }
  .rg-vertex { fill: var(--vc, #fff); stroke: #000; stroke-width: 0.5; }
  .rg-num { font-family: var(--font-display); font-size: 7px; font-weight: bold; text-anchor: middle; dominant-baseline: middle; paint-order: stroke; stroke: rgba(0,0,0,0.9); stroke-width: 2.5px; }
  .rg-axis { font-family: var(--font-display); font-size: 6.5px; font-weight: bold; dominant-baseline: middle; paint-order: stroke; stroke: rgba(0,0,0,0.9); stroke-width: 2.5px; letter-spacing: 0.5px; }
  .oop { position: absolute; top: 2px; right: 4px; color: var(--warn); font-size: 0.7rem; }

  .hint {
    position: absolute; bottom: 8%; left: 50%; transform: translateX(-50%);
    font-family: var(--font-body); font-size: 1rem; color: var(--fg-dim);
    background: rgba(0,0,0,0.6); padding: 6px 14px; border-radius: var(--r-sm);
    pointer-events: none; text-align: center; white-space: nowrap; z-index: 3;
  }

  /* Overlay */
  .overlay-backdrop {
    position: fixed; inset: 0; z-index: 50;
    background: rgba(0,0,0,0.55);
    display: flex; align-items: flex-end; justify-content: center;
  }
  .overlay {
    width: 100%; max-width: 680px; max-height: 68vh;
    background: var(--surface); border: 1px solid var(--border-bright);
    border-radius: var(--r-lg) var(--r-lg) 0 0;
    display: flex; flex-direction: column;
    box-shadow: 0 -8px 30px rgba(0,0,0,0.6);
    animation: slideup 0.18s ease-out;
  }
  @keyframes slideup { from { transform: translateY(100%); } to { transform: translateY(0); } }
  .overlay-head { display: flex; align-items: center; gap: 10px; padding: 12px 14px; border-bottom: 1px solid var(--border); }
  .ov-close { background: var(--surface-raised); border: 1px solid var(--border); color: var(--fg); font-size: 0.6rem; padding: 5px 10px; width: auto; border-radius: 4px; }
  .ov-title { font-family: var(--font-display); font-size: 0.65rem; flex: 1; }
  .ov-count { font-family: var(--font-display); font-size: 0.42rem; color: var(--muted); }
  .overlay-controls { display: flex; gap: 8px; padding: 8px 14px; border-bottom: 1px solid var(--border); }
  .ov-search { flex: 1; background: var(--surface-raised); border: 1px solid var(--border); border-radius: var(--r-sm); color: var(--fg); font-family: var(--font-body); font-size: 0.95rem; padding: 5px 10px; outline: none; }
  .ov-search:focus { border-color: var(--accent); }
  .ov-sort { background: var(--surface-raised); border: 1px solid var(--border); border-radius: var(--r-sm); color: var(--fg-dim); font-family: var(--font-body); font-size: 0.85rem; padding: 5px 8px; }

  .overlay-list { flex: 1; overflow-y: auto; padding: 0; }
  .section-label { font-family: var(--font-display); font-size: 0.4rem; color: var(--muted); padding: 8px 14px 4px; letter-spacing: 0.05em; position: sticky; left: 0; }
  .section-label.adj { color: var(--warn); border-top: 1px solid var(--border); margin-top: 4px; }

  /* Row grid: POS | NAME | TRAITS | ATK PAC PAS DEF SPC | COST | INFO */
  .prow {
    display: grid;
    grid-template-columns: 36px 1fr 70px 24px 24px 24px 24px 24px 36px 22px;
    align-items: center; gap: 6px;
    padding: 7px 14px;
    cursor: pointer;
    border-bottom: 1px solid rgba(58,40,96,0.4);
    transition: background 0.1s;
  }
  .prow:hover { background: var(--surface-raised); }
  .prow.adj-row { opacity: 0.82; }
  .prow.used { opacity: 0.4; cursor: not-allowed; }
  .prow.cant { opacity: 0.5; cursor: not-allowed; }
  .prow.current { background: rgba(57,255,20,0.06); border-left: 2px solid var(--accent); }

  /* Header row (sticky) */
  .header-row {
    position: sticky; top: 0; z-index: 5; background: var(--surface);
    border-bottom: 1px solid var(--border);
    cursor: default; padding: 6px 14px;
  }
  .header-row:hover { background: var(--surface); }
  .pr-badge-h, .pr-name-h, .pr-traits-h, .pr-stat-h, .pr-cost-h, .pr-info-h {
    font-family: var(--font-display); font-size: 0.42rem; color: var(--muted);
    letter-spacing: 0.02em; text-align: center;
  }
  .pr-name-h { text-align: left; }
  .pr-traits-h { text-align: left; }
  .pr-cost-h { text-align: right; }

  .pr-badge { font-family: var(--font-display); font-size: 0.34rem; color: #000; padding: 2px 4px; border-radius: 3px; text-align: center; font-weight: bold; }
  .pr-name { font-family: var(--font-body); font-size: 1rem; color: var(--gold); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .pr-traits { font-size: 0.75rem; letter-spacing: 1px; white-space: nowrap; }
  .pr-stats { display: contents; }
  .pr-stats span { font-family: var(--font-display); font-size: 0.55rem; font-weight: bold; text-align: center; }
  .pr-cost { font-family: var(--font-display); font-size: 0.5rem; color: var(--muted); min-width: 22px; text-align: right; }
  .pr-cost.over { color: var(--danger); }
  .pr-info { background: none; border: none; color: var(--muted); font-size: 0.8rem; padding: 0; width: 20px; cursor: pointer; }
  .pr-info:hover { color: var(--accent); }
  .pr-info-spacer { width: 20px; }
  .pr-flag { font-family: var(--font-display); font-size: 0.38rem; color: var(--danger); grid-column: 2 / -1; }
  .inspect { padding: 8px 14px; background: var(--surface-raised); border-bottom: 1px solid var(--border); }
  .empty-state { padding: 30px 14px; text-align: center; color: var(--muted); font-family: var(--font-body); font-size: 1rem; }

  .overlay-foot { padding: 10px 14px; border-top: 1px solid var(--border); }
  .remove-slot { width: 100%; padding: 10px; font-size: 0.5rem; }

  /* Scrollbars */
  .overlay-list::-webkit-scrollbar,
  .panel-list::-webkit-scrollbar { width: 6px; }
  .overlay-list::-webkit-scrollbar-track,
  .panel-list::-webkit-scrollbar-track { background: var(--surface); }
  .overlay-list::-webkit-scrollbar-thumb,
  .panel-list::-webkit-scrollbar-thumb { background: var(--border-bright); border-radius: 3px; }

  @media (max-width: 900px) {
    .side-panel { flex: 0 0 130px; }
  }
</style>