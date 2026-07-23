import { MarkdownPostProcessorContext } from 'obsidian';
import { ABILITIES, Ability, getAbilityModifier } from 'src/abilites';
import { BaseAttributes } from './base-component';
import { RollableComponent } from './rollable-component';

export interface StatAttributes extends BaseAttributes {
	stats: number[];
	proficiencies: Ability[];
}

export class StatsComponent implements RollableComponent {

	type: string;
	el: HTMLElement;
	attributes: StatAttributes;
	ctx: MarkdownPostProcessorContext;

	onRoll: (notation: string) => void;
	setRollCallback(cb: (notation: string) => void): void {
		this.onRoll = cb;
	}
	
	constructor(
		el: HTMLElement,
		ctx: MarkdownPostProcessorContext,
		attributes: StatAttributes,
	) {
		this.el = el;
		this.attributes = attributes;
		this.ctx = ctx;
	}

	getStatRoll(index: number): string {
		const statVal = this.attributes.stats[index]
		const statMod = getAbilityModifier(statVal);
		if (statMod > 0) return `1d20+${statMod}`;
		else if (statMod < 0) return `1d20${statMod}`
		else return `1d20`;
	}

	render() {
		const container = this.el.createDiv({cls: 'ability-full-container'})
		ABILITIES.map((ability: string, i: number) => {
			const capsule = container.createDiv({cls: 'ability-container'});
			capsule.createEl('h4', {text: ability.substring(0, 3)});
			const statVal = this.attributes.stats[i]
			capsule.createEl('p', {text: `${statVal.toString()} (+${getAbilityModifier(statVal).toString()})`})
			capsule.addEventListener('click', () => {
				this.onRoll(this.getStatRoll(i))
			})
		})
	}
}
