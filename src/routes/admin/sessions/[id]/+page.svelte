<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { supabase } from '$lib/supabase';
	import { displayName, formatScore } from '$lib/utils';

	let { data } = $props();
	const session = $derived(data.session as { id: string; name: string; date: string; status: string });
	const gameGroups = $derived(data.gameGroups as {
		game: { id: string; name: string; icon_emoji: string | null; scoring_direction: string; max_score: number | null; allow_dnf: boolean; share_parser: string | null };
		scores: { id: string; raw_score: number; share_text: string | null; submitted_at: string; player: { id: string; name: string; alias: string | null } }[];
	}[]);

	const availableGames = $derived(data.availableGames as { id: string; name: string; icon_emoji: string | null }[]);

	let confirmDeleteId = $state<string | null>(null);
	let addGameId = $state('');
	let addingGame = $state(false);

	async function addGame() {
		if (!addGameId) return;
		addingGame = true;
		globalError = '';
		const { error: e } = await supabase.from('session_games').insert({
			session_id: session.id,
			game_id: addGameId,
			sort_order: data.nextSortOrder,
			is_special: false,
		});
		addingGame = false;
		if (e) { globalError = e.message; return; }
		addGameId = '';
		await invalidateAll();
	}
	let deleting = $state(false);
	let confirmRemoveGameId = $state<string | null>(null);
	let removingGame = $state(false);
	let globalError = $state('');

	// Manual score edits bypass the scheduler's finish-session hook, so the
	// cached ELO table can drift — recalculate it whenever a finished session's scores change.
	function recalculateEloIfFinished() {
		if (session.status === 'finished') fetch('/api/recalculate-elo', { method: 'POST' });
	}

	async function removeGame(gameId: string) {
		removingGame = true;
		globalError = '';
		// Delete scores for this game in this session first
		const { error: e1 } = await supabase.from('scores').delete()
			.eq('session_id', session.id).eq('game_id', gameId);
		if (e1) { globalError = e1.message; removingGame = false; return; }
		// Remove from lineup
		const { error: e2 } = await supabase.from('session_games').delete()
			.eq('session_id', session.id).eq('game_id', gameId);
		removingGame = false;
		if (e2) { globalError = e2.message; return; }
		confirmRemoveGameId = null;
		recalculateEloIfFinished();
		await invalidateAll();
	}

	function fmtDate(dateStr: string) {
		return new Date(dateStr + 'T12:00:00').toLocaleDateString('en-US', {
			weekday: 'long', month: 'long', day: 'numeric'
		});
	}

	function fmtTime(iso: string) {
		return new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
	}

	function scoreLabel(score: { raw_score: number }, game: { max_score: number | null; allow_dnf: boolean; share_parser: string | null }) {
		return formatScore(score.raw_score, game);
	}

	async function deleteScore(id: string) {
		deleting = true;
		globalError = '';
		const { error: e } = await supabase.from('scores').delete().eq('id', id);
		deleting = false;
		if (e) { globalError = e.message; return; }
		confirmDeleteId = null;
		recalculateEloIfFinished();
		await invalidateAll();
	}

	const totalScores = $derived(gameGroups.reduce((n, g) => n + g.scores.length, 0));
</script>

