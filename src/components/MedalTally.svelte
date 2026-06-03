<script lang="ts">
	import type { MedalTally, PlayerDayStat } from '$lib/scoring';
	import { MEDAL_EMOJI } from '$lib/scoring';

	let { tally, currentPlayerId = null, playerStats = new Map(), prevRankMap = new Map(), completedPlayerIds = new Set(), prevWinnerId = null }: {
		tally: MedalTally[];
		currentPlayerId?: string | null;
		playerStats?: Map<string, PlayerDayStat[]>;
		prevRankMap?: Map<string, { rank: number; outOf: number }>;
		completedPlayerIds?: Set<string>;
		prevWinnerId?: string | null;
	} = $props();

	// Tie-aware ranks: players with identical gold/silver/bronze share the same rank number
	const ranks = $derived(tally.map(row => {
		const first = tally.findIndex(r => r.gold === row.gold && r.silver === row.silver && r.bronze === row.bronze);
		return first + 1;
	}));

	let scoreTipVisible = $state(false);
	let scoreTipX = $state(0);
	let scoreTipY = $state(0);

	function showScoreTip(e: MouseEvent) {
		const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
		scoreTipX = rect.left;
		scoreTipY = rect.top - 8;
		scoreTipVisible = true;
	}

	let playerTipVisible = $state(false);
	let playerTipX = $state(0);
	let playerTipY = $state(0);
	let tipStats = $state<PlayerDayStat[]>([]);
	let tipName = $state('');
	let tipPlayerId = $state('');

	const MEDAL_ORDER: Record<string, number> = { gold: 0, silver: 1, bronze: 2 };

	function showPlayerTip(e: MouseEvent, row: MedalTally) {
		const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
		playerTipX = rect.left;
		playerTipY = rect.top - 8;
		tipStats = (playerStats.get(row.player_id) ?? [])
			.filter(s => s.medal !== null)
			.sort((a, b) => MEDAL_ORDER[a.medal!] - MEDAL_ORDER[b.medal!]);
		tipName = row.player_name;
		tipPlayerId = row.player_id;
		playerTipVisible = true;
	}
</script>

