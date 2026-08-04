import { MarkdownPostProcessorContext } from 'obsidian';
import { BaseAttributes, BaseComponent} from './base-component';

type InventoryItem = {
	name: string;
	quantity: number;
};

export interface InventoryAttributes extends BaseAttributes {
	items: InventoryItem[];
}

function invListToMap(items: InventoryItem[]): Map<string, number> {
	const map = new Map<string, number>();
	items.map((invItem) => {
		map.set(invItem.name, invItem.quantity);
	})
	return map;
}

export class InventoryComponent extends BaseComponent<InventoryAttributes> {

	readonly metadata = {
		type: "inventory",
		singleton: true,
		rollable: false
	}

	el: HTMLElement;
	ctx: MarkdownPostProcessorContext;
	attributes: InventoryAttributes;
	invMap: Map<string, number>;


	render() {

		this.invMap = invListToMap(this.attributes.items);
		
		const container = this.el.createDiv({cls: 'inventory-container'});
		for(const [name, quantity] of this.invMap) {
			container.createEl('h4', {text: name});
			container.createEl('h4', {text: quantity.toString()});
		}
	}

}
