<script lang="ts">
	import { goto, invalidateAll } from '$app/navigation';
	import { supabase } from '$lib/supabase';
	import type { SessionStatus } from '$lib/database.types';

	let { data } = $props();
	let { session, scores, allGames } = $derived(data);

	const statusFlow: Record<SessionStatus, SessionStatus | null> = {
		lobby: 'active',
		active: 'finished',
		finished: null
	};
	const statusLabel: Record<SessionStatus, string> = {
		lobby: 'Start session (→ active)',
		active: 'Finish session (→ finished)',
		finished: 'Finished'
	};

	let updating = $state(false);
	let error = $state('');
	let addGameId = $state('');

	const sessionGameIds = $derived(new Set(session.session_games.map((sg: {game_id: string}) => sg.game_id)));
	const availableGames = $derived(allGames.filter((g) => !sessionGameIds.has(g.id)));

	async function advanceStatus() {
		const next = statusFlow[session.status];
		if (!next) return;
		updating = true;
		const { error: e } = await supabase.from('sessions').update({ status: next }).eq('id', session.id);
		if (e) error = e.message;
		else await invalidateAll();
		updating = false;
	}

	async function removeGame(sgId: string) {
		const { error: e } = await supabase.from('session_games').delete().eq('id', sgId);
		if (e) error = e.message;
		else await invalidateAll();
	}

	async function addGame() {
		if (!addGameId) return;
		const maxOrder = Math.max(0, ...session.session_games.map((sg: {sort_order: number}) => sg.sort_order));
		const { error: e } = await supabase.from('session_games').insert({
			session_id: session.id,
			game_id: addGameId,
			sort_order: maxOrder + 1
		});
		if (e) error = e.message;
		else { addGameId = ''; await invalidateAll(); }
	}

	async function deleteScore(scoreId: string) {
		const { error: e } = await supabase.from('scores').delete().eq('id', scoreId);
		if (e) error = e.message;
		else await invalidateAll();
	}
</script>

<div class="max-w-2xl space-y-6">
	<div>
		<a href="/admin" class="mb-4 inline-flex items-center gap-1 text-sm text-zinc-400 hover:text-white">← Sessions</a>
		<div class="flex items-center justify-between">
			<h1 class="text-2xl font-bold text-white">{session.name}</h1>
			<span class="text-sm text-zinc-400">
				{new Date(session.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
			</span>
		</div>
	</div>

	<!-- Status control -->
	<div class="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
		<div class="flex items-center justify-between">
			<div>
				<p class="text-sm text-zinc-400">Status</p>
				<p class="font-semibold text-white capitalize">{session.status}</p>
			</div>
			{#if statusFlow[session.status]}
				<button
					onclick={advanceStatus}
					disabled={updating}
					class="rounded-lg bg-amber-400 px-4 py-2 font-bold text-black transition hover:bg-amber-300 disabled:opacity-50"
				>
					{statusLabel[session.status]}
				</button>
			{/if}
		</div>
		<div class="mt-3 flex gap-3 text-sm">
			<a href="/" class="text-zinc-400 hover:text-white underline">View lobby</a>
			<a href="/session/{session.id}" class="text-zinc-400 hover:text-white underline">View recap</a>
		</div>
	</div>

	<!-- Games -->
	<div class="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
		<h2 class="mb-3 font-semibold text-white">Games</h2>
		{#if session.session_games.length === 0}
			<p class="text-sm text-zinc-500">No games added yet.</p>
		{:else}
			<div class="space-y-2 mb-4">
				{#each session.session_games as sg}
					<div class="flex items-center justify-between rounded-lg bg-zinc-800 px-3 py-2">
						<span class="text-sm text-white">
							{sg.game.icon_emoji ?? '🎮'} {sg.game.name}
						</span>
						<button
							onclick={() => removeGame(sg.id)}
							class="text-xs text-zinc-500 hover:text-red-400"
						>
							Remove
						</button>
					</div>
				{/each}
			</div>
		{/if}

		{#if availableGames.length > 0}
			<div class="flex gap-2">
				<select
					bind:value={addGameId}
					class="flex-1 rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white focus:border-amber-400 focus:outline-none"
				>
					<option value="">Add a game…</option>
					{#each availableGames as g}
						<option value={g.id}>{g.icon_emoji ?? '🎮'} {g.name}</option>
					{/each}
				</select>
				<button
					onclick={addGame}
					disabled={!addGameId}
					class="rounded-lg bg-zinc-700 px-3 py-2 text-sm font-medium text-white hover:bg-zinc-600 disabled:opacity-50"
				>
					Add
				</button>
			</div>
		{/if}
	</div>

	<!-- Live scores -->
	<div class="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
		<h2 class="mb-3 font-semibold text-white">Scores ({scores.length})</h2>
		{#if scores.length === 0}
			<p class="text-sm text-zinc-500">No scores yet.</p>
		{:else}
			<div class="space-y-1 text-sm">
				{#each scores as score}
					<div class="flex items-center justify-between rounded-lg bg-zinc-800 px-3 py-2">
						<span class="text-zinc-300">
							{(score.player as {name:string}).name} —
							{session.session_games.find((sg: {game_id: string}) => sg.game_id === score.game_id)?.game?.name ?? score.game_id}:
							<strong class="text-white">{score.raw_score}</strong>
						</span>
						<button onclick={() => deleteScore(score.id)} class="text-xs text-zinc-500 hover:text-red-400">
							Delete
						</button>
					</div>
				{/each}
			</div>
		{/if}
	</div>

	{#if error}
		<p class="text-sm text-red-400">{error}</p>
	{/if}
</div>
