import { MarkdownPostProcessorContext, TFile } from "obsidian";
import { getApp } from "./app-provider";
import { BlockLocation, BlockMatch, findAllBlocks } from "./character";
import { allComponents } from "./ui-lib/component";
import { DiceAmount, FormulaError, FormulaScope, evaluate, evaluateCondition, evaluateNumber } from "./formula";
import { AppliedModifier, Modifier, PublishedModifier, modifierValue, normalizeName } from "./modifiers";

/** A named number a component publishes, such as `dex mod` or `armor class`. */
export interface ValueDefinition {
	name: string;
	/** A number or a formula, like "floor(({{dex}} - 10) / 2)". */
	formula: unknown;
	/** Modifiers with any of these categories add their numbers to it, like `armor class`. */
	categories: string[];
}

/** A value, and where it was published, for messages and links. */
export interface PublishedValue extends ValueDefinition {
	file: TFile;
	location: BlockLocation;
}

/** A value worked out: its total, and the modifiers that added to it. */
export interface ValueTotal {
	total: number;
	modifiers: AppliedModifier[];
}

/**
 * Everything about a character that formulas and rolls need, read once from all of
 * its notes: the blocks, the modifiers and the values. Values and modifier values are
 * worked out when asked for, so they can use each other, and going in a circle is an error.
 */
export interface CharacterData {
	blocks: BlockMatch[];
	modifiers: PublishedModifier[];
	values: PublishedValue[];
	/** Looks up `{{name}}` in formulas. */
	scope: FormulaScope;
	/** A value's total, including modifiers. Throws FormulaError. */
	value(name: string): ValueTotal;
	/** Dice and a number. Throws FormulaError. */
	evaluate(formula: unknown, variables?: Record<string, number | undefined>): DiceAmount;
	/** A comparison, like `$total >= 10`. Throws FormulaError. */
	condition(formula: unknown, variables?: Record<string, number | undefined>): boolean;
}

/** A note property, for `{{Characters/Aria.speed}}`, or undefined if there's no such note. */
function noteProperty(name: string): unknown {
	const dot = name.lastIndexOf('.');
	if (dot <= 0) return undefined;
	const file = getApp().vault.getAbstractFileByPath(`${name.slice(0, dot)}.md`);
	if (!(file instanceof TFile)) return undefined;
	return getApp().metadataCache.getFileCache(file)?.frontmatter?.[name.slice(dot + 1)];
}

export async function loadCharacter(ctx: MarkdownPostProcessorContext): Promise<CharacterData> {
	const blocks = await findAllBlocks(ctx);
	const components = allComponents();

	const rawModifiers: (Modifier & { file: TFile; location: BlockLocation })[] = [];
	const values: PublishedValue[] = [];
	for (const block of blocks) {
		for (const component of components) {
			if (!Object.prototype.hasOwnProperty.call(block.data, component.key)) continue;
			const data = block.data[component.key];
			for (const modifier of component.modifiers?.(data) ?? []) {
				rawModifiers.push({ ...modifier, file: block.file, location: block.location });
			}
			for (const value of component.values?.(data) ?? []) {
				values.push({ ...value, file: block.file, location: block.location });
			}
		}
	}

	// Work out each thing once. A name being worked out that's asked for again is a circle.
	const inProgress = new Set<string>();
	const guard = <T>(key: string, label: string, work: () => T): T => {
		if (inProgress.has(key)) throw new FormulaError(`${label} uses itself, through other values or modifiers`);
		inProgress.add(key);
		try {
			return work();
		} finally {
			inProgress.delete(key);
		}
	};

	const valueCache = new Map<string, ValueTotal>();
	const modifierCache = new Map<number, PublishedModifier['value']>();

	const scope: FormulaScope = {
		value: (name) => character.value(name).total,
	};

	const modifierValueAt = (index: number): PublishedModifier['value'] => {
		const cached = modifierCache.get(index);
		if (cached) return cached;
		const modifier = rawModifiers[index];
		const result = (() => {
			try {
				return guard(`modifier:${normalizeName(modifier.name)}`, `Modifier "${modifier.name}"`,
					() => modifierValue(modifier.value, scope));
			} catch (err) {
				if (!(err instanceof FormulaError)) throw err;
				return { valid: false as const, raw: String(modifier.value), reason: err.message };
			}
		})();
		modifierCache.set(index, result);
		return result;
	};

	const published = (index: number): PublishedModifier => {
		const { name, active, categories, showWhenOff, file, location } = rawModifiers[index];
		return {
			name, active, categories, file, location,
			showWhenOff: showWhenOff !== false,
			lineStart: location.lineStart,
			value: modifierValueAt(index),
		};
	};

	let modifierList: PublishedModifier[] | null = null;
	const character: CharacterData = {
		blocks,
		values,
		get modifiers() {
			modifierList ??= rawModifiers.map((_, index) => published(index));
			return modifierList;
		},
		scope,
		value(name) {
			const key = normalizeName(name);
			const cached = valueCache.get(key);
			if (cached) return cached;

			const matches = values.filter(value => normalizeName(value.name) === key);
			if (matches.length === 0) {
				const property = noteProperty(name);
				if (property === undefined || property === null) throw new FormulaError(`No value named "${name}" for this character`);
				return { total: guard(`note:${key}`, `{{${name}}}`, () => evaluateNumber(property, scope)), modifiers: [] };
			}
			if (matches.length > 1) {
				const notes = [...new Set(matches.map(match => match.file.basename))].join(', ');
				throw new FormulaError(`${matches.length} values are named "${name}" (in ${notes}). Rename or remove one.`);
			}
			const definition = matches[0];
			const result = guard(`value:${key}`, `Value "${definition.name}"`, () => {
				const base = evaluateNumber(definition.formula, scope);
				// Only flat numbers can add to a value; dice and advantage apply to rolls.
				const wanted = new Set(definition.categories.map(normalizeName));
				const modifiers = rawModifiers
					.map((modifier, index) => ({ modifier, index }))
					.filter(({ modifier }) => modifier.active && modifier.categories.some(category => wanted.has(normalizeName(category))))
					.map(({ index }) => published(index))
					.filter((modifier): modifier is AppliedModifier =>
						modifier.value.valid && modifier.value.dice.length === 0 && !modifier.value.advantage && modifier.value.flat !== 0);
				return { total: modifiers.reduce((sum, modifier) => sum + modifier.value.flat, base), modifiers };
			});
			valueCache.set(key, result);
			return result;
		},
		evaluate: (formula, variables) => evaluate(formula, { ...scope, variables }),
		condition: (formula, variables) => evaluateCondition(formula, { ...scope, variables }),
	};
	return character;
}
