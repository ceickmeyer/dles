import { supabase } from '$lib/supabase';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async () => {
	const { data: session } = await supabase
		.from('sessions')
		.select('name, date, status, expires_at, session_games(game:games(name, icon_emoji))')
		.in('status', ['lobby', 'active'])
		.order('date', { ascending: false })
		.limit(1)
		.maybeSingle();

	return { ogSession: session };
};
