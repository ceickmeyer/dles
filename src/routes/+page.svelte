<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { fly } from 'svelte/transition';
	import { invalidateAll } from '$app/navigation';
	import { playerStore } from '$lib/stores/player';
	import { supabase } from '$lib/supabase';
	import { sounds } from '$lib/sounds';
	import { fireConfetti, fireMedalConfetti } from '$lib/confetti';
	import { rankScores, computeSessionTally, sortTally } from '$lib/scoring';
	import type { PlayerDayStat } from '$lib/scoring';
	import { displayName, formatScore, isDnf, fmtSeconds } from '$lib/utils';
	import type { ScoreWithPlayer, Game } from '$lib/database.types';
	import PlayerName from '$components/PlayerName.svelte';
	import LobbyCard from '$components/LobbyCard.svelte';
	import MedalTally from '$components/MedalTally.svelte';
	import SessionChat from '$components/SessionChat.svelte';
	import NextSessionCountdown from '$components/NextSessionCountdown.svelte';
	import { computeSessionBadges } from '$lib/gameBadges';

	let { data } = $props();

	let scores = $state<ScoreWithPlayer[]>([]);
	$effect(() => { scores = data.scores as ScoreWithPlayer[]; });

	let subscriptions: ReturnType<typeof supabase.channel>[] = [];
	const player = $derived($playerStore);
	const session = $derived(data.session);

	const gameResults = $derived(
		session
			? session.session_games.map(({ game, is_special }) => ({
					game,
					isSpecial: is_special ?? false,
					scores: rankScores(
						scores
							.filter((s) => s.game_id === game.id)
							.map((s) => ({
								player_id: s.player_id,
								player_name: displayName(s.player as { name: string; alias?: string | null }),
								raw_score: s.raw_score,
								share_text: s.share_text ?? null
							})),
						game.scoring_direction,
						game.allow_dnf && game.max_score !== null ? game.max_score + 1 : null
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
			? computeSessionBadges(myScores, session.session_games.map(sg => ({ ...sg.game, is_special: sg.is_special ?? false })))
			: []
	);
	const gamesWithScores = $derived(gameResults.filter((gr) => gr.scores.length > 0));
	const gameScoresMap = $derived(new Map(gameResults.map(gr => [gr.game.id, gr.scores])));
	const allDone = $derived(
		!!session && session.session_games.length > 0 && myScores.size === session.session_games.length
	);
	const prevWinnerId = $derived(data.prevWinners?.[0]?.player_id ?? null);
	const prevFullRanking = $derived(data.prevFullRanking ?? []);

	const prevRankMap = $derived(
		new Map((data.prevRanks ?? []).map((r: { player_id: string; rank: number; outOf: number }) => [r.player_id, r]))
	);

	const totalGames = $derived(session?.session_games.length ?? 0);

	const featuredWinnerId = $derived(
		gameResults.find(r => r.isSpecial)?.scores.find(s => s.medal === 'gold')?.player_id ?? null
	);

	const playerGameCounts = $derived((() => {
		const counts = new Map<string, number>();
		for (const s of scores) counts.set(s.player_id, (counts.get(s.player_id) ?? 0) + 1);
		return counts;
	})());

	const completedPlayerIds = $derived((() => {
		if (totalGames === 0) return new Set<string>();
		const done = new Set<string>();
		for (const [pid, count] of playerGameCounts) {
			if (count >= totalGames) done.add(pid);
		}
		return done;
	})());

	const playerDayStats = $derived(new Map(
		tally.map(row => [
			row.player_id,
			gameResults
				.map(gr => {
					const s = gr.scores.find(sc => sc.player_id === row.player_id);
					if (!s) return null;
					return {
						gameName: gr.game.name,
						gameEmoji: gr.game.icon_emoji,
						formattedScore: formatScore(s.raw_score, gr.game),
						medal: s.medal,
						dnf: isDnf(s.raw_score, gr.game)
					} satisfies PlayerDayStat;
				})
				.filter((x): x is PlayerDayStat => x !== null)
		])
	));

	const specialGame = $derived(session?.session_games.find(sg => sg.is_special) ?? null);
	const regularGames = $derived(session?.session_games.filter(sg => !sg.is_special) ?? []);

	let shareCopied = $state(false);
	let copiedGameId = $state<string | null>(null);
	let standingsCopied = $state(false);

	let prevRankingTipVisible = $state(false);
	let prevRankingTipX = $state(0);
	let prevRankingTipY = $state(0);

	function showPrevRankingTip(e: MouseEvent) {
		const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
		prevRankingTipX = rect.left;
		prevRankingTipY = rect.bottom + 8;
		prevRankingTipVisible = true;
	}
	function hidePrevRankingTip() { prevRankingTipVisible = false; }

	function buildStandingsShare(): string {
		if (!session) return '';
		const date = parseLocalDate(session.date).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
		const lines = [`Live Standings — ${date}`, ''];
		const tallyRanks = tally.map((row, _, arr) => {
			const first = arr.findIndex(r => r.gold === row.gold && r.silver === row.silver && r.bronze === row.bronze);
			return first + 1;
		});
		for (let i = 0; i < tally.length; i++) {
			const row = tally[i];
			const rank = tallyRanks[i];
			const rankStr = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : `${rank}.`;
			const medals = [
				row.gold > 0 ? `🥇×${row.gold}` : '',
				row.silver > 0 ? `🥈×${row.silver}` : '',
				row.bronze > 0 ? `🥉×${row.bronze}` : '',
			].filter(Boolean).join(' ');
			lines.push(`${rankStr} ${row.player_name}${medals ? ' — ' + medals : ''}`);
		}
		lines.push('', 'https://dles.cooody.com');
		return lines.join('\n');
	}

	async function copyStandings() {
		const text = buildStandingsShare();
		try {
			await navigator.clipboard.writeText(text);
		} catch {
			window.prompt('Copy standings:', text);
			return;
		}
		standingsCopied = true;
		setTimeout(() => { standingsCopied = false; }, 2000);
	}

	async function copyGameResults(game: typeof gamesWithScores[number]['game'], ranked: typeof gamesWithScores[number]['scores']) {
		const lines = [`${game.icon_emoji ?? '🎮'} ${game.name}`];
		for (const s of ranked) {
			const medal = s.medal ? `${MEDAL[s.medal]} ` : '   ';
			lines.push(`${medal}${s.player_name} — ${formatScore(s.raw_score, game)}`);
		}
		try {
			await navigator.clipboard.writeText(lines.join('\n'));
		} catch {
			window.prompt('Copy results:', lines.join('\n'));
			return;
		}
		copiedGameId = game.id;
		setTimeout(() => { copiedGameId = null; }, 2000);
	}

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



	function buildShareText(): string {
		if (!session) return '';
		const date = formatSessionDate(session.date);
		const header = session.name.includes(date) ? session.name : `${session.name} — ${date}`;
		const lines = [header, ''];
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

	// Play finished sound when player submits all games for the session
	let prevMyScoresSize = $state<number | null>(null);
	$effect(() => {
		const total = session?.session_games.length ?? 0;
		const current = myScores.size;
		if (prevMyScoresSize !== null && total > 0 && current === total && prevMyScoresSize < total) { sounds.finished(); fireConfetti(); }
		prevMyScoresSize = current;
	});

	// Play uptempo / fire medal confetti when any player takes a podium spot on any game
	let _medalInit = false;
	let _prevMedalHolders = new Map<string, { gold: string | null; silver: string | null; bronze: string | null }>();
	$effect(() => {
		const holders = new Map(
			gameResults.map(gr => ({
				id: gr.game.id,
				gold: gr.scores.find(s => s.medal === 'gold')?.player_id ?? null,
				silver: gr.scores.find(s => s.medal === 'silver')?.player_id ?? null,
				bronze: gr.scores.find(s => s.medal === 'bronze')?.player_id ?? null,
			})).map(h => [h.id, { gold: h.gold, silver: h.silver, bronze: h.bronze }])
		);
		if (_medalInit) {
			for (const gr of gameResults) {
				const cur = holders.get(gr.game.id);
				const prev = _prevMedalHolders.get(gr.game.id);
				if (!cur || gr.scores.length < 2) continue;
				if (cur.gold !== prev?.gold) {
					sounds.uptempo();
					if (cur.gold === player.id) fireMedalConfetti('gold');
					break;
				}
				if (cur.silver !== prev?.silver && cur.silver === player.id) { fireMedalConfetti('silver'); break; }
				if (cur.bronze !== prev?.bronze && cur.bronze === player.id) { fireMedalConfetti('bronze'); break; }
			}
		}
		_medalInit = true;
		_prevMedalHolders = holders;
	});

	async function refreshScores() {
		if (!session) return;
		const { data: fresh } = await supabase
			.from('scores')
			.select('*, player:players(name, alias)')
			.eq('session_id', session.id);
		if (fresh) scores = fresh as ScoreWithPlayer[];
	}

	function buildRankSuffix(
		ranked: ReturnType<typeof rankScores>,
		forPlayerId: string,
		prevOverallLeaderId: string | null,
		newOverallLeaderId: string | null
	): string {
		const parts: string[] = [];
		const playerRank = ranked.find(r => r.player_id === forPlayerId);
		if (ranked.length >= 2 && playerRank?.medal) {
			const tied = ranked.filter(r => r.rank === playerRank.rank).length > 1;
			if (playerRank.rank === 1) parts.push(tied ? 'Tied for 1st 🥇' : '1st place 🥇');
			else if (playerRank.rank === 2) parts.push(tied ? 'Tied for 2nd 🥈' : '2nd place 🥈');
			else if (playerRank.rank === 3) parts.push(tied ? 'Tied for 3rd 🥉' : '3rd place 🥉');
		}
		if (newOverallLeaderId === forPlayerId && prevOverallLeaderId !== forPlayerId) {
			parts.push('Leads overall');
		}
		return parts.length > 0 ? ' · ' + parts.join(' · ') : '';
	}

	function overallLeaderId(t: typeof tally): string | null {
		if (t.length === 0 || t[0].total === 0) return null;
		if (t.length > 1 && t[0].total === t[1].total) return null; // tied — no sole leader
		return t[0].player_id;
	}

	function makeOnscoredHandler(game: Game) {
		return async (rawScore: number) => {
			const prevLeader = overallLeaderId(tally);
			await refreshScores();
			const newLeader = overallLeaderId(tally);
			const gameScores = scores
				.filter(s => s.game_id === game.id)
				.map(s => ({
					player_id: s.player_id,
					player_name: displayName(s.player as { name: string; alias?: string | null }),
					raw_score: s.raw_score
				}));
			const ranked = rankScores(gameScores, game.scoring_direction);
			const dnf = isDnf(rawScore, game);
			const myRank = ranked.find(r => r.player_id === player.id);
			if (!dnf && ranked.length >= 2 && myRank?.medal) {
				if (myRank.medal === 'gold') sounds.gold();
				else if (myRank.medal === 'silver') sounds.silver();
				else if (myRank.medal === 'bronze') sounds.bronze();
			} else {
				sounds.submit();
			}
			const myEntry = scores.find(s => s.player_id === player.id && s.game_id === game.id);
			const name = myEntry ? displayName(myEntry.player as { name: string; alias?: string | null }) : player.name ?? 'Someone';
			const rankSuffix = dnf ? '' : buildRankSuffix(ranked, player.id!, prevLeader, newLeader);
			const logMsg = dnf
				? `${name} DNF'd ${game.icon_emoji ?? '🎮'} ${game.name}`
				: `${name} scored ${formatScore(rawScore, game)} on ${game.icon_emoji ?? '🎮'} ${game.name}${rankSuffix}`;
			const { error: logErr } = await supabase.from('messages').insert({ session_id: session!.id, player_id: null, player_name: '__log__', content: logMsg });
			if (logErr) console.error('log insert failed:', logErr);

			// Check for personal best / server record (non-DNF only, compared against finished sessions)
			if (!dnf && player.id) {
				const lower = game.scoring_direction === 'lower_is_better';
				const dnfVal = game.allow_dnf && game.max_score !== null ? game.max_score + 1 : null;
				const [pbRes, srRes] = await Promise.all([
					supabase.from('scores').select('raw_score').eq('game_id', game.id).eq('player_id', player.id!).neq('session_id', session!.id),
					supabase.from('scores').select('raw_score,session_id,player_id').eq('game_id', game.id),
				]);
				const filterDnf = (vals: number[]) => dnfVal !== null ? vals.filter(v => v !== dnfVal) : vals;
				const pbVals = filterDnf((pbRes.data ?? []).map(s => s.raw_score));
				const srVals = filterDnf(
					(srRes.data ?? [])
						.filter(s => !(s.session_id === session!.id && s.player_id === player.id))
						.map(s => s.raw_score)
				);
				const prevPB = pbVals.length > 0 ? (lower ? Math.min(...pbVals) : Math.max(...pbVals)) : null;
				const prevSR = srVals.length > 0 ? (lower ? Math.min(...srVals) : Math.max(...srVals)) : null;
				const beats = (v: number, ref: number) => lower ? v < ref : v > ref;
				const fmtd = formatScore(rawScore, game);
				const emoji = game.icon_emoji ?? '🎮';
				if (prevSR !== null && beats(rawScore, prevSR)) {
					await supabase.from('messages').insert({ session_id: session!.id, player_id: null, player_name: '__sr__', content: `${name} set a new server record for ${emoji} ${game.name} — ${fmtd}` });
				} else if (prevPB !== null && beats(rawScore, prevPB)) {
					await supabase.from('messages').insert({ session_id: session!.id, player_id: null, player_name: '__pb__', content: `${name} achieved a new personal best in ${emoji} ${game.name} — ${fmtd}` });
				}
			}
		};
	}

	onMount(async () => {
		// Verify stored player ID still exists (handles DB reset / admin deletion)
		if (player.id) {
			const { data } = await supabase.from('players').select('id').eq('id', player.id).maybeSingle();
			if (!data) playerStore.clear();
		}

		if (!session) {
			// No active session yet (e.g. sitting on the countdown screen) — watch for one
			// appearing so the page flips over to it without a manual refresh.
			subscriptions.push(
				supabase
					.channel('sessions:upcoming')
					.on('postgres_changes', { event: '*', schema: 'public', table: 'sessions' }, () => invalidateAll())
					.subscribe()
			);
			return;
		}

		// Watch scores for live updates
		subscriptions.push(
			supabase
				.channel(`scores:${session.id}`)
				.on('postgres_changes', { event: '*', schema: 'public', table: 'scores', filter: `session_id=eq.${session.id}` }, async (payload) => {
					const row = payload.new as { player_id?: string; game_id?: string; raw_score?: number };
					const isOtherInsert = row.player_id && row.player_id !== player.id && payload.eventType === 'INSERT';
					if (isOtherInsert) sounds.others();

					await refreshScores();

					if (isOtherInsert && row.raw_score !== undefined) {
						const game = session.session_games.find(sg => sg.game.id === row.game_id)?.game;
						if (game) {
							const entry = scores.find(s => s.player_id === row.player_id && s.game_id === row.game_id);
							const pData = entry?.player as { name: string; alias?: string | null } | null | undefined;
							addToast(toastMessage(row.raw_score, game, pData ? displayName(pData) : 'Someone'));
						}
					}
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
	<div class="fixed top-4 left-1/2 -translate-x-1/2 z-50 flex flex-col gap-2 items-center pointer-events-none">
		{#each toasts as toast (toast.id)}
			<div
				transition:fly={{ y: -16, duration: 200 }}
				class="rounded-xl border border-ayu-border bg-zinc-950 px-5 py-3 text-base font-medium text-white shadow-2xl"
			>
				{toast.message}
			</div>
		{/each}
	</div>
{/if}

{#if !session}
	{@const next = data.nextSession}
	<NextSessionCountdown {next} />
{:else}
	<div class="space-y-8">
		<!-- Yesterday's winners -->
		{#if data.prevWinners?.length}
			<div>
				<!-- svelte-ignore a11y_no_static_element_interactions -->
				<p
					class="mb-2 inline-block cursor-default border-b border-dotted border-ayu-gold/50 text-xs font-semibold uppercase tracking-widest text-ayu-gold transition-colors hover:border-ayu-gold hover:text-white"
					onmouseenter={showPrevRankingTip}
					onmouseleave={hidePrevRankingTip}
				>Yesterday's Winners</p>
				<div class="grid gap-2" style="grid-template-columns: repeat({data.prevWinners.length}, minmax(0, 1fr))">
					{#each data.prevWinners as w}
						<div class="rounded-xl border px-3 py-3 text-center
							{w.medal === '🥇' ? 'border-ayu-gold/40 bg-yellow-400/10' : w.medal === '🥈' ? 'border-zinc-500/40 bg-slate-400/8' : 'border-amber-700/40 bg-amber-800/10'}">
							<p class="text-2xl">{w.medal}</p>
							<a href="/player/{w.player_id}" class="mt-1 block text-sm font-semibold leading-tight text-white transition hover:text-ayu-gold">
								{w.player_name}
							</a>
							{#if w.goldStreak}
								<p class="mt-1 text-xs text-orange-400">🔥×{w.goldStreak}</p>
							{/if}
							<p class="mt-1 text-xs text-ayu-muted">
								{[w.gold > 0 ? `🥇×${w.gold}` : '', w.silver > 0 ? `🥈×${w.silver}` : '', w.bronze > 0 ? `🥉×${w.bronze}` : ''].filter(Boolean).join(' ')}
							</p>
						</div>
					{/each}
				</div>
			</div>
		{/if}

		<!-- Featured game (if any) -->
		{#if specialGame}
			<div>
				<h2 class="mb-3 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-widest text-ayu-gold">
					⭐ Featured Game
					<span class="group relative inline-flex">
						<svg class="w-3.5 h-3.5 cursor-default" style="color: var(--color-ayu-blue)" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
							<circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="8"/><path d="M12 12v4"/>
						</svg>
						<span class="pointer-events-none absolute bottom-full left-1/2 mb-2 w-48 -translate-x-1/2 rounded-lg border border-ayu-border bg-zinc-900 px-2.5 py-1.5 text-xs font-normal normal-case tracking-normal text-zinc-300 opacity-0 shadow-xl transition-opacity group-hover:opacity-100">
							Winning this game is worth +1 more point than regular games
						</span>
					</span>
				</h2>
				{#if player.id}
					<div class="rounded-xl" style="box-shadow:0px 0px 12px 7px rgba(249,226,175,0.35)">
						<LobbyCard
							game={specialGame.game}
							sessionId={session.id}
							playerId={player.id}
							myScore={myScores.get(specialGame.game.id) ?? null}
							onscored={makeOnscoredHandler(specialGame.game)}
							rankedScores={scoresHidden ? [] : (gameScoresMap.get(specialGame.game.id) ?? [])}
							currentPlayerId={player.id}
							onCopyResults={() => copyGameResults(specialGame.game, gameScoresMap.get(specialGame.game.id) ?? [])}
							resultsCopied={copiedGameId === specialGame.game.id}
							featured
							{prevWinnerId}
							{prevFullRanking}
						/>
					</div>
				{:else}
					<div class="flex items-center gap-3 rounded-xl border border-ayu-gold/60 bg-ayu-surface px-4 py-3">
						<span class="text-2xl">{specialGame.game.icon_emoji ?? '🎮'}</span>
						<span class="text-white">{specialGame.game.name}</span>
						<span class="ml-auto text-xs font-semibold text-ayu-gold">⭐ Featured</span>
					</div>
				{/if}
			</div>
		{/if}

		<!-- Regular game cards -->
		{#if regularGames.length > 0}
			<div>
				<h2 class="mb-3 text-xs font-semibold uppercase tracking-widest text-ayu-muted">Tonight's Games</h2>
				<div class="space-y-2">
					{#if player.id}
						{#each regularGames as sg, i}
							<LobbyCard
								game={sg.game}
								sessionId={session.id}
								playerId={player.id}
								myScore={myScores.get(sg.game.id) ?? null}
								onscored={makeOnscoredHandler(sg.game)}
								rankedScores={scoresHidden ? [] : (gameScoresMap.get(sg.game.id) ?? [])}
								currentPlayerId={player.id}
								onCopyResults={() => copyGameResults(sg.game, gameScoresMap.get(sg.game.id) ?? [])}
								resultsCopied={copiedGameId === sg.game.id}
								colorIndex={i}
								{prevWinnerId}
								{prevFullRanking}
							/>
						{/each}
					{:else}
						{#each regularGames as sg}
							<div class="flex items-center gap-3 rounded-xl border border-ayu-border bg-ayu-surface px-4 py-3">
								<span class="text-2xl">{sg.game.icon_emoji ?? '🎮'}</span>
								<span class="text-white">{sg.game.name}</span>
							</div>
						{/each}
					{/if}
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
					{#if shareCopied}
						✓ Copied!
					{:else}
						<span class="flex items-center gap-1.5">
							<svg width="13" height="13" viewBox="0 0 24 24" fill="none">
								<path fill-rule="evenodd" clip-rule="evenodd" d="M19.6495 0.799565C18.4834 -0.72981 16.0093 0.081426 16.0093 1.99313V3.91272C12.2371 3.86807 9.65665 5.16473 7.9378 6.97554C6.10034 8.9113 5.34458 11.3314 5.02788 12.9862C4.86954 13.8135 5.41223 14.4138 5.98257 14.6211C6.52743 14.8191 7.25549 14.7343 7.74136 14.1789C9.12036 12.6027 11.7995 10.4028 16.0093 10.5464V13.0069C16.0093 14.9186 18.4834 15.7298 19.6495 14.2004L23.3933 9.29034C24.2022 8.2294 24.2022 6.7706 23.3933 5.70966L19.6495 0.799565Z" fill="currentColor"/>
								<path d="M7 1.00391H4C2.34315 1.00391 1 2.34705 1 4.00391V20.0039C1 21.6608 2.34315 23.0039 4 23.0039H20C21.6569 23.0039 23 21.6608 23 20.0039V17.0039C23 16.4516 22.5523 16.0039 22 16.0039C21.4477 16.0039 21 16.4516 21 17.0039V20.0039C21 20.5562 20.5523 21.0039 20 21.0039H4C3.44772 21.0039 3 20.5562 3 20.0039V4.00391C3 3.45162 3.44772 3.00391 4 3.00391H7C7.55228 3.00391 8 2.55619 8 2.00391C8 1.45162 7.55228 1.00391 7 1.00391Z" fill="currentColor"/>
							</svg>
							Share
						</span>
					{/if}
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
			<!-- Live standings -->
			{#if tally.length > 0}
				<div>
					<div class="mb-3 flex items-center justify-between">
						<h2 class="text-xs font-semibold uppercase tracking-widest text-ayu-muted">Live Standings</h2>
						<button
							onclick={copyStandings}
							class="flex items-center gap-1 text-xs transition {standingsCopied ? 'text-ayu-green' : 'text-ayu-muted hover:text-white'}"
							title="Copy standings"
						>
							{#if standingsCopied}
								<svg width="13" height="13" viewBox="0 0 24 24" fill="none"><path d="M5 13l4 4L19 7" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
								Copied!
							{:else}
								<svg width="13" height="13" viewBox="0 0 24 24" fill="none">
									<path fill-rule="evenodd" clip-rule="evenodd" d="M19.6495 0.799565C18.4834 -0.72981 16.0093 0.081426 16.0093 1.99313V3.91272C12.2371 3.86807 9.65665 5.16473 7.9378 6.97554C6.10034 8.9113 5.34458 11.3314 5.02788 12.9862C4.86954 13.8135 5.41223 14.4138 5.98257 14.6211C6.52743 14.8191 7.25549 14.7343 7.74136 14.1789C9.12036 12.6027 11.7995 10.4028 16.0093 10.5464V13.0069C16.0093 14.9186 18.4834 15.7298 19.6495 14.2004L23.3933 9.29034C24.2022 8.2294 24.2022 6.7706 23.3933 5.70966L19.6495 0.799565Z" fill="currentColor"/>
									<path d="M7 1.00391H4C2.34315 1.00391 1 2.34705 1 4.00391V20.0039C1 21.6608 2.34315 23.0039 4 23.0039H20C21.6569 23.0039 23 21.6608 23 20.0039V17.0039C23 16.4516 22.5523 16.0039 22 16.0039C21.4477 16.0039 21 16.4516 21 17.0039V20.0039C21 20.5562 20.5523 21.0039 20 21.0039H4C3.44772 21.0039 3 20.5562 3 20.0039V4.00391C3 3.45162 3.44772 3.00391 4 3.00391H7C7.55228 3.00391 8 2.55619 8 2.00391C8 1.45162 7.55228 1.00391 7 1.00391Z" fill="currentColor"/>
								</svg>
								Share
							{/if}
						</button>
					</div>
					<div class="rounded-xl border border-ayu-border bg-ayu-surface p-4">
						<MedalTally {tally} currentPlayerId={player.id} playerStats={playerDayStats} {prevRankMap} {completedPlayerIds} {prevWinnerId} {prevFullRanking} {totalGames} {playerGameCounts} {featuredWinnerId} />
					</div>
				</div>
			{/if}



			<!-- Badges -->
			{#if sessionBadges.length > 0}
				<div class="rounded-xl border border-ayu-border bg-ayu-surface p-5">
					<h2 class="mb-4 text-xs font-semibold uppercase tracking-widest text-ayu-muted">Badges</h2>
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
								<div class="pointer-events-none absolute bottom-full left-0 mb-2 z-10 w-48 rounded-lg border border-ayu-border bg-zinc-900 px-3 py-2 text-xs text-zinc-300 opacity-0 shadow-lg transition-opacity group-hover:opacity-100">
									{badge.description}
								</div>
							</div>
						{/each}
					</div>
				</div>
			{/if}
		{/if}
	</div>
{/if}

{#if prevRankingTipVisible && prevFullRanking.length > 0}
	<div
		class="pointer-events-none fixed z-50 w-52 rounded-lg border border-ayu-border bg-zinc-900 px-3 py-2 text-xs shadow-xl"
		style="left:{prevRankingTipX}px;top:{prevRankingTipY}px"
	>
		<div class="space-y-1">
			{#each prevFullRanking as r}
				<div class="flex items-center justify-between gap-3">
					<span class="{r.rank === 1 ? 'text-ayu-gold' : 'text-zinc-300'}">#{r.rank} {r.player_name}</span>
					<span class="font-mono text-ayu-muted">{r.total}</span>
				</div>
			{/each}
		</div>
	</div>
{/if}
