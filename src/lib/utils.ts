export function displayName(player: { name: string; alias?: string | null }): string {
	if (!player.alias?.trim()) return player.name;
	return `${player.name} (${player.alias})`;
}

export function dnfScore(game: { max_score: number | null; allow_dnf: boolean }): number | null {
	if (!game.allow_dnf || game.max_score === null) return null;
	return game.max_score + 1;
}

export function isDnf(score: number, game: { max_score: number | null; allow_dnf: boolean }): boolean {
	return dnfScore(game) === score;
}

export function fmtSeconds(totalSeconds: number): string {
	const s = Math.round(totalSeconds);
	const m = Math.floor(s / 60);
	const sec = s % 60;
	if (m === 0) return `${sec} sec`;
	if (sec === 0) return `${m} min`;
	return `${m} min ${sec} sec`;
}

export function formatScore(score: number, game: { max_score: number | null; allow_dnf: boolean; share_parser?: string | null }): string {
	if (isDnf(score, game)) return 'X';
	if (game.share_parser === 'decipher') return fmtSeconds(score);
	return String(score);
}
