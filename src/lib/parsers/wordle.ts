import type { Parser } from './index';

const MAX_GUESSES = 6;
const DNF_SCORE = MAX_GUESSES + 1; // 7 — game must be configured with max_score=6, allow_dnf=true

// Wordle 1,234 3/6  →  3 guesses (lower is better); X/6  →  DNF
export const wordleParser: Parser = {
	name: 'wordle',
	parse(text: string): number | null {
		if (/\bX\/6\b/i.test(text)) return DNF_SCORE;
		const match = text.match(/(\d+)\/6/);
		if (!match) return null;
		const guesses = parseInt(match[1], 10);
		return guesses >= 1 && guesses <= MAX_GUESSES ? guesses : null;
	}
};
