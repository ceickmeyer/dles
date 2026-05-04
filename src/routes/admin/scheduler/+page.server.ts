import { createClient } from '@supabase/supabase-js';
import { PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY } from '$env/static/public';
import type { Database } from '$lib/database.types';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	const supabase = createClient<Database>(PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY);

	const [{ data: schedules }, { data: games }] = await Promise.all([
		supabase.from('schedules').select('*').order('created_at', { ascending: true }),
		supabase.from('games').select('id, name, icon_emoji')
	]);

	const gameMap = new Map((games ?? []).map(g => [g.id, g]));

	const enriched = (schedules ?? []).map(s => ({
		...s,
		games: (s.game_ids as string[]).map(id => gameMap.get(id)).filter(Boolean) as { id: string; name: string; icon_emoji: string | null }[]
	}));

	return { schedules: enriched };
};
