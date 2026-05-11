<script lang="ts">
	import { goto } from '$app/navigation';
	import { supabase } from '$lib/supabase';

	let { data } = $props();
	const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

	let name = $state(data.schedule.name);
	let template = $state(data.schedule.session_name_template);
	let selectedDays = $state<number[]>([...(data.schedule.days_of_week as number[])]);
	let selectedGameIds = $state<string[]>([...(data.schedule.game_ids as string[])]);
	let specialGameId = $state<string | null>(data.schedule.special_game_id ?? null);
	let autoActivate = $state(data.schedule.auto_activate);
	let active = $state(data.schedule.active);
	let saving = $state(false);
	let confirmDelete = $state(false);
	let error = $state('');

	function toggleDay(d: number) {
		selectedDays = selectedDays.includes(d)
			? selectedDays.filter(x => x !== d)
			: [...selectedDays, d].sort((a, b) => a - b);
	}

	function toggleGame(id: string) {
		if (selectedGameIds.includes(id)) {
			selectedGameIds = selectedGameIds.filter(x => x !== id);
			if (specialGameId === id) specialGameId = null;
		} else {
			selectedGameIds = [...selectedGameIds, id];
		}
	}

	function moveGame(index: number, dir: -1 | 1) {
		const next = index + dir;
		if (next < 0 || next >= selectedGameIds.length) return;
		const arr = [...selectedGameIds];
		[arr[index], arr[next]] = [arr[next], arr[index]];
		selectedGameIds = arr;
	}

	async function save() {
		if (!name.trim()) { error = 'Name is required.'; return; }
		if (selectedDays.length === 0) { error = 'Select at least one day.'; return; }
		saving = true;
		error = '';
		const { error: e } = await supabase.from('schedules').update({
			name: name.trim(),
			days_of_week: selectedDays,
			game_ids: selectedGameIds,
			special_game_id: specialGameId,
			session_name_template: template.trim() || 'Game Night — {date}',
			auto_activate: autoActivate,
			active
		}).eq('id', data.schedule.id);
		saving = false;
		if (e) error = e.message;
		else goto('/admin/scheduler');
	}

	async function deleteSchedule() {
		saving = true;
		const { error: e } = await supabase.from('schedules').delete().eq('id', data.schedule.id);
		if (e) { error = e.message; saving = false; return; }
		goto('/admin/scheduler');
	}
</script>

