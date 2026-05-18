interface GameInfo {
	id: string;
	name: string;
	icon_emoji: string | null;
	share_parser: string | null;
	max_score: number | null;
	allow_dnf: boolean;
	scoring_direction: 'higher_is_better' | 'lower_is_better';
	is_special?: boolean;
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
		description: 'Perfect 200 — solved hardest-first with zero mistakes',
		match: g => g.share_parser === 'connections',
		condition: s => s === 200
	},
	{
		id: 'connections_great', emoji: '💡', name: 'Galaxy Brain',
		description: 'Scored 160 or higher on Connections',
		match: g => g.share_parser === 'connections',
		condition: s => s >= 160 && s < 200
	},
	{
		id: 'connections_decent', emoji: '🎲', name: 'Educated Guesser',
		description: 'Solved it, held it together mostly',
		match: g => g.share_parser === 'connections',
		condition: s => s >= 100 && s < 160
	},
	{
		id: 'connections_bad', emoji: '🤡', name: 'Fell For Every Trap',
		description: 'Connections had its way with you',
		match: g => g.share_parser === 'connections',
		condition: s => s >= 50 && s < 100
	},
	{
		id: 'connections_disaster', emoji: '💀', name: 'Where Were You',
		description: 'Scored under 50 on Connections',
		match: g => g.share_parser === 'connections',
		condition: s => s < 50
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
		description: 'Got Bandle in just three clips',
		match: g => g.name.toLowerCase().includes('bandle'),
		condition: (s, g) => !isDnf(s, g) && s === 3
	},
	{
		id: 'bandle_dnf', emoji: '🔇', name: 'Needs New Ears',
		description: 'Could not identify the Bandle',
		match: g => g.name.toLowerCase().includes('bandle'),
		condition: isDnf
	},

	// ── Costcodle ────────────────────────────────────────────────────
	{
		id: 'costcodle_expert', emoji: '🛒', name: '$1.50 Hot Dog Combo',
		description: 'Got Costcodle in 1 or 2 guesses',
		match: g => g.share_parser === 'costcodle',
		condition: (s, g) => !isDnf(s, g) && s <= 2
	},
	{
		id: 'costcodle_dnf', emoji: '💸', name: 'Chicken Bake',
		description: 'Could not figure out the Costcodle price',
		match: g => g.share_parser === 'costcodle',
		condition: isDnf
	},

	// ── Decipher ─────────────────────────────────────────────────────
	{
		id: 'decipher_fast', emoji: '⚡', name: 'Cracked the Code',
		description: 'Solved Decipher in under 2 minutes',
		match: g => g.share_parser === 'decipher',
		condition: s => s < 120
	},
	{
		id: 'decipher_slow', emoji: '🐌', name: 'Got There Eventually',
		description: 'Needed 5 to 10 minutes to crack it',
		match: g => g.share_parser === 'decipher',
		condition: s => s >= 300 && s < 600
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
		id: 'bird_city', emoji: '🐦', name: 'Oof',
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
		id: 'timeguessr_great', emoji: '🌍', name: 'Geographically Gifted',
		description: 'Scored over 40,000 on TimeGuessr',
		match: g => g.share_parser === 'timeguessr',
		condition: (s, g) => !isDnf(s, g) && s > 40000 && s <= 45000
	},
	{
		id: 'timeguessr_lost', emoji: '🗺️', name: 'Confidently Wrong',
		description: 'Scored 20,000 or below on TimeGuessr',
		match: g => g.share_parser === 'timeguessr',
		condition: (s, g) => !isDnf(s, g) && s <= 20000
	},
];

const GLOBAL_BADGES: GlobalBadgeDef[] = [
	{
		id: 'star_player', emoji: '⭐', name: 'Star Player',
		description: 'Completed the featured game of the night',
		condition: (myScores, games) => {
			const featured = games.find(g => g.is_special);
			return !!featured && myScores.has(featured.id);
		}
	},
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
