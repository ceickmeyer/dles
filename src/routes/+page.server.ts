import { supabase } from '$lib/supabase';
import { sortSessionGames, displayName } from '$lib/utils';
import { rankScores, computeSessionTally, sortTally } from '$lib/scoring';
import type { PageServerLoad } from './$types';

function computeNextSession(schedules: { name: string; days_of_week: number[]; session_name_template: string }[]) {
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
					const dateLabel = new Intl.DateTimeFormat('en-US', { weekday: 'long', month: 'long', day: 'numeric' }).format(date);
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
	game: { scoring_direction: string; max_score: number | null; allow_dnf: boolean };
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
			group.map(s => ({
				player_id: s.player_id,
				player_name: displayName(s.player),
				raw_score: s.raw_score,
			})),
			group[0].game.scoring_direction as 'higher_is_better' | 'lower_is_better',
			group[0].game.allow_dnf && group[0].game.max_score !== null ? group[0].game.max_score + 1 : null
		)
	}));
	return sortTally([...computeSessionTally(gameResults).values()]);
}

async function loadPrevWinners(excludeSessionId: string | null) {
	let sessionsQuery = supabase
		.from('sessions')
		.select('id')
		.eq('status', 'finished')
		.order('date', { ascending: false })
		.limit(10);

	if (excludeSessionId) sessionsQuery = sessionsQuery.neq('id', excludeSessionId);

	const { data: sessions } = await sessionsQuery;
	if (!sessions?.length) return null;

	const [{ data: allScores }, { data: specialGameRows }] = await Promise.all([
		supabase
			.from('scores')
			.select('session_id, game_id, player_id, raw_score, player:players(name, alias), game:games(scoring_direction, max_score, allow_dnf)')
			.in('session_id', sessions.map(s => s.id)),
		supabase
			.from('session_games')
			.select('session_id, game_id')
			.eq('is_special', true)
			.in('session_id', sessions.map(s => s.id)),
	]);

	if (!allScores?.length) return null;

	const specialGameMap = new Map((specialGameRows ?? []).map(sg => [sg.session_id, sg.game_id]));

	const prevId = sessions[0].id;
	const prevScores = (allScores as ScoreRow[]).filter(s => s.session_id === prevId);
	if (!prevScores.length) return null;

	const tally = tallyFromScores(prevScores, specialGameMap.get(prevId));
	if (!tally.length) return null;

	const outOf = tally.length;
	const ranks = tally.map((row, _, arr) => {
		const first = arr.findIndex(r => r.gold === row.gold && r.silver === row.silver && r.bronze === row.bronze);
		return { player_id: row.player_id, rank: first + 1, outOf };
	});

	const fullRanking = tally.map((row, idx) => ({
		player_id: row.player_id,
		player_name: row.player_name,
		rank: ranks[idx].rank,
		total: row.total,
	}));

	const goldWinnerId = tally[0].player_id;
	let goldStreak = 1;
	for (let i = 1; i < sessions.length; i++) {
		const sessionScores = (allScores as ScoreRow[]).filter(s => s.session_id === sessions[i].id);
		const winner = tallyFromScores(sessionScores, specialGameMap.get(sessions[i].id))[0]?.player_id ?? null;
		if (winner === goldWinnerId) goldStreak++;
		else break;
	}

	const medalEmoji = (rank: number) => rank === 1 ? '🥇' : rank === 2 ? '🥈' : '🥉';

	return {
		winners: tally
			.map((t, idx) => ({ ...t, rank: ranks[idx].rank }))
			.filter(t => t.rank <= 3)
			.map(t => ({
				player_id: t.player_id,
				player_name: t.player_name,
				medal: medalEmoji(t.rank),
				gold: t.gold, silver: t.silver, bronze: t.bronze,
				goldStreak: t.rank === 1 && goldStreak >= 2 ? goldStreak : null,
			})),
		ranks,
		fullRanking,
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
			supabase.from('schedules').select('name, days_of_week, session_name_template').eq('active', true),
			loadPrevWinners(null),
		]);
		const nextSession = schedules ? computeNextSession(schedules) : null;
		return { session: null, scores: [], nextSession, prevWinners: prevData?.winners ?? null, prevRanks: prevData?.ranks ?? [], prevFullRanking: prevData?.fullRanking ?? [] };
	}

	const sessionGames = sortSessionGames(session.session_games ?? []);

	const [{ data: scores }, prevData] = await Promise.all([
		supabase.from('scores').select('*, player:players(name, alias)').eq('session_id', session.id),
		loadPrevWinners(session.id),
	]);

	return {
		session: { ...session, session_games: sessionGames },
		scores: scores ?? [],
		nextSession: null,
		prevWinners: prevData?.winners ?? null,
		prevRanks: prevData?.ranks ?? [],
		prevFullRanking: prevData?.fullRanking ?? [],
	};
};
