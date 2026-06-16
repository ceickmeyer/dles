import { supabase } from '$lib/supabase';
import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params }) => {
	const { data: game } = await supabase.from('games').select('*').eq('id', params.id).single();
	if (!game) error(404, 'Game not found');
	return { game };
};
