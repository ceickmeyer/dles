<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { goto, invalidateAll } from '$app/navigation';
	import { supabase } from '$lib/supabase';
	import { displayName } from '$lib/utils';
	import type { SessionStatus } from '$lib/database.types';

	let { data } = $props();
	let { session, scores, allGames } = $derived(data);

	let saving = $state(false);
	let error = $state('');
	let addGameId = $state('');
	let confirmDelete = $state(false);
	let expiresAt = $state(
		session.expires_at ? new Date(session.expires_at).toISOString().slice(0, 16) : ''
	);

	const sessionGameIds = $derived(new Set(session.session_games.map((sg: { game_id: string }) => sg.game_id)));
	const availableGames = $derived(allGames.filter((g) => !sessionGameIds.has(g.id)));

	// Submission matrix: unique players who have any score in this session
	const participants = $derived(() => {
		const map = new Map<string, { id: string; name: string; alias: string | null }>();
		for (const s of scores) {
			if (!map.has(s.player_id)) {
				const p = s.player as { name: string; alias?: string | null };
				map.set(s.player_id, { id: s.player_id, name: p.name, alias: p.alias ?? null });
			}
		}
		return [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
	});

	const submittedSet = $derived(new Set(scores.map((s) => `${s.player_id}:${s.game_id}`)));

	// Status machine
	const statusActions = $derived((() => {
		const s = session.status;
		const acts: { label: string; next: SessionStatus; style: string }[] = [];
		if (s === 'lobby')    acts.push({ label: '▶ Start session',  next: 'active',   style: 'bg-ayu-green text-ayu-bg' });
		if (s === 'active')   acts.push({ label: '⏸ Pause',          next: 'paused',   style: 'bg-ayu-surface2 text-zinc-300 border border-ayu-border' });
		if (s === 'active')   acts.push({ label: '✓ Finish',          next: 'finished', style: 'bg-ayu-surface2 text-zinc-300 border border-ayu-border' });
		if (s === 'paused')   acts.push({ label: '▶ Resume',          next: 'active',   style: 'bg-ayu-green text-ayu-bg' });
		if (s === 'paused')   acts.push({ label: '✓ Finish',          next: 'finished', style: 'bg-ayu-surface2 text-zinc-300 border border-ayu-border' });
		if (s === 'finished') acts.push({ label: '↩ Reopen (lobby)', next: 'lobby',    style: 'bg-ayu-surface2 text-zinc-300 border border-ayu-border' });
		return acts;
	})());

	const statusBadge: Record<SessionStatus, string> = {
		lobby:    'bg-ayu-surface2 text-zinc-400',
		active:   'bg-ayu-green text-ayu-bg',
		paused:   'bg-amber-700 text-white',
		finished: 'bg-ayu-surface2 text-zinc-500'
	};

	async function setStatus(next: SessionStatus) {
		saving = true; error = '';
		const { error: e } = await supabase.from('sessions').update({ status: next }).eq('id', session.id);
		if (e) error = e.message;
		else await invalidateAll();
		saving = false;
	}

	async function toggleScoresHidden() {
		saving = true; error = '';
		const { error: e } = await supabase
			.from('sessions')
			.update({ scores_hidden: !session.scores_hidden })
			.eq('id', session.id);
		if (e) error = e.message;
		else await invalidateAll();
		saving = false;
	}

	async function saveExpiry() {
		saving = true; error = '';
		const val = expiresAt ? new Date(expiresAt).toISOString() : null;
		const { error: e } = await supabase.from('sessions').update({ expires_at: val }).eq('id', session.id);
		if (e) error = e.message;
		else await invalidateAll();
		saving = false;
	}

	async function deleteSession() {
		saving = true;
		const { error: e } = await supabase.from('sessions').delete().eq('id', session.id);
		if (e) { error = e.message; saving = false; return; }
		goto('/admin');
	}

	async function removeGame(sgId: string) {
		const { error: e } = await supabase.from('session_games').delete().eq('id', sgId);
		if (e) error = e.message;
		else await invalidateAll();
	}

	async function addGame() {
		if (!addGameId) return;
		const maxOrder = Math.max(0, ...session.session_games.map((sg: { sort_order: number }) => sg.sort_order));
		const { error: e } = await supabase.from('session_games').insert({
			session_id: session.id, game_id: addGameId, sort_order: maxOrder + 1
		});
		if (e) error = e.message;
		else { addGameId = ''; await invalidateAll(); }
	}

	async function deleteScore(scoreId: string) {
		const { error: e } = await supabase.from('scores').delete().eq('id', scoreId);
		if (e) error = e.message;
		else await invalidateAll();
	}

	// Live updates when players submit scores
	let subscription: ReturnType<typeof supabase.channel> | null = null;
	onMount(() => {
		subscription = supabase
			.channel(`admin:scores:${session.id}`)
			.on('postgres_changes', { event: '*', schema: 'public', table: 'scores', filter: `session_id=eq.${session.id}` }, () => invalidateAll())
			.subscribe();
	});
	onDestroy(() => { subscription?.unsubscribe(); });
</script>

<div class="max-w-2xl space-y-6">
	<!-- Header -->
	<div>
		<a href="/admin" class="mb-3 inline-flex items-center gap-1 text-sm text-ayu-muted hover:text-white">← Sessions</a>
		<div class="flex items-start justify-between gap-4">
			<div>
				<h1 class="text-2xl font-bold text-white">{session.name}</h1>
				<p class="mt-0.5 text-sm text-ayu-muted">
					{new Date(session.date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
				</p>
			</div>
			<span class="mt-1 rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wider {statusBadge[session.status]}">
				{session.status}
			</span>
		</div>
	</div>

	<!-- Status controls -->
	<div class="rounded-xl border border-ayu-border bg-ayu-surface p-5">
		<h2 class="mb-3 text-sm font-semibold uppercase tracking-wider text-ayu-muted">Status</h2>
		<div class="flex flex-wrap gap-2 mb-4">
			{#each statusActions as act}
				<button
					onclick={() => setStatus(act.next)}
					disabled={saving}
					class="rounded-lg px-4 py-2 text-sm font-semibold transition hover:brightness-110 disabled:opacity-50 {act.style}"
				>
					{act.label}
				</button>
			{/each}
		</div>
		<div class="flex gap-3 text-sm">
			<a href="/" class="text-ayu-muted underline hover:text-white">View lobby ↗</a>
			<a href="/session/{session.id}" class="text-ayu-muted underline hover:text-white">View recap ↗</a>
		</div>
	</div>

	<!-- Scores visibility -->
	<div class="rounded-xl border border-ayu-border bg-ayu-surface p-5">
		<h2 class="mb-1 text-sm font-semibold uppercase tracking-wider text-ayu-muted">Score Visibility</h2>
		<p class="mb-3 text-xs text-ayu-muted">
			{session.scores_hidden
				? 'Scores are hidden from players. Click Reveal to show them.'
				: 'Scores are visible to all players in real time.'}
		</p>
		<button
			onclick={toggleScoresHidden}
			disabled={saving}
			class="rounded-lg px-4 py-2 text-sm font-semibold transition hover:brightness-110 disabled:opacity-50
				{session.scores_hidden
					? 'bg-ayu-gold text-ayu-bg'
					: 'bg-ayu-surface2 text-zinc-300 border border-ayu-border'}"
		>
			{session.scores_hidden ? '🎉 Reveal scores' : '🙈 Hide scores'}
		</button>
	</div>

	<!-- Submission status matrix -->
	{#if participants().length > 0}
		<div class="rounded-xl border border-ayu-border bg-ayu-surface p-5">
			<h2 class="mb-3 text-sm font-semibold uppercase tracking-wider text-ayu-muted">
				Who's Submitted
				<span class="ml-2 font-normal text-ayu-muted normal-case tracking-normal">
					({scores.length} of {participants().length * session.session_games.length} possible)
				</span>
			</h2>
			<div class="overflow-x-auto">
				<table class="w-full text-sm">
					<thead>
						<tr class="border-b border-ayu-border text-xs text-ayu-muted">
							<th class="pb-2 pr-4 text-left font-medium">Player</th>
							{#each session.session_games as sg}
								<th class="pb-2 px-2 text-center font-medium">{sg.game.icon_emoji ?? '🎮'}</th>
							{/each}
						</tr>
					</thead>
					<tbody>
						{#each participants() as p}
							<tr class="border-b border-ayu-border/50 last:border-0">
								<td class="py-2 pr-4 text-white">{displayName(p)}</td>
								{#each session.session_games as sg}
									{@const done = submittedSet.has(`${p.id}:${sg.game_id}`)}
									<td class="py-2 px-2 text-center text-base">
										{#if done}
											<span class="text-ayu-green">✓</span>
										{:else}
											<span class="text-ayu-border">·</span>
										{/if}
									</td>
								{/each}
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		</div>
	{/if}

	<!-- Expiration -->
	<div class="rounded-xl border border-ayu-border bg-ayu-surface p-5">
		<h2 class="mb-3 text-sm font-semibold uppercase tracking-wider text-ayu-muted">Expiration</h2>
		<p class="mb-3 text-xs text-ayu-muted">Session auto-hides from the lobby after this time. Leave blank for no expiry.</p>
		<div class="flex gap-2 items-end">
			<div class="flex-1">
				<label for="expires" class="mb-1 block text-xs text-zinc-400">Expires at</label>
				<input
					id="expires"
					type="datetime-local"
					bind:value={expiresAt}
					class="w-full rounded-lg border border-ayu-border bg-ayu-bg px-3 py-2 text-sm text-white focus:border-ayu-gold focus:outline-none"
				/>
			</div>
			<button
				onclick={saveExpiry}
				disabled={saving}
				class="rounded-lg bg-ayu-gold px-4 py-2 text-sm font-bold text-ayu-bg hover:brightness-110 disabled:opacity-50"
			>Save</button>
			{#if expiresAt}
				<button
					onclick={() => { expiresAt = ''; saveExpiry(); }}
					class="rounded-lg border border-ayu-border px-3 py-2 text-sm text-ayu-muted hover:text-white"
				>Clear</button>
			{/if}
		</div>
	</div>

	<!-- Games -->
	<div class="rounded-xl border border-ayu-border bg-ayu-surface p-5">
		<h2 class="mb-3 text-sm font-semibold uppercase tracking-wider text-ayu-muted">Games ({session.session_games.length})</h2>
		{#if session.session_games.length > 0}
			<div class="space-y-1 mb-4">
				{#each session.session_games as sg}
					<div class="flex items-center justify-between rounded-lg bg-ayu-surface2 px-3 py-2">
						<span class="text-sm text-white">{sg.game.icon_emoji ?? '🎮'} {sg.game.name}</span>
						<button onclick={() => removeGame(sg.id)} class="text-xs text-ayu-muted hover:text-ayu-red transition">Remove</button>
					</div>
				{/each}
			</div>
		{/if}
		{#if availableGames.length > 0}
			<div class="flex gap-2">
				<select
					bind:value={addGameId}
					class="flex-1 rounded-lg border border-ayu-border bg-ayu-bg px-3 py-2 text-sm text-white focus:border-ayu-gold focus:outline-none"
				>
					<option value="">Add a game…</option>
					{#each availableGames as g}
						<option value={g.id}>{g.icon_emoji ?? '🎮'} {g.name}</option>
					{/each}
				</select>
				<button onclick={addGame} disabled={!addGameId} class="rounded-lg bg-ayu-surface2 px-3 py-2 text-sm text-white hover:bg-ayu-border disabled:opacity-40">Add</button>
			</div>
		{/if}
	</div>

	<!-- Scores -->
	<div class="rounded-xl border border-ayu-border bg-ayu-surface p-5">
		<h2 class="mb-3 text-sm font-semibold uppercase tracking-wider text-ayu-muted">Scores ({scores.length})</h2>
		{#if scores.length === 0}
			<p class="text-sm text-ayu-muted">No scores yet.</p>
		{:else}
			<div class="space-y-1 text-sm max-h-64 overflow-y-auto">
				{#each scores as score}
					<div class="flex items-center justify-between rounded-lg bg-ayu-surface2 px-3 py-2">
						<span class="text-zinc-300">
							<span class="font-medium text-white">
								{displayName(score.player as { name: string; alias?: string | null })}
							</span>
							<span class="text-ayu-muted mx-1">·</span>
							{session.session_games.find((sg: { game_id: string; game: { name: string } }) => sg.game_id === score.game_id)?.game?.name ?? '?'}
							<span class="text-ayu-muted mx-1">·</span>
							<span class="font-mono text-ayu-gold">{score.raw_score}</span>
						</span>
						<button onclick={() => deleteScore(score.id)} class="text-xs text-ayu-muted hover:text-ayu-red transition">Delete</button>
					</div>
				{/each}
			</div>
		{/if}
	</div>

	{#if error}
		<p class="text-sm text-ayu-red">{error}</p>
	{/if}

	<!-- Danger zone -->
	<div class="rounded-xl border border-ayu-red/30 bg-ayu-surface p-5">
		<h2 class="mb-3 text-sm font-semibold uppercase tracking-wider text-ayu-red">Danger Zone</h2>
		{#if !confirmDelete}
			<button
				onclick={() => (confirmDelete = true)}
				class="rounded-lg border border-ayu-red/50 px-4 py-2 text-sm text-ayu-red hover:bg-ayu-red/10 transition"
			>
				Delete session
			</button>
		{:else}
			<p class="mb-3 text-sm text-zinc-300">This will delete all scores for this session too. Are you sure?</p>
			<div class="flex gap-2">
				<button
					onclick={deleteSession}
					disabled={saving}
					class="rounded-lg bg-ayu-red px-4 py-2 text-sm font-bold text-white hover:brightness-110 disabled:opacity-50"
				>
					Yes, delete forever
				</button>
				<button onclick={() => (confirmDelete = false)} class="rounded-lg border border-ayu-border px-4 py-2 text-sm text-ayu-muted hover:text-white">
					Cancel
				</button>
			</div>
		{/if}
	</div>
</div>
