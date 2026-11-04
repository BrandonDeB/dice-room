import { MarkdownPostProcessorContext, Notice } from "obsidian";
import { BlockTarget, invokeAction, previewAction } from "./character";
import { fireEvent, previewEvent } from "./events";
import { ActionError, Effect } from "./ui-lib/actions";
import { Advantage, hasD20, nameList, resolveRollModifiers } from "./modifiers";
import { CharacterData, loadCharacter } from "./character-data";
import { FormulaError, usesRollVariables } from "./formula";

/**
 * One entry of a card's `rolls` list: dice to throw, plus effects on other components
 * when it's used (spending ammo, a spell slot, ...). Without dice, its button only runs
 * the effects, like casting Goodberry.
 */
export interface Roll {
	name: string;
	/** A formula, like "1d20 + {{dex mod}}". */
	dice?: unknown;
	effects?: Effect[];
	modifiers?: string[];
	categories?: string[];
	description?: string;
	/** The button's text. Defaults to Roll, or Use without dice. */
	button?: string;
	/** A formula shown with the name, such as an ability score: "16 (+3)". */
	value?: unknown;
	/** Rolls that belong with this one, like an ability's save, drawn inside it. */
	rolls?: Roll[];
	/** Chosen when rolling: roll the d20 twice and keep the higher or lower. */
	advantage?: Advantage;
	/** Chosen when rolling: every die is doubled, as for a critical hit. */
	critical?: boolean;
	/** A modifier for this roll only, typed when rolling, such as -4. */
	temporary?: string;
}

/** Read one entry of a `rolls` list, or a message saying what's wrong with it. */
export function parseRoll(entry: unknown, nested = false): Roll | string {
	if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return 'Each roll needs a name, and dice or effects.';
	const { name, dice, effects, modifiers, categories, description, button, value, rolls } = entry as Record<string, unknown>;
	if (typeof name !== 'string' || name.trim() === '') return 'Each roll needs a name.';
	if (dice != null && typeof dice !== 'string' && typeof dice !== 'number') return `"${name}" has dice that aren't a formula, like 1d20+3.`;
	const parsedEffects = parseEffects(effects);
	if (dice == null && parsedEffects.length === 0) return `"${name}" needs dice, effects, or both.`;
	if (rolls != null && nested) return `"${name}" is inside another roll, so it can't have rolls of its own.`;
	if (rolls != null && !Array.isArray(rolls)) return `"${name}" has rolls that aren't a list.`;
	const children: Roll[] = [];
	for (const child of (rolls as unknown[] | undefined) ?? []) {
		const parsed = parseRoll(child, true);
		if (typeof parsed === 'string') return `In "${name}": ${parsed}`;
		children.push(parsed);
	}
	return {
		name: name.trim(),
		dice: dice ?? undefined,
		effects: parsedEffects,
		modifiers: nameList(modifiers),
		categories: nameList(categories),
		description: typeof description === 'string' ? description : undefined,
		button: typeof button === 'string' && button.trim() !== '' ? button.trim() : undefined,
		value: value ?? undefined,
		rolls: children.length > 0 ? children : undefined,
	};
}

/** Whether the roll throws dice, rather than only running effects. */
export function hasDice(roll: Roll): boolean {
	return roll.dice != null && String(roll.dice).trim() !== '';
}

function isEffect(value: unknown): value is Effect {
	const e = value as Effect;
	return !!e && typeof e.target === 'string' && typeof e.action === 'string';
}

/** The effects a YAML list holds, skipping entries without a target and action. */
export function parseEffects(value: unknown): Effect[] {
	return Array.isArray(value) ? value.filter(isEffect) : [];
}

/** What a roll came to: its total, and the d20 that counted if there was one. */
export interface RollOutcome {
	total: number;
	natural?: number;
}

/**
 * What a pre-rolled notation came to: its total (advantage and disadvantage keep only
 * the higher or lower d20) and the d20 that counted, if there was exactly one.
 */
export function rollOutcome(notation: {
	set: { num: number; type: string; func?: string }[];
	result: unknown[];
	constant: number | null;
	op: string;
}): RollOutcome {
	let index = 0;
	let total = 0;
	let natural: number | undefined;
	for (const set of notation.set) {
		const values = notation.result.slice(index, index + set.num).map(value => Number(value) || 0);
		index += set.num;
		const kept = set.func === 'adv' ? [Math.max(...values)] : set.func === 'dis' ? [Math.min(...values)] : values;
		total += kept.reduce((sum, value) => sum + value, 0);
		if (natural === undefined && set.type === 'd20' && kept.length === 1) natural = kept[0];
	}
	const constant = notation.constant ?? 0;
	return { total: total + (notation.op === '-' ? -constant : constant), natural };
}

