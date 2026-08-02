<script>
  import { game, currentMatch, continueAfterPhase } from '../store.js';
  import { ALL_PHASES } from '../engine/data.js';

  $: result = $game.lastPhaseResult;
  $: phase = ALL_PHASES.find(p => p.id === result?.phaseId);
  $: target = $currentMatch?.targets[$game.roundIdx] || 0;
  $: total = $game.roundScore || 0;
  $: done = ($game.phaseIdx || 0) >= ($game.pickedPhases || []).length;
  $: topPlayers = [...(result?.breakdown || [])].sort((a,b)=>b.contrib-a.contrib).slice(0,5);
</script>

<div class="result-shell">
  <div class="flash" aria-hidden="true"></div>
  <header><span>PHASE {result?.phaseIndex + 1} / 3</span><strong>{phase?.name}</strong><span>ROUND {$game.roundIdx + 1}</span></header>
  <main>
    <section class="score-card">
      <span class="whistle">◖</span><small>PHASE SCORE</small><h1>{result?.score?.toLocaleString() || 0}</h1><b>POINTS</b>
      <div class="running"><span>ROUND TOTAL</span><strong>{total.toLocaleString()} / {target.toLocaleString()}</strong></div>
    </section>
    <section class="breakdown paper">
      <span class="kicker">HOW IT HAPPENED</span><h2>TACTICAL BREAKDOWN</h2>
      <div class="formula"><div><small>CHAIN</small><strong>×{result?.phaseMult || 1}</strong></div><div><small>MOMENTUM</small><strong>×{result?.momentum || 1}</strong></div><div><small>OPP.</small><strong>×{result?.tacMult || 1}</strong></div><div><small>BONUS</small><strong>+{result?.chainBonusChips || 0}</strong></div></div>
      <h3>TOP CONTRIBUTORS</h3>
      {#each topPlayers as p,i}<div class="player-row"><span>0{i+1}</span><strong>{p.player.name}</strong><small>{p.position}</small><b>+{p.contrib}</b></div>{/each}
    </section>
    <aside class="links paper">
      <span class="kicker">COMBINATIONS</span><h2>LINKS FIRED</h2>
      {#each result?.synergies || [] as syn}<div class="link"><span>✓</span><div><strong>{syn.name}</strong><small>{syn.chips ? `+${syn.chips} chips` : syn.addMult ? `+${syn.addMult} mult` : `×${syn.xMult}`}</small></div></div>{/each}
      {#if !result?.synergies?.length}<p>No positional link fired in this phase.</p>{/if}
      <div class="energy-note">Players involved have spent one energy.</div>
    </aside>
  </main>
  <footer><div><small>{done ? 'ROUND COMPLETE' : 'NEXT INSTRUCTION'}</small><strong>{done ? 'RETURN TO THE DUGOUT' : ALL_PHASES.find(p=>p.id===$game.pickedPhases[$game.phaseIdx])?.name}</strong></div><p>{done ? 'Three phases played. See whether the plan beat the target.' : 'The ball is still in play.'}</p><button on:click={continueAfterPhase}>{done ? 'FULL TIME' : 'CONTINUE'} <b>→</b></button></footer>
</div>

<style>
  :global(body){overflow:hidden}.result-shell{--paper:#d7d0bd;--orange:#e87c42;min-height:100vh;height:100vh;padding-bottom:80px;color:#eee7d7;background:radial-gradient(circle at 50% 10%,rgba(78,125,87,.35),transparent 38%),linear-gradient(#112018,#080e0a);position:relative}.flash{position:absolute;inset:0;pointer-events:none;background:radial-gradient(circle at 32% 46%,rgba(232,124,66,.12),transparent 24%)}header{height:82px;padding:0 36px;display:flex;justify-content:space-between;align-items:center;background:#080e0a;border-bottom:1px solid #354139;font-family:var(--font-display);font-size:.3rem;color:#748178}header strong{font-size:.68rem;color:#eee7d7}main{height:calc(100vh - 162px);width:min(1250px,calc(100% - 44px));margin:auto;display:grid;grid-template-columns:300px 1fr 250px;gap:24px;padding:30px 0}.score-card{display:flex;flex-direction:column;align-items:center;justify-content:center;background:#18261c;border:1px solid #506056;box-shadow:10px 12px 0 rgba(0,0,0,.22);position:relative}.whistle{font-size:2rem;color:var(--orange);transform:rotate(-20deg)}.score-card small,.running span{font-family:var(--font-display);font-size:.3rem;color:#7c8b81}.score-card h1{font-family:Georgia,serif;font-style:italic;font-size:4.6rem;line-height:1;color:#f0e4c9;text-shadow:0 6px 0 rgba(0,0,0,.18)}.score-card>b{font-family:var(--font-display);font-size:.4rem;color:#e99156}.running{width:80%;margin-top:34px;padding-top:14px;border-top:1px solid #46544b;text-align:center}.running strong{display:block;font-family:var(--font-display);font-size:.45rem;margin-top:7px}.paper{color:#292b27;background:var(--paper);border-top:5px solid #b34d42;box-shadow:8px 10px 0 rgba(0,0,0,.2);padding:20px;overflow:auto}.links{border-top-color:#5e7564}.kicker{font-family:var(--font-display);font-size:.27rem;color:#8e4139;letter-spacing:.12em}.paper h2{font-family:var(--font-display);font-size:.48rem;margin:9px 0 18px;padding-bottom:10px;border-bottom:2px solid #373a33}.formula{display:grid;grid-template-columns:repeat(4,1fr);gap:7px}.formula div{padding:10px 5px;text-align:center;background:rgba(255,255,255,.24)}.formula small{font-family:var(--font-display);font-size:.24rem;color:#73766d}.formula strong{display:block;font-family:Georgia,serif;font-style:italic;font-size:1.2rem;margin-top:4px}.paper h3{font-family:var(--font-display);font-size:.3rem;color:#71746b;margin:22px 0 7px}.player-row{display:grid;grid-template-columns:27px 1fr 35px 55px;align-items:center;padding:9px 3px;border-bottom:1px solid #aaa596}.player-row>span{font-family:Georgia,serif;font-style:italic;color:#8a8b81}.player-row strong{font-size:.88rem}.player-row small{font-family:var(--font-display);font-size:.26rem}.player-row b{text-align:right;color:#37764a}.link{display:flex;gap:9px;padding:9px 2px;border-bottom:1px solid #aaa596}.link>span{color:#39774b}.link strong{display:block;font-size:.86rem}.link small{color:#696d64}.links p{font-size:.84rem;color:#6c6f66}.energy-note{margin-top:20px;padding:9px;background:rgba(181,75,65,.1);font-size:.76rem;color:#7c5148}footer{position:fixed;left:0;right:0;bottom:0;height:80px;display:grid;grid-template-columns:280px 1fr 260px;align-items:center;background:#080e0a;border-top:1px solid #354139}footer>div{height:100%;padding-left:30px;display:flex;flex-direction:column;justify-content:center;border-right:1px solid #29342d}footer small{font-family:var(--font-display);font-size:.25rem;color:#6f7d74}footer strong{font-family:var(--font-display);font-size:.4rem;margin-top:6px}footer p{text-align:center;color:#7c8980;font-style:italic}footer button{height:100%;border-radius:0;clip-path:polygon(12% 0,100% 0,100% 100%,0 100%);background:var(--orange);color:#171a16;font-size:.5rem}@media(max-width:850px){main{height:auto;display:flex;flex-direction:column}.result-shell{height:auto;min-height:100vh}.score-card{min-height:360px}footer{grid-template-columns:1fr 190px}footer p{display:none}}
</style>
