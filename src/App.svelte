<script>
  import { screen } from './lib/store.js';
  import TitleScreen    from './lib/screens/TitleScreen.svelte';
  import SquadBuilder   from './lib/screens/SquadBuilder.svelte';
  import PhaseSelection from './lib/screens/PhaseSelection.svelte';
  import MatchScreen     from './lib/screens/MatchScreen.svelte';
  import PhaseResult     from './lib/screens/PhaseResult.svelte';
  import RoundResult     from './lib/screens/RoundResult.svelte';
  import ShopScreen      from './lib/screens/ShopScreen.svelte';
  import CampaignEnd     from './lib/screens/CampaignEnd.svelte';
</script>

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
    <p style="font-family:var(--font-display);font-size:0.7rem;color:var(--muted);">
      Screen: {$screen}
    </p>
    <button class="btn-secondary" on:click={() => screen.set('title')}>← Back to Title</button>
  </div>
{/if}
