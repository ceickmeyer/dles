import { supabase } from '$lib/supabase';
import { sortSessionGames, displayName, paginateAll } from '$lib/utils';
import { rankScores, computeSessionTally, sortTally, LEADERBOARD_MIN_DAYS } from '$lib/scoring';
import { assignPlayerColors } from '$lib/playerColors';
import type { PageServerLoad } from './$types';

function computeNextSession(
	schedules: { name: string; days_of_week: number[]; session_name_template: string }[]
) {
	const now = new Date();
	const todayStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }).format(now);
	const [y, m, d] = todayStr.split('-').map(Number);
	const todayNY = new Date(y, m - 1, d);
	const todayDow = todayNY.getDay();

	let best: { daysAhead: number; label: string } | null = null;

	for (const schedule of schedules) {
		const days = schedule.days_of_week as number[];
		for (let ahead = 0; ahead <= 7; ahead++) {
			const dow = (todayDow + ahead) % 7;
			if (days.includes(dow)) {
				if (!best || ahead < best.daysAhead) {
					const date = new Date(todayNY.getTime() + ahead * 86400000);
					const dateLabel = new Intl.DateTimeFormat('en-US', {
						weekday: 'long',
						month: 'long',
						day: 'numeric'
					}).format(date);
					const label = schedule.session_name_template.replace('{date}', dateLabel);
					best = { daysAhead: ahead, label };
				}
				break;
			}
		}
	}

	if (!best) return null;
	return { isToday: best.daysAhead === 0, daysAhead: best.daysAhead, label: best.label };
}

type ScoreRow = {
	session_id: string;
	game_id: string;
	player_id: string;
	raw_score: number;
	player: { name: string; alias?: string | null };
	game: {
		name: string;
		icon_emoji: string | null;
		scoring_direction: string;
		max_score: number | null;
		allow_dnf: boolean;
	};
};

function tallyFromScores(scores: ScoreRow[], specialGameId?: string): ReturnType<typeof sortTally> {
	const byGame = new Map<string, ScoreRow[]>();
	for (const s of scores) {
		if (!byGame.has(s.game_id)) byGame.set(s.game_id, []);
		byGame.get(s.game_id)!.push(s);
	}
	const gameResults = [...byGame.entries()].map(([gameId, group]) => ({
		isSpecial: gameId === specialGameId,
		scores: rankScores(
			group.map((s) => ({
				player_id: s.player_id,
				player_name: displayName(s.player),
				raw_score: s.raw_score
			})),
			group[0].game.scoring_direction as 'higher_is_better' | 'lower_is_better',
			group[0].game.allow_dnf && group[0].game.max_score !== null
				? group[0].game.max_score + 1
				: null
		)
	}));
	return sortTally([...computeSessionTally(gameResults).values()]);
}

