import type { Parser } from './index';

export interface DecipherResult {
	solved: boolean;
	seconds: number | null; // includes hint penalties
	rawSeconds: number | null; // before penalties
	hints: number;
	display: string;
}

const MAX_STARS = 3;

function extractSeconds(text: string): number | null {
	const minsMatch = text.match(/(\d+)m\s*(\d+)s/);
	if (minsMatch) return parseInt(minsMatch[1], 10) * 60 + parseInt(minsMatch[2], 10);
	const secsMatch = text.match(/(\d+)s/);
	if (secsMatch) return parseInt(secsMatch[1], 10);
	return null;
}

export function formatTime(seconds: number): string {
	const m = Math.floor(seconds / 60);
	const s = seconds % 60;
	return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

export function parseDecipherResult(text: string): DecipherResult | null {
	if (!/decipher/i.test(text)) return null;
	const failed = /failed/i.test(text);

	// Count ⭐ stars — each missing star vs max (3) = one hint used = +60s penalty
	const stars = (text.match(/⭐/g) ?? []).length;
	const hints = failed ? 0 : Math.max(0, MAX_STARS - stars);
	const rawSeconds = extractSeconds(text);
	const seconds = rawSeconds !== null ? rawSeconds + hints * 60 : null;

	if (failed) {
		return {
			solved: false, seconds: null, rawSeconds, hints: 0,
			display: rawSeconds !== null ? `Failed (${formatTime(rawSeconds)})` : 'Failed'
		};
	}
	if (seconds !== null) {
		const penaltyNote = hints > 0 ? ` +${hints}m hint${hints > 1 ? 's' : ''}` : '';
		return {
			solved: true, seconds, rawSeconds, hints,
			display: `${formatTime(rawSeconds!)}${penaltyNote} = ${formatTime(seconds)}`
		};
	}
	return null;
}

export const decipherParser: Parser = {
	name: 'decipher',
	parse(text: string): number | null {
		const result = parseDecipherResult(text);
		if (!result || !result.solved) return null;
		return result.seconds; // stored in seconds (with penalties)
	}
};
