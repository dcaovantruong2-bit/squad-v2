<script>
  import { game, currentMatch, pickPhase, unpickPhase, confirmPhases, navigate } from '../store.js';
  import { ALL_PHASES, COMBO_NO_MATCH_PENALTY } from '../engine/data.js';
  import { evaluateComboChains, estimatePhaseChips, getPunishedTags, getOpponentTactics } from '../engine/engine.js';

  const TAG_COLORS = {
    Defensive: '#55a7e8',
    Possession: '#58c779',
    Attacking: '#ef5d61',
    Transition: '#eea84d',
    Specialist: '#ad83d7',
  };

  const TAG_ICONS = {
    Defensive: 'shield',
    Possession: 'orbit',
    Attacking: 'target',
    Transition: 'bolt',
    Specialist: 'flag',
  };

  const STAT_COLORS = {
    ATK: '#ef5d61', PAC: '#70d68b', PAS: '#66bce9', DEF: '#b58bdd', SPC: '#f1bd57',
  };

  $: match = $currentMatch;
  $: deal = ($game.dealtPhases || []).map(id => ALL_PHASES.find(p => p.id === id)).filter(Boolean);
  $: picked = ($game.pickedPhases || []).map(id => ALL_PHASES.find(p => p.id === id)).filter(Boolean);
  $: pickedIds = $game.pickedPhases || [];
  $: punishedTags = getPunishedTags($game);
  $: tactics = getOpponentTactics($game);
  $: chains = evaluateComboChains(pickedIds);
  $: target = match ? match.targets[$game.roundIdx] : 0;
  $: canConfirm = picked.length === 3;
  $: chipsById = Object.fromEntries(deal.map(p => [p.id, estimatePhaseChips($game.field, p.id, $game)]));
  $: projectedBase = picked.reduce((sum, phase) => sum + (chipsById[phase.id] || 0), 0);

  const humanize = s => s.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  const tagColor = phase => phase ? (TAG_COLORS[phase.tag] || '#8f8999') : '#8f8999';
  const isPunished = phase => punishedTags.includes(phase.tag);

  $: arrowInfos = [0, 1].map(i => {
    const c = chains[i];
    if (!c) return null;
    if (!c.matched) return { matched: false, label: `×${COMBO_NO_MATCH_PENALTY}`, desc: 'No tactical link', color: '#ef5d61' };
    const eff = c.chain.effect;
    let value = '';
    if (eff === 'xMult') value = `×${c.chain.value}`;
    else if (eff === 'addChips') value = `${c.chain.value > 0 ? '+' : ''}${c.chain.value}`;
    else if (eff === 'fatigueRecovery') value = 'REST';
    const good = eff !== 'addChips' || c.chain.value > 0;
    const shortDesc = c.chain.desc.split(' - ')[0].split(/[,!]/)[0].split(' ').slice(0, 3).join(' ');
    return { matched: true, label: value, desc: shortDesc, color: good ? '#70d68b' : '#ef5d61' };
  });
</script>

<svelte:head>
  <title>Matchday — SQUAD</title>
</svelte:head>

