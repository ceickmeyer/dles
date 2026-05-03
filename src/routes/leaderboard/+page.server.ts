import { createClient } from '@supabase/supabase-js';
import { PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY } from '$env/static/public';
import type { Database } from '$lib/database.types';
import { rankScores, computeSessionTally, sortTally } from '$lib/scoring';
import { displayName } from '$lib/utils';
import { computeBadges, computeStreaks } from '$lib/badges';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	const supabase = createClient<Database>(PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY);

	const { data: sessions } = await supabase
		.from('sessions')
		.select('id, date')
		.eq('status', 'finished')
		.order('date', { ascending: true });

	if (!sessions || sessions.length === 0) return { tally: [], sessionCount: 0 };

	const sessionIds = sessions.map(s => s.id);
	const sessionDates = new Map(sessions.map(s => [s.id, s.date]));

	const { data: scores } = await supabase
		.from('scores')
		.select('*, player:players(name, alias), game:games(id, name, icon_emoji, scoring_direction)')
		.in('session_id', sessionIds);

	if (!scores || scores.length === 0) return { tally: [], sessionCount: sessions.length };

	// Group by session for streak + per-session tally
	const bySession = new Map<string, typeof scores>();
	// Group by session+game for overall tally
	const bySessionGame = new Map<string, typeof scores>();

	for (const score of scores) {
		const sk = score.session_id;
		if (!bySession.has(sk)) bySession.set(sk, []);
		bySession.get(sk)!.push(score);

		const sgk = `${score.session_id}:${score.game_id}`;
		if (!bySessionGame.has(sgk)) bySessionGame.set(sgk, []);
		bySessionGame.get(sgk)!.push(score);
	}

	// Per-player game gold counts for "favorite game"
	const playerGameGolds = new Map<string, Map<string, { name: string; emoji: string; count: number }>>();
	// Per-player session history for streaks (sessions in date order — bySession uses insertion order from the ordered query)
	const playerHistory = new Map<string, { won: boolean; podium: boolean }[]>();

	// Overall tally computation
	const allGameResults = [...bySessionGame.values()].map(group => {
		const game = group[0].game as { id: string; name: string; icon_emoji: string | null; scoring_direction: 'higher_is_better' | 'lower_is_better' };
		const ranked = rankScores(
			group.map(s => ({
				player_id: s.player_id,
				player_name: displayName(s.player as { name: string; alias?: string | null }),
				raw_score: s.raw_score
			})),
			game.scoring_direction
		);
		for (const r of ranked) {
			if (r.medal === 'gold') {
				if (!playerGameGolds.has(r.player_id)) playerGameGolds.set(r.player_id, new Map());
				const map = playerGameGolds.get(r.player_id)!;
				const existing = map.get(game.id) ?? { name: game.name, emoji: game.icon_emoji ?? '🎮', count: 0 };
				map.set(game.id, { ...existing, count: existing.count + 1 });
			}
		}
		return { scores: ranked };
	});

	// Session-by-session streak computation (sessions are in date ASC order)
	for (const sessionId of sessionIds) {
		const sessionScores = bySession.get(sessionId);
		if (!sessionScores) continue;

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

		const sessionTally = sortTally([...computeSessionTally(sessionGameResults).values()]);
		if (sessionTally.length === 0) continue;

		const topGolds = sessionTally[0].gold;
		sessionTally.forEach((t, idx) => {
			if (!playerHistory.has(t.player_id)) playerHistory.set(t.player_id, []);
			playerHistory.get(t.player_id)!.push({
				won: t.gold > 0 && t.gold === topGolds,
				podium: idx < 3 && t.total > 0
			});
		});
	}

	// Assemble final tally
	const tally = sortTally([...computeSessionTally(allGameResults).values()]);

	const nightsPlayed = new Map<string, Set<string>>();
	for (const score of scores) {
		if (!nightsPlayed.has(score.player_id)) nightsPlayed.set(score.player_id, new Set());
		nightsPlayed.get(score.player_id)!.add(score.session_id);
	}

	const enriched = tally.map(t => {
		const golds = playerGameGolds.get(t.player_id);
		const favGame = golds ? [...golds.values()].sort((a, b) => b.count - a.count)[0] : null;
		const nights = nightsPlayed.get(t.player_id)?.size ?? 0;
		const winRate = t.total > 0 ? Math.round((t.gold / t.total) * 100) : 0;
		const history = playerHistory.get(t.player_id) ?? [];
		const { winStreak, podiumStreak, bestWinStreak } = computeStreaks(history);
		const badges = computeBadges({ ...t, nights, winStreak, podiumStreak, bestWinStreak });
		return { ...t, nights, winRate, favGame, winStreak, podiumStreak, bestWinStreak, badges };
	});

	return { tally: enriched, sessionCount: sessions.length };
};
