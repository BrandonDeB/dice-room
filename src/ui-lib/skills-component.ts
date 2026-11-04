import { SKILLS, Skill, SKILLABILITY } from 'src/abilites';
import { BaseAttributes, BaseComponent, ComponentMetadata } from './base-component';
import { d20, loadSheet } from '../sheet';
import { Rollable } from './capabilities';
import { Roll } from '../roll';
import { DiceNotation } from './ui-types';
import { advantageChoices, createCallout, createCard, createRollButtonGrid, formatBonus } from './native';

export interface SkillAttributes extends BaseAttributes {
	proficiency: Skill[] | null;
	expertise: Skill[] | null;
}

export class SkillsComponent extends BaseComponent<SkillAttributes> implements Rollable {

	static readonly metadata: ComponentMetadata = {
		type: "skills",
		label: "Skills",
		policies: []
	}

	onRoll: (roll: Roll) => void;
	setRollCallback(cb: (roll: Roll) => void): void {
		this.onRoll = cb;
	}

	render() {
		this.guard(this.renderWithSheet());
	}

	/**
	 * Proficiency and expertise come from this block's own YAML; ability modifiers and
	 * the proficiency bonus from the shared sheet. Expertise doubles the bonus.
	 */
	private async renderWithSheet() {
		const sheet = await loadSheet(this.ctx);
		if (sheet.statsProblem) {
			createCallout(this.containerEl, 'warning', `${sheet.statsProblem}. Skill bonuses do not include ability modifiers.`);
		}
		const lower = (list: unknown) => Array.isArray(list) ? list.map(item => String(item).toLowerCase()) : [];
		const proficient = lower(this.attributes.proficiency);
		const expertise = lower(this.attributes.expertise);

		const buttons = SKILLS.map((skill: Skill) => {
			const name = skill.toLowerCase();
			const level = expertise.includes(name) ? 'expertise' : proficient.includes(name) ? 'proficient' : null;
			const value = sheet.abilityModifier(SKILLABILITY[skill])
				+ (level === 'expertise' ? 2 : level === 'proficient' ? 1 : 0) * sheet.proficiencyBonus;
			const bonus = formatBonus(value);
			return {
				label: skill,
				value: bonus,
				description: `Roll ${skill} (${SKILLABILITY[skill]}), ${bonus}${level ? `, ${level === 'expertise' ? 'expertise' : 'proficient'}` : ''}`,
				onClick: () => this.onRoll({ notation: new DiceNotation(d20(value)) }),
				menu: advantageChoices(advantage => this.onRoll({ notation: new DiceNotation(d20(value)), advantage })),
			};
		});

		createRollButtonGrid(createCard(this.containerEl, undefined, this.typeLabel), buttons, 'dicelist-skills');
	}

}
