<script>
  import { game, currentMatch, playCurrentPhase } from '../store.js';
  import { ALL_PHASES, FORMATIONS } from '../engine/data.js';
  import { detectSynergies, detectSquadSynergies } from '../engine/engine.js';

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
    </aside>

    <section class="pitch-zone">
      <div class="phase-strip">
        {#each phases as phase, i}
          <div class="phase-step" class:done={i < $game.phaseIdx} class:live={i === $game.phaseIdx}>
            <span>0{i+1}</span><strong>{phase.name}</strong><small>{i < $game.phaseIdx ? `${$game.phaseResults[i]?.score?.toLocaleString()} PTS` : phase.tag}</small>
          </div>
        {/each}
      </div>
      <div class="match-pitch">
        <div class="half"></div><div class="circle"></div><div class="box top"></div><div class="box bottom"></div>
        {#each $game.field || [] as entry, i}
          <div class="player-dot" style={`left:clamp(52px, ${pitchLayout[i]?.x || 50}%, calc(100% - 52px));top:clamp(30px, ${pitchLayout[i]?.y || 50}%, calc(100% - 30px))`}>
            <span>{entry.position}</span><strong>{entry.player.name}</strong>
          </div>
        {/each}
        {#key phasesPlayed}
          <div class="ball" aria-hidden="true">●</div>
        {/key}
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
    <p>{current ? 'Send the instruction onto the pitch.' : 'The final whistle has gone.'}</p>
    <button disabled={!current} on:click={playCurrentPhase}><span>PLAY PHASE</span><b>▶</b></button>
  </footer>
</div>

<style>
  :global(body){overflow:hidden}.match-shell{--cream:#ebe5d5;--orange:#e87c42;min-height:100vh;height:100vh;padding-bottom:78px;color:var(--cream);background:radial-gradient(circle at 50% -20%,rgba(65,105,75,.34),transparent 46%),linear-gradient(#122219,#09100c);position:relative}.grain{position:fixed;inset:0;pointer-events:none;opacity:.14;background-image:url("data:image/svg+xml,%3Csvg viewBox='0 0 180 180' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.9'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='.2'/%3E%3C/svg%3E")}.scoreboard{height:102px;display:grid;grid-template-columns:1fr 290px 1fr;align-items:center;padding:0 38px;background:rgba(5,10,7,.84);border-bottom:1px solid #344139}.club{display:flex;align-items:center;gap:12px}.club.away{justify-content:flex-end;text-align:right}.club small{display:block;font-family:var(--font-display);font-size:.27rem;color:#718078}.club strong{font-family:var(--font-display);font-size:.58rem}.crest{width:45px;height:51px;display:grid;place-items:center;clip-path:polygon(8% 0,92% 0,100% 70%,50% 100%,0 70%);font-family:var(--font-display)}.orange{background:var(--orange);color:#182018}.red{background:#793235}.score-centre{text-align:center}.score-centre>span,.score-centre small{font-family:var(--font-display);font-size:.28rem;color:#758279}.score-centre div{display:flex;justify-content:center;align-items:center;gap:20px}.score-centre b{font-family:Georgia,serif;font-style:italic;font-size:1.55rem}.score-centre i{color:#d18049;font-family:Georgia,serif;font-size:1.25rem}
  .match-grid{height:calc(100vh - 180px);width:min(1500px,calc(100% - 44px));margin:auto;display:grid;grid-template-columns:220px 1fr 220px;gap:22px;padding:22px 0}.paper{color:#292b27;background:#d7d0bd;border-top:5px solid #b54b41;box-shadow:7px 9px 0 rgba(0,0,0,.2);padding:18px 15px;overflow:auto}.commentary{border-top-color:#5d7564}.kicker{font-family:var(--font-display);font-size:.28rem;color:#91433b;letter-spacing:.12em}.paper h2{font-family:var(--font-display);font-size:.45rem;margin:8px 0 16px;padding-bottom:9px;border-bottom:2px solid #34372f}.meter{height:10px;background:#aaa596}.meter div{height:100%;background:#4d8c5f}.status-numbers{display:flex;justify-content:space-between;align-items:baseline;margin:8px 0 20px}.status-numbers strong{font-family:Georgia,serif;font-style:italic;font-size:1.5rem}.status-numbers span{font-family:var(--font-display);font-size:.25rem}.note{display:flex;justify-content:space-between;padding:9px 0;border-top:1px solid #aaa596}.note b{font-family:var(--font-display);font-size:.28rem}.touchline p,.waiting{font-size:.82rem;color:#6c6f65;margin-top:18px;line-height:1.25}.pitch-zone{min-width:0;display:flex;flex-direction:column}.phase-strip{height:72px;display:grid;grid-template-columns:repeat(3,1fr);gap:8px}.phase-step{padding:9px 12px;background:#151f18;border-bottom:3px solid #455249;color:#748178}.phase-step span{font-family:Georgia,serif;font-style:italic;margin-right:9px}.phase-step strong{font-family:var(--font-display);font-size:.36rem}.phase-step small{display:block;margin:5px 0 0 28px;font-size:.7rem}.phase-step.live{border-color:var(--orange);color:#eee5d4;animation:live-pulse 1.6s infinite}.phase-step.done{border-color:#6cc080;color:#92c79e}.match-pitch{flex:1;position:relative;overflow:hidden;background:#28583a;border:2px solid rgba(235,240,220,.5);box-shadow:inset 0 0 55px rgba(0,0,0,.4)}.match-pitch::before{content:'';position:absolute;inset:0;opacity:.25;background:repeating-linear-gradient(90deg,rgba(255,255,255,.08) 0 9.09%,rgba(0,0,0,.07) 9.09% 18.18%)}.match-pitch::after{content:'';position:absolute;inset:12px;border:1px solid rgba(240,243,226,.5)}.half{position:absolute;top:50%;left:12px;right:12px;border-top:1px solid rgba(240,243,226,.5)}.circle{position:absolute;width:90px;height:90px;border:1px solid rgba(240,243,226,.5);border-radius:50%;left:50%;top:50%;transform:translate(-50%,-50%)}.box{position:absolute;width:42%;height:14%;border:1px solid rgba(240,243,226,.5);left:50%;transform:translateX(-50%)}.box.top{top:12px;border-top:0}.box.bottom{bottom:12px;border-bottom:0}.player-dot{position:absolute;z-index:3;transform:translate(-50%,-50%);width:92px;padding:5px 6px;text-align:center;background:#111e15;border:1px solid #d5d1bd;box-shadow:0 4px 0 rgba(0,0,0,.2)}.player-dot span{display:block;font-family:var(--font-display);font-size:.25rem;color:#e68b51}.player-dot strong{display:block;font-size:.7rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.ball{position:absolute;z-index:4;left:50%;top:50%;transform:translate(-50%,-50%);width:23px;height:23px;display:grid;place-items:center;border:2px solid #f0ebda;border-radius:50%;color:#f0ebda;font-size:.28rem;animation:kick .85s ease-out .05s,bob 1.8s infinite 1.15s}.current-call{padding:10px;background:rgba(255,255,255,.24);border-left:3px solid #b14b41}.current-call small{font-family:var(--font-display);font-size:.25rem;color:#77796f}.current-call strong{display:block;font-family:var(--font-display);font-size:.4rem;margin:6px 0}.current-call p{font-size:.77rem;line-height:1.2;color:#65685f}.feed-item{display:flex;gap:8px;padding:9px 2px;border-bottom:1px solid #aaa596}.feed-item>span{color:#39784b}.feed-item strong{display:block;font-size:.83rem}.feed-item small{color:#6d7067}.match-control{position:fixed;left:0;right:0;bottom:0;height:78px;display:grid;grid-template-columns:250px 1fr 270px;align-items:center;background:#080e0a;border-top:1px solid #354139}.match-control>div{height:100%;padding-left:30px;display:flex;flex-direction:column;justify-content:center;border-right:1px solid #29342d}.match-control small{font-family:var(--font-display);font-size:.26rem;color:#6f7c74}.match-control strong{font-family:var(--font-display);font-size:.42rem;margin-top:5px}.match-control p{text-align:center;color:#7d8981;font-style:italic}.match-control button{height:100%;border-radius:0;clip-path:polygon(12% 0,100% 0,100% 100%,0 100%);background:var(--orange);color:#171a16;display:flex;align-items:center;justify-content:center;gap:18px}.match-control button:disabled{background:#263029;color:#69736c}@keyframes bob{50%{transform:translate(-50%,-60%)}}@keyframes kick{0%{transform:translate(-50%,-50%)}35%{transform:translate(-28%,-170%) scale(.9)}70%{transform:translate(-46%,-62%)}100%{transform:translate(-50%,-50%)}}@keyframes live-pulse{50%{background:#1c2d22}}@media(max-height:700px){.scoreboard{height:88px}.match-grid{height:calc(100vh - 166px);padding:12px 0;gap:14px}.phase-strip{height:56px}.phase-step{padding:6px 10px}.phase-step small{margin-top:3px}.paper{padding:12px}.status-numbers{margin:6px 0 14px}.touchline p{margin-top:10px}}
  @media(max-width:900px){:global(body){overflow:auto}.match-shell{height:auto;min-height:100vh}.match-grid{height:auto;display:flex;flex-direction:column}.pitch-zone{height:600px;order:1}.match-pitch{padding-bottom:44px}.touchline{order:2}.commentary{order:3}.match-control{grid-template-columns:1fr 1fr 190px}.match-control>div{grid-column:1}.match-control p{display:none}.match-control button{grid-column:3}.scoreboard{padding:0 12px;grid-template-columns:1fr 150px 1fr}.crest{display:none}}
</style>
