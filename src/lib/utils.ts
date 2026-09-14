// Supabase caps an unpaginated select() at 1000 rows. Any query over a table
// that can plausibly exceed that (scores, above all) needs this instead of a
// plain .select() — several call sites forgot to and silently truncated.
export async function paginateAll<T>(
	fetchPage: (from: number, to: number) => PromiseLike<{ data: T[] | null }>
): Promise<T[]> {
	const all: T[] = [];
	for (let from = 0; ; from += 1000) {
		const { data: page } = await fetchPage(from, from + 999);
		if (!page?.length) break;
		all.push(...page);
		if (page.length < 1000) break;
	}
	return all;
}

export function displayName(player: { name: string; alias?: string | null }): string {
	if (!player.alias?.trim()) return player.name;
	return `${player.name} (${player.alias})`;
}

export function dnfScore(game: { max_score: number | null; allow_dnf: boolean }): number | null {
	if (!game.allow_dnf || game.max_score === null) return null;
	return game.max_score + 1;
}

export function isDnf(
	score: number,
	game: { max_score: number | null; allow_dnf: boolean }
): boolean {
	return dnfScore(game) === score;
}

// The one bit actually shared between fmtSeconds (verbose, used for score
// displays) and decipher.ts's formatTime (compact, used in its inline
// "Xm Ys + hint = Zm Ws" breakdown) — the split itself, not the wording.
export function splitMinutesSeconds(totalSeconds: number): { m: number; s: number } {
	const rounded = Math.round(totalSeconds);
	return { m: Math.floor(rounded / 60), s: rounded % 60 };
}

export function fmtSeconds(totalSeconds: number): string {
	const { m, s: sec } = splitMinutesSeconds(totalSeconds);
	if (m === 0) return `${sec} sec`;
	if (sec === 0) return `${m} min`;
	return `${m} min ${sec} sec`;
}

export function sortSessionGames<
	T extends { sort_order: number; is_special?: boolean; game?: { name: string } | null }
>(games: T[]): T[] {
	return [...games].sort((a, b) => {
		const aSpecial = a.is_special ? 1 : 0;
		const bSpecial = b.is_special ? 1 : 0;
		if (bSpecial !== aSpecial) return bSpecial - aSpecial;
		return (a.game?.name ?? '').localeCompare(b.game?.name ?? '');
	});
}

export function formatScore(
	score: number,
	game: { max_score: number | null; allow_dnf: boolean; share_parser?: string | null }
): string {
	if (isDnf(score, game)) return 'X';
	if (game.share_parser === 'decipher') return fmtSeconds(score);
	return String(score);
}
