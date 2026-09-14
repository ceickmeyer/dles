import { supabase } from '$lib/supabase';
import { paginateAll } from '$lib/utils';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	const { data: players } = await supabase.from('players').select('*').order('name');

	const allScoreMeta = await paginateAll<{ player_id: string; session_id: string }>((from, to) =>
		supabase.from('scores').select('player_id, session_id').range(from, to)
	);

	const sessionsByPlayer = new Map<string, Set<string>>();
	for (const s of allScoreMeta) {
		if (!sessionsByPlayer.has(s.player_id)) sessionsByPlayer.set(s.player_id, new Set());
		sessionsByPlayer.get(s.player_id)!.add(s.session_id);
	}

	return {
		players: (players ?? []).map((p) => ({
			...p,
			sessions_played: sessionsByPlayer.get(p.id)?.size ?? 0
		}))
	};
};
