import { Setting } from 'obsidian';
import { CardComponent } from '../component';
import { createCallout } from '../native';

/**
 * Labelled details shown as rows, such as Class, Speed, Range or Languages. A list
 * reads as "Common, Elvish". They're only shown: formulas don't use them.
 */
export const fieldsComponent: CardComponent<unknown> = {
	key: 'fields',
	label: 'Fields',

	render(view) {
		const data = view.data;
		if (!data || typeof data !== 'object' || Array.isArray(data)) {
			createCallout(view.el, 'error', 'Fields should be labels with values, like Speed: 30 ft.');
			return;
		}
		for (const [label, value] of Object.entries(data)) {
			const text = Array.isArray(value) ? value.map(String).join(', ') : String(value ?? '');
			const row = new Setting(view.el).setName(label);
			row.controlEl.createSpan({ cls: 'dicelist-detail-value', text });
		}
	},
};
