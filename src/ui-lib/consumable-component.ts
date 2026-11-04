import { Setting } from 'obsidian';
import { BaseAttributes, BaseComponent, ComponentMetadata } from './base-component';
import { Persistable, YamlStep } from './capabilities';
import { ActionError, ActionMap, ActionResult, optionalPositiveInt, requireString } from './actions';
import { createCallout, createCard } from './native';

/** One limited resource as written in YAML, such as spell slots or Wild Shape uses. */
interface ConsumableEntry {
	name?: unknown;
	max?: unknown;
	used?: unknown;
	description?: unknown;
	refill?: unknown;
}

export interface ConsumableAttributes extends BaseAttributes {
	consumables?: ConsumableEntry[];
}

/** A consumable whose fields have been checked. */
interface Consumable {
	name: string;
	max: number;
	used: number;
	remaining: number;
	description?: string;
	refill?: string;
}

function entries(attrs: ConsumableAttributes): ConsumableEntry[] {
	return Array.isArray(attrs?.consumables) ? attrs.consumables : [];
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
	const clamped = Math.min(used, max);
	return {
		name,
		max,
		used: clamped,
		remaining: max - clamped,
		description: typeof entry.description === 'string' && entry.description.trim() !== '' ? entry.description.trim() : undefined,
		refill: typeof entry.refill === 'string' && entry.refill.trim() !== '' ? entry.refill.trim() : undefined,
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
			return [{ op: 'set', path: ['consumables', index, 'used'], value: consumable.used + amount }];
		},
		describe: describeChange('Uses', 'Used', true),
	},

	restore: {
		run: (attrs, args) => {
			const { index, consumable } = requireConsumable(attrs, requireString(args, 'name'));
			const amount = optionalPositiveInt(args, 'amount', 1);
			return [{ op: 'set', path: ['consumables', index, 'used'], value: Math.max(0, consumable.used - amount) }];
		},
		describe: describeChange('Restores', 'Restored', true),
	},

	refill: {
		run: (attrs, args) => {
			const { index } = requireConsumable(attrs, requireString(args, 'name'));
			return [{ op: 'set', path: ['consumables', index, 'used'], value: 0 }];
		},
		describe: describeChange('Refills', 'Refilled', false),
	},
};

/**
 * Limited resources that are used up and later refilled, such as spell slots,
 * transformations or once-per-rest features. One block can hold several.
 */
export class ConsumableComponent extends BaseComponent<ConsumableAttributes> implements Persistable {

	static readonly metadata: ComponentMetadata = {
		type: "consumable",
		label: "Consumables",
		policies: ["uniqueEntryNames"],
		actions: consumableActions,
		entryNames: (attrs: ConsumableAttributes) =>
			entries(attrs).map(entryName).filter((name): name is string => name !== null),
	}

	onPersist: (steps: YamlStep[]) => Promise<void>;
	setPersistCallback(cb: (steps: YamlStep[]) => Promise<void>): void {
		this.onPersist = cb;
	}

	private setUsed(index: number, used: number) {
		void this.onPersist([{ op: 'set', path: ['consumables', index, 'used'], value: used }]);
	}

	render() {
		const card = createCard(this.containerEl, undefined, this.typeLabel);
		const list = entries(this.attributes);

		if (list.length === 0) {
			new Setting(card).setName('No consumables yet').setDesc('Add entries with a name and a max, such as spell slots.');
			return;
		}

		let refillable = false;
		list.forEach((entry, index) => {
			const consumable = parseEntry(entry);
			if (typeof consumable === 'string') {
				createCallout(card, 'error', consumable);
				return;
			}
			if (consumable.used > 0) refillable = true;
			this.renderRow(card, consumable, index);
		});

		new Setting(card)
			.setName('Refill all')
			.setDesc('Restore every consumable here to full, for example after a rest.')
			.addButton(button => button
				.setButtonText('Refill')
				.setDisabled(!refillable)
				.onClick(() => {
					const steps: YamlStep[] = list
						.map((entry, index) => ({ entry: parseEntry(entry), index }))
						.filter(({ entry }) => typeof entry !== 'string' && entry.used > 0)
						.map(({ index }) => ({ op: 'set', path: ['consumables', index, 'used'], value: 0 }));
					if (steps.length > 0) void this.onPersist(steps);
				}));
	}

	private renderRow(card: HTMLElement, consumable: Consumable, index: number) {
		const { name, max, used, remaining } = consumable;
		const details = [consumable.description, consumable.refill ? `Refills on ${consumable.refill}` : '']
			.filter(Boolean).join('. ');

		const row = new Setting(card).setName(name);
		if (details) row.setDesc(details);

		row.addExtraButton(button => button
			.setIcon('minus')
			.setTooltip(`Use one ${name}`)
			.setDisabled(remaining === 0)
			.onClick(() => { if (remaining > 0) this.setUsed(index, used + 1); }));

		row.controlEl.createSpan({
			cls: 'dicelist-consumable-count',
			text: `${remaining} of ${max} left`,
			attr: { 'aria-live': 'polite' },
		});

		row.addExtraButton(button => button
			.setIcon('plus')
			.setTooltip(`Restore one ${name}`)
			.setDisabled(used === 0)
			.onClick(() => { if (used > 0) this.setUsed(index, used - 1); }));
	}
}
