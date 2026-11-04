import { MarkdownPostProcessorContext, Notice } from "obsidian";
import { BlockTarget, invokeAction, previewAction } from "./character";
import { fireEvent, previewEvent } from "./events";
import { ActionError, Effect } from "./ui-lib/actions";
import { DiceNotation } from "./ui-lib/ui-types";
import { Advantage, nameList, resolveRollModifiers } from "./modifiers";

/**
 * A single clickable roll: the dice to throw, plus effects on other
 * components that happen when it is used (spending ammo, a spell slot, ...).
 * Any component that rolls dice describes its rolls this way.
 */
export interface Roll {
	notation: DiceNotation;
	effects?: Effect[];
	modifiers?: string[];
	categories?: string[];
	/** Chosen when rolling: roll the d20 twice and keep the higher or lower. */
	advantage?: Advantage;
	/** Chosen when rolling damage after a critical hit: every die is doubled. */
	critical?: boolean;
}

/**
 * How a roll is written in YAML. Either a plain dice string:
 *   hitRoll: 1d20+5
 * or an object when it has effects, modifiers or extra categories:
 *   hitRoll:
 *     dice: 1d20+5
 *     effects:
 *       - { target: inventory, action: remove, args: { item: Arrows } }
 *     modifiers: [Archery]
 *     categories: [ranged]
 */
export type RollField = string | number | {
	dice: string | number;
	effects?: Effect[];
	modifiers?: string[];
	categories?: string[];
};

/**
 * Normalize a YAML roll field. Returns null if it is missing or malformed.
 * `defaultCategories` are the categories the component gives this roll (such as
 * ["attack", "weapon"]); the YAML can add more.
 */
export function parseRoll(field: unknown, defaultCategories: string[] = []): Roll | null {
	if (typeof field === 'string' || typeof field === 'number') {
		return { notation: new DiceNotation(String(field)), categories: [...defaultCategories] };
	}

	if (field && typeof field === 'object') {
		const { dice, effects, modifiers, categories } =
			field as { dice?: unknown; effects?: unknown; modifiers?: unknown; categories?: unknown };
		if (typeof dice !== 'string' && typeof dice !== 'number') return null;
		return {
			notation: new DiceNotation(String(dice)),
			effects: Array.isArray(effects) ? effects.filter(isEffect) : undefined,
			modifiers: nameList(modifiers),
			categories: [...new Set([...defaultCategories, ...nameList(categories)])],
		};
	}
	return null;
}

function isEffect(value: unknown): value is Effect {
	const e = value as Effect;
	return !!e && typeof e.target === 'string' && typeof e.action === 'string';
}

/** Where dice actually get thrown. Implemented by the plugin using the Dice view. */
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

export interface DiceRoller {
	ready(): boolean;
	/** Throw the dice. Returns what they came to, or null if it isn't known. */
	roll(notation: string): RollOutcome | null;
}

/** Write `$total` as an effect argument to use the roll's total, e.g. heal by what was rolled. */
const TOTAL = '$total';

/** Effects that use the roll's total run after the dice instead of before. */
function usesTotal(effect: Effect): boolean {
	return Object.values(effect.args ?? {}).some(value => value === TOTAL);
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
	if (err instanceof ActionError) return err.message;
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

/** Preview one effect: an action on a component, or firing an event. Throws ActionError if it would fail. */
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

/**
 * Work out what each of a roll's effects would do, without changing anything.
 * Rolls show this before they're made, and performRoll checks it before running.
 */
export async function previewEffects(ctx: MarkdownPostProcessorContext, roll: Roll): Promise<EffectPreview[]> {
	const previews: EffectPreview[] = [];
	for (const effect of roll.effects ?? []) {
		try {
			previews.push(await previewEffect(ctx, effect));
		} catch (err) {
			previews.push({ effect, problem: effectError(effect, err) });
		}
	}
	return previews;
}

/**
 * Perform a roll for a component: work out its modifiers, check and then run its
 * effects, throw the dice with the modifiers added, and announce what the effects did
 * ("Used 1 of Arrows. 1 left.").
 * Nothing happens if the roller is not ready, so ammo is not spent on a roll that
 * never lands. Modifier problems, or any effect that would be rejected, stop the roll
 * before any effect runs. If an effect still fails while running (the note changed in
 * between), the user is told why and the dice are not thrown.
 */
export async function performRoll(
	ctx: MarkdownPostProcessorContext,
	roll: Roll,
	roller: DiceRoller,
): Promise<void> {
	if (!roller.ready()) return;

	const modifiers = await resolveRollModifiers(ctx, roll);
	if (modifiers.problems.length > 0) {
		new Notice(modifiers.problems.join(' '));
		return;
	}

	// Check every effect first, so a roll that would fail partway doesn't spend anything.
	const problems = (await previewEffects(ctx, roll))
		.map(preview => preview.problem)
		.filter((problem): problem is string => !!problem);
	if (problems.length > 0) {
		new Notice(problems.join(' '));
		return;
	}

	const effects = roll.effects ?? [];
	const announcements: string[] = [];
	for (const effect of effects.filter(effect => !usesTotal(effect))) {
		try {
			const message = await runEffect(ctx, effect);
			if (message) announcements.push(message);
		} catch (err) {
			new Notice(effectError(effect, err));
			return;
		}
	}

	const outcome = roller.roll(modifiers.notation);
	const total = outcome?.total ?? null;

	// A natural 20 on an attack is a critical hit; a natural 1 always misses.
	if (roll.categories?.includes('attack')) {
		if (outcome?.natural === 20) announcements.unshift('Critical hit! Right-click the Damage roll and choose "Roll critical hit".');
		if (outcome?.natural === 1) announcements.unshift('Natural 1: the attack misses.');
	}

	// Effects using the total (healing by what was rolled) run once it is known.
	for (const effect of effects.filter(usesTotal)) {
		if (total === null) {
			announcements.push(`Could not read the roll's total, so ${effect.action} was skipped.`);
			continue;
		}
		try {
			const message = await runEffect(ctx, withTotal(effect, total));
			if (message) announcements.push(message);
		} catch (err) {
			announcements.push(effectError(effect, err));
		}
	}
	if (announcements.length > 0) new Notice(announcements.join('\n'));
}
