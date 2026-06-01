<script lang="ts">
	import { fmtSeconds } from '$lib/utils';

	let { data } = $props();

	type GameEntry = typeof data.perGame[number];

	function fmtAvg(avg: number, game: GameEntry): string {
		if (game.shareParser === 'decipher') return fmtSeconds(avg);
		if (game.maxScore !== null && game.maxScore <= 12) return avg.toFixed(2);
		return avg.toFixed(1);
	}

	function fmtScore(score: number, game: GameEntry): string {
		if (game.allowDnf && game.maxScore !== null && score === game.maxScore + 1) return 'DNF';
		if (game.shareParser === 'decipher') return fmtSeconds(score);
		if (game.maxScore !== null && game.maxScore > 12) return score.toLocaleString();
		return String(score);
	}
</script>

<div class="space-y-8">
	<div>
		<h1 class="text-3xl font-bold text-white">Leaderboard</h1>
		<p class="mt-1 text-sm text-ayu-muted">
			Per game average scores across their last 10 games. 3 plays required to appear.
		</p>
	</div>

	{#if data.powerRankings.length > 0}
		<div class="rounded-xl border border-ayu-border bg-ayu-surface p-5">
			<div class="mb-4 border-b border-ayu-border pb-4">
				<p class="font-semibold text-white">⚡ Power Rankings</p>
				<p class="text-xs text-ayu-muted mt-0.5">Average percentile finish across every individual game entered — skipping a game doesn't count against you. Min. 10 game entries to appear.</p>
			</div>
			<div class="space-y-0.5">
				{#each data.powerRankings as row, i}
					<div class="flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-ayu-surface2 transition-colors">
						<span class="w-5 shrink-0 text-center text-xs font-bold
							{i === 0 ? 'text-ayu-gold' : i === 1 ? 'text-zinc-400' : i === 2 ? 'text-amber-700' : 'text-zinc-600'}">
							{i + 1}
						</span>
						<span class="w-4 shrink-0 flex items-center justify-center">
							{#if row.movement !== null && row.movement > 0}
								<svg class="w-3 h-3" style="color: var(--color-ayu-green)" fill="currentColor" viewBox="0 0 512 512">
									<path stroke="currentColor" stroke-width="40" stroke-linejoin="round" d="M505.752,358.248L271.085,123.582c-8.331-8.331-21.839-8.331-30.17,0L6.248,358.248c-8.331,8.331-8.331,21.839,0,30.17s21.839,8.331,30.17,0L256,168.837l219.582,219.582c8.331,8.331,21.839,8.331,30.17,0S514.083,366.58,505.752,358.248z"/>
								</svg>
							{:else if row.movement !== null && row.movement < 0}
								<svg class="w-3 h-3 rotate-180" style="color: var(--color-ayu-red)" fill="currentColor" viewBox="0 0 512 512">
									<path stroke="currentColor" stroke-width="40" stroke-linejoin="round" d="M505.752,358.248L271.085,123.582c-8.331-8.331-21.839-8.331-30.17,0L6.248,358.248c-8.331,8.331-8.331,21.839,0,30.17s21.839,8.331,30.17,0L256,168.837l219.582,219.582c8.331,8.331,21.839,8.331,30.17,0S514.083,366.58,505.752,358.248z"/>
								</svg>
							{:else if row.movement === 0}
								<svg class="w-3 h-3" style="color: var(--color-ayu-muted)" fill="currentColor" viewBox="0 0 52 52">
									<path d="M50,27.5c0,0.8-0.7,1.5-1.5,1.5h-45C2.7,29,2,28.3,2,27.5v-3C2,23.7,2.7,23,3.5,23h45c0.8,0,1.5,0.7,1.5,1.5V27.5z"/>
								</svg>
							{/if}
						</span>
						<a href="/player/{row.player_id}" class="flex-1 text-sm text-white hover:text-ayu-gold transition-colors">
							{row.name}
						</a>
						<span class="font-mono text-sm font-bold {i === 0 ? 'text-ayu-gold' : 'text-white'}">
							{row.percentile.toFixed(1)}%
						</span>
						<span class="w-16 text-right text-xs text-ayu-muted">
							{row.gamesEntered} games
						</span>
					</div>
				{/each}
			</div>
		</div>
	{/if}

	{#if data.perGame.length === 0}
		<div class="py-16 text-center">
			<p class="text-5xl mb-4">🎮</p>
			<p class="text-ayu-muted">No finished sessions yet — check back after game night!</p>
		</div>
	{:else}
		<div class="grid grid-cols-1 gap-5 sm:grid-cols-2">
			{#each data.perGame as game}
				<div class="rounded-xl border border-ayu-border bg-ayu-surface p-5">
					<!-- Header -->
					<div class="mb-4 flex items-center gap-3 border-b border-ayu-border pb-4">
						<span class="text-3xl">{game.emoji}</span>
						<div>
							<p class="font-semibold text-white leading-tight">{game.name}</p>
							<p class="text-xs text-ayu-muted mt-0.5">
								{game.direction === 'lower_is_better' ? 'Lower is better' : 'Higher is better'} · avg score
							</p>
						</div>
					</div>

					<!-- Player rows -->
					<div class="space-y-2">
						{#each game.rows.slice(0, 6) as row, i (row.player_id)}
							<div class="group relative flex items-center gap-3 rounded-lg px-1 py-1 hover:bg-ayu-surface2 transition-colors">
								<span class="w-4 shrink-0 text-center text-xs {i === 0 ? 'text-ayu-gold font-bold' : 'text-ayu-muted'}">{i + 1}</span>
								<a href="/player/{row.player_id}" class="flex-1 truncate text-sm text-white hover:text-ayu-gold transition-colors">
									{row.name}
								</a>
								<span class="font-mono text-sm font-bold {i === 0 ? 'text-ayu-gold' : 'text-white'}">
									{row.avg !== null ? fmtAvg(row.avg, game) : '—'}
								</span>

								<!-- Hover tooltip -->
								<div class="pointer-events-none absolute right-0 top-full z-10 mt-1 w-48 rounded-lg border border-ayu-border bg-zinc-900 p-3 text-xs opacity-0 shadow-lg transition-opacity group-hover:opacity-100">
									<div class="space-y-1 text-zinc-300">
										<div class="flex justify-between">
											<span class="text-ayu-muted">Avg</span>
											<span class="font-mono font-semibold text-white">{row.avg !== null ? fmtAvg(row.avg, game) : '—'}</span>
										</div>
										{#if row.best !== null}
											<div class="flex justify-between">
												<span class="text-ayu-muted">Best</span>
												<span class="font-mono font-semibold text-white">{fmtScore(row.best, game)}</span>
											</div>
										{/if}
										<div class="flex justify-between">
											<span class="text-ayu-muted">Played</span>
											<span class="font-mono font-semibold text-white">{row.played} time{row.played === 1 ? '' : 's'}</span>
										</div>
										{#if row.dnfCount > 0}
											<div class="flex justify-between">
												<span class="text-ayu-muted">DNFs</span>
												<span class="font-mono font-semibold text-ayu-red">{row.dnfCount}</span>
											</div>
										{/if}
									</div>
								</div>
							</div>
						{/each}
					</div>

					{#if game.rows.length > 6}
						<a
							href="/leaderboard/game/{game.id}"
							class="mt-4 block border-t border-ayu-border pt-3 text-center text-xs text-ayu-muted hover:text-white transition-colors"
						>
							+{game.rows.length - 6} more →
						</a>
					{/if}
				</div>
			{/each}
		</div>
	{/if}
</div>
