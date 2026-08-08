<script>
  import { onMount, onDestroy } from 'svelte';
  import { game, startNewGame, navigate } from '../store.js';
  // Lock page scroll only while THIS screen is mounted. A :global(body) rule
  // would stay applied after Svelte swaps the screen out, killing scrolling
  // on every later route.
  onMount(() => document.body.classList.add('no-scroll'));
  onDestroy(() => document.body.classList.remove('no-scroll'));

  export let won = false;
  $: wins=won ? Math.max(5,($game.matchResults||[]).filter(m=>m.won).length) : ($game.matchResults||[]).filter(m=>m.won).length;
  $: total=won ? Math.max(5,($game.matchResults||[]).length) : ($game.matchResults||[]).length;
</script>
<div class="end-shell" class:won>
  <div class="lights"></div>
  <main>
    <span class="crest">S</span><small>{won?'CAMPAIGN COMPLETE':'CAMPAIGN OVER'}</small><h1>{won?'CHAMPIONS':'FULL TIME'}</h1><p>{won?'Five opponents beaten. The trophy belongs to your squad.':'The run ends here. Rebuild, rethink, and return stronger.'}</p>
    <div class="record"><div><small>MATCHES WON</small><strong>{wins}</strong></div><i>—</i><div><small>MATCHES PLAYED</small><strong>{Math.max(total,wins)}</strong></div></div>
    <div class="actions"><button class="primary" on:click={startNewGame}>NEW CAMPAIGN</button><button on:click={()=>navigate('title')}>RETURN TO TITLE</button></div>
  </main>
  <footer>BUILD THE SQUAD · CALL THE PHASES · WIN THE MATCH</footer>
</div>
<style>
  .end-shell{--accent:var(--print-red);min-height:100vh;color:var(--fg);background:radial-gradient(circle at 50% 22%,var(--bad-tint),transparent 37%),linear-gradient(var(--on-accent),var(--ink-900));display:grid;place-items:center;position:relative}.end-shell.won{--accent:var(--accent-soft);background:radial-gradient(circle at 50% 18%,var(--accent-tint),transparent 39%),linear-gradient(var(--ink-600),var(--ink-900))}.lights{position:absolute;inset:0;background:repeating-linear-gradient(90deg,transparent 0 90px,rgba(255,255,255,.012) 90px 91px);pointer-events:none}main{text-align:center;position:relative;padding:30px 16px;width:100%;max-width:760px}.crest{width:86px;height:98px;margin:auto;display:grid;place-items:center;clip-path:polygon(8% 0,92% 0,100% 70%,50% 100%,0 70%);background:var(--accent);color:var(--on-accent);font-family:var(--font-display);font-size:1.3rem;box-shadow:0 15px 35px rgba(0,0,0,.3)}main>small{display:block;font-family:var(--font-display);font-size:.35rem;letter-spacing:.2em;color:var(--fg-dim);margin-top:28px}h1{font-family:Georgia,serif;font-style:italic;font-size:6rem;line-height:1;color:var(--fg);text-shadow:0 7px 0 rgba(0,0,0,.2);overflow-wrap:break-word}p{width:min(540px,80vw);margin:20px auto;color:var(--fg-dim);font-size:1.15rem;font-style:italic}.record{display:flex;justify-content:center;align-items:center;gap:30px;margin:32px}.record small{display:block;font-family:var(--font-display);font-size:.27rem;color:var(--fg-dim)}.record strong{font-family:Georgia,serif;font-style:italic;font-size:2.5rem}.record i{font-size:2rem}.actions{display:flex;justify-content:center;gap:10px}.actions button{border-radius:1px;border:1px solid var(--ink-300);background:var(--ink-700);color:var(--paper-200);font-size:.4rem;min-width:180px}.actions .primary{background:var(--accent);border-color:var(--accent);color:var(--on-accent)}footer{position:absolute;left:0;right:0;bottom:0;height:55px;display:grid;place-items:center;border-top:1px solid var(--ink-400);font-family:var(--font-display);font-size:.26rem;color:var(--fg-muted)}@media(max-width:600px){h1{font-size:2.9rem}.record{gap:18px;margin:24px 0}.record strong{font-size:1.9rem}.record i{font-size:1.3rem}.actions{flex-direction:column;align-items:stretch;gap:8px}.actions button{min-width:0;font-size:.42rem;padding:12px}main>small{margin-top:20px}}@media(max-height:620px){h1{font-size:4rem}.record{margin:18px 0}}
</style>
