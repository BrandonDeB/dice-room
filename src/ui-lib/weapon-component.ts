import { ComponentMetadata } from './base-component'
import { describePublishesEvent, modifiersFromPublishes, publishesOnEvent } from './published-modifiers'
import { AttackComponent, AttackAttributes } from './attack-component'

export interface WeaponAttributes extends AttackAttributes {
	weaponType: string | undefined;
}

export class WeaponComponent extends AttackComponent {	

	static readonly metadata: ComponentMetadata = {
		type: "weapon",
		label: "Weapon",
		policies: ["uniqueModifierNames"],
		modifiers: modifiersFromPublishes,
		onEvent: publishesOnEvent,
		describeEvent: describePublishesEvent,
	}

	weaponType: string | undefined;

	render() {
		super.renderBase();
		// TODO implement something unique to weapons vs other attack types
	}

}
