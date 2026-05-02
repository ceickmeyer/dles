import type { Parser } from './index';

// TimeGuessr Score: 18,432  →  18432 (higher is better)
export const timeGuessrParser: Parser = {
	name: 'timeguessr',
	parse(text: string): number | null {
		const match = text.match(/Score[:\s]+([0-9,]+)/i);
		if (!match) return null;
		const score = parseInt(match[1].replace(/,/g, ''), 10);
		return isNaN(score) ? null : score;
	}
};
