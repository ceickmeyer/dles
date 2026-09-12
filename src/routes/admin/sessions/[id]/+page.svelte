<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { supabase } from '$lib/supabase';
	import { displayName, formatScore } from '$lib/utils';

	let { data } = $props();
	const session = $derived(
		data.session as { id: string; name: string; date: string; status: string }
	);
	const gameGroups = $derived(
		data.gameGroups as {
			game: {
				id: string;
				name: string;
				icon_emoji: string | null;
				scoring_direction: string;
				max_score: number | null;
				allow_dnf: boolean;
				share_parser: string | null;
			};
			scores: {
				id: string;
				raw_score: number;
				share_text: string | null;
				submitted_at: string;
				player: { id: string; name: string; alias: string | null };
			}[];
			isSpecial: boolean;
		}[]
	);

	const availableGames = $derived(
		data.availableGames as { id: string; name: string; icon_emoji: string | null }[]
	);

	const tally = $derived(
		data.tally as {
			player_id: string;
			player_name: string;
			gold: number;
			silver: number;
			bronze: number;
			total: number;
		}[]
	);

	const summary = $derived(
		data.summary as { gamesPlayed: number; totalScores: number; playerCount: number }
	);

	const eloBreakdown = $derived(
		data.eloBreakdown as {
			player_id: string;
			name: string;
			before: number;
			after: number;
			delta: number;
			games: {
				game_id: string;
				name: string;
				emoji: string;
				delta: number;
				matchups: {
					opponentId: string;
					opponentName: string;
					result: 'won' | 'lost' | 'tied';
					ratingSelf: number;
					ratingOpp: number;
					winProb: number;
					delta: number;
				}[];
			}[];
		}[]
	);

	const maxAbsDelta = $derived(
		Math.max(1, ...eloBreakdown.map((r) => Math.abs(r.delta)), 1)
	);

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
			is_special: false
		});
		addingGame = false;
		if (e) {
			globalError = e.message;
			return;
		}
		addGameId = '';
		await invalidateAll();
	}
	let deleting = $state(false);
	let confirmRemoveGameId = $state<string | null>(null);
	let removingGame = $state(false);
	let globalError = $state('');

	// Manual score edits bypass the scheduler's finish-session hook, so the
	// cached ELO table can drift — recalculate it whenever a finished session's scores change.
	async function recalculateEloIfFinished() {
		if (session.status !== 'finished') return;
		const {
			data: { session: authSession }
		} = await supabase.auth.getSession();
		if (!authSession?.access_token) return;
		fetch('/api/recalculate-elo', {
			method: 'POST',
			headers: { Authorization: `Bearer ${authSession.access_token}` }
		});
	}

	async function removeGame(gameId: string) {
		removingGame = true;
		globalError = '';
		// Delete scores for this game in this session first
		const { error: e1 } = await supabase
			.from('scores')
			.delete()
			.eq('session_id', session.id)
			.eq('game_id', gameId);
		if (e1) {
			globalError = e1.message;
			removingGame = false;
			return;
		}
		// Remove from lineup
		const { error: e2 } = await supabase
			.from('session_games')
			.delete()
			.eq('session_id', session.id)
			.eq('game_id', gameId);
		removingGame = false;
		if (e2) {
			globalError = e2.message;
			return;
		}
		confirmRemoveGameId = null;
		recalculateEloIfFinished();
		await invalidateAll();
	}

	function fmtDate(dateStr: string) {
		return new Date(dateStr + 'T12:00:00').toLocaleDateString('en-US', {
			weekday: 'long',
			month: 'long',
			day: 'numeric'
		});
	}

	function fmtTime(iso: string) {
		return new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
	}

	function scoreLabel(
		score: { raw_score: number },
		game: { max_score: number | null; allow_dnf: boolean; share_parser: string | null }
	) {
		return formatScore(score.raw_score, game);
	}

	async function deleteScore(id: string) {
		deleting = true;
		globalError = '';
		const { error: e } = await supabase.from('scores').delete().eq('id', id);
		deleting = false;
		if (e) {
			globalError = e.message;
			return;
		}
		confirmDeleteId = null;
		recalculateEloIfFinished();
		await invalidateAll();
	}

	const totalScores = $derived(gameGroups.reduce((n, g) => n + g.scores.length, 0));
</script>

