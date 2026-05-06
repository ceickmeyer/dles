import type { Parser } from './index';

export interface DecipherResult {
	solved: boolean;
	seconds: number | null; // includes hint penalties
	rawSeconds: number | null; // before penalties
	hints: number;
	display: string;
}

const MAX_STARS = 3;
const FAIL_SCORE = 600; // 10 minutes — cap for a failed game

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
			solved: false, seconds: FAIL_SCORE, rawSeconds, hints: 0,
			display: 'Failed (10 min cap)'
		};
	}
	if (seconds !== null) {
		const capped = Math.min(seconds, FAIL_SCORE);
		const penaltyNote = hints > 0 ? ` +${hints}m hint${hints > 1 ? 's' : ''}` : '';
		const capNote = capped < seconds ? ' (capped at 10 min)' : '';
		const displaySeconds = capped < seconds ? FAIL_SCORE : seconds;
		return {
			solved: true, seconds: capped, rawSeconds, hints,
			display: `${formatTime(rawSeconds!)}${penaltyNote} = ${formatTime(displaySeconds)}${capNote}`
		};
	}
	return null;
}

export const decipherParser: Parser = {
	name: 'decipher',
	parse(text: string): number | null {
		const result = parseDecipherResult(text);
		if (!result || result.seconds === null) return null;
		return result.seconds; // stored in seconds (with penalties; failures = 600)
	}
};
