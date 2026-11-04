import { SKILLS, Skill, SKILLABILITY } from 'src/abilites';
import { BaseAttributes, BaseComponent, ComponentMetadata } from './base-component';
import { d20, loadSheet } from '../sheet';
import { Rollable } from './capabilities';
import { Roll, generatedRoll } from '../roll';
import { createCallout, rollChoices, createCard, createRollButtonGrid, formatBonus, renderModifierList } from './native';
import { modifiersForCategories } from '../modifiers';

export interface SkillAttributes extends BaseAttributes {
	proficiency: Skill[] | null;
	expertise: Skill[] | null;
	/** Extra settings per skill roll, keyed by skill name. */
	rolls?: unknown;
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
			const skillRoll = () => generatedRoll(d20(value),
				['check', 'skill', name, SKILLABILITY[skill].toLowerCase()], this.attributes.rolls, skill);
			return {
				label: skill,
				value: bonus,
				description: `Roll ${skill} (${SKILLABILITY[skill]}), ${bonus}${level ? `, ${level === 'expertise' ? 'expertise' : 'proficient'}` : ''}`,
				onClick: () => this.onRoll(skillRoll()),
				menu: rollChoices(change => this.onRoll({ ...skillRoll(), ...change })),
			};
		});

		const card = createCard(this.containerEl, undefined, this.typeLabel);
		createRollButtonGrid(card, buttons, 'dicelist-skills');

		// "Includes Guidance (1d4)": modifiers affecting skill rolls, kept current as they switch.
		const line = card.createDiv({ cls: 'dicelist-card-content' });
		const categories = ['check', 'skill', ...SKILLS.map(skill => skill.toLowerCase())];
		const refresh = async () => {
			const modifiers = await modifiersForCategories(this.ctx, categories);
			line.empty();
			line.toggle(modifiers.length > 0);
			renderModifierList(line, 'Includes', modifiers, 'roll-modifiers', this.ctx.sourcePath, this);
		};
		this.guard(refresh());
		this.onCharacterChange(() => this.guard(refresh()));
	}

}
