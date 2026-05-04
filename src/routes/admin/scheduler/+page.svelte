<script lang="ts">
	import { supabase } from '$lib/supabase';
	import { invalidateAll } from '$app/navigation';

	let { data } = $props();

	const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

	async function toggleActive(id: string, current: boolean) {
		await supabase.from('schedules').update({ active: !current }).eq('id', id);
		await invalidateAll();
	}

	async function deleteSchedule(id: string) {
		await supabase.from('schedules').delete().eq('id', id);
		await invalidateAll();
	}
</script>

<div class="space-y-6">
	<div class="flex items-center justify-between">
		<div>
			<h1 class="text-2xl font-bold text-white">Scheduler</h1>
			<p class="mt-0.5 text-sm text-ayu-muted">Sessions are auto-created on matching days when you open admin.</p>
		</div>
		<a href="/admin/scheduler/new" class="rounded-lg bg-ayu-gold px-4 py-2 font-bold text-ayu-bg transition hover:brightness-110">
			+ New Schedule
		</a>
	</div>

	{#if data.schedules.length === 0}
		<div class="rounded-xl border border-ayu-border bg-ayu-surface px-6 py-12 text-center">
			<p class="text-ayu-muted">No schedules yet. Create one to auto-generate sessions each week.</p>
		</div>
	{:else}
		<div class="space-y-3">
			{#each data.schedules as s}
				<div class="rounded-xl border {s.active ? 'border-ayu-border' : 'border-ayu-border/50 opacity-60'} bg-ayu-surface p-5">
					<div class="flex items-start justify-between gap-4">
						<div class="min-w-0 flex-1 space-y-2">
							<div class="flex items-center gap-3">
								<p class="font-semibold text-white">{s.name}</p>
								{#if s.auto_activate}
									<span class="rounded-full bg-ayu-green/20 px-2 py-0.5 text-xs text-ayu-green">Auto-activate</span>
								{/if}
								{#if !s.active}
									<span class="rounded-full bg-ayu-surface2 px-2 py-0.5 text-xs text-ayu-muted">Disabled</span>
								{/if}
							</div>

							<!-- Days -->
							<div class="flex gap-1">
								{#each DAYS as day, i}
									<span class="rounded px-2 py-0.5 text-xs font-medium {(s.days_of_week as number[]).includes(i) ? 'bg-ayu-gold/20 text-ayu-gold' : 'bg-ayu-surface2 text-ayu-muted'}">
										{day}
									</span>
								{/each}
							</div>

							<!-- Games -->
							<div class="flex flex-wrap gap-1.5">
								{#each s.games as g}
									<span class="text-sm text-zinc-300">{g.icon_emoji ?? '🎮'} {g.name}</span>
									<span class="text-ayu-muted">·</span>
								{/each}
							</div>

							<p class="text-xs text-ayu-muted font-mono">"{s.session_name_template}"</p>
						</div>

						<div class="flex shrink-0 gap-2">
							<button
								onclick={() => toggleActive(s.id, s.active)}
								class="rounded-lg border border-ayu-border px-3 py-1.5 text-xs text-ayu-muted transition hover:text-white"
							>
								{s.active ? 'Disable' : 'Enable'}
							</button>
							<a href="/admin/scheduler/{s.id}" class="rounded-lg border border-ayu-border px-3 py-1.5 text-xs text-ayu-muted transition hover:text-white">
								Edit
							</a>
						</div>
					</div>
				</div>
			{/each}
		</div>
	{/if}
</div>
