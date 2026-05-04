import type { Parser } from './index';

const COLORS = new Set(['🟨', '🟩', '🟦', '🟪']);

// Higher = harder; used to reward solving hard rows first
const DIFFICULTY: Record<string, number> = { '🟨': 1, '🟩': 2, '🟦': 3, '🟪': 4 };
// Bonus multiplier by solve position (1st through 4th)
const POSITION_WEIGHT = [10, 6, 3, 0];

export interface ConnectionsResult {
	groups: number;   // correct rows (all same color)
	mistakes: number; // incorrect rows (mixed colors)
	solved: boolean;  // groups === 4
	solvedOrder: string[]; // emoji color of each correct row in solve order
	score: number;
}

function orderBonus(solvedOrder: string[]): number {
	return solvedOrder.reduce((sum, color, i) =>
		sum + (DIFFICULTY[color] ?? 0) * (POSITION_WEIGHT[i] ?? 0), 0);
}

export function computeConnectionsScore(groups: number, mistakes: number, solvedOrder: string[] = []): number {
	const base = groups === 4 ? 100 : groups * 25;
	const bonus = groups === 4 ? orderBonus(solvedOrder) : 0;
	return Math.max(0, base + bonus - mistakes * 10);
}

export function parseConnectionsGrid(text: string): ConnectionsResult | null {
	let groups = 0;
	let mistakes = 0;
	let found = false;
	const solvedOrder: string[] = [];

	for (const line of text.split('\n')) {
		const squares = [...line].filter(c => COLORS.has(c));
		if (squares.length === 4) {
			found = true;
			if (squares.every(c => c === squares[0])) {
				groups++;
				solvedOrder.push(squares[0]);
			} else {
				mistakes++;
			}
		}
	}

	if (!found) return null;

	const solved = groups === 4;
	return { groups, mistakes, solved, solvedOrder, score: computeConnectionsScore(groups, mistakes, solvedOrder) };
}

export const connectionsParser: Parser = {
	name: 'connections',
	parse(text: string): number | null {
		return parseConnectionsGrid(text)?.score ?? null;
	}
};
