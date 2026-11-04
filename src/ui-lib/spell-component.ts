import { ComponentMetadata } from './base-component'
import { describePublishesEvent, modifiersFromPublishes, publishesOnEvent } from './published-modifiers'
import { Setting } from 'obsidian'
import { AttackComponent, AttackAttributes } from './attack-component'
import { Sheet } from '../sheet'
import { Roll } from '../roll'
import { abilityNamed } from '../abilites'

const CastingTime = {
	Action: "ACTION",
	Bonus_Action: "BONUS_ACTION",
} as const;

type CastingTimeType = typeof CastingTime[keyof typeof CastingTime]

/** "BONUS_ACTION" reads as "Bonus action"; anything else is shown as written. */
function formatCastingTime(value: string): string {
	if (!/^[A-Z_]+$/.test(value)) return value;
	const words = value.toLowerCase().split('_').join(' ');
	return words.charAt(0).toUpperCase() + words.slice(1);
}

export interface SpellAttributes extends AttackAttributes {
	level: number | undefined;
	school: string | undefined;
	castingTime: CastingTimeType;
	components: string[];
	/** The ability targets save against, e.g. dex. Shows a save DC instead of a hit roll. */
	save?: string;
}

export class SpellComponent extends AttackComponent {	

	static readonly metadata: ComponentMetadata = {
		type: "spell",
		label: "Spell",
		policies: ["uniqueModifierNames"],
		modifiers: modifiersFromPublishes,
		onEvent: publishesOnEvent,
		describeEvent: describePublishesEvent,
	}

	render() {
		super.renderBase();
	}

	private saveRow?: Setting;

	private get spell(): Partial<SpellAttributes> {
		return this.attributes as Partial<SpellAttributes>;
	}

	/** A spell that makes the target save has no hit roll, unless one is written. */
	protected hitRollFor(sheet: Sheet): Roll | null {
		if (this.spell.save && this.attributes.hitRoll === undefined) return null;
		return super.hitRollFor(sheet);
	}

	/** Spell damage is just the dice: spells don't add the casting ability's modifier. */
	protected damageDice(): string | null {
		return this.attributes.ability && this.attributes.damage ? this.attributes.damage : null;
	}

	/** Save DC: 8 + proficiency + casting ability modifier + any magic bonus. */
	protected refreshDetails(sheet: Sheet) {
		const save = abilityNamed(this.spell.save);
		const casting = abilityNamed(this.attributes.ability);
		if (!this.saveRow || !save) return;
		this.saveRow.controlEl.empty();
		const text = casting
			? `${8 + sheet.proficiencyBonus + sheet.abilityModifier(casting) + (this.attributes.bonus ?? 0)} ${save}`
			: 'Needs a casting ability';
		this.saveRow.controlEl.createSpan({ cls: 'dicelist-detail-value', text });
	}

	/** Level, school, casting time and components, each only when the YAML has it. */
	protected renderDetails(card: HTMLElement) {
		const spell = this.spell;
		if (spell.save) this.saveRow = new Setting(card).setName('Save DC');

		if (typeof spell.level === 'number') {
			this.addDetailRow(card, 'Level', spell.level === 0 ? 'Cantrip' : String(spell.level));
		}
		if (typeof spell.school === 'string' && spell.school.trim() !== '') {
			this.addDetailRow(card, 'School', spell.school);
		}
		if (typeof spell.castingTime === 'string' && spell.castingTime.trim() !== '') {
			this.addDetailRow(card, 'Casting time', formatCastingTime(spell.castingTime));
		}
		const components = Array.isArray(spell.components) ? spell.components : (spell.components ? [spell.components] : []);
		if (components.length > 0) {
			this.addDetailRow(card, 'Components', components.join(', '));
		}
	}

}
