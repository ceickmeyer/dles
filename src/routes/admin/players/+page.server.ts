import { createClient } from '@supabase/supabase-js';
import { PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY } from '$env/static/public';
import type { Database } from '$lib/database.types';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	const supabase = createClient<Database>(PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY);

	const { data: players } = await supabase.from('players').select('*').order('name');

	const allScoreMeta: { player_id: string; session_id: string }[] = [];
	for (let from = 0; ; from += 1000) {
		const { data: page } = await supabase
			.from('scores')
			.select('player_id, session_id')
			.range(from, from + 999);
		if (!page?.length) break;
		allScoreMeta.push(...page);
		if (page.length < 1000) break;
	}

	const sessionsByPlayer = new Map<string, Set<string>>();
	for (const s of allScoreMeta) {
		if (!sessionsByPlayer.has(s.player_id)) sessionsByPlayer.set(s.player_id, new Set());
		sessionsByPlayer.get(s.player_id)!.add(s.session_id);
	}

	return {
		players: (players ?? []).map(p => ({
			...p,
			sessions_played: sessionsByPlayer.get(p.id)?.size ?? 0,
		}))
	};
};
