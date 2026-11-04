import { Notice, Setting } from 'obsidian';
import { createCard } from './native';
import { BaseAttributes, BaseComponent, ComponentMetadata} from './base-component';
import { Persistable, YamlStep } from './capabilities';
import { ActionError, ActionMap, optionalPositiveInt, requireString } from './actions';

type InventoryItem = {
	name: string;
	quantity: number;
	/** Optional, shown under the item's name. */
	description?: string;
};

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
		policies: ["unique"],
		actions: inventoryActions,
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
		});
	}


}
