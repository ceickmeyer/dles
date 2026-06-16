import { supabase } from '$lib/supabase';
import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params }) => {
	const { data: session } = await supabase
		.from('sessions')
		.select('id, name, status')
		.eq('id', params.session_id)
		.single();

	if (!session) error(404, 'Session not found');

	const { data: game } = await supabase
		.from('games')
		.select('*')
		.eq('id', params.game_id)
		.single();

	if (!game) error(404, 'Game not found');

	// Verify game is part of this session
	const { data: sg } = await supabase
		.from('session_games')
		.select('id')
		.eq('session_id', params.session_id)
		.eq('game_id', params.game_id)
		.single();

	if (!sg) error(404, 'Game not in session');

	return { session, game };
};
