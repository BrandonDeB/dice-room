import { SKILLS, Skill} from 'src/abilites';
import { BaseComponent } from './base-component';

export interface SkillAttributes {
	proficiencies: Skill[];
}

export class SkillsComponent implements BaseComponent {

	type: string;
	el: HTMLElement;
	attributes: SkillAttributes;
	skillModifiers: Map<Skill, number> = new Map();

	onRoll: (notation: string) => void;
	setRollCallback(cb: (notation: string) => void): void {
		this.onRoll = cb;
	}
	
	constructor(
		el: HTMLElement,
		attributes: SkillAttributes,
	) {
		this.el = el;
		this.attributes = attributes;
	}

	getSkillRoll(skill: Skill): string {
		return `1d20+${this.skillModifiers.get(skill) ?? 0}`;
	}

	render() {
		const container = this.el.createDiv({cls: 'skill-full-container'})
		SKILLS.map((skill: Skill, i: number) => {
			const capsule = container.createDiv({cls: 'skill-container'});
			capsule.createEl('h3', {text: skill});
			if (this.attributes.proficiencies.includes(skill)) {
				this.skillModifiers.set(skill, (this.skillModifiers.get(skill) ?? 0) + 2)
			}
			capsule.createEl('p', {text: `(+${this.skillModifiers.get(skill) ?? 0})`})
			capsule.addEventListener('click', () => {
				this.onRoll(this.getSkillRoll(skill))
			})
		})
	}
}
