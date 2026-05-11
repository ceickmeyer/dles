import { createClient } from '@supabase/supabase-js';
import { PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY } from '$env/static/public';
import type { Database } from '$lib/database.types';
import { displayName } from '$lib/utils';
import type { PageServerLoad } from './$types';

const MIN_PLAYS = 3;
const ROLLING_WINDOW = 10;

export const load: PageServerLoad = async () => {
	const supabase = createClient<Database>(PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY);

	const { data: sessions } = await supabase
		.from('sessions')
		.select('id')
		.eq('status', 'finished');

	if (!sessions || sessions.length === 0) return { perGame: [], sessionCount: 0 };

	const { data: scores } = await supabase
		.from('scores')
		.select('raw_score, player_id, game_id, submitted_at, player:players(name, alias), game:games(id, name, icon_emoji, scoring_direction, max_score, allow_dnf, share_parser)')
		.in('session_id', sessions.map(s => s.id))
		.order('submitted_at', { ascending: true });

	if (!scores || scores.length === 0) return { perGame: [], sessionCount: sessions.length };

	type GameMeta = {
		id: string;
		name: string;
		emoji: string;
		direction: 'higher_is_better' | 'lower_is_better';
		maxScore: number | null;
		allowDnf: boolean;
		shareParser: string | null;
	};

	const gameData = new Map<string, GameMeta & { playerScores: Map<string, { name: string; vals: number[] }> }>();

	for (const score of scores) {
		const g = score.game as { id: string; name: string; icon_emoji: string | null; scoring_direction: 'higher_is_better' | 'lower_is_better'; max_score: number | null; allow_dnf: boolean; share_parser: string | null };
		if (!gameData.has(g.id)) {
			gameData.set(g.id, {
				id: g.id,
				name: g.name,
				emoji: g.icon_emoji ?? '🎮',
				direction: g.scoring_direction,
				maxScore: g.max_score,
				allowDnf: g.allow_dnf,
				shareParser: g.share_parser,
				playerScores: new Map()
			});
		}
		const entry = gameData.get(g.id)!;
		const name = displayName(score.player as { name: string; alias?: string | null });
		if (!entry.playerScores.has(score.player_id)) {
			entry.playerScores.set(score.player_id, { name, vals: [] });
		}
		entry.playerScores.get(score.player_id)!.vals.push(score.raw_score);
	}

	const perGame = [...gameData.values()].flatMap(({ playerScores, ...meta }) => {
		const asc = meta.direction === 'lower_is_better';
		const dnfValue = meta.allowDnf && meta.maxScore !== null ? meta.maxScore + 1 : null;

		const rows = [...playerScores.entries()]
			.filter(([, { vals }]) => vals.length >= MIN_PLAYS)
			.map(([player_id, { name, vals }]) => {
				const rolling = vals.slice(-ROLLING_WINDOW);
				const avg = rolling.reduce((a, b) => a + b, 0) / rolling.length;
				const nonDnf = dnfValue !== null ? vals.filter(v => v !== dnfValue) : vals;
				const best = nonDnf.length > 0 ? (asc ? Math.min(...nonDnf) : Math.max(...nonDnf)) : null;
				const dnfCount = dnfValue !== null ? vals.filter(v => v === dnfValue).length : 0;
				return { player_id, name, avg, best, played: vals.length, dnfCount };
			})
			.sort((a, b) => asc ? a.avg - b.avg : b.avg - a.avg);

		if (rows.length === 0) return [];
		return [{ ...meta, rows }];
	}).sort((a, b) => a.name.localeCompare(b.name));

	return { perGame, sessionCount: sessions.length };
};
