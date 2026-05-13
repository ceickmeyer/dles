import { createClient } from '@supabase/supabase-js';
import { PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY } from '$env/static/public';
import type { Database } from '$lib/database.types';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	const supabase = createClient<Database>(PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY);

	const [{ data: schedule }, { data: games }] = await Promise.all([
		supabase.from('weekly_schedule').select('*').order('day_of_week'),
		supabase.from('games').select('id, name, icon_emoji').order('name')
	]);

	return {
		schedule: schedule ?? [],
		games: games ?? []
	};
};
