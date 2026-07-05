import { ABILITIES, SKILLS, Skill, Ability, getAbilityModifier, SKILLABILITY} from 'src/abilites';
import { BaseComponent, BaseAttributes } from './base-component';
import { MarkdownPostProcessorContext, TFile } from 'obsidian';
import { getApp } from './../app-provider';
import { StatAttributes } from './stats-component';
import { getCodeBlock } from 'src/utilities';

export interface SkillAttributes extends BaseAttributes {
	proficiencies: Skill[];
}

export class SkillsComponent implements BaseComponent {

	type: string;
	el: HTMLElement;
	attributes: SkillAttributes;
	skillModifiers: Map<Skill, number> = new Map();
	statModifiers: Map<Ability, number> = new Map();
	ctx: MarkdownPostProcessorContext;

	onRoll: (notation: string) => void;
	setRollCallback(cb: (notation: string) => void): void {
		this.onRoll = cb;
	}
	
	constructor(
		el: HTMLElement,
		attributes: SkillAttributes,
		ctx: MarkdownPostProcessorContext
	) {
		this.el = el;
		this.attributes = attributes;
		this.ctx = ctx;
	}

	getSkillRoll(skill: Skill): string {
		return `1d20+${this.skillModifiers.get(skill) ?? 0}`;
	}

	applyAbilityMods(statBlock: StatAttributes) {
		ABILITIES.map((ability: Ability, i: number) => {
			this.statModifiers.set(ability, getAbilityModifier(statBlock.stats[i]) ?? 0);
		})
	
	}

	async getAssociatedStats() {
		const codeBlock = await getCodeBlock<StatAttributes>('stats', this.ctx);
		if (!codeBlock) {
			console.warn("No character associated stat block found");
			return;
		}
		this.applyAbilityMods(codeBlock);

	}

	async render() {
		await this.getAssociatedStats();

		const container = this.el.createDiv({cls: 'skill-full-container'});
		SKILLS.map((skill: Skill, i: number) => {

			const capsule = container.createDiv({cls: 'skill-container'});
			capsule.createEl('h3', {text: skill});
			const relevantStat = SKILLABILITY[skill];

			this.skillModifiers.set(skill, this.statModifiers.get(relevantStat) ?? 0)

			if (this.attributes.proficiencies.some(
				proficiency => proficiency.toLowerCase() == skill.toLowerCase()
			)) {
				this.skillModifiers.set(skill, (this.statModifiers.get(relevantStat) ?? 0) + 2)
			}
			capsule.createEl('p', {text: `(+${this.skillModifiers.get(skill) ?? 0})`})
			capsule.addEventListener('click', () => {
				this.onRoll(this.getSkillRoll(skill))
			})

		})

	}
}
