import { wordleParser } from './wordle';
import { framedParser } from './framed';
import { timeGuessrParser } from './timeguessr';
import { costcodleParser } from './costcodle';
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
	generic: genericParser
};

export const PARSER_OPTIONS = [
	{ value: '', label: 'Manual only' },
	{ value: 'wordle', label: 'Wordle' },
	{ value: 'framed', label: 'Framed' },
	{ value: 'timeguessr', label: 'TimeGuessr' },
	{ value: 'costcodle', label: 'Costcodle' },
	{ value: 'generic', label: 'Generic (first number)' }
];

export function parseShareText(text: string, parserKey: string | null): number | null {
	if (!parserKey) return null;
	const parser = PARSERS[parserKey];
	if (!parser) return genericParser.parse(text);
	return parser.parse(text);
}
