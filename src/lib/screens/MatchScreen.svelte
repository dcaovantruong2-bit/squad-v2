<script>
  import { onMount, onDestroy, tick } from 'svelte';
  import { game, currentMatch, playCurrentPhase, setPhasePick, slotEligibility } from '../store.js';
  import { ALL_PHASES, FORMATIONS, PHASE_SHAPES } from '../engine/data.js';
  import { detectSynergies, detectSquadSynergies, getPositionPenalty, playerPhaseContribution } from '../engine/engine.js';
  import { sfx } from '../sfx.js';
  // Lock page scroll only while THIS screen is mounted. A :global(body) rule
  // would stay applied after Svelte swaps the screen out, killing scrolling
  // on every later route.
  onMount(() => document.body.classList.add('no-scroll'));
  onDestroy(() => document.body.classList.remove('no-scroll'));


  $: match = $currentMatch;
  $: formation = FORMATIONS.find(f => f.id === $game.formation);
  $: pitchLayout = formation?.pitchLayout || [];
  $: phases = ($game.pickedPhases || []).map(id => ALL_PHASES.find(p => p.id === id)).filter(Boolean);
  $: current = phases[$game.phaseIdx || 0];
  $: target = match?.targets[$game.roundIdx] || 0;
  $: progress = Math.min(100, (($game.roundScore || 0) / Math.max(1, target)) * 100);
  $: pairSynergies = detectSynergies($game.field || [], $game.formation);
  $: squadSynergies = detectSquadSynergies(($game.field || []).map(e => e.player));
  $: phasesPlayed = ($game.phaseResults || []).length;

  // ─── Match-time lineup: tap a player to rearrange who fills each slot ──────
  $: energyById = Object.fromEntries(($game.field || []).map(e => [e.player.id, $game.energy?.[e.player.id]?.current ?? 3]));

  // ─── Phase-shaped pitch: only the players who count for the current phase ──
  // Contribution is engine-backed — a player scores 0 (and drains nothing) when
  // their slot position isn't in the phase's slots. Those are the RESTING XI.
  $: phasePositions = new Set((current?.slots || []).flat());
  $: contributorIdxs = ($game.field || [])
    .map((e, i) => (phasePositions.has(e.position) ? i : -1))
    .filter(i => i >= 0);
  $: resting = ($game.field || []).filter((e, i) => !pickedSet.has(i));
  // Who the player has actively picked for the current phase (slot indices).
  // A slot only counts once the player picks it — no defaults.
  $: pickedSet = new Set($game.phasePickedSlots || []);
  $: needsPicks = contributorSlots.filter(cs => !pickedSet.has(cs.i));
  $: canPlayPhase = !!current && needsPicks.length === 0;
  // Assign each contributor a spot in the phase shape — the k-th player of a
  // position takes the k-th coordinate; fall back to the formation spot if
  // a phase/position has no authored shape.
  $: contributorSlots = (() => {
    const shape = PHASE_SHAPES[current?.id] || {};
    const seen = {};
    return contributorIdxs.map(i => {
      const e = $game.field[i];
      const k = seen[e.position] || 0;
      seen[e.position] = k + 1;
      const s = shape[e.position]?.[k] || { x: pitchLayout[i]?.x ?? 50, y: pitchLayout[i]?.y ?? 50 };
      return { i, pos: e.position, player: e.player, x: s[0], y: s[1], from: pitchLayout[i] };
    });
  })();

  let overlaySlot = null;
  $: overlayEntry = overlaySlot != null ? ($game.field || [])[overlaySlot] : null;
  // Whether the open slot is still unpicked — the incumbent's row then acts as
  // "keep them", confirming the pick instead of dismissing.
  $: slotPicked = overlaySlot != null && pickedSet.has(overlaySlot);

  $: candidates = (() => {
    if (!overlayEntry || !current) return [];
    const slotPos = overlayEntry.position;
    const others = ($game.field || [])
      .map(e => e.player)
      .filter(p => p.id !== overlayEntry.player.id);
    // Everyone is eligible EXCEPT GK exclusivity (GK↔outfield is impossible) —
    // out-of-position picks are allowed at their ×0.70 penalty.
    const rows = [overlayEntry.player, ...others]
      .filter(p => (p.position === 'GK') === (slotPos === 'GK'))
      .map(p => {
        const fit = slotEligibility(p, slotPos);
        const energy = energyById[p.id] ?? 3;
        const contrib = playerPhaseContribution(p, slotPos, current.id, $game);
        const penalty = fit === 'natural' ? 1 : getPositionPenalty(p, slotPos);
        return { player: p, fit, penalty, energy, contrib, isCurrent: p.id === overlayEntry.player.id };
      });
    // Best fit for THIS phase first; in rest slots (all 0) the most-tired first.
    return rows.sort((a, b) => (b.contrib - a.contrib) || (a.energy - b.energy));
  })();

  const fitLabel = c => c.fit === 'natural' ? 'NAT' : c.fit === 'adjacent' ? `ADJ ×${c.penalty}` : `OOP ×${c.penalty}`;
  const fitColor = c => c.fit === 'natural' ? 'var(--ok)' : c.fit === 'adjacent' ? 'var(--info)' : 'var(--accent-soft)';

  function onSwap(playerId) {
    if (overlaySlot != null) setPhasePick(overlaySlot, playerId);
    overlaySlot = null;
  }

  // ─── Fly-to-shape: contributors run from their formation spot into the ─────
  // phase shape when the match opens and when the phase advances. Defenders and
  // the keeper settle first, the front line sprints last; duration scales with
  // distance. Pure CSS transitions, non-blocking — PLAY PHASE stays live.
  let pitchEl = null;
  const FLY_EASE = 'cubic-bezier(.33,.7,.35,1)';

  function flyIntoShape(withWhistle = false) {
    const pitch = pitchEl;
    if (!pitch) return;
    const dots = pitch.querySelectorAll('.player-dot');
    if (!dots.length) return;
    const reduced = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
    if (withWhistle) sfx.kickoff(); // referee whistle — the phase is under way
    dots.forEach(dot => {
      if (dot.dataset.settled === '1') return; // pick-slots + already-flown dots
      const fx = parseFloat(dot.dataset.fx || '50');
      const fy = parseFloat(dot.dataset.fy || '50');
      const tx = parseFloat(dot.dataset.tx || '50');
      const ty = parseFloat(dot.dataset.ty || '50');
      const dist = Math.hypot(tx - fx, ty - fy);
      const role = dot.dataset.role || 'CM';
      const dur = Math.min(620, Math.max(280, dist * 6));
      const delay = (role === 'GK' || role === 'CB' || role === 'FB') ? 0
        : (role === 'CM' || role === 'CDM' || role === 'CAM') ? 70 : 140;
      dot.dataset.settled = '1';
      if (reduced) { dot.style.left = tx + '%'; dot.style.top = ty + '%'; return; }
      dot.style.transition = 'none';
      dot.style.left = fx + '%';
      dot.style.top = fy + '%';
      void dot.offsetWidth; // commit the "from" position
      dot.style.transition = `left ${dur}ms ${FLY_EASE} ${delay}ms, top ${dur}ms ${FLY_EASE} ${delay}ms, border-color .15s, transform .1s`;
      dot.style.left = tx + '%';
      dot.style.top = ty + '%';
      dot.style.animation = `arrive-bounce 300ms cubic-bezier(.2,1.5,.4,1) ${delay + dur + 40}ms`;
    });
  }

  // Phase start: whistle + every picked dot settles into the shape.
  $: current && tick().then(() => flyIntoShape(true));
  // Each new pick: the freshly-picked dot runs into place (others are settled).
  $: pickedSet.size && tick().then(() => flyIntoShape(false));
