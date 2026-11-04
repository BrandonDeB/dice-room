import { ABILITIES, Ability, abilityNamed, getAbilityModifier } from 'src/abilites';
import { d20, loadSheet, proficiencyForLevel } from '../sheet';
import { BaseAttributes, BaseComponent, ComponentMetadata } from './base-component';
import { Rollable } from './capabilities';
import { Roll, generatedRoll } from '../roll';
import { RollChange, addRollMenu, createCallout, rollChoices, createCard, formatBonus, renderModifierList } from './native';
import { modifiersForCategories } from '../modifiers';

export interface StatAttributes extends BaseAttributes {
	stats: number[];
	/** Abilities you are proficient in for saving throws: full names or abbreviations. */
	proficiencies?: string[];
	/** Added to proficient saving throws when there is no character block with a level. Defaults to +2. */
	proficiencyBonus?: number;
	/** Extra settings per roll, keyed like "Dexterity check" or "Wisdom save". */
	rolls?: unknown;
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

	render() {
		const entries = Array.isArray(this.attributes.proficiencies) ? this.attributes.proficiencies : [];
		const unknown = entries.filter(entry => abilityNamed(entry) === null);
		if (unknown.length > 0) {
			createCallout(this.containerEl, 'warning', `Unknown ability in proficiencies: ${unknown.join(', ')}`,
				'Use full names like Dexterity or abbreviations like DEX.');
		}
		this.guard(this.renderWithSheet());
	}

	/**
	 * Scores and save proficiencies come from this block's own YAML. The proficiency
	 * bonus follows the character block's level, falling back to `proficiencyBonus`.
	 */
	private async renderWithSheet() {
		const sheet = await loadSheet(this.ctx);
		const own = this.attributes.proficiencyBonus;
		const proficiencyBonus = sheet.level !== null ? proficiencyForLevel(sheet.level) : (typeof own === 'number' ? own : 2);
		const proficient = new Set((this.attributes.proficiencies ?? []).map(abilityNamed));

		const card = createCard(this.containerEl, undefined, this.typeLabel);
		const grid = card.createDiv({ cls: 'dicelist-card-content dicelist-roll-grid dicelist-abilities' });

		ABILITIES.forEach((ability: Ability, i: number) => {
			const score = this.attributes.stats[i];
			const isProficient = proficient.has(ability);
			const checkBonus = getAbilityModifier(score);
			const saveBonus = checkBonus + (isProficient ? proficiencyBonus : 0);
			const check = formatBonus(checkBonus);
			const save = formatBonus(saveBonus);

			// The whole tile rolls an ability check; the Save button inside rolls the save.
			// A button can't contain a button, so the tile is a keyboard-usable role="button".
			const tile = grid.createDiv({
				cls: 'dicelist-ability',
				attr: { role: 'button', tabindex: '0', 'aria-label': `Roll ${ability} check, ${check}` },
			});
			const name = ability.toLowerCase();
			const rollCheck = (change: RollChange = {}) => this.onRoll({
				...generatedRoll(d20(checkBonus), ['check', 'ability check', name], this.attributes.rolls, `${ability} check`),
				...change,
			});
			const saveRoll = (change: RollChange = {}) => ({
				...generatedRoll(d20(saveBonus), ['save', 'saving throw', name], this.attributes.rolls, `${ability} save`),
				...change,
			});
			tile.addEventListener('click', () => rollCheck());
			addRollMenu(tile, rollChoices(rollCheck));
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
				saveRoll, isProficient);
		});

		this.showActiveModifiers(card, ['check', 'ability check', 'save', 'saving throw', ...ABILITIES.map(a => a.toLowerCase())]);
	}

	/** "Includes Bless (1d4)": modifiers affecting these rolls, kept current as they switch. */
	private showActiveModifiers(card: HTMLElement, categories: string[]) {
		const line = card.createDiv({ cls: 'dicelist-card-content' });
		const refresh = async () => {
			const modifiers = await modifiersForCategories(this.ctx, categories);
			line.empty();
			line.toggle(modifiers.length > 0);
			renderModifierList(line, 'Includes', modifiers, 'roll-modifiers', this.ctx.sourcePath, this);
		};
		this.guard(refresh());
		this.onCharacterChange(() => this.guard(refresh()));
	}

	private addRollButton(parent: HTMLElement, label: string, value: string, description: string,
		makeRoll: (change?: RollChange) => Roll, highlighted = false) {
		const button = parent.createEl('button', {
			cls: ['dicelist-roll-button', ...(highlighted ? ['is-proficient'] : [])],
			attr: { type: 'button', 'aria-label': description },
		});
		button.createSpan({ cls: 'dicelist-roll-button-label', text: label });
		button.createSpan({ cls: 'dicelist-roll-button-value', text: value });
		button.addEventListener('click', (event) => {
			// Don't also roll the check from the tile around this button.
			event.stopPropagation();
			this.onRoll(makeRoll());
		});
		addRollMenu(button, rollChoices(change => this.onRoll(makeRoll(change))));
		button.addEventListener('keydown', (event) => event.stopPropagation());
	}
}
