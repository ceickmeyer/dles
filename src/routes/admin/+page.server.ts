import { createClient } from '@supabase/supabase-js';
import { PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY } from '$env/static/public';
import type { Database } from '$lib/database.types';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	const supabase = createClient<Database>(PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY);

	const { data: sessions } = await supabase
		.from('sessions')
		.select('*')
		.order('date', { ascending: false });

	return { sessions: sessions ?? [] };
};
