import { Setting } from 'obsidian';
import { YamlStep } from '../capabilities';
import { ActionError, ActionMap, ActionResult, optionalPositiveInt, requireString } from '../actions';
import { CardComponent, ComponentView } from '../component';
import { createCallout } from '../native';
import { nameList } from '../../modifiers';
import { normalizeEventName } from '../../events';

/** One limited resource as written in YAML, such as spell slots or Wild Shape uses. */
interface ConsumableEntry {
	name?: unknown;
	max?: unknown;
	used?: unknown;
	description?: unknown;
	/** The event or events that refill it, e.g. "long rest" or [short rest, long rest]. */
	refill?: unknown;
	/** Events that give some back, with how many: { dawn: 1 }. Stops at the max. */
	gain?: unknown;
	/** Events that take some away, with how many: { midnight: 1 }. Stops at zero. */
	lose?: unknown;
}

/** The `consumables` list. */
type ConsumableAttributes = ConsumableEntry[];

/** A consumable whose fields have been checked. */
interface Consumable {
	name: string;
	max: number;
	used: number;
	remaining: number;
	description?: string;
	/** Events that refill it, as written. */
	refill: string[];
	/** Events that give some back, with how many. */
	gain: EventAmount[];
	/** Events that take some away, with how many. */
	lose: EventAmount[];
}

/** An event and a whole number, from a `gain` or `lose` map. */
interface EventAmount {
	event: string;
	amount: number;
}

/** Read a `gain` or `lose` map ({ dawn: 1 }), or a message saying what's wrong with it. */
function parseEventAmounts(value: unknown, field: string, name: string): EventAmount[] | string {
	if (value == null) return [];
	if (typeof value !== 'object' || Array.isArray(value)) {
		return `"${name}" ${field} should list events with amounts, like ${field}: { dawn: 1 }.`;
	}
	const amounts: EventAmount[] = [];
	for (const [event, amount] of Object.entries(value as Record<string, unknown>)) {
		if (typeof amount !== 'number' || !Number.isInteger(amount) || amount < 1) {
			return `"${name}" ${field} for ${event} should be a whole number of 1 or more.`;
		}
		amounts.push({ event, amount });
	}
	return amounts;
}

function entries(attrs: ConsumableAttributes): ConsumableEntry[] {
	return Array.isArray(attrs) ? attrs : [];
}

function entryName(entry: ConsumableEntry): string | null {
	return typeof entry?.name === 'string' && entry.name.trim() !== '' ? entry.name.trim() : null;
}

/** The checked consumable, or a message saying what's wrong with the entry. */
function parseEntry(entry: ConsumableEntry): Consumable | string {
	const name = entryName(entry);
	if (!name) return 'A consumable needs a name.';
	const max = entry.max;
	if (typeof max !== 'number' || !Number.isInteger(max) || max < 1) {
		return `"${name}" needs a max: a whole number of 1 or more.`;
	}
	const used = entry.used ?? 0;
	if (typeof used !== 'number' || !Number.isInteger(used) || used < 0) {
		return `"${name}" has an invalid used count. Use a whole number of 0 or more.`;
	}
	const gain = parseEventAmounts(entry.gain, 'gain', name);
	if (typeof gain === 'string') return gain;
	const lose = parseEventAmounts(entry.lose, 'lose', name);
	if (typeof lose === 'string') return lose;
	const clamped = Math.min(used, max);
	return {
		name,
		max,
		used: clamped,
		remaining: max - clamped,
		description: typeof entry.description === 'string' && entry.description.trim() !== '' ? entry.description.trim() : undefined,
		refill: nameList(entry.refill),
		gain,
		lose,
	};
}

/** The index of the entry with this name, ignoring case and spacing. */
function findEntry(attrs: ConsumableAttributes, name: string): number {
	const wanted = name.trim().toLowerCase();
	return entries(attrs).findIndex(entry => entryName(entry)?.toLowerCase() === wanted);
}

/** The named consumable, checked, with its index; or throws a user-facing error. */
function requireConsumable(attrs: ConsumableAttributes, name: string): { index: number; consumable: Consumable } {
	const index = findEntry(attrs, name);
	if (index === -1) throw new ActionError(`No consumable named "${name}"`);
	const consumable = parseEntry(entries(attrs)[index]);
	if (typeof consumable === 'string') throw new ActionError(consumable);
	return { index, consumable };
}

