import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, Json } from './database.types';

// Persists a record of each cron/admin-triggered run to `scheduler_runs`.
// Exists because Vercel's function logs aren't reachable on the Hobby plan —
// this is how failures get diagnosed without them.
export async function logRun(
	supabase: SupabaseClient<Database>,
	endpoint: string,
	ok: boolean,
	opts: { error?: unknown; context?: Json; durationMs?: number } = {}
): Promise<void> {
	const error =
		opts.error === undefined
			? null
			: opts.error instanceof Error
				? `${opts.error.message}\n${opts.error.stack ?? ''}`
				: String(opts.error);

	// Best-effort — a logging failure should never mask the original result.
	try {
		await supabase.from('scheduler_runs').insert({
			endpoint,
			ok,
			error,
			context: opts.context ?? null,
			duration_ms: opts.durationMs ?? null
		});
	} catch {
		// swallow — logging is diagnostic, not load-bearing
	}
}
