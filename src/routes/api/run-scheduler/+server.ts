import { env } from '$env/dynamic/private';
import { createAdminClient } from '$lib/supabaseAdmin';
import { runScheduler } from '$lib/scheduler';
import { logRun } from '$lib/schedulerLog';
import { json } from '@sveltejs/kit';
import type { Config } from '@sveltejs/adapter-vercel';
import type { RequestHandler } from './$types';

// This finishes stale sessions and, when it does, triggers a full ELO
// recompute across every session ever played — that grows daily and can
// exceed Vercel's default function timeout as history piles up.
export const config: Config = { maxDuration: 60 };

export const GET: RequestHandler = async ({ request }) => {
	// Triggered by an external cron service (cron-job.org), not Vercel Cron —
	// it sends whatever bearer token was configured on that job, which is this
	// secret.
	const auth = request.headers.get('authorization');
	if (!env.SCHEDULER_SECRET || auth !== `Bearer ${env.SCHEDULER_SECRET}`) {
		return new Response('Unauthorized', { status: 401 });
	}

	if (!env.SUPABASE_SERVICE_ROLE_KEY) {
		return new Response('Server misconfigured', { status: 500 });
	}

	const supabase = createAdminClient(env.SUPABASE_SERVICE_ROLE_KEY);
	const startedAt = Date.now();
	try {
		const result = await runScheduler(supabase);
		await logRun(supabase, 'run-scheduler', true, {
			context: { ...result },
			durationMs: Date.now() - startedAt
		});
		return json(result);
	} catch (err) {
		await logRun(supabase, 'run-scheduler', false, {
			error: err,
			durationMs: Date.now() - startedAt
		});
		throw err;
	}
};
