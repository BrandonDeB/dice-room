import { Notice, Setting } from 'obsidian';
import { nameList } from '../../modifiers';
import { fireEvent, previewEvent } from '../../events';
import { CardComponent } from '../component';
import { createBlockLink } from '../native';

/** "long rest" reads as "Long rest" on a row and in notices. */
function capitalize(text: string): string {
	return text.charAt(0).toUpperCase() + text.slice(1);
}

/**
 * Buttons that fire character events, such as a short or long rest, or dawn. Everything
 * subscribed to the event reacts: consumables refill if the event is in their `refill`,
 * and cards react through their `on` lists. Each row previews what it would change.
 */
export const eventsComponent: CardComponent<unknown> = {
	key: 'events',
	label: 'Events',

	render(view) {
		const rows = nameList(view.data).map(event => {
			const label = capitalize(event);
			const setting = new Setting(view.el)
				.setName(label)
				.addButton(button => button
					.setButtonText('Trigger')
					.setTooltip(label)
					.onClick(() => view.guard(fireEvent(view.ctx, event).then(messages => {
						new Notice(`${label}: ${messages.join(' ') || 'nothing changed.'}`);
					}))));
			return { event, setting };
		});

		view.refresh(async () => {
			for (const { event, setting } of rows) {
				const changes = await previewEvent(view.ctx, event);
				const desc = setting.descEl;
				desc.empty();
				if (changes.length === 0) {
					desc.setText('Nothing to change');
					continue;
				}
				for (const change of changes) {
					for (const message of change.messages) {
						createBlockLink(desc.createDiv(), message, change.target, view.ctx.sourcePath, view.owner);
					}
					for (const problem of change.problems) {
						desc.createDiv({ cls: 'roll-modifiers roll-problem', text: `Could not: ${problem}` });
					}
				}
			}
		});
	},
};
