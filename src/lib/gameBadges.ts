interface GameInfo {
	id: string;
	name: string;
	icon_emoji: string | null;
	share_parser: string | null;
	max_score: number | null;
	allow_dnf: boolean;
	scoring_direction: 'higher_is_better' | 'lower_is_better';
}

export interface SessionBadge {
	id: string;
	emoji: string;
	name: string;
	description: string;
	gameEmoji?: string;
	gameName?: string;
}

function isDnf(score: number, game: GameInfo): boolean {
	return game.allow_dnf && game.max_score !== null && score === game.max_score + 1;
}

interface GameBadgeDef {
	id: string;
	emoji: string;
	name: string;
	description: string;
	match: (game: GameInfo) => boolean;
	condition: (score: number, game: GameInfo) => boolean;
}

interface GlobalBadgeDef {
	id: string;
	emoji: string;
	name: string;
	description: string;
	condition: (myScores: Map<string, number>, games: GameInfo[]) => boolean;
}

const GAME_BADGES: GameBadgeDef[] = [
	// ── NYT Connections ──────────────────────────────────────────────
	{
		id: 'connections_perfect', emoji: '🟣', name: 'Flawless Victory',
		description: 'Solved Connections with zero mistakes',
		match: g => g.share_parser === 'connections',
		condition: s => s === 100
	},
	{
		id: 'connections_great', emoji: '💡', name: 'Galaxy Brain',
		description: 'Scored 80 or higher on Connections',
		match: g => g.share_parser === 'connections',
		condition: s => s >= 80 && s < 100
	},
	{
		id: 'connections_decent', emoji: '🎲', name: 'Educated Guesser',
		description: 'Held it together despite a few mistakes',
		match: g => g.share_parser === 'connections',
		condition: s => s >= 60 && s < 80
	},
	{
		id: 'connections_bad', emoji: '🤡', name: 'Fell For Every Trap',
		description: 'Connections had its way with you',
		match: g => g.share_parser === 'connections',
		condition: s => s > 25 && s <= 40
	},
	{
		id: 'connections_disaster', emoji: '💀', name: 'Where Were You',
		description: 'Scored 25 or below on Connections',
		match: g => g.share_parser === 'connections',
		condition: s => s <= 25
	},

	// ── Wordle ───────────────────────────────────────────────────────
	{
		id: 'wordle_one', emoji: '🔮', name: 'Are You Even Human',
		description: 'Got Wordle in one guess',
		match: g => g.share_parser === 'wordle',
		condition: (s, g) => !isDnf(s, g) && s === 1
	},
	{
		id: 'wordle_two', emoji: '🧠', name: 'Suspiciously Good',
		description: 'Got Wordle in two guesses',
		match: g => g.share_parser === 'wordle',
		condition: (s, g) => !isDnf(s, g) && s === 2
	},
	{
		id: 'wordle_mid', emoji: '✅', name: 'Adequately Functional',
		description: 'Solved Wordle in 3 or 4 — normal person behavior',
		match: g => g.share_parser === 'wordle',
		condition: (s, g) => !isDnf(s, g) && s >= 3 && s <= 4
	},
	{
		id: 'wordle_close', emoji: '😬', name: 'By the Skin of Your Teeth',
		description: 'Got Wordle on the very last guess',
		match: g => g.share_parser === 'wordle',
		condition: (s, g) => !isDnf(s, g) && g.max_score !== null && s === g.max_score
	},
	{
		id: 'wordle_dnf', emoji: '💩', name: 'Illiterate',
		description: 'Failed to solve Wordle. In English.',
		match: g => g.share_parser === 'wordle',
		condition: isDnf
	},

	// ── Bandle ───────────────────────────────────────────────────────
	{
		id: 'bandle_one', emoji: '🎵', name: 'One-Hit Wonder Detector',
		description: 'Identified the Bandle from the very first clip',
		match: g => g.name.toLowerCase().includes('bandle'),
		condition: (s, g) => !isDnf(s, g) && s === 1
	},
	{
		id: 'bandle_two', emoji: '🎧', name: 'Music Nerd',
		description: 'Got Bandle in just two clips',
		match: g => g.name.toLowerCase().includes('bandle'),
		condition: (s, g) => !isDnf(s, g) && s === 2
	},
	{
		id: 'bandle_dnf', emoji: '🔇', name: 'Needs New Ears',
		description: 'Could not identify the Bandle',
		match: g => g.name.toLowerCase().includes('bandle'),
		condition: isDnf
	},

	// ── Costcodle ────────────────────────────────────────────────────
	{
		id: 'costcodle_expert', emoji: '🛒', name: 'Raised in a Costco',
		description: 'Got Costcodle in 1 or 2 guesses',
		match: g => g.share_parser === 'costcodle',
		condition: (s, g) => !isDnf(s, g) && s <= 2
	},
	{
		id: 'costcodle_dnf', emoji: '💸', name: 'Never Seen a Price Tag',
		description: 'Could not figure out the Costcodle price',
		match: g => g.share_parser === 'costcodle',
		condition: isDnf
	},

	// ── Decipher ─────────────────────────────────────────────────────
	{
		id: 'decipher_fast', emoji: '⚡', name: 'Cracked the Code',
		description: 'Solved Decipher in under 30 seconds',
		match: g => g.share_parser === 'decipher',
		condition: (s, g) => !isDnf(s, g) && s < 30
	},
	{
		id: 'decipher_slow', emoji: '🐌', name: 'Got There Eventually',
		description: 'Solved Decipher, but it took everything you had',
		match: g => g.share_parser === 'decipher',
		condition: (s, g) => !isDnf(s, g) && s >= 180
	},
	{
		id: 'decipher_dnf', emoji: '💀', name: 'Functionally Illiterate',
		description: 'Failed to decipher the message',
		match: g => g.share_parser === 'decipher',
		condition: isDnf
	},

	// ── Framed ───────────────────────────────────────────────────────
	{
		id: 'framed_one', emoji: '🎬', name: 'Seen Every Movie Twice',
		description: 'Identified the Framed movie from the first frame',
		match: g => g.share_parser === 'framed',
		condition: (s, g) => !isDnf(s, g) && s === 1
	},
	{
		id: 'framed_last', emoji: '😰', name: 'Last Frame Miracle',
		description: 'Got Framed on the very last frame',
		match: g => g.share_parser === 'framed',
		condition: (s, g) => !isDnf(s, g) && g.max_score !== null && s === g.max_score
	},
	{
		id: 'framed_dnf', emoji: '📺', name: 'Never Seen a Movie',
		description: 'Could not identify the Framed movie',
		match: g => g.share_parser === 'framed',
		condition: isDnf
	},

	// ── Guess The House ──────────────────────────────────────────────
	{
		id: 'house_one', emoji: '🏠', name: 'Zillow.com',
		description: 'Got Guess The House on the first try',
		match: g => g.share_parser === 'guessthehouse',
		condition: (s, g) => !isDnf(s, g) && s === 1
	},
	{
		id: 'house_bad', emoji: '🏚️', name: 'Wrong Zip Code',
		description: 'Could not find the house',
		match: g => g.share_parser === 'guessthehouse',
		condition: (s, g) => isDnf(s, g) || (g.max_score !== null && s === g.max_score)
	},

	// ── Real Bird Fake Bird ──────────────────────────────────────────
	{
		id: 'bird_nerd', emoji: '🦅', name: 'Bird Nerd',
		description: 'Aced Real Bird Fake Bird',
		match: g => g.name.toLowerCase().includes('bird'),
		condition: (s, g) => g.max_score !== null && !isDnf(s, g) && s >= g.max_score * 0.8
	},
	{
		id: 'bird_city', emoji: '🐦', name: 'City Kid',
		description: 'Couldn\'t tell a real bird from a fake one',
		match: g => g.name.toLowerCase().includes('bird'),
		condition: (s, g) => g.max_score !== null && !isDnf(s, g) && s <= g.max_score * 0.4
	},

	// ── Scrandle ─────────────────────────────────────────────────────
	{
		id: 'scrandle_gordon', emoji: '👨‍🍳', name: 'Gordon Ramsay',
		description: 'Near-perfect Scrandle score',
		match: g => g.share_parser === 'scrandle',
		condition: (s, g) => !isDnf(s, g) && g.max_score !== null && s >= g.max_score - 1
	},
	{
		id: 'scrandle_guy', emoji: '🌯', name: 'Guy Fieri',
		description: 'Low Scrandle score',
		match: g => g.share_parser === 'scrandle',
		condition: (s, g) => !isDnf(s, g) && g.max_score !== null && s <= Math.floor(g.max_score * 0.4)
	},

	// ── TimeGuessr ───────────────────────────────────────────────────
	{
		id: 'timeguessr_elite', emoji: '🧭', name: 'Definitely Owns a Globe',
		description: 'Scored over 45,000 on TimeGuessr',
		match: g => g.share_parser === 'timeguessr',
		condition: (s, g) => !isDnf(s, g) && s > 45000
	},
	{
		id: 'timeguessr_great', emoji: '🌍', name: 'Geographically Gifted Bastard',
		description: 'Scored over 40,000 on TimeGuessr',
		match: g => g.share_parser === 'timeguessr',
		condition: (s, g) => !isDnf(s, g) && s > 40000 && s <= 45000
	},
	{
		id: 'timeguessr_lost', emoji: '🗺️', name: 'Confidently Wrong',
		description: 'Scored under 10,000 on TimeGuessr',
		match: g => g.share_parser === 'timeguessr',
		condition: (s, g) => !isDnf(s, g) && s < 10000
	},
];

