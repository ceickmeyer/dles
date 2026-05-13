<script lang="ts">
	import { onMount } from 'svelte';
	import { invalidateAll } from '$app/navigation';
	import { supabase } from '$lib/supabase';
	import { runScheduler } from '$lib/scheduler';

	let { data } = $props();
	const sessions = $derived(data.sessions as { id: string; name: string; date: string; status: string }[]);

	let schedulerMsg = $state('');

	onMount(async () => {
		const result = await runScheduler(supabase);
		const parts: string[] = [];
		if (result.finished) parts.push(`✓ Finished ${result.finished} stale session${result.finished > 1 ? 's' : ''}`);
		if (result.created) parts.push(`📅 Created "${result.sessionName}"`);
		if (parts.length) {
			schedulerMsg = parts.join(' · ');
			await invalidateAll();
		}
	});

	const statusColor: Record<string, string> = {
		lobby: 'bg-zinc-700 text-zinc-300',
		active: 'bg-ayu-green/20 text-ayu-green',
		finished: 'bg-zinc-800 text-zinc-500'
	};

	function fmtDate(dateStr: string) {
		return new Date(dateStr + 'T12:00:00').toLocaleDateString('en-US', {
			weekday: 'short', month: 'short', day: 'numeric'
		});
	}
</script>

<div class="space-y-6">
	{#if schedulerMsg}
		<div class="rounded-lg border border-ayu-green/40 bg-ayu-green/10 px-4 py-2.5 text-sm text-ayu-green">
			{schedulerMsg}
		</div>
	{/if}

	<div>
		<h1 class="text-2xl font-bold text-white">Dashboard</h1>
		<p class="mt-0.5 text-sm text-ayu-muted">Recent sessions — scheduler runs automatically on page load.</p>
	</div>

	{#if sessions.length === 0}
		<p class="text-ayu-muted">No sessions yet. Configure the <a href="/admin/schedule" class="text-ayu-gold hover:underline">weekly schedule</a> and run the scheduler.</p>
	{:else}
		<div class="overflow-hidden rounded-xl border border-ayu-border">
			<table class="w-full text-sm">
				<thead>
					<tr class="border-b border-ayu-border bg-ayu-surface2 text-left text-xs font-semibold uppercase tracking-wider text-ayu-muted">
						<th class="px-4 py-3">Session</th>
						<th class="px-4 py-3">Date</th>
						<th class="px-4 py-3">Status</th>
					</tr>
				</thead>
				<tbody>
					{#each sessions as s}
						<tr class="border-b border-ayu-border bg-ayu-surface last:border-0">
							<td class="px-4 py-3 font-medium text-white">{s.name}</td>
							<td class="px-4 py-3 text-ayu-muted">{fmtDate(s.date)}</td>
							<td class="px-4 py-3">
								<span class="rounded-full px-2.5 py-0.5 text-xs font-medium {statusColor[s.status] ?? ''}">
									{s.status}
								</span>
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	{/if}
</div>
