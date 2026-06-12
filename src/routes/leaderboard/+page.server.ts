import { createClient } from '@supabase/supabase-js';
import { PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY } from '$env/static/public';
import type { Database } from '$lib/database.types';
import { displayName } from '$lib/utils';
import { rankScores } from '$lib/scoring';
import type { PageServerLoad } from './$types';

const MIN_PLAYS = 3;
const ROLLING_WINDOW = 10;
const MIN_DAYS = 10;

export const load: PageServerLoad = async () => {
	const supabase = createClient<Database>(PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY);

	const { data: sessions } = await supabase
		.from('sessions')
		.select('id, date')
		.eq('status', 'finished')
		.order('date', { ascending: false });

	if (!sessions || sessions.length === 0) return { perGame: [], powerRankings: [], sessionCount: 0 };

	type ScoreRow = {
		session_id: string;
		raw_score: number;
		player_id: string;
		game_id: string;
		submitted_at: string;
		player: { name: string; alias?: string | null };
		game: {
			id: string;
			name: string;
			icon_emoji: string | null;
			scoring_direction: 'higher_is_better' | 'lower_is_better';
			max_score: number | null;
			allow_dnf: boolean;
			share_parser: string | null;
		};
	};

	const allScores: ScoreRow[] = [];
	for (let from = 0; ; from += 1000) {
		const { data: page } = await supabase
			.from('scores')
			.select('session_id, raw_score, player_id, game_id, submitted_at, player:players(name, alias), game:games(id, name, icon_emoji, scoring_direction, max_score, allow_dnf, share_parser)')
			.in('session_id', sessions.map(s => s.id))
			.order('submitted_at', { ascending: true })
			.range(from, from + 999);
		if (!page?.length) break;
		allScores.push(...(page as ScoreRow[]));
		if (page.length < 1000) break;
	}

	if (allScores.length === 0) return { perGame: [], powerRankings: [], sessionCount: sessions.length };

	// --- Per-game stats ---
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

	for (const score of allScores) {
		const g = score.game;
		if (!gameData.has(g.id)) {
			gameData.set(g.id, {
				id: g.id, name: g.name, emoji: g.icon_emoji ?? '🎮',
				direction: g.scoring_direction, maxScore: g.max_score,
				allowDnf: g.allow_dnf, shareParser: g.share_parser,
				playerScores: new Map(),
			});
		}
		const entry = gameData.get(g.id)!;
		const name = displayName(score.player as { name: string; alias?: string | null });
		if (!entry.playerScores.has(score.player_id))
			entry.playerScores.set(score.player_id, { name, vals: [] });
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

	// --- Power rankings ---
	type RankEntry = { player_id: string; player_name: string; raw_score: number; scoring_direction: 'higher_is_better' | 'lower_is_better' };
	const bySessionGame = new Map<string, RankEntry[]>();

	for (const score of allScores) {
		const key = `${score.session_id}::${score.game_id}`;
		if (!bySessionGame.has(key)) bySessionGame.set(key, []);
		bySessionGame.get(key)!.push({
			player_id: score.player_id,
			player_name: displayName(score.player as { name: string; alias?: string | null }),
			raw_score: score.raw_score,
			scoring_direction: score.game.scoring_direction,
		});
	}

	const mostRecentSessionId = sessions[0]?.id ?? null;

	function buildRankings(excludeSessionId?: string | null) {
		const pm = new Map<string, { name: string; percentiles: number[]; sessions: Set<string> }>();
		for (const [key, group] of bySessionGame) {
			const sessionId = key.split('::')[0];
			if (excludeSessionId && sessionId === excludeSessionId) continue;
			if (group.length < 2) continue;
			const ranked = rankScores(
				group.map(p => ({ player_id: p.player_id, player_name: p.player_name, raw_score: p.raw_score })),
				group[0].scoring_direction
			);
			const n = group.length;
			for (const r of ranked) {
				const pct = (n - r.rank) / (n - 1) * 100;
				if (!pm.has(r.player_id)) pm.set(r.player_id, { name: r.player_name, percentiles: [], sessions: new Set() });
				const entry = pm.get(r.player_id)!;
				entry.percentiles.push(pct);
				entry.sessions.add(sessionId);
			}
		}
		return [...pm.entries()]
			.filter(([, { sessions }]) => sessions.size >= MIN_DAYS)
			.map(([player_id, { name, percentiles, sessions }]) => ({
				player_id,
				name,
				percentile: percentiles.reduce((a, b) => a + b, 0) / percentiles.length,
				gamesEntered: percentiles.length,
				daysPlayed: sessions.size,
			}))
			.sort((a, b) => b.percentile - a.percentile);
	}

	const current = buildRankings();
	const prev = buildRankings(mostRecentSessionId);
	const prevRankByPlayer = new Map(prev.map((r, i) => [r.player_id, i + 1]));

	const powerRankings = current.map((r, i) => {
		const prevRank = prevRankByPlayer.get(r.player_id) ?? null;
		const movement = prevRank !== null ? prevRank - (i + 1) : null;
		return { ...r, movement };
	});

	return { perGame, powerRankings, sessionCount: sessions.length };
};
