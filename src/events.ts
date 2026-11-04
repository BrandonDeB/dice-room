import { MarkdownPostProcessorContext, TFile } from "obsidian";
import { parseDocument } from "yaml";
import { getApp } from "./app-provider";
import { BlockTarget, findAllBlocks, findBlocks, hasComponent } from "./character";
import { blockAction, blockEventReaction, componentsOf, getComponent } from "./ui-lib/component";
import { ActionArgs, ActionError, applyStepsToData, applyYamlSteps } from "./ui-lib/actions";
import { YamlStep } from "./ui-lib/capabilities";

/*
 * Character events, such as "long rest" or "dawn". Components react with their
 * `onEvent` hook (consumables refill on the events in their `refill` list), and any
 * card can subscribe with an `on` list. Events are fired by `events` buttons and by
 * roll effects.
 */

/** Event names are compared ignoring case and spacing: "Long Rest" is "long rest". */
export function normalizeEventName(name: string): string {
	return name.trim().replace(/\s+/g, ' ').toLowerCase();
}

/** One entry of a card's `on` list: run an action of one of the card's own components. */
interface EventSubscription {
	event: string;
	target: string;
	action: string;
	args: ActionArgs;
}

/**
 * Read a card's `on` list:
 *   on:
 *     - event: dawn
 *       target: inventory
 *       action: add
 *       args: { item: Goodberry, quantity: 10 }
 * Malformed entries come back as problems.
 */
function subscriptionsOf(data: Record<string, unknown>): { subscriptions: EventSubscription[]; problems: string[] } {
	const list = data?.on;
	if (list == null) return { subscriptions: [], problems: [] };
	if (!Array.isArray(list)) return { subscriptions: [], problems: ['"on" should be a list of events with actions.'] };
	const subscriptions: EventSubscription[] = [];
	const problems: string[] = [];
	list.forEach((entry, i) => {
		const { event, target, action, args } = (entry ?? {}) as { event?: unknown; target?: unknown; action?: unknown; args?: unknown };
		if ([event, target, action].some(field => typeof field !== 'string' || field.trim() === '')) {
			problems.push(`Event subscription ${i + 1} needs an event, a target and an action.`);
			return;
		}
		subscriptions.push({
			event: event as string,
			target: (target as string).trim(),
			action: (action as string).trim(),
			args: args && typeof args === 'object' && !Array.isArray(args) ? args as ActionArgs : {},
		});
	});
	return { subscriptions, problems };
}

/**
 * Problems with a card's `on` list that don't depend on which event fires: malformed
 * entries, targets the card doesn't have, or actions they don't have. Shown on the card.
 */
export function checkSubscriptions(data: Record<string, unknown>): string[] {
	const { subscriptions, problems } = subscriptionsOf(data);
	for (const subscription of subscriptions) {
		const component = getComponent(subscription.target);
		if (!component || !hasComponent(data, subscription.target)) {
			problems.push(`This card has no ${subscription.target} (for ${subscription.event})`);
		} else if (!blockAction(component, subscription.action)) {
			problems.push(`${component.label} has no action named "${subscription.action}" (for ${subscription.event})`);
		}
	}
	return problems;
}

/** How one block reacts to an event: the edits, their descriptions, and anything that failed. */
export interface EventReaction {
	steps: YamlStep[];
	messages: string[];
	problems: string[];
}

/**
 * Work out how a block reacts to an event, on plain data: first each component's own
 * `onEvent` (like consumables' refill, gain and lose), then each matching entry in its
 * `on` list, in order. Previews and real firing both use this, so they always agree.
 * A failing subscription becomes a problem and the rest still apply.
 */
