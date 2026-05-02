import { createClient } from '@supabase/supabase-js';
import { PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY } from '$env/static/public';
import { error } from '@sveltejs/kit';
import type { Database } from '$lib/database.types';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params }) => {
	const supabase = createClient<Database>(PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY);

	const { data: session } = await supabase
		.from('sessions')
		.select('*, session_games(*, game:games(*))')
		.eq('id', params.id)
		.single();

	if (!session) error(404, 'Session not found');

	const sessionGames = [...(session.session_games ?? [])].sort(
		(a, b) => a.sort_order - b.sort_order
	);

	const { data: scores } = await supabase
		.from('scores')
		.select('*, player:players(name)')
		.eq('session_id', session.id);

	const { data: allGames } = await supabase.from('games').select('*').order('name');

	return {
		session: { ...session, session_games: sessionGames },
		scores: scores ?? [],
		allGames: allGames ?? []
	};
};
