<script lang="ts">
	let { data } = $props();
	const games = $derived(data.games);
</script>

<div class="space-y-6">
	<div class="flex items-center justify-between">
		<h1 class="text-2xl font-bold text-white">Game Registry</h1>
		<a
			href="/admin/games/new"
			class="rounded-lg bg-ayu-gold px-4 py-2 font-bold text-ayu-bg transition hover:brightness-110"
		>
			+ Add Game
		</a>
	</div>

	{#if games.length === 0}
		<p class="text-ayu-muted">No games registered yet.</p>
	{:else}
		<div class="space-y-2">
			{#each games as game}
				<a
					href="/admin/games/{game.id}"
					class="flex items-center justify-between rounded-xl border border-ayu-border bg-ayu-surface px-5 py-4 transition hover:border-zinc-600"
				>
					<div class="flex items-center gap-3">
						<span class="text-2xl">{game.icon_emoji ?? '🎮'}</span>
						<div>
							<p class="font-semibold text-white">{game.name}</p>
							<p class="text-xs text-ayu-muted">
								{game.scoring_direction === 'lower_is_better' ? 'Lower is better' : 'Higher is better'}
								{game.max_score ? ` · max ${game.max_score.toLocaleString()}` : ''}
								{game.share_parser ? ` · parser: ${game.share_parser}` : ' · manual'}
							</p>
						</div>
					</div>
					<svg class="h-4 w-4 text-ayu-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
					</svg>
				</a>
			{/each}
		</div>
	{/if}
</div>
