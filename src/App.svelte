<script>
  import { screen } from './lib/store.js';
  import { isMuted, toggleMute, sfx } from './lib/sfx.js';
  import TitleScreen    from './lib/screens/TitleScreen.svelte';
  import SquadBuilder   from './lib/screens/SquadBuilder.svelte';
  import PhaseSelection from './lib/screens/PhaseSelection.svelte';
  import MatchScreen     from './lib/screens/MatchScreen.svelte';
  import PhaseResult     from './lib/screens/PhaseResult.svelte';
  import RoundResult     from './lib/screens/RoundResult.svelte';
  import ShopScreen      from './lib/screens/ShopScreen.svelte';
  import CampaignEnd     from './lib/screens/CampaignEnd.svelte';

  let muted = isMuted();
  function toggle() { muted = toggleMute(); if (!muted) sfx.pick(); }

  // Reset document scroll when the route changes — otherwise a scroll position
  // from the previous screen (e.g. the phase hand) carries into the next one.
  screen.subscribe(() => {
    if (typeof window !== 'undefined') window.scrollTo(0, 0);
  });
</script>

{#key $screen}
  <div class="route-view">
    {#if $screen === 'title'}
      <TitleScreen />
    {:else if $screen === 'squad'}
      <SquadBuilder />
    {:else if $screen === 'phases'}
      <PhaseSelection />
    {:else if $screen === 'match'}
      <MatchScreen />
    {:else if $screen === 'phase-result'}
      <PhaseResult />
    {:else if $screen === 'round-result'}
      <RoundResult />
    {:else if $screen === 'shop'}
      <ShopScreen />
    {:else if $screen === 'campaign-complete'}
      <CampaignEnd won={true} />
    {:else if $screen === 'campaign-lost'}
      <CampaignEnd won={false} />
    {:else}
      <!-- Placeholder for future screens -->
      <div class="screen" style="justify-content:center;align-items:center;gap:16px;">
        <p style="font-family:var(--font-display);font-size:0.7rem;color:var(--fg-muted);">
          Screen: {$screen}
        </p>
        <button class="btn-secondary" on:click={() => screen.set('title')}>← Back to Title</button>
      </div>
    {/if}
  </div>
{/key}

<button class="sound-toggle" class:muted on:click={toggle} aria-label={muted ? 'Unmute sound' : 'Mute sound'} title={muted ? 'Sound off' : 'Sound on'}>
  {muted ? '🔇' : '🔊'}
</button>

<style>
  .route-view { min-height: 100vh; animation: route-in 0.24s ease-out; }
  @keyframes route-in {
    from { opacity: 0; transform: translateY(10px); }
    to   { opacity: 1; transform: none; }
  }
  .sound-toggle {
    position: fixed; right: 14px; bottom: 92px; z-index: 999;
    width: 42px; height: 42px; padding: 0;
    display: grid; place-items: center;
    background: var(--scrim-dark); border: 1px solid var(--ink-400);
    font-size: 1.05rem; border-radius: 50%;
    box-shadow: 0 4px 14px rgba(0, 0, 0, 0.35);
  }
  .sound-toggle:hover { border-color: var(--fg-muted); }
  .sound-toggle.muted { opacity: 0.55; }
  /* Hide the toggle while the lineup sheet is open so it doesn't float over it. */
  .route-view:has(:global(.swap-sheet)) + .sound-toggle { display: none; }
  /* On campaign end screens there is no fixed footer — tuck into the top corner. */
  .route-view:has(:global(.end-shell)) + .sound-toggle { bottom: auto; top: 14px; right: 14px; }
  @media (max-width: 760px) {
    /* Dock the toggle into the fixed footer's empty centre column (footer
       messages are hidden at mobile widths on every game screen). */
    .sound-toggle { left: calc(75% - 142.5px); right: auto; transform: translateX(-50%); bottom: 14px; width: 36px; height: 36px; font-size: 0.95rem; }
    .sound-toggle.muted { opacity: 0.75; }
    .route-view:has(:global(.end-shell)) + .sound-toggle { left: auto; right: 12px; transform: none; top: 12px; bottom: auto; }
  }
  @media (prefers-reduced-motion: reduce) { .route-view { animation: none; } }
</style>
