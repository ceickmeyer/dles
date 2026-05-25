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

async function loadPrevWinners(supabase: ReturnType<typeof createClient<Database>>, excludeSessionId: string | null) {
	let query = supabase
		.from('sessions')
		.select('id, name, session_games(game:games(id, scoring_direction))')
		.order('created_at', { ascending: false })
		.limit(1);

	if (excludeSessionId) query = query.neq('id', excludeSessionId);

	const { data: prev } = await query.maybeSingle();
	if (!prev) return null;

	const { data: prevScores } = await supabase
		.from('scores')
		.select('game_id, player_id, raw_score, player:players(name, alias)')
		.eq('session_id', prev.id);

	if (!prevScores?.length) return null;

	const games = (prev.session_games ?? []).map((sg: { game: { id: string; scoring_direction: string } }) => sg.game);
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
	return tally.slice(0, 3).map((t, i) => ({
		player_id: t.player_id,
		player_name: t.player_name,
		medal: i === 0 ? '🥇' : i === 1 ? '🥈' : '🥉',
		gold: t.gold, silver: t.silver, bronze: t.bronze,
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
