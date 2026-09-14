import { createClient } from '@supabase/supabase-js';
import { PUBLIC_SUPABASE_URL } from '$env/static/public';
import { env } from '$env/dynamic/private';
import { json } from '@sveltejs/kit';
import { supabase } from '$lib/supabase';
import { refreshEloCache } from '$lib/eloCache';
import { logRun } from '$lib/schedulerLog';
import type { Database } from '$lib/database.types';
import type { Config } from '@sveltejs/adapter-vercel';
import type { RequestHandler } from './$types';

// Full ELO recompute across every session ever played — grows daily, so give
// it real headroom instead of Vercel's default function timeout.
export const config: Config = { maxDuration: 60 };

// Called by the admin UI after scores are manually edited/deleted, since
// those mutations bypass the scheduler's normal finish-session hook.
export const POST: RequestHandler = async ({ request }) => {
	const authHeader = request.headers.get('authorization');
	const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
	if (!token) return new Response('Unauthorized', { status: 401 });

	const {
		data: { user },
		error
	} = await supabase.auth.getUser(token);
	if (error || !user) return new Response('Unauthorized', { status: 401 });

	if (!env.SUPABASE_SERVICE_ROLE_KEY) {
		return new Response('Server misconfigured', { status: 500 });
	}

	// Service-role client so the scheduler_runs log write bypasses RLS
	// regardless of the caller's own session.
	const admin = createClient<Database>(PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
	const startedAt = Date.now();
	try {
		await refreshEloCache(admin);
		await logRun(admin, 'recalculate-elo', true, { durationMs: Date.now() - startedAt });
		return json({ ok: true });
	} catch (err) {
		await logRun(admin, 'recalculate-elo', false, { error: err, durationMs: Date.now() - startedAt });
		throw err;
	}
};
