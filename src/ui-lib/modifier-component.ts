import { BaseAttributes, BaseComponent, ComponentMetadata } from './base-component';
import { Persistable, YamlStep } from './capabilities';
import { ActionMap } from './actions';
import { Modifier } from '../modifiers';
import { modifierFromFields, renderModifierSwitch } from './published-modifiers';

export interface ModifierAttributes extends BaseAttributes {
	name: string;
	value: string | number;
	active?: boolean; appliesTo?: string[] | string;
	description?: string;
}

function toModifier(attrs: ModifierAttributes): Modifier[] {
	const modifier = modifierFromFields(attrs);
	return modifier ? [modifier] : [];
}

/** Turn the modifier on or off from a roll's effects. The target is chosen by `name`. */
const modifierActions: ActionMap<ModifierAttributes> = {
	on: () => [{ op: 'set', path: ['active'], value: true }],
	off: () => [{ op: 'set', path: ['active'], value: false }],
	toggle: (attrs) => [{ op: 'set', path: ['active'], value: attrs.active !== true }],
};

/**
 * A named bonus with an on/off switch, such as Bless (+1d4 to attacks and saves).
 * Rolls include it when it is on and they subscribe to its name or share a category.
 */
export class ModifierComponent extends BaseComponent<ModifierAttributes> implements Persistable {

	static readonly metadata: ComponentMetadata = {
		type: "modifier",
		policies: ["uniqueModifierNames"],
		targetKey: "name",
		actions: modifierActions,
		modifiers: toModifier,
	}

	onPersist: (steps: YamlStep[]) => Promise<void>;
	setPersistCallback(cb: (steps: YamlStep[]) => Promise<void>): void {
		this.onPersist = cb;
	}

	render() {
		const box = this.containerEl.createDiv({ cls: 'component-container modifier-container' });
		renderModifierSwitch(box, this.attributes, [], steps => this.onPersist(steps));
	}


}
