import { Notice, Setting } from 'obsidian';
import { createCallout, createCard } from './native';
import { Modifier } from '../modifiers';
import { ModifierFields, modifierFromFields } from './published-modifiers';
import { BaseAttributes, BaseComponent, ComponentMetadata} from './base-component';
import { Persistable, YamlStep } from './capabilities';
import { ActionError, ActionMap, optionalPositiveInt, requireString } from './actions';

type InventoryItem = {
	name: string;
	quantity: number;
	/** Optional, shown under the item's name. */
	description?: string;
	/** Whether it's worn or wielded. Its modifiers only apply while equipped. */
	equipped?: boolean;
	/** True for items that need attunement: their modifiers also need `attuned`. */
	attunement?: boolean;
	attuned?: boolean;
	/** Modifiers the item gives, written like a spell's `publishes` list. */
	modifiers?: ModifierFields[];
};

/** A character can be attuned to at most three items. */
const MAX_ATTUNED = 3;

/** Whether an item's modifiers apply: equipped, and attuned if it needs attunement. */
function itemIsActive(item: InventoryItem): boolean {
	return item.equipped === true && (item.attunement !== true || item.attuned === true);
}

/** Items publish their modifiers, switched on only while the item is active. */
function itemModifiers(attrs: InventoryAttributes): Modifier[] {
	return (attrs?.items ?? []).flatMap(item => (Array.isArray(item.modifiers) ? item.modifiers : [])
		.map(modifierFromFields)
		.filter((modifier): modifier is Modifier => modifier !== null)
		.map(modifier => ({ ...modifier, active: itemIsActive(item) })));
}

export interface InventoryAttributes extends BaseAttributes {
	items: InventoryItem[];
}


/** The named item in this data, or null. */
function itemIn(attrs: InventoryAttributes, name: unknown): InventoryItem | null {
	if (typeof name !== 'string') return null;
	const items = attrs?.items ?? [];
	const index = findItem(items, name);
	return index === -1 ? null : items[index];
}

function findItem(items: InventoryItem[], name: string): number {
	const wanted = name.toLowerCase();
	return items.findIndex(item => item.name?.toLowerCase() === wanted);
}

const inventoryActions: ActionMap<InventoryAttributes> = {
	/**
	 * args: item (name), quantity (default 1), description (optional).
	 * Creates the item if missing, with the description if one is given. An existing
	 * item's description is left alone.
	 */
	add: {
		run: (attrs, args) => {
			const name = requireString(args, 'item');
			const quantity = optionalPositiveInt(args, 'quantity', 1);
			const items = attrs.items ?? [];
			const index = findItem(items, name);

			if (index === -1) {
				const description = typeof args.description === 'string' && args.description.trim() !== ''
					? args.description.trim() : undefined;
				const item: InventoryItem = description ? { name, quantity, description } : { name, quantity };
				return Array.isArray(attrs.items)
					? [{ op: 'add', path: ['items'], value: item }]
					: [{ op: 'set', path: ['items'], value: [item] }];
			}
			return [{ op: 'set', path: ['items', index, 'quantity'], value: items[index].quantity + quantity }];
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
		run: (attrs, args) => {
			const name = requireString(args, 'item');
			const quantity = optionalPositiveInt(args, 'quantity', 1);
			const items = attrs.items ?? [];
			const index = findItem(items, name);

			if (index === -1) throw new ActionError(`No ${name} in inventory`);
			const have = items[index].quantity ?? 0;
			if (have < quantity) throw new ActionError(`Not enough ${items[index].name}: have ${have}, need ${quantity}`);

			return [{ op: 'set', path: ['items', index, 'quantity'], value: have - quantity }];
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

export class InventoryComponent extends BaseComponent<InventoryAttributes> implements Persistable {

	static readonly metadata: ComponentMetadata = {
		type: "inventory",
		label: "Inventory",
		policies: ["unique", "uniqueModifierNames"],
		actions: inventoryActions,
		modifiers: itemModifiers,
	}

	onPersist: (steps: YamlStep[]) => Promise<void>;
	setPersistCallback(cb: (steps: YamlStep[]) => Promise<void>): void {
		this.onPersist = cb;
	}

	private pending = new Set<number>();

	warnOnDuplicateNames(items: InventoryItem[]) {
		const seen = new Set<string>();
		for (const item of items) {
			if (seen.has(item.name)) {
				new Notice('Item names must be unique');
			}
			seen.add(item.name);
		}
	}

	private updateQuantity = (index: number) => (inputString: string) => {
		const asNum = parseInt(inputString, 10);
		if (Number.isNaN(asNum)) return;
		if (this.attributes.items[index].quantity === asNum) return;

		this.attributes.items[index].quantity = asNum;
		this.pending.add(index);
	}

	private commitQuantity = (index: number) => () => {
		if (!this.pending.delete(index)) return;

		void this.onPersist([{
			op: 'set',
			path: ['items', index, 'quantity'],
			value: this.attributes.items[index].quantity,
		}]);
	}

	render() {

		this.attributes.items ??= [];
		this.warnOnDuplicateNames(this.attributes.items);

		const card = createCard(this.containerEl, undefined, this.typeLabel);
		if (this.attributes.items.length === 0) {
			new Setting(card).setName('No items yet').setDesc('Add items to this block, or let a roll effect add them.');
			return;
		}

		const attuned = this.attributes.items.filter(item => item.attuned === true).length;
		if (attuned > MAX_ATTUNED) {
			createCallout(card, 'warning', `Attuned to ${attuned} items`, `A character can be attuned to at most ${MAX_ATTUNED}.`);
		}

		this.attributes.items.forEach((item, index) => {
			const row = new Setting(card).setName(item.name);
			if (typeof item.description === 'string' && item.description.trim() !== '') {
				row.setDesc(item.description);
			}
			row
				.addText(text => {
					text.inputEl.type = 'number';
					text.inputEl.min = '0';
					text.inputEl.addClass('dicelist-quantity');
					text.inputEl.setAttr('aria-label', `${item.name} quantity`);
					text.setValue(String(item.quantity ?? 0));
					text.onChange(this.updateQuantity(index));

					this.registerDomEvent(text.inputEl, 'blur', this.commitQuantity(index));
					this.registerDomEvent(text.inputEl, 'keydown', (ev) => {
						if (ev.key === 'Enter') text.inputEl.blur();
					});
				});

			// Equipment: switches for items that give modifiers or need attunement.
			if (Array.isArray(item.modifiers) || item.equipped !== undefined || item.attunement) {
				this.addSwitch(row, item, index, 'equipped', 'Equipped');
			}
			if (item.attunement) this.addSwitch(row, item, index, 'attuned', 'Attuned');
		});
	}

	/** A labelled on/off switch for one of an item's flags, saved to its YAML. */
	private addSwitch(row: Setting, item: InventoryItem, index: number, field: 'equipped' | 'attuned', label: string) {
		row.addToggle(toggle => {
			toggle.toggleEl.setAttr('aria-label', `${item.name} ${label.toLowerCase()}`);
			toggle
				.setValue(item[field] === true)
				.setTooltip(label)
				.onChange(value => void this.onPersist([{ op: 'set', path: ['items', index, field], value }]));
		});
	}


}
