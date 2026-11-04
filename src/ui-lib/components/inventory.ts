import { Setting } from 'obsidian';
import { Modifier } from '../../modifiers';
import { ActionError, ActionMap, optionalPositiveInt, requireString } from '../actions';
import { CardComponent, ComponentView } from '../component';
import { ModifierFields, modifierFromFields } from './modifiers';

interface InventoryItem {
	name: string;
	quantity: number;
	/** Optional, shown under the item's name. */
	description?: string;
	/**
	 * On/off switches, such as { Equipped: true, Attuned: false }. The item's modifiers
	 * apply only while all of them are on.
	 */
	switches?: Record<string, unknown>;
	/** Modifiers the item gives, written like a `modifiers` list. */
	modifiers?: ModifierFields[];
}

type Inventory = InventoryItem[];

function itemsOf(data: unknown): InventoryItem[] {
	return Array.isArray(data) ? data as InventoryItem[] : [];
}

function switchesOf(item: InventoryItem): [string, boolean][] {
	const switches = item?.switches;
	if (!switches || typeof switches !== 'object' || Array.isArray(switches)) return [];
	return Object.entries(switches).map(([name, on]) => [name, on === true]);
}

/** Items publish their modifiers, switched on only while every switch on the item is on. */
function itemModifiers(data: Inventory): Modifier[] {
	return itemsOf(data).flatMap(item => {
		const active = switchesOf(item).every(([, on]) => on);
		return (Array.isArray(item.modifiers) ? item.modifiers : [])
			.map(modifierFromFields)
			.filter((modifier): modifier is Modifier => modifier !== null)
			.map(modifier => ({ ...modifier, active }));
	});
}

function findItem(items: InventoryItem[], name: string): number {
	const wanted = name.toLowerCase();
	return items.findIndex(item => item.name?.toLowerCase() === wanted);
}

/** The named item in this data, or null. */
function itemIn(data: Inventory, name: unknown): InventoryItem | null {
	if (typeof name !== 'string') return null;
	const items = itemsOf(data);
	const index = findItem(items, name);
	return index === -1 ? null : items[index];
}

const inventoryActions: ActionMap<Inventory> = {
	/**
	 * args: item (name), quantity (default 1), description (optional).
	 * Creates the item if missing, with the description if one is given.
	 */
	add: {
		run: (data, args) => {
			const name = requireString(args, 'item');
			const quantity = optionalPositiveInt(args, 'quantity', 1);
			const items = itemsOf(data);
			const index = findItem(items, name);

			if (index === -1) {
				const description = typeof args.description === 'string' && args.description.trim() !== ''
					? args.description.trim() : undefined;
				const item: InventoryItem = description ? { name, quantity, description } : { name, quantity };
				return Array.isArray(data)
					? [{ op: 'add', path: [], value: item }]
					: [{ op: 'set', path: [], value: [item] }];
			}
			return [{ op: 'set', path: [index, 'quantity'], value: (items[index].quantity ?? 0) + quantity }];
		},
		describe: ({ before, after, args, applied }) => {
			const item = itemIn(applied ? after : before, args.item);
			const name = item?.name ?? String(args.item);
			const amount = typeof args.quantity === 'number' ? args.quantity : 1;
			const count = `${item?.quantity ?? 0} in inventory`;
			return applied ? `Added ${amount} ${name}. ${count}.` : `Adds ${amount} ${name} (${count})`;
		},
	},

	/** args: item (name), quantity (default 1). Rejects if there are not enough. */
	remove: {
		run: (data, args) => {
			const name = requireString(args, 'item');
			const quantity = optionalPositiveInt(args, 'quantity', 1);
			const items = itemsOf(data);
			const index = findItem(items, name);

			if (index === -1) throw new ActionError(`No ${name} in inventory`);
			const have = items[index].quantity ?? 0;
			if (have < quantity) throw new ActionError(`Not enough ${items[index].name}: have ${have}, need ${quantity}`);

			return [{ op: 'set', path: [index, 'quantity'], value: have - quantity }];
		},
		describe: ({ before, after, args, applied }) => {
			const item = itemIn(applied ? after : before, args.item);
			const name = item?.name ?? String(args.item);
			const amount = typeof args.quantity === 'number' ? args.quantity : 1;
			const left = `${item?.quantity ?? 0} left`;
			return applied ? `Used ${amount} of ${name}. ${left}.` : `Uses ${amount} of ${name} (${left})`;
		},
	},
};

/** A quantity box that saves when you press Enter or leave it. */
function renderItem(view: ComponentView<Inventory>, item: InventoryItem, index: number) {
	const row = new Setting(view.el).setName(item.name);
	if (typeof item.description === 'string' && item.description.trim() !== '') row.setDesc(item.description);

	// Switches, like Equipped, come before the count.
	for (const [name, on] of switchesOf(item)) {
		row.addToggle(toggle => {
			toggle.toggleEl.setAttr('aria-label', `${item.name} ${name.toLowerCase()}`);
			toggle
				.setValue(on)
				.setTooltip(name)
				.onChange(value => void view.persist([{ op: 'set', path: [index, 'switches', name], value }]));
		});
	}

	let pending: number | null = null;
	row.addText(text => {
		text.inputEl.type = 'number';
		text.inputEl.min = '0';
		text.inputEl.addClass('dicelist-quantity');
		text.inputEl.setAttr('aria-label', `${item.name} quantity`);
		text.setValue(String(item.quantity ?? 0));
		text.onChange(value => {
			const quantity = parseInt(value, 10);
			pending = Number.isNaN(quantity) || quantity === item.quantity ? null : quantity;
		});
		view.owner.registerDomEvent(text.inputEl, 'blur', () => {
			if (pending === null) return;
			const value = pending;
			pending = null;
			void view.persist([{ op: 'set', path: [index, 'quantity'], value }]);
		});
		view.owner.registerDomEvent(text.inputEl, 'keydown', event => {
			if (event.key === 'Enter') text.inputEl.blur();
		});
	});
}

/**
 * Items with quantities. A character can have several inventories, such as equipment,
 * spell components and treasure, but each item name only once. Effects add and remove
 * items, and items can give modifiers.
 */
export const inventoryComponent: CardComponent<Inventory> = {
	key: 'inventory',
	label: 'Inventory',
	entryNames: data => itemsOf(data).map(item => item.name).filter((name): name is string => typeof name === 'string' && name.trim() !== ''),
	entryArg: 'item',
	entryLabel: 'item',
	creates: ['add'],
	actions: inventoryActions,
	modifiers: itemModifiers,

	render(view) {
		const items = itemsOf(view.data);
		if (items.length === 0) {
			new Setting(view.el).setName('No items yet').setDesc('Add items here, or let a roll effect add them.');
			return;
		}
		items.forEach((item, index) => renderItem(view, item, index));
	},
};
