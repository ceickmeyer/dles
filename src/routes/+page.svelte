<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { playerStore } from '$lib/stores/player';
	import { supabase } from '$lib/supabase';
	import { rankScores, computeSessionTally, sortTally } from '$lib/scoring';
	import type { ScoreWithPlayer } from '$lib/database.types';
	import PlayerName from '$components/PlayerName.svelte';
	import LobbyCard from '$components/LobbyCard.svelte';
	import Podium from '$components/Podium.svelte';
	import MedalTally from '$components/MedalTally.svelte';

	let { data } = $props();

	let scores = $state<ScoreWithPlayer[]>([]);
	$effect(() => { scores = data.scores as ScoreWithPlayer[]; });

	let subscription: ReturnType<typeof supabase.channel> | null = null;
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
								player_name: (s.player as { name: string }).name,
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

	async function refreshScores() {
		if (!session) return;
		const { data: fresh } = await supabase
			.from('scores')
			.select('*, player:players(name)')
			.eq('session_id', session.id);
		if (fresh) scores = fresh as ScoreWithPlayer[];
	}

	onMount(() => {
		if (!session) return;
		subscription = supabase
			.channel(`scores:${session.id}`)
			.on('postgres_changes', { event: '*', schema: 'public', table: 'scores', filter: `session_id=eq.${session.id}` }, refreshScores)
			.subscribe();
	});

	onDestroy(() => { subscription?.unsubscribe(); });
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

		<!-- Live standings -->
		{#if tally.length > 0}
			<div>
				<h2 class="mb-4 text-xs font-semibold uppercase tracking-widest text-ayu-muted">Live Standings</h2>
				{#if tally.length >= 2}
					<div class="mb-6 rounded-xl border border-ayu-border bg-ayu-surface p-6">
						<Podium {tally} />
					</div>
				{/if}
				<div class="rounded-xl border border-ayu-border bg-ayu-surface p-4">
					<MedalTally {tally} currentPlayerId={player.id} />
				</div>
			</div>
		{/if}
	</div>
{/if}
