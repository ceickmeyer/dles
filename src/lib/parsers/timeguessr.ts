import type { Parser } from './index';

// TimeGuessr #1068 18,905/50,000  →  18905 (higher is better, max 50000)
export const timeGuessrParser: Parser = {
	name: 'timeguessr',
	parse(text: string): number | null {
		const match = text.match(/TimeGuessr\s+#\d+\s+([\d,]+)\/[\d,]+/i);
		if (!match) return null;
		const score = parseInt(match[1].replace(/,/g, ''), 10);
		return isNaN(score) ? null : score;
	}
};
