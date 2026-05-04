import { createClient } from '@supabase/supabase-js';
import { PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY } from '$env/static/public';
import { error } from '@sveltejs/kit';
import type { Database } from '$lib/database.types';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params }) => {
	const supabase = createClient<Database>(PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY);

	const [{ data: schedule }, { data: games }] = await Promise.all([
		supabase.from('schedules').select('*').eq('id', params.id).maybeSingle(),
		supabase.from('games').select('id, name, icon_emoji').order('name')
	]);

	if (!schedule) error(404, 'Schedule not found');

	return { schedule, games: games ?? [] };
};
