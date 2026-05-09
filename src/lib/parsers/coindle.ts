import type { Parser } from './index';

export const coindleParser: Parser = {
	name: 'coindle',
	parse(text: string): number | null {
		if (!/coindle/i.test(text)) return null;
		const m = text.match(/streak:\s*(\d+)/i);
		if (!m) return null;
		return parseInt(m[1], 10);
	}
};
