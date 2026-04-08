import { AttackComponent, AttackAttributes } from './attack-component'

export interface WeaponAttributes extends AttackAttributes{
	weaponType: string | undefined;
}

export class WeaponComponent extends AttackComponent {	

	weaponType: string | undefined;

	constructor(
		el: HTMLElement,
		attributes: WeaponAttributes
	) {
		const superAttributes: AttackAttributes = { 
			type: attributes.type,
			name: attributes.name,
			description: attributes.description,
			picture: attributes.picture,
			range: attributes.range,
			hitRoll: attributes.hitRoll,
			damageRoll: attributes.damageRoll
		}

		super(el, superAttributes)

		this.weaponType = attributes.weaponType;
	}

	render() {
		this.container.createEl('p', {text: "Weapon Render!"});
	}

}
