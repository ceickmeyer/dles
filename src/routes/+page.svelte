<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { fly } from 'svelte/transition';
	import { invalidateAll } from '$app/navigation';
	import { playerStore } from '$lib/stores/player';
	import { supabase } from '$lib/supabase';
	import { sounds } from '$lib/sounds';
	import { rankScores, computeSessionTally, sortTally } from '$lib/scoring';
	import { displayName, formatScore, isDnf, fmtSeconds } from '$lib/utils';
	import type { ScoreWithPlayer } from '$lib/database.types';
	import PlayerName from '$components/PlayerName.svelte';
	import LobbyCard from '$components/LobbyCard.svelte';
	import Podium from '$components/Podium.svelte';
	import MedalTally from '$components/MedalTally.svelte';
	import SessionChat from '$components/SessionChat.svelte';
	import { computeSessionBadges } from '$lib/gameBadges';

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

	const sessionBadges = $derived(
		player.id && session
			? computeSessionBadges(myScores, session.session_games.map(sg => sg.game))
			: []
	);
	const gamesWithScores = $derived(gameResults.filter((gr) => gr.scores.length > 0));
	const allDone = $derived(
		!!session && session.session_games.length > 0 && myScores.size === session.session_games.length
	);

	let shareCopied = $state(false);

	// Score toasts
	let toasts = $state<{ id: number; message: string }[]>([]);
	let toastSeq = 0;
	function addToast(message: string) {
		const id = ++toastSeq;
		toasts = [...toasts, { id, message }];
		setTimeout(() => { toasts = toasts.filter(t => t.id !== id); }, 5000);
	}
	function toastMessage(raw_score: number, game: { name: string; icon_emoji: string | null; max_score: number | null; allow_dnf: boolean }, playerName: string): string {
		const emoji = game.icon_emoji ? `${game.icon_emoji} ` : '';
		if (game.allow_dnf && game.max_score !== null && raw_score === game.max_score + 1)
			return `${playerName} got a DNF in ${emoji}${game.name}`;
		if (game.max_score !== null && game.max_score <= 12)
			return `${playerName} scored ${raw_score}/${game.max_score} in ${emoji}${game.name}`;
		if (game.max_score !== null)
			return `${playerName} scored ${raw_score.toLocaleString()}/${game.max_score.toLocaleString()} in ${emoji}${game.name}`;
		return `${playerName} scored ${raw_score.toLocaleString()} in ${emoji}${game.name}`;
	}

	// Parse YYYY-MM-DD as a local date — avoids UTC midnight shifting the day
	function parseLocalDate(dateStr: string): Date {
		const [y, m, d] = dateStr.split('-').map(Number);
		return new Date(y, m - 1, d);
	}

	function formatSessionDate(dateStr: string): string {
		return parseLocalDate(dateStr).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
	}

	// Returns midnight in the user's local timezone at the end of sessionDate
	function localMidnight(sessionDate: string): Date {
		const [y, m, d] = sessionDate.split('-').map(Number);
		return new Date(y, m - 1, d + 1); // start of next day = end of session date
	}

	// Countdown — uses expires_at if set, otherwise local midnight for active/lobby sessions
	let timeLeft = $state('');
	$effect(() => {
		if (!session) { timeLeft = ''; return; }
		const endTime = session.expires_at
			? new Date(session.expires_at)
			: (session.status === 'active' || session.status === 'lobby') ? localMidnight(session.date) : null;
		if (!endTime) { timeLeft = ''; return; }

		function tick() {
			const diff = endTime!.getTime() - Date.now();
			if (diff <= 0) { timeLeft = 'Session ended'; return; }
			const h = Math.floor(diff / 3600000);
			const m = Math.floor((diff % 3600000) / 60000);
			const s = Math.floor((diff % 60000) / 1000);
			timeLeft = h > 0 ? `${h}h ${m}m` : `${m}:${String(s).padStart(2, '0')}`;
		}
		tick();
		const id = setInterval(tick, 1000);
		return () => clearInterval(id);
	});

	function buildShareText(): string {
		if (!session) return '';
		const date = formatSessionDate(session.date);
		const lines = [`${session.name} — ${date}`, ''];
		const myMedals = new Map(
			gameResults.map(gr => [gr.game.id, gr.scores.find(s => s.player_id === player.id)?.medal ?? null])
		);
		for (const { game } of session.session_games) {
			const raw = myScores.get(game.id);
			if (raw === undefined) continue;
			const dnf = isDnf(raw, game);
			let score: string;
			if (dnf) {
				score = 'X';
			} else if (game.share_parser === 'decipher') {
				score = fmtSeconds(raw);
			} else if (game.max_score) {
				score = `${raw}/${game.max_score}`;
			} else {
				score = raw.toLocaleString();
			}
			const medal = myMedals.get(game.id);
			const medalStr = medal ? ` ${MEDAL[medal]}` : '';
			lines.push(`${game.icon_emoji ?? '🎮'} ${game.name}: ${score}${medalStr}`);
		}
		lines.push('', 'https://dles.cooody.com');
		return lines.join('\n');
	}

	async function share() {
		const text = buildShareText();
		if (navigator.share) {
			try {
				await navigator.share({ text });
				return;
			} catch { /* cancelled or unsupported — fall through to clipboard */ }
		}
		try {
			await navigator.clipboard.writeText(text);
		} catch {
			// clipboard blocked (non-https?) — show text in prompt as last resort
			window.prompt('Copy your scores:', text);
			return;
		}
		shareCopied = true;
		setTimeout(() => { shareCopied = false; }, 2000);
	}

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
				.on('postgres_changes', { event: '*', schema: 'public', table: 'scores', filter: `session_id=eq.${session.id}` }, async (payload) => {
					const row = payload.new as { player_id?: string; game_id?: string; raw_score?: number };
					if (row.player_id && row.player_id !== player.id && payload.eventType === 'INSERT') {
						sounds.others();
						const game = session.session_games.find(sg => sg.game.id === row.game_id)?.game;
						if (game && row.raw_score !== undefined) {
							const { data: p } = await supabase.from('players').select('name, alias').eq('id', row.player_id).maybeSingle();
							if (p) addToast(toastMessage(row.raw_score, game, displayName(p)));
						}
					}
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

{#if session}
	<SessionChat sessionId={session.id} playerId={player.id || null} playerName={player.name || null} />
{/if}

<!-- Score toasts -->
{#if toasts.length > 0}
	<div class="fixed bottom-4 left-4 z-50 flex flex-col gap-2 items-start pointer-events-none">
		{#each toasts as toast (toast.id)}
			<div
				transition:fly={{ x: -16, duration: 200 }}
				class="rounded-xl border border-ayu-border bg-zinc-950 px-4 py-2.5 text-sm text-white shadow-xl"
			>
				{toast.message}
			</div>
		{/each}
	</div>
{/if}

{#if !session}
	<div class="py-20 text-center">
		<p class="mb-4 text-6xl">🏅</p>
		<h1 class="mb-2 text-2xl font-bold text-white">No active session</h1>
		{#if data.nextSession}
			{#if data.nextSession.isToday}
				<p class="text-ayu-muted">A session is scheduled for today — check back soon!</p>
				<p class="mt-1 text-sm text-zinc-500">{data.nextSession.label}</p>
			{:else}
				<p class="text-ayu-muted">Next up: <span class="text-zinc-300">{data.nextSession.label}</span></p>
			{/if}
		{:else}
			<p class="text-ayu-muted">Ask the host to start a new game night!</p>
		{/if}
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
			<div class="mt-0.5 flex items-center justify-between">
				<p class="text-sm text-ayu-muted">{formatSessionDate(session.date)}</p>
				{#if timeLeft}
					<p class="text-xs text-ayu-muted">Ends in <span class="font-mono text-zinc-300">{timeLeft}</span></p>
				{/if}
			</div>
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

		<!-- Current Badges -->
		{#if sessionBadges.length > 0}
			<div class="rounded-xl border border-ayu-border bg-ayu-surface p-5">
				<h2 class="mb-4 text-xs font-semibold uppercase tracking-widest text-ayu-muted">Current Badges</h2>
				<div class="flex flex-wrap gap-3">
					{#each sessionBadges as badge (badge.id)}
						<div
							class="group relative flex items-center gap-2.5 rounded-lg border border-ayu-border bg-ayu-surface2 px-3 py-2"
							title={badge.description}
						>
							<span class="text-xl leading-none">{badge.emoji}</span>
							<div>
								<p class="text-sm font-semibold text-white leading-tight">{badge.name}</p>
								{#if badge.gameName}
									<p class="text-xs text-ayu-muted leading-tight">{badge.gameEmoji} {badge.gameName}</p>
								{/if}
							</div>
							<!-- Tooltip -->
							<div class="pointer-events-none absolute bottom-full left-0 mb-2 z-10 w-48 rounded-lg border border-ayu-border bg-zinc-900 px-3 py-2 text-xs text-zinc-300 opacity-0 shadow-lg transition-opacity group-hover:opacity-100">
								{badge.description}
							</div>
						</div>
					{/each}
				</div>
			</div>
		{/if}

		<!-- Share button — appears once the player has at least one score -->
		{#if myScores.size > 0 && player.id}
			<div class="rounded-xl border border-ayu-border bg-ayu-surface px-5 py-4 flex items-center justify-between gap-4">
				<div>
					{#if allDone}
						<p class="font-semibold text-white">All done! 🎉</p>
						<p class="text-xs text-ayu-muted mt-0.5">Share your scores with the group.</p>
					{:else}
						<p class="font-semibold text-white">Share your scores so far</p>
						<p class="text-xs text-ayu-muted mt-0.5">{myScores.size}/{session.session_games.length} games submitted.</p>
					{/if}
				</div>
				<button
					onclick={share}
					class="shrink-0 rounded-lg bg-ayu-gold px-4 py-2 text-sm font-bold text-ayu-bg transition hover:brightness-110"
				>
					{shareCopied ? '✓ Copied!' : '📤 Share'}
				</button>
			</div>
		{/if}

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
												<a href="/player/{s.player_id}" class="hover:text-ayu-gold transition-colors {s.player_id === player.id ? 'font-semibold text-white' : ''}">{s.player_name}</a>
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
