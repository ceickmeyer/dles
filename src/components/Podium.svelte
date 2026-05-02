<script lang="ts">
	import type { MedalTally } from '$lib/scoring';
	let { tally }: { tally: MedalTally[] } = $props();
	const top3 = $derived(tally.slice(0, 3));
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
						class="flex w-24 items-center justify-center rounded-t-lg text-sm font-bold"
						style:background-color={pos === 0 ? 'var(--color-ayu-gold)' : pos === 1 ? 'var(--color-ayu-silver)' : 'var(--color-ayu-bronze)'}
						style:color={pos === 0 ? 'var(--color-ayu-bg)' : 'var(--color-ayu-bg)'}
						style:height={pos === 0 ? '8rem' : pos === 1 ? '6rem' : '4rem'}
					>
						<div class="text-center text-xs leading-relaxed">
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