<div class="space-y-6">
	<div class="flex items-center justify-between">
		<div>
			<div class="mb-1 flex items-center gap-2 text-sm text-ayu-muted">
				<a href="/admin" class="transition hover:text-zinc-300">Dashboard</a>
				<span>/</span>
				<span>Scores</span>
			</div>
			<h1 class="text-2xl font-bold text-white">{session.name}</h1>
			<p class="mt-0.5 text-sm text-ayu-muted">
				{fmtDate(session.date)} · {totalScores} score{totalScores === 1 ? '' : 's'}
			</p>
		</div>
		<span
			class="rounded-full px-3 py-1 text-xs font-semibold tracking-wider uppercase {session.status ===
			'active'
				? 'bg-ayu-green/20 text-ayu-green'
				: session.status === 'finished'
					? 'bg-zinc-800 text-zinc-500'
					: 'bg-zinc-700 text-zinc-300'}"
		>
			{session.status}
		</span>
	</div>

	<!-- Day summary -->
	<div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
		<div class="rounded-xl border border-ayu-border bg-ayu-surface p-5">
			<p class="mb-3 text-xs font-semibold tracking-widest text-ayu-muted uppercase">
				Day Summary
			</p>
			<div class="grid grid-cols-3 gap-3 text-center">
				<div>
					<p class="text-2xl font-bold text-white">{summary.gamesPlayed}</p>
					<p class="mt-0.5 text-xs text-ayu-muted">Games played</p>
				</div>
				<div>
					<p class="text-2xl font-bold text-white">{summary.totalScores}</p>
					<p class="mt-0.5 text-xs text-ayu-muted">Scores submitted</p>
				</div>
				<div>
					<p class="text-2xl font-bold text-white">{summary.playerCount}</p>
					<p class="mt-0.5 text-xs text-ayu-muted">Players</p>
				</div>
			</div>
		</div>

		<div class="rounded-xl border border-ayu-border bg-ayu-surface p-5">
			<p class="mb-3 text-xs font-semibold tracking-widest text-ayu-muted uppercase">
				Medal Tally
			</p>
			{#if tally.length === 0}
				<p class="text-sm text-ayu-muted">No medals awarded yet.</p>
			{:else}
				<div class="space-y-1.5">
					{#each tally.slice(0, 5) as t, i}
						<div class="flex items-center gap-2 text-sm">
							<span class="w-4 shrink-0 text-center text-xs text-ayu-muted">{i + 1}</span>
							<span class="flex-1 truncate text-white">{t.player_name}</span>
							<span class="font-mono text-xs text-ayu-muted"
								>🥇{t.gold} 🥈{t.silver} 🥉{t.bronze}</span
							>
							<span class="w-8 text-right font-mono text-xs font-bold text-ayu-gold"
								>{t.total}</span
							>
						</div>
					{/each}
				</div>
			{/if}
		</div>
	</div>

	<!-- ELO impact -->
	{#if eloBreakdown.length > 0}
		<div class="rounded-xl border border-ayu-border bg-ayu-surface p-5">
			<div class="mb-4 border-b border-ayu-border pb-4">
				<p class="font-semibold text-white">⚡ ELO Impact</p>
				<p class="mt-0.5 text-xs text-ayu-muted">
					Head-to-head rating change from this session's games, per player. Expand a player for
					the per-game breakdown, then a game for every individual matchup — each pairing shows
					the rating each side carried in, the win probability that implied, and the points that
					result swung. Skipped games don't count against you, and ties still move rating toward
					whoever was the underdog going in.
				</p>
			</div>
			<div class="space-y-3">
				{#each eloBreakdown as row (row.player_id)}
					{@const pct = (Math.abs(row.delta) / maxAbsDelta) * 50}
					<details class="group">
						<summary
							class="flex cursor-pointer list-none items-center gap-3 rounded-lg px-1 py-1 transition-colors hover:bg-ayu-surface2"
						>
							<a
								href="/player/{row.player_id}"
								class="w-28 shrink-0 truncate text-sm text-white transition-colors hover:text-ayu-gold"
								onclick={(e) => e.stopPropagation()}
							>
								{row.name}
							</a>
							<span class="w-28 shrink-0 text-right font-mono text-xs text-ayu-muted">
								{row.before} → {row.after}
							</span>
							<div class="relative h-4 flex-1">
								<div class="absolute top-0 left-1/2 h-full w-px bg-ayu-border"></div>
								{#if row.delta >= 0}
									<div
										class="absolute top-0 left-1/2 h-full rounded-r bg-ayu-green"
										style="width: {pct}%"
									></div>
								{:else}
									<div
										class="absolute top-0 right-1/2 h-full rounded-l bg-ayu-red"
										style="width: {pct}%"
									></div>
								{/if}
							</div>
							<span
								class="w-10 shrink-0 text-right font-mono text-xs font-bold {row.delta > 0
									? 'text-ayu-green'
									: row.delta < 0
										? 'text-ayu-red'
										: 'text-ayu-muted'}"
							>
								{row.delta > 0 ? '+' : ''}{row.delta}
							</span>
							<svg
								class="h-3 w-3 shrink-0 text-ayu-muted transition-transform group-open:rotate-90"
								fill="currentColor"
								viewBox="0 0 20 20"
							>
								<path
									fill-rule="evenodd"
									d="M6 6l8 4-8 4V6z"
									clip-rule="evenodd"
								/>
							</svg>
						</summary>
						<div class="mt-1.5 ml-54 space-y-1 border-l border-ayu-border pl-3">
							{#each row.games as g}
								<details class="group/game">
									<summary
										class="flex cursor-pointer list-none items-center justify-between gap-2 text-xs"
									>
										<span class="flex min-w-0 items-center gap-1.5 text-zinc-300">
											{#if g.matchups.length > 0}
												<svg
													class="h-2 w-2 shrink-0 text-ayu-muted transition-transform group-open/game:rotate-90"
													fill="currentColor"
													viewBox="0 0 20 20"
												>
													<path fill-rule="evenodd" d="M6 6l8 4-8 4V6z" clip-rule="evenodd" />
												</svg>
											{/if}
											<span class="shrink-0">{g.emoji}</span>
											<span class="truncate">{g.name}</span>
										</span>
										<span
											class="shrink-0 font-mono font-semibold {g.delta > 0
												? 'text-ayu-green'
												: g.delta < 0
													? 'text-ayu-red'
													: 'text-ayu-muted'}"
										>
											{g.delta > 0 ? '+' : ''}{g.delta}
										</span>
									</summary>
									{#if g.matchups.length > 0}
										<div class="mt-1 ml-4 space-y-1 border-l border-ayu-border/60 pl-2">
											{#each g.matchups as m}
												<div
													class="flex items-center justify-between gap-3 text-[11px] text-zinc-500"
												>
													<span>
														vs {m.opponentName}
														<span
															class="font-semibold {m.result === 'won'
																? 'text-ayu-green'
																: m.result === 'lost'
																	? 'text-ayu-red'
																	: 'text-zinc-300'}">{m.result}</span
														>
														<span class="text-zinc-600"
															>({m.ratingSelf} vs {m.ratingOpp} · expected {Math.round(
																m.winProb * 100
															)}%)</span
														>
													</span>
													<span
														class="shrink-0 font-mono {m.delta > 0
															? 'text-ayu-green'
															: m.delta < 0
																? 'text-ayu-red'
																: 'text-ayu-muted'}"
													>
														{m.delta > 0 ? '+' : ''}{m.delta.toFixed(1)}
													</span>
												</div>
											{/each}
										</div>
									{/if}
								</details>
							{/each}
						</div>
					</details>
				{/each}
			</div>
		</div>
	{/if}

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
			{#each gameGroups as { game, scores, isSpecial }}
				<div class="overflow-hidden rounded-xl border border-ayu-border">
					<div
						class="flex items-center gap-2 border-b border-ayu-border bg-ayu-surface2 px-4 py-2.5"
					>
						{#if game.icon_emoji}<span>{game.icon_emoji}</span>{/if}
						<span class="text-sm font-semibold text-white">{game.name}</span>
						{#if isSpecial}<span class="text-xs text-ayu-gold" title="Featured game">⭐</span>{/if}
						<span class="text-xs text-ayu-muted"
							>{scores.length} submission{scores.length === 1 ? '' : 's'}</span
						>
						<div class="ml-auto flex items-center gap-3">
							{#if confirmRemoveGameId === game.id}
								<span class="text-xs text-zinc-400">
									Remove game{scores.length > 0
										? ` + delete ${scores.length} score${scores.length === 1 ? '' : 's'}`
										: ''}?
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
								<tr
									class="border-b border-ayu-border text-left text-xs font-semibold tracking-wider text-ayu-muted uppercase"
								>
									<th class="px-4 py-2">Player</th>
									<th class="px-4 py-2">Score</th>
									<th class="hidden px-4 py-2 sm:table-cell">Submitted</th>
									<th class="hidden px-4 py-2 md:table-cell">Share text</th>
									<th class="px-4 py-2"></th>
								</tr>
							</thead>
							<tbody>
								{#each scores as score}
									<tr class="border-b border-ayu-border bg-ayu-surface last:border-0">
										<td class="px-4 py-2.5 font-medium text-white">
											<a href="/player/{score.player.id}" class="transition hover:text-ayu-gold">
												{displayName(score.player)}
											</a>
											{#if score.player.alias}
												<span class="ml-1 text-xs text-ayu-muted">({score.player.name})</span>
											{/if}
										</td>
										<td class="px-4 py-2.5 font-mono text-ayu-gold">
											{scoreLabel(score, game)}
										</td>
										<td class="hidden px-4 py-2.5 text-xs text-ayu-muted sm:table-cell">
											{fmtTime(score.submitted_at)}
										</td>
										<td
											class="hidden max-w-xs truncate px-4 py-2.5 text-xs text-ayu-muted md:table-cell"
										>
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
