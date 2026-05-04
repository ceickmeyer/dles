import type { Parser } from './index';

export interface DecipherResult {
	solved: boolean;
	seconds: number | null;
	display: string;
}

function extractSeconds(text: string): number | null {
	const minsMatch = text.match(/(\d+)m\s*(\d+)s/);
	if (minsMatch) return parseInt(minsMatch[1], 10) * 60 + parseInt(minsMatch[2], 10);
	const secsMatch = text.match(/(\d+)s/);
	if (secsMatch) return parseInt(secsMatch[1], 10);
	return null;
}

function formatTime(seconds: number): string {
	const m = Math.floor(seconds / 60);
	const s = seconds % 60;
	return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

export function parseDecipherResult(text: string): DecipherResult | null {
	if (!/decipher/i.test(text)) return null;
	const failed = /failed/i.test(text);
	const seconds = extractSeconds(text);
	if (failed) {
		return { solved: false, seconds, display: seconds !== null ? `Failed (${formatTime(seconds)})` : 'Failed' };
	}
	if (seconds !== null) {
		return { solved: true, seconds, display: formatTime(seconds) };
	}
	return null;
}

// Kept for legacy parser registry — returns null on DNF so callers use allow_dnf flow
export const decipherParser: Parser = {
	name: 'decipher',
	parse(text: string): number | null {
		const result = parseDecipherResult(text);
		if (!result || !result.solved) return null;
		return result.seconds;
	}
};
