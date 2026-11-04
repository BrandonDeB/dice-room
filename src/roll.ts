import { MarkdownPostProcessorContext, Notice } from "obsidian";
import { invokeAction } from "./character";
import { ActionError, Effect } from "./ui-lib/actions";
import { DiceNotation } from "./ui-lib/ui-types";
import { nameList, resolveRollModifiers } from "./modifiers";

/**
 * A single clickable roll: the dice to throw, plus effects on other
 * components that happen when it is used (spending ammo, a spell slot, ...).
 * Any component that rolls dice describes its rolls this way.
 */
export interface Roll {
	notation: DiceNotation;
	effects?: Effect[];
	/** Names of modifiers this roll subscribes to, e.g. ["Archery"]. */
	modifiers?: string[];
	/** Kinds of roll this is, e.g. ["attack", "weapon"]. Modifiers for these categories apply. */
	categories?: string[];
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
export interface DiceRoller {
	/** False if rolling is not possible right now; should tell the user why. */
	ready(): boolean;
	roll(notation: string): void;
}

/**
 * Perform a roll for a component: work out its modifiers, run its effects in order,
 * then throw the dice with the modifiers added.
 * Nothing happens if the roller is not ready, so ammo is not spent on a roll that
 * never lands. Modifier problems (a missing or duplicated modifier, a bad value)
 * stop the roll before any effects run. If an effect is rejected, the user is told
 * why and the dice are not thrown. Effects that already succeeded are not undone.
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

	for (const effect of roll.effects ?? []) {
		try {
			await invokeAction(ctx, effect.target, effect.action, effect.args ?? {});
		} catch (err) {
			if (err instanceof ActionError) {
				new Notice(err.message);
			} else {
				console.error(err);
				new Notice(`Could not run ${effect.action} on ${effect.target}`);
			}
			return;
		}
	}

	roller.roll(modifiers.notation);
}
