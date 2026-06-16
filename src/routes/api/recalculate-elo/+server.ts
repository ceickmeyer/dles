import { json } from '@sveltejs/kit';
import { supabase } from '$lib/supabase';
import { refreshEloCache } from '$lib/eloCache';
import type { RequestHandler } from './$types';

// Called by the admin UI after scores are manually edited/deleted, since
// those mutations bypass the scheduler's normal finish-session hook.
export const POST: RequestHandler = async () => {
	await refreshEloCache(supabase);
	return json({ ok: true });
};
