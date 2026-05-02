<script lang="ts">
	import Podium from '$components/Podium.svelte';
	import MedalTally from '$components/MedalTally.svelte';
	import { MEDAL_EMOJI } from '$lib/scoring';

	let { data } = $props();
	const session = $derived(data.session);
	const gameResults = $derived(data.gameResults);
	const tally = $derived(data.tally);
</script>

<div class="space-y-8">
	<div>
		<a href="/" class="mb-4 inline-flex items-center gap-1 text-sm text-zinc-400 hover:text-white">
			← Lobby
		</a>
		<div class="flex items-center justify-between">
			<h1 class="text-2xl font-bold text-white">{session.name}</h1>
			<span
				class="rounded-full px-2.5 py-0.5 text-xs font-medium"
				class:bg-green-900={session.status === 'active'}
				class:text-green-400={session.status === 'active'}
				class:bg-zinc-800={session.status !== 'active'}
				class:text-zinc-400={session.status !== 'active'}
			>
				{session.status}
			</span>
		</div>
		<p class="text-sm text-zinc-500 mt-1">
			{new Date(session.date).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
		</p>
	</div>

	{#if tally.length >= 2}
		<div class="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
			<h2 class="mb-4 text-sm font-semibold uppercase tracking-wider text-zinc-500">Final Standings</h2>
			<Podium {tally} />
		</div>
	{/if}

	<div>
		<h2 class="mb-3 text-sm font-semibold uppercase tracking-wider text-zinc-500">Medal Tally</h2>
		<div class="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
			<MedalTally {tally} />
		</div>
	</div>

	<!-- Per-game breakdowns -->
	<div class="space-y-4">
		<h2 class="text-sm font-semibold uppercase tracking-wider text-zinc-500">Game Breakdowns</h2>
		{#each gameResults as { game, scores }}
			<div class="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
				<div class="flex items-center gap-2 mb-3">
					<span class="text-xl">{game.icon_emoji ?? '🎮'}</span>
					<h3 class="font-semibold text-white">{game.name}</h3>
					<span class="text-xs text-zinc-500">
						{game.scoring_direction === 'lower_is_better' ? 'lower is better' : 'higher is better'}
					</span>
				</div>
				{#if scores.length === 0}
					<p class="text-sm text-zinc-500">No scores submitted</p>
				{:else}
					<div class="space-y-1">
						{#each scores as ranked}
							<div class="flex items-center justify-between rounded-lg bg-zinc-800 px-3 py-2 text-sm">
								<span class="text-zinc-300">
									{ranked.medal ? MEDAL_EMOJI[ranked.medal] : `#${ranked.rank}`}
									{ranked.player_name}
								</span>
								<span class="font-mono font-semibold text-white">{ranked.raw_score}</span>
							</div>
						{/each}
					</div>
				{/if}
			</div>
		{/each}
	</div>
</div>
