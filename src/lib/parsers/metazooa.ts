import type { Parser } from './index';

const DNF_SCORE = 21; // max_score (20) + 1

export const metazooaParser: Parser = {
	name: 'metazooa',
	parse(text: string): number | null {
		if (/stumped/i.test(text)) return DNF_SCORE;
		const match = text.match(/figured it out in (\d+) guess/i);
		if (!match) return null;
		const n = parseInt(match[1], 10);
		return n >= 1 && n <= 20 ? n : null;
	}
};
