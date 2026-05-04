import { createClient } from '@supabase/supabase-js';
import { PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY } from '$env/static/public';
import { error } from '@sveltejs/kit';
import type { Database } from '$lib/database.types';
import { rankScores, computeSessionTally, sortTally } from '$lib/scoring';
import { displayName, formatScore } from '$lib/utils';
import { computeBadges, computeStreaks } from '$lib/badges';
import { computeSessionBadges } from '$lib/gameBadges';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params }) => {
	const supabase = createClient<Database>(PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY);

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
			medals: { gold: 0, silver: 0, bronze: 0, total: 0 },
			nights: 0, winRate: 0, winStreak: 0, podiumStreak: 0, bestWinStreak: 0,
			badges: [],
			favGame: null,
			perGame: [],
			recentSessions: []
		};
	}

	const sessionIds = sessions.map(s => s.id);
	const sessionMeta = new Map(sessions.map(s => [s.id, { name: s.name, date: s.date }]));

	// Fetch all scores in these sessions (not just this player — needed to rank properly)
	const { data: allScores } = await supabase
		.from('scores')
		.select('*, player:players(name, alias), game:games(id, name, icon_emoji, scoring_direction, max_score, allow_dnf)')
		.in('session_id', sessionIds);

	if (!allScores || allScores.length === 0) {
		return {
			player,
			displayName: displayName(player),
			medals: { gold: 0, silver: 0, bronze: 0, total: 0 },
			nights: 0, winRate: 0, winStreak: 0, podiumStreak: 0, bestWinStreak: 0,
			badges: [],
			favGame: null,
			perGame: [],
			recentSessions: []
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

	// Session history for streaks and recent-sessions display
	const playerHistory: { won: boolean; podium: boolean }[] = [];
	const recentSessions: { name: string; date: string; gold: number; silver: number; bronze: number; total: number; rank: number; outOf: number }[] = [];

	let overallGold = 0, overallSilver = 0, overallBronze = 0;

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

		const sessionGameResults = [...byGame.values()].map(group => ({
			scores: rankScores(
				group.map(s => ({
					player_id: s.player_id,
					player_name: displayName(s.player as { name: string; alias?: string | null }),
					raw_score: s.raw_score
				})),
				(group[0].game as { scoring_direction: 'higher_is_better' | 'lower_is_better' }).scoring_direction
			)
		}));

		// Per-game medal tracking for this player
		for (const group of [...byGame.values()]) {
			const game = group[0].game as { id: string; name: string; icon_emoji: string | null; scoring_direction: string; max_score: number | null; allow_dnf: boolean };
			const ranked = rankScores(
				group.map(s => ({
					player_id: s.player_id,
					player_name: '',
					raw_score: s.raw_score
				})),
				game.scoring_direction as 'higher_is_better' | 'lower_is_better'
			);
			const mine = ranked.find(r => r.player_id === params.id);
			if (!mine) continue;

			const existing = perGameMap.get(game.id) ?? { name: game.name, emoji: game.icon_emoji ?? '🎮', scoring_direction: game.scoring_direction, gold: 0, silver: 0, bronze: 0, total: 0, played: 0 };
			if (mine.medal === 'gold') existing.gold++;
			if (mine.medal === 'silver') existing.silver++;
			if (mine.medal === 'bronze') existing.bronze++;
			if (mine.medal) existing.total++;
			existing.played++;
			perGameMap.set(game.id, existing);
		}

		// Session-level tally
		const sessionTally = sortTally([...computeSessionTally(sessionGameResults).values()]);
		const myTally = sessionTally.find(t => t.player_id === params.id);
		if (!myTally) continue;

		const topGolds = sessionTally[0]?.gold ?? 0;
		const myRank = sessionTally.findIndex(t => t.player_id === params.id) + 1;

		overallGold += myTally.gold;
		overallSilver += myTally.silver;
		overallBronze += myTally.bronze;

		playerHistory.push({
			won: myTally.gold > 0 && myTally.gold === topGolds,
			podium: myRank <= 3 && myTally.total > 0
		});

		recentSessions.push({
			name: sessionMeta.get(sessionId)?.name ?? '',
			date: sessionMeta.get(sessionId)?.date ?? '',
			gold: myTally.gold,
			silver: myTally.silver,
			bronze: myTally.bronze,
			total: myTally.total,
			rank: myRank,
			outOf: sessionTally.length
		});
	}

	const nights = recentSessions.length;
	const totalMedals = overallGold + overallSilver + overallBronze;
	const winRate = totalMedals > 0 ? Math.round((overallGold / totalMedals) * 100) : 0;
	const { winStreak, podiumStreak, bestWinStreak } = computeStreaks(playerHistory);

	const golds = new Map([...perGameMap.entries()].filter(([, v]) => v.gold > 0));
	const favGame = golds.size > 0
		? [...golds.values()].sort((a, b) => b.gold - a.gold)[0]
		: null;

	const medals = { gold: overallGold, silver: overallSilver, bronze: overallBronze, total: totalMedals };
	const badgeStats = { ...medals, nights, winStreak, podiumStreak, bestWinStreak };
	const achievementBadges = computeBadges(badgeStats);

	// Game-specific badges: compute best score per game, award badges for best performances
	const bestScorePerGame = new Map<string, number>();
	const gameInfoMap = new Map<string, { id: string; name: string; icon_emoji: string | null; share_parser: string | null; max_score: number | null; allow_dnf: boolean; scoring_direction: 'higher_is_better' | 'lower_is_better' }>();
	for (const score of allScores) {
		if (score.player_id !== params.id) continue;
		const g = score.game as { id: string; name: string; icon_emoji: string | null; share_parser: string | null; scoring_direction: 'higher_is_better' | 'lower_is_better'; max_score: number | null; allow_dnf: boolean };
		gameInfoMap.set(g.id, g);
		const prev = bestScorePerGame.get(g.id);
		const better = g.scoring_direction === 'lower_is_better'
			? (prev === undefined || score.raw_score < prev)
			: (prev === undefined || score.raw_score > prev);
		if (better) bestScorePerGame.set(g.id, score.raw_score);
	}
	const gameBadges = computeSessionBadges(bestScorePerGame, [...gameInfoMap.values()]);

	const perGame = [...perGameMap.values()].sort((a, b) => b.gold - a.gold || b.total - a.total);

	return {
		player,
		displayName: displayName(player),
		medals,
		nights,
		winRate,
		winStreak,
		podiumStreak,
		bestWinStreak,
		achievementBadges,
		gameBadges,
		favGame,
		perGame,
		recentSessions: recentSessions.slice(-10).reverse()
	};
};
