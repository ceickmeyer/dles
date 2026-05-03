import { createClient } from '@supabase/supabase-js';
import { PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY } from '$env/static/public';
import type { Database } from '$lib/database.types';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	const supabase = createClient<Database>(PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY);

	// Get the most recent active/lobby/paused session that hasn't expired
	const { data: session } = await supabase
		.from('sessions')
		.select('*, session_games(sort_order, game:games(*))')
		.in('status', ['active', 'lobby', 'paused'])
		.or('expires_at.is.null,expires_at.gt.' + new Date().toISOString())
		.order('created_at', { ascending: false })
		.limit(1)
		.maybeSingle();

	if (!session) return { session: null, scores: [] };

	const sessionGames = [...(session.session_games ?? [])].sort(
		(a, b) => a.sort_order - b.sort_order
	);

	const { data: scores } = await supabase
		.from('scores')
		.select('*, player:players(name)')
		.eq('session_id', session.id);

	return { session: { ...session, session_games: sessionGames }, scores: scores ?? [] };
};
