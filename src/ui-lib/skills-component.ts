import { ABILITIES, SKILLS, Skill, Ability, getAbilityModifier, SKILLABILITY} from 'src/abilites';
import { BaseAttributes, BaseComponent, ComponentMetadata } from './base-component';
import { StatAttributes } from './stats-component';
import { describeLookupProblem, findUniqueBlock } from 'src/character';
import { Rollable } from './capabilities';
import { Roll } from '../roll';
import { DiceNotation } from './ui-types';

export interface SkillAttributes extends BaseAttributes {
	proficiency: Skill[] | null;
	expertise: Skill[] | null;
}

export class SkillsComponent extends BaseComponent<SkillAttributes> implements Rollable {

	static readonly metadata: ComponentMetadata = {
		type: "skills",
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
		void this.renderWithStats();
	}

	private async renderWithStats() {
		const warning = await this.getAssociatedStats();
		if (warning) this.containerEl.createDiv({ cls: 'dicelist-error', text: warning });

		const container = this.containerEl.createDiv({cls: 'skill-full-container'});
		SKILLS.map((skill: Skill, i: number) => {

			const capsule = container.createDiv({cls: 'skill-container'});
			capsule.createEl('h4', {text: skill});
			const relevantStat = SKILLABILITY[skill];

			this.skillModifiers.set(skill, this.statModifiers.get(relevantStat) ?? 0)

			if (this.attributes.expertise?.some(
				expertise => expertise.toLowerCase() == skill.toLowerCase()
			)) {
				this.skillModifiers.set(skill, (this.statModifiers.get(relevantStat) ?? 0) + 4)
			}

			if (this.attributes.proficiency?.some(
				proficiency => proficiency.toLowerCase() == skill.toLowerCase()
			)) {
				this.skillModifiers.set(skill, (this.statModifiers.get(relevantStat) ?? 0) + 2)
			}
			capsule.createEl('p', {text: `(+${this.skillModifiers.get(skill) ?? 0})`})
			capsule.addEventListener('click', () => {
				this.onRoll({ notation: new DiceNotation(this.getSkillRoll(skill)) })
			})

		})

	}
}
