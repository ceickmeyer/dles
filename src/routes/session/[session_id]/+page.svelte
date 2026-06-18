<script lang="ts">
	import Podium from '$components/Podium.svelte';
	import MedalTally from '$components/MedalTally.svelte';
	import { MEDAL_EMOJI } from '$lib/scoring';
	import { formatScore } from '$lib/utils';

	let { data } = $props();
	const session = $derived(data.session);
	const gameResults = $derived(data.gameResults);
	const tally = $derived(data.tally);

	let copied = $state(false);

	async function copyShareText() {
		await navigator.clipboard.writeText(data.shareText);
		copied = true;
		setTimeout(() => { copied = false; }, 2000);
	}
</script>

<div class="space-y-8">
	<div>
		<a href="/" class="mb-4 inline-flex items-center gap-1 text-sm text-ayu-muted hover:text-white">
			← Lobby
		</a>
		<div class="flex items-start justify-between gap-4">
			<div>
				<h1 class="text-2xl font-bold text-white">{session.name}</h1>
				<p class="mt-0.5 text-sm text-ayu-muted">
					{new Date(session.date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
				</p>
			</div>
			<div class="flex items-center gap-3 shrink-0">
				<button
					onclick={copyShareText}
					class="rounded-lg border border-ayu-border px-3 py-1.5 text-xs font-medium text-zinc-300 transition hover:text-white"
				>
					{#if copied}
						✓ Copied!
					{:else}
						<span class="flex items-center gap-1.5">
							<svg width="13" height="13" viewBox="0 0 24 24" fill="none">
								<path fill-rule="evenodd" clip-rule="evenodd" d="M19.6495 0.799565C18.4834 -0.72981 16.0093 0.081426 16.0093 1.99313V3.91272C12.2371 3.86807 9.65665 5.16473 7.9378 6.97554C6.10034 8.9113 5.34458 11.3314 5.02788 12.9862C4.86954 13.8135 5.41223 14.4138 5.98257 14.6211C6.52743 14.8191 7.25549 14.7343 7.74136 14.1789C9.12036 12.6027 11.7995 10.4028 16.0093 10.5464V13.0069C16.0093 14.9186 18.4834 15.7298 19.6495 14.2004L23.3933 9.29034C24.2022 8.2294 24.2022 6.7706 23.3933 5.70966L19.6495 0.799565Z" fill="currentColor"/>
								<path d="M7 1.00391H4C2.34315 1.00391 1 2.34705 1 4.00391V20.0039C1 21.6608 2.34315 23.0039 4 23.0039H20C21.6569 23.0039 23 21.6608 23 20.0039V17.0039C23 16.4516 22.5523 16.0039 22 16.0039C21.4477 16.0039 21 16.4516 21 17.0039V20.0039C21 20.5562 20.5523 21.0039 20 21.0039H4C3.44772 21.0039 3 20.5562 3 20.0039V4.00391C3 3.45162 3.44772 3.00391 4 3.00391H7C7.55228 3.00391 8 2.55619 8 2.00391C8 1.45162 7.55228 1.00391 7 1.00391Z" fill="currentColor"/>
							</svg>
							Share results
						</span>
					{/if}
				</button>
				<span class="rounded-full px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wider
					{session.status === 'active' ? 'bg-ayu-green text-ayu-bg' :
					 session.status === 'finished' ? 'bg-ayu-surface2 text-ayu-muted' :
					 'bg-amber-700 text-white'}">
					{session.status}
				</span>
			</div>
		</div>
	</div>

	{#if tally.length === 0}
		<div class="py-16 text-center">
			<p class="text-4xl mb-3">🎮</p>
			<p class="text-ayu-muted">No scores submitted yet.</p>
		</div>
	{:else}
		{#if tally.length >= 2}
			<div class="rounded-xl border border-ayu-border bg-ayu-surface p-6">
				<h2 class="mb-4 text-xs font-semibold uppercase tracking-wider text-ayu-muted">Final Standings</h2>
				<Podium {tally} />
			</div>
		{/if}

		<div class="rounded-xl border border-ayu-border bg-ayu-surface p-4">
			<h2 class="mb-3 text-xs font-semibold uppercase tracking-wider text-ayu-muted">Medal Tally</h2>
			<MedalTally {tally} />
		</div>
	{/if}

	<!-- Per-game breakdowns -->
	<div class="space-y-3">
		<h2 class="text-xs font-semibold uppercase tracking-wider text-ayu-muted">Game Breakdowns</h2>
		{#each gameResults as { game, scores }}
			<div class="rounded-xl border border-ayu-border bg-ayu-surface p-4">
				<div class="flex items-center gap-2 mb-3">
					<span class="text-xl">{game.icon_emoji ?? '🎮'}</span>
					<h3 class="font-semibold text-white">{game.name}</h3>
					<span class="text-xs text-ayu-muted">
						{game.scoring_direction === 'lower_is_better' ? 'lower is better' : 'higher is better'}
					</span>
				</div>
				{#if scores.length === 0}
					<p class="text-sm text-ayu-muted">No scores submitted</p>
				{:else}
					<div class="space-y-1">
						{#each scores as ranked}
							<div class="flex items-center justify-between rounded-lg bg-ayu-surface2 px-3 py-2 text-sm">
								<span class="text-zinc-300">
									{ranked.medal ? MEDAL_EMOJI[ranked.medal] : `#${ranked.rank}`}
									{ranked.player_name}
								</span>
								<span class="font-mono font-semibold text-ayu-gold">{formatScore(ranked.raw_score, game)}</span>
							</div>
						{/each}
					</div>
				{/if}
			</div>
		{/each}
	</div>
</div>
