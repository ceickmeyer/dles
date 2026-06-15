import { rankScores } from './scoring';

const K = 16;
export const ELO_INITIAL = 1000;

export interface EloEntry {
	session_id: string;
	game_id: string;
	player_id: string;
	raw_score: number;
	scoring_direction: 'higher_is_better' | 'lower_is_better';
	allow_dnf: boolean;
	max_score: number | null;
}

export interface PlayerEloResult {
	elo: number;
	prevElo: number | null;
	sessions: number;
	matchups: number;
	history: { session_id: string; delta: number }[];
}

export function computeElo(
	sessionIds: string[], // chronological order
	entries: EloEntry[]
): Map<string, PlayerEloResult> {
	const ratings = new Map<string, number>();
	const sessions = new Map<string, number>();
	const matchups = new Map<string, number>();
	const prevElos = new Map<string, number>();
	const history = new Map<string, { session_id: string; delta: number }[]>();

	// Group entries by session::game
	const byKey = new Map<string, EloEntry[]>();
	for (const e of entries) {
		const key = `${e.session_id}::${e.game_id}`;
		if (!byKey.has(key)) byKey.set(key, []);
		byKey.get(key)!.push(e);
	}

	const lastSessionId = sessionIds[sessionIds.length - 1];

	for (const sessionId of sessionIds) {
		if (sessionId === lastSessionId) {
			for (const [pid, elo] of ratings) prevElos.set(pid, elo);
		}

		const deltas = new Map<string, number>();
		const sessionMatchups = new Map<string, number>();
		const played = new Set<string>();

		for (const [key, group] of byKey) {
			if (!key.startsWith(`${sessionId}::`)) continue;
			const { scoring_direction, allow_dnf, max_score } = group[0];
			const dnfVal = allow_dnf && max_score !== null ? max_score + 1 : null;
			const valid = group.filter(e => dnfVal === null || e.raw_score !== dnfVal);
			if (valid.length < 2) continue;

			const ranked = rankScores(
				valid.map(e => ({ player_id: e.player_id, player_name: '', raw_score: e.raw_score })),
				scoring_direction
			);

			for (let i = 0; i < ranked.length; i++) {
				for (let j = i + 1; j < ranked.length; j++) {
					const a = ranked[i], b = ranked[j];
					const rA = ratings.get(a.player_id) ?? ELO_INITIAL;
					const rB = ratings.get(b.player_id) ?? ELO_INITIAL;
					const eA = 1 / (1 + Math.pow(10, (rB - rA) / 400));
					const sA = a.rank < b.rank ? 1 : a.rank === b.rank ? 0.5 : 0;
					const delta = K * (sA - eA);
					deltas.set(a.player_id, (deltas.get(a.player_id) ?? 0) + delta);
					deltas.set(b.player_id, (deltas.get(b.player_id) ?? 0) - delta);
					sessionMatchups.set(a.player_id, (sessionMatchups.get(a.player_id) ?? 0) + 1);
					sessionMatchups.set(b.player_id, (sessionMatchups.get(b.player_id) ?? 0) + 1);
					played.add(a.player_id);
					played.add(b.player_id);
				}
			}
		}

		for (const pid of played) {
			const cur = ratings.get(pid) ?? ELO_INITIAL;
			const d = deltas.get(pid) ?? 0;
			ratings.set(pid, cur + d);
			sessions.set(pid, (sessions.get(pid) ?? 0) + 1);
			matchups.set(pid, (matchups.get(pid) ?? 0) + (sessionMatchups.get(pid) ?? 0));
			if (!history.has(pid)) history.set(pid, []);
			history.get(pid)!.push({ session_id: sessionId, delta: Math.round(d) });
		}
	}

	const result = new Map<string, PlayerEloResult>();
	for (const [pid, elo] of ratings) {
		const prev = prevElos.get(pid) ?? null;
		result.set(pid, {
			elo: Math.round(elo),
			prevElo: prev !== null ? Math.round(prev) : null,
			sessions: sessions.get(pid) ?? 0,
			matchups: matchups.get(pid) ?? 0,
			history: history.get(pid) ?? [],
		});
	}
	return result;
}
