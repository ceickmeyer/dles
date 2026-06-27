import { supabase } from '$lib/supabase';
import { error } from '@sveltejs/kit';
import { displayName } from '$lib/utils';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params }) => {
	const { data: session } = await supabase
		.from('sessions')
		.select('id, name, date, status')
		.eq('id', params.id)
		.maybeSingle();

	if (!session) error(404, 'Session not found');

	const { data: sessionGames } = await supabase
		.from('session_games')
		.select('sort_order, game:games(id, name, icon_emoji, scoring_direction, max_score, allow_dnf, share_parser)')
		.eq('session_id', params.id)
		.order('sort_order');

	const { data: scores } = await supabase
		.from('scores')
		.select('id, raw_score, share_text, submitted_at, player:players(id, name, alias), game:games(id, name, icon_emoji, scoring_direction, max_score, allow_dnf, share_parser)')
		.eq('session_id', params.id)
		.order('submitted_at', { ascending: true });

	// Group scores by game
	const gameOrder = (sessionGames ?? []).map(sg => (sg.game as any).id as string);
	const byGame = new Map<string, { game: any; scores: any[] }>();

	for (const sg of sessionGames ?? []) {
		const g = sg.game as any;
		byGame.set(g.id, { game: g, scores: [] });
	}

	for (const score of scores ?? []) {
		const g = score.game as any;
		if (!byGame.has(g.id)) byGame.set(g.id, { game: g, scores: [] });
		byGame.get(g.id)!.scores.push(score);
	}

	// Sort each game's scores by raw_score (best first)
	for (const entry of byGame.values()) {
		const dir = entry.game.scoring_direction as string;
		entry.scores.sort((a, b) =>
			dir === 'higher_is_better' ? b.raw_score - a.raw_score : a.raw_score - b.raw_score
		);
	}

	const gameGroups = gameOrder
		.filter(id => byGame.has(id))
		.map(id => byGame.get(id)!);

	// Add any games not in session_games (shouldn't happen, but safety net)
	for (const [id, entry] of byGame) {
		if (!gameOrder.includes(id)) gameGroups.push(entry);
	}

	const { data: allGames } = await supabase
		.from('games')
		.select('id, name, icon_emoji')
		.order('name');

	const inSession = new Set(gameOrder);
	const availableGames = (allGames ?? []).filter(g => !inSession.has(g.id));

	const nextSortOrder = Math.max(0, ...(sessionGames ?? []).map(sg => sg.sort_order)) + 1;

	return { session, gameGroups, availableGames, nextSortOrder };
};
