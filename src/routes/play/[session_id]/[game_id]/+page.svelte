<script lang="ts">
	import { supabase } from '$lib/supabase';
	import { playerStore } from '$lib/stores/player';
	import { rankScores, MEDAL_EMOJI } from '$lib/scoring';
	import type { ScoreWithPlayer } from '$lib/database.types';
	import ScoreEntry from '$components/ScoreEntry.svelte';
	import PlayerName from '$components/PlayerName.svelte';

	let { data } = $props();
	const session = $derived(data.session);
	const game = $derived(data.game);

	const player = $derived($playerStore);

	let scores = $state<ScoreWithPlayer[]>([]);
	let existingScore = $state<number | null>(null);
	let myRank = $state<number | null>(null);
	let loadedScores = $state(false);

	$effect(() => {
		if (!player.id) return;
		loadScores();
	});

	async function loadScores() {
		const { data: rows } = await supabase
			.from('scores')
			.select('*, player:players(name)')
			.eq('session_id', session.id)
			.eq('game_id', game.id);

		if (rows) {
			scores = rows as ScoreWithPlayer[];
			const mine = rows.find((s) => s.player_id === player.id);
			existingScore = mine?.raw_score ?? null;
		}
		loadedScores = true;
	}

	async function submitScore(score: number, shareText?: string) {
		if (!player.id) throw new Error('No player — enter your name first.');

		const { error: dbError } = await supabase.from('scores').upsert(
			{
				session_id: session.id,
				game_id: game.id,
				player_id: player.id,
				raw_score: score,
				share_text: shareText ?? null
			},
			{ onConflict: 'session_id,game_id,player_id' }
		);

		if (dbError) throw new Error(dbError.message);

		await loadScores();

		const ranked = rankScores(
			scores.map((s) => ({
				player_id: s.player_id,
				player_name: (s.player as { name: string }).name,
				raw_score: s.raw_score
			})),
			game.scoring_direction
		);
		const me = ranked.find((r) => r.player_id === player.id);
		myRank = me?.rank ?? null;
	}
</script>

{#if !player.name}
	<PlayerName />
{/if}

<div class="space-y-6">
	<div>
		<a href="/" class="mb-4 inline-flex items-center gap-1 text-sm text-zinc-400 hover:text-white">
			← Back to lobby
		</a>
		<div class="flex items-center gap-3">
			<span class="text-4xl">{game.icon_emoji ?? '🎮'}</span>
			<div>
				<h1 class="text-2xl font-bold text-white">{game.name}</h1>
				{#if game.url}
					<a
						href={game.url}
						target="_blank"
						rel="noopener noreferrer"
						class="text-sm text-zinc-400 underline hover:text-amber-400"
					>
						Play {game.name} →
					</a>
				{/if}
			</div>
		</div>
	</div>

	{#if session.status === 'lobby'}
		<div class="rounded-xl border border-zinc-700 bg-zinc-800 p-4 text-sm text-zinc-400">
			The session hasn't started yet — but you can submit your score early!
		</div>
	{/if}

	<div class="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
		<h2 class="mb-4 font-semibold text-white">Submit your score</h2>
		{#if loadedScores}
			<ScoreEntry {game} onsubmit={submitScore} {existingScore} />
		{:else}
			<p class="text-sm text-zinc-500">Loading…</p>
		{/if}
	</div>

	{#if myRank !== null}
		<div class="rounded-xl border border-amber-700/50 bg-amber-900/20 p-4 text-center">
			<p class="text-sm text-zinc-400">Your rank so far</p>
			<p class="text-3xl font-bold text-amber-400">#{myRank}</p>
			{#if myRank <= 3}
				<p class="text-2xl">{MEDAL_EMOJI[(['gold', 'silver', 'bronze'] as const)[myRank - 1]]}</p>
			{/if}
		</div>
	{/if}

	{#if scores.length > 0}
		<div>
			<h2 class="mb-3 text-sm font-semibold uppercase tracking-wider text-zinc-500">
				Scores so far
			</h2>
			<div class="space-y-2">
				{#each rankScores(scores.map((s) => ({ player_id: s.player_id, player_name: (s.player as {name:string}).name, raw_score: s.raw_score })), game.scoring_direction) as ranked}
					<div class="flex items-center justify-between rounded-lg bg-zinc-800 px-4 py-2 text-sm"
						class:border={ranked.player_id === player.id}
						class:border-amber-600={ranked.player_id === player.id}
					>
						<span class="text-zinc-300">
							{ranked.medal ? MEDAL_EMOJI[ranked.medal] : `#${ranked.rank}`}
							{ranked.player_name}
							{#if ranked.player_id === player.id}<span class="text-xs text-amber-400 ml-1">(you)</span>{/if}
						</span>
						<span class="font-mono font-semibold text-white">{ranked.raw_score}</span>
					</div>
				{/each}
			</div>
		</div>
	{/if}
</div>
