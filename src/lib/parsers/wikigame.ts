import type { Parser } from './index';

// "🦶4 ⏰ 00:37" → 4.037  (steps + totalSeconds/1000 as tiebreaker, lower is better)
export const wikigameParser: Parser = {
	name: 'wikigame',
	parse(text: string): number | null {
		const stepsMatch = text.match(/🦶\s*(\d+)/);
		if (!stepsMatch) return null;
		const steps = parseInt(stepsMatch[1], 10);
		if (isNaN(steps)) return null;

		const timeMatch = text.match(/⏰\s*(\d+):(\d+)/);
		if (timeMatch) {
			const totalSeconds = parseInt(timeMatch[1], 10) * 60 + parseInt(timeMatch[2], 10);
			return steps + totalSeconds / 1000;
		}

		return steps;
	}
};
