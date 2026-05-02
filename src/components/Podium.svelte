<script lang="ts">
	import type { MedalTally } from '$lib/scoring';

	let { tally }: { tally: MedalTally[] } = $props();

	const top3 = $derived(tally.slice(0, 3));
	// Reorder for visual podium: 2nd | 1st | 3rd
	const podiumOrder = $derived([top3[1], top3[0], top3[2]].filter(Boolean));
	const heights = ['h-24', 'h-32', 'h-16'];
	const podiumPositions = [1, 0, 2]; // index into top3 for each podium slot
</script>

{#if tally.length === 0}
	<p class="text-center text-zinc-500">No scores yet</p>
{:else}
	<div class="flex items-end justify-center gap-3">
		{#each [1, 0, 2] as pos, i}
			{@const player = top3[pos]}
			{#if player}
				<div class="flex flex-col items-center gap-2">
					<span class="text-2xl">{['🥇', '🥈', '🥉'][pos]}</span>
					<span class="max-w-[100px] truncate text-center text-sm font-semibold text-white">
						{player.player_name}
					</span>
					<div
						class="flex w-24 items-center justify-center rounded-t-lg font-bold text-black"
						class:h-32={pos === 0}
						class:h-24={pos === 1}
						class:h-16={pos === 2}
						class:bg-amber-400={pos === 0}
						class:bg-zinc-400={pos === 1}
						class:bg-amber-700={pos === 2}
					>
						<div class="text-center text-xs">
							<div>{player.gold}🥇</div>
							<div>{player.silver}🥈</div>
							<div>{player.bronze}🥉</div>
						</div>
					</div>
				</div>
			{/if}
		{/each}
	</div>
{/if}
