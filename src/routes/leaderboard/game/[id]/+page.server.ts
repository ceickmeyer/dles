import { supabase } from '$lib/supabase';
import { error } from '@sveltejs/kit';
import { displayName } from '$lib/utils';
import type { PageServerLoad } from './$types';

const MIN_PLAYS = 3;
const ROLLING_WINDOW = 10;

export const load: PageServerLoad = async ({ params }) => {
	const { data: game } = await supabase
		.from('games')
		.select('*')
		.eq('id', params.id)
		.maybeSingle();

	if (!game) error(404, 'Game not found');

	const { data: sessions } = await supabase
		.from('sessions')
		.select('id')
		.eq('status', 'finished');

	if (!sessions || sessions.length === 0) {
		return { game, rows: [], sessionCount: 0 };
	}

	type ScoreRow = { player_id: string; raw_score: number; submitted_at: string; player: { name: string; alias?: string | null } };

	const sessionIds = sessions.map(s => s.id);
	const scores: ScoreRow[] = [];
	for (let from = 0; ; from += 1000) {
		const { data: page } = await supabase
			.from('scores')
			.select('player_id, raw_score, submitted_at, player:players(name, alias)')
			.eq('game_id', params.id)
			.in('session_id', sessionIds)
			.order('submitted_at', { ascending: true })
			.range(from, from + 999);
		if (!page?.length) break;
		scores.push(...(page as ScoreRow[]));
		if (page.length < 1000) break;
	}

	if (scores.length === 0) {
		return { game, rows: [], sessionCount: sessions.length };
	}

	const asc = game.scoring_direction === 'lower_is_better';
	const dnfValue = game.allow_dnf && game.max_score !== null ? game.max_score + 1 : null;

	const byPlayer = new Map<string, { name: string; vals: number[] }>();
	for (const s of scores) {
		const name = displayName(s.player as { name: string; alias?: string | null });
		if (!byPlayer.has(s.player_id)) byPlayer.set(s.player_id, { name, vals: [] });
		byPlayer.get(s.player_id)!.vals.push(s.raw_score);
	}

	const rows = [...byPlayer.entries()]
		.filter(([, { vals }]) => vals.length >= MIN_PLAYS)
		.map(([player_id, { name, vals }]) => {
			const rolling = vals.slice(-ROLLING_WINDOW);
			const avg = rolling.reduce((a, b) => a + b, 0) / rolling.length;
			const nonDnf = dnfValue !== null ? vals.filter(v => v !== dnfValue) : vals;
			const best = nonDnf.length > 0 ? (asc ? Math.min(...nonDnf) : Math.max(...nonDnf)) : null;
			const worst = nonDnf.length > 0 ? (asc ? Math.max(...nonDnf) : Math.min(...nonDnf)) : null;
			return { player_id, name, avg, best, worst, played: vals.length };
		})
		.sort((a, b) => asc ? a.avg - b.avg : b.avg - a.avg);

	return { game, rows, sessionCount: sessions.length };
};
