import { createClient } from '@supabase/supabase-js';
import { PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY } from '$env/static/public';
import type { Database } from '$lib/database.types';
import { rankScores, computeSessionTally, sortTally } from '$lib/scoring';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	const supabase = createClient<Database>(PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY);

	const { data: sessions } = await supabase
		.from('sessions')
		.select('id')
		.eq('status', 'finished');

	if (!sessions || sessions.length === 0) return { tally: [], sessionCount: 0 };

	const sessionIds = sessions.map((s) => s.id);

	const { data: scores } = await supabase
		.from('scores')
		.select('*, player:players(name), game:games(scoring_direction)')
		.in('session_id', sessionIds);

	if (!scores || scores.length === 0) return { tally: [], sessionCount: sessions.length };

	// Group by session+game to rank
	const bySessionGame = new Map<string, typeof scores>();
	for (const score of scores) {
		const key = `${score.session_id}:${score.game_id}`;
		if (!bySessionGame.has(key)) bySessionGame.set(key, []);
		bySessionGame.get(key)!.push(score);
	}

	const allGameResults = [...bySessionGame.values()].map((group) => ({
		scores: rankScores(
			group.map((s) => ({
				player_id: s.player_id,
				player_name: (s.player as { name: string }).name,
				raw_score: s.raw_score
			})),
			(group[0].game as { scoring_direction: 'higher_is_better' | 'lower_is_better' })
				.scoring_direction
		)
	}));

	const tally = sortTally([...computeSessionTally(allGameResults).values()]);

	// Add nights played per player
	const nightsPlayed = new Map<string, Set<string>>();
	for (const score of scores) {
		if (!nightsPlayed.has(score.player_id)) nightsPlayed.set(score.player_id, new Set());
		nightsPlayed.get(score.player_id)!.add(score.session_id);
	}

	const tallyWithNights = tally.map((t) => ({
		...t,
		nights: nightsPlayed.get(t.player_id)?.size ?? 0
	}));

	return { tally: tallyWithNights, sessionCount: sessions.length };
};
