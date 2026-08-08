<script>
  import { game, screen, setBuilderFormation, assignPlayerToSlot, clearSlot, autoFillFormation, confirmSquad, slotEligibility } from '../store.js';
  import { PLAYERS, CHIPS_FORMULA, FORMATIONS, SYNERGIES } from '../engine/data.js';
  import { getBuilderSynergyStatus, getSynergyDetails } from '../engine/engine.js';
  import PlayerCard from '../components/PlayerCard.svelte';
  import { onMount, onDestroy } from 'svelte';

  // Lock page scroll only while THIS screen is mounted. A :global(body) rule
  // would stay applied after Svelte swaps the screen out, killing scrolling
  // on every later route.
  onMount(() => document.body.classList.add('no-scroll'));
  onDestroy(() => document.body.classList.remove('no-scroll'));

  const MAX_SQUAD = 11;
  const BUDGET = 290;

  const POS_COLORS = {
    GK: 'var(--warn)', CB: 'var(--info)', FB: 'var(--info)',
    CDM: 'var(--rare)', CM: 'var(--rare)', CAM: 'var(--rare)',
    LW: 'var(--ok)', RW: 'var(--ok)', ST: 'var(--bad)'
  };
  const STAT_COLORS = {
    atk: 'var(--bad)', pac: 'var(--ok)', pas: 'var(--info)', def_: 'var(--rare)', spc: 'var(--warn)'
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

<svelte:head>
  <title>Team Selection — SQUAD</title>
</svelte:head>

<div class="builder-shell">
  <div class="grain" aria-hidden="true"></div>

  <header class="club-header">
    <button class="back-btn" on:click={() => screen.set('title')}><span>←</span> EXIT</button>
    <div class="club-identity">
      <div class="club-crest" aria-hidden="true">S</div>
      <div>
        <span class="header-kicker">MATCHDAY HQ</span>
        <h1>TEAM SELECTION</h1>
      </div>
    </div>
    <div class="header-progress" class:full={canProceed}>
      <span class="progress-number">{filledCount}</span>
      <span class="progress-copy">/ {MAX_SQUAD}<br>SHIRTS FILLED</span>
    </div>
  </header>

  <div class="selection-toolbar">
    <div class="formation-block">
      <span class="toolbar-label">FORMATION BOARD</span>
      <div class="formation-picker">
        {#each FORMATIONS as f}
          <button
            class="form-btn"
            class:active={f.id === formation.id}
            on:click={() => setBuilderFormation(f.id)}
          >{f.name}</button>
        {/each}
      </div>
    </div>

    <div class="formation-note">
      <strong>{formation.name}</strong>
      <span>{formation.description}</span>
    </div>

    <div class="budget">
      <div class="budget-top">
        <span class="toolbar-label">WAGE BUDGET</span>
        <strong class:low={budgetLeft < 40} class:danger={budgetLeft < 0}>{budgetLeft} LEFT</strong>
      </div>
      <div class="budget-bar">
        <div class="budget-fill" class:low={budgetLeft < 40} class:danger={budgetLeft < 0} style="width:{budgetPct}%"></div>
      </div>
      <span class="budget-total">SPENT {squadCost} / {BUDGET}</span>
    </div>

    <button class="autofill-btn" on:click={autoFillFormation}><span>⚡</span> AUTO-PICK XI</button>
  </div>

  {#if returnedNotice}
    <div class="toast">FORMATION CHANGE — RETURNED TO THE DRESSING ROOM: {returnedNotice.join(', ')}</div>
  {/if}

  <main class="selection-ground">
    <aside class="side-panel left-panel paper-panel">
      <div class="panel-kicker">COACH'S BOARD</div>
      <div class="panel-title active"><span class="panel-mark">{synergies.active.length ? '✓' : '○'}</span><div><strong>WORKING UNITS</strong><small>{synergies.active.length ? `${synergies.active.length} synergies active` : 'No synergies active yet'}</small></div></div>
      <div class="panel-list">
        {#if synergies.active.length === 0}
          <div class="panel-empty">Choose players to reveal working partnerships.</div>
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
                      <div class="syn-player"><span class="syn-pos" style="color:{POS_COLORS[c.pos] || 'var(--on-paper-muted)'}">{c.pos}</span> <span class="syn-pname">{c.name}</span></div>
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
      <div class="panel-footnote">BUILD RELATIONSHIPS BETWEEN POSITIONS TO UNLOCK MATCH BONUSES.</div>
    </aside>

    <!-- Pitch -->
    <section class="pitch-stage">
      <div class="pitch-heading">
        <div><span class="pitch-kicker">STARTING XI</span><strong>{formation.name} SHAPE</strong></div>
        <span>{filledCount === 0 ? 'SELECT A SHIRT TO OPEN THE PLAYER BOOK' : `${MAX_SQUAD - filledCount} SHIRTS REMAINING`}</span>
      </div>
      {#if filledCount === 0}
        <div class="hint"><span class="hint-whistle">◖</span><div><strong>GAFFER'S FIRST JOB</strong><small>Pick your goalkeeper, then build from the back.</small></div></div>
      {/if}
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
          style="left:clamp(58px, {slot.x}%, calc(100% - 58px)); top:clamp(62px, {slot.y}%, calc(100% - 62px)); --slot-color:{POS_COLORS[slot.pos] || 'var(--on-paper-muted)'}"
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
              <polygon class="rg-data" points={rg.dataPoly} style="--rc:{POS_COLORS[slot.pos] || 'var(--ok)'}" />
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
            <span class="empty-shirt" aria-hidden="true"><i>{slot.pos}</i></span>
            <span class="slot-pos-label">{slot.pos}</span>
            <span class="slot-plus">SELECT PLAYER +</span>
          {/if}
        </button>
      {/each}
      </div>
    </section>

    <!-- Right: Available / gated synergies -->
    <aside class="side-panel right-panel paper-panel">
      <div class="panel-kicker">RECRUITMENT NOTES</div>
      <div class="panel-title avail"><span class="panel-mark">◇</span><div><strong>LINKS TO CHASE</strong><small>Players who complete a unit</small></div></div>
      <div class="panel-list">
        {#if synergies.available.length === 0}
          <div class="panel-empty">Fill a shirt to reveal recruitable combinations.</div>
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
                      <div class="syn-player"><span class="syn-pos" style="color:{POS_COLORS[c.pos] || 'var(--on-paper-muted)'}">{c.pos}</span> {c.name} <span class="syn-stat">{c.detail}</span></div>
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
      <div class="panel-footnote">OPEN A LINK TO SEE WHICH AVAILABLE PLAYERS CAN COMPLETE IT.</div>
    </aside>
  </main>

  <footer class="selection-footer">
    <div class="footer-status">
      <span class="footer-ball" aria-hidden="true">●</span>
      <div>
        <small>TEAM SHEET</small>
        <strong>{canProceed ? 'STARTING XI COMPLETE' : `${MAX_SQUAD - filledCount} POSITIONS OPEN`}</strong>
      </div>
    </div>
    <div class="footer-message">
      {#if budgetLeft < 0}The squad is over budget. Replace a player before continuing.{:else if canProceed}The dressing room is ready. Lock in the team sheet.{:else}Balance quality, budget and combinations before matchday.{/if}
    </div>
    <button class="confirm-team" disabled={!canProceed || budgetLeft < 0} on:click={confirmSquad}>
      <span>SUBMIT TEAM SHEET</span><b>→</b>
    </button>
  </footer>
</div>

<!-- Overlay -->
{#if openSlot !== null}
  <!-- svelte-ignore a11y-click-events-have-key-events a11y-no-static-element-interactions -->
  <div class="overlay-backdrop" on:click={closeOverlay}>
    <!-- svelte-ignore a11y-click-events-have-key-events a11y-no-static-element-interactions -->
    <div class="overlay" on:click|stopPropagation>
      <div class="overlay-head">
        <button class="ov-close" on:click={closeOverlay}>← CLOSE</button>
        <div class="ov-heading">
          <span class="ov-kicker">PLAYER BOOK · {formation.name}</span>
          <span class="ov-title" style="color:{POS_COLORS[openSlotPos]}">SELECT YOUR {openSlotPos}</span>
        </div>
        <span class="ov-count">{eligible.natural.length} NATURAL · {eligible.adjacent.length} ADJACENT</span>
      </div>

      <div class="overlay-controls">
        <label class="search-wrap"><span>SEARCH THE SQUAD</span><input class="ov-search" placeholder="Type a player name..." bind:value={overlaySearch} /></label>
        <label class="sort-wrap"><span>ORDER BY</span><select class="ov-sort" bind:value={overlaySort}>
          <option value="value">Best fit</option>
          <option value="cost">Highest cost</option>
          <option value="name">Player name</option>
        </select></label>
        <div class="overlay-budget"><span>AVAILABLE BUDGET</span><strong class:low={budgetLeft < 40}>{budgetLeft}</strong></div>
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
  .builder-shell { --cream:var(--paper-400); --paper:var(--paper-100); --ink:var(--on-paper); --orange:var(--accent); min-height:100vh; height:100vh; overflow:hidden; padding-bottom:78px; color:var(--cream); background:radial-gradient(circle at 50% -20%,var(--pitch-glow),transparent 42%),linear-gradient(180deg,var(--ink-600),var(--ink-900) 78%); position:relative; isolation:isolate; }
  .builder-shell::before { content:''; position:fixed; inset:0; z-index:-1; pointer-events:none; background:repeating-linear-gradient(90deg,transparent 0 84px,rgba(255,255,255,.012) 84px 85px); }
  .grain { position:fixed; inset:0; opacity:.14; pointer-events:none; z-index:30; mix-blend-mode:soft-light; background-image:url("data:image/svg+xml,%3Csvg viewBox='0 0 180 180' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='.22'/%3E%3C/svg%3E"); }
  .club-header { height:84px; display:grid; grid-template-columns:150px 1fr 170px; align-items:center; padding:0 28px; background:var(--scrim-dark); border-bottom:1px solid var(--pitch-line); box-shadow:0 10px 28px rgba(0,0,0,.25); }
  .back-btn { justify-self:start; padding:10px 0; background:none; color:var(--fg-dim); font-size:.42rem; letter-spacing:.12em; display:flex; gap:8px; }.back-btn:hover{color:var(--cream)}
  .club-identity { justify-self:center; display:flex; align-items:center; gap:12px; }.club-crest{width:43px;height:49px;display:grid;place-items:center;clip-path:polygon(8% 0,92% 0,100% 70%,50% 100%,0 70%);background:var(--orange);color:var(--ink-700);font-family:var(--font-display);font-size:.72rem}
  .header-kicker,.toolbar-label,.pitch-kicker,.panel-kicker{display:block;font-family:var(--font-display);font-size:.3rem;letter-spacing:.14em}.header-kicker{color:var(--fg-muted);margin-bottom:5px}.club-identity h1{font-family:var(--font-display);font-size:.72rem;letter-spacing:.06em}
  .header-progress{justify-self:end;display:flex;align-items:center;gap:8px}.progress-number{font-family:Georgia,serif;font-style:italic;font-size:2.15rem;line-height:.8;color:var(--paper-200)}.header-progress.full .progress-number{color:var(--ok)}.progress-copy{font-family:var(--font-display);font-size:.28rem;line-height:1.55;color:var(--fg-muted)}
  .selection-toolbar{height:82px;display:grid;grid-template-columns:minmax(390px,1.2fr) minmax(220px,.8fr) 230px 150px;align-items:center;gap:22px;padding:10px 28px;background:var(--on-accent);border-bottom:1px solid var(--ink-500)}.toolbar-label{color:var(--fg-muted);margin-bottom:7px}.formation-picker{display:flex;gap:5px}.form-btn{padding:7px 9px;border-radius:1px;border:1px solid var(--ink-300);background:var(--ink-700);color:var(--fg-dim);font-size:.37rem;box-shadow:none}.form-btn:hover{background:var(--ink-500);color:var(--paper-300)}.form-btn.active{background:var(--orange);border-color:var(--orange);color:var(--on-accent);box-shadow:0 4px 0 rgba(0,0,0,.2)}
  .formation-note{min-width:0;padding-left:18px;border-left:1px solid var(--ink-400)}.formation-note strong{display:block;font-family:var(--font-display);font-size:.45rem;color:var(--accent-soft);margin-bottom:5px}.formation-note span{display:block;color:var(--fg-dim);font-size:.78rem;line-height:1.15;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .budget-top{display:flex;justify-content:space-between;align-items:center}.budget-top strong{font-family:var(--font-display);font-size:.34rem;color:var(--ok)}.budget-top strong.low{color:var(--warn)}.budget-top strong.danger{color:var(--bad)}.budget-bar{height:8px;background:var(--ink-500);overflow:hidden;border:1px solid var(--ink-400)}.budget-fill{height:100%;background:var(--ok);transition:width .3s}.budget-fill.low{background:var(--warn)}.budget-fill.danger{background:var(--bad)}.budget-total{display:block;margin-top:4px;font-family:var(--font-display);font-size:.25rem;color:var(--fg-muted);text-align:right}
  .autofill-btn{height:46px;border-radius:1px;border:1px solid var(--paper-line);background:var(--paper-100);color:var(--on-paper);font-size:.38rem;box-shadow:4px 5px 0 rgba(0,0,0,.22)}.autofill-btn:hover{transform:translateY(-2px);box-shadow:5px 8px 0 rgba(0,0,0,.2)}.toast{position:absolute;top:170px;left:50%;z-index:9;transform:translateX(-50%);padding:8px 14px;background:var(--warn);color:var(--on-accent);font-family:var(--font-display);font-size:.3rem;box-shadow:5px 6px 0 rgba(0,0,0,.24)}
  .selection-ground{height:calc(100vh - 244px);width:min(1540px,calc(100% - 44px));margin:0 auto;display:grid;grid-template-columns:220px minmax(580px,1fr) 220px;gap:20px;padding:18px 0 14px}.paper-panel{color:var(--on-paper);background:var(--paper-100);box-shadow:7px 9px 0 rgba(0,0,0,.2);position:relative;overflow:hidden}.paper-panel::before{content:'';position:absolute;inset:0;pointer-events:none;background:repeating-linear-gradient(0deg,transparent 0 27px,var(--paper-grain) 27px 28px)}
  .side-panel{min-height:0;display:flex;flex-direction:column;border-top:5px solid var(--bad-strong);transform:rotate(-.18deg)}.right-panel{transform:rotate(.18deg);border-top-color:var(--fg-muted)}.panel-kicker{padding:17px 15px 8px;color:var(--print-red);position:relative}.right-panel .panel-kicker{color:var(--ink-300)}.panel-title{margin:0 15px;padding:0 0 11px;border-bottom:2px solid var(--ink-400);display:flex;align-items:center;gap:9px;position:relative}.panel-title strong{display:block;font-family:var(--font-display);font-size:.4rem;line-height:1.35}.panel-title small{display:block;color:var(--on-paper-dim);font-size:.72rem;margin-top:2px}.panel-mark{width:24px;height:24px;display:grid;place-items:center;border:1px solid var(--on-paper-dim);border-radius:50%;font-weight:bold}.panel-list{flex:1;min-height:0;overflow-y:auto;padding:7px 10px;position:relative}.panel-empty{padding:25px 8px;text-align:center;color:var(--on-paper-muted);font-style:italic;font-size:.9rem}.panel-footnote{position:relative;padding:10px 14px;border-top:1px dashed var(--fg-dim);font-family:var(--font-display);font-size:.25rem;line-height:1.6;color:var(--on-paper-muted)}
  .syn-item{border-bottom:1px solid var(--paper-tint)}.syn-toggle{width:100%;padding:7px 5px;display:flex;align-items:center;gap:6px;background:none;color:var(--on-paper);text-align:left;border-radius:0;font-family:var(--font-body)}.syn-toggle:hover{background:rgba(255,255,255,.22)}.syn-check{color:var(--ok-strong);font-weight:bold}.syn-dot{color:var(--on-paper-dim)}.syn-body{flex:1;min-width:0}.syn-name{display:block;font-size:.89rem;line-height:1.1;color:var(--on-paper)}.syn-act-eff{display:block;color:var(--ok-strong);font-family:var(--font-display);font-size:.31rem;margin-top:3px}.syn-hint{display:block;color:var(--on-paper-dim);font-size:.74rem;line-height:1.12;margin-top:2px}.syn-caret{font-family:var(--font-display);font-size:.4rem;color:var(--on-paper-muted)}.syn-detail{padding:5px 6px 8px 22px;border-top:1px dashed var(--paper-line)}.syn-detail-label{font-family:var(--font-display);font-size:.28rem;color:var(--on-paper-muted);margin:4px 0}.syn-player{font-size:.78rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.syn-pos{font-family:var(--font-display);font-size:.28rem;margin-right:3px}.syn-stat{font-family:var(--font-display);font-size:.28rem;color:var(--on-paper-dim);margin-left:2px}.syn-detail-empty{font-size:.76rem;color:var(--on-paper-muted)}
  .pitch-stage{min-width:0;min-height:0;display:flex;flex-direction:column}.pitch-heading{height:42px;display:flex;justify-content:space-between;align-items:flex-start;padding:0 3px 9px}.pitch-heading strong{display:block;font-family:var(--font-display);font-size:.48rem;margin-top:4px}.pitch-kicker{color:var(--accent-soft)}.pitch-heading>span{font-family:var(--font-display);font-size:.27rem;color:var(--fg-muted);padding-top:15px}.pitch{flex:1;min-height:0;position:relative;overflow:hidden;background:var(--pitch-turf);border:2px solid var(--pitch-line-strong);box-shadow:inset 0 0 60px rgba(0,0,0,.42),0 14px 25px rgba(0,0,0,.25)}.pitch::before{content:'';position:absolute;inset:0;opacity:.28;background:repeating-linear-gradient(0deg,rgba(255,255,255,.07) 0 10%,rgba(0,0,0,.07) 10% 20%)}.pitch::after{content:'';position:absolute;inset:11px;border:1px solid var(--pitch-line-strong);pointer-events:none}.pline{position:absolute;z-index:1;border:1px solid var(--pitch-line-strong);background:transparent}.centre-circle{width:18%;aspect-ratio:1;border-radius:50%;top:50%;left:50%;transform:translate(-50%,-50%)}.centre-line{width:calc(100% - 22px);height:0;top:50%;left:11px;border:0;border-top:1px solid var(--pitch-line-strong)}.pbox{width:38%;height:15%;left:50%;transform:translateX(-50%)}.pbox.top{top:11px;border-top:0}.pbox.bottom{bottom:11px;border-bottom:0}.six{width:19%;height:7%;left:50%;transform:translateX(-50%)}.six.top{top:11px;border-top:0}.six.bottom{bottom:11px;border-bottom:0}
  .slot{position:absolute;z-index:3;transform:translate(-50%,-50%);width:110px;height:68px;border-radius:1px;border:1px solid var(--pitch-line-strong);background:var(--scrim-dark);padding:2px 3px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:0;color:var(--cream);box-shadow:0 4px 0 rgba(0,0,0,.18);transition:transform .14s,border-color .14s,box-shadow .14s}.slot.empty{height:76px;background:var(--scrim-dark);border:1px dashed var(--pitch-line-strong)}.slot.empty:hover{transform:translate(-50%,-50%) scale(1.05);border-color:var(--accent-soft);box-shadow:0 0 0 3px var(--accent-tint),0 7px 0 rgba(0,0,0,.2)}.slot.open{border-color:var(--accent-soft);box-shadow:0 0 0 3px var(--accent-tint),0 7px 0 rgba(0,0,0,.2)}.slot.filled{border:2px solid var(--slot-color);background:color-mix(in srgb,var(--slot-color) 18%,var(--ink-800))}.slot.filled:hover{transform:translate(-50%,-50%) scale(1.04)}
  .empty-shirt{width:38px;height:36px;display:grid;place-items:center;margin-bottom:3px;color:var(--pitch-line-strong);background:var(--pitch-line);clip-path:polygon(21% 0,38% 10%,62% 10%,79% 0,100% 22%,83% 40%,77% 31%,77% 100%,23% 100%,23% 31%,17% 40%,0 22%)}.empty-shirt i{font-family:var(--font-display);font-style:normal;font-size:.28rem}.slot-pos-label{font-family:var(--font-display);font-size:.43rem}.slot-plus{font-family:var(--font-display);font-size:.22rem;color:var(--fg-dim);margin-top:3px}.slot-badge{position:absolute;top:2px;left:3px;font-family:var(--font-display);font-size:.25rem;color:var(--ink-900);padding:2px 4px;border-radius:1px}.slot-name{position:absolute;top:5px;left:27px;right:4px;max-width:none;color:var(--fg);font-size:.72rem;line-height:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.slot-radar{width:54px;height:54px;margin-top:10px;pointer-events:none;flex-shrink:0}.rg-ring{fill:none;stroke:rgba(255,255,255,.13);stroke-width:1}.rg-ring.half{stroke:rgba(255,255,255,.09);stroke-dasharray:2,2}.rg-spoke{stroke:var(--sc,var(--on-paper-muted));stroke-width:1;opacity:.48}.rg-data{fill:color-mix(in srgb,var(--rc,var(--ok)) 22%,transparent);stroke:var(--rc,var(--ok));stroke-width:1.5}.rg-vertex{fill:var(--vc,var(--paper-400));stroke:var(--on-accent);stroke-width:.5}.rg-num{font-family:var(--font-display);font-size:7px;font-weight:bold;text-anchor:middle;dominant-baseline:middle;paint-order:stroke;stroke:rgba(0,0,0,.9);stroke-width:2.5px}.rg-axis{font-family:var(--font-display);font-size:6.5px;font-weight:bold;dominant-baseline:middle;paint-order:stroke;stroke:rgba(0,0,0,.9);stroke-width:2.5px;letter-spacing:.5px}.oop{position:absolute;top:3px;right:5px;color:var(--warn);font-size:.65rem}.hint{position:absolute;z-index:5;top:9px;left:50%;transform:translateX(-50%);display:flex;align-items:center;gap:8px;width:max-content;padding:6px 10px;color:var(--on-paper);background:var(--paper-100);box-shadow:4px 5px 0 rgba(0,0,0,.22)}.hint-whistle{color:var(--bad-strong);font-size:1rem;transform:rotate(-20deg)}.hint strong{display:block;font-family:var(--font-display);font-size:.25rem}.hint small{display:block;font-size:.68rem;line-height:1.05;color:var(--on-paper-dim);margin-top:2px}
  .selection-footer{position:fixed;z-index:12;bottom:0;left:0;right:0;height:78px;display:grid;grid-template-columns:250px 1fr 285px;align-items:center;background:var(--ink-900);border-top:1px solid var(--ink-400);box-shadow:0 -9px 30px rgba(0,0,0,.35)}.footer-status{height:100%;display:flex;align-items:center;gap:11px;padding-left:28px;border-right:1px solid var(--ink-500)}.footer-ball{width:30px;height:30px;display:grid;place-items:center;border:2px solid var(--accent-strong);border-radius:50%;color:var(--accent-strong);font-size:.35rem}.footer-status small{display:block;font-family:var(--font-display);font-size:.25rem;color:var(--fg-muted)}.footer-status strong{display:block;font-family:var(--font-display);font-size:.37rem;margin-top:5px}.footer-message{text-align:center;color:var(--fg-muted);font-style:italic;font-size:.95rem}.confirm-team{height:100%;border-radius:0;clip-path:polygon(11% 0,100% 0,100% 100%,0 100%);background:var(--orange);color:var(--on-accent);display:flex;justify-content:center;align-items:center;gap:17px;font-size:.5rem}.confirm-team b{font-size:1.1rem}.confirm-team:disabled{background:var(--ink-500);color:var(--fg-muted);cursor:not-allowed}
  .overlay-backdrop{position:fixed;inset:0;z-index:50;background:var(--scrim-dark);display:flex;align-items:flex-end;justify-content:center;backdrop-filter:blur(3px)}.overlay{width:min(920px,94vw);max-height:78vh;display:flex;flex-direction:column;color:var(--on-paper);background:var(--paper-100);border-top:6px solid var(--bad-strong);box-shadow:0 -12px 40px rgba(0,0,0,.55);animation:slideup .2s ease-out}@keyframes slideup{from{transform:translateY(100%)}to{transform:none}}.overlay-head{display:flex;align-items:center;gap:15px;padding:15px 18px 13px;border-bottom:2px solid var(--ink-400)}.ov-close{background:var(--on-paper);color:var(--paper-300);border-radius:0;font-size:.32rem;padding:8px 10px}.ov-heading{flex:1}.ov-kicker{display:block;font-family:var(--font-display);font-size:.27rem;color:var(--on-paper-muted);margin-bottom:5px}.ov-title{display:block;font-family:var(--font-display);font-size:.58rem}.ov-count{font-family:var(--font-display);font-size:.28rem;color:var(--on-paper-dim)}
  .overlay-controls{display:grid;grid-template-columns:1fr 190px 130px;gap:12px;align-items:end;padding:9px 18px;background:var(--paper-100);border-bottom:1px solid var(--paper-line)}.search-wrap,.sort-wrap{display:flex;flex-direction:column;gap:4px}.search-wrap>span,.sort-wrap>span,.overlay-budget span{font-family:var(--font-display);font-size:.24rem;color:var(--on-paper-muted)}.ov-search,.ov-sort{height:34px;background:var(--paper-300);border:1px solid var(--paper-line);border-radius:0;color:var(--on-paper);font-family:var(--font-body);font-size:.9rem;padding:4px 9px;outline:none}.ov-search:focus,.ov-sort:focus{border-color:var(--print-red)}.overlay-budget{text-align:right}.overlay-budget strong{display:block;font-family:Georgia,serif;font-style:italic;font-size:1.4rem;line-height:1;color:var(--ok-strong)}.overlay-budget strong.low{color:var(--print-brown)}.overlay-list{flex:1;overflow-y:auto;background:var(--paper-100)}.section-label{position:sticky;left:0;padding:8px 18px 5px;font-family:var(--font-display);font-size:.28rem;letter-spacing:.08em;color:var(--on-paper-muted);background:var(--paper-100)}.section-label.adj{color:var(--print-brown);border-top:1px solid var(--paper-line)}
  .prow{position:relative;display:grid;grid-template-columns:40px 1fr 76px 27px 27px 27px 27px 27px 42px 25px;align-items:center;gap:7px;padding:7px 18px;cursor:pointer;border-bottom:1px solid var(--paper-tint);transition:background .1s}.prow:hover{background:rgba(255,255,255,.28)}.prow.adj-row{opacity:.82}.prow.used,.prow.cant{opacity:.4;cursor:not-allowed}.prow.current{background:var(--pitch-glow-soft);border-left:4px solid var(--ok-strong)}.header-row{position:sticky;top:0;z-index:5;background:var(--on-paper);color:var(--paper-200);cursor:default;padding-top:6px;padding-bottom:6px}.header-row:hover{background:var(--on-paper)}.pr-badge-h,.pr-name-h,.pr-traits-h,.pr-stat-h,.pr-cost-h,.pr-info-h{font-family:var(--font-display);font-size:.29rem;color:var(--fg-dim);text-align:center}.pr-name-h,.pr-traits-h{text-align:left}.pr-cost-h{text-align:right}.pr-badge{font-family:var(--font-display);font-size:.29rem;color:var(--ink-900);padding:3px 4px;text-align:center}.pr-name{font-size:.94rem;color:var(--on-paper);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.pr-traits{font-size:.72rem;letter-spacing:1px;white-space:nowrap}.pr-stats{display:contents}.pr-stats span{font-family:var(--font-display);font-size:.45rem;font-weight:bold;text-align:center}.pr-cost{font-family:Georgia,serif;font-weight:bold;font-size:.95rem;color:var(--on-paper-dim);text-align:right}.pr-cost.over{color:var(--print-red)}.pr-info{background:none;border:0;color:var(--on-paper-dim);font-size:.75rem;padding:0}.pr-info:hover{color:var(--print-red)}.pr-info-spacer{width:20px}.pr-flag{font-family:var(--font-display);font-size:.27rem;color:var(--print-red);grid-column:2/-1}.inspect{padding:9px 18px;background:var(--paper-100);border-bottom:1px solid var(--paper-line)}.empty-state{padding:30px;text-align:center;color:var(--on-paper-muted)}.overlay-foot{padding:10px 18px;border-top:1px solid var(--paper-line);background:var(--paper-100)}.remove-slot{width:100%;border-radius:0;font-size:.35rem;padding:10px}
  @media(max-width:1120px){.selection-toolbar{grid-template-columns:1fr 210px 145px}.formation-note{display:none}.selection-ground{grid-template-columns:180px 1fr 180px;gap:12px}.slot{width:96px;height:64px}.slot.empty{height:72px}.slot-radar{width:50px;height:50px}.side-panel{font-size:.9rem}}
  @media(max-width:820px){:global(body){overflow:auto}.builder-shell{height:auto;min-height:100vh;overflow:visible;padding-bottom:102px}.club-header{grid-template-columns:48px 1fr 70px;padding:0 12px}.back-btn{font-size:0}.back-btn span{font-size:.7rem}.club-crest{display:none}.club-identity h1{font-size:.52rem}.selection-toolbar{height:auto;grid-template-columns:1fr 120px;padding:10px 12px;gap:10px}.formation-block{grid-column:1/-1;overflow-x:auto}.formation-picker{min-width:max-content}.budget{grid-column:1}.autofill-btn{grid-column:2}.selection-ground{height:auto;width:calc(100% - 20px);display:flex;flex-direction:column;padding-top:12px}.pitch-stage{order:1;height:760px}.left-panel{order:2;min-height:240px}.right-panel{order:3;min-height:240px}.side-panel{transform:none}.pitch-heading>span{display:none}.selection-footer{height:102px;grid-template-columns:1fr 190px}.footer-status{padding-left:14px}.footer-message{display:none}.confirm-team{grid-column:2}.overlay{width:100vw;max-height:84vh}.overlay-controls{grid-template-columns:1fr 130px}.overlay-budget{display:none}.prow{grid-template-columns:34px 1fr 55px 23px 23px 23px 23px 23px 34px 22px;padding-left:8px;padding-right:8px;gap:4px}}
  @media(prefers-reduced-motion:reduce){*,*::before,*::after{animation-duration:.01ms!important;transition-duration:.01ms!important}}
</style>
