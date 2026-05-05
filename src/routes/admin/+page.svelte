<script lang="ts">
	import { onMount } from 'svelte';
	import { invalidateAll } from '$app/navigation';
	import { supabase } from '$lib/supabase';
	import { runScheduler } from '$lib/scheduler';

	let { data } = $props();
	const sessions = $derived(data.sessions);
	let schedulerMsg = $state('');

	onMount(async () => {
		const result = await runScheduler(supabase);
		const parts: string[] = [];
		if (result.finished) parts.push(`✓ Finished ${result.finished} stale session${result.finished > 1 ? 's' : ''}`);
		if (result.created) parts.push(`📅 Auto-created "${result.sessionName}"`);
		if (parts.length) {
			schedulerMsg = parts.join(' · ');
			await invalidateAll();
		}
	});

	const statusColor: Record<string, string> = {
		lobby: 'bg-zinc-700 text-zinc-300',
		active: 'bg-green-900 text-green-400',
		finished: 'bg-zinc-800 text-zinc-500'
	};
</script>

<div class="space-y-6">
	{#if schedulerMsg}
		<div class="rounded-lg border border-ayu-green/40 bg-ayu-green/10 px-4 py-2.5 text-sm text-ayu-green">
			{schedulerMsg}
		</div>
	{/if}

	<div class="flex items-center justify-between">
		<h1 class="text-2xl font-bold text-white">Sessions</h1>
		<a
			href="/admin/sessions/new"
			class="rounded-lg bg-amber-400 px-4 py-2 font-bold text-black transition hover:bg-amber-300"
		>
			+ New Session
		</a>
	</div>

	{#if sessions.length === 0}
		<p class="text-zinc-400">No sessions yet — create one to get started.</p>
	{:else}
		<div class="space-y-2">
			{#each sessions as s}
				<a
					href="/admin/sessions/{s.id}"
					class="flex items-center justify-between rounded-xl border border-zinc-800 bg-zinc-900 px-5 py-4 transition hover:border-zinc-600"
				>
					<div>
						<p class="font-semibold text-white">{s.name}</p>
						<p class="text-sm text-zinc-400">{new Date(s.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}</p>
					</div>
					<div class="flex items-center gap-3">
						<span class="rounded-full px-2.5 py-0.5 text-xs font-medium {statusColor[s.status] ?? ''}">
							{s.status}
						</span>
						<svg class="h-4 w-4 text-zinc-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
						</svg>
					</div>
				</a>
			{/each}
		</div>
	{/if}
</div>
