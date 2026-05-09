import { wordleParser } from './wordle';
import { framedParser } from './framed';
import { timeGuessrParser } from './timeguessr';
import { costcodleParser } from './costcodle';
import { scrandleParser } from './scrandle';
import { guessTheHouseParser } from './guessthehouse';
import { decipherParser } from './decipher';
import { connectionsParser } from './connections';
import { metazooaParser } from './metazooa';
import { heardle90sParser } from './heardle90s';
import { coindleParser } from './coindle';
import { quordleParser } from './quordle';
import { estimadleParser } from './estimadle';
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
	metazooa: metazooaParser,
	heardle90s: heardle90sParser,
	coindle: coindleParser,
	quordle: quordleParser,
	estimadle: estimadleParser,
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
	{ value: 'metazooa', label: 'Metazooa (1–20 guesses)' },
	{ value: 'heardle90s', label: '90s Heardle (1–6 guesses)' },
	{ value: 'coindle', label: 'Coindle (streak, higher is better)' },
	{ value: 'quordle', label: 'Quordle (0–36, higher is better)' },
	{ value: 'estimadle', label: 'Estimadle (0–100%)' },
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
