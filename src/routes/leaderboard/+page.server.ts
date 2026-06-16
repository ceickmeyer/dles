import { supabase } from '$lib/supabase';
import { displayName } from '$lib/utils';
import type { PageServerLoad } from './$types';

const MIN_PLAYS = 3;
const ROLLING_WINDOW = 10;
const MIN_DAYS = 10;

export const load: PageServerLoad = async () => {
	const { data: sessions } = await supabase
		.from('sessions')
		.select('id, name, date')
		.eq('status', 'finished')
		.order('date', { ascending: false });

	if (!sessions || sessions.length === 0) return { perGame: [], eloRankings: [], sessionCount: 0 };

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

	if (allScores.length === 0) return { perGame: [], eloRankings: [], sessionCount: sessions.length };

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

	// --- ELO rankings (read from cache — refreshed by the scheduler / admin edits, not per request) ---
	const playerNames = new Map<string, string>();
	for (const s of allScores) {
		if (!playerNames.has(s.player_id))
			playerNames.set(s.player_id, displayName(s.player as { name: string; alias?: string | null }));
	}

	const { data: eloRows } = await supabase
		.from('player_elo')
		.select('player_id, elo, prev_elo, sessions, history');

	const qualified = (eloRows ?? [])
		.filter(r => r.sessions >= MIN_DAYS)
		.map(r => ({ player_id: r.player_id, elo: r.elo, prevElo: r.prev_elo, sessions: r.sessions, history: r.history, name: playerNames.get(r.player_id) ?? '?' }))
		.sort((a, b) => b.elo - a.elo);

	// Rank movement: compare current ranking vs ranking by prevElo
	const prevRanked = (eloRows ?? [])
		.filter(r => r.sessions >= MIN_DAYS && r.prev_elo !== null)
		.sort((a, b) => b.prev_elo! - a.prev_elo!)
		.map((r, i) => [r.player_id, i + 1] as const);
	const prevRankMap = new Map(prevRanked);

	const sessionMeta = new Map(sessions.map(s => [s.id, { name: s.name, date: s.date }]));

	const eloRankings = qualified.map((r, i) => {
		const prevRank = prevRankMap.get(r.player_id) ?? null;
		const movement = prevRank !== null ? prevRank - (i + 1) : null;
		const delta = r.prevElo !== null ? r.elo - r.prevElo : null;
		const recentHistory = r.history.slice(-5).reverse().map(h => ({
			date: sessionMeta.get(h.session_id)?.date ?? '?',
			delta: h.delta,
		}));
		return { player_id: r.player_id, name: r.name, elo: r.elo, delta, movement, sessions: r.sessions, recentHistory };
	});

	return { perGame, eloRankings, sessionCount: sessions.length };
};
