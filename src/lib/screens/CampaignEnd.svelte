<script>
  import { game, startNewGame, navigate } from '../store.js';
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
  :global(body){overflow:hidden}.end-shell{--accent:#a54842;min-height:100vh;color:#eee5d3;background:radial-gradient(circle at 50% 22%,rgba(156,63,57,.3),transparent 37%),linear-gradient(#151b17,#070b08);display:grid;place-items:center;position:relative}.end-shell.won{--accent:#d39148;background:radial-gradient(circle at 50% 18%,rgba(196,146,67,.28),transparent 39%),linear-gradient(#17251b,#070b08)}.lights{position:absolute;inset:0;background:repeating-linear-gradient(90deg,transparent 0 90px,rgba(255,255,255,.012) 90px 91px);pointer-events:none}main{text-align:center;position:relative}.crest{width:86px;height:98px;margin:auto;display:grid;place-items:center;clip-path:polygon(8% 0,92% 0,100% 70%,50% 100%,0 70%);background:var(--accent);color:#151a15;font-family:var(--font-display);font-size:1.3rem;box-shadow:0 15px 35px rgba(0,0,0,.3)}main>small{display:block;font-family:var(--font-display);font-size:.35rem;letter-spacing:.2em;color:#8d9a91;margin-top:28px}h1{font-family:Georgia,serif;font-style:italic;font-size:6rem;line-height:1;color:#efe3ca;text-shadow:0 7px 0 rgba(0,0,0,.2)}p{width:min(540px,80vw);margin:20px auto;color:#9aa69e;font-size:1.15rem;font-style:italic}.record{display:flex;justify-content:center;align-items:center;gap:30px;margin:32px}.record small{display:block;font-family:var(--font-display);font-size:.27rem;color:#7f8c84}.record strong{font-family:Georgia,serif;font-style:italic;font-size:2.5rem}.record i{font-size:2rem}.actions{display:flex;justify-content:center;gap:10px}.actions button{border-radius:1px;border:1px solid #566259;background:#17221b;color:#ddd6c6;font-size:.4rem;min-width:180px}.actions .primary{background:var(--accent);border-color:var(--accent);color:#181b16}footer{position:absolute;left:0;right:0;bottom:0;height:55px;display:grid;place-items:center;border-top:1px solid #303b34;font-family:var(--font-display);font-size:.26rem;color:#68756d}
</style>
