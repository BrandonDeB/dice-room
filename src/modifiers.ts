import { MarkdownPostProcessorContext, TFile } from "obsidian";
import { BlockLocation, findAllBlocks, normalizeType } from "./character";
import { ComponentFactory } from "./ui-lib/base-component";
import type { Roll } from "./roll";
import { DiceNotation } from "./ui-lib/ui-types";

/** Rolling two d20s and keeping the higher (advantage) or lower (disadvantage). */
export type Advantage = 'advantage' | 'disadvantage';

/** A parsed modifier value: dice to add plus one flat number, such as 1d4+2. */
export interface ModifierValue {
	valid: true;
	dice: string[];
	flat: number;
	text: string;
	/** Set when the value is `advantage` or `disadvantage`, as a condition might grant. */
	advantage?: Advantage;
}

/** A value that could not be parsed, kept so messages can show what was written. */
export interface InvalidModifierValue {
	valid: false;
	raw: string;
	reason: string;
}

/**
 * A bonus that rolls can include, such as Bless (+1d4) or Rage (+2).
 * Published by components; picked up by rolls that subscribe by name, or whose
 * categories overlap the modifier's `categories`.
 */
export interface Modifier {
	name: string;
	value: ModifierValue | InvalidModifierValue;
	active: boolean;
	categories: string[];
}

/**
 * Given a component's YAML data, the modifiers it publishes. Build each value with
 * parseModifierValue so it is validated in one place.
 */
export type ModifierPublisher<T = any> = (attributes: T) => Modifier[];

/** A modifier together with where it was published, for messages and links. */
export interface PublishedModifier extends Modifier {
	file: TFile;
	lineStart: number;
	location: BlockLocation;
}

/** A published modifier that is being added to a roll, so its value is known to be valid. */
export type AppliedModifier = PublishedModifier & { value: ModifierValue };

export interface ResolvedModifiers {
	/** Advantage or disadvantage the roll ends up with, if any. */
	advantage?: Advantage;
	applied: AppliedModifier[];
	/** Modifiers the roll would use, but that are switched off. */
	inactive: PublishedModifier[];
	problems: string[];
	notation: string;
}

/** Lower-case, trimmed category or name, for comparisons. */
export function normalizeName(value: string): string {
	return value.trim().toLowerCase();
}

/** Turn a YAML value that should be a list of names into one: a string or a list of strings. */
export function nameList(value: unknown): string[] {
	const items = Array.isArray(value) ? value : (value == null ? [] : [value]);
	return items
		.filter(item => typeof item === 'string' || typeof item === 'number')
		.map(item => String(item).trim())
		.filter(item => item !== '');
}

/** Every modifier published by any component among the character's notes. */
export async function findModifiers(ctx: MarkdownPostProcessorContext): Promise<PublishedModifier[]> {
	const publishers = new Map(
		ComponentFactory.allMetadata()
			.filter(metadata => metadata.modifiers)
			.map(metadata => [normalizeType(metadata.type), metadata.modifiers!]),
	);
	if (publishers.size === 0) return [];

	const found: PublishedModifier[] = [];
	for (const block of await findAllBlocks(ctx)) {
		const publish = publishers.get(block.location.type);
		if (!publish) continue;
		for (const modifier of publish(block.data)) {
			found.push({ ...modifier, file: block.file, lineStart: block.location.lineStart, location: block.location });
		}
	}
	return found;
}

// Dice may carry an advantage marker, like 2d20{adv}.
const TERM = /^([+-]?)(\d*d\d+(?:\{(?:adv|dis),?\})?|\d+)/i;

interface Term { sign: '+' | '-'; dice?: string; amount?: number; }

/** Split simple notation ("1d20+1d4-2") into terms, or null if it uses anything else. */
function parseTerms(notation: string): Term[] | null {
	let rest = notation.replace(/\s+/g, '');
	if (rest === '') return null;
	const terms: Term[] = [];
	while (rest.length > 0) {
		const match = TERM.exec(rest);
		if (!match) return null;
		// Every term after the first needs an explicit sign.
		if (terms.length > 0 && match[1] === '') return null;
		const sign = match[1] === '-' ? '-' : '+';
		const body = match[2].toLowerCase();
		terms.push(body.includes('d') ? { sign, dice: body } : { sign, amount: Number(body) });
		rest = rest.slice(match[0].length);
	}
	return terms;
}

