import { createClient } from '@supabase/supabase-js';
import { PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY } from '$env/static/public';
import { error } from '@sveltejs/kit';
import type { Database } from '$lib/database.types';
import { displayName } from '$lib/utils';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params }) => {
	const supabase = createClient<Database>(PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY);

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

	const { data: scores } = await supabase
		.from('scores')
		.select('player_id, raw_score, player:players(name, alias)')
		.eq('game_id', params.id)
		.in('session_id', sessions.map(s => s.id));

	if (!scores || scores.length === 0) {
		return { game, rows: [], sessionCount: sessions.length };
	}

	// Aggregate per player
	const byPlayer = new Map<string, { name: string; scores: number[] }>();
	for (const s of scores) {
		const name = displayName(s.player as { name: string; alias?: string | null });
		if (!byPlayer.has(s.player_id)) byPlayer.set(s.player_id, { name, scores: [] });
		byPlayer.get(s.player_id)!.scores.push(s.raw_score);
	}

	const asc = game.scoring_direction === 'lower_is_better';

	const rows = [...byPlayer.entries()].map(([player_id, { name, scores: playerScores }]) => {
		const avg = playerScores.reduce((a, b) => a + b, 0) / playerScores.length;
		const best = asc ? Math.min(...playerScores) : Math.max(...playerScores);
		const worst = asc ? Math.max(...playerScores) : Math.min(...playerScores);
		return { player_id, name, avg, best, worst, played: playerScores.length };
	}).sort((a, b) => asc ? a.avg - b.avg : b.avg - a.avg);

	return { game, rows, sessionCount: sessions.length };
};
