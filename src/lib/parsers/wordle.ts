import type { Parser } from './index';

// Wordle 1,234 3/6  →  3 guesses (lower is better)
export const wordleParser: Parser = {
	name: 'wordle',
	parse(text: string): number | null {
		const match = text.match(/(\d+)\/6/);
		if (!match) return null;
		const guesses = parseInt(match[1], 10);
		return guesses >= 1 && guesses <= 6 ? guesses : null;
	}
};
