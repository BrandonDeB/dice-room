import { MarkdownPostProcessorContext } from 'obsidian';
import { BaseAttributes, BaseComponent } from './base-component';

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

export class InventoryComponent implements BaseComponent {

	el: HTMLElement;
	ctx: MarkdownPostProcessorContext;
	attributes: InventoryAttributes;
	invMap: Map<string, number>;

	constructor (
		el: HTMLElement,
		ctx: MarkdownPostProcessorContext,
		invData: InventoryAttributes,
	) {
		this.el = el;
		this.ctx = ctx;
		this.attributes = invData;
		this.invMap = invListToMap(invData.items);
	}

	render() {
		const container = this.el.createDiv({cls: 'inventory-container'});
		for(const [name, quantity] of this.invMap) {
			container.createEl('h4', {text: name});
			container.createEl('h4', {text: quantity.toString()});
		})
	}

}
