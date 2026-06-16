import { supabase } from '$lib/supabase';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	const { data: sessions } = await supabase
		.from('sessions')
		.select('id, name, date, status')
		.order('date', { ascending: false })
		.limit(14);

	return { sessions: sessions ?? [] };
};
