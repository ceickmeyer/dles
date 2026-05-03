<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { fly } from 'svelte/transition';
	import { invalidateAll } from '$app/navigation';
	import { playerStore } from '$lib/stores/player';
	import { supabase } from '$lib/supabase';
	import { sounds } from '$lib/sounds';
	import { rankScores, computeSessionTally, sortTally } from '$lib/scoring';
	import { displayName, formatScore } from '$lib/utils';
	import type { ScoreWithPlayer } from '$lib/database.types';
	import PlayerName from '$components/PlayerName.svelte';
	import LobbyCard from '$components/LobbyCard.svelte';
	import Podium from '$components/Podium.svelte';
	import MedalTally from '$components/MedalTally.svelte';

	let { data } = $props();

	let scores = $state<ScoreWithPlayer[]>([]);
	$effect(() => { scores = data.scores as ScoreWithPlayer[]; });

	let subscriptions: ReturnType<typeof supabase.channel>[] = [];
	const player = $derived($playerStore);
	const session = $derived(data.session);

	const gameResults = $derived(
		session
			? session.session_games.map(({ game }) => ({
					game,
					scores: rankScores(
						scores
							.filter((s) => s.game_id === game.id)
							.map((s) => ({
								player_id: s.player_id,
								player_name: displayName(s.player as { name: string; alias?: string | null }),
								raw_score: s.raw_score
							})),
						game.scoring_direction
					)
				}))
			: []
	);

	const tally = $derived(sortTally([...computeSessionTally(gameResults).values()]));

	const myScores = $derived(
		new Map(scores.filter((s) => s.player_id === player.id).map((s) => [s.game_id, s.raw_score]))
	);

	const scoresHidden = $derived(session?.scores_hidden ?? false);
	const gamesWithScores = $derived(gameResults.filter((gr) => gr.scores.length > 0));

	// Play finished sound when player completes all their games (not on initial load)
	let prevMyScoresSize = $state<number | null>(null);
	$effect(() => {
		const total = session?.session_games.length ?? 0;
		const current = myScores.size;
		if (prevMyScoresSize !== null && total > 0 && current === total && prevMyScoresSize < total) sounds.finished();
		prevMyScoresSize = current;
	});

	// Track reveal transition for podium animation
	let prevHidden = $state(false);
	let justRevealed = $state(false);
	$effect(() => {
		if (prevHidden && !scoresHidden) {
			justRevealed = true;
			sounds.others();
			setTimeout(() => { justRevealed = false; }, 1500);
		}
		prevHidden = scoresHidden;
	});

	async function refreshScores() {
		if (!session) return;
		const { data: fresh } = await supabase
			.from('scores')
			.select('*, player:players(name, alias)')
			.eq('session_id', session.id);
		if (fresh) scores = fresh as ScoreWithPlayer[];
	}

	onMount(async () => {
		// Verify stored player ID still exists (handles DB reset / admin deletion)
		if (player.id) {
			const { data } = await supabase.from('players').select('id').eq('id', player.id).maybeSingle();
			if (!data) playerStore.clear();
		}

		if (!session) return;

		// Watch scores for live updates
		subscriptions.push(
			supabase
				.channel(`scores:${session.id}`)
				.on('postgres_changes', { event: '*', schema: 'public', table: 'scores', filter: `session_id=eq.${session.id}` }, (payload) => {
					const incoming = (payload.new as { player_id?: string }).player_id;
					if (incoming && incoming !== player.id) sounds.others();
					refreshScores();
				})
				.subscribe()
		);

		// Watch session for hide/reveal toggling
		subscriptions.push(
			supabase
				.channel(`session:${session.id}`)
				.on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'sessions', filter: `id=eq.${session.id}` }, () => invalidateAll())
				.subscribe()
		);
	});

	onDestroy(() => { subscriptions.forEach((s) => s.unsubscribe()); });

	const MEDAL: Record<string, string> = { gold: '🥇', silver: '🥈', bronze: '🥉' };
</script>