/** Sum of the flat numbers among some terms. */
function flatTotal(terms: Term[]): number {
	return terms
		.filter(term => term.amount !== undefined)
		.reduce((sum, term) => sum + (term.sign === '-' ? -term.amount! : term.amount!), 0);
}

/** "+2", "-1", or "" for zero. */
function signed(n: number): string {
	return n > 0 ? `+${n}` : n < 0 ? `${n}` : '';
}

/**
 * Parse a modifier value from YAML: dice ("1d4"), a flat number ("+2", -1), or both
 * ("1d4+1"). Note property references like {{Characters/Aria.proficiency}} are filled
 * in first, as they are in rolls.
 */
export function parseModifierValue(value: unknown): ModifierValue | InvalidModifierValue {
	const raw = value == null ? '' : String(value);
	const invalid = (reason: string): InvalidModifierValue => ({ valid: false, raw, reason });

	if (typeof value !== 'string' && typeof value !== 'number') {
		return invalid('A modifier needs a value: dice like 1d4 or a number like +2.');
	}
	const keyword = raw.trim().toLowerCase();
	if (keyword === 'advantage' || keyword === 'disadvantage') {
		return { valid: true, dice: [], flat: 0, text: keyword, advantage: keyword };
	}
	const text = new DiceNotation(raw).toString();
	if (/\{\{.*\}\}/.test(text)) return invalid(`Could not fill in "${text}": check the note and property name.`);

	const terms = parseTerms(text);
	if (!terms) return invalid('Use dice like 1d4, a number like +2, or both like 1d4+1.');
	// The dice library adds every set of dice, so subtracting dice is not possible.
	if (terms.some(term => term.dice && term.sign === '-')) return invalid('Dice cannot be subtracted. Use a flat number like -2 instead.');

	const dice = terms.filter(term => term.dice).map(term => term.dice!);
	const flat = flatTotal(terms);
	return {
		valid: true,
		dice,
		flat,
		text: dice.length > 0 ? dice.join('+') + signed(flat) : (signed(flat) || '+0'),
	};
}

/**
 * Add modifier values to a roll's notation. All dice come first and flat numbers
 * are summed into one at the end, because the dice library only understands a
 * flat number in last place ("1d20+1d4+5" works, "1d20+5+1d4" does not).
 * Returns null if the base notation uses anything beyond dice and numbers.
 */
export function combineNotation(base: string, values: ModifierValue[]): string | null {
	if (values.length === 0) return base;
	const terms = parseTerms(base);
	if (!terms) return null;

	const dice = [
		...terms.filter(term => term.dice).map((term, i) => (i === 0 && term.sign === '+' ? '' : term.sign) + term.dice),
		...values.flatMap(value => value.dice.map(d => '+' + d)),
	];
	if (dice.length > 0 && dice[0].startsWith('+')) dice[0] = dice[0].slice(1);
	const total = flatTotal(terms) + values.reduce((sum, value) => sum + value.flat, 0);

	const notation = dice.join('');
	return notation === '' ? String(total) : notation + signed(total);
}

/**
 * Active modifiers that apply to any of these roll categories, for cards whose rolls
 * are generated (stats, skills) to show what is affecting them.
 */
export async function modifiersForCategories(ctx: MarkdownPostProcessorContext, categories: string[]): Promise<PublishedModifier[]> {
	const wanted = new Set(categories.map(normalizeName));
	return (await findModifiers(ctx)).filter(modifier =>
		modifier.active && modifier.value.valid && modifier.categories.some(category => wanted.has(normalizeName(category))));
}

/** Advantage and disadvantage cancel out: with both, the roll is normal. */
function combineAdvantage(sources: (Advantage | undefined)[]): Advantage | undefined {
	const advantage = sources.includes('advantage');
	const disadvantage = sources.includes('disadvantage');
	if (advantage === disadvantage) return undefined;
	return advantage ? 'advantage' : 'disadvantage';
}