</script>

<svelte:head><title>Match Centre — SQUAD</title></svelte:head>

<div class="match-shell">
  <div class="grain" aria-hidden="true"></div>
  <header class="scoreboard">
    <div class="club home"><span class="crest orange">S</span><div><small>HOME</small><strong>SQUAD XI</strong></div></div>
    <div class="score-centre"><span>{match?.name} · ROUND {$game.roundIdx + 1}</span><div><b>{$game.roundScore.toLocaleString()}</b><i>V</i><b>{target.toLocaleString()}</b></div><small>POINTS · TARGET</small></div>
    <div class="club away"><div><small>AWAY</small><strong>{match?.opponent}</strong></div><span class="crest red">{match?.opponent?.[0]}</span></div>
  </header>

  <main class="match-grid">
    <aside class="touchline paper">
      <span class="kicker">MATCH STATUS</span><h2>THE DUGOUT</h2>
      <div class="meter"><div style={`width:${progress}%`}></div></div>
      <div class="status-numbers"><strong>{$game.roundScore.toLocaleString()}</strong><span>{Math.max(0,target-$game.roundScore).toLocaleString()} TO GO</span></div>
      <div class="note"><b>MOMENTUM</b><span>×{($game.momentum || 1).toFixed(1)}</span></div>
      <div class="note"><b>ACTIVE LINKS</b><span>{pairSynergies.length + squadSynergies.length}</span></div>
      <p>Each whistle resolves one planned phase. Three phases decide this round.</p>
      <p class="swap-hint">Tap an empty slot on the pitch and pick who plays it — the unpicked rest this phase. The picker ranks your XI by contribution; tired legs drain further.</p>
    </aside>

    <section class="pitch-zone">
      <div class="phase-strip">
        {#each phases as phase, i}
          <div class="phase-step" class:done={i < $game.phaseIdx} class:live={i === $game.phaseIdx}>
            <span>0{i+1}</span><strong>{phase.name}</strong><small>{i < $game.phaseIdx ? `${$game.phaseResults[i]?.score?.toLocaleString()} PTS` : phase.tag}</small>
          </div>
        {/each}
      </div>
      <div class="match-pitch" bind:this={pitchEl}>
        <div class="half"></div><div class="circle"></div><div class="box top"></div><div class="box bottom"></div>
        {#each contributorSlots as cs (cs.i)}
          {@const picked = pickedSet.has(cs.i)}
          {@const cur = energyById[cs.player.id] ?? 3}
          <button
            type="button"
            class="player-dot"
            class:pick={!picked}
            class:low={picked && cur <= 1}
            disabled={!current}
            on:click={() => overlaySlot = cs.i}
            aria-label={picked ? `${cs.player.name} (${cs.pos}) — tap to change` : `${cs.pos} — pick who plays this slot`}
            data-fx={cs.from?.x ?? 50} data-fy={cs.from?.y ?? 50}
            data-tx={cs.x} data-ty={cs.y} data-role={cs.pos}
            data-settled={picked ? undefined : '1'}
            style={`left:clamp(70px, ${cs.x}%, calc(100% - 70px));top:clamp(30px, ${cs.y}%, calc(100% - 30px))`}
          >
            <span>{cs.pos}</span>
            {#if picked}
              <strong>{cs.player.name}</strong>
              <span class="battery" class:mid={cur === 2} class:low={cur <= 1} title={`Energy ${cur}/3 — ${Math.max(0, cur - 1)}/3 after this phase`} aria-hidden="true">
                <i class="bolt">⚡</i><span class="cells"><i class:on={cur >= 1}></i><i class:on={cur >= 2}></i><i class:on={cur >= 3}></i></span><b>{cur}/3</b><em>→ {Math.max(0, cur - 1)}/3</em>
              </span>
            {:else}
              <strong class="pick-label">PICK ▸</strong>
            {/if}
          </button>
        {/each}
        {#if !current}
          <div class="fulltime" aria-hidden="true"><b>FULL TIME</b><small>THE PLAN IS COMPLETE</small></div>
        {/if}
        {#key phasesPlayed}
          <div class="ball" aria-hidden="true">●</div>
        {/key}
      </div>
      <div class="resting-strip">
        <span class="kicker">RESTING THIS PHASE · {resting.length}</span>
        <div class="rest-chips">
          {#each resting as e}
            {@const rcur = energyById[e.player.id] ?? 3}
            <span class="rest-chip" class:low={rcur <= 1} title="Not involved in {current?.name || 'this phase'} — no score, no drain">
              <strong>{e.player.name}</strong><small>{e.position}</small>
              <span class="battery mini"><i class="bolt">⚡</i><span class="cells"><i class:on={rcur >= 1}></i><i class:on={rcur >= 2}></i><i class:on={rcur >= 3}></i></span><b>{rcur}/3</b></span>
              <em>REST</em>
            </span>
          {/each}
        </div>
      </div>
    </section>

    <aside class="commentary paper">
      <span class="kicker">LIVE FEED</span><h2>TOUCHLINE NOTES</h2>
      {#if current}
        <div class="current-call"><small>NEXT PHASE</small><strong>{current.name}</strong><p>{current.desc}</p></div>
      {/if}
      {#each [...($game.phaseResults || [])].reverse() as result}
        {@const phase = ALL_PHASES.find(p => p.id === result.phaseId)}
        <div class="feed-item"><span>✓</span><div><strong>{phase?.name}</strong><small>{result.score.toLocaleString()} points won</small></div></div>
      {/each}
      {#if !$game.phaseResults?.length}<p class="waiting">The referee checks both sides. Your match plan is ready.</p>{/if}
    </aside>
  </main>

  <footer class="match-control">
    <div><small>PHASE {$game.phaseIdx + 1} OF {phases.length}</small><strong>{current?.name || 'ROUND COMPLETE'}</strong></div>
    <p>{!current ? 'The final whistle has gone.' : canPlayPhase ? 'Send the instruction onto the pitch.' : `Pick who plays this phase — ${needsPicks.length} slot${needsPicks.length === 1 ? '' : 's'} left.`}</p>
    <button disabled={!canPlayPhase} on:click={playCurrentPhase}><span>PLAY PHASE</span><b>▶</b></button>
  </footer>

  {#if overlayEntry && current}
    <button class="swap-backdrop" type="button" aria-label="Close lineup picker" on:click={() => overlaySlot = null}></button>
    <div class="swap-sheet" role="dialog" aria-label={`Choose who plays ${overlayEntry.position}`}>
      <header class="swap-head">
        <div class="swap-title">
          <span class="kicker">TACTICAL CHANGE</span>
          <h2>WHO PLAYS {overlayEntry.position}?</h2>
        </div>
        <div class="swap-phase">
          <small>NEXT PHASE</small>
          <strong>{current.name}</strong>
          <span>{current.slots.flat().join(' · ')}</span>
        </div>
        <button class="swap-close" type="button" aria-label="Close" on:click={() => overlaySlot = null}>×</button>
      </header>
      <div class="swap-list">
        {#each candidates as c}
          <button
            type="button"
            class="swap-row"
            class:current={c.isCurrent}
            on:click={() => onSwap(c.player.id)}
          >
            <span class="row-fit" style={`--fit-color:${fitColor(c)}`}>{fitLabel(c)}</span>
            <div class="row-name">
              <strong>{c.player.name}</strong>
              <small>{c.player.position}{c.isCurrent ? (slotPicked ? ' · PLAYING HERE' : ' · TAP TO KEEP') : ''} · ⚡ {c.energy}/3</small>
            </div>
            <div class="row-contrib">
              {#if c.contrib > 0}
                <b>+{c.contrib}</b><small>NEXT PHASE</small>
              {:else}
                <b class="rest">REST</b><small>WON'T COUNT THIS PHASE</small>
              {/if}
            </div>
          </button>
        {/each}
      </div>
      <footer class="swap-foot"><span>TAP A PLAYER TO SWAP · THE XI STAYS COMPLETE</span></footer>
    </div>
  {/if}
</div>

<style>
  .match-shell{--cream:var(--paper-400);--orange:var(--accent);min-height:100vh;height:100vh;padding-bottom:78px;color:var(--cream);background:radial-gradient(circle at 50% -20%,var(--pitch-glow),transparent 46%),linear-gradient(var(--ink-600),var(--ink-900));position:relative}.grain{position:fixed;inset:0;pointer-events:none;opacity:.14;background-image:url("data:image/svg+xml,%3Csvg viewBox='0 0 180 180' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.9'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='.2'/%3E%3C/svg%3E")}.scoreboard{height:102px;display:grid;grid-template-columns:1fr 290px 1fr;align-items:center;padding:0 38px;background:var(--scrim-dark);border-bottom:1px solid var(--ink-400)}.club{display:flex;align-items:center;gap:12px}.club.away{justify-content:flex-end;text-align:right}.club small{display:block;font-family:var(--font-display);font-size:.27rem;color:var(--fg-muted)}.club strong{font-family:var(--font-display);font-size:.58rem}.crest{width:45px;height:51px;display:grid;place-items:center;clip-path:polygon(8% 0,92% 0,100% 70%,50% 100%,0 70%);font-family:var(--font-display)}.orange{background:var(--orange);color:var(--ink-700)}.red{background:var(--print-red-deep)}.score-centre{text-align:center}.score-centre>span,.score-centre small{font-family:var(--font-display);font-size:.28rem;color:var(--fg-muted)}.score-centre div{display:flex;justify-content:center;align-items:center;gap:20px}.score-centre b{font-family:Georgia,serif;font-style:italic;font-size:1.55rem}.score-centre i{color:var(--accent-strong);font-family:Georgia,serif;font-size:1.25rem}
  .match-grid{height:calc(100vh - 180px);width:min(1500px,calc(100% - 44px));margin:auto;display:grid;grid-template-columns:220px 1fr 220px;gap:22px;padding:22px 0}.paper{color:var(--on-paper);background:var(--paper-100);border-top:5px solid var(--bad-strong);box-shadow:7px 9px 0 rgba(0,0,0,.2);padding:18px 15px;overflow:auto}.commentary{border-top-color:var(--fg-muted)}.kicker{font-family:var(--font-display);font-size:.28rem;color:var(--print-red);letter-spacing:.12em}.paper h2{font-family:var(--font-display);font-size:.45rem;margin:8px 0 16px;padding-bottom:9px;border-bottom:2px solid var(--ink-500)}.meter{height:10px;background:var(--paper-line)}.meter div{height:100%;background:var(--ok-strong)}.status-numbers{display:flex;justify-content:space-between;align-items:baseline;margin:8px 0 20px}.status-numbers strong{font-family:Georgia,serif;font-style:italic;font-size:1.5rem}.status-numbers span{font-family:var(--font-display);font-size:.25rem}.note{display:flex;justify-content:space-between;padding:9px 0;border-top:1px solid var(--paper-line)}.note b{font-family:var(--font-display);font-size:.28rem}.touchline p,.waiting{font-size:.82rem;color:var(--on-paper-dim);margin-top:18px;line-height:1.25}.pitch-zone{min-width:0;display:flex;flex-direction:column}.phase-strip{height:72px;display:grid;grid-template-columns:repeat(3,1fr);gap:8px}.phase-step{padding:9px 12px;background:var(--ink-700);border-bottom:3px solid var(--ink-300);color:var(--fg-muted)}.phase-step span{font-family:Georgia,serif;font-style:italic;margin-right:9px}.phase-step strong{font-family:var(--font-display);font-size:.36rem}.phase-step small{display:block;margin:5px 0 0 28px;font-size:.7rem}.phase-step.live{border-color:var(--orange);color:var(--fg);animation:live-pulse 1.6s infinite}.phase-step.done{border-color:var(--ok);color:var(--ok-soft)}.match-pitch{flex:1;min-height:0;position:relative;overflow:hidden;background:var(--pitch-turf);border:2px solid var(--pitch-line-strong);box-shadow:inset 0 0 55px rgba(0,0,0,.4)}.match-pitch::before{content:'';position:absolute;inset:0;opacity:.25;background:repeating-linear-gradient(90deg,rgba(255,255,255,.08) 0 9.09%,rgba(0,0,0,.07) 9.09% 18.18%)}.match-pitch::after{content:'';position:absolute;inset:12px;border:1px solid var(--pitch-line-strong)}.half{position:absolute;top:50%;left:12px;right:12px;border-top:1px solid var(--pitch-line-strong)}.circle{position:absolute;width:90px;height:90px;border:1px solid var(--pitch-line-strong);border-radius:50%;left:50%;top:50%;transform:translate(-50%,-50%)}.box{position:absolute;width:42%;height:14%;border:1px solid var(--pitch-line-strong);left:50%;transform:translateX(-50%)}.box.top{top:12px;border-top:0}.box.bottom{bottom:12px;border-bottom:0}.player-dot{position:absolute;z-index:3;transform:translate(-50%,-50%);width:128px;padding:6px 8px;text-align:center;color:var(--paper-400);background:var(--ink-700);border:1px solid var(--paper-100);box-shadow:0 4px 0 rgba(0,0,0,.2);transition:border-color .15s,transform .15s}.player-dot span{display:block;font-family:var(--font-display);font-size:.25rem;color:var(--accent-strong)}.player-dot strong{display:block;font-family:var(--font-body);font-size:.74rem;color:var(--paper-400);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.player-dot:hover{border-color:var(--orange);transform:translate(-50%,-50%) translateY(-3px)}.player-dot:disabled{cursor:default;border-color:var(--ink-400)}.player-dot .battery{display:flex;justify-content:center;align-items:center;gap:3px;margin-top:4px}.player-dot .battery .bolt{font-style:normal;font-size:.52rem;color:var(--warn-soft)}.player-dot .battery .cells{display:inline-flex;gap:2px;padding:1px;border:1px solid var(--ink-400);border-radius:2px;background:var(--ink-900)}.player-dot .battery .cells i{width:9px;height:5px;border-radius:1px;background:var(--ink-400)}.player-dot .battery .cells i.on{background:var(--ok)}.player-dot .battery.mid .cells i.on{background:var(--warn-soft)}.player-dot .battery.low .cells i.on{background:var(--bad)}.player-dot .battery b{font-family:var(--font-display);font-size:.44rem;color:var(--fg-muted)}.player-dot .battery em{font-style:normal;font-family:var(--font-display);font-size:.4rem;color:var(--accent-strong)}.player-dot.low{opacity:.72;border-color:var(--bad-strong)}.player-dot.pick{background:var(--ink-900);border:1.5px dashed var(--fg-muted);box-shadow:none;color:var(--fg-muted)}.player-dot.pick:hover{border-color:var(--orange);border-style:solid;transform:translate(-50%,-50%) translateY(-2px)}.player-dot.pick span{font-size:.44rem;margin-bottom:2px}.player-dot.pick .pick-label{font-family:var(--font-display);font-size:.52rem;color:var(--fg-muted);letter-spacing:.08em;margin:6px 0 4px}.ball{position:absolute;z-index:4;left:50%;top:50%;transform:translate(-50%,-50%);width:23px;height:23px;display:grid;place-items:center;border:2px solid var(--paper-400);border-radius:50%;color:var(--paper-400);font-size:.28rem;animation:kick .85s ease-out .05s,bob 1.8s infinite 1.15s}.current-call{padding:10px;background:rgba(255,255,255,.24);border-left:3px solid var(--bad-strong)}.current-call small{font-family:var(--font-display);font-size:.25rem;color:var(--on-paper-muted)}.current-call strong{display:block;font-family:var(--font-display);font-size:.4rem;margin:6px 0}.current-call p{font-size:.77rem;line-height:1.2;color:var(--on-paper-dim)}.feed-item{display:flex;gap:8px;padding:9px 2px;border-bottom:1px solid var(--paper-line)}.feed-item>span{color:var(--ok-strong)}.feed-item strong{display:block;font-size:.83rem}.feed-item small{color:var(--on-paper-dim)}.match-control{position:fixed;left:0;right:0;bottom:0;height:78px;display:grid;grid-template-columns:250px 1fr 270px;align-items:center;background:var(--ink-900);border-top:1px solid var(--ink-400)}.match-control>div{height:100%;padding-left:30px;display:flex;flex-direction:column;justify-content:center;border-right:1px solid var(--ink-500)}.match-control small{font-family:var(--font-display);font-size:.26rem;color:var(--fg-muted)}.match-control strong{font-family:var(--font-display);font-size:.42rem;margin-top:5px}.match-control p{text-align:center;color:var(--fg-muted);font-style:italic}.match-control button{height:100%;border-radius:0;clip-path:polygon(12% 0,100% 0,100% 100%,0 100%);background:var(--orange);color:var(--on-accent);display:flex;align-items:center;justify-content:center;gap:18px}.match-control button:disabled{background:var(--ink-500);color:var(--fg-muted)}.swap-hint{margin-top:10px;font-size:.78rem;color:var(--print-brown);border-left:2px solid var(--orange);padding-left:8px}.swap-backdrop{position:fixed;inset:0;z-index:60;background:var(--scrim-dark);border:0;border-radius:0;padding:0;backdrop-filter:blur(2px);animation:fade-in .18s ease-out}.swap-sheet{position:fixed;z-index:61;left:50%;bottom:0;transform:translateX(-50%);width:min(680px,100%);max-height:78vh;display:flex;flex-direction:column;background:linear-gradient(var(--ink-600),var(--ink-900));border:1px solid var(--ink-400);border-bottom:0;box-shadow:0 -18px 45px rgba(0,0,0,.5);animation:sheet-up .24s cubic-bezier(.2,.9,.3,1)}.swap-head{display:flex;align-items:center;gap:18px;padding:16px 22px;border-bottom:1px solid var(--ink-500)}.swap-title .kicker{color:var(--orange)}.swap-title h2{font-family:var(--font-display);font-size:.62rem;margin-top:7px;color:var(--paper-400)}.swap-phase{margin-left:auto;text-align:right}.swap-phase small{display:block;font-family:var(--font-display);font-size:.24rem;color:var(--fg-muted)}.swap-phase strong{display:block;font-family:var(--font-display);font-size:.42rem;color:var(--paper-400);margin:4px 0}.swap-phase span{font-size:.72rem;color:var(--fg-dim)}.swap-close{width:34px;height:34px;padding:0;border-radius:50%;border:1px solid var(--ink-400);background:var(--on-accent);color:var(--fg-dim);font-size:1.05rem;line-height:1}.swap-close:hover{color:var(--paper-400);border-color:var(--fg-muted)}.swap-list{overflow-y:auto;min-height:0;padding:12px 22px 18px;display:flex;flex-direction:column;gap:8px}.swap-row{display:grid;grid-template-columns:74px 1fr auto;align-items:center;gap:14px;padding:11px 14px;text-align:left;background:var(--ink-600);border:1px solid var(--ink-500);border-left:3px solid var(--fit-color,var(--ok));border-radius:0}.swap-row:hover{border-color:var(--ink-300);background:var(--pitch-mid)}.swap-row.current{border-left-color:var(--accent);background:var(--on-accent)}.row-fit{font-family:var(--font-display);font-size:.3rem;color:var(--fit-color,var(--ok));white-space:nowrap}.row-name strong{display:block;font-size:.95rem;color:var(--paper-400)}.row-name small{display:block;font-size:.72rem;color:var(--fg-dim);margin-top:3px}.row-contrib{text-align:right}.row-contrib b{display:block;font-family:Georgia,serif;font-style:italic;font-size:1.15rem;color:var(--ok)}.row-contrib b.rest{color:var(--accent-soft)}.row-contrib small{display:block;font-family:var(--font-display);font-size:.26rem;color:var(--fg-dim);margin-top:3px}.swap-foot{padding:11px 22px calc(11px + env(safe-area-inset-bottom,0px));border-top:1px solid var(--ink-500);font-family:var(--font-display);font-size:.26rem;letter-spacing:.08em;color:var(--fg-muted);text-align:center}@keyframes sheet-up{from{transform:translateX(-50%) translateY(40px);opacity:0}to{transform:translateX(-50%) translateY(0);opacity:1}}@keyframes fade-in{from{opacity:0}to{opacity:1}}@media(max-width:560px){.swap-head{gap:10px;padding:12px 14px}.swap-phase span{display:none}.swap-list{padding:10px 12px 14px}.swap-row{grid-template-columns:60px 1fr auto;gap:9px;padding:9px 10px}.swap-row .row-contrib small{display:none}}@keyframes bob{50%{transform:translate(-50%,-60%)}}@keyframes kick{0%{transform:translate(-50%,-50%)}35%{transform:translate(-28%,-170%) scale(.9)}70%{transform:translate(-46%,-62%)}100%{transform:translate(-50%,-50%)}}@keyframes live-pulse{50%{background:var(--ink-600)}}@media(max-height:700px){.scoreboard{height:88px}.match-grid{height:calc(100vh - 166px);padding:12px 0;gap:14px}.phase-strip{height:56px}.phase-step{padding:6px 10px}.phase-step small{margin-top:3px}.paper{padding:12px}.status-numbers{margin:6px 0 14px}.touchline p{margin-top:10px}}
  @media(max-width:900px){:global(body){overflow:auto}.match-shell{height:auto;min-height:100vh}.match-grid{height:auto;display:flex;flex-direction:column}.pitch-zone{height:600px;order:1}.match-pitch{padding-bottom:44px}.player-dot{width:74px}.touchline{order:2}.commentary{order:3}.match-control{grid-template-columns:1fr 1fr 190px}.match-control>div{grid-column:1}.match-control p{display:none}.match-control button{grid-column:3}.scoreboard{padding:0 12px;grid-template-columns:1fr 150px 1fr}.crest{display:none}}
.resting-strip{margin-top:10px;padding:8px 12px 10px;background:var(--ink-800);border:1px solid var(--ink-500);border-left:3px solid var(--fg-muted);max-height:108px;overflow-y:auto}.resting-strip .kicker{color:var(--fg-muted)}.rest-chips{display:flex;flex-wrap:wrap;gap:6px;margin-top:7px}.rest-chip{display:inline-flex;align-items:center;gap:6px;padding:3px 8px;background:var(--ink-700);border:1px solid var(--ink-500);font-size:.68rem;color:var(--fg-muted)}.rest-chip.low{opacity:.65}.rest-chip strong{font-size:.68rem;color:var(--paper-400)}.rest-chip small{font-family:var(--font-display);font-size:.22rem;color:var(--accent-strong)}.rest-chip em{font-style:normal;font-family:var(--font-display);font-size:.22rem;color:var(--fg-dim)}.rest-chip .battery{display:inline-flex;align-items:center;gap:3px;margin-top:0}.rest-chip .battery .bolt{font-style:normal;font-size:.5rem;color:var(--warn-soft)}.rest-chip .battery .cells{display:inline-flex;gap:2px;padding:1px;border:1px solid var(--ink-400);border-radius:2px;background:var(--ink-900)}.rest-chip .battery .cells i{width:7px;height:4px;border-radius:1px;background:var(--ink-400)}.rest-chip .battery .cells i.on{background:var(--ok)}.rest-chip .battery.low .cells i.on{background:var(--bad)}.rest-chip .battery b{font-family:var(--font-display);font-size:.4rem;color:var(--fg-muted)}.fulltime{position:absolute;inset:0;z-index:5;display:grid;place-content:center;justify-items:center;gap:8px;background:rgba(0,0,0,.4)}.fulltime b{font-family:var(--font-display);font-size:.8rem;color:var(--paper-400)}.fulltime small{font-family:var(--font-display);font-size:.3rem;color:var(--fg-muted)}@keyframes arrive-bounce{0%{transform:translate(-50%,-50%) scale(1)}45%{transform:translate(-50%,-50%) scale(1.07)}100%{transform:translate(-50%,-50%) scale(1)}}@media (prefers-reduced-motion: reduce){.player-dot,.ball{transition:none!important;animation:none!important}}
</style>