/** The named consumable in this data, checked, or null if it is missing or invalid. */
function consumableIn(attrs: ConsumableAttributes, name: unknown): Consumable | null {
	if (typeof name !== 'string') return null;
	const index = findEntry(attrs, name);
	const consumable = index === -1 ? null : parseEntry(entries(attrs)[index]);
	return consumable && typeof consumable !== 'string' ? consumable : null;
}

/**
 * "Uses 1 of Ki (3 of 4 left)" as a preview, "Used 1 of Ki. 2 of 4 left." once done.
 * Previews show what is left now; announcements show what is left after.
 */
function describeChange(present: string, past: string, withAmount: boolean) {
	return ({ before, after, args, applied }: ActionResult<ConsumableAttributes>) => {
		const consumable = consumableIn(applied ? after : before, args.name);
		if (!consumable) return '';
		const amount = typeof args.amount === 'number' ? args.amount : 1;
		const what = withAmount ? `${amount} of ${consumable.name}` : consumable.name;
		const left = `${consumable.remaining} of ${consumable.max} left`;
		return applied
			? `${past} ${what}. ${left}.`
			: `${present} ${what} (${left})`;
	};
}

/**
 * Actions roll effects can run. Each takes `name`, which picks the consumable (and so
 * the block holding it), and use/restore take an optional `amount` (default 1).
 */
const consumableActions: ActionMap<ConsumableAttributes> = {

	use: {
		run: (attrs, args) => {
			const { index, consumable } = requireConsumable(attrs, requireString(args, 'name'));
			const amount = optionalPositiveInt(args, 'amount', 1);
			if (consumable.remaining < amount) {
				throw new ActionError(`Not enough ${consumable.name}: ${consumable.remaining} of ${consumable.max} left, need ${amount}`);
			}
			return [{ op: 'set', path: [index, 'used'], value: consumable.used + amount }];
		},
		describe: describeChange('Uses', 'Used', true),
	},

	restore: {
		run: (attrs, args) => {
			const { index, consumable } = requireConsumable(attrs, requireString(args, 'name'));
			const amount = optionalPositiveInt(args, 'amount', 1);
			return [{ op: 'set', path: [index, 'used'], value: Math.max(0, consumable.used - amount) }];
		},
		describe: describeChange('Restores', 'Restored', true),
	},

	refill: {
		run: (attrs, args) => {
			const { index } = requireConsumable(attrs, requireString(args, 'name'));
			return [{ op: 'set', path: [index, 'used'], value: 0 }];
		},
		describe: describeChange('Refills', 'Refilled', false),
	},
};

/** How a consumable changes when an event fires. */
interface EventEffect {
	index: number;
	consumable: Consumable;
	/** The used count after the event. */
	used: number;
	/** Whether it was refilled to full. */
	refilled: boolean;
}

/** Total amount for an event across a gain or lose list. */
function amountOn(amounts: EventAmount[], event: string): number {
	return amounts
		.filter(({ event: name }) => normalizeEventName(name) === event)
		.reduce((sum, { amount }) => sum + amount, 0);
}

/**
 * What an event does to each consumable: refill if listed in `refill`, then any
 * `gain` (up to the max) and `lose` (down to zero). Only real changes are returned.
 * Both the edits and their descriptions come from this one calculation.
 */
function eventEffects(attrs: ConsumableAttributes, eventName: string): EventEffect[] {
	const event = normalizeEventName(eventName);
	const effects: EventEffect[] = [];
	entries(attrs).forEach((entry, index) => {
		const consumable = parseEntry(entry);
		if (typeof consumable === 'string') return;
		let used = consumable.used;
		const refilled = consumable.refill.some(name => normalizeEventName(name) === event) && used > 0;
		if (refilled) used = 0;
		used = Math.max(0, used - amountOn(consumable.gain, event));
		used = Math.min(consumable.max, used + amountOn(consumable.lose, event));
		if (used !== consumable.used) effects.push({ index, consumable, used, refilled: refilled && used === 0 });
	});
	return effects;
}

