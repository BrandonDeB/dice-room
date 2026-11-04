import { Setting } from 'obsidian';
import { BaseAttributes, BaseComponent, ComponentMetadata } from './base-component';
import { Rollable } from './capabilities';
import { Roll } from '../roll';
import { DiceNotation } from './ui-types';
import { createCallout, createCard, formatBonus } from './native';
import { d20, loadSheet, proficiencyForLevel } from '../sheet';

export interface CharacterAttributes extends BaseAttributes {
	name?: string;
	class?: string;
	/** 1 to 20. Sets the proficiency bonus used by every block of the character. */
	level?: unknown;
	armorClass?: unknown;
	speed?: unknown;
}

/**
 * The character's core numbers: level (which sets the proficiency bonus), armor class,
 * speed, initiative and passive Perception.
 */
export class CharacterComponent extends BaseComponent<CharacterAttributes> implements Rollable {

	static readonly metadata: ComponentMetadata = {
		type: "character",
		label: "Character",
		policies: ['unique'],
	}

	onRoll: (roll: Roll) => void;
	setRollCallback(cb: (roll: Roll) => void): void {
		this.onRoll = cb;
	}

	render() {
		const level = this.attributes.level;
		if (level !== undefined && (typeof level !== 'number' || !Number.isInteger(level) || level < 1 || level > 20)) {
			createCallout(this.containerEl, 'error', 'Level should be a whole number from 1 to 20.');
			return;
		}
		this.guard(this.renderWithSheet());
	}

	private async renderWithSheet() {
		const sheet = await loadSheet(this.ctx);
		const { name, armorClass, speed } = this.attributes;
		// This block's own level, so the card is right even before the file cache catches up.
		const level = typeof this.attributes.level === 'number' ? this.attributes.level : null;
		const subtitle = [this.attributes.class, level !== null ? `Level ${level}` : ''].filter(Boolean).join(', ');
		const card = createCard(this.containerEl, name, this.typeLabel, { description: subtitle || undefined });

		const detail = (label: string, value: string) =>
			new Setting(card).setName(label).controlEl.createSpan({ cls: 'dicelist-detail-value', text: value });

		detail('Proficiency bonus', formatBonus(level !== null ? proficiencyForLevel(level) : sheet.proficiencyBonus));
		if (armorClass !== undefined) detail('Armor class', String(armorClass));
		if (speed !== undefined) detail('Speed', String(speed));

		const initiative = sheet.abilityModifier('Dexterity');
		new Setting(card)
			.setName('Initiative')
			.setDesc(formatBonus(initiative))
			.addButton(button => button
				.setButtonText('Roll')
				.setTooltip('Roll initiative')
				.onClick(() => this.onRoll({
					notation: new DiceNotation(d20(initiative)),
					categories: ['initiative', 'check', 'dexterity'],
				})));

		detail('Passive Perception', String(10 + sheet.skillBonus('Perception')));
	}
}
