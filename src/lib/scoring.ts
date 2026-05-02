import type { ScoringDirection } from './database.types';

export type Medal = 'gold' | 'silver' | 'bronze' | null;

export interface PlayerScore {
	player_id: string;
	player_name: string;
	raw_score: number;
}

export interface RankedScore extends PlayerScore {
	rank: number;
	medal: Medal;
}

export interface MedalTally {
	player_id: string;
	player_name: string;
	gold: number;
	silver: number;
	bronze: number;
	total: number;
}

export function rankScores(scores: PlayerScore[], direction: ScoringDirection): RankedScore[] {
	if (scores.length === 0) return [];

	const sorted = [...scores].sort((a, b) =>
		direction === 'higher_is_better' ? b.raw_score - a.raw_score : a.raw_score - b.raw_score
	);

	// Assign ranks — ties share the same rank
	const ranked: RankedScore[] = [];
	let currentRank = 1;

	for (let i = 0; i < sorted.length; i++) {
		if (i > 0 && sorted[i].raw_score !== sorted[i - 1].raw_score) {
			currentRank = i + 1;
		}
		ranked.push({ ...sorted[i], rank: currentRank, medal: medalForRank(currentRank) });
	}

	return ranked;
}

function medalForRank(rank: number): Medal {
	if (rank === 1) return 'gold';
	if (rank === 2) return 'silver';
	if (rank === 3) return 'bronze';
	return null;
}

export const MEDAL_EMOJI: Record<NonNullable<Medal>, string> = {
	gold: '🥇',
	silver: '🥈',
	bronze: '🥉'
};

export function computeSessionTally(
	gameResults: { scores: RankedScore[] }[]
): Map<string, MedalTally> {
	const tally = new Map<string, MedalTally>();

	for (const { scores } of gameResults) {
		for (const score of scores) {
			if (!tally.has(score.player_id)) {
				tally.set(score.player_id, {
					player_id: score.player_id,
					player_name: score.player_name,
					gold: 0,
					silver: 0,
					bronze: 0,
					total: 0
				});
			}
			const t = tally.get(score.player_id)!;
			if (score.medal === 'gold') t.gold++;
			else if (score.medal === 'silver') t.silver++;
			else if (score.medal === 'bronze') t.bronze++;
			if (score.medal) t.total++;
		}
	}

	return tally;
}

export function sortTally(tally: MedalTally[]): MedalTally[] {
	return [...tally].sort((a, b) => {
		if (b.gold !== a.gold) return b.gold - a.gold;
		if (b.silver !== a.silver) return b.silver - a.silver;
		if (b.bronze !== a.bronze) return b.bronze - a.bronze;
		return a.player_name.localeCompare(b.player_name);
	});
}
