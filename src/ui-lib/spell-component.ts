import { ComponentMetadata } from './base-component'
import { modifiersFromPublishes } from './published-modifiers'
import { AttackComponent, AttackAttributes } from './attack-component'

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
}

export class SpellComponent extends AttackComponent {	

	static readonly metadata: ComponentMetadata = {
		type: "spell",
		label: "Spell",
		policies: ["uniqueModifierNames"],
		modifiers: modifiersFromPublishes,
	}

	render() {
		super.renderBase();
	}

	/** Level, school, casting time and components, each only when the YAML has it. */
	protected renderDetails(card: HTMLElement) {
		const spell = this.attributes as Partial<SpellAttributes>;

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
