import { AttackComponent, AttackAttributes } from './attack-component'

const CastingTime = {
	Action: "ACTION",
	Bonus_Action: "BONUS_ACTION",
} as const;

type CastingTimeType = typeof CastingTime[keyof typeof CastingTime]

export interface SpellAttributes extends AttackAttributes {
	level: number | undefined;
	school: string | undefined;
	castingTime: CastingTimeType;
	components: string[];
}

export class SpellComponent extends AttackComponent {	

	static readonly metadata = {
		type: "spell",
		policies: [],
	}

	castingTime: string | undefined;
	components: string[];

	render() {
		super.renderBase();
		this.container.createEl('p', {text: `Components: ${this.components}`});
		this.container.createEl('p', {text: `Casting Time: ${this.castingTime}`});
	}

}
