import { createClient } from '@supabase/supabase-js';
import { PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY } from '$env/static/public';
import { error } from '@sveltejs/kit';
import type { Database } from '$lib/database.types';
import { rankScores, computeSessionTally, sortTally } from '$lib/scoring';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params }) => {
	const supabase = createClient<Database>(PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY);

	const { data: session } = await supabase
		.from('sessions')
		.select('*, session_games(sort_order, game:games(*))')
		.eq('id', params.session_id)
		.single();

	if (!session) error(404, 'Session not found');

	const sessionGames = [...(session.session_games ?? [])].sort(
		(a, b) => a.sort_order - b.sort_order
	);

	const { data: scores } = await supabase
		.from('scores')
		.select('*, player:players(name)')
		.eq('session_id', session.id);

	const allScores = scores ?? [];

	const gameResults = sessionGames.map(({ game }) => ({
		game,
		scores: rankScores(
			allScores
				.filter((s) => s.game_id === game.id)
				.map((s) => ({
					player_id: s.player_id,
					player_name: (s.player as { name: string }).name,
					raw_score: s.raw_score
				})),
			game.scoring_direction
		)
	}));

	const tally = sortTally([...computeSessionTally(gameResults).values()]);

	return { session: { ...session, session_games: sessionGames }, gameResults, tally };
};
