import { MarkdownPostProcessorContext, Notice } from "obsidian";
import { invokeAction } from "./character";
import { ActionError, Effect } from "./ui-lib/actions";
import { DiceNotation } from "./ui-lib/ui-types";

/**
 * A single clickable roll: the dice to throw, plus effects on other
 * components that happen when it is used (spending ammo, a spell slot, ...).
 * Any component that rolls dice describes its rolls this way.
 */
export interface Roll {
	notation: DiceNotation;
	effects?: Effect[];
}

/**
 * How a roll is written in YAML. Either a plain dice string:
 *   hitRoll: 1d20+5
 * or an object when it has effects:
 *   hitRoll:
 *     dice: 1d20+5
 *     effects:
 *       - { target: inventory, action: remove, args: { item: Arrows } }
 */
export type RollField = string | number | { dice: string | number; effects?: Effect[] };

/** Normalize a YAML roll field. Returns null if it is missing or malformed. */
export function parseRoll(field: unknown): Roll | null {
	if (typeof field === 'string' || typeof field === 'number') {
		return { notation: new DiceNotation(String(field)) };
	}

	if (field && typeof field === 'object') {
		const { dice, effects } = field as { dice?: unknown; effects?: unknown };
		if (typeof dice !== 'string' && typeof dice !== 'number') return null;
		return {
			notation: new DiceNotation(String(dice)),
			effects: Array.isArray(effects) ? effects.filter(isEffect) : undefined,
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
 * Perform a roll for a component: run its effects in order, then throw the dice.
 * Nothing happens if the roller is not ready, so ammo is not spent on a roll that
 * never lands. If an effect is rejected, the user is told why and the dice are not
 * thrown. Effects that already succeeded are not undone.
 */
export async function performRoll(
	ctx: MarkdownPostProcessorContext,
	roll: Roll,
	roller: DiceRoller,
): Promise<void> {
	if (!roller.ready()) return;

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

	roller.roll(roll.notation.toString());
}
