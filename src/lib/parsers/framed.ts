import type { Parser } from './index';

// Framed #123 🎥 🔴 🔴 🟩  →  2 red squares = 2 guesses (lower is better)
export const framedParser: Parser = {
	name: 'framed',
	parse(text: string): number | null {
		const emojiSection = text.replace(/Framed\s*#\d+\s*🎥\s*/i, '');
		const reds = (emojiSection.match(/🔴/g) ?? []).length;
		// First green ends counting; result is number of reds before it
		const firstGreen = emojiSection.indexOf('🟩');
		if (firstGreen === -1) return null;
		const beforeGreen = emojiSection.slice(0, firstGreen);
		const redsBeforeGreen = (beforeGreen.match(/🔴/g) ?? []).length;
		return redsBeforeGreen + 1; // +1 for the correct guess itself
	}
};
