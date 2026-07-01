<script lang="ts">
	import type { MedalTally, PlayerDayStat } from '$lib/scoring';
	import { MEDAL_EMOJI } from '$lib/scoring';

	let { tally, currentPlayerId = null, playerStats = new Map(), prevRankMap = new Map(), completedPlayerIds = new Set(), prevWinnerId = null, prevFullRanking = [], totalGames = 0, playerGameCounts = new Map(), featuredWinnerId = null }: {
		tally: MedalTally[];
		currentPlayerId?: string | null;
		playerStats?: Map<string, PlayerDayStat[]>;
		prevRankMap?: Map<string, { rank: number; outOf: number }>;
		completedPlayerIds?: Set<string>;
		prevWinnerId?: string | null;
		prevFullRanking?: { player_id: string; player_name: string; rank: number; total: number }[];
		totalGames?: number;
		playerGameCounts?: Map<string, number>;
		featuredWinnerId?: string | null;
	} = $props();

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

	let crownTipVisible = $state(false);
	let crownTipX = $state(0);
	let crownTipY = $state(0);

	function showCrownTip(e: MouseEvent) {
		e.stopPropagation();
		const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
		crownTipX = rect.left;
		crownTipY = rect.top - 8;
		crownTipVisible = true;
		playerTipVisible = false;
	}
	function hideCrownTip(e: MouseEvent) {
		e.stopPropagation();
		crownTipVisible = false;
	}

	let arrowTipVisible = $state(false);
	let arrowTipX = $state(0);
	let arrowTipY = $state(0);
	let arrowTipPrev = $state(0);
	let arrowTipOutOf = $state(0);
	let arrowTipDelta = $state(0);

	function ordinal(n: number) {
		const s = ['th','st','nd','rd'];
		const v = n % 100;
		return n + (s[(v - 20) % 10] ?? s[v] ?? s[0]);
	}

	function showArrowTip(e: MouseEvent, prevRank: number, currRank: number, outOf: number) {
		const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
		arrowTipX = rect.left;
		arrowTipY = rect.top - 8;
		arrowTipPrev = prevRank;
		arrowTipOutOf = outOf;
		arrowTipDelta = prevRank - currRank;
		arrowTipVisible = true;
	}

	const SINGLE_PATH = "M508.788,371.087L263.455,125.753c-4.16-4.16-10.88-4.16-15.04,0L2.975,371.087c-4.053,4.267-3.947,10.987,0.213,15.04c4.16,3.947,10.667,3.947,14.827,0l237.867-237.76l237.76,237.76c4.267,4.053,10.987,3.947,15.04-0.213C512.734,381.753,512.734,375.247,508.788,371.087z";
	const DBL_PATH_1  = "M263.535,248.453c-4.16-4.16-10.88-4.16-15.04,0L3.054,493.787c-4.053,4.267-3.947,10.987,0.213,15.04c4.16,3.947,10.667,3.947,14.827,0l237.867-237.76l237.76,237.76c4.267,4.053,10.987,3.947,15.04-0.213c3.947-4.16,3.947-10.667,0-14.827L263.535,248.453z";
	const DBL_PATH_2  = "M18.201,263.493l237.76-237.76l237.76,237.76c4.267,4.053,10.987,3.947,15.04-0.213c3.947-4.16,3.947-10.667,0-14.827L263.535,3.12c-4.16-4.16-10.88-4.16-15.04,0L3.054,248.453c-4.053,4.267-3.947,10.987,0.213,15.04C7.534,267.547,14.041,267.547,18.201,263.493z";
</script>

