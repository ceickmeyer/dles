<script lang="ts">
	import Podium from '$components/Podium.svelte';

	let { data } = $props();
	const tally = $derived(data.tally);
	const sessionCount = $derived(data.sessionCount);

	type Row = typeof tally[number];
</script>

<div class="space-y-8">
	<div>
		<h1 class="text-3xl font-bold text-white">All-Time Leaderboard</h1>
		<p class="mt-1 text-sm text-ayu-muted">
			Across {sessionCount} finished session{sessionCount === 1 ? '' : 's'}
		</p>
	</div>

	{#if tally.length === 0}
		<div class="py-16 text-center">
			<p class="text-5xl mb-4">🏆</p>
			<p class="text-ayu-muted">No finished sessions yet — check back after game night!</p>
		</div>
	{:else}
		{#if tally.length >= 2}
			<div class="rounded-xl border border-ayu-border bg-ayu-surface p-6">
				<Podium {tally} />
			</div>
		{/if}

		<div class="overflow-x-auto rounded-xl border border-ayu-border">
			<table class="w-full text-sm">
				<thead>
					<tr class="border-b border-ayu-border bg-ayu-surface2 text-left text-xs font-semibold uppercase tracking-wider text-ayu-muted">
						<th class="px-4 py-3">#</th>
						<th class="px-4 py-3">Player</th>
						<th class="px-3 py-3 text-center">🥇</th>
						<th class="px-3 py-3 text-center">🥈</th>
						<th class="px-3 py-3 text-center">🥉</th>
						<th class="px-3 py-3 text-center">Total</th>
						<th class="px-3 py-3 text-center">Win%</th>
						<th class="px-3 py-3 text-center">Nights</th>
						<th class="px-4 py-3">Best at</th>
					</tr>
				</thead>
				<tbody>
					{#each tally as row, i}
						{@const r = row as Row & { winStreak: number; badges: { emoji: string; label: string }[] }}
						<tr class="border-b border-ayu-border bg-ayu-surface last:border-0 hover:bg-ayu-surface2 transition-colors">
							<td class="px-4 py-3 text-ayu-muted">{i + 1}</td>
							<td class="px-4 py-3">
								<a href="/player/{row.player_id}" class="group flex items-center gap-2">
									<span class="font-semibold text-white group-hover:text-ayu-gold transition-colors">
										{row.player_name}
									</span>
									{#if r.winStreak >= 2}
										<span title="{r.winStreak}-night win streak" class="text-base">🔥</span>
									{/if}
									{#each r.badges.slice(0, 2) as badge}
										<span title={badge.label} class="text-base">{badge.emoji}</span>
									{/each}
								</a>
							</td>
							<td class="px-3 py-3 text-center text-ayu-gold">{row.gold || '—'}</td>
							<td class="px-3 py-3 text-center text-zinc-400">{row.silver || '—'}</td>
							<td class="px-3 py-3 text-center text-amber-700">{row.bronze || '—'}</td>
							<td class="px-3 py-3 text-center font-semibold text-white">{row.total}</td>
							<td class="px-3 py-3 text-center text-ayu-muted">
								{(row as Row & { winRate: number }).winRate > 0 ? `${(row as Row & { winRate: number }).winRate}%` : '—'}
							</td>
							<td class="px-3 py-3 text-center text-ayu-muted">{(row as Row & { nights: number }).nights}</td>
							<td class="px-4 py-3 text-sm text-zinc-300">
								{#if (row as Row & { favGame: { name: string; emoji: string } | null }).favGame}
									{@const g = (row as Row & { favGame: { name: string; emoji: string } }).favGame}
									<span>{g.emoji} {g.name}</span>
								{:else}
									<span class="text-ayu-muted">—</span>
								{/if}
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	{/if}
</div>
