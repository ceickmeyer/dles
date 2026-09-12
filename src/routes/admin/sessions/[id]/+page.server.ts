import { supabase } from '$lib/supabase';
import { error } from '@sveltejs/kit';
import { ELO_INITIAL, K as ELO_K, pairwiseElo } from '$lib/elo';
import { rankScores, computeSessionTally, sortTally, MEDAL_EMOJI } from '$lib/scoring';
import { displayName } from '$lib/utils';
import type { ScoringDirection } from '$lib/database.types';
import type { PageServerLoad } from './$types';

type GameRow = {
	id: string;
	name: string;
	icon_emoji: string | null;
	scoring_direction: ScoringDirection;
	max_score: number | null;
	allow_dnf: boolean;
	share_parser: string | null;
};

type ScoreRow = {
	id: string;
	raw_score: number;
	share_text: string | null;
	submitted_at: string;
	player: { id: string; name: string; alias: string | null } | null;
	game: GameRow | null;
};

type EloHistoryEntry = {
	session_id: string;
	delta: number;
	games?: { game_id: string; delta: number }[];
};

export const load: PageServerLoad = async ({ params }) => {
	const { data: session } = await supabase
		.from('sessions')
		.select('id, name, date, status')
		.eq('id', params.id)
		.maybeSingle();

	if (!session) error(404, 'Session not found');

	const { data: sessionGames } = await supabase
		.from('session_games')
		.select(
			'sort_order, is_special, game:games(id, name, icon_emoji, scoring_direction, max_score, allow_dnf, share_parser)'
		)
		.eq('session_id', params.id)
		.order('sort_order');

	const { data: scores } = await supabase
		.from('scores')
		.select(
			'id, raw_score, share_text, submitted_at, player:players(id, name, alias), game:games(id, name, icon_emoji, scoring_direction, max_score, allow_dnf, share_parser)'
		)
		.eq('session_id', params.id)
		.order('submitted_at', { ascending: true });

	// Group scores by game
	const sessionGameList = (sessionGames ?? []).map((sg) => ({
		sort_order: sg.sort_order,
		is_special: sg.is_special ?? false,
		game: sg.game as unknown as GameRow
	}));

	const scoreList = (scores ?? []) as unknown as ScoreRow[];

	// Alphabetical by game name, featured game flagged (not bubbled) for the summary.
	const orderedSessionGames = [...sessionGameList].sort((a, b) =>
		a.game.name.localeCompare(b.game.name)
	);
	const gameOrder = orderedSessionGames.map((sg) => sg.game.id);
	const specialGameIds = new Set(sessionGameList.filter((sg) => sg.is_special).map((sg) => sg.game.id));

	const byGame = new Map<string, { game: GameRow; scores: ScoreRow[] }>();

	for (const sg of sessionGameList) {
		byGame.set(sg.game.id, { game: sg.game, scores: [] });
	}

	for (const score of scoreList) {
		if (!score.game) continue;
		if (!byGame.has(score.game.id)) byGame.set(score.game.id, { game: score.game, scores: [] });
		byGame.get(score.game.id)!.scores.push(score);
	}

	// Sort each game's scores by raw_score (best first)
	for (const entry of byGame.values()) {
		entry.scores.sort((a, b) =>
			entry.game.scoring_direction === 'higher_is_better'
				? b.raw_score - a.raw_score
				: a.raw_score - b.raw_score
		);
	}

	const gameGroups = gameOrder
		.filter((id) => byGame.has(id))
		.map((id) => ({ ...byGame.get(id)!, isSpecial: specialGameIds.has(id) }));

	// Add any games not in session_games (shouldn't happen, but safety net)
	for (const [id, entry] of byGame) {
		if (!gameOrder.includes(id))
			gameGroups.push({ ...entry, isSpecial: specialGameIds.has(id) });
	}
	gameGroups.sort((a, b) => a.game.name.localeCompare(b.game.name));

	const { data: allGames } = await supabase
		.from('games')
		.select('id, name, icon_emoji')
		.order('name');

	const inSession = new Set(gameOrder);
	const availableGames = (allGames ?? []).filter((g) => !inSession.has(g.id));

	const nextSortOrder = Math.max(0, ...sessionGameList.map((sg) => sg.sort_order)) + 1;

	// --- Day summary: medal tally across every game in the session ---
	const gameResultsForTally = gameGroups.map(({ game, scores: gs, isSpecial }) => ({
		isSpecial,
		scores: rankScores(
			gs
				.filter((s) => s.player)
				.map((s) => ({
					player_id: s.player!.id,
					player_name: displayName(s.player!),
					raw_score: s.raw_score
				})),
			game.scoring_direction,
			game.allow_dnf && game.max_score !== null ? game.max_score + 1 : null
		)
	}));
	const tally = sortTally([...computeSessionTally(gameResultsForTally).values()]);

	const uniquePlayers = new Set(scoreList.filter((s) => s.player).map((s) => s.player!.id));
	const summary = {
		gamesPlayed: gameGroups.filter((g) => g.scores.length > 0).length,
		totalScores: scoreList.length,
		playerCount: uniquePlayers.size
	};

	// --- ELO impact: how this session moved everyone's rating ---
	const playerNameById = new Map<string, string>();
	for (const s of scoreList) {
		if (s.player) playerNameById.set(s.player.id, displayName(s.player));
	}

	const { data: playerElos } = await supabase.from('player_elo').select('player_id, history');

	const eloEntries = (playerElos ?? [])
		.map((row) => {
			const history = (row.history ?? []) as unknown as EloHistoryEntry[];
			const idx = history.findIndex((h) => h.session_id === session.id);
			if (idx === -1) return null;
			const entry = history[idx];
			const before = ELO_INITIAL + history.slice(0, idx).reduce((sum, h) => sum + h.delta, 0);
			return { player_id: row.player_id, before, entry };
		})
		.filter((x): x is NonNullable<typeof x> => x !== null);

	// Rating each player carried INTO this session — every matchup below used
	// this same snapshot, since ratings only update once the whole session is processed.
	const ratingBefore = new Map(eloEntries.map((e) => [e.player_id, e.before]));

	// --- Per-matchup detail: replay the exact head-to-head comparisons that produced
	// each game's ELO delta, so "why did I gain/lose N points" is fully inspectable.
	type MatchupDetail = {
		opponentId: string;
		opponentName: string;
		result: 'won' | 'lost' | 'tied';
		ratingSelf: number;
		ratingOpp: number;
		winProb: number;
		delta: number;
	};
	const matchupsByGamePlayer = new Map<string, MatchupDetail[]>();

	for (const { game, scores: gs } of gameGroups) {
		const dnfVal = game.allow_dnf && game.max_score !== null ? game.max_score + 1 : null;
		const valid = gs.filter((s) => s.player && (dnfVal === null || s.raw_score !== dnfVal));
		if (valid.length < 2) continue;

		const ranked = rankScores(
			valid.map((s) => ({
				player_id: s.player!.id,
				player_name: playerNameById.get(s.player!.id) ?? displayName(s.player!),
				raw_score: s.raw_score
			})),
			game.scoring_direction
		);
		const kNorm = ELO_K / (ranked.length - 1);

		for (let i = 0; i < ranked.length; i++) {
			for (let j = i + 1; j < ranked.length; j++) {
				const a = ranked[i],
					b = ranked[j];
				const rA = ratingBefore.get(a.player_id) ?? ELO_INITIAL;
				const rB = ratingBefore.get(b.player_id) ?? ELO_INITIAL;
				const { eA, sA, delta } = pairwiseElo(rA, rB, a.rank, b.rank, kNorm);
				const resultFor = (s: number): 'won' | 'lost' | 'tied' =>
					s === 1 ? 'won' : s === 0 ? 'lost' : 'tied';

				const keyA = `${game.id}::${a.player_id}`;
				if (!matchupsByGamePlayer.has(keyA)) matchupsByGamePlayer.set(keyA, []);
				matchupsByGamePlayer.get(keyA)!.push({
					opponentId: b.player_id,
					opponentName: b.player_name,
					result: resultFor(sA),
					ratingSelf: Math.round(rA),
					ratingOpp: Math.round(rB),
					winProb: eA,
					delta
				});

				const keyB = `${game.id}::${b.player_id}`;
				if (!matchupsByGamePlayer.has(keyB)) matchupsByGamePlayer.set(keyB, []);
				matchupsByGamePlayer.get(keyB)!.push({
					opponentId: a.player_id,
					opponentName: a.player_name,
					result: resultFor(1 - sA),
					ratingSelf: Math.round(rB),
					ratingOpp: Math.round(rA),
					winProb: 1 - eA,
					delta: -delta
				});
			}
		}
	}

	const eloBreakdown = eloEntries
		.map(({ player_id, before, entry }) => {
			const after = before + entry.delta;
			const games = (entry.games ?? [])
				.map((g) => ({
					game_id: g.game_id,
					name: byGame.get(g.game_id)?.game.name ?? '?',
					emoji: byGame.get(g.game_id)?.game.icon_emoji ?? '🎮',
					delta: Math.round(g.delta),
					matchups: matchupsByGamePlayer.get(`${g.game_id}::${player_id}`) ?? []
				}))
				.sort((a, b) => a.name.localeCompare(b.name));
			return {
				player_id,
				name: playerNameById.get(player_id) ?? '?',
				before: Math.round(before),
				after: Math.round(after),
				delta: Math.round(entry.delta),
				games
			};
		})
		.sort((a, b) => b.delta - a.delta);

	return {
		session,
		gameGroups,
		availableGames,
		nextSortOrder,
		tally,
		summary,
		eloBreakdown,
		medalEmoji: MEDAL_EMOJI
	};
};
