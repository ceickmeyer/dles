<script lang="ts">
	import type { MedalTally } from '$lib/scoring';

	let { tally, currentPlayerId = null }: { tally: MedalTally[]; currentPlayerId?: string | null } =
		$props();
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
				<th class="py-2 text-center font-medium">Total</th>
			</tr>
		</thead>
		<tbody>
			{#each tally as row, i}
				<tr
					class={row.player_id === currentPlayerId
						? 'border-b border-zinc-800 bg-amber-900/20 transition-colors'
						: 'border-b border-zinc-800 transition-colors'}
				>
					<td class="py-2 text-zinc-500">{i + 1}</td>
					<td class="py-2 font-medium text-white">
						{row.player_name}
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
