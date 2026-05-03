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
					{copied ? '✓ Copied!' : '📋 Share results'}
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
