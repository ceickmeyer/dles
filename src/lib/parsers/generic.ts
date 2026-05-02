import type { Parser } from './index';

// Generic fallback — grab the first standalone number from the text
export const genericParser: Parser = {
	name: 'generic',
	parse(text: string): number | null {
		const match = text.match(/\b(\d[\d,]*)\b/);
		if (!match) return null;
		const n = parseInt(match[1].replace(/,/g, ''), 10);
		return isNaN(n) ? null : n;
	}
};
