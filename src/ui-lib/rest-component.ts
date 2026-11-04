import { Notice, Setting } from 'obsidian';
import { BaseAttributes, BaseComponent, ComponentMetadata } from './base-component';
import { createBlockLink, createCard } from './native';
import { nameList } from '../modifiers';
import { fireEvent, previewEvent } from '../events';

export interface RestAttributes extends BaseAttributes {
	/** Events offered as buttons. Defaults to Short rest and Long rest. */
	events?: string[] | string;
}

const DEFAULT_EVENTS = ['Short rest', 'Long rest'];

/** "long rest" reads as "Long rest" on a row and in notices. */
function capitalize(text: string): string {
	return text.charAt(0).toUpperCase() + text.slice(1);
}

/**
 * Buttons that fire character events, such as a short or long rest. Every component
 * subscribed to the event reacts: consumables refill if the event is in their `refill`.
 * Each row previews what its event would change before you take it.
 */
export class RestComponent extends BaseComponent<RestAttributes> {

	static readonly metadata: ComponentMetadata = {
		type: "rest",
		label: "Rest",
		policies: [],
	}

	private rows: { event: string; setting: Setting }[] = [];

	private get events(): string[] {
		const listed = nameList(this.attributes.events);
		return listed.length > 0 ? listed : DEFAULT_EVENTS;
	}

	render() {
		const card = createCard(this.containerEl, undefined, this.typeLabel);
		this.rows = this.events.map(event => {
			const setting = new Setting(card)
				.setName(capitalize(event))
				.addButton(button => button
					.setButtonText(/rest/i.test(event) ? 'Take' : 'Trigger')
					.setTooltip(capitalize(event))
					.onClick(() => this.guard(this.take(event))));
			return { event, setting };
		});

		this.guard(this.refreshPreviews());
		this.onCharacterChange(() => this.guard(this.refreshPreviews()));
	}

	/** Show what each event would change, linking to the blocks it would change. */
	private async refreshPreviews() {
		for (const { event, setting } of this.rows) {
			const changes = await previewEvent(this.ctx, event);
			const desc = setting.descEl;
			desc.empty();
			if (changes.length === 0) {
				desc.setText('Nothing to change');
				continue;
			}
			for (const change of changes) {
				for (const message of change.messages) {
					createBlockLink(desc.createDiv(), message, change.target, this.ctx.sourcePath, this);
				}
				for (const problem of change.problems) {
					desc.createDiv({ cls: 'roll-modifiers roll-problem', text: `Could not: ${problem}` });
				}
			}
		}
	}

	private async take(event: string) {
		const messages = await fireEvent(this.ctx, event);
		new Notice(`${capitalize(event)}: ${messages.join(' ') || 'nothing changed.'}`);
	}
}
