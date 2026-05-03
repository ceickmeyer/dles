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

export function formatScore(score: number, game: { max_score: number | null; allow_dnf: boolean }): string {
	if (isDnf(score, game)) return 'X';
	return String(score);
}