/** Dice that have been thrown: what they came to, and when they finish landing. */
export interface ThrownRoll {
	/** Known as soon as they're thrown, since results are decided first. */
	outcome: RollOutcome;
	/** Resolves once the dice have landed in the Dice view. */
	landed: Promise<void>;
}

/** Where dice actually get thrown. Implemented by the plugin using the Dice view. */
export interface DiceRoller {
	ready(): boolean;
	/** Throw the dice, or return null if they couldn't be thrown. */
	roll(notation: string): ThrownRoll | null;
}

/** Write `$total` as an effect argument to use the roll's total, e.g. heal by what was rolled. */
const TOTAL = '$total';

/** Roll results conditions and arguments can use. */
type RollVariables = { total?: number; natural?: number };

function usesTotal(effect: Effect): boolean {
	return Object.values(effect.args ?? {}).some(value => value === TOTAL);
}

/** Effects that use the roll's result run after the dice instead of before. */
function afterRoll(effect: Effect): boolean {
	return usesTotal(effect) || usesRollVariables(effect.if);
}

/** The effect with `$total` replaced by a number. */
function withTotal(effect: Effect, total: number): Effect {
	const args = Object.fromEntries(Object.entries(effect.args ?? {})
		.map(([key, value]) => [key, value === TOTAL ? total : value]));
	return { ...effect, args };
}

/** What one of a roll's effects would do, or why it can't. */
export interface EffectPreview {
	effect: Effect;
	message?: string;
	problem?: string;
	target?: BlockTarget;
}

/** A user-facing message for anything an effect throws. */
function effectError(effect: Effect, err: unknown): string {
	if (err instanceof ActionError || err instanceof FormulaError) return err.message;
	console.error(err);
	return `Could not run ${effect.action} on ${effect.target}`;
}

/** Effects with `target: event` fire a character event instead of running an action. */
function isEventEffect(effect: Effect): boolean {
	return effect.target.trim().toLowerCase() === 'event';
}

/** The event an event effect fires, e.g. "long rest". Throws ActionError if it isn't valid. */
function effectEventName(effect: Effect): string {
	if (effect.action.trim().toLowerCase() !== 'emit') {
		throw new ActionError(`"event" has no action named "${effect.action}". Use emit.`);
	}
	const name = effect.args?.name;
	if (typeof name !== 'string' || name.trim() === '') throw new ActionError('Missing "name" of the event to fire');
	return name.trim();
}

/** Preview one effect: an action on a component, or firing an event. Throws if it would fail. */
async function previewEffect(ctx: MarkdownPostProcessorContext, effect: Effect): Promise<EffectPreview> {
	if (isEventEffect(effect)) {
		const name = effectEventName(effect);
		const changes = await previewEvent(ctx, name);
		// Failing subscriptions are shown but don't stop the roll, as when taking a rest.
		const details = changes.flatMap(change => change.messages).join('; ');
		const failing = changes.flatMap(change => change.problems);
		const couldNot = failing.length > 0 ? ` (could not: ${failing.join('; ')})` : '';
		return { effect, message: `Triggers ${name}: ${details || 'nothing to change'}${couldNot}`, target: changes[0]?.target };
	}
	if (usesTotal(effect)) {
		// The total isn't known yet: check the target with a stand-in, and say what will happen.
		const preview = await previewAction(ctx, effect.target, effect.action, withTotal(effect, 1).args ?? {});
		const action = effect.action.charAt(0).toUpperCase() + effect.action.slice(1);
		return { effect, message: `${action} by the roll's total`, target: preview.target };
	}
	const preview = await previewAction(ctx, effect.target, effect.action, effect.args ?? {});
	return { effect, message: preview.message, target: preview.target };
}

/** Run one effect and return its announcement, if any. Throws ActionError if it fails. */
async function runEffect(ctx: MarkdownPostProcessorContext, effect: Effect): Promise<string | undefined> {
	if (isEventEffect(effect)) {
		const name = effectEventName(effect);
		const messages = await fireEvent(ctx, name);
		return `${name.charAt(0).toUpperCase()}${name.slice(1)}: ${messages.join(' ') || 'nothing changed.'}`;
	}
	return invokeAction(ctx, effect.target, effect.action, effect.args ?? {});
}

/** Whether an effect's `if` holds. Effects without one always run. */
function conditionHolds(character: CharacterData, effect: Effect, variables: RollVariables = {}): boolean {
	return effect.if == null || character.condition(effect.if, variables);
}

