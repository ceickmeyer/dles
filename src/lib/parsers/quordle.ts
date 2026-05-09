import type { Parser } from './index';

// Per word: 10 - guesses if solved (max 9 for a 1-guess solve), 0 for DNF (🟥).
// Total 0–36, higher is better. Game should be configured: higher_is_better, max_score=36.
export const quordleParser: Parser = {
	name: 'quordle',
	parse(text: string): number | null {
		if (!/quordle/i.test(text)) return null;
		const values: number[] = [];
		// Keycap emoji: digit + variation selector (U+FE0F) + combining enclosing keycap (U+20E3)
		const re = /([1-9])️⃣|🟥/gu;
		let m: RegExpExecArray | null;
		while ((m = re.exec(text)) !== null) {
			values.push(m[1] ? Math.max(0, 10 - parseInt(m[1], 10)) : 0);
			if (values.length === 4) break;
		}
		if (values.length !== 4) return null;
		return values.reduce((a, b) => a + b, 0);
	}
};
