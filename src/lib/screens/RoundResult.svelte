<script>
  import { onMount, onDestroy } from 'svelte';
  import { game, currentMatch, continueAfterRound } from '../store.js';
  // Lock page scroll only while THIS screen is mounted. A :global(body) rule
  // would stay applied after Svelte swaps the screen out, killing scrolling
  // on every later route.
  onMount(() => document.body.classList.add('no-scroll'));
  onDestroy(() => document.body.classList.remove('no-scroll'));

  $: outcome = $game.lastRoundOutcome || { won:false, score:0 };
  $: target = $currentMatch?.targets[$game.roundIdx] || 0;
  $: wins = ($game.roundResults || []).filter(r=>r.won).length;
  $: losses = ($game.roundResults || []).length - wins;
  $: decided = wins >= 2 || losses >= 2 || ($game.roundResults || []).length >= 3;
</script>

<div class="round-shell" class:won={outcome.won}>
  <header><span>{$currentMatch?.tier}</span><strong>ROUND {($game.roundResults || []).length} — {outcome.won?'WON':'LOST'}</strong><span>BEST OF THREE</span></header>
  <main>
    <div class="result-mark"><span>{outcome.won?'✓':'×'}</span><small>{outcome.won?'TARGET BEATEN':'TARGET MISSED'}</small><h1>{outcome.score.toLocaleString()}</h1><b>OF {target.toLocaleString()} REQUIRED</b></div>
    <section class="score-sheet">
      <span class="kicker">MATCH CARD</span><h2>{$currentMatch?.opponent}</h2>
      <div class="rounds">{#each [0,1,2] as i}{@const r=$game.roundResults?.[i]}<div class:win={r?.won} class:loss={r&&!r.won}><span>ROUND {i+1}</span><strong>{r?r.score.toLocaleString():'—'}</strong><small>{r?(r.won?'W':'L'):'TO PLAY'}</small></div>{/each}</div>
      <div class="series"><div><small>ROUNDS WON</small><strong>{wins}</strong></div><i>—</i><div><small>ROUNDS LOST</small><strong>{losses}</strong></div></div>
      <p>{decided ? (wins>=2?'The tie is yours. The dressing room celebrates.':'The tie is over. Your campaign ends here.') : 'Reset. Recover. One more round can change the tie.'}</p>
    </section>
  </main>
  <footer><div><small>{decided?'MATCH DECIDED':'NEXT ROUND'}</small><strong>{decided?(wins>=2?'VICTORY':'ELIMINATED'):`ROUND ${$game.roundIdx+2}`}</strong></div><p>{decided?'The final whistle confirms the result.':'Pick a fresh three-phase plan.'}</p><button on:click={continueAfterRound}>{decided?(wins>=2?'LEAVE THE GROUND':'FACE THE PRESS'):'TEAM TALK'} <b>→</b></button></footer>
</div>

<style>
  .round-shell{--accent:var(--bad-strong);min-height:100vh;height:100vh;padding-bottom:80px;color:var(--fg);background:radial-gradient(circle at 50% 20%,var(--bad-tint),transparent 40%),linear-gradient(var(--ink-700),var(--ink-900))}.round-shell.won{--accent:var(--ok-strong);background:radial-gradient(circle at 50% 20%,var(--pitch-glow),transparent 40%),linear-gradient(var(--ink-800),var(--ink-900))}header{height:82px;display:flex;justify-content:space-between;align-items:center;padding:0 36px;background:var(--ink-900);border-bottom:1px solid var(--ink-400);font-family:var(--font-display);font-size:.29rem;color:var(--fg-muted)}header strong{font-size:.6rem;color:var(--fg)}main{height:calc(100vh - 162px);width:min(1040px,calc(100% - 40px));margin:auto;display:grid;grid-template-columns:370px 1fr;gap:35px;align-items:center}.result-mark{text-align:center}.result-mark>span{width:86px;height:86px;margin:auto;display:grid;place-items:center;border:3px solid var(--accent);border-radius:50%;font:3rem Georgia;color:var(--accent);animation:stamp .5s cubic-bezier(.2,1.6,.4,1) both}.result-mark small{display:block;font-family:var(--font-display);font-size:.34rem;color:var(--fg-dim);margin-top:22px}.result-mark h1{font-family:Georgia,serif;font-style:italic;font-size:5rem;line-height:1}.result-mark b{font-family:var(--font-display);font-size:.31rem;color:var(--fg-dim)}.score-sheet{color:var(--on-paper);background:var(--paper-100);border-top:6px solid var(--accent);box-shadow:10px 12px 0 rgba(0,0,0,.22);padding:25px}.kicker{font-family:var(--font-display);font-size:.28rem;color:var(--print-red)}.score-sheet h2{font-family:var(--font-display);font-size:.55rem;margin:9px 0 20px;padding-bottom:12px;border-bottom:2px solid var(--ink-400)}.rounds{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}.rounds div{padding:12px 8px;text-align:center;background:rgba(255,255,255,.22);border-bottom:4px solid var(--fg-dim)}.rounds div.win{border-color:var(--ok-strong)}.rounds div.loss{border-color:var(--bad-strong)}.rounds span,.rounds small{display:block;font-family:var(--font-display);font-size:.24rem;color:var(--on-paper-muted)}.rounds strong{display:block;font-family:Georgia,serif;font-style:italic;font-size:1.35rem;margin:6px}.series{display:flex;justify-content:center;align-items:center;gap:24px;margin:28px 0;text-align:center}.series small{display:block;font-family:var(--font-display);font-size:.25rem;color:var(--on-paper-muted)}.series strong{font-family:Georgia,serif;font-style:italic;font-size:2.3rem}.series i{font-size:1.4rem}.score-sheet p{text-align:center;color:var(--on-paper-dim);font-style:italic}footer{position:fixed;left:0;right:0;bottom:0;height:80px;display:grid;grid-template-columns:270px 1fr 280px;align-items:center;background:var(--ink-900);border-top:1px solid var(--ink-400)}footer>div{height:100%;display:flex;flex-direction:column;justify-content:center;padding-left:30px;border-right:1px solid var(--ink-500)}footer small{font-family:var(--font-display);font-size:.25rem;color:var(--fg-muted)}footer strong{font-family:var(--font-display);font-size:.42rem;margin-top:6px}footer p{text-align:center;color:var(--fg-muted);font-style:italic}footer button{height:100%;border-radius:0;clip-path:polygon(12% 0,100% 0,100% 100%,0 100%);background:var(--accent);color:var(--fg);font-size:.44rem}@media(max-width:750px){main{height:auto;display:flex;flex-direction:column;padding:40px 0}.round-shell{height:auto;min-height:100vh}footer{grid-template-columns:1fr 1fr 200px}footer>div{grid-column:1}footer p{display:none}footer button{grid-column:3}}
@keyframes stamp{0%{transform:scale(2.4) rotate(-20deg);opacity:0}55%{transform:scale(.9) rotate(4deg);opacity:1}75%{transform:scale(1.06) rotate(-1deg)}100%{transform:scale(1) rotate(0)}}@media(max-height:700px){header{height:66px}main{height:calc(100vh - 146px);gap:22px}.result-mark h1{font-size:4rem}.result-mark small{margin-top:14px}.score-sheet{padding:16px}.series{margin:16px 0}.score-sheet h2{margin-bottom:12px;padding-bottom:8px}}</style>
