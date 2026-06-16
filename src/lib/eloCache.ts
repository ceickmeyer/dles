import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from './database.types';
import { computeElo, type EloEntry } from './elo';

type ScoreRow = {
	session_id: string;
	game_id: string;
	player_id: string;
	raw_score: number;
	game: { scoring_direction: 'higher_is_better' | 'lower_is_better'; allow_dnf: boolean; max_score: number | null };
};

// Recomputes ELO for every player from scratch and writes the result to the
// player_elo cache table. Call this whenever finished-session data changes
// (a session finishes, or a score is corrected/deleted) — not on every page view.
export async function refreshEloCache(supabase: SupabaseClient<Database>): Promise<void> {
	const { data: sessions } = await supabase
		.from('sessions')
		.select('id')
		.eq('status', 'finished')
		.order('date', { ascending: true });

	if (!sessions?.length) return;

	const sessionIds = sessions.map(s => s.id);
	const allScores: ScoreRow[] = [];
	for (let from = 0; ; from += 1000) {
		const { data: page } = await supabase
			.from('scores')
			.select('session_id, game_id, player_id, raw_score, game:games(scoring_direction, allow_dnf, max_score)')
			.in('session_id', sessionIds)
			.range(from, from + 999);
		if (!page?.length) break;
		allScores.push(...(page as unknown as ScoreRow[]));
		if (page.length < 1000) break;
	}

	const entries: EloEntry[] = allScores.map(s => ({
		session_id: s.session_id,
		game_id: s.game_id,
		player_id: s.player_id,
		raw_score: s.raw_score,
		scoring_direction: s.game.scoring_direction,
		allow_dnf: s.game.allow_dnf,
		max_score: s.game.max_score,
	}));

	const eloMap = computeElo(sessionIds, entries);

	const rows = [...eloMap.entries()].map(([player_id, r]) => ({
		player_id,
		elo: r.elo,
		prev_elo: r.prevElo,
		sessions: r.sessions,
		matchups: r.matchups,
		history: r.history,
		updated_at: new Date().toISOString(),
	}));

	if (rows.length > 0) {
		await supabase.from('player_elo').upsert(rows, { onConflict: 'player_id' });
	}
}