{#if !player.name}
	<PlayerName />
{/if}

{#if !session}
	<div class="py-20 text-center">
		<p class="mb-4 text-6xl">🏅</p>
		<h1 class="mb-2 text-2xl font-bold text-white">No active session</h1>
		<p class="text-ayu-muted">Ask the host to start a new game night!</p>
	</div>
{:else}
	<div class="space-y-8">
		<!-- Session header -->
		<div>
			<div class="flex items-baseline justify-between">
				<h1 class="text-2xl font-bold text-white">{session.name}</h1>
				<span
					class="rounded-full px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wider {
						session.status === 'active'  ? 'bg-ayu-green text-ayu-bg' :
						session.status === 'paused'  ? 'bg-amber-700 text-white' :
						'bg-ayu-surface2 text-ayu-muted'
					}"
				>
					{session.status === 'active' ? '● Live' : session.status === 'paused' ? '⏸ Paused' : 'Lobby'}
				</span>
			</div>
			<p class="mt-0.5 text-sm text-ayu-muted">
				{new Date(session.date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
			</p>
		</div>

		<!-- Game cards -->
		<div>
			<h2 class="mb-3 text-xs font-semibold uppercase tracking-widest text-ayu-muted">Tonight's Games</h2>
			<div class="space-y-2">
				{#if player.id}
					{#each session.session_games as { game }}
						<LobbyCard
							{game}
							sessionId={session.id}
							playerId={player.id}
							myScore={myScores.get(game.id) ?? null}
							onscored={refreshScores}
						/>
					{/each}
				{:else}
					{#each session.session_games as { game }}
						<div class="flex items-center gap-3 rounded-xl border border-ayu-border bg-ayu-surface px-4 py-3">
							<span class="text-2xl">{game.icon_emoji ?? '🎮'}</span>
							<span class="text-white">{game.name}</span>
						</div>
					{/each}
				{/if}
			</div>
		</div>

		{#if scoresHidden}
			<!-- Hidden scores banner -->
			<div class="rounded-xl border border-ayu-border bg-ayu-surface px-5 py-8 text-center">
				<p class="text-3xl mb-2">🙈</p>
				<p class="font-semibold text-white">Scores are hidden</p>
				<p class="mt-1 text-sm text-ayu-muted">The host will reveal results when everyone's done.</p>
			</div>
		{:else}
			<!-- Per-game results -->
			{#if gamesWithScores.length > 0}
				<div transition:fly={{ y: 24, duration: 400 }}>
					<h2 class="mb-3 text-xs font-semibold uppercase tracking-widest text-ayu-muted">Results So Far</h2>
					<div class="space-y-2">
						{#each gamesWithScores as { game, scores: ranked }}
							<div class="rounded-xl border border-ayu-border bg-ayu-surface px-4 py-3">
								<p class="mb-2 text-sm font-semibold text-white">
									{game.icon_emoji ?? '🎮'} {game.name}
								</p>
								<div class="space-y-1">
									{#each ranked as s}
										<div class="flex items-center justify-between text-sm">
											<span class="text-zinc-300">
												{#if s.medal}{MEDAL[s.medal]}{:else}<span class="inline-block w-5"></span>{/if}
												<span class={s.player_id === player.id ? 'font-semibold text-white' : ''}>{s.player_name}</span>
											</span>
											<span class="font-mono {s.raw_score !== null && game.allow_dnf && game.max_score !== null && s.raw_score === game.max_score + 1 ? 'text-ayu-red' : 'text-ayu-gold'}">{formatScore(s.raw_score, game)}</span>
										</div>
									{/each}
								</div>
							</div>
						{/each}
					</div>
				</div>
			{/if}

			<!-- Live standings -->
			{#if tally.length > 0}
				<div>
					<h2 class="mb-4 text-xs font-semibold uppercase tracking-widest text-ayu-muted">Live Standings</h2>
					{#if tally.length >= 2}
						<div class="mb-6 rounded-xl border border-ayu-border bg-ayu-surface p-6">
							<Podium {tally} animate={justRevealed} />
						</div>
					{/if}
					<div class="rounded-xl border border-ayu-border bg-ayu-surface p-4">
						<MedalTally {tally} currentPlayerId={player.id} />
					</div>
				</div>
			{/if}
		{/if}
	</div>
{/if}
