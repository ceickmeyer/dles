import type { Parser } from './index';

// Each word scores 1–9 guesses (keycap emoji) or 10 for DNF (🟥). Sum of all 4 words.
export const quordleParser: Parser = {
	name: 'quordle',
	parse(text: string): number | null {
		if (!/quordle/i.test(text)) return null;
		const values: number[] = [];
		// Keycap emoji: digit + variation selector (U+FE0F) + combining enclosing keycap (U+20E3)
		const re = /([1-9])️⃣|🟥/gu;
		let m: RegExpExecArray | null;
		while ((m = re.exec(text)) !== null) {
			values.push(m[1] ? parseInt(m[1], 10) : 10);
			if (values.length === 4) break;
		}
		if (values.length !== 4) return null;
		return values.reduce((a, b) => a + b, 0);
	}
};
