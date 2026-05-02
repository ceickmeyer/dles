<script lang="ts">
	import type { Game } from '$lib/database.types';

	let {
		game,
		sessionId,
		submitted = false,
		myScore = null
	}: {
		game: Game;
		sessionId: string;
		submitted?: boolean;
		myScore?: number | null;
	} = $props();
</script>

<div
	class="rounded-xl border p-4 transition-all {submitted
		? 'border-green-700 bg-green-900/20'
		: 'border-zinc-700 bg-zinc-900'}"
>
	<div class="flex items-center justify-between">
		<div class="flex items-center gap-3">
			<span class="text-3xl">{game.icon_emoji ?? '🎮'}</span>
			<div>
				<h3 class="font-bold text-white">{game.name}</h3>
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
		</div>
		<div class="text-right">
			{#if submitted && myScore !== null}
				<span class="text-sm font-semibold text-green-400">✓ {myScore}</span>
			{:else}
				<a
					href="/play/{sessionId}/{game.id}"
					class="rounded-lg bg-amber-400 px-3 py-1.5 text-sm font-bold text-black transition hover:bg-amber-300"
				>
					Submit
				</a>
			{/if}
		</div>
	</div>
</div>
