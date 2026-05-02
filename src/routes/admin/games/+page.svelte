<script lang="ts">
	let { data } = $props();
	const games = $derived(data.games);
</script>

<div class="space-y-6">
	<div class="flex items-center justify-between">
		<h1 class="text-2xl font-bold text-white">Game Registry</h1>
		<a
			href="/admin/games/new"
			class="rounded-lg bg-amber-400 px-4 py-2 font-bold text-black transition hover:bg-amber-300"
		>
			+ Add Game
		</a>
	</div>

	{#if games.length === 0}
		<p class="text-zinc-400">No games registered yet.</p>
	{:else}
		<div class="space-y-2">
			{#each games as game}
				<div class="flex items-center justify-between rounded-xl border border-zinc-800 bg-zinc-900 px-5 py-4">
					<div class="flex items-center gap-3">
						<span class="text-2xl">{game.icon_emoji ?? '🎮'}</span>
						<div>
							<p class="font-semibold text-white">{game.name}</p>
							<p class="text-xs text-zinc-500">
								{game.scoring_direction === 'lower_is_better' ? 'Lower is better' : 'Higher is better'}
								{game.max_score ? ` · max ${game.max_score.toLocaleString()}` : ''}
								{game.share_parser ? ` · parser: ${game.share_parser}` : ' · manual'}
							</p>
						</div>
					</div>
					{#if game.url}
						<a
							href={game.url}
							target="_blank"
							rel="noopener noreferrer"
							class="text-xs text-zinc-400 underline hover:text-amber-400"
						>
							Play →
						</a>
					{/if}
				</div>
			{/each}
		</div>
	{/if}
</div>