/**
 * Work out what each effect would do, without changing anything. Rolls show this first,
 * and performRoll checks it before running. Effects whose `if` doesn't hold are left
 * out. An effect whose `if` needs the roll's result says when it will happen, and can't
 * stop the roll. Without a roll (`rolled: false`), effects using the result can't run.
 */
export async function previewEffects(
	ctx: MarkdownPostProcessorContext,
	character: CharacterData,
	effects: Effect[] | undefined,
	rolled = true,
): Promise<EffectPreview[]> {
	const previews: EffectPreview[] = [];
	for (const effect of effects ?? []) {
		if (!rolled && afterRoll(effect)) {
			previews.push({ effect, problem: `${effect.action} uses the roll's result, but nothing is rolled` });
			continue;
		}
		try {
			if (usesRollVariables(effect.if)) {
				try {
					const preview = await previewEffect(ctx, effect);
					previews.push({ ...preview, message: `If ${effect.if}: ${preview.message ?? effect.action}` });
				} catch (err) {
					previews.push({ effect, message: `If ${effect.if}: ${effect.action} (can't now: ${effectError(effect, err)})` });
				}
				continue;
			}
			if (!conditionHolds(character, effect)) continue;
			previews.push(await previewEffect(ctx, effect));
		} catch (err) {
			previews.push({ effect, problem: effectError(effect, err) });
		}
	}
	return previews;
}

/**
 * Check every effect, then run those that don't need the roll's result. Returns their
 * announcements, or null after a Notice saying why nothing (or not all) ran.
 * Checking first means a roll that would fail partway doesn't spend anything.
 */
async function runImmediateEffects(ctx: MarkdownPostProcessorContext, character: CharacterData, effects: Effect[], rolled: boolean): Promise<string[] | null> {
	const problems = (await previewEffects(ctx, character, effects, rolled))
		.map(preview => preview.problem)
		.filter((problem): problem is string => !!problem);
	if (problems.length > 0) {
		new Notice(problems.join(' '));
		return null;
	}
	const announcements: string[] = [];
	for (const effect of effects.filter(effect => !afterRoll(effect))) {
		try {
			if (!conditionHolds(character, effect)) continue;
			const message = await runEffect(ctx, effect);
			if (message) announcements.push(message);
		} catch (err) {
			new Notice(effectError(effect, err));
			return null;
		}
	}
	return announcements;
}

/** Run a roll's effects with no dice, like casting Goodberry, and announce what happened. */
export async function performEffects(ctx: MarkdownPostProcessorContext, effects: Effect[]): Promise<void> {
	const character = await loadCharacter(ctx);
	const announcements = await runImmediateEffects(ctx, character, effects, false);
	if (announcements && announcements.length > 0) new Notice(announcements.join('\n'));
}

export async function performRoll(
	ctx: MarkdownPostProcessorContext,
	roll: Roll,
	roller: DiceRoller,
): Promise<void> {
	if (!hasDice(roll)) {
		await performEffects(ctx, roll.effects ?? []);
		return;
	}
	if (!roller.ready()) return;

	const character = await loadCharacter(ctx);
	const modifiers = resolveRollModifiers(character, roll);
	if (modifiers.problems.length > 0) {
		new Notice(modifiers.problems.join(' '));
		return;
	}

	const effects = roll.effects ?? [];
	const announcements = await runImmediateEffects(ctx, character, effects, true);
	if (!announcements) return;

	const thrown = roller.roll(modifiers.notation);
	// Results are decided before the dice are thrown, but wait for them to land, so the
	// notice and anything using the total don't give the result away early.
	await thrown?.landed;
	const outcome = thrown?.outcome;
	const total = outcome?.total ?? null;

	if (hasD20(modifiers.notation)) {
		if (outcome?.natural === 20) announcements.unshift('Natural 20!');
		if (outcome?.natural === 1) announcements.unshift('Natural 1.');
	}

	// Effects using the result (healing by what was rolled) run once it is known.
	for (const effect of effects.filter(afterRoll)) {
		if (total === null) {
			announcements.push(`Could not read the roll's total, so ${effect.action} was skipped.`);
			continue;
		}
		try {
			if (!conditionHolds(character, effect, { total, natural: outcome?.natural })) continue;
			const message = await runEffect(ctx, withTotal(effect, total));
			if (message) announcements.push(message);
		} catch (err) {
			announcements.push(effectError(effect, err));
		}
	}
	if (announcements.length > 0) new Notice(announcements.join('\n'));
}
