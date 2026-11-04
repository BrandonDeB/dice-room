import { MarkdownRenderer, Notice, Setting } from 'obsidian';
import { BaseAttributes, BaseComponent, ComponentMetadata } from './base-component';
import { createCard } from './native';
import { invokeAction, previewAction } from '../character';
import { ActionError } from './actions';
import { getApp } from '../app-provider';

export interface FeatureAttributes extends BaseAttributes {
	name?: string;
	/** Where it comes from, e.g. "Ranger 1" or "Wood Elf". */
	source?: string;
	/** Markdown, rendered like the rest of the note. */
	description?: string;
	/** The name of a consumable that tracks its uses. */
	uses?: string;
}

/** A class feature, trait or feat: its text, and a Use button if a consumable tracks its uses. */
export class FeatureComponent extends BaseComponent<FeatureAttributes> {

	static readonly metadata: ComponentMetadata = {
		type: "feature",
		label: "Feature",
		policies: [],
	}

	render() {
		const { name, source, description, uses } = this.attributes;
		const card = createCard(this.containerEl, name, this.typeLabel, { description: source });

		if (description) {
			const text = card.createDiv({ cls: 'dicelist-card-content dicelist-feature-text' });
			void MarkdownRenderer.render(getApp(), description, text, this.ctx.sourcePath, this);
		}

		if (typeof uses === 'string' && uses.trim() !== '') {
			const row = new Setting(card).setName('Uses');
			let buttonEl: HTMLElement | undefined;
			row.addButton(button => {
				buttonEl = button.buttonEl;
				button.setButtonText('Use').setTooltip(`Use ${name ?? 'this feature'}`).onClick(() => this.guard(this.use(uses)));
			});
			// Same preview as roll effects: "Uses 1 of Favored Foe (2 of 3 left)", or why not.
			const refresh = async () => {
				row.descEl.empty();
				try {
					const preview = await previewAction(this.ctx, 'consumable', 'use', { name: uses });
					row.descEl.setText(preview.message ?? '');
					buttonEl?.toggle(true);
				} catch (err) {
					if (!(err instanceof ActionError)) throw err;
					row.descEl.createDiv({ cls: 'roll-modifiers roll-problem', text: err.message });
					buttonEl?.toggle(false);
				}
			};
			this.guard(refresh());
			this.onCharacterChange(() => this.guard(refresh()));
		}
	}

	private async use(uses: string) {
		try {
			const message = await invokeAction(this.ctx, 'consumable', 'use', { name: uses });
			if (message) new Notice(message);
		} catch (err) {
			new Notice(err instanceof ActionError ? err.message : 'Could not use it');
		}
	}
}
