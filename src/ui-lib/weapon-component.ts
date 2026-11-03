import { AttackComponent, AttackAttributes } from './attack-component'

export interface WeaponAttributes extends AttackAttributes {
	weaponType: string | undefined;
}

export class WeaponComponent extends AttackComponent {	

	static readonly metadata = {
		type: "weapon",
		policies: []
	}

	weaponType: string | undefined;

	render() {
		super.renderBase();
		// TODO implement something unique to weapons vs other attack types
	}

}