/** Roll the first d20 twice, keeping the higher or lower: 1d20+5 becomes 2d20{adv}+5. */
export function applyAdvantage(notation: string, advantage: Advantage | undefined): string {
	if (!advantage) return notation;
	return notation.replace(/(^|[+-])1?d20(?![\d{])/i, `$12d20{${advantage === 'advantage' ? 'adv' : 'dis'}}`);
}

/** A critical hit doubles every damage die: 1d8+1d6+3 becomes 2d8+2d6+3. */
export function doubleDice(notation: string): string {
	return notation.replace(/(\d*)d(\d+)/gi, (_, count: string, sides: string) => `${(Number(count) || 1) * 2}d${sides}`);
}

/** Notation for people to read: the dice library's advantage markers are dropped. */
export function readableNotation(notation: string): string {
	return notation.replace(/\{(adv|dis),?\}/gi, '');
}

function where(modifier: PublishedModifier): string {
	return `${modifier.file.basename}, line ${modifier.lineStart + 1}`;
}

/**
 * Work out which modifiers apply to a roll and what the final notation is.
 * A modifier applies when it is active and either the roll subscribes to its name
 * or they share a category. Problems are reported instead of guessing, so a roll
 * is never made with the wrong bonus.
 */
export async function resolveRollModifiers(
	ctx: MarkdownPostProcessorContext,
	roll: Roll,
): Promise<ResolvedModifiers> {
	const base = roll.notation.toString();
	const subscribed = (roll.modifiers ?? []).map(normalizeName);
	const categories = new Set((roll.categories ?? []).map(normalizeName));
	if (subscribed.length === 0 && categories.size === 0) {
		return finish(roll, [], [], [], base);
	}

	const published = await findModifiers(ctx);
	const problems: string[] = [];

	const byName = new Map<string, PublishedModifier[]>();
	for (const modifier of published) {
		const key = normalizeName(modifier.name);
		byName.set(key, [...(byName.get(key) ?? []), modifier]);
	}

	for (const name of roll.modifiers ?? []) {
		if (!byName.has(normalizeName(name))) problems.push(`No modifier named "${name}" for this character`);
	}

	const relevant = published.filter(modifier =>
		subscribed.includes(normalizeName(modifier.name)) ||
		modifier.categories.some(category => categories.has(normalizeName(category))));

	const applied: AppliedModifier[] = [];
	const inactive: PublishedModifier[] = [];
	const seen = new Set<string>();
	for (const modifier of relevant) {
		const key = normalizeName(modifier.name);
		if (seen.has(key)) continue;
		seen.add(key);

		const sameName = byName.get(key) ?? [];
		if (sameName.length > 1) {
			problems.push(`${sameName.length} modifiers are named "${modifier.name}" (${sameName.map(where).join('; ')}). Rename or remove one.`);
			continue;
		}
		if (!modifier.active) {
			inactive.push(modifier);
			continue;
		}

		const value = modifier.value;
		if (!value.valid) {
			problems.push(`Modifier "${modifier.name}" has an invalid value "${value.raw}". ${value.reason}`);
			continue;
		}
		applied.push({ ...modifier, value });
	}

	const notation = combineNotation(base, applied.map(modifier => modifier.value));
	if (notation === null) {
		problems.push(`Modifiers can only be added to plain dice and numbers, not "${base}"`);
	}
	return finish(roll, applied, inactive, problems, notation ?? base);
}

/** Apply advantage (chosen, or from modifiers) and critical hits to the final notation. */
function finish(roll: Roll, applied: AppliedModifier[], inactive: PublishedModifier[], problems: string[], notation: string): ResolvedModifiers {
	// A modifier typed when rolling is added like any other.
	const temporary = roll.temporary === undefined ? undefined : parseModifierValue(roll.temporary);
	if (temporary && !temporary.valid) problems.push(`"${temporary.raw}" can't be added to the roll. ${temporary.reason}`);
	if (temporary?.valid) notation = combineNotation(notation, [temporary]) ?? notation;

	const advantage = combineAdvantage([roll.advantage, temporary?.valid ? temporary.advantage : undefined, ...applied.map(modifier => modifier.value.advantage)]);
	let final = applyAdvantage(notation, advantage);
	if (roll.critical) final = doubleDice(final);
	return { applied, inactive, problems, notation: final, advantage };
}
