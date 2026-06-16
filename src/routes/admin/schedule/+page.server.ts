import { supabase } from '$lib/supabase';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	const [{ data: schedule }, { data: games }] = await Promise.all([
		supabase.from('weekly_schedule').select('*').order('day_of_week'),
		supabase.from('games').select('id, name, icon_emoji').order('name')
	]);

	return {
		schedule: schedule ?? [],
		games: games ?? []
	};
};
