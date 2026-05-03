import { createClient } from '@supabase/supabase-js';
import { PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY } from '$env/static/public';
import type { Database } from '$lib/database.types';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async () => {
	const supabase = createClient<Database>(PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY);

	const { data: session } = await supabase
		.from('sessions')
		.select('name, date, status, session_games(game:games(name, icon_emoji))')
		.in('status', ['lobby', 'active'])
		.order('date', { ascending: false })
		.limit(1)
		.maybeSingle();

	return { ogSession: session };
};
