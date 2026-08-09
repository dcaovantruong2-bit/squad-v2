<script>
  import { onMount, onDestroy } from 'svelte';
  import { game, currentMatch, continueAfterPhase } from '../store.js';
  import { ALL_PHASES } from '../engine/data.js';
  import { sfx } from '../sfx.js';
  // Lock page scroll only while THIS screen is mounted. A :global(body) rule
  // would stay applied after Svelte swaps the screen out, killing scrolling
  // on every later route.
  onMount(() => document.body.classList.add('no-scroll'));
  onDestroy(() => document.body.classList.remove('no-scroll'));


  $: result = $game.lastPhaseResult;
  $: phase = ALL_PHASES.find(p => p.id === result?.phaseId);
  $: target = $currentMatch?.targets[$game.roundIdx] || 0;
  $: total = $game.roundScore || 0;
  $: done = ($game.phaseIdx || 0) >= ($game.pickedPhases || []).length;
  $: topPlayers = [...(result?.breakdown || [])].sort((a,b)=>b.contrib-a.contrib).slice(0,5);

  // ── juice: score count-up → impact frame ──────────────────────────────────
  // The count runs fast (480ms). The instant it lands, `impact` flips and the
  // CSS cascade fires: number pop + card shake + flash + staggered mult-badge
  // slams, all in the same frame (the "impact frame"). Nothing gates input —
  // CONTINUE works at any moment.
  let shown = 0;
  let impact = false;
  let confetti = [];
  const COUNT_DUR = 480;

  // Deterministic PRNG seeded from the score so re-renders (HMR) don't reshuffle
  // the confetti mid-flight.
  function rng(seed) {
    let s = (seed >>> 0) || 1;
    return () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296;
  }

  // Confetti is INFORMATION, not decoration: it only fires when this phase
  // alone cleared the round target — a rare, meaningful event.
  $: bigMoment = target > 0 && (result?.score ?? 0) >= target;

  onMount(() => {
    shown = 0;
    impact = false;
    const goal = $game.lastPhaseResult?.score ?? 0;
    const t0 = performance.now();
    let raf;
    sfx.phase(); // rising tally while the numbers climb
    const step = t => {
      const p = Math.min(1, (t - t0) / COUNT_DUR);
      shown = Math.round(goal * (1 - Math.pow(1 - p, 3))); // easeOutCubic
      if (p < 1) {
        raf = requestAnimationFrame(step);
      } else {
        shown = goal;
        impact = true; // pop + shake + flash + badge slams
        sfx.land();    // impact thud
        if (bigMoment) {
          sfx.win();
          const rand = rng(goal ^ ($game.phaseIdx || 0) ^ 0x9e3779b9);
          confetti = Array.from({ length: 18 }, (_, i) => ({
            dx: (rand() * 2 - 1) * 220,
            dy: 60 + rand() * 240,
            rot: (rand() * 2 - 1) * 540,
            delay: rand() * 120,
            size: 5 + rand() * 5,
            c: ['--accent-strong','--warn-soft','--ok','--bad','--rare','--info'][i % 6],
          }));
        }
      }
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  });
</script>

<div class="result-shell" class:impact>
  <div class="flash" aria-hidden="true"></div>
  <header><span>PHASE {result?.phaseIndex + 1} / 3</span><strong>{phase?.name}</strong><span>ROUND {$game.roundIdx + 1}</span></header>
  <main>
    <section class="score-card">
      <div class="confetti-zone" aria-hidden="true">
        {#if impact}{#each confetti as c}
          <span class="confetti" style="--dx:{c.dx}px;--dy:{c.dy}px;--rot:{c.rot}deg;--size:{c.size}px;background:var({c.c});animation-delay:{c.delay}ms"></span>
        {/each}{/if}
      </div>
      <span class="whistle">◖</span><small>PHASE SCORE</small><h1>{shown.toLocaleString()}</h1><b>POINTS</b>
      <div class="running"><span>ROUND TOTAL</span><strong>{total.toLocaleString()} / {target.toLocaleString()}</strong></div>
    </section>
    <section class="breakdown paper">
      <span class="kicker">HOW IT HAPPENED</span><h2>TACTICAL BREAKDOWN</h2>
      <div class="formula"><div style="--i:0"><small>CHAIN</small><strong>×{result?.phaseMult || 1}</strong></div><div style="--i:1"><small>MOMENTUM</small><strong>×{result?.momentum || 1}</strong></div><div style="--i:2"><small>OPP.</small><strong>×{result?.tacMult || 1}</strong></div><div style="--i:3"><small>BONUS</small><strong>+{result?.chainBonusChips || 0}</strong></div></div>
      <h3>TOP CONTRIBUTORS</h3>
      {#each topPlayers as p,i}<div class="player-row"><span>0{i+1}</span><strong>{p.player.name}</strong><small>{p.position}</small><b>+{p.contrib}</b></div>{/each}
    </section>
    <aside class="links paper">
      <span class="kicker">COMBINATIONS</span><h2>LINKS FIRED</h2>
      {#each result?.synergies || [] as syn, i}<div class="link" style="--i:{i}"><span>✓</span><div><strong>{syn.name}</strong><small>{syn.chips ? `+${syn.chips} chips` : syn.addMult ? `+${syn.addMult} mult` : `×${syn.xMult}`}</small></div></div>{/each}
      {#if !result?.synergies?.length}<p>No positional link fired in this phase.</p>{/if}
      <div class="energy-note">Players involved have spent one energy.</div>
    </aside>
  </main>
  <footer><div><small>{done ? 'ROUND COMPLETE' : 'NEXT INSTRUCTION'}</small><strong>{done ? 'RETURN TO THE DUGOUT' : ALL_PHASES.find(p=>p.id===$game.pickedPhases[$game.phaseIdx])?.name}</strong></div><p>{done ? 'Three phases played. See whether the plan beat the target.' : 'The ball is still in play.'}</p><button on:click={continueAfterPhase}>{done ? 'FULL TIME' : 'CONTINUE'} <b>→</b></button></footer>
</div>

<style>
  .result-shell{--paper:var(--paper-100);--orange:var(--accent);min-height:100vh;height:100vh;padding-bottom:80px;color:var(--paper-400);background:radial-gradient(circle at 50% 10%,var(--ok-tint),transparent 38%),linear-gradient(var(--ink-800),var(--ink-900));position:relative}.flash{position:absolute;inset:0;pointer-events:none;opacity:0;background:radial-gradient(circle at 50% 42%,var(--paper-400),transparent 52%)}header{height:82px;padding:0 36px;display:flex;justify-content:space-between;align-items:center;background:var(--ink-900);border-bottom:1px solid var(--ink-400);font-family:var(--font-display);font-size:.3rem;color:var(--fg-muted)}header strong{font-size:.68rem;color:var(--paper-400)}main{height:calc(100vh - 162px);width:min(1250px,calc(100% - 44px));margin:auto;display:grid;grid-template-columns:300px 1fr 250px;gap:24px;padding:30px 0}.score-card{display:flex;flex-direction:column;align-items:center;justify-content:center;background:var(--ink-600);border:1px solid var(--ink-300);box-shadow:10px 12px 0 rgba(0,0,0,.22);position:relative}.whistle{font-size:2rem;color:var(--orange);transform:rotate(-20deg)}.score-card small,.running span{font-family:var(--font-display);font-size:.3rem;color:var(--fg-muted)}.score-card h1{font-family:Georgia,serif;font-style:italic;font-size:4.6rem;line-height:1;color:var(--fg);text-shadow:0 6px 0 rgba(0,0,0,.18)}.score-card>b{font-family:var(--font-display);font-size:.4rem;color:var(--accent-strong)}.running{width:80%;margin-top:34px;padding-top:14px;border-top:1px solid var(--ink-300);text-align:center}.running strong{display:block;font-family:var(--font-display);font-size:.45rem;margin-top:7px}.paper{color:var(--on-paper);background:var(--paper);border-top:5px solid var(--bad-strong);box-shadow:8px 10px 0 rgba(0,0,0,.2);padding:20px;overflow:auto}.links{border-top-color:var(--fg-muted)}.kicker{font-family:var(--font-display);font-size:.27rem;color:var(--print-red);letter-spacing:.12em}.paper h2{font-family:var(--font-display);font-size:.48rem;margin:9px 0 18px;padding-bottom:10px;border-bottom:2px solid var(--paper-line)}.formula{display:grid;grid-template-columns:repeat(4,1fr);gap:7px}.formula div{padding:10px 5px;text-align:center;background:rgba(255,255,255,.24)}.formula small{font-family:var(--font-display);font-size:.24rem;color:var(--on-paper-muted)}.formula strong{display:block;font-family:Georgia,serif;font-style:italic;font-size:1.2rem;margin-top:4px}.paper h3{font-family:var(--font-display);font-size:.3rem;color:var(--on-paper-muted);margin:22px 0 7px}.player-row{display:grid;grid-template-columns:27px 1fr 35px 55px;align-items:center;padding:9px 3px;border-bottom:1px solid var(--paper-line)}.player-row>span{font-family:Georgia,serif;font-style:italic;color:var(--fg-dim)}.player-row strong{font-size:.88rem}.player-row small{font-family:var(--font-display);font-size:.26rem}.player-row b{text-align:right;color:var(--ok-strong)}.link{display:flex;gap:9px;padding:9px 2px;border-bottom:1px solid var(--paper-line)}.link>span{color:var(--ok-strong)}.link strong{display:block;font-size:.86rem}.link small{color:var(--on-paper-dim)}.links p{font-size:.84rem;color:var(--on-paper-dim)}.energy-note{margin-top:20px;padding:9px;background:var(--bad-tint);font-size:.76rem;color:var(--print-brown)}footer{position:fixed;left:0;right:0;bottom:0;height:80px;display:grid;grid-template-columns:280px 1fr 260px;align-items:stretch;background:var(--ink-900)}footer>div{height:100%;padding-left:30px;display:flex;flex-direction:column;justify-content:center;border-right:1px solid var(--ink-400)}footer small{font-family:var(--font-display);font-size:.25rem;color:var(--fg-muted)}footer strong{font-family:var(--font-display);font-size:.4rem;margin-top:6px}footer p{text-align:center;color:var(--fg-muted);font-style:italic}footer button{height:100%;border-radius:0;clip-path:polygon(12% 0,100% 0,100% 100%,0 100%);background:var(--orange);color:var(--on-accent);font-family:var(--font-display);font-size:.42rem;border:0;cursor:pointer}footer button:hover{filter:brightness(1.1)}

  /* ── juice: impact-frame cascade (fires when .impact lands on the shell) ── */
  .impact .flash{animation:impact-flash .12s linear forwards}
  .impact .score-card{animation:card-shake .14s ease-out}
  .impact .score-card h1{animation:num-pop .26s cubic-bezier(.2,1.45,.35,1);transform-origin:center}
  .impact .formula div{animation:badge-slam .22s cubic-bezier(.2,1.3,.4,1) both;animation-delay:calc(var(--i,0)*45ms)}
  .impact .link{animation:link-slide .24s ease-out both;animation-delay:calc(110ms + var(--i,0)*40ms)}
  .confetti-zone{position:absolute;inset:0;pointer-events:none;overflow:hidden}
  .confetti{position:absolute;left:50%;top:44%;width:var(--size);height:var(--size);border-radius:2px;animation:confetti-fly .7s cubic-bezier(.2,.6,.45,1) forwards}

  @keyframes impact-flash{0%{opacity:.9}100%{opacity:0}}
  @keyframes card-shake{0%,100%{transform:translateX(0)}25%{transform:translateX(-4px)}50%{transform:translateX(3px)}75%{transform:translateX(-2px)}}
  @keyframes num-pop{0%{transform:scale(1)}55%{transform:scale(1.32)}100%{transform:scale(1)}}
  @keyframes badge-slam{0%{transform:scale(.35);opacity:0}60%{transform:scale(1.12);opacity:1}100%{transform:scale(1);opacity:1}}
  @keyframes link-slide{from{transform:translateY(6px);opacity:0}to{transform:none;opacity:1}}
  @keyframes confetti-fly{0%{transform:translate(0,0) rotate(0);opacity:1}100%{transform:translate(var(--dx),var(--dy)) rotate(var(--rot));opacity:0}}

  @media (prefers-reduced-motion: reduce){
    .impact .flash,.impact .score-card,.impact .score-card h1,.impact .formula div,.impact .link,.confetti{animation:none!important}
  }
  @media(max-height:700px){main{height:calc(100vh - 148px);padding:14px 0;gap:14px}header{height:66px}.score-card h1{font-size:3.6rem}.running{margin-top:16px}.paper{padding:14px}.formula div{padding:7px 4px}.paper h3{margin:14px 0 5px}.player-row{padding:6px 3px}}
</style>
