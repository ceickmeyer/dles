// Catppuccin Mocha palette — 12 distinct colors, shared everywhere a player
// needs a consistent identity color (the ELO Over Time chart, leaderboard
// rows, Yesterday's Winners cards).
export const PLAYER_COLORS = [
	'#f38ba8', // red
	'#89b4fa', // blue
	'#a6e3a1', // green
	'#cba6f7', // mauve
	'#fab387', // peach
	'#89dceb', // sky
	'#f9e2af', // yellow
	'#74c7ec', // sapphire
	'#f5c2e7', // pink
	'#94e2d5', // teal
	'#eba0ac', // maroon
	'#b4befe' // lavender
];

// Same assignment the ELO Over Time chart uses: qualified players (>= the
// leaderboard's minimum sessions to appear), ordered by current ELO
// descending, each getting the next color in the palette. A player not yet
// qualified simply has no entry — callers should treat that as "no color
// assigned yet" rather than falling back to palette[0].
export function assignPlayerColors(qualifiedPlayerIdsByEloDesc: string[]): Map<string, string> {
	return new Map(
		qualifiedPlayerIdsByEloDesc.map((id, i) => [id, PLAYER_COLORS[i % PLAYER_COLORS.length]])
	);
}
