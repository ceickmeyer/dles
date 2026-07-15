import { json } from '@sveltejs/kit';
import { supabase } from '$lib/supabase';
import { refreshEloCache } from '$lib/eloCache';
import type { RequestHandler } from './$types';

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

	await refreshEloCache(supabase);
	return json({ ok: true });
};
