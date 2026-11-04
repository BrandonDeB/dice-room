import { Setting } from 'obsidian';
import { BaseAttributes, BaseComponent, ComponentMetadata } from './base-component';
import { Rollable } from './capabilities';
import { Roll, generatedRoll } from '../roll';
import { addRollMenu, advantageChoices, createCard, formatBonus } from './native';
import { d20, loadSheet } from '../sheet';
import { abilityNamed } from '../abilites';
import { Advantage, nameList } from '../modifiers';

export interface ProficienciesAttributes extends BaseAttributes {
	languages?: unknown;
	armor?: unknown;
	weapons?: unknown;
	/** Tool names, or { name, ability } for tools you roll checks with. */
	tools?: unknown;
	/** Extra settings per tool check, keyed by tool name. */
	rolls?: unknown;
}

/** A tool, with the ability its checks use if it has one. */
function readTools(value: unknown): { name: string; ability: string | undefined }[] {
	return (Array.isArray(value) ? value : []).flatMap(entry => {
		if (typeof entry === 'string' && entry.trim() !== '') return [{ name: entry.trim(), ability: undefined }];
		const { name, ability } = (entry ?? {}) as { name?: unknown; ability?: unknown };
		return typeof name === 'string' && name.trim() !== '' ? [{ name: name.trim(), ability: typeof ability === 'string' ? ability : undefined }] : [];
	});
}

/** Languages, armor and weapon proficiencies, and tools, with checks for tools that have an ability. */
export class ProficienciesComponent extends BaseComponent<ProficienciesAttributes> implements Rollable {

	static readonly metadata: ComponentMetadata = {
		type: "proficiencies",
		label: "Proficiencies",
		policies: [],
	}

	onRoll: (roll: Roll) => void;
	setRollCallback(cb: (roll: Roll) => void): void {
		this.onRoll = cb;
	}

	render() {
		this.guard(this.renderWithSheet());
	}

	private async renderWithSheet() {
		const sheet = await loadSheet(this.ctx);
		const card = createCard(this.containerEl, undefined, this.typeLabel);

		for (const [label, field] of [['Languages', this.attributes.languages], ['Armor', this.attributes.armor], ['Weapons', this.attributes.weapons]] as const) {
			const names = nameList(field);
			if (names.length > 0) new Setting(card).setName(label).setDesc(names.join(', '));
		}

		for (const tool of readTools(this.attributes.tools)) {
			const row = new Setting(card).setName(tool.name);
			const ability = abilityNamed(tool.ability);
			if (!ability) {
				row.setDesc(tool.ability ? `"${tool.ability}" is not an ability` : 'Tool');
				continue;
			}
			const bonus = sheet.abilityModifier(ability) + sheet.proficiencyBonus;
			const rollTool = (advantage?: Advantage) => this.onRoll({
				...generatedRoll(d20(bonus), ['check', 'tool', tool.name.toLowerCase(), ability.toLowerCase()], this.attributes.rolls, tool.name),
				advantage,
			});
			row.setDesc(`${ability} check, ${formatBonus(bonus)}`)
				.addButton(button => {
					button.setButtonText('Roll').setTooltip(`Roll ${tool.name} check`).onClick(() => rollTool());
					addRollMenu(button.buttonEl, advantageChoices(rollTool));
				});
		}
	}
}
