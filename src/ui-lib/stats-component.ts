import { ABILITIES, Ability } from 'src/abilites';
import { BaseComponent } from './base-component';

export interface StatAttributes {
	stats: number[];
	proficiencies: Ability[];
}

export class StatsComponent implements BaseComponent {

	type: string;
	el: HTMLElement;
	attributes: StatAttributes;

	onRoll: (notation: string) => void;
	setRollCallback(cb: (notation: string) => void): void {
		this.onRoll = cb;
	}
	
	constructor(
		el: HTMLElement,
		attributes: StatAttributes,
	) {
		this.el = el;
		this.attributes = attributes;
	}

	render() {
		ABILITIES.map((ability: string, i: number) => {
			const capsule = this.el.createDiv({cls: 'ability-container'});
			capsule.createEl('h4', {text: ability.substring(0, 3)});
			capsule.createEl('p', {text: this.attributes.stats[i].toString()})
		})
	}
}
