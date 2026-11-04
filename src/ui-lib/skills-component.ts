import { ABILITIES, SKILLS, Skill, Ability, getAbilityModifier, SKILLABILITY} from 'src/abilites';
import { BaseAttributes, BaseComponent, ComponentMetadata } from './base-component';
import { StatAttributes } from './stats-component';
import { describeLookupProblem, findUniqueBlock } from 'src/character';
import { Rollable } from './capabilities';
import { Roll } from '../roll';
import { DiceNotation } from './ui-types';
import { createCallout, createCard, createRollButtonGrid, formatBonus } from './native';

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

	skillModifiers: Map<Skill, number> = new Map();
	statModifiers: Map<Ability, number> = new Map();

	getSkillRoll(skill: Skill): string {
		const mod = this.skillModifiers.get(skill) ?? 0;
		if (mod > 0) return `1d20+${mod}`;
		if (mod < 0) return `1d20${mod}`;
		return `1d20`;
	}

	applyAbilityMods(statBlock: StatAttributes) {
		ABILITIES.map((ability: Ability, i: number) => {
			this.statModifiers.set(ability, getAbilityModifier(statBlock.stats[i]) ?? 0);
		})
	}

	/** Load stat modifiers. Returns a warning to show if they could not be used. */
	async getAssociatedStats(): Promise<string | null> {
		const lookup = await findUniqueBlock<StatAttributes>(this.ctx, 'stats');
		if (lookup.status === 'found') {
			this.applyAbilityMods(lookup.match.data);
			return null;
		}
		return `${describeLookupProblem('stats', lookup)}. Skill bonuses do not include ability modifiers.`;
	}

	render() {
		this.guard(this.renderWithStats());
	}

	private async renderWithStats() {
		const warning = await this.getAssociatedStats();
		if (warning) createCallout(this.containerEl, 'warning', warning);

		const buttons = SKILLS.map((skill: Skill) => {
			const relevantStat = SKILLABILITY[skill];
			const statBonus = this.statModifiers.get(relevantStat) ?? 0;
			this.skillModifiers.set(skill, statBonus);

			if (this.attributes.expertise?.some(
				expertise => expertise.toLowerCase() == skill.toLowerCase()
			)) {
				this.skillModifiers.set(skill, statBonus + 4);
			}

			if (this.attributes.proficiency?.some(
				proficiency => proficiency.toLowerCase() == skill.toLowerCase()
			)) {
				this.skillModifiers.set(skill, statBonus + 2);
			}

			const bonus = formatBonus(this.skillModifiers.get(skill) ?? 0);
			return {
				label: skill,
				value: bonus,
				description: `Roll ${skill} (${relevantStat}), ${bonus}`,
				onClick: () => this.onRoll({ notation: new DiceNotation(this.getSkillRoll(skill)) }),
			};
		});

		createRollButtonGrid(createCard(this.containerEl, undefined, this.typeLabel), buttons, 'dicelist-skills');
	}

}
