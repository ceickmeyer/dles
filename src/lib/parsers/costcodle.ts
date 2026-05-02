import type { Parser } from './index';

// Costcodle #45 💰💰💰  →  3 money bags = 3 guesses (lower is better)
// Gold bag 💰 = wrong guess; the correct guess doesn't add a bag
export const costcodleParser: Parser = {
	name: 'costcodle',
	parse(text: string): number | null {
		const bags = (text.match(/💰/g) ?? []).length;
		if (bags === 0) return null;
		return bags;
	}
};