<div class="overflow-x-auto">
	<table class="w-full text-sm">
		<thead>
			<tr class="border-b border-zinc-700 text-zinc-400">
				<th class="py-2 text-left font-medium">#</th>
				<th class="py-2 w-5"></th>
				<th class="py-2 text-left font-medium">Player</th>
				<th class="py-2 text-center font-medium">🥇</th>
				<th class="py-2 text-center font-medium">🥈</th>
				<th class="py-2 text-center font-medium">🥉</th>
				<th class="py-2 text-center font-medium">
					<span class="inline-flex items-center gap-1">
						Total
						<button
							onmouseenter={showScoreTip}
							onmouseleave={() => scoreTipVisible = false}
							class="text-zinc-600 hover:text-zinc-400 transition-colors"
							aria-label="Scoring info"
						>
							<svg width="12" height="12" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
								<circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2"/>
								<path d="M12 17V11" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
								<circle cx="1" cy="1" r="1.25" transform="matrix(1 0 0 -1 11 9)" fill="currentColor"/>
							</svg>
						</button>
					</span>
				</th>
			</tr>
		</thead>
		<tbody>
			{#each tally as row, i}
				<tr
					class="border-b border-zinc-800 transition-colors
						{ranks[i] === 1 ? 'bg-yellow-400/10' : ranks[i] === 2 ? 'bg-slate-400/8' : ranks[i] === 3 ? 'bg-amber-700/10' : row.player_id === currentPlayerId ? 'bg-amber-900/20' : ''}"
				>
					<td class="py-2
						{ranks[i] === 1 ? 'text-ayu-gold font-bold' : ranks[i] === 2 ? 'text-zinc-400 font-bold' : ranks[i] === 3 ? 'text-amber-700 font-bold' : 'text-zinc-600'}">{ranks[i]}</td>
					<td class="py-2 pr-1">
						{#if prevRankMap.has(row.player_id)}
							{@const prev = prevRankMap.get(row.player_id)!}
							{@const delta = prev.rank - ranks[i]}
							{#if delta > 0}
								<svg class="w-3.5 h-3.5" style="color: var(--color-ayu-green)" fill="currentColor" viewBox="0 0 512 512">
									<path stroke="currentColor" stroke-width="40" stroke-linejoin="round" d="M505.752,358.248L271.085,123.582c-8.331-8.331-21.839-8.331-30.17,0L6.248,358.248c-8.331,8.331-8.331,21.839,0,30.17s21.839,8.331,30.17,0L256,168.837l219.582,219.582c8.331,8.331,21.839,8.331,30.17,0S514.083,366.58,505.752,358.248z"/>
								</svg>
							{:else if delta < 0}
								<svg class="w-3.5 h-3.5 rotate-180" style="color: var(--color-ayu-red)" fill="currentColor" viewBox="0 0 512 512">
									<path stroke="currentColor" stroke-width="40" stroke-linejoin="round" d="M505.752,358.248L271.085,123.582c-8.331-8.331-21.839-8.331-30.17,0L6.248,358.248c-8.331,8.331-8.331,21.839,0,30.17s21.839,8.331,30.17,0L256,168.837l219.582,219.582c8.331,8.331,21.839,8.331,30.17,0S514.083,366.58,505.752,358.248z"/>
								</svg>
							{:else}
								<svg class="w-3.5 h-3.5" style="color: var(--color-ayu-muted)" fill="currentColor" viewBox="0 0 52 52">
									<path d="M50,27.5c0,0.8-0.7,1.5-1.5,1.5h-45C2.7,29,2,28.3,2,27.5v-3C2,23.7,2.7,23,3.5,23h45c0.8,0,1.5,0.7,1.5,1.5V27.5z"/>
								</svg>
							{/if}
						{/if}
					</td>
					<td
						class="py-2 font-medium text-white"
						onmouseenter={(e) => showPlayerTip(e, row)}
						onmouseleave={() => playerTipVisible = false}
					>
						<a href="/player/{row.player_id}" class="hover:text-ayu-gold transition-colors">
							{row.player_name}
						</a>
						{#if row.player_id === prevWinnerId}
							<span class="text-sm" title="Yesterday's winner">👑</span>
						{/if}
						{#if completedPlayerIds.has(row.player_id)}
							<svg class="inline w-3.5 h-3.5 ml-0.5 -translate-y-px" style="color: var(--color-ayu-green)" viewBox="0 0 24 24" fill="none">
								<path d="M12,21h0a9,9,0,0,1-9-9H3a9,9,0,0,1,9-9h0a9,9,0,0,1,9,9h0A9,9,0,0,1,12,21ZM8,11.5l3,3,5-5" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"/>
							</svg>
						{/if}
						{#if row.player_id === currentPlayerId}
							<span class="ml-1 text-xs text-amber-400">(you)</span>
						{/if}
					</td>
					<td class="py-2 text-center text-amber-400">{row.gold || '—'}</td>
					<td class="py-2 text-center text-zinc-400">{row.silver || '—'}</td>
					<td class="py-2 text-center text-amber-700">{row.bronze || '—'}</td>
					<td class="py-2 text-center text-white">{row.total}</td>
				</tr>
			{/each}
		</tbody>
	</table>
</div>

{#if scoreTipVisible}
	<div
		class="pointer-events-none fixed z-50 w-44 rounded-lg border border-ayu-border bg-zinc-900 px-3 py-2 text-xs text-zinc-300 shadow-xl"
		style="left:{scoreTipX}px;top:{scoreTipY}px;transform:translateY(-100%)"
	>
		<div>🥇 Gold = 4 pts</div>
		<div>🥈 Silver = 2 pts</div>
		<div>🥉 Bronze = 1 pt</div>
	</div>
{/if}

{#if playerTipVisible && (tipStats.length > 0 || prevRankMap.has(tipPlayerId) || completedPlayerIds.has(tipPlayerId))}
	<div
		class="pointer-events-none fixed z-50 min-w-44 rounded-lg border border-ayu-border bg-zinc-900 px-3 py-2 text-xs shadow-xl"
		style="left:{playerTipX}px;top:{playerTipY}px;transform:translateY(-100%)"
	>
		<p class="font-semibold text-white">{tipName}</p>
		{#if completedPlayerIds.has(tipPlayerId)}
			<p class="mt-0.5" style="color: var(--color-ayu-green)">All games completed!</p>
		{/if}
		{#if prevRankMap.has(tipPlayerId)}
			{@const pr = prevRankMap.get(tipPlayerId)!}
			<p class="mt-0.5 text-ayu-muted" class:mb-1.5={tipStats.length > 0}>Yesterday: #{pr.rank} of {pr.outOf}</p>
		{/if}
		{#if tipStats.length > 0}
			<div class="space-y-1 mt-1.5">
				{#each tipStats as stat}
					<div class="flex items-center justify-between gap-6">
						<span class="flex items-center gap-1.5">
							<span>{stat.gameEmoji ?? '🎮'}</span>
							<span class="text-zinc-300">{stat.gameName}</span>
						</span>
						<span>{MEDAL_EMOJI[stat.medal!]}</span>
					</div>
				{/each}
			</div>
		{/if}
	</div>
{/if}