async function loadPrevWinners(excludeSessionId: string | null) {
	let sessionsQuery = supabase
		.from('sessions')
		.select('id, name')
		.eq('status', 'finished')
		.order('date', { ascending: false })
		.limit(10);

	if (excludeSessionId) sessionsQuery = sessionsQuery.neq('id', excludeSessionId);

	const { data: sessions } = await sessionsQuery;
	if (!sessions?.length) return null;

	const sessionIds = sessions.map((s) => s.id);
	const [allScores, { data: specialGameRows }] = await Promise.all([
		paginateAll<ScoreRow>((from, to) =>
			supabase
				.from('scores')
				.select(
					'session_id, game_id, player_id, raw_score, player:players(name, alias), game:games(name, icon_emoji, scoring_direction, max_score, allow_dnf)'
				)
				.in('session_id', sessionIds)
				.range(from, to) as unknown as PromiseLike<{ data: ScoreRow[] | null }>
		),
		supabase.from('session_games').select('session_id, game_id').eq('is_special', true).in(
			'session_id',
			sessionIds
		)
	]);

	if (!allScores.length) return null;

	const specialGameMap = new Map((specialGameRows ?? []).map((sg) => [sg.session_id, sg.game_id]));

	const prevId = sessions[0].id;
	const prevScores = allScores.filter((s) => s.session_id === prevId);
	if (!prevScores.length) return null;

	const tally = tallyFromScores(prevScores, specialGameMap.get(prevId));
	if (!tally.length) return null;

	const outOf = tally.length;
	const ranks = tally.map((row, _, arr) => {
		const first = arr.findIndex(
			(r) => r.gold === row.gold && r.silver === row.silver && r.bronze === row.bronze
		);
		return { player_id: row.player_id, rank: first + 1, outOf };
	});

	const fullRanking = tally.map((row, idx) => ({
		player_id: row.player_id,
		player_name: row.player_name,
		rank: ranks[idx].rank,
		total: row.total
	}));

	const goldWinnerId = tally[0].player_id;
	let goldStreak = 1;
	for (let i = 1; i < sessions.length; i++) {
		const sessionScores = allScores.filter((s) => s.session_id === sessions[i].id);
		const winner =
			tallyFromScores(sessionScores, specialGameMap.get(sessions[i].id))[0]?.player_id ?? null;
		if (winner === goldWinnerId) goldStreak++;
		else break;
	}

	// Every player who gained ELO, lost ELO, or held steady that night — a
	// separate axis from medal tally, since a favorite tying/losing to an
	// underdog can outscore a low-stakes sweep.
	const nameById = new Map<string, string>();
	const gameData = new Map<string, { name: string; emoji: string }>();
	for (const s of prevScores) {
		nameById.set(s.player_id, displayName(s.player));
		gameData.set(s.game_id, { name: s.game.name, emoji: s.game.icon_emoji ?? '🎮' });
	}
	const prevFeaturedGameId = specialGameMap.get(prevId) ?? null;

	const { data: playerElos } = await supabase
		.from('player_elo')
		.select('player_id, elo, sessions, history');
	type HistoryEntry = {
		session_id: string;
		delta: number;
		games?: { game_id: string; delta: number }[];
	};
	const eloChanges = (playerElos ?? [])
		.map((row) => {
			const history = (row.history ?? []) as HistoryEntry[];
			const entry = history.find((h) => h.session_id === prevId);
			if (!entry) return null;
			// Same per-game breakdown shown on the leaderboard's ELO row tooltip.
			const breakdown =
				entry.games
					?.map((g) => ({
						name: gameData.get(g.game_id)?.name ?? '?',
						emoji: gameData.get(g.game_id)?.emoji ?? '🎮',
						delta: g.delta,
						isFeatured: g.game_id === prevFeaturedGameId
					}))
					.sort((a, b) => {
						if (a.isFeatured && !b.isFeatured) return -1;
						if (!a.isFeatured && b.isFeatured) return 1;
						return a.name.localeCompare(b.name);
					}) ?? null;
			return {
				player_id: row.player_id,
				player_name: nameById.get(row.player_id) ?? '?',
				delta: Math.round(entry.delta),
				breakdown
			};
		})
		.filter((x): x is NonNullable<typeof x> => x !== null)
		.sort((a, b) => b.delta - a.delta);

	// Same color a player's line has on the ELO Over Time chart, so a row here
	// is visually the same "person" as their chart line — only assigned once
	// they've qualified for that chart (LEADERBOARD_MIN_DAYS sessions).
	const qualifiedIdsByEloDesc = (playerElos ?? [])
		.filter((r) => r.sessions >= LEADERBOARD_MIN_DAYS)
		.sort((a, b) => b.elo - a.elo)
		.map((r) => r.player_id);
	const colorByPlayerId = assignPlayerColors(qualifiedIdsByEloDesc);

	return {
		// Every participant, not just medal-winners -- this is now a numbered
		// standings list (see the rank-based display), so it should cover the
		// same roster as the Elo column rather than dropping anyone who went
		// scoreless on medals but still played (and still moved in Elo).
		winners: tally
			.map((t, idx) => ({ ...t, rank: ranks[idx].rank }))
			.map((t) => ({
				player_id: t.player_id,
				player_name: t.player_name,
				rank: t.rank,
				gold: t.gold,
				silver: t.silver,
				bronze: t.bronze,
				goldStreak: t.rank === 1 && goldStreak >= 2 ? goldStreak : null,
				color: colorByPlayerId.get(t.player_id) ?? null
			})),
		ranks,
		fullRanking,
		eloChanges: eloChanges.map((e) => ({ ...e, color: colorByPlayerId.get(e.player_id) ?? null })),
		sessionName: sessions[0].name as string
	};
}

export const load: PageServerLoad = async () => {
	const { data: session } = await supabase
		.from('sessions')
		.select('*, session_games(sort_order, is_special, game:games(*))')
		.in('status', ['active', 'lobby', 'paused'])
		.or('expires_at.is.null,expires_at.gt.' + new Date().toISOString())
		.order('created_at', { ascending: false })
		.limit(1)
		.maybeSingle();

	if (!session) {
		const [{ data: schedules }, prevData] = await Promise.all([
			supabase
				.from('schedules')
				.select('name, days_of_week, session_name_template')
				.eq('active', true),
			loadPrevWinners(null)
		]);
		const nextSession = schedules ? computeNextSession(schedules) : null;
		return {
			session: null,
			scores: [],
			nextSession,
			prevWinners: prevData?.winners ?? null,
			prevRanks: prevData?.ranks ?? [],
			prevFullRanking: prevData?.fullRanking ?? [],
			prevEloChanges: prevData?.eloChanges ?? [],
			prevSessionName: prevData?.sessionName ?? null
		};
	}

	const sessionGames = sortSessionGames(session.session_games ?? []);

	const [{ data: scores }, prevData] = await Promise.all([
		supabase.from('scores').select('*, player:players(name, alias)').eq('session_id', session.id),
		loadPrevWinners(session.id)
	]);

	return {
		session: { ...session, session_games: sessionGames },
		scores: scores ?? [],
		nextSession: null,
		prevWinners: prevData?.winners ?? null,
		prevRanks: prevData?.ranks ?? [],
		prevFullRanking: prevData?.fullRanking ?? [],
		prevEloChanges: prevData?.eloChanges ?? [],
		prevSessionName: prevData?.sessionName ?? null
	};
};
