export interface Badge {
	id: string;
	emoji: string;
	label: string;
	desc: string;
}

export interface BadgeStats {
	gold: number;
	silver: number;
	bronze: number;
	total: number;
	nights: number;
	winStreak: number;
	podiumStreak: number;
	bestWinStreak: number;
}

const BADGE_DEFS: Array<Badge & { check: (s: BadgeStats) => boolean }> = [
	{ id: 'winner',      emoji: '🥇', label: 'Winner',         desc: 'Won your first gold medal',              check: s => s.gold >= 1 },
	{ id: 'champion',    emoji: '👑', label: 'Champion',        desc: '10+ gold medals all time',               check: s => s.gold >= 10 },
	{ id: 'veteran',     emoji: '🎖', label: 'Veteran',         desc: 'Played 5+ game nights',                  check: s => s.nights >= 5 },
	{ id: 'regular',     emoji: '🏅', label: 'Podium Regular',  desc: '10+ total medals all time',              check: s => s.total >= 10 },
	{ id: 'on_fire',     emoji: '🔥', label: 'On Fire',         desc: 'Current win streak of 3+ nights',        check: s => s.winStreak >= 3 },
	{ id: 'unstoppable', emoji: '⚡', label: 'Unstoppable',     desc: 'Win streak of 5+ nights (all time best)', check: s => s.bestWinStreak >= 5 },
	{ id: 'consistent',  emoji: '🎯', label: 'Consistent',      desc: 'On the podium 3+ nights in a row',       check: s => s.podiumStreak >= 3 },
	{ id: 'choker',      emoji: '😬', label: 'Choker',          desc: 'More silvers than golds (5+ silvers)',    check: s => s.silver >= 5 && s.silver > s.gold },
];

export function computeBadges(stats: BadgeStats): Badge[] {
	return BADGE_DEFS
		.filter(b => b.check(stats))
		.map(({ id, emoji, label, desc }) => ({ id, emoji, label, desc }));
}

export function computeStreaks(history: { won: boolean; podium: boolean }[]): {
	winStreak: number;
	podiumStreak: number;
	bestWinStreak: number;
} {
	// history is in chronological order (oldest first) — reverse for "most recent first"
	const desc = [...history].reverse();

	let winStreak = 0;
	for (const r of desc) { if (r.won) winStreak++; else break; }

	let podiumStreak = 0;
	for (const r of desc) { if (r.podium) podiumStreak++; else break; }

	let bestWinStreak = 0;
	let run = 0;
	for (const r of desc) {
		if (r.won) { run++; bestWinStreak = Math.max(bestWinStreak, run); }
		else run = 0;
	}

	return { winStreak, podiumStreak, bestWinStreak };
}
