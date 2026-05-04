import type { Parser } from './index';

const COLORS = new Set(['🟨', '🟩', '🟦', '🟪']);

export interface ConnectionsResult {
	groups: number;   // correct rows (all same color)
	mistakes: number; // incorrect rows (mixed colors)
	solved: boolean;  // groups === 4
	score: number;
}

export function computeConnectionsScore(groups: number, mistakes: number): number {
	if (groups === 4) return Math.max(0, 100 - mistakes * 10);
	return groups * 25;
}

export function parseConnectionsGrid(text: string): ConnectionsResult | null {
	let groups = 0;
	let mistakes = 0;
	let found = false;

	for (const line of text.split('\n')) {
		const squares = [...line].filter(c => COLORS.has(c));
		if (squares.length === 4) {
			found = true;
			if (squares.every(c => c === squares[0])) groups++;
			else mistakes++;
		}
	}

	if (!found) return null;

	const solved = groups === 4;
	return { groups, mistakes, solved, score: computeConnectionsScore(groups, mistakes) };
}

export const connectionsParser: Parser = {
	name: 'connections',
	parse(text: string): number | null {
		return parseConnectionsGrid(text)?.score ?? null;
	}
};