<div class="matchday-shell">
  <div class="stadium-light stadium-light-left" aria-hidden="true"></div>
  <div class="stadium-light stadium-light-right" aria-hidden="true"></div>
  <div class="grain" aria-hidden="true"></div>

  <header class="match-header">
    <button class="back-button" on:click={() => navigate('title')} aria-label="Return to title">
      <span aria-hidden="true">←</span><span>EXIT</span>
    </button>

    {#if match}
      <div class="fixture">
        <div class="competition-line">
          <span>{match.name}</span>
          <i></i>
          <span>{match.tier}</span>
        </div>
        <div class="scoreboard">
          <div class="club club-home">
            <div class="crest crest-home" aria-hidden="true"><span>S</span></div>
            <div><small>HOME</small><strong>SQUAD XI</strong></div>
          </div>
          <div class="score-centre">
            <span class="round-label">ROUND {$game.roundIdx + 1}</span>
            <span class="versus">V</span>
            <span class="target-score">TARGET {target.toLocaleString()}</span>
          </div>
          <div class="club club-away">
            <div><small>AWAY</small><strong>{match.opponent}</strong></div>
            <div class="crest crest-away" aria-hidden="true"><span>{match.opponent.slice(0, 1)}</span></div>
          </div>
        </div>
      </div>
    {/if}

    <div class="header-status">
      <span class="live-dot"></span>
      <span>TEAM TALK</span>
    </div>
  </header>

  <main class="match-layout">
    <aside class="scout-panel paper-panel">
      <div class="panel-kicker">OPPOSITION REPORT</div>
      <div class="scout-heading">
        <span class="notebook-icon" aria-hidden="true">▤</span>
        <h2>THE SCOUT'S NOTES</h2>
      </div>
      {#if match}<p class="scout-copy">“{match.intro}”</p>{/if}

      <div class="tactics-heading"><span>DANGER AREAS</span><i></i></div>
      <div class="tactic-list">
        {#each tactics as tac}
          <div class="tactic-item">
            <span class="warning-mark">!</span>
            <div><strong>{humanize(tac.id || '')}</strong><small>Opponent instruction identified</small></div>
          </div>
        {/each}
      </div>

      <div class="legend-block">
        <div class="legend-title">TACTICAL KEY</div>
        <div class="legend-row"><span class="legend-chip safe"></span><span>Strong phase fit</span></div>
        <div class="legend-row"><span class="legend-chip risk"></span><span>Opponent has a counter</span></div>
        <div class="legend-row"><span class="legend-line"></span><span>Linked phases gain bonuses</span></div>
      </div>
    </aside>

    <section class="tactics-board">
      <div class="board-topline">
        <div>
          <span class="eyebrow">MATCH PLAN</span>
          <h1>CALL THE THREE PHASES</h1>
        </div>
        <div class="selection-count"><b>{picked.length}</b><span>/ 3<br>SELECTED</span></div>
      </div>

      <div class="pitch-board">
        <div class="pitch-mow" aria-hidden="true"></div>
        <div class="touchline" aria-hidden="true"></div>
        <div class="halfway" aria-hidden="true"></div>
        <div class="centre-circle" aria-hidden="true"></div>
        <div class="centre-spot" aria-hidden="true"></div>
        <div class="penalty-box box-left" aria-hidden="true"></div>
        <div class="penalty-box box-right" aria-hidden="true"></div>

        <div class="sequence-path" aria-label="Picked phase sequence">
          {#each [0, 1, 2] as slotIdx}
            <div class="phase-stop" class:has-phase={picked[slotIdx]}>
              <div class="phase-number">0{slotIdx + 1}</div>
              <button
                class="chosen-phase"
                class:empty={!picked[slotIdx]}
                on:click={() => picked[slotIdx] && unpickPhase(slotIdx)}
                style={picked[slotIdx] ? `--phase-color:${tagColor(picked[slotIdx])}` : ''}
              >
                {#if picked[slotIdx]}
                  <span class="phase-icon" aria-hidden="true">
                    {#if TAG_ICONS[picked[slotIdx].tag] === 'shield'}◆{:else if TAG_ICONS[picked[slotIdx].tag] === 'orbit'}◎{:else if TAG_ICONS[picked[slotIdx].tag] === 'target'}⊕{:else if TAG_ICONS[picked[slotIdx].tag] === 'bolt'}ϟ{:else}⚑{/if}
                  </span>
                  <strong>{picked[slotIdx].name}</strong>
                  <small>{picked[slotIdx].tag} · {chipsById[picked[slotIdx].id]} pts</small>
                  <span class="remove-phase">REMOVE ×</span>
                {:else}
                  <span class="empty-ball" aria-hidden="true">●</span>
                  <strong>SELECT PHASE</strong>
                  <small>Choose from the touchline</small>
                {/if}
              </button>

              {#if slotIdx < 2}
                {@const info = arrowInfos[slotIdx]}
                <div class="link-zone" class:active={info} style={info ? `--link-color:${info.color}` : ''}>
                  <span class="link-arrow">›</span>
                  {#if info}
                    <div class="link-callout" style={`--link-color:${info.color}`}>
                      <strong>{info.label}</strong><small>{info.desc}</small>
                    </div>
                  {:else}
                    <span class="link-awaiting">LINK</span>
                  {/if}
                </div>
              {/if}
            </div>
          {/each}
        </div>
      </div>

      <div class="dugout-heading">
        <div><span class="eyebrow">THE DUGOUT</span><h2>AVAILABLE PLAYS</h2></div>
        <span class="instruction">PICK IN ORDER — THE SEQUENCE MATTERS</span>
      </div>

      <div class="phase-hand">
        {#each deal as phase, cardIndex}
          <button
            class="play-card"
            class:punished={isPunished(phase)}
            class:picked={pickedIds.includes(phase.id)}
            class:locked={picked.length >= 3 && !pickedIds.includes(phase.id)}
            disabled={pickedIds.includes(phase.id) || (picked.length >= 3 && !pickedIds.includes(phase.id))}
            on:click={() => pickPhase(phase.id)}
            style={`--card-color:${tagColor(phase)}; --card-delay:${cardIndex * 45}ms;`}
          >
            <div class="card-stripe"></div>
            <div class="card-top">
              <span class="card-type">{phase.tag}</span>
              <span class="card-index">#{String(cardIndex + 1).padStart(2, '0')}</span>
            </div>
            <div class="card-symbol" aria-hidden="true">
              {#if TAG_ICONS[phase.tag] === 'shield'}◆{:else if TAG_ICONS[phase.tag] === 'orbit'}◎{:else if TAG_ICONS[phase.tag] === 'target'}⊕{:else if TAG_ICONS[phase.tag] === 'bolt'}ϟ{:else}⚑{/if}
            </div>
            <h3>{phase.name}</h3>
            <div class="formation-strip">
              <strong style={`color:${STAT_COLORS[phase.weight] || '#fff'}`}>{phase.weight}</strong>
              <span>{phase.slots.flat().join('  ·  ')}</span>
            </div>
            <p>{phase.desc}</p>
            <div class="card-footer">
              <div class="points"><strong>{chipsById[phase.id] ?? 0}</strong><small>BASE PTS</small></div>
              {#if isPunished(phase)}
                <div class="countered"><span>!</span><small>COUNTERED</small></div>
              {:else}
                <div class="select-cue"><span>+</span><small>ADD PLAY</small></div>
              {/if}
            </div>
            {#if pickedIds.includes(phase.id)}<div class="picked-stamp">IN PLAN</div>{/if}
          </button>
        {/each}
      </div>
    </section>
  </main>

  <footer class="match-footer">
    <div class="footer-detail">
      <span class="whistle" aria-hidden="true">◖</span>
      <div><small>PROJECTED BASE</small><strong>{projectedBase.toLocaleString()} PTS</strong></div>
    </div>
    <div class="footer-message">
      {#if canConfirm}The plan is set. Send them out.{:else}Select {3 - picked.length} more {3 - picked.length === 1 ? 'phase' : 'phases'} to complete the match plan.{/if}
    </div>
    <button class="kickoff-button" disabled={!canConfirm} on:click={confirmPhases}>
      <span class="button-label">KICK OFF</span>
      <span class="button-ball" aria-hidden="true">●</span>
    </button>
  </footer>
</div>

<style>
  :global(body) { overflow-x: hidden; }

  .matchday-shell {
    --ink: #191b19;
    --cream: #eee9db;
    --paper: #d8d1be;
    --orange: #ed7c3e;
    min-height: 100vh;
    color: var(--cream);
    background:
      radial-gradient(circle at 50% -30%, rgba(60, 102, 72, .32), transparent 46%),
      linear-gradient(180deg, #122219 0%, #0b1410 64%, #080d0a 100%);
    position: relative;
    isolation: isolate;
    padding-bottom: 82px;
  }
  .matchday-shell::before {
    content: ''; position: fixed; inset: 0; pointer-events: none; z-index: -1;
    background: repeating-linear-gradient(90deg, transparent 0 84px, rgba(255,255,255,.012) 84px 85px);
  }
  .grain {
    position: fixed; inset: 0; opacity: .16; pointer-events: none; z-index: 20;
    background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 180 180' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='.22'/%3E%3C/svg%3E");
    mix-blend-mode: soft-light;
  }
  .stadium-light { position: fixed; top: -120px; width: 400px; height: 600px; opacity: .05; filter: blur(6px); pointer-events:none; }
  .stadium-light-left { left: -180px; transform: rotate(-28deg); background: linear-gradient(90deg, transparent, #fff); }
  .stadium-light-right { right: -180px; transform: rotate(28deg); background: linear-gradient(-90deg, transparent, #fff); }

  .match-header {
    height: 104px; display: grid; grid-template-columns: 130px 1fr 130px; align-items: center;
    padding: 0 32px; border-bottom: 1px solid rgba(238,233,219,.13); background: rgba(6,12,8,.76);
    box-shadow: 0 12px 30px rgba(0,0,0,.24); position: relative; z-index: 3;
  }
  .back-button { justify-self: start; background: transparent; color: #9faaa1; padding: 10px 0; display:flex; gap:9px; font-size:.48rem; letter-spacing:.12em; }
  .back-button:hover { color: var(--cream); }
  .fixture { justify-self: center; width: min(720px, 100%); }
  .competition-line { display:flex; align-items:center; justify-content:center; gap:12px; font-family:var(--font-display); font-size:.39rem; letter-spacing:.11em; color:#88968d; margin-bottom:8px; }
  .competition-line i { width:24px; height:1px; background:#455148; }
  .scoreboard { display:grid; grid-template-columns:1fr 145px 1fr; align-items:center; }
  .club { display:flex; align-items:center; gap:12px; min-width:0; }
  .club-away { justify-content:flex-end; text-align:right; }
  .club small { display:block; color:#758179; font-family:var(--font-display); font-size:.34rem; margin-bottom:4px; }
  .club strong { display:block; font-family:var(--font-display); font-size:.62rem; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
  .crest { width:44px; height:50px; flex:0 0 auto; display:grid; place-items:center; clip-path:polygon(8% 0,92% 0,100% 70%,50% 100%,0 70%); background:#d8d1be; color:#182018; font-family:var(--font-display); font-size:.76rem; }
  .crest-home { background:var(--orange); color:#131713; }
  .crest-away { background:#7a3034; color:#f5d4d2; }
  .score-centre { text-align:center; display:flex; flex-direction:column; align-items:center; }
  .round-label { font-family:var(--font-display); font-size:.34rem; color:#748078; letter-spacing:.08em; }
  .versus { font-family:Georgia,serif; font-style:italic; font-weight:bold; font-size:1.25rem; line-height:1.05; color:var(--cream); }
  .target-score { font-family:var(--font-display); font-size:.38rem; color:#e7aa61; }
  .header-status { justify-self:end; display:flex; align-items:center; gap:7px; color:#718078; font-family:var(--font-display); font-size:.37rem; }
  .live-dot { width:7px; height:7px; border-radius:50%; background:#ef7c46; box-shadow:0 0 0 4px rgba(239,124,70,.1); animation:pulse 2s infinite; }

  .match-layout { width:min(1500px, calc(100% - 48px)); margin:0 auto; display:grid; grid-template-columns:240px minmax(0,1fr); gap:34px; padding:30px 0 38px; }
  .paper-panel { color:#292b27; background:#d7d0bd; box-shadow:8px 10px 0 rgba(0,0,0,.18); position:relative; }
  .paper-panel::before { content:''; position:absolute; inset:0; pointer-events:none; background:repeating-linear-gradient(0deg, transparent 0 27px, rgba(50,55,48,.06) 27px 28px); }
  .scout-panel { align-self:start; margin-top:61px; padding:24px 20px; transform:rotate(-.35deg); border-top:5px solid #b44a42; }
  .panel-kicker,.eyebrow { font-family:var(--font-display); font-size:.36rem; letter-spacing:.14em; }
  .panel-kicker { color:#8a3e37; margin-bottom:16px; }
  .scout-heading { display:flex; align-items:center; gap:10px; border-bottom:2px solid #333630; padding-bottom:10px; }
  .scout-heading h2 { font-size:.51rem; line-height:1.5; }
  .notebook-icon { font-size:1.35rem; }
  .scout-copy { font-size:1.08rem; line-height:1.35; margin:18px 0 22px; font-style:italic; color:#4e5049; }
  .tactics-heading { display:flex; gap:8px; align-items:center; font-family:var(--font-display); font-size:.37rem; color:#676a61; margin-bottom:10px; }
  .tactics-heading i { flex:1; height:1px; background:#969486; }
  .tactic-list { display:flex; flex-direction:column; gap:8px; position:relative; }
  .tactic-item { display:flex; gap:9px; align-items:center; padding:8px; background:rgba(255,255,255,.22); border-left:3px solid #b44a42; }
  .warning-mark { width:21px; height:21px; display:grid; place-items:center; border-radius:50%; background:#b44a42; color:#fff4db; font-weight:bold; font-family:Arial,sans-serif; }
  .tactic-item strong { display:block; font-family:var(--font-display); font-size:.38rem; }
  .tactic-item small { display:block; font-size:.76rem; color:#686a63; line-height:1.2; margin-top:3px; }
  .legend-block { border-top:1px dashed #969486; margin-top:24px; padding-top:16px; position:relative; }
  .legend-title { font-family:var(--font-display); font-size:.35rem; margin-bottom:9px; }
  .legend-row { display:flex; align-items:center; gap:8px; font-size:.82rem; color:#5d5f57; margin:4px 0; }
  .legend-chip { width:13px; height:8px; display:inline-block; }
  .legend-chip.safe { background:#4b9164; }.legend-chip.risk { background:#b44a42; }
  .legend-line { width:16px; border-top:2px dashed #5c625a; }

  .tactics-board { min-width:0; }
  .board-topline,.dugout-heading { display:flex; align-items:flex-end; justify-content:space-between; }
  .board-topline { height:62px; padding:0 2px 12px; }
  .eyebrow { color:#dc894e; display:block; margin-bottom:6px; }
  .board-topline h1 { font-family:var(--font-display); font-size:.82rem; letter-spacing:.05em; }
  .selection-count { display:flex; align-items:center; gap:8px; }
  .selection-count b { font-family:Georgia,serif; font-style:italic; font-size:2.2rem; line-height:.8; color:#e8dfcc; }
  .selection-count span { font-family:var(--font-display); font-size:.31rem; line-height:1.5; color:#7e8b82; }

  .pitch-board { height:310px; position:relative; overflow:hidden; border:2px solid rgba(222,230,206,.44); background:#234d31; box-shadow:inset 0 0 50px rgba(0,0,0,.36), 0 14px 24px rgba(0,0,0,.22); }
  .pitch-mow { position:absolute; inset:0; opacity:.33; background:repeating-linear-gradient(90deg,rgba(255,255,255,.06) 0 9.09%,rgba(0,0,0,.06) 9.09% 18.18%); }
  .touchline { position:absolute; inset:13px; border:1px solid rgba(235,239,219,.48); }
  .halfway { position:absolute; top:13px; bottom:13px; left:50%; border-left:1px solid rgba(235,239,219,.48); }
  .centre-circle { position:absolute; width:94px; height:94px; border:1px solid rgba(235,239,219,.48); border-radius:50%; left:50%; top:50%; transform:translate(-50%,-50%); }
  .centre-spot { position:absolute; width:4px; height:4px; border-radius:50%; background:rgba(235,239,219,.65); left:50%; top:50%; transform:translate(-50%,-50%); }
  .penalty-box { position:absolute; width:78px; height:150px; top:50%; transform:translateY(-50%); border:1px solid rgba(235,239,219,.48); }
  .box-left { left:13px; border-left:0; }.box-right { right:13px; border-right:0; }
  .sequence-path { position:absolute; z-index:2; inset:0; display:grid; grid-template-columns:1fr 1fr 1fr; align-items:center; padding:0 6%; }
  .phase-stop { display:flex; align-items:center; position:relative; min-width:0; }
  .phase-number { position:absolute; top:-45px; left:50%; transform:translateX(-50%); font-family:Georgia,serif; font-style:italic; font-size:1.25rem; color:rgba(255,255,255,.58); text-shadow:0 2px 8px rgba(0,0,0,.45); }
  .chosen-phase { width:154px; height:124px; margin:0 auto; padding:13px; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:4px; color:var(--cream); background:rgba(12,22,15,.93); border:2px solid var(--phase-color,#607469); border-radius:0; box-shadow:0 8px 0 rgba(0,0,0,.2); position:relative; overflow:hidden; z-index:2; }
  .chosen-phase::before { content:''; position:absolute; inset:0 auto 0 0; width:5px; background:var(--phase-color,#607469); }
  .chosen-phase.empty { background:rgba(15,32,20,.48); border:2px dashed rgba(226,234,215,.34); box-shadow:none; }
  .chosen-phase strong { font-family:var(--font-display); font-size:.47rem; line-height:1.5; }
  .chosen-phase small { font-size:.78rem; color:#a2afa5; }
  .phase-icon { color:var(--phase-color); font-size:1.35rem; line-height:1; }
  .empty-ball { width:26px; height:26px; color:transparent; border:2px solid rgba(255,255,255,.34); border-radius:50%; position:relative; margin-bottom:4px; }
  .empty-ball::after { content:'+'; color:rgba(255,255,255,.5); position:absolute; inset:0; display:grid; place-items:center; font-family:Arial; }
  .remove-phase { font-family:var(--font-display); font-size:.28rem; color:#bd7461; margin-top:4px; opacity:0; transition:opacity .2s; }
  .chosen-phase:hover .remove-phase { opacity:1; }
  .link-zone { position:absolute; z-index:3; left:calc(100% - 20px); width:calc(100% - 112px); display:flex; align-items:center; justify-content:center; color:rgba(255,255,255,.38); pointer-events:none; }
  .link-zone::before { content:''; position:absolute; left:16px; right:16px; top:50%; height:2px; background:var(--link-color, rgba(255,255,255,.22)); transform:translateY(-50%); }
  .link-arrow { position:relative; font-family:Georgia,serif; font-size:1.5rem; line-height:1; font-weight:bold; color:var(--link-color, rgba(255,255,255,.38)); text-shadow:0 2px 5px rgba(0,0,0,.55); animation:arrow-pulse 1.4s ease-in-out infinite; }
  .link-awaiting { position:absolute; top:22px; font-family:var(--font-display); font-size:.27rem; letter-spacing:.12em; }
  .link-callout { position:absolute; bottom:22px; padding:6px 7px; width:88px; text-align:center; background:#142017; border-bottom:3px solid var(--link-color); box-shadow:0 5px 10px rgba(0,0,0,.25); animation:callout-in .24s ease-out; }
  .link-callout strong { display:block; font-family:var(--font-display); font-size:.45rem; color:var(--link-color); }
  .link-callout small { display:block; font-size:.64rem; line-height:1.05; color:#aab5ac; margin-top:2px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }

  .dugout-heading { padding:22px 2px 12px; }
  .dugout-heading h2 { font-family:var(--font-display); font-size:.62rem; }
  .instruction { color:#7f8c83; font-family:var(--font-display); font-size:.32rem; letter-spacing:.08em; }
  .phase-hand { display:grid; grid-template-columns:repeat(5,minmax(145px,1fr)); gap:11px; }
  .play-card { min-height:258px; padding:0; text-align:left; color:#242622; border-radius:2px; border:0; background:#dfd9c8; box-shadow:5px 7px 0 rgba(0,0,0,.24); position:relative; overflow:hidden; display:flex; flex-direction:column; animation:deal-in .42s backwards; animation-delay:var(--card-delay); transition:transform .16s ease,box-shadow .16s ease,filter .16s; }
  .play-card:not(:disabled):hover { transform:translateY(-8px) rotate(-.4deg); box-shadow:7px 15px 0 rgba(0,0,0,.22); }
  .play-card:disabled { cursor:not-allowed; }
  .play-card.locked { filter:grayscale(.65) brightness(.55); }
  .play-card.picked { filter:none; }
  .card-stripe { height:7px; background:var(--card-color); flex:0 0 auto; }
  .card-top { display:flex; justify-content:space-between; padding:10px 12px 0; font-family:var(--font-display); font-size:.3rem; letter-spacing:.09em; color:#6b6c65; }
  .card-type { color:color-mix(in srgb,var(--card-color) 72%,#212620); }
  .card-symbol { color:var(--card-color); font-size:1.55rem; line-height:1; padding:8px 12px 2px; }
  .play-card h3 { padding:0 12px; font-family:var(--font-display); font-size:.51rem; line-height:1.5; min-height:32px; color:#222520; }
  .formation-strip { display:flex; align-items:center; gap:7px; margin:7px 12px; padding:6px 0; border-top:1px solid #b5b1a5; border-bottom:1px solid #b5b1a5; }
  .formation-strip strong { font-family:var(--font-display); font-size:.43rem; }
  .formation-strip span { font-family:var(--font-display); font-size:.27rem; color:#656861; }
  .play-card p { padding:0 12px; font-size:.82rem; line-height:1.25; color:#5e6159; flex:1; }
  .card-footer { margin-top:8px; min-height:48px; padding:8px 12px; display:flex; justify-content:space-between; align-items:center; background:rgba(33,38,31,.07); }
  .points strong { display:block; font-family:Georgia,serif; font-size:1.28rem; line-height:.9; font-style:italic; }
  .points small,.countered small,.select-cue small { font-family:var(--font-display); font-size:.25rem; color:#71736c; }
  .countered,.select-cue { text-align:right; }
  .countered span,.select-cue span { width:19px; height:19px; margin-left:auto; display:grid; place-items:center; border-radius:50%; font:bold .78rem Arial; }
  .countered span { background:#ad443f; color:#fff; }.countered small { color:#9a3c38; }
  .select-cue span { border:1px solid #777b70; color:#65695f; }
  .picked-stamp { position:absolute; inset:0; display:grid; place-items:center; background:rgba(21,39,26,.88); color:#78d08b; font-family:var(--font-display); font-size:.66rem; letter-spacing:.12em; border:3px solid #78d08b; margin:7px; transform:rotate(-4deg); }

  .match-footer { position:fixed; z-index:10; left:0; right:0; bottom:0; height:82px; display:grid; grid-template-columns:245px 1fr 260px; align-items:center; background:#0a0f0c; border-top:1px solid #354139; box-shadow:0 -10px 30px rgba(0,0,0,.3); }
  .footer-detail { height:100%; padding-left:32px; display:flex; align-items:center; gap:12px; border-right:1px solid #28322b; }
  .whistle { color:#d68047; font-size:1.5rem; transform:rotate(-20deg); }
  .footer-detail small { display:block; font-family:var(--font-display); font-size:.28rem; color:#707d74; }
  .footer-detail strong { display:block; font-family:var(--font-display); font-size:.48rem; margin-top:5px; }
  .footer-message { padding:0 24px; text-align:center; color:#829087; font-style:italic; font-size:1rem; }
  .kickoff-button { height:100%; border-radius:0; display:flex; align-items:center; justify-content:center; gap:18px; background:var(--orange); color:#161916; clip-path:polygon(12% 0,100% 0,100% 100%,0 100%); transition:filter .2s; }
  .kickoff-button:not(:disabled):hover { filter:brightness(1.1); }
  .kickoff-button:not(:disabled) { animation:kick-glow 1.8s ease-in-out infinite; }
  .kickoff-button:disabled { background:#27312a; color:#69756d; cursor:not-allowed; }
  .button-label { font-family:var(--font-display); font-size:.68rem; }
  .button-ball { width:31px; height:31px; display:grid; place-items:center; color:#181b18; border:2px solid currentColor; border-radius:50%; font-size:.4rem; }

  @keyframes deal-in { from { opacity:0; transform:translateY(18px) rotate(1deg); } to { opacity:1; transform:none; } }
  @keyframes callout-in { from { opacity:0; transform:scale(.8); } to { opacity:1; transform:scale(1); } }
  @keyframes pulse { 50% { opacity:.35; } }
  @keyframes arrow-pulse { 50% { opacity:.55; } }
  @keyframes kick-glow { 50% { filter:brightness(1.22); box-shadow:0 0 24px rgba(237,124,62,.35); } }

  @media (max-width: 1120px) {
    .match-layout { grid-template-columns:1fr; }
    .scout-panel { margin-top:0; display:grid; grid-template-columns:1fr 1fr; gap:12px 24px; transform:none; }
    .scout-panel .panel-kicker,.scout-panel .scout-heading { grid-column:1; }
    .scout-copy { grid-column:1; margin:5px 0; }
    .tactics-heading,.tactic-list { grid-column:2; }
    .legend-block { display:none; }
    .phase-hand { grid-template-columns:repeat(3,1fr); }
  }

  @media (max-width: 760px) {
    .matchday-shell { padding-bottom:112px; }
    .match-header { height:auto; min-height:96px; padding:12px 14px; grid-template-columns:46px 1fr 0; }
    .header-status { display:none; }.back-button span:last-child { display:none; }
    .scoreboard { grid-template-columns:1fr 75px 1fr; }.crest { display:none; }.club strong { font-size:.43rem; }.target-score { font-size:.27rem; }
    .match-layout { width:calc(100% - 24px); padding-top:16px; gap:18px; }
    .scout-panel { display:block; padding:16px; }.scout-heading,.legend-block { display:none; }.scout-copy { margin:8px 0 12px; }.tactic-list { flex-direction:row; flex-wrap:wrap; }.tactic-item { flex:1 1 140px; }
    .board-topline h1 { font-size:.58rem; }.selection-count b { font-size:1.7rem; }
    .pitch-board { height:410px; }
    .sequence-path { grid-template-columns:1fr; grid-template-rows:repeat(3,1fr); padding:18px 0; }
    .phase-stop { justify-content:center; }.chosen-phase { width:min(260px,70vw); height:94px; }.phase-number { left:calc(50% - 165px); top:50%; transform:translateY(-50%); }
    .link-zone { top:calc(100% - 15px); left:50%; width:80px; transform:translateX(-50%) rotate(90deg); }.link-callout { display:none; }
    .dugout-heading { align-items:flex-start; }.instruction { max-width:140px; text-align:right; line-height:1.5; }
    .phase-hand { display:flex; overflow-x:auto; padding:0 4px 18px; scroll-snap-type:x mandatory; }.play-card { min-width:205px; scroll-snap-align:start; }
    .match-footer { height:112px; grid-template-columns:1fr 1fr 180px; }.footer-detail { padding-left:16px; grid-column:1; }.footer-message { display:none; }.kickoff-button { grid-column:3; grid-row:1; }
  }

  @media (prefers-reduced-motion: reduce) { *,*::before,*::after { animation-duration:.01ms !important; transition-duration:.01ms !important; } }
</style>
