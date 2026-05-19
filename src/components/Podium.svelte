<script lang="ts">
	import type { MedalTally } from '$lib/scoring';

	let { tally, animate = false }: { tally: MedalTally[]; animate?: boolean } = $props();

	const top3 = $derived(tally.slice(0, 3));

	const BASE_HEIGHTS = ['10rem', '8rem', '4.5rem'];
	const BASE_COLORS = ['var(--color-ayu-gold)', '#9ca3af', '#b45309'];
	const delays = ['0.1s', '0s', '0.2s'];
	const medalEmojis = ['🥇', '🥈', '🥉'];

	function isTied(a: MedalTally, b: MedalTally) {
		return a.gold === b.gold && a.silver === b.silver && a.bronze === b.bronze;
	}

	// Compute ranks/heights/colors based on ties; use IIFE so $derived holds the array, not a function
	const ranks = $derived((() => {
		const r = [1, 2, 3];
		if (top3[0] && top3[1] && isTied(top3[0], top3[1])) r[1] = 1;
		if (top3[1] && top3[2] && isTied(top3[1], top3[2])) r[2] = r[1];
		return r;
	})());

	const heights = $derived((() => {
		const h = [...BASE_HEIGHTS];
		if (top3[0] && top3[1] && isTied(top3[0], top3[1])) h[1] = h[0];
		if (top3[1] && top3[2] && isTied(top3[1], top3[2])) h[2] = h[1];
		return h;
	})());

	const colors = $derived((() => {
		const c = [...BASE_COLORS];
		if (top3[0] && top3[1] && isTied(top3[0], top3[1])) c[1] = c[0];
		if (top3[1] && top3[2] && isTied(top3[1], top3[2])) c[2] = c[1];
		return c;
	})());
</script>

{#if tally.length === 0}
	<p class="text-center text-ayu-muted">No scores yet</p>
{:else}
	<div class="flex items-end justify-center gap-4">
		{#each [1, 0, 2] as pos}
			{@const player = top3[pos]}
			{#if player}
				<div class="flex flex-col items-center gap-2">
					<span class="text-3xl">{medalEmojis[ranks[pos] - 1]}</span>
					<span class="max-w-32 text-center text-sm font-semibold text-white leading-tight">
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
