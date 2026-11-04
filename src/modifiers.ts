import { TFile } from "obsidian";
import type { BlockLocation } from "./character";
import type { CharacterData } from "./character-data";
import type { Roll } from "./roll";
import { DiceAmount, EMPTY_SCOPE, FormulaError, FormulaScope, amountText, evaluate, toNotation } from "./formula";

/** Rolling two d20s and keeping the higher (advantage) or lower (disadvantage). */
export type Advantage = 'advantage' | 'disadvantage';

/** A worked-out modifier value: dice to add plus one number, such as 1d4+2. */
export interface ModifierValue {
	valid: true;
	dice: string[];
	flat: number;
	text: string;
	/** Set when the value is `advantage` or `disadvantage`. */
	advantage?: Advantage;
}

/** A value that could not be worked out, kept so messages can show what was written. */
export interface InvalidModifierValue {
	valid: false;
	raw: string;
	reason: string;
}

/**
 * A bonus that rolls can include, such as Bless (+1d4) or Rage (+2), as a component
 * publishes it. Its value is a formula, worked out once the character is loaded.
 * Rolls pick it up by name, or when their categories overlap its `categories`.
 */
export interface Modifier {
	name: string;
	value: unknown;
	active: boolean;
	categories: string[];
}

/** A modifier with its value worked out, and where it was published, for messages and links. */
export interface PublishedModifier {
	name: string;
	value: ModifierValue | InvalidModifierValue;
	active: boolean;
	categories: string[];
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
	/** What the dice library throws, or "" if the roll can't be made. */
	notation: string;
}

/** Lower-case, trimmed category or name, for comparisons. */
export function normalizeName(value: string): string {
	return value.trim().replace(/\s+/g, ' ').toLowerCase();
}

/** Turn a YAML value that should be a list of names into one: a string or a list of strings. */
export function nameList(value: unknown): string[] {
	const items = Array.isArray(value) ? value : (value == null ? [] : [value]);
	return items
		.filter(item => typeof item === 'string' || typeof item === 'number')
		.map(item => String(item).trim())
		.filter(item => item !== '');
}

/**
 * Work out a modifier value: dice ("1d4"), a number (-1), a formula using values
 * ("-2 * {{exhaustion}}"), or the words `advantage` or `disadvantage`.
 */
export function modifierValue(value: unknown, scope: FormulaScope = EMPTY_SCOPE): ModifierValue | InvalidModifierValue {
	const raw = value == null ? '' : String(value);
	const keyword = raw.trim().toLowerCase();
	if (keyword === 'advantage' || keyword === 'disadvantage') {
		return { valid: true, dice: [], flat: 0, text: keyword, advantage: keyword };
	}
	if (typeof value !== 'string' && typeof value !== 'number') {
		return { valid: false, raw, reason: 'A modifier needs a value: dice like 1d4, a number like +2, or advantage.' };
	}
	try {
		const amount = evaluate(value, scope);
		return { valid: true, ...amount, text: amountText(amount) };
	} catch (err) {
		if (!(err instanceof FormulaError)) throw err;
		return { valid: false, raw, reason: err.message };
	}
}

/** A value that changes nothing, like exhaustion at level 0, so rolls don't list it. */
function changesNothing(value: ModifierValue): boolean {
	return value.dice.length === 0 && value.flat === 0 && !value.advantage;
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

/** A critical hit doubles every die: 1d8+1d6+3 becomes 2d8+2d6+3. */
export function doubleDice(notation: string): string {
	return notation.replace(/(\d*)d(\d+)/gi, (_, count: string, sides: string) => `${(Number(count) || 1) * 2}d${sides}`);
}

/** Notation for people to read: the dice library's advantage markers are dropped. */
export function readableNotation(notation: string): string {
	return notation.replace(/\{(adv|dis),?\}/gi, '');
}

/** Whether a roll throws a d20, so it can have advantage. */
export function hasD20(notation: string): boolean {
	return /(^|[^\d])d20(?!\d)/i.test(notation);
}

function where(modifier: PublishedModifier): string {
	return `${modifier.file.basename}, line ${modifier.lineStart + 1}`;
}

/** Active modifiers that apply to any of these categories, for showing what affects a value or roll. */
export function modifiersForCategories(character: CharacterData, categories: string[]): AppliedModifier[] {
	const wanted = new Set(categories.map(normalizeName));
	return character.modifiers.filter((modifier): modifier is AppliedModifier =>
		modifier.active && modifier.value.valid && !changesNothing(modifier.value) &&
		modifier.categories.some(category => wanted.has(normalizeName(category))));
}

/**
 * Work out a roll's dice and which modifiers apply. A modifier applies when it is
 * active and either the roll subscribes to its name or they share a category.
 * Problems are reported instead of guessing, so a roll is never made with the wrong bonus.
 */
export function resolveRollModifiers(character: CharacterData, roll: Roll): ResolvedModifiers {
	const problems: string[] = [];
	let base: DiceAmount = { dice: [], flat: 0 };
	try {
		base = character.evaluate(roll.dice);
	} catch (err) {
		if (!(err instanceof FormulaError)) throw err;
		problems.push(err.message);
	}

	const subscribed = (roll.modifiers ?? []).map(normalizeName);
	const categories = new Set((roll.categories ?? []).map(normalizeName));

	const byName = new Map<string, PublishedModifier[]>();
	for (const modifier of character.modifiers) {
		const key = normalizeName(modifier.name);
		byName.set(key, [...(byName.get(key) ?? []), modifier]);
	}
	for (const name of roll.modifiers ?? []) {
		if (!byName.has(normalizeName(name))) problems.push(`No modifier named "${name}" for this character`);
	}

	const relevant = character.modifiers.filter(modifier =>
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
		if (!changesNothing(value)) applied.push({ ...modifier, value });
	}

	// A modifier typed when rolling is added like any other.
	const values = applied.map(modifier => modifier.value);
	const temporary = roll.temporary === undefined ? undefined : modifierValue(roll.temporary, character.scope);
	if (temporary && !temporary.valid) problems.push(`"${temporary.raw}" can't be added to the roll. ${temporary.reason}`);
	if (temporary?.valid) values.push(temporary);

	const advantage = combineAdvantage([roll.advantage, ...values.map(value => value.advantage)]);
	let notation = toNotation({
		dice: [...base.dice, ...values.flatMap(value => value.dice)],
		flat: values.reduce((sum, value) => sum + value.flat, base.flat),
	});
	notation = applyAdvantage(notation, advantage);
	if (roll.critical) notation = doubleDice(notation);
	return { applied, inactive, problems, notation: problems.length > 0 ? '' : notation, advantage };
}
