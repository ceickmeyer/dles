<script lang="ts">
	import Podium from '$components/Podium.svelte';

	let { data } = $props();
	const tally = $derived(data.tally);
	const sessionCount = $derived(data.sessionCount);
</script>

<div class="space-y-8">
	<div>
		<h1 class="text-3xl font-bold text-white">All-Time Leaderboard</h1>
		<p class="mt-1 text-sm text-zinc-400">
			Across {sessionCount} finished session{sessionCount === 1 ? '' : 's'}
		</p>
	</div>

	{#if tally.length === 0}
		<div class="py-16 text-center">
			<p class="text-5xl mb-4">🏆</p>
			<p class="text-zinc-400">No finished sessions yet — check back after game night!</p>
		</div>
	{:else}
		{#if tally.length >= 2}
			<div class="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
				<Podium {tally} />
			</div>
		{/if}

		<div class="overflow-x-auto rounded-xl border border-zinc-800">
			<table class="w-full text-sm">
				<thead class="bg-zinc-900">
					<tr class="border-b border-zinc-700 text-zinc-400">
						<th class="px-4 py-3 text-left font-medium">#</th>
						<th class="px-4 py-3 text-left font-medium">Player</th>
						<th class="px-4 py-3 text-center font-medium">🥇</th>
						<th class="px-4 py-3 text-center font-medium">🥈</th>
						<th class="px-4 py-3 text-center font-medium">🥉</th>
						<th class="px-4 py-3 text-center font-medium">Medals</th>
						<th class="px-4 py-3 text-center font-medium">Nights</th>
					</tr>
				</thead>
				<tbody class="bg-zinc-950">
					{#each tally as row, i}
						<tr class="border-b border-zinc-900 hover:bg-zinc-900/50">
							<td class="px-4 py-3 text-zinc-500">{i + 1}</td>
							<td class="px-4 py-3 font-semibold text-white">{row.player_name}</td>
							<td class="px-4 py-3 text-center text-amber-400">{row.gold || '—'}</td>
							<td class="px-4 py-3 text-center text-zinc-400">{row.silver || '—'}</td>
							<td class="px-4 py-3 text-center text-amber-700">{row.bronze || '—'}</td>
							<td class="px-4 py-3 text-center font-semibold text-white">{row.total}</td>
							<td class="px-4 py-3 text-center text-zinc-400">{(row as typeof row & {nights: number}).nights}</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	{/if}
</div>
