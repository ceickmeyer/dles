<script lang="ts">
	import { goto } from '$app/navigation';
	import { supabase } from '$lib/supabase';
	import type { Game } from '$lib/database.types';

	let { data } = $props();
	const games = $derived(data.games);

	// en-CA gives YYYY-MM-DD format; use NY timezone so late-night sessions get the right date
	const todayNY = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }).format(new Date());
	let name = $state('');
	let date = $state(todayNY);
	let expiresAt = $state('');
	let selectedGameIds = $state<string[]>([]);
	let saving = $state(false);
	let error = $state('');

	function toggleGame(id: string) {
		if (selectedGameIds.includes(id)) {
			selectedGameIds = selectedGameIds.filter((g) => g !== id);
		} else {
			selectedGameIds = [...selectedGameIds, id];
		}
	}

	async function create() {
		if (!name.trim()) { error = 'Name is required.'; return; }
		if (selectedGameIds.length === 0) { error = 'Select at least one game.'; return; }
		saving = true;
		error = '';
		try {
			const { data: session, error: e1 } = await supabase
				.from('sessions')
				.insert({ name: name.trim(), date, expires_at: expiresAt ? new Date(expiresAt).toISOString() : null })
				.select()
				.single();
			if (e1) throw e1;

			const sessionGames = selectedGameIds.map((game_id, i) => ({
				session_id: session.id,
				game_id,
				sort_order: i
			}));
			const { error: e2 } = await supabase.from('session_games').insert(sessionGames);
			if (e2) throw e2;

			goto(`/admin/sessions/${session.id}`);
		} catch (e: unknown) {
			error = e instanceof Error ? e.message : 'Failed to create session.';
			saving = false;
		}
	}
</script>

<div class="max-w-lg space-y-6">
	<div>
		<a href="/admin" class="mb-4 inline-flex items-center gap-1 text-sm text-zinc-400 hover:text-white">← Sessions</a>
		<h1 class="text-2xl font-bold text-white">New Session</h1>
	</div>

	<div class="space-y-4 rounded-xl border border-zinc-800 bg-zinc-900 p-5">
		<div>
			<label class="mb-1.5 block text-sm font-medium text-zinc-300" for="name">Session name</label>
			<input
				id="name"
				bind:value={name}
				placeholder="Friday Night — May 2"
				class="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-white placeholder-zinc-500 focus:border-amber-400 focus:outline-none"
			/>
		</div>
		<div class="grid grid-cols-2 gap-3">
			<div>
				<label class="mb-1.5 block text-sm font-medium text-zinc-300" for="date">Date</label>
				<input
					id="date"
					type="date"
					bind:value={date}
					class="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-white focus:border-amber-400 focus:outline-none"
				/>
			</div>
			<div>
				<label class="mb-1.5 block text-sm font-medium text-zinc-300" for="expires">Expires at <span class="text-zinc-500 font-normal">(optional)</span></label>
				<input
					id="expires"
					type="datetime-local"
					bind:value={expiresAt}
					class="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-white focus:border-amber-400 focus:outline-none"
				/>
			</div>
		</div>
	</div>

	<div class="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
		<h2 class="mb-3 font-semibold text-white">Games for tonight</h2>
		{#if games.length === 0}
			<p class="text-sm text-zinc-400">
				No games registered yet. <a href="/admin/games/new" class="text-amber-400 underline">Add one</a>.
			</p>
		{:else}
			<div class="space-y-2">
				{#each games as game}
					<label class="flex cursor-pointer items-center gap-3 rounded-lg p-2 transition hover:bg-zinc-800">
						<input
							type="checkbox"
							checked={selectedGameIds.includes(game.id)}
							onchange={() => toggleGame(game.id)}
							class="h-4 w-4 accent-amber-400"
						/>
						<span class="text-lg">{game.icon_emoji ?? '🎮'}</span>
						<span class="flex-1 text-sm text-white">{game.name}</span>
						<span class="text-xs text-zinc-500">
							{game.scoring_direction === 'lower_is_better' ? '↓ lower' : '↑ higher'}
						</span>
					</label>
				{/each}
			</div>
		{/if}
	</div>

	{#if error}
		<p class="text-sm text-red-400">{error}</p>
	{/if}

	<button
		onclick={create}
		disabled={saving}
		class="rounded-lg bg-amber-400 px-6 py-3 font-bold text-black transition hover:bg-amber-300 disabled:opacity-50"
	>
		{saving ? 'Creating…' : 'Create session'}
	</button>
</div>
