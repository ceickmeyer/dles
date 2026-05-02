<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { playerStore } from '$lib/stores/player';
	import { supabase } from '$lib/supabase';
	import { rankScores, computeSessionTally, sortTally } from '$lib/scoring';
	import type { ScoreWithPlayer } from '$lib/database.types';
	import PlayerName from '$components/PlayerName.svelte';
	import GameCard from '$components/GameCard.svelte';
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

	const tally = $derived(
		sortTally([...computeSessionTally(gameResults).values()])
	);

	const myScores = $derived(
		new Map(scores.filter((s) => s.player_id === player.id).map((s) => [s.game_id, s.raw_score]))
	);

	onMount(() => {
		if (!session) return;

		subscription = supabase
			.channel(`scores:${session.id}`)
			.on(
				'postgres_changes',
				{
					event: '*',
					schema: 'public',
					table: 'scores',
					filter: `session_id=eq.${session.id}`
				},
				async () => {
					const { data: fresh } = await supabase
						.from('scores')
						.select('*, player:players(name)')
						.eq('session_id', session.id);
					if (fresh) scores = fresh as ScoreWithPlayer[];
				}
			)
			.subscribe();
	});

	onDestroy(() => {
		subscription?.unsubscribe();
	});
</script>

{#if !player.name}
	<PlayerName />
{/if}

{#if !session}
	<div class="py-16 text-center">
		<p class="text-5xl mb-4">🎮</p>
		<h1 class="text-2xl font-bold text-white mb-2">No active session</h1>
		<p class="text-zinc-400">Ask the host to start a new game night!</p>
	</div>
{:else}
	<div class="space-y-8">
		<div>
			<div class="flex items-center justify-between mb-1">
				<h1 class="text-2xl font-bold text-white">{session.name}</h1>
				<span
					class="rounded-full px-2.5 py-0.5 text-xs font-medium"
					class:bg-green-900={session.status === 'active'}
					class:text-green-400={session.status === 'active'}
					class:bg-zinc-800={session.status === 'lobby'}
					class:text-zinc-400={session.status === 'lobby'}
				>
					{session.status === 'active' ? '● Live' : 'Lobby'}
				</span>
			</div>
			<p class="text-sm text-zinc-500">{new Date(session.date).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</p>
		</div>

		<!-- Games -->
		<div>
			<h2 class="mb-3 text-sm font-semibold uppercase tracking-wider text-zinc-500">Tonight's Games</h2>
			<div class="space-y-2">
				{#each session.session_games as { game }}
					<GameCard
						{game}
						sessionId={session.id}
						submitted={myScores.has(game.id)}
						myScore={myScores.get(game.id) ?? null}
					/>
				{/each}
			</div>
		</div>

		{#if tally.length > 0}
			<!-- Podium -->
			<div>
				<h2 class="mb-4 text-sm font-semibold uppercase tracking-wider text-zinc-500">Standings</h2>
				{#if tally.length >= 2}
					<div class="mb-6">
						<Podium {tally} />
					</div>
				{/if}
				<MedalTally {tally} currentPlayerId={player.id} />
			</div>
		{/if}
	</div>
{/if}
