<script lang="ts">
	import { isDnf } from '$lib/utils';

	let { data } = $props();
	const game = $derived(data.game);
	const rows = $derived(data.rows);

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

	{#if rows.length === 0}
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
						<th class="px-3 py-3 text-center">Avg</th>
						<th class="px-3 py-3 text-center">Best</th>
						<th class="px-3 py-3 text-center">Worst</th>
						<th class="px-3 py-3 text-center">Played</th>
					</tr>
				</thead>
				<tbody>
					{#each rows as row, i}
						<tr class="border-b border-ayu-border bg-ayu-surface last:border-0 hover:bg-ayu-surface2 transition-colors">
							<td class="px-4 py-3 text-ayu-muted">{i + 1}</td>
							<td class="px-4 py-3">
								<a href="/player/{row.player_id}" class="font-semibold text-white hover:text-ayu-gold transition-colors">
									{row.name}
								</a>
							</td>
							<td class="px-3 py-3 text-center font-bold {i === 0 ? 'text-ayu-gold' : 'text-white'}">
								{fmtAvg(row.avg)}
							</td>
							<td class="px-3 py-3 text-center text-ayu-green">{row.best !== null ? fmt(row.best) : '—'}</td>
							<td class="px-3 py-3 text-center text-ayu-muted">{row.worst !== null ? fmt(row.worst) : '—'}</td>
							<td class="px-3 py-3 text-center text-ayu-muted">{row.played}</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	{/if}
</div>