export function reactToEvent(
	data: Record<string, unknown>,
	eventName: string,
	applied: boolean,
): EventReaction {
	const event = normalizeEventName(eventName);
	const reaction: EventReaction = { steps: [], messages: [], problems: [] };
	let current = data;

	for (const component of componentsOf(data)) {
		const own = blockEventReaction(component, current, event);
		if (!own) continue;
		const after = applyStepsToData(current, own.steps);
		const message = own.describe(current, after, applied);
		if (message) reaction.messages.push(message);
		reaction.steps.push(...own.steps);
		current = after;
	}

	// Malformed entries are shown on the card (checkSubscriptions), not on every event.
	const { subscriptions } = subscriptionsOf(data);
	for (const subscription of subscriptions) {
		if (normalizeEventName(subscription.event) !== event) continue;
		const component = getComponent(subscription.target);
		const definition = component && hasComponent(data, subscription.target) ? blockAction(component, subscription.action) : undefined;
		if (!definition) {
			reaction.problems.push(`This card has no ${subscription.target} action named "${subscription.action}"`);
			continue;
		}
		try {
			const steps = definition.run(current, subscription.args);
			// Nothing to change, like restoring hit points that are already full: say nothing.
			if (steps.length === 0) continue;
			const after = applyStepsToData(current, steps);
			const message = definition.describe?.({ before: current, after, args: subscription.args, applied });
			if (message) reaction.messages.push(message);
			reaction.steps.push(...steps);
			current = after;
		} catch (err) {
			reaction.problems.push(err instanceof ActionError ? err.message : `Could not run ${subscription.action}`);
			if (!(err instanceof ActionError)) console.error(err);
		}
	}
	return reaction;
}

/** What an event would change in one block. */
export interface EventChange {
	/** The block's descriptions, e.g. ["Refills Ki (1 of 4 left)"]. */
	messages: string[];
	/** Subscriptions that would fail, e.g. "Not enough Arrows". */
	problems: string[];
	/** The block it would change, for linking. */
	target: BlockTarget;
}

/** What an event would change across the character's notes, without saving anything. */
export async function previewEvent(ctx: MarkdownPostProcessorContext, eventName: string): Promise<EventChange[]> {
	const changes: EventChange[] = [];

	for (const block of await findAllBlocks(ctx)) {
		const reaction = reactToEvent(block.data, eventName, false);
		if (reaction.steps.length === 0 && reaction.problems.length === 0) continue;
		changes.push({
			messages: reaction.messages,
			problems: reaction.problems,
			target: { file: block.file, line: block.location.lineStart },
		});
	}
	return changes;
}

/**
 * Fire an event for the character: every subscribing block in every one of the
 * character's notes makes its changes. Each note is written once, from its current
 * text, so blocks in the same note don't disturb each other's positions.
 * Returns the announcements, such as "Refilled Ki (4 of 4 left).", in note order,
 * followed by anything that failed.
 */
export async function fireEvent(ctx: MarkdownPostProcessorContext, eventName: string): Promise<string[]> {
	const app = getApp();

	// Only notes with a block that reacts need to be opened.
	const files = new Map<string, TFile>();
	for (const block of await findAllBlocks(ctx)) {
		const reaction = reactToEvent(block.data, eventName, false);
		if (reaction.steps.length > 0 || reaction.problems.length > 0) files.set(block.file.path, block.file);
	}

	const announcements: string[] = [];
	const failures: string[] = [];
	for (const file of files.values()) {
		const fileMessages: string[][] = [];
		await app.vault.process(file, (data) => {
			const lines = data.split('\n');
			// Edit from the bottom up, so earlier blocks keep their line numbers.
			for (const block of findBlocks(lines).reverse()) {
				const doc = parseDocument(lines.slice(block.lineStart + 1, block.lineEnd).join('\n'));
				const reaction = reactToEvent(doc.toJS(), eventName, true);
				failures.push(...reaction.problems);
				if (reaction.steps.length === 0) continue;
				applyYamlSteps(doc, reaction.steps);
				fileMessages.unshift(reaction.messages);
				lines.splice(block.lineStart + 1, block.lineEnd - block.lineStart - 1, ...doc.toString().trimEnd().split('\n'));
			}
			return lines.join('\n');
		});
		announcements.push(...fileMessages.flat());
	}
	return [...announcements, ...failures.map(problem => `Could not: ${problem}`)];
}
