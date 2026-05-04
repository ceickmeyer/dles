import { wordleParser } from './wordle';
import { framedParser } from './framed';
import { timeGuessrParser } from './timeguessr';
import { costcodleParser } from './costcodle';
import { scrandleParser } from './scrandle';
import { guessTheHouseParser } from './guessthehouse';
import { decipherParser } from './decipher';
import { connectionsParser } from './connections';
import { genericParser } from './generic';

export interface Parser {
	name: string;
	parse(text: string): number | null;
}

export const PARSERS: Record<string, Parser> = {
	wordle: wordleParser,
	framed: framedParser,
	timeguessr: timeGuessrParser,
	costcodle: costcodleParser,
	scrandle: scrandleParser,
	guessthehouse: guessTheHouseParser,
	decipher: decipherParser,
	connections: connectionsParser,
	generic: genericParser
};

export const PARSER_OPTIONS = [
	{ value: '', label: 'Manual only' },
	{ value: 'wordle', label: 'Wordle (X/6)' },
	{ value: 'framed', label: 'Framed (🎥 squares)' },
	{ value: 'timeguessr', label: 'TimeGuessr (N/50,000)' },
	{ value: 'costcodle', label: 'Costcodle (X/6)' },
	{ value: 'scrandle', label: 'Scrandle (X/10)' },
	{ value: 'guessthehouse', label: 'Guess The House (🏠 squares)' },
	{ value: 'decipher', label: 'Decipher (time in seconds)' },
	{ value: 'connections', label: 'NYT Connections (grid)' },
	{ value: 'generic', label: 'Generic (first number)' },
	{ value: 'custom', label: 'Custom regex…' }
];

export function testCustomRegex(regex: string, text: string): number | null {
	try {
		const re = new RegExp(regex, 'i');
		const m = re.exec(text);
		if (!m) return null;
		const raw = m[1] ?? m[0];
		const n = parseFloat(raw);
		return isNaN(n) ? null : n;
	} catch {
		return null;
	}
}

export function parseShareText(text: string, parserKey: string | null, shareRegex?: string | null): number | null {
	if (!parserKey) return null;
	if (parserKey === 'custom') return shareRegex ? testCustomRegex(shareRegex, text) : null;
	const parser = PARSERS[parserKey];
	if (!parser) return genericParser.parse(text);
	return parser.parse(text);
}
