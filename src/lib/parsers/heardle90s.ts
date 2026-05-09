import type { Parser } from './index';

export const heardle90sParser: Parser = {
	name: 'heardle90s',
	parse(text: string): number | null {
		if (!/heardle/i.test(text) || !/(90s|1990s)/i.test(text)) return null;
		const lines = text.split('\n');
		const gridLine = lines.find((l) => /^[🔊🔇]/.test(l.trim()));
		if (!gridLine) return null;
		if (gridLine.trim().startsWith('🔇')) return 7; // DNF
		const squareRe = /🟩|🟥|⬛|⬜/gu;
		let pos = 0;
		let m: RegExpExecArray | null;
		while ((m = squareRe.exec(gridLine)) !== null) {
			pos++;
			if (m[0] === '🟩') return pos;
		}
		return 7;
	}
};
