import { Notice, TextComponent } from 'obsidian';
import { BaseAttributes, BaseComponent, ComponentMetadata} from './base-component';
import { Persistable, YamlStep } from './capabilities';

type InventoryItem = {
	name: string;
	quantity: number;
};

export interface InventoryAttributes extends BaseAttributes {
	items: InventoryItem[];
}


export class InventoryComponent extends BaseComponent<InventoryAttributes> implements Persistable {

	static readonly metadata: ComponentMetadata = {
		type: "inventory",
		policies: ["unique"]
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