<div class="space-y-6">
	<div class="flex items-center justify-between">
		<div>
			<div class="flex items-center gap-2 text-sm text-ayu-muted mb-1">
				<a href="/admin" class="hover:text-zinc-300 transition">Dashboard</a>
				<span>/</span>
				<span>Scores</span>
			</div>
			<h1 class="text-2xl font-bold text-white">{session.name}</h1>
			<p class="mt-0.5 text-sm text-ayu-muted">{fmtDate(session.date)} · {totalScores} score{totalScores === 1 ? '' : 's'}</p>
		</div>
		<span class="rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wider {
			session.status === 'active' ? 'bg-ayu-green/20 text-ayu-green' :
			session.status === 'finished' ? 'bg-zinc-800 text-zinc-500' :
			'bg-zinc-700 text-zinc-300'
		}">
			{session.status}
		</span>
	</div>

	{#if globalError}
		<p class="text-sm text-ayu-red">{globalError}</p>
	{/if}

	{#if availableGames.length > 0}
		<div class="flex items-center gap-2">
			<select
				bind:value={addGameId}
				class="flex-1 rounded-lg border border-ayu-border bg-ayu-surface px-3 py-2 text-sm text-white focus:border-ayu-gold focus:outline-none"
			>
				<option value="">Add a game to this session…</option>
				{#each availableGames as g}
					<option value={g.id}>{g.icon_emoji ?? '🎮'} {g.name}</option>
				{/each}
			</select>
			<button
				onclick={addGame}
				disabled={!addGameId || addingGame}
				class="rounded-lg bg-ayu-gold px-4 py-2 text-sm font-bold text-ayu-bg transition hover:brightness-110 disabled:opacity-50"
			>
				{addingGame ? '…' : 'Add'}
			</button>
		</div>
	{/if}

	{#if gameGroups.length === 0}
		<p class="text-ayu-muted">No scores submitted yet.</p>
	{:else}
		<div class="space-y-4">
			{#each gameGroups as { game, scores }}
				<div class="overflow-hidden rounded-xl border border-ayu-border">
					<div class="flex items-center gap-2 border-b border-ayu-border bg-ayu-surface2 px-4 py-2.5">
						{#if game.icon_emoji}<span>{game.icon_emoji}</span>{/if}
						<span class="font-semibold text-white text-sm">{game.name}</span>
						<span class="text-xs text-ayu-muted">{scores.length} submission{scores.length === 1 ? '' : 's'}</span>
						<div class="ml-auto flex items-center gap-3">
							{#if confirmRemoveGameId === game.id}
								<span class="text-xs text-zinc-400">
									Remove game{scores.length > 0 ? ` + delete ${scores.length} score${scores.length === 1 ? '' : 's'}` : ''}?
								</span>
								<button
									onclick={() => removeGame(game.id)}
									disabled={removingGame}
									class="text-xs font-semibold text-ayu-red hover:brightness-125 disabled:opacity-50"
								>
									{removingGame ? '…' : 'Yes, remove'}
								</button>
								<button
									onclick={() => (confirmRemoveGameId = null)}
									class="text-xs text-ayu-muted hover:text-white"
								>
									Cancel
								</button>
							{:else}
								<button
									onclick={() => (confirmRemoveGameId = game.id)}
									class="text-xs text-ayu-muted transition hover:text-ayu-red"
								>
									Remove from lineup
								</button>
							{/if}
						</div>
					</div>
					{#if scores.length === 0}
						<p class="px-4 py-3 text-xs text-ayu-muted">No scores yet.</p>
					{:else}
						<table class="w-full text-sm">
							<thead>
								<tr class="border-b border-ayu-border text-left text-xs font-semibold uppercase tracking-wider text-ayu-muted">
									<th class="px-4 py-2">Player</th>
									<th class="px-4 py-2">Score</th>
									<th class="px-4 py-2 hidden sm:table-cell">Submitted</th>
									<th class="px-4 py-2 hidden md:table-cell">Share text</th>
									<th class="px-4 py-2"></th>
								</tr>
							</thead>
							<tbody>
								{#each scores as score}
									<tr class="border-b border-ayu-border bg-ayu-surface last:border-0">
										<td class="px-4 py-2.5 font-medium text-white">
											<a href="/player/{score.player.id}" class="hover:text-ayu-gold transition">
												{displayName(score.player)}
											</a>
											{#if score.player.alias}
												<span class="ml-1 text-xs text-ayu-muted">({score.player.name})</span>
											{/if}
										</td>
										<td class="px-4 py-2.5 font-mono text-ayu-gold">
											{scoreLabel(score, game)}
										</td>
										<td class="px-4 py-2.5 text-xs text-ayu-muted hidden sm:table-cell">
											{fmtTime(score.submitted_at)}
										</td>
										<td class="px-4 py-2.5 text-xs text-ayu-muted hidden md:table-cell max-w-xs truncate">
											{score.share_text ?? '—'}
										</td>
										<td class="px-4 py-2.5 text-right whitespace-nowrap">
											{#if confirmDeleteId === score.id}
												<span class="text-xs text-zinc-400">Delete score?</span>
												<button
													onclick={() => deleteScore(score.id)}
													disabled={deleting}
													class="ml-2 text-xs font-semibold text-ayu-red hover:brightness-125 disabled:opacity-50"
												>
													{deleting ? '…' : 'Yes'}
												</button>
												<button
													onclick={() => (confirmDeleteId = null)}
													class="ml-2 text-xs text-ayu-muted hover:text-white"
												>
													No
												</button>
											{:else}
												<button
													onclick={() => (confirmDeleteId = score.id)}
													class="text-xs text-ayu-muted transition hover:text-ayu-red"
												>
													Delete
												</button>
											{/if}
										</td>
									</tr>
								{/each}
							</tbody>
						</table>
					{/if}
				</div>
			{/each}
		</div>
	{/if}
</div>
