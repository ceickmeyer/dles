import { supabase } from '$lib/supabase';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	const [{ data: games }, { data: sessions }, { data: players }] = await Promise.all([
		supabase.from('games').select('id, name, icon_emoji').order('name'),
		supabase
			.from('sessions')
			.select('id, date')
			.eq('status', 'finished')
			.order('date', { ascending: true }),
		supabase.from('players').select('id')
	]);

	const totalSessions = sessions?.length ?? 0;
	const totalPlayers = players?.length ?? 0;

	if (!games?.length) return { gameStats: [], totalSessions, totalPlayers };

	if (!totalSessions) {
		return {
			gameStats: games.map((g) => ({
				id: g.id,
				name: g.name,
				icon_emoji: g.icon_emoji,
				timesPlayed: 0,
				lastPlayed: null as string | null,
				playRate: 0,
				avgParticipation: 0
			})),
			totalSessions,
			totalPlayers
		};
	}

	const sessionIds = sessions!.map((s) => s.id);
	const sessionDateMap = new Map(sessions!.map((s) => [s.id, s.date]));

	// Paginate both queries — PostgREST default row limit silently truncates large results
	const sgAll: { game_id: string; session_id: string }[] = [];
	for (let from = 0; ; from += 1000) {
		const { data: page } = await supabase
			.from('session_games')
			.select('game_id, session_id')
			.in('session_id', sessionIds)
			.range(from, from + 999);
		if (!page?.length) break;
		sgAll.push(...page);
		if (page.length < 1000) break;
	}

	const scoresAll: { game_id: string; session_id: string; player_id: string }[] = [];
	for (let from = 0; ; from += 1000) {
		const { data: page } = await supabase
			.from('scores')
			.select('game_id, session_id, player_id')
			.in('session_id', sessionIds)
			.range(from, from + 999);
		if (!page?.length) break;
		scoresAll.push(...page);
		if (page.length < 1000) break;
	}

	// Per-game: which sessions it appeared in, and who submitted per session
	type GameEntry = { sessions: Set<string>; submitters: Map<string, Set<string>> };
	const gameData = new Map<string, GameEntry>();

	for (const sg of sgAll) {
		if (!gameData.has(sg.game_id))
			gameData.set(sg.game_id, { sessions: new Set(), submitters: new Map() });
		gameData.get(sg.game_id)!.sessions.add(sg.session_id);
	}
	for (const s of scoresAll) {
		if (!gameData.has(s.game_id))
			gameData.set(s.game_id, { sessions: new Set(), submitters: new Map() });
		const entry = gameData.get(s.game_id)!;
		if (!entry.submitters.has(s.session_id)) entry.submitters.set(s.session_id, new Set());
		entry.submitters.get(s.session_id)!.add(s.player_id);
	}

	const gameStats = games.map((g) => {
		const entry = gameData.get(g.id);
		const timesPlayed = entry?.sessions.size ?? 0;

		let lastPlayed: string | null = null;
		if (entry) {
			for (const sid of entry.sessions) {
				const date = sessionDateMap.get(sid);
				if (date && (!lastPlayed || date > lastPlayed)) lastPlayed = date;
			}
		}

		// Participation: avg fraction of total players who submitted this game per session
		let avgParticipation = 0;
		if (entry && timesPlayed > 0 && totalPlayers > 0) {
			let total = 0;
			for (const sid of entry.sessions) {
				total += (entry.submitters.get(sid)?.size ?? 0) / totalPlayers;
			}
			avgParticipation = total / timesPlayed;
		}

		return {
			id: g.id,
			name: g.name,
			icon_emoji: g.icon_emoji,
			timesPlayed,
			lastPlayed,
			playRate: totalSessions > 0 ? timesPlayed / totalSessions : 0,
			avgParticipation
		};
	});

	gameStats.sort((a, b) => b.timesPlayed - a.timesPlayed || a.name.localeCompare(b.name));

	return { gameStats, totalSessions, totalPlayers };
};
