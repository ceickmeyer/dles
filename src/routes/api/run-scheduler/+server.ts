import { createClient } from '@supabase/supabase-js';
import { PUBLIC_SUPABASE_URL } from '$env/static/public';
import { env } from '$env/dynamic/private';
import type { Database } from '$lib/database.types';
import { runScheduler } from '$lib/scheduler';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ request }) => {
	const auth = request.headers.get('authorization');
	if (!env.CRON_SECRET || auth !== `Bearer ${env.CRON_SECRET}`) {
		return new Response('Unauthorized', { status: 401 });
	}

	if (!env.SUPABASE_SERVICE_ROLE_KEY) {
		return new Response('Server misconfigured', { status: 500 });
	}

	// Service role key bypasses RLS — required for server-side session creation
	const supabase = createClient<Database>(PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
	const result = await runScheduler(supabase);
	return json(result);
};
