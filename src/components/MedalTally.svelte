<script lang="ts">
	import type { MedalTally, PlayerDayStat } from '$lib/scoring';
	import { MEDAL_EMOJI } from '$lib/scoring';

	let { tally, currentPlayerId = null, playerStats = new Map() }: {
		tally: MedalTally[];
		currentPlayerId?: string | null;
		playerStats?: Map<string, PlayerDayStat[]>;
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

	const MEDAL_ORDER: Record<string, number> = { gold: 0, silver: 1, bronze: 2 };

	function showPlayerTip(e: MouseEvent, row: MedalTally) {
		const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
		playerTipX = rect.left;
		playerTipY = rect.top - 8;
		tipStats = (playerStats.get(row.player_id) ?? [])
			.filter(s => s.medal !== null)
			.sort((a, b) => MEDAL_ORDER[a.medal!] - MEDAL_ORDER[b.medal!]);
		tipName = row.player_name;
		playerTipVisible = true;
	}
</script>

<div class="overflow-x-auto">
	<table class="w-full text-sm">
		<thead>
			<tr class="border-b border-zinc-700 text-zinc-400">
				<th class="py-2 text-left font-medium">#</th>
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
					<td
						class="py-2 font-medium text-white"
						onmouseenter={(e) => showPlayerTip(e, row)}
						onmouseleave={() => playerTipVisible = false}
					>
						<a href="/player/{row.player_id}" class="hover:text-ayu-gold transition-colors">
							{row.player_name}
						</a>
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

{#if playerTipVisible && tipStats.length > 0}
	<div
		class="pointer-events-none fixed z-50 min-w-44 rounded-lg border border-ayu-border bg-zinc-900 px-3 py-2 text-xs shadow-xl"
		style="left:{playerTipX}px;top:{playerTipY}px;transform:translateY(-100%)"
	>
		<p class="mb-1.5 font-semibold text-white">{tipName}</p>
		<div class="space-y-1">
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
	</div>
{/if}
