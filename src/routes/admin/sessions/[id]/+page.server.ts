import { supabase } from '$lib/supabase';
import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

type GameRow = {
	id: string;
	name: string;
	icon_emoji: string | null;
	scoring_direction: string;
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
			'sort_order, game:games(id, name, icon_emoji, scoring_direction, max_score, allow_dnf, share_parser)'
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
		game: sg.game as unknown as GameRow
	}));

	const scoreList = (scores ?? []) as unknown as ScoreRow[];

	const gameOrder = sessionGameList.map((sg) => sg.game.id);
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

	const gameGroups = gameOrder.filter((id) => byGame.has(id)).map((id) => byGame.get(id)!);

	// Add any games not in session_games (shouldn't happen, but safety net)
	for (const [id, entry] of byGame) {
		if (!gameOrder.includes(id)) gameGroups.push(entry);
	}

	const { data: allGames } = await supabase
		.from('games')
		.select('id, name, icon_emoji')
		.order('name');

	const inSession = new Set(gameOrder);
	const availableGames = (allGames ?? []).filter((g) => !inSession.has(g.id));

	const nextSortOrder = Math.max(0, ...sessionGameList.map((sg) => sg.sort_order)) + 1;

	return { session, gameGroups, availableGames, nextSortOrder };
};
