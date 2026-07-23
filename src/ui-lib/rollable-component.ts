import { BaseComponent } from "./base-component";

export interface RollableComponent extends BaseComponent {

	onRoll: (notation: string) => void;
	setRollCallback: (cb: (notation: string) => void) => void;

}

export function isRollable(component: BaseComponent): component is RollableComponent {
	return typeof (component as RollableComponent).setRollCallback === "function";
}
