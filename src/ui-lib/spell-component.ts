import { MarkdownPostProcessorContext } from 'obsidian';
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

	castingTime: string | undefined;
	components: string[];

	constructor(
		el: HTMLElement,
		ctx: MarkdownPostProcessorContext,
		attributes: SpellAttributes,
	) {

		const superAttributes: AttackAttributes = { 
			type: attributes.type,
			name: attributes.name,
			description: attributes.description,
			picture: attributes.picture,
			range: attributes.range,
			hitRoll: attributes.hitRoll,
			damageRoll: attributes.damageRoll,
		}
		super(el, ctx, superAttributes) ;

		this.castingTime = attributes.castingTime;
		this.components = attributes.components;
	}

	render() {
		this.container.createEl('p', {text: `Components: ${this.components}`});
		this.container.createEl('p', {text: `Casting Time: ${this.castingTime}`});
	}

}
