import { Notice, Setting } from 'obsidian';
import { createCard } from './native';
import { BaseAttributes, BaseComponent, ComponentMetadata} from './base-component';
import { Persistable, YamlStep } from './capabilities';
import { ActionError, ActionMap, optionalPositiveInt, requireString } from './actions';

type InventoryItem = {
	name: string;
	quantity: number;
};

export interface InventoryAttributes extends BaseAttributes {
	items: InventoryItem[];
}


function findItem(items: InventoryItem[], name: string): number {
	const wanted = name.toLowerCase();
	return items.findIndex(item => item.name?.toLowerCase() === wanted);
}

const inventoryActions: ActionMap<InventoryAttributes> = {
	/** args: item (name), quantity (default 1). Creates the item if missing. */
	add: (attrs, args) => {
		const name = requireString(args, 'item');
		const quantity = optionalPositiveInt(args, 'quantity', 1);
		const items = attrs.items ?? [];
		const index = findItem(items, name);

		if (index === -1) {
			return Array.isArray(attrs.items)
				? [{ op: 'add', path: ['items'], value: { name, quantity } }]
				: [{ op: 'set', path: ['items'], value: [{ name, quantity }] }];
		}
		return [{ op: 'set', path: ['items', index, 'quantity'], value: items[index].quantity + quantity }];
	},

	/** args: item (name), quantity (default 1). Rejects if there are not enough. */
	remove: (attrs, args) => {
		const name = requireString(args, 'item');
		const quantity = optionalPositiveInt(args, 'quantity', 1);
		const items = attrs.items ?? [];
		const index = findItem(items, name);

		if (index === -1) throw new ActionError(`No ${name} in inventory`);
		const have = items[index].quantity ?? 0;
		if (have < quantity) throw new ActionError(`Not enough ${items[index].name}: have ${have}, need ${quantity}`);

		return [{ op: 'set', path: ['items', index, 'quantity'], value: have - quantity }];
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
			new Setting(card)
				.setName(item.name)
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
