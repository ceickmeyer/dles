import type { Parser } from './index';

// 🟥🟩🟩🟥🟩🟩🟩🟩🟩🟥 7/10 | 2026-05-03 | https://scrandle.com
// Extract the number before /10 → 7 correct tiles (higher is better)
export const scrandleParser: Parser = {
	name: 'scrandle',
	parse(text: string): number | null {
		const match = text.match(/(\d+)\/10/);
		if (!match) return null;
		const score = parseInt(match[1], 10);
		return score >= 0 && score <= 10 ? score : null;
	}
};
