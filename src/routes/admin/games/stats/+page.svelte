<script lang="ts">
	let { data } = $props();

	type GameStat = {
		id: string;
		name: string;
		icon_emoji: string | null;
		timesPlayed: number;
		lastPlayed: string | null;
		playRate: number;
		avgParticipation: number;
	};

	const stats = $derived(data.gameStats as GameStat[]);
	const totalSessions = $derived(data.totalSessions as number);
	const totalPlayers = $derived(data.totalPlayers as number);

	type SortKey = 'name' | 'timesPlayed' | 'playRate' | 'lastPlayed' | 'avgParticipation';
	let sortKey = $state<SortKey>('timesPlayed');
	let sortAsc = $state(false);

	function setSort(key: SortKey) {
		if (sortKey === key) {
			sortAsc = !sortAsc;
		} else {
			sortKey = key;
			sortAsc = key === 'name';
		}
	}

	const sorted = $derived(
		[...stats].sort((a, b) => {
			let cmp = 0;
			if (sortKey === 'name') cmp = a.name.localeCompare(b.name);
			else if (sortKey === 'timesPlayed') cmp = a.timesPlayed - b.timesPlayed;
			else if (sortKey === 'playRate') cmp = a.playRate - b.playRate;
			else if (sortKey === 'avgParticipation') cmp = a.avgParticipation - b.avgParticipation;
			else if (sortKey === 'lastPlayed') {
				const aDate = a.lastPlayed ?? '';
				const bDate = b.lastPlayed ?? '';
				cmp = aDate.localeCompare(bDate);
			}
			return sortAsc ? cmp : -cmp;
		})
	);

	function fmtDate(dateStr: string | null): string {
		if (!dateStr) return '—';
		return new Date(dateStr + 'T12:00:00').toLocaleDateString('en-US', {
			month: 'short',
			day: 'numeric',
			year: 'numeric'
		});
	}

	function daysSince(dateStr: string | null): number | null {
		if (!dateStr) return null;
		const ms = Date.now() - new Date(dateStr + 'T12:00:00').getTime();
		return Math.floor(ms / 86400000);
	}

	function pct(n: number): string {
		return (n * 100).toFixed(0) + '%';
	}
</script>

<div class="space-y-5">
	<div class="flex items-start justify-between gap-4">
		<div>
			<h1 class="text-2xl font-bold text-white">Game Stats</h1>
			<p class="mt-0.5 text-sm text-ayu-muted">
				{totalSessions} finished session{totalSessions !== 1 ? 's' : ''} · click a column header to sort
			</p>
		</div>
		<a
			href="/admin/schedule"
			class="rounded-lg border border-ayu-border px-4 py-2 text-sm text-ayu-muted transition hover:border-zinc-500 hover:text-white"
		>
			← Schedule
		</a>
	</div>

	{#if stats.length === 0}
		<p class="text-ayu-muted">No games registered yet.</p>
	{:else}
		<div class="overflow-x-auto rounded-xl border border-ayu-border">
			<table class="w-full text-sm">
				<thead>
					<tr class="border-b border-ayu-border bg-ayu-surface text-left">
						{#snippet th(key: SortKey, label: string, title?: string)}
							<th class="px-4 py-3 font-semibold text-ayu-muted">
								<button
									onclick={() => setSort(key)}
									{title}
									class="flex items-center gap-1 transition hover:text-white {sortKey === key
										? 'text-white'
										: ''}"
								>
									{label}
									{#if sortKey === key}
										<span class="text-ayu-gold">{sortAsc ? '↑' : '↓'}</span>
									{/if}
								</button>
							</th>
						{/snippet}
						{@render th('name', 'Game')}
						{@render th('timesPlayed', 'Played', 'Sessions this game appeared in')}
						{@render th('playRate', 'Rate', 'How often this game appears in the rotation')}
						{@render th('lastPlayed', 'Last Played')}
						{@render th(
							'avgParticipation',
							'Participation',
							`Average % of ${totalPlayers} players who submitted a score per session`
						)}
					</tr>
				</thead>
				<tbody>
					{#each sorted as g (g.id)}
						{@const days = daysSince(g.lastPlayed)}
						{@const stale = days !== null && days > 21}
						{@const never = g.timesPlayed === 0}
						<tr
							class="border-b border-ayu-border/50 transition-colors last:border-0 hover:bg-ayu-surface/60 {never
								? 'opacity-50'
								: ''}"
						>
							<!-- Game name -->
							<td class="px-4 py-3">
								<a href="/admin/games/{g.id}" class="flex items-center gap-2 hover:text-ayu-gold">
									<span class="text-lg leading-none">{g.icon_emoji ?? '🎮'}</span>
									<span class="font-medium text-white">{g.name}</span>
								</a>
							</td>

							<!-- Times played -->
							<td class="px-4 py-3 tabular-nums">
								{#if g.timesPlayed > 0}
									<span class="text-zinc-300">{g.timesPlayed}</span>
								{:else}
									<span class="text-ayu-muted">0</span>
								{/if}
							</td>

							<!-- Play rate bar -->
							<td class="px-4 py-3">
								{#if g.timesPlayed > 0}
									<div class="flex items-center gap-2">
										<div class="h-1.5 w-20 overflow-hidden rounded-full bg-ayu-surface2">
											<div
												class="h-full rounded-full bg-ayu-blue"
												style="width:{Math.round(g.playRate * 100)}%"
											></div>
										</div>
										<span class="text-zinc-300 tabular-nums">{pct(g.playRate)}</span>
									</div>
								{:else}
									<span class="text-ayu-muted">—</span>
								{/if}
							</td>

							<!-- Last played -->
							<td class="px-4 py-3 tabular-nums">
								{#if never}
									<span class="text-ayu-muted">Never</span>
								{:else if stale}
									<span class="text-ayu-gold" title="{days} days ago">{fmtDate(g.lastPlayed)}</span>
								{:else}
									<span class="text-zinc-300">{fmtDate(g.lastPlayed)}</span>
								{/if}
							</td>

							<!-- Participation bar -->
							<td class="px-4 py-3">
								{#if g.timesPlayed > 0}
									<div class="flex items-center gap-2">
										<div class="h-1.5 w-20 overflow-hidden rounded-full bg-ayu-surface2">
											<div
												class="h-full rounded-full {g.avgParticipation >= 0.8
													? 'bg-ayu-green'
													: g.avgParticipation >= 0.5
														? 'bg-ayu-gold'
														: 'bg-ayu-red'}"
												style="width:{Math.round(g.avgParticipation * 100)}%"
											></div>
										</div>
										<span class="text-zinc-300 tabular-nums">{pct(g.avgParticipation)}</span>
									</div>
								{:else}
									<span class="text-ayu-muted">—</span>
								{/if}
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>

		<p class="text-xs text-ayu-muted">
			<span class="text-ayu-gold">Gold date</span> = not played in 3+ weeks.
			<span class="opacity-50">Faded rows</span> = never played. Participation bars:
			<span class="text-ayu-green">green ≥ 80%</span>,
			<span class="text-ayu-gold">gold ≥ 50%</span>,
			<span class="text-ayu-red">red &lt; 50%</span>.
		</p>
	{/if}
</div>
