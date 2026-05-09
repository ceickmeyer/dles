import type { Parser } from './index';

export const estimadleParser: Parser = {
	name: 'estimadle',
	parse(text: string): number | null {
		if (!/estimadle/i.test(text)) return null;
		const m = text.match(/🎯\s*([\d.]+)%/);
		if (!m) return null;
		return Math.round(parseFloat(m[1]));
	}
};
