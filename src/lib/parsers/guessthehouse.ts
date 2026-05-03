import type { Parser } from './index';

// #GuessTheHouse #586
// 🏠 🟥 🟥 🟩 ⬜ ⬜ ⬜
// Split on 🏠, count 🟥 before the first 🟩, result = reds + 1
export const guessTheHouseParser: Parser = {
	name: 'guessthehouse',
	parse(text: string): number | null {
		const afterIcon = text.split('🏠')[1];
		if (!afterIcon) return null;
		const greenIdx = afterIcon.indexOf('🟩');
		if (greenIdx === -1) return null;
		const reds = (afterIcon.slice(0, greenIdx).match(/🟥/g) ?? []).length;
		return reds + 1;
	}
};
