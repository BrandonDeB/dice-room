import { ABILITIES, Ability, getAbilityModifier } from 'src/abilites';
import { BaseAttributes, BaseComponent, ComponentMetadata } from './base-component';
import { Rollable } from './capabilities';
import { Roll } from '../roll';
import { DiceNotation } from './ui-types';
import { createCard, createRollButtonGrid, formatBonus } from './native';

export interface StatAttributes extends BaseAttributes {
	stats: number[];
	proficiencies: Ability[];
}

export class StatsComponent extends BaseComponent<StatAttributes> implements Rollable {

	static readonly metadata: ComponentMetadata = {
		type: "stats",
		label: "Ability scores",
		policies: ['unique']
	}

	onRoll: (roll: Roll) => void;
	setRollCallback(cb: (roll: Roll) => void): void {
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
		const card = createCard(this.containerEl, undefined, this.typeLabel);
		createRollButtonGrid(card, ABILITIES.map((ability: string, i: number) => {
			const score = this.attributes.stats[i];
			const bonus = formatBonus(getAbilityModifier(score));
			return {
				label: ability.substring(0, 3).toUpperCase(),
				value: `${score} (${bonus})`,
				description: `Roll ${ability} saving throw: score ${score}, ${bonus}`,
				onClick: () => this.onRoll({ notation: new DiceNotation(this.getStatRoll(i)) }),
			};
		}), 'dicelist-abilities');
	}
}
