import { ABILITIES, Ability, getAbilityModifier } from 'src/abilites';
import { BaseAttributes, BaseComponent, ComponentMetadata } from './base-component';
import { Rollable } from './capabilities';

export interface StatAttributes extends BaseAttributes {
	stats: number[];
	proficiencies: Ability[];
}

export class StatsComponent extends BaseComponent<StatAttributes> implements Rollable {

	static readonly metadata: ComponentMetadata = {
		type: "stats",
		policies: ['unique']
	}

	onRoll: (notation: string) => void;
	setRollCallback(cb: (notation: string) => void): void {
		this.onRoll = cb;
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
				this.onRoll(this.getStatRoll(i));
			})
		})
	}
}
