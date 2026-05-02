import type { Parser } from './index';

// Costcodle #956 3/6  →  3 guesses (lower is better)
// The X/6 format matches Wordle-style — ignore the emoji rows
export const costcodleParser: Parser = {
	name: 'costcodle',
	parse(text: string): number | null {
		const match = text.match(/(\d+)\/6/);
		if (!match) return null;
		const guesses = parseInt(match[1], 10);
		return guesses >= 1 && guesses <= 6 ? guesses : null;
	}
};
