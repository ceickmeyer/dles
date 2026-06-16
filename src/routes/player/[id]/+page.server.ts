import { supabase } from '$lib/supabase';
import { error } from '@sveltejs/kit';
import { rankScores, computeSessionTally, sortTally } from '$lib/scoring';
import { displayName } from '$lib/utils';
import { computeStreaks } from '$lib/badges';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params }) => {
	const { data: player } = await supabase
		.from('players')
		.select('*')
		.eq('id', params.id)
		.maybeSingle();

	if (!player) error(404, 'Player not found');

	// Fetch all scores for this player across finished sessions
	const { data: sessions } = await supabase
		.from('sessions')
		.select('id, name, date')
		.eq('status', 'finished')
		.order('date', { ascending: true });

	if (!sessions || sessions.length === 0) {
		return {
			player,
			displayName: displayName(player),
			nights: 0, bestWinStreak: 0, bestPodiumStreak: 0, sessionWins: 0,
			perGame: [],
			rankHistory: [],
			playerElo: null,
		};
	}

	const sessionIds = sessions.map(s => s.id);

	// Fetch all scores — paginated to avoid Supabase's 1000-row default limit
	const allScores: any[] = [];
	for (let from = 0; ; from += 1000) {
		const { data: page } = await supabase
			.from('scores')
			.select('*, player:players(name, alias), game:games(id, name, icon_emoji, scoring_direction, max_score, allow_dnf)')
			.in('session_id', sessionIds)
			.order('session_id').order('game_id').order('player_id')
			.range(from, from + 999);
		if (!page?.length) break;
		allScores.push(...page);
		if (page.length < 1000) break;
	}

	if (allScores.length === 0) {
		return {
			player,
			displayName: displayName(player),
			nights: 0, bestWinStreak: 0, bestPodiumStreak: 0, sessionWins: 0,
			perGame: [],
			rankHistory: [],
			playerElo: null,
		};
	}

	// Group by session (in date order)
	const bySession = new Map<string, typeof allScores>();
	for (const score of allScores) {
		if (!bySession.has(score.session_id)) bySession.set(score.session_id, []);
		bySession.get(score.session_id)!.push(score);
	}

	// Per-game stats for this player
	const perGameMap = new Map<string, { name: string; emoji: string; scoring_direction: string; gold: number; silver: number; bronze: number; total: number; played: number }>();

	// Session history for streaks
	const playerHistory: { won: boolean; podium: boolean }[] = [];
	const sessionRankMap = new Map<string, { rank: number; outOf: number }>();

	let sessionWins = 0;

	for (const sessionId of sessionIds) {
		const sessionScores = bySession.get(sessionId);
		if (!sessionScores) continue;

		const myScores = sessionScores.filter(s => s.player_id === params.id);
		if (myScores.length === 0) continue; // player didn't participate

		// Group by game for this session
		const byGame = new Map<string, typeof sessionScores>();
		for (const s of sessionScores) {
			if (!byGame.has(s.game_id)) byGame.set(s.game_id, []);
			byGame.get(s.game_id)!.push(s);
		}

		const sessionGameResults = [...byGame.values()].map(group => {
			const g = group[0].game as { scoring_direction: 'higher_is_better' | 'lower_is_better'; max_score: number | null; allow_dnf: boolean };
			return {
				scores: rankScores(
					group.map(s => ({
						player_id: s.player_id,
						player_name: displayName(s.player as { name: string; alias?: string | null }),
						raw_score: s.raw_score
					})),
					g.scoring_direction,
					g.allow_dnf && g.max_score !== null ? g.max_score + 1 : null
				)
			};
		});

		// Per-game medal tracking for this player
		for (const group of [...byGame.values()]) {
			const game = group[0].game as { id: string; name: string; icon_emoji: string | null; scoring_direction: string; max_score: number | null; allow_dnf: boolean };
			const ranked = rankScores(
				group.map(s => ({
					player_id: s.player_id,
					player_name: '',
					raw_score: s.raw_score
				})),
				game.scoring_direction as 'higher_is_better' | 'lower_is_better',
				game.allow_dnf && game.max_score !== null ? game.max_score + 1 : null
			);
			const mine = ranked.find(r => r.player_id === params.id);
			if (!mine) continue;

			const existing = perGameMap.get(game.id) ?? { name: game.name, emoji: game.icon_emoji ?? '🎮', scoring_direction: game.scoring_direction, gold: 0, silver: 0, bronze: 0, total: 0, played: 0 };
			if (mine.medal === 'gold') { existing.gold++; existing.total += 4; }
			else if (mine.medal === 'silver') { existing.silver++; existing.total += 2; }
			else if (mine.medal === 'bronze') { existing.bronze++; existing.total += 1; }
			existing.played++;
			perGameMap.set(game.id, existing);
		}

		// Session-level tally
		const sessionTally = sortTally([...computeSessionTally(sessionGameResults).values()]);
		const myTally = sessionTally.find(t => t.player_id === params.id);
		if (!myTally) continue;

		const myRank = sessionTally.findIndex(t => t.gold === myTally.gold && t.silver === myTally.silver && t.bronze === myTally.bronze) + 1;

		sessionRankMap.set(sessionId, { rank: myRank, outOf: sessionTally.length });
		if (myRank === 1) sessionWins++;

		playerHistory.push({
			won: myRank === 1,
			podium: myRank <= 3 && myTally.total > 0
		});
	}

	const nights = sessionRankMap.size;
	const { bestWinStreak, bestPodiumStreak } = computeStreaks(playerHistory);

	const perGame = [...perGameMap.values()].sort((a, b) => b.gold - a.gold || b.total - a.total);

	const rankHistory = sessions.slice(-10).map(s => ({
		name: s.name,
		date: s.date,
		rank: sessionRankMap.get(s.id)?.rank ?? null,
		outOf: sessionRankMap.get(s.id)?.outOf ?? null,
	}));

	// ELO — read from cache (refreshed by the scheduler / admin edits, not recomputed per request)
	const { data: eloRow } = await supabase
		.from('player_elo')
		.select('elo, prev_elo')
		.eq('player_id', params.id)
		.maybeSingle();
	const playerElo = eloRow ? { elo: eloRow.elo, prevElo: eloRow.prev_elo } : null;

	return {
		player,
		displayName: displayName(player),
		nights,
		bestWinStreak,
		bestPodiumStreak,
		sessionWins,
		perGame,
		rankHistory,
		playerElo,
	};
};