<div class="overflow-x-auto">
	<table class="w-full text-sm">
		<thead>
			<tr class="border-b border-zinc-700 text-zinc-400">
				<th class="py-2 pl-3 pr-1 text-left font-medium">#</th>
				<th class="py-2 w-4 hidden sm:table-cell"></th>
				<th class="py-2 text-left font-medium">Player</th>
				{#if totalGames > 0}
					<th class="py-2 w-14 text-center font-medium">Played</th>
				{/if}
				<th class="py-2 w-10 text-center font-medium hidden sm:table-cell">🥇</th>
				<th class="py-2 w-10 text-center font-medium hidden sm:table-cell">🥈</th>
				<th class="py-2 w-10 text-center font-medium hidden sm:table-cell">🥉</th>
				<th class="py-2 pl-2 pr-3 w-14 text-center font-medium">
					<span class="inline-flex items-center justify-center gap-1">
						<span class="hidden sm:inline">Total</span>
						<span class="sm:hidden">Pts</span>
						<button
							onmouseenter={showScoreTip}
							onmouseleave={() => scoreTipVisible = false}
							class="transition-colors"
							style="color: var(--color-ayu-blue)"
							aria-label="Scoring info"
						>
							<svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none">
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
				<tr class="border-b border-zinc-800 transition-colors
					{ranks[i] === 1 ? 'bg-yellow-400/10' : ranks[i] === 2 ? 'bg-slate-400/8' : ranks[i] === 3 ? 'bg-amber-700/10' : row.player_id === currentPlayerId ? 'bg-amber-900/20' : ''}">

					<td class="py-2.5 pl-3 pr-1
						{ranks[i] === 1 ? 'text-ayu-gold font-bold' : ranks[i] === 2 ? 'text-zinc-400 font-bold' : ranks[i] === 3 ? 'text-amber-700 font-bold' : 'text-zinc-600'}">{ranks[i]}</td>

					<td class="py-2.5 w-4 hidden sm:table-cell cursor-default"
						onmouseenter={(e) => { if (prevRankMap.has(row.player_id)) { const p = prevRankMap.get(row.player_id)!; showArrowTip(e, p.rank, ranks[i], p.outOf); } }}
						onmouseleave={() => arrowTipVisible = false}
					>
						{#if prevRankMap.has(row.player_id)}
							{@const prev = prevRankMap.get(row.player_id)!}
							{@const delta = prev.rank - ranks[i]}
							{#if delta > 1}
								<svg class="w-3.5 h-3.5" style="color: var(--color-ayu-green)" fill="currentColor" stroke="currentColor" stroke-width="32" viewBox="0 0 511.801 511.801">
									<path d={DBL_PATH_1}/><path d={DBL_PATH_2}/>
								</svg>
							{:else if delta === 1}
								<svg class="w-3.5 h-3.5" style="color: var(--color-ayu-green)" fill="currentColor" stroke="currentColor" stroke-width="32" viewBox="0 0 511.735 511.735">
									<path d={SINGLE_PATH}/>
								</svg>
							{:else if delta === 0}
								<svg class="w-3.5 h-3.5" style="color: var(--color-ayu-muted)" fill="currentColor" viewBox="0 0 52 52">
									<path d="M50,27.5c0,0.8-0.7,1.5-1.5,1.5h-45C2.7,29,2,28.3,2,27.5v-3C2,23.7,2.7,23,3.5,23h45c0.8,0,1.5,0.7,1.5,1.5V27.5z"/>
								</svg>
							{:else if delta === -1}
								<svg class="w-3.5 h-3.5 rotate-180" style="color: var(--color-ayu-red)" fill="currentColor" stroke="currentColor" stroke-width="32" viewBox="0 0 511.735 511.735">
									<path d={SINGLE_PATH}/>
								</svg>
							{:else}
								<svg class="w-3.5 h-3.5 rotate-180" style="color: var(--color-ayu-red)" fill="currentColor" stroke="currentColor" stroke-width="32" viewBox="0 0 511.801 511.801">
									<path d={DBL_PATH_1}/><path d={DBL_PATH_2}/>
								</svg>
							{/if}
						{/if}
					</td>

					<td class="py-2.5 pl-2 pr-2 font-medium text-white"
						onmouseenter={(e) => showPlayerTip(e, row)}
						onmouseleave={() => playerTipVisible = false}
					>
						<span class="flex items-center gap-1 flex-wrap">
							<a href="/player/{row.player_id}" class="hover:text-ayu-gold transition-colors">{row.player_name}</a>
							{#if row.player_id === featuredWinnerId}
								<!-- svelte-ignore a11y_no_static_element_interactions -->
								<span class="group relative inline-flex cursor-default z-10"
									onmouseenter={(e) => { e.stopPropagation(); playerTipVisible = false; }}
									onmouseleave={() => playerTipVisible = false}
								>
									⭐
									<span class="pointer-events-none absolute bottom-full left-1/2 mb-1.5 w-36 -translate-x-1/2 rounded-lg border border-ayu-border bg-zinc-900 px-2 py-1 text-xs font-normal normal-case tracking-normal text-zinc-300 opacity-0 shadow-xl transition-opacity group-hover:opacity-100 whitespace-nowrap">
										Won featured game
									</span>
								</span>
							{/if}
							{#if row.player_id === prevWinnerId}
								<!-- svelte-ignore a11y_no_static_element_interactions -->
								<span class="cursor-default" onmouseenter={showCrownTip} onmouseleave={hideCrownTip}>👑</span>
							{/if}
							{#if row.player_id === currentPlayerId}
								<span class="text-xs text-amber-400">(you)</span>
							{/if}
						</span>
					</td>

					{#if totalGames > 0}
						{@const count = playerGameCounts.get(row.player_id) ?? 0}
						<td class="py-2.5 w-14 text-center">
							{#if completedPlayerIds.has(row.player_id)}
								<svg class="inline w-4.5 h-4.5 shrink-0" style="color: var(--color-ayu-green)" viewBox="0 0 24 24" fill="none">
									<title>All games completed</title>
									<path d="M12,21h0a9,9,0,0,1-9-9H3a9,9,0,0,1,9-9h0a9,9,0,0,1,9,9h0A9,9,0,0,1,12,21ZM8,11.5l3,3,5-5" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"/>
								</svg>
							{:else if count > 0}
								<span class="font-mono text-xs" style="color: var(--color-ayu-muted)">{count}/{totalGames}</span>
							{:else}
								<span class="text-zinc-700">—</span>
							{/if}
						</td>
					{/if}

					<td class="py-2.5 w-10 text-center text-amber-400 hidden sm:table-cell">{row.gold || '—'}</td>
					<td class="py-2.5 w-10 text-center text-zinc-400 hidden sm:table-cell">{row.silver || '—'}</td>
					<td class="py-2.5 w-10 text-center text-amber-700 hidden sm:table-cell">{row.bronze || '—'}</td>
					<td class="py-2.5 pl-2 pr-3 w-14 text-center font-semibold text-white">{row.total}</td>
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
		<div>🥇 Gold = 4 pts (5 on featured)</div>
		<div>🥈 Silver = 2 pts</div>
		<div>🥉 Bronze = 1 pt</div>
	</div>
{/if}

{#if playerTipVisible && tipStats.length > 0}
	<div
		class="pointer-events-none fixed z-50 min-w-44 rounded-lg border border-ayu-border bg-zinc-900 px-3 py-2 text-xs shadow-xl"
		style="left:{playerTipX}px;top:{playerTipY}px;transform:translateY(-100%)"
	>
		<p class="font-semibold text-white">{tipName}</p>
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
	</div>
{/if}

{#if arrowTipVisible}
	<div
		class="pointer-events-none fixed z-50 rounded-lg border border-ayu-border bg-zinc-900 px-3 py-2 text-xs text-zinc-300 shadow-xl"
		style="left:{arrowTipX}px;top:{arrowTipY}px;transform:translateY(-100%)"
	>
		<p class="text-zinc-400">Yesterday: {ordinal(arrowTipPrev)} of {arrowTipOutOf}</p>
		{#if arrowTipDelta > 0}
			<p class="font-semibold" style="color: var(--color-ayu-green)">↑ {arrowTipDelta} place{arrowTipDelta > 1 ? 's' : ''} gained</p>
		{:else if arrowTipDelta < 0}
			<p class="font-semibold" style="color: var(--color-ayu-red)">↓ {Math.abs(arrowTipDelta)} place{Math.abs(arrowTipDelta) > 1 ? 's' : ''} dropped</p>
		{:else}
			<p class="text-zinc-500">Holding position</p>
		{/if}
	</div>
{/if}

{#if crownTipVisible}
	<div
		class="pointer-events-none fixed z-50 rounded-lg border border-ayu-border bg-zinc-900 px-3 py-2 text-xs text-zinc-300 shadow-xl whitespace-nowrap"
		style="left:{crownTipX}px;top:{crownTipY}px;transform:translateY(-100%)"
	>
		Yesterday's winner
	</div>
{/if}
