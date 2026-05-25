import { createClient } from '@supabase/supabase-js';
import { PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY } from '$env/static/public';
import type { Database } from '$lib/database.types';
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

type SessionRow = { id: string; session_games: { game: { id: string; scoring_direction: string } }[] };
type ScoreRow = { session_id: string; game_id: string; player_id: string; raw_score: number; player: { name: string; alias?: string | null } };

function sessionGoldWinner(session: SessionRow, allScores: ScoreRow[]): string | null {
	const sessionScores = allScores.filter(s => s.session_id === session.id);
	if (!sessionScores.length) return null;
	const games = session.session_games.map(sg => sg.game);
	const gameResults = games.map(game => ({
		scores: rankScores(
			sessionScores
				.filter(s => s.game_id === game.id)
				.map(s => ({
					player_id: s.player_id,
					player_name: displayName(s.player),
					raw_score: s.raw_score,
				})),
			game.scoring_direction as 'higher_is_better' | 'lower_is_better'
		)
	}));
	const tally = sortTally([...computeSessionTally(gameResults).values()]);
	return tally[0]?.player_id ?? null;
}

async function loadPrevWinners(supabase: ReturnType<typeof createClient<Database>>, excludeSessionId: string | null) {
	let sessionsQuery = supabase
		.from('sessions')
		.select('id, name, session_games(game:games(id, scoring_direction))')
		.order('created_at', { ascending: false })
		.limit(10);

	if (excludeSessionId) sessionsQuery = sessionsQuery.neq('id', excludeSessionId);

	const { data: sessions } = await sessionsQuery;
	if (!sessions?.length) return null;

	const { data: allScores } = await supabase
		.from('scores')
		.select('session_id, game_id, player_id, raw_score, player:players(name, alias)')
		.in('session_id', sessions.map(s => s.id));

	if (!allScores?.length) return null;

	const prev = sessions[0] as SessionRow;
	const prevScores = allScores.filter(s => s.session_id === prev.id) as ScoreRow[];
	if (!prevScores.length) return null;

	const games = prev.session_games.map(sg => sg.game);
	const gameResults = games.map(game => ({
		scores: rankScores(
			prevScores
				.filter(s => s.game_id === game.id)
				.map(s => ({
					player_id: s.player_id,
					player_name: displayName(s.player as { name: string; alias?: string | null }),
					raw_score: s.raw_score,
				})),
			game.scoring_direction as 'higher_is_better' | 'lower_is_better'
		)
	}));

	const tally = sortTally([...computeSessionTally(gameResults).values()]);
	if (!tally.length) return null;

	const goldWinnerId = tally[0].player_id;
	let goldStreak = 1;
	for (let i = 1; i < sessions.length; i++) {
		const winner = sessionGoldWinner(sessions[i] as SessionRow, allScores as ScoreRow[]);
		if (winner === goldWinnerId) goldStreak++;
		else break;
	}

	return tally.slice(0, 3).map((t, i) => ({
		player_id: t.player_id,
		player_name: t.player_name,
		medal: i === 0 ? '🥇' : i === 1 ? '🥈' : '🥉',
		gold: t.gold, silver: t.silver, bronze: t.bronze,
		goldStreak: i === 0 && goldStreak >= 2 ? goldStreak : null,
	}));
}

export const load: PageServerLoad = async () => {
	const supabase = createClient<Database>(PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY);

	const { data: session } = await supabase
		.from('sessions')
		.select('*, session_games(sort_order, is_special, game:games(*))')
		.in('status', ['active', 'lobby', 'paused'])
		.or('expires_at.is.null,expires_at.gt.' + new Date().toISOString())
		.order('created_at', { ascending: false })
		.limit(1)
		.maybeSingle();

	if (!session) {
		const [{ data: schedules }, prevWinners] = await Promise.all([
			supabase.from('schedules').select('name, days_of_week, session_name_template').eq('active', true),
			loadPrevWinners(supabase, null),
		]);
		const nextSession = schedules ? computeNextSession(schedules) : null;
		return { session: null, scores: [], nextSession, prevWinners };
	}

	const sessionGames = sortSessionGames(session.session_games ?? []);

	const [{ data: scores }, prevWinners] = await Promise.all([
		supabase.from('scores').select('*, player:players(name, alias)').eq('session_id', session.id),
		loadPrevWinners(supabase, session.id),
	]);

	return {
		session: { ...session, session_games: sessionGames },
		scores: scores ?? [],
		nextSession: null,
		prevWinners,
	};
};
