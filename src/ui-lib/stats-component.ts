import { ABILITIES, Ability, abilityNamed, getAbilityModifier } from 'src/abilites';
import { BaseAttributes, BaseComponent, ComponentMetadata } from './base-component';
import { Rollable } from './capabilities';
import { Roll } from '../roll';
import { DiceNotation } from './ui-types';
import { createCallout, createCard, formatBonus } from './native';

export interface StatAttributes extends BaseAttributes {
	stats: number[];
	/** Abilities you are proficient in for saving throws: full names or abbreviations. */
	proficiencies?: string[];
	/** Added to proficient saving throws. Defaults to +2. */
	proficiencyBonus?: number;
}

const DEFAULT_PROFICIENCY_BONUS = 2;

/** "1d20+3", "1d20-1", or "1d20" for a d20 roll with a bonus. */
function d20(bonus: number): string {
	return bonus === 0 ? '1d20' : `1d20${bonus > 0 ? '+' : ''}${bonus}`;
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

	get proficiencyBonus(): number {
		const bonus = this.attributes.proficiencyBonus;
		return typeof bonus === 'number' && Number.isFinite(bonus) ? bonus : DEFAULT_PROFICIENCY_BONUS;
	}

	/** Abilities with saving throw proficiency. */
	get proficientAbilities(): Set<Ability> {
		const entries = Array.isArray(this.attributes.proficiencies) ? this.attributes.proficiencies : [];
		return new Set(entries.map(abilityNamed).filter((a): a is Ability => a !== null));
	}

	getAbilityBonus(index: number): number {
		return getAbilityModifier(this.attributes.stats[index]);
	}

	getSaveBonus(index: number): number {
		const proficient = this.proficientAbilities.has(ABILITIES[index]);
		return this.getAbilityBonus(index) + (proficient ? this.proficiencyBonus : 0);
	}

	/** An ability check: d20 plus the ability modifier. */
	getStatRoll(index: number): string {
		return d20(this.getAbilityBonus(index));
	}

	/** A saving throw: d20 plus the ability modifier, plus proficiency if proficient. */
	getSaveRoll(index: number): string {
		return d20(this.getSaveBonus(index));
	}

	render() {
		const entries = Array.isArray(this.attributes.proficiencies) ? this.attributes.proficiencies : [];
		const unknown = entries.filter(entry => abilityNamed(entry) === null);
		if (unknown.length > 0) {
			createCallout(this.containerEl, 'warning', `Unknown ability in proficiencies: ${unknown.join(', ')}`,
				'Use full names like Dexterity or abbreviations like DEX.');
		}

		const card = createCard(this.containerEl, undefined, this.typeLabel);
		const grid = card.createDiv({ cls: 'dicelist-card-content dicelist-roll-grid dicelist-abilities' });
		const proficient = this.proficientAbilities;

		ABILITIES.forEach((ability: Ability, i: number) => {
			const score = this.attributes.stats[i];
			const check = formatBonus(this.getAbilityBonus(i));
			const save = formatBonus(this.getSaveBonus(i));
			const isProficient = proficient.has(ability);

			// The whole tile rolls an ability check; the Save button inside rolls the save.
			// A button can't contain a button, so the tile is a keyboard-usable role="button".
			const tile = grid.createDiv({
				cls: 'dicelist-ability',
				attr: { role: 'button', tabindex: '0', 'aria-label': `Roll ${ability} check, ${check}` },
			});
			const rollCheck = () => this.onRoll({ notation: new DiceNotation(this.getStatRoll(i)) });
			tile.addEventListener('click', rollCheck);
			tile.addEventListener('keydown', (event: KeyboardEvent) => {
				if (event.target !== tile) return;
				if (event.key === 'Enter' || event.key === ' ') {
					event.preventDefault();
					rollCheck();
				}
			});

			const header = tile.createDiv({ cls: 'dicelist-ability-header' });
			header.createSpan({ cls: 'dicelist-roll-button-label', text: ability.substring(0, 3).toUpperCase() });
			header.createSpan({ cls: 'dicelist-roll-button-value', text: `${score} (${check})` });

			this.addRollButton(tile, 'Save', save,
				`Roll ${ability} saving throw, ${save}${isProficient ? ', proficient' : ''}`,
				() => this.getSaveRoll(i), isProficient);
		});
	}

	private addRollButton(parent: HTMLElement, label: string, value: string, description: string,
		notation: () => string, highlighted = false) {
		const button = parent.createEl('button', {
			cls: ['dicelist-roll-button', ...(highlighted ? ['is-proficient'] : [])],
			attr: { type: 'button', 'aria-label': description },
		});
		button.createSpan({ cls: 'dicelist-roll-button-label', text: label });
		button.createSpan({ cls: 'dicelist-roll-button-value', text: value });
		button.addEventListener('click', (event) => {
			// Don't also roll the check from the tile around this button.
			event.stopPropagation();
			this.onRoll({ notation: new DiceNotation(notation()) });
		});
		button.addEventListener('keydown', (event) => event.stopPropagation());
	}
}
