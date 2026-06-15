<script lang="ts">
	import { isDnf } from '$lib/utils';

	let { data } = $props();
	const game = $derived(data.game);

	type SortKey = 'avg' | 'best' | 'worst';
	let sortBy = $state<SortKey>('avg');

	const asc = $derived(game.scoring_direction === 'lower_is_better');

	const sorted = $derived.by(() => {
		const rows = [...data.rows];
		return rows.sort((a, b) => {
			if (sortBy === 'avg') return asc ? a.avg - b.avg : b.avg - a.avg;
			const av = a[sortBy], bv = b[sortBy];
			if (av === null && bv === null) return 0;
			if (av === null) return 1;
			if (bv === null) return -1;
			return asc ? av - bv : bv - av;
		});
	});

	function fmt(score: number): string {
		if (isDnf(score, game)) return 'DNF';
		if (game.scoring_direction === 'lower_is_better' && game.max_score) {
			return `${score}/${game.max_score}`;
		}
		return score % 1 === 0 ? score.toLocaleString() : score.toFixed(1);
	}

	function fmtAvg(avg: number): string {
		if (game.max_score && game.max_score <= 20) return avg.toFixed(2);
		return avg % 1 === 0 ? avg.toLocaleString() : avg.toFixed(1);
	}
</script>

<div class="space-y-8 max-w-2xl">
	<div>
		<a href="/leaderboard" class="mb-4 inline-flex items-center gap-1 text-sm text-ayu-muted hover:text-white">
			← Leaderboard
		</a>
		<div class="flex items-center gap-3">
			<span class="text-4xl">{game.icon_emoji ?? '🎮'}</span>
			<div>
				<h1 class="text-3xl font-bold text-white">{game.name}</h1>
				<p class="mt-0.5 text-sm text-ayu-muted">
					{game.scoring_direction === 'lower_is_better' ? 'Lower is better' : 'Higher is better'}
					· {data.sessionCount} finished session{data.sessionCount === 1 ? '' : 's'}
				</p>
			</div>
		</div>
	</div>

	{#if sorted.length === 0}
		<div class="py-16 text-center">
			<p class="text-ayu-muted">No scores recorded yet for this game.</p>
		</div>
	{:else}
		<div class="overflow-x-auto rounded-xl border border-ayu-border">
			<table class="w-full text-sm">
				<thead>
					<tr class="border-b border-ayu-border bg-ayu-surface2 text-left text-xs font-semibold uppercase tracking-wider text-ayu-muted">
						<th class="px-4 py-3">#</th>
						<th class="px-4 py-3">Player</th>
						{#each [
							{ key: 'avg', label: 'Avg' },
							{ key: 'best', label: 'Best' },
							{ key: 'worst', label: 'Worst' },
						] as col (col.key)}
							<th class="px-3 py-3 text-center">
								<button
									onclick={() => sortBy = col.key as SortKey}
									class="inline-flex items-center gap-1 transition-colors {sortBy === col.key ? 'text-ayu-gold' : 'hover:text-white'}"
								>
									{col.label}
									{#if sortBy === col.key}
										<svg class="w-2.5 h-2.5" viewBox="0 0 10 6" fill="none">
											<path d="M0 5.5L5 0.5L10 5.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
										</svg>
									{/if}
								</button>
							</th>
						{/each}
						<th class="px-3 py-3 text-center">Played</th>
					</tr>
				</thead>
				<tbody>
					{#each sorted as row, i}
						<tr class="border-b border-ayu-border bg-ayu-surface last:border-0 hover:bg-ayu-surface2 transition-colors">
							<td class="px-4 py-3 text-ayu-muted">{i + 1}</td>
							<td class="px-4 py-3">
								<a href="/player/{row.player_id}" class="font-semibold text-white hover:text-ayu-gold transition-colors">
									{row.name}
								</a>
							</td>
							<td class="px-3 py-3 text-center font-bold {sortBy === 'avg' && i === 0 ? 'text-ayu-gold' : 'text-white'}">
								{fmtAvg(row.avg)}
							</td>
							<td class="px-3 py-3 text-center {sortBy === 'best' && i === 0 ? 'text-ayu-gold' : 'text-ayu-green'}">
								{row.best !== null ? fmt(row.best) : '—'}
							</td>
							<td class="px-3 py-3 text-center {sortBy === 'worst' && i === 0 ? 'text-ayu-gold' : 'text-ayu-muted'}">
								{row.worst !== null ? fmt(row.worst) : '—'}
							</td>
							<td class="px-3 py-3 text-center text-ayu-muted">{row.played}</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	{/if}
</div>