<div class="max-w-lg space-y-6">
	<div>
		<a href="/admin/scheduler" class="mb-4 inline-flex items-center gap-1 text-sm text-ayu-muted hover:text-white">← Scheduler</a>
		<h1 class="text-2xl font-bold text-white">Edit Schedule</h1>
	</div>

	<div class="space-y-5 rounded-xl border border-ayu-border bg-ayu-surface p-5">
		<div>
			<label class="mb-1.5 block text-sm font-medium text-zinc-300" for="sname">Name</label>
			<input id="sname" bind:value={name} class="w-full rounded-lg border border-ayu-border bg-ayu-bg px-3 py-2 text-white placeholder-ayu-muted focus:border-ayu-gold focus:outline-none" />
		</div>

		<div>
			<label class="mb-1.5 block text-sm font-medium text-zinc-300" for="tmpl">Session name template</label>
			<input id="tmpl" bind:value={template} class="w-full rounded-lg border border-ayu-border bg-ayu-bg px-3 py-2 text-white placeholder-ayu-muted focus:border-ayu-gold focus:outline-none font-mono text-sm" />
			<p class="mt-1 text-xs text-ayu-muted"><code class="text-ayu-gold">{'{date}'}</code> → "Friday, May 3"</p>
		</div>

		<div>
			<p class="mb-2 text-sm font-medium text-zinc-300">Days of week</p>
			<div class="flex gap-2">
				{#each DAYS as day, i}
					<button
						onclick={() => toggleDay(i)}
						class="flex-1 rounded-lg border py-2 text-sm font-bold transition
							{selectedDays.includes(i)
								? 'border-ayu-gold bg-ayu-gold/20 text-ayu-gold'
								: 'border-ayu-border bg-ayu-surface2 text-ayu-muted hover:text-white'}"
					>
						{day}
					</button>
				{/each}
			</div>
		</div>

		<div>
			<p class="mb-2 text-sm font-medium text-zinc-300">Games <span class="text-ayu-muted font-normal">(check to include, arrows to reorder)</span></p>
			<div class="space-y-1.5">
				{#each data.games as g}
					<label class="flex cursor-pointer items-center gap-3 rounded-lg border border-ayu-border px-3 py-2 transition hover:border-ayu-gold/50 {selectedGameIds.includes(g.id) ? 'border-ayu-gold/40 bg-ayu-gold/5' : ''}">
						<input type="checkbox" checked={selectedGameIds.includes(g.id)} onchange={() => toggleGame(g.id)} class="accent-ayu-gold" />
						<span class="text-sm text-white">{g.icon_emoji ?? '🎮'} {g.name}</span>
					</label>
				{/each}
			</div>

			{#if selectedGameIds.length > 0}
				<div class="mt-3 space-y-1 rounded-lg border border-ayu-border bg-ayu-bg p-3">
					<p class="mb-2 text-xs text-ayu-muted">Session order · ★ to mark featured</p>
					{#each selectedGameIds as id, i}
						{@const g = data.games.find(x => x.id === id)}
						{#if g}
							<div class="flex items-center gap-2 text-sm {specialGameId === id ? 'text-ayu-gold' : 'text-white'}">
								<span class="w-5 text-center text-xs text-ayu-muted">{i + 1}</span>
								<span class="flex-1">{g.icon_emoji ?? '🎮'} {g.name}</span>
								<button
									onclick={() => specialGameId = specialGameId === id ? null : id}
									title="Mark as featured game"
									class="px-1 transition {specialGameId === id ? 'text-ayu-gold' : 'text-ayu-muted hover:text-ayu-gold'}"
								>{specialGameId === id ? '★' : '☆'}</button>
								<button onclick={() => moveGame(i, -1)} disabled={i === 0} class="px-1 text-ayu-muted hover:text-white disabled:opacity-30">↑</button>
								<button onclick={() => moveGame(i, 1)} disabled={i === selectedGameIds.length - 1} class="px-1 text-ayu-muted hover:text-white disabled:opacity-30">↓</button>
							</div>
						{/if}
					{/each}
				</div>
			{/if}
		</div>

		<div class="space-y-3">
			<label class="flex cursor-pointer items-center gap-3">
				<input type="checkbox" bind:checked={autoActivate} class="accent-ayu-gold h-4 w-4" />
				<span class="text-sm text-zinc-300">Auto-activate session immediately</span>
			</label>
			<label class="flex cursor-pointer items-center gap-3">
				<input type="checkbox" bind:checked={active} class="accent-ayu-gold h-4 w-4" />
				<span class="text-sm text-zinc-300">Schedule is active</span>
			</label>
		</div>
	</div>

	{#if error}
		<p class="text-sm text-ayu-red">{error}</p>
	{/if}

	<div class="flex gap-3">
		<button onclick={save} disabled={saving} class="rounded-lg bg-ayu-gold px-6 py-2.5 font-bold text-ayu-bg transition hover:brightness-110 disabled:opacity-50">
			{saving ? 'Saving…' : 'Save changes'}
		</button>
		<a href="/admin/scheduler" class="rounded-lg border border-ayu-border px-4 py-2.5 text-sm text-ayu-muted hover:text-white">Cancel</a>
	</div>

	<div class="rounded-xl border border-ayu-red/30 bg-ayu-surface p-5">
		<h2 class="mb-3 text-sm font-semibold uppercase tracking-wider text-ayu-red">Danger Zone</h2>
		{#if !confirmDelete}
			<button onclick={() => (confirmDelete = true)} class="rounded-lg border border-ayu-red/50 px-4 py-2 text-sm text-ayu-red transition hover:bg-ayu-red/10">
				Delete schedule
			</button>
		{:else}
			<div class="flex gap-2">
				<button onclick={deleteSchedule} class="rounded-lg bg-ayu-red px-4 py-2 text-sm font-bold text-white transition hover:brightness-110">Delete</button>
				<button onclick={() => (confirmDelete = false)} class="rounded-lg border border-ayu-border px-4 py-2 text-sm text-ayu-muted hover:text-white">Cancel</button>
			</div>
		{/if}
	</div>
</div>
