import { createClient } from '@supabase/supabase-js';
import { PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY } from '$env/static/public';
import { env } from '$env/dynamic/private';
import type { Database } from '$lib/database.types';
import { runScheduler } from '$lib/scheduler';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	if (env.SUPABASE_SERVICE_ROLE_KEY) {
		const serviceClient = createClient<Database>(PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
		try {
			await runScheduler(serviceClient);
		} catch {
			// Non-fatal — dashboard still loads even if scheduler errors
		}
	}

	const anon = createClient<Database>(PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY);
	const { data: sessions } = await anon
		.from('sessions')
		.select('id, name, date, status')
		.order('date', { ascending: false });

	return { sessions: sessions ?? [] };
};
