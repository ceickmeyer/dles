import { wordleParser } from './wordle';
import { framedParser } from './framed';
import { timeGuessrParser } from './timeguessr';
import { costcodleParser } from './costcodle';
import { scrandleParser } from './scrandle';
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
	generic: genericParser
};

export const PARSER_OPTIONS = [
	{ value: '', label: 'Manual only' },
	{ value: 'wordle', label: 'Wordle (X/6)' },
	{ value: 'framed', label: 'Framed (X/6)' },
	{ value: 'timeguessr', label: 'TimeGuessr (Score: N)' },
	{ value: 'costcodle', label: 'Costcodle (X/6)' },
	{ value: 'scrandle', label: 'Scrandle (X/10)' },
	{ value: 'generic', label: 'Generic (first number)' }
];

export function parseShareText(text: string, parserKey: string | null): number | null {
	if (!parserKey) return null;
	const parser = PARSERS[parserKey];
	if (!parser) return genericParser.parse(text);
	return parser.parse(text);
}
