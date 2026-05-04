import { createClient } from '@supabase/supabase-js';
import { PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY } from '$env/static/public';
import type { Database } from '$lib/database.types';
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
	return { isToday: best.daysAhead === 0, label: best.label };
}

export const load: PageServerLoad = async () => {
	const supabase = createClient<Database>(PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY);

	const { data: session } = await supabase
		.from('sessions')
		.select('*, session_games(sort_order, game:games(*))')
		.in('status', ['active', 'lobby', 'paused'])
		.or('expires_at.is.null,expires_at.gt.' + new Date().toISOString())
		.order('created_at', { ascending: false })
		.limit(1)
		.maybeSingle();

	if (!session) {
		const { data: schedules } = await supabase
			.from('schedules')
			.select('name, days_of_week, session_name_template')
			.eq('active', true);

		const nextSession = schedules ? computeNextSession(schedules) : null;
		return { session: null, scores: [], nextSession };
	}

	const sessionGames = [...(session.session_games ?? [])].sort(
		(a, b) => a.sort_order - b.sort_order
	);

	const { data: scores } = await supabase
		.from('scores')
		.select('*, player:players(name, alias)')
		.eq('session_id', session.id);

	return {
		session: { ...session, session_games: sessionGames },
		scores: scores ?? [],
		nextSession: null
	};
};