const GLOBAL_BADGES: GlobalBadgeDef[] = [
	{
		id: 'full_send', emoji: '✨', name: 'Full Send',
		description: 'Submitted a score for every game tonight',
		condition: (myScores, games) => games.length > 0 && myScores.size === games.length
	},
	{
		id: 'dnf_club', emoji: '💀', name: 'DNF Club',
		description: 'DNF\'d on two or more games',
		condition: (myScores, games) => {
			let count = 0;
			for (const game of games) {
				const score = myScores.get(game.id);
				if (score !== undefined && isDnf(score, game)) count++;
			}
			return count >= 2;
		}
	},
];

export function computeSessionBadges(
	myScores: Map<string, number>,
	games: GameInfo[]
): SessionBadge[] {
	const earned: SessionBadge[] = [];

	for (const game of games) {
		const score = myScores.get(game.id);
		if (score === undefined) continue;
		for (const def of GAME_BADGES) {
			if (def.match(game) && def.condition(score, game)) {
				earned.push({
					id: def.id,
					emoji: def.emoji,
					name: def.name,
					description: def.description,
					gameEmoji: game.icon_emoji ?? '🎮',
					gameName: game.name
				});
			}
		}
	}

	for (const def of GLOBAL_BADGES) {
		if (def.condition(myScores, games)) {
			earned.push({ id: def.id, emoji: def.emoji, name: def.name, description: def.description });
		}
	}

	return earned;
}
