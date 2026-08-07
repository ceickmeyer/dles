<script lang="ts">
	import { supabase } from '$lib/supabase';

	let { data } = $props();
	const sessions = $derived(
		data.sessions as { id: string; name: string; date: string; status: string }[]
	);

	const statusColor: Record<string, string> = {
		lobby: 'bg-zinc-700 text-zinc-300',
		active: 'bg-ayu-green/20 text-ayu-green',
		finished: 'bg-zinc-800 text-zinc-500'
	};

	function fmtDate(dateStr: string) {
		return new Date(dateStr + 'T12:00:00').toLocaleDateString('en-US', {
			weekday: 'short',
			month: 'short',
			day: 'numeric'
		});
	}

	let recalcState = $state<'idle' | 'running' | 'ok' | 'err'>('idle');

	async function recalculateElo() {
		recalcState = 'running';
		const {
			data: { session: authSession }
		} = await supabase.auth.getSession();
		if (!authSession?.access_token) {
			recalcState = 'err';
			return;
		}
		const res = await fetch('/api/recalculate-elo', {
			method: 'POST',
			headers: { Authorization: `Bearer ${authSession.access_token}` }
		});
		recalcState = res.ok ? 'ok' : 'err';
	}
</script>

<div class="space-y-6">
	<div class="flex flex-wrap items-start justify-between gap-3">
		<div>
			<h1 class="text-2xl font-bold text-white">Sessions</h1>
			<p class="mt-0.5 text-sm text-ayu-muted">Click a session to view or edit scores.</p>
		</div>
		<div class="flex flex-col items-end gap-1">
			<button
				onclick={recalculateElo}
				disabled={recalcState === 'running'}
				class="rounded-lg border border-ayu-border px-4 py-2 text-sm text-ayu-muted transition hover:border-zinc-500 hover:text-white disabled:opacity-50"
			>
				{recalcState === 'running' ? 'Recalculating…' : '⚡ Recalculate ELO'}
			</button>
			{#if recalcState === 'ok'}
				<p class="text-xs text-ayu-green">ELO updated.</p>
			{:else if recalcState === 'err'}
				<p class="text-xs text-ayu-red">Failed — check console.</p>
			{/if}
		</div>
	</div>

	{#if sessions.length === 0}
		<p class="text-ayu-muted">
			No sessions yet. Configure the <a href="/admin/schedule" class="text-ayu-gold hover:underline"
				>weekly schedule</a
			> and run the scheduler.
		</p>
	{:else}
		<div class="overflow-hidden rounded-xl border border-ayu-border">
			<table class="w-full text-sm">
				<thead>
					<tr
						class="border-b border-ayu-border bg-ayu-surface2 text-left text-xs font-semibold tracking-wider text-ayu-muted uppercase"
					>
						<th class="px-4 py-3">Session</th>
						<th class="px-4 py-3">Date</th>
						<th class="px-4 py-3">Status</th>
					</tr>
				</thead>
				<tbody>
					{#each sessions as s}
						<tr class="border-b border-ayu-border bg-ayu-surface last:border-0">
							<td class="px-4 py-3 font-medium text-white">
								<a href="/admin/sessions/{s.id}" class="transition hover:text-ayu-gold">{s.name}</a>
							</td>
							<td class="px-4 py-3 text-ayu-muted">{fmtDate(s.date)}</td>
							<td class="px-4 py-3">
								<span
									class="rounded-full px-2.5 py-0.5 text-xs font-medium {statusColor[s.status] ??
										''}"
								>
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