/** Subscribes consumables to events through their `refill`, `gain` and `lose`. */
function consumableOnEvent(attrs: ConsumableAttributes, event: string): YamlStep[] {
	return eventEffects(attrs, event)
		.map(({ index, used }) => ({ op: 'set', path: [index, 'used'], value: used }));
}

/**
 * Previews like "Refills Ki (1 of 4 left), Gains 1 of Charges (2 of 7 left)", showing
 * what is left now; announcements like "Refilled Ki (4 of 4 left); Lost 1 of Favor
 * (1 of 3 left).", showing what is left after.
 */
function describeConsumableEvent({ before, applied, event }: ActionResult<ConsumableAttributes> & { event: string }): string {
	const parts = eventEffects(before, event).map(({ consumable, used, refilled }) => {
		const { name, max, remaining } = consumable;
		const left = `${applied ? max - used : remaining} of ${max} left`;
		const change = consumable.used - used;
		if (refilled) return applied ? `Refilled ${name} (${left})` : `Refills ${name} (${left})`;
		if (change > 0) return applied ? `Gained ${change} of ${name} (${left})` : `Gains ${change} of ${name} (${left})`;
		return applied ? `Lost ${-change} of ${name} (${left})` : `Loses ${-change} of ${name} (${left})`;
	});
	if (parts.length === 0) return '';
	return applied ? `${parts.join('; ')}.` : parts.join(', ');
}

function renderRow(view: ComponentView<ConsumableAttributes>, consumable: Consumable, index: number) {
	const { name, max, used, remaining } = consumable;
	const setUsed = (value: number) => void view.persist([{ op: 'set', path: [index, 'used'], value }]);
	const amounts = (list: EventAmount[], verb: string) =>
		list.map(({ event, amount }) => `${verb} ${amount} on ${event}`);
	const details = [
		consumable.description,
		consumable.refill.length > 0 ? `Refills on ${consumable.refill.join(' or ')}` : '',
		...amounts(consumable.gain, 'Gains'),
		...amounts(consumable.lose, 'Loses'),
	]
		.filter(Boolean).join('. ');

	const row = new Setting(view.el).setName(name);
	if (details) row.setDesc(details);

	row.addExtraButton(button => button
		.setIcon('minus')
		.setTooltip(`Use one ${name}`)
		.setDisabled(remaining === 0)
		.onClick(() => { if (remaining > 0) setUsed(used + 1); }));

	row.controlEl.createSpan({
		cls: 'dicelist-consumable-count',
		text: `${remaining} of ${max} left`,
		attr: { 'aria-live': 'polite' },
	});

	row.addExtraButton(button => button
		.setIcon('plus')
		.setTooltip(`Restore one ${name}`)
		.setDisabled(used === 0)
		.onClick(() => { if (used > 0) setUsed(used - 1); }));
}

/**
 * Limited resources that are used up and later refilled, such as spell slots, hit dice,
 * or once-per-rest features. A card can hold several.
 */
export const consumablesComponent: CardComponent<ConsumableAttributes> = {
	key: 'consumables',
	label: 'Consumables',
	actions: consumableActions,
	entryLabel: 'consumable',
	entryNames: attrs => entries(attrs).map(entryName).filter((name): name is string => name !== null),
	onEvent: consumableOnEvent,
	describeEvent: describeConsumableEvent,

	render(view) {
		const list = entries(view.data);
		let refillable = false;
		list.forEach((entry, index) => {
			const consumable = parseEntry(entry);
			if (typeof consumable === 'string') {
				createCallout(view.el, 'error', consumable);
				return;
			}
			if (consumable.used > 0) refillable = true;
			renderRow(view, consumable, index);
		});
		if (list.length < 2) return;

		new Setting(view.el)
			.setName('Refill all')
			.setDesc('Restore every consumable here to full.')
			.addButton(button => button
				.setButtonText('Refill')
				.setDisabled(!refillable)
				.onClick(() => {
					const steps: YamlStep[] = list
						.map((entry, index) => ({ entry: parseEntry(entry), index }))
						.filter(({ entry }) => typeof entry !== 'string' && entry.used > 0)
						.map(({ index }) => ({ op: 'set', path: [index, 'used'], value: 0 }));
					if (steps.length > 0) void view.persist(steps);
				}));
	},
};
