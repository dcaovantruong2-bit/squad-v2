<script>
  import { startNewGame, quickStart, game } from '../store.js';
  import { CAMPAIGN_MATCHES } from '../engine/data.js';

  $: bestRun = $game.bestRun;

  const taglines = [
    'Build the squad. Pick the phases. Win the match.',
    'Tactics are everything.',
    'Formation shapes destiny.',
    'One more phase. One more win.',
  ];
  const tagline = taglines[Math.floor(Math.random() * taglines.length)];
</script>

<div class="screen title-screen">
  <!-- Logo -->
  <div class="logo-section">
    <div class="logo-tag">SQUAD</div>
    <p class="subtitle">FOOTBALL CARD ROGUELIKE</p>
    <p class="tagline">{tagline}</p>
  </div>

  <!-- Pitch graphic -->
  <div class="pitch-preview" aria-hidden="true">
    <div class="pitch-line centre-circle"></div>
    <div class="pitch-line centre-line"></div>
    <div class="pitch-line penalty-box top"></div>
    <div class="pitch-line penalty-box bottom"></div>
  </div>

  <!-- Buttons -->
  <div class="actions">
    <button class="btn-primary cta" on:click={startNewGame}>
      ▶ NEW CAMPAIGN
    </button>
    <button class="btn-secondary" on:click={quickStart}>
      ⚡ QUICK START
    </button>
  </div>

  <!-- Best run -->
  {#if bestRun}
    <div class="best-run">
      <span class="label">BEST RUN</span>
      <span class="val">{bestRun.wins} wins · {bestRun.score.toLocaleString()} pts</span>
    </div>
  {/if}

  <!-- Campaign preview -->
  <div class="campaign-preview">
    <p class="preview-title">THE ROAD TO GLORY</p>
    <div class="matches">
      {#each CAMPAIGN_MATCHES as match, i}
        <div class="match-row">
          <span class="match-num">{i + 1}</span>
          <span class="match-name">{match.name}</span>
          <span class="match-opp">{match.opponent}</span>
        </div>
      {/each}
    </div>
  </div>

  <!-- Footer -->
  <p class="footer-note">Draft your squad · Pick your formation · Chain your phases</p>
</div>

<style>
  .title-screen {
    background: var(--ink-900);
    align-items: center;
    gap: 0;
    overflow: hidden;
    position: relative;
  }

  .logo-section {
    text-align: center;
    padding-top: 40px;
    z-index: 2;
  }
  .logo-tag {
    font-family: var(--font-display);
    font-size: 3rem;
    color: var(--accent);
    text-shadow: 0 0 30px var(--accent-glow), 0 0 60px var(--pitch-line);
    letter-spacing: 0.15em;
    line-height: 1;
    margin-bottom: 10px;
  }
  .subtitle {
    font-family: var(--font-display);
    font-size: 0.55rem;
    color: var(--warn-soft);
    letter-spacing: 0.2em;
    margin-bottom: 12px;
  }
  .tagline {
    font-size: 1.1rem;
    color: var(--fg-muted);
    font-style: italic;
  }

  .pitch-preview {
    position: relative;
    width: 100%;
    max-width: 360px;
    height: 160px;
    margin: 20px 0;
    background: var(--pitch-deep);
    border-radius: var(--r-lg);
    border: 1px solid var(--pitch-line);
    overflow: hidden;
    flex-shrink: 0;
  }
  .pitch-line { position: absolute; background: transparent; border: 1px solid var(--pitch-line); }
  .centre-circle {
    width: 80px; height: 80px;
    border-radius: 50%;
    top: 50%; left: 50%;
    transform: translate(-50%, -50%);
  }
  .centre-line {
    width: 100%; height: 0;
    top: 50%; left: 0;
    border-top: 1px solid var(--pitch-line);
    border-radius: 0;
  }
  .penalty-box {
    width: 140px; height: 60px;
    left: 50%; transform: translateX(-50%);
  }
  .penalty-box.top { top: 0; border-top: none; border-radius: 0 0 8px 8px; }
  .penalty-box.bottom { bottom: 0; border-bottom: none; border-radius: 8px 8px 0 0; }

  .actions {
    display: flex; flex-direction: column; gap: 10px;
    width: 100%; max-width: 300px;
    z-index: 2;
    margin-bottom: 20px;
  }
  .cta { padding: 14px 24px; font-size: 0.7rem; }
  button { width: 100%; }

  .best-run {
    display: flex; gap: 12px; align-items: center;
    background: var(--ink-700);
    border: 1px solid var(--ink-400);
    border-radius: var(--r-sm);
    padding: 8px 16px;
    margin-bottom: 20px;
    width: 100%; max-width: 300px;
  }
  .best-run .label {
    font-family: var(--font-display);
    font-size: 0.48rem;
    color: var(--warn-soft);
  }
  .best-run .val { font-size: 1rem; color: var(--fg-dim); }

  .campaign-preview {
    width: 100%; max-width: 360px;
    background: var(--ink-700);
    border: 1px solid var(--ink-400);
    border-radius: var(--r-md);
    padding: 12px 16px;
    margin-bottom: 20px;
  }
  .preview-title {
    font-family: var(--font-display);
    font-size: 0.5rem;
    color: var(--fg-muted);
    letter-spacing: 0.15em;
    line-height: 1.9;
    padding-top: 4px;
    margin-bottom: 10px;
  }
  .matches { display: flex; flex-direction: column; gap: 6px; }
  .match-row {
    display: flex; gap: 10px; align-items: center;
    font-size: 0.95rem;
  }
  .match-num {
    font-family: var(--font-display);
    font-size: 0.48rem;
    color: var(--accent);
    width: 14px;
    flex-shrink: 0;
  }
  .match-name { color: var(--fg); flex: 1; }
  .match-opp { color: var(--fg-muted); font-size: 0.85rem; }

  .footer-note {
    font-size: 0.85rem;
    color: var(--ink-300);
    text-align: center;
    padding-bottom: 20px;
    margin-top: auto;
  }
</style>
