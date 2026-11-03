import { Notice, TextComponent } from 'obsidian';
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

		this.attributes.items.forEach((item, index) => {
			const container = this.containerEl.createDiv({cls: 'inv-container'});
			container.createEl('h4', {
				text: item.name,
				cls: 'inv-item-name'
			});

			const quantityEl = new TextComponent(container);
			quantityEl.setValue(item.quantity.toString());
			quantityEl.onChange(this.updateQuantity(index));

			this.registerDomEvent(quantityEl.inputEl, 'blur', this.commitQuantity(index));
			this.registerDomEvent(quantityEl.inputEl, 'keydown', (ev) => {
				if (ev.key === 'Enter') quantityEl.inputEl.blur();
			});
		});
	}

}
