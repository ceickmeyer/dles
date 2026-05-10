import type { Parser } from './index';

const MAX_GUESSES = 20;
const DNF_SCORE = MAX_GUESSES + 1; // 21 — game must be configured with max_score=20, allow_dnf=true

const SQUARE_RE = /[🟥🟨🟧🟩]/gu;

export const metazooaParser: Parser = {
	name: 'metazooa',
	parse(text: string): number | null {
		if (!/metazooa|animal\s*#\d/i.test(text)) return null;

		// Stumped = DNF
		if (/stumped/i.test(text)) return DNF_SCORE;

		// Solved: "figured it out in N guess(es)"
		const match = text.match(/figured it out in (\d+) guess/i);
		if (match) {
			const n = parseInt(match[1], 10);
			return n >= 1 && n <= MAX_GUESSES ? n : null;
		}

		// Fallback: count colored squares — hitting the cap without "figured it out" = DNF
		const squares = text.match(SQUARE_RE)?.length ?? 0;
		if (squares === MAX_GUESSES) return DNF_SCORE;

		return null;
	}
};
