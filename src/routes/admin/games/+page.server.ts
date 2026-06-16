import { supabase } from '$lib/supabase';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	const { data: games } = await supabase.from('games').select('*').order('name');
	return { games: games ?? [] };
};
