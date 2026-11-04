import { Component, HoverParent, MarkdownPostProcessorContext } from "obsidian";
import { ActionDefinition, ActionMap, ActionResult, getAction } from "./actions";
import { YamlStep } from "./capabilities";
import type { Modifier } from "../modifiers";
import type { Roll } from "../roll";
import type { CharacterData, ValueDefinition } from "../character-data";

/*
 * Every dicelist block is a card: a name, a description, a picture and a `type` tag,
 * plus any components. A component is a key in the block's YAML, like `rolls`,
 * `values` or `inventory`, with its own data under that key. Components draw part of
 * the card, publish modifiers and values, offer actions to effects, and react to events.
 */

/** What a component gets to draw its part of a card. */
export interface ComponentView<T = any> {
	/** The card's row list: add Setting rows, or elements with `dicelist-card-content`. */
	el: HTMLElement;
	/** The component's data: the value under its key. */
	data: T;
	ctx: MarkdownPostProcessorContext;
	/** Owns events and child renders, and shows page previews for links. */
	owner: Component & HoverParent;
	/** `grid` when the card's `layout` names this component, like `layout: { rolls: grid }`. */
	layout: 'list' | 'grid';
	/** Save YAML edits, with paths inside this component's data. */
	persist(steps: YamlStep[]): Promise<void>;
	roll(roll: Roll): void;
	/** Called with the character once loaded, and again whenever any of its notes change. */
	refresh(update: (character: CharacterData) => void | Promise<void>): void;
	/** Show the error in the card if this fails. */
	guard(task: Promise<unknown>): void;
	/** End every other concentration modifier, after switching this one on. */
	concentrateOn(name: string): void;
}

export interface CardComponent<T = any> {
	/** The YAML key, such as `inventory`. */
	key: string;
	/** For messages, such as "Inventory". */
	label: string;
	/** At most one card per character has it, so effects can find it without a name. */
	unique?: boolean;
	/**
	 * Names of the entries it holds (consumables, values). Effects choose the card by the
	 * `name` argument, and each name may be used only once per character.
	 */
	entryNames?: (data: T) => string[];
	actions?: ActionMap<T>;
	/** YAML edits when a character event fires, such as consumables refilling. */
	onEvent?: (data: T, event: string) => YamlStep[];
	/** A preview before ("Refills Ki") and an announcement after ("Refilled Ki."). */
	describeEvent?: (result: ActionResult<T> & { event: string }) => string;
	/** Modifiers rolls can include. */
	modifiers?: (data: T) => Modifier[];
	/** Named numbers formulas can use. */
	values?: (data: T) => ValueDefinition[];
	render?: (view: ComponentView<T>) => void;
}

/** Fields every card has, which aren't components. */
export const CARD_FIELDS = ['type', 'name', 'description', 'picture', 'layout', 'on'] as const;

const registry = new Map<string, CardComponent>();

export function registerComponent(component: CardComponent) {
	registry.set(component.key, component);
}

export function getComponent(key: string): CardComponent | undefined {
	return registry.get(key.trim());
}

export function allComponents(): CardComponent[] {
	return [...registry.values()];
}

/** The components a block has, in the order its YAML lists them. */
export function componentsOf(data: Record<string, unknown>): CardComponent[] {
	return Object.keys(data ?? {})
		.map(key => registry.get(key))
		.filter((component): component is CardComponent => !!component);
}

/** Point a component's step at its key in the block: [0, 'used'] becomes ['consumables', 0, 'used']. */
export function underKey(key: string, steps: YamlStep[]): YamlStep[] {
	return steps.map(step => ({ ...step, path: [key, ...step.path] }));
}

/**
 * One of a component's actions, working on the whole block's data, so the code that
 * finds and edits blocks doesn't need to know about components.
 */
export function blockAction(component: CardComponent, name: string): ActionDefinition | undefined {
	const definition = getAction(component.actions, name);
	if (!definition) return undefined;
	const key = component.key;
	return {
		run: (block, args) => underKey(key, definition.run(block?.[key], args)),
		describe: definition.describe && (result => definition.describe!({
			...result,
			before: result.before?.[key],
			after: result.after?.[key],
		})),
	};
}

/** A component's reaction to an event, on the whole block, or null if it doesn't react. */
export function blockEventReaction(component: CardComponent, block: Record<string, unknown>, event: string) {
	if (!component.onEvent) return null;
	const key = component.key;
	const steps = underKey(key, component.onEvent(block[key], event));
	if (steps.length === 0) return null;
	return {
		steps,
		describe: (before: Record<string, unknown>, after: Record<string, unknown>, applied: boolean) =>
			component.describeEvent?.({ before: before[key], after: after[key], args: {}, applied, event }) ?? '',
	};
}
