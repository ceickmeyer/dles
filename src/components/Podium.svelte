<script lang="ts">
	import type { MedalTally } from '$lib/scoring';

	let { tally, animate = false }: { tally: MedalTally[]; animate?: boolean } = $props();
	const top3 = $derived(tally.slice(0, 3));

	const heights = ['8rem', '6rem', '4rem'];
	const delays = ['0.1s', '0s', '0.2s']; // 2nd place first, then 1st, then 3rd
	const colors = ['var(--color-ayu-gold)', '#9ca3af', '#b45309']; // gold, silver, bronze
</script>

{#if tally.length === 0}
	<p class="text-center text-ayu-muted">No scores yet</p>
{:else}
	<div class="flex items-end justify-center gap-4">
		{#each [1, 0, 2] as pos}
			{@const player = top3[pos]}
			{#if player}
				<div class="flex flex-col items-center gap-2">
					<span class="text-3xl">{['🥇','🥈','🥉'][pos]}</span>
					<span class="max-w-25 truncate text-center text-sm font-semibold text-white">
						{player.player_name}
					</span>
					<div
						class="flex w-24 items-end justify-center rounded-t-lg text-sm font-bold overflow-hidden"
						style:background-color={colors[pos]}
						style:color="var(--color-ayu-bg)"
						style:height={heights[pos]}
						style:transform-origin="bottom"
						style:animation={animate ? `bar-rise 0.7s cubic-bezier(0.34,1.56,0.64,1) ${delays[pos]} both` : 'none'}
					>
						<div class="text-center text-xs leading-relaxed py-2">
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
