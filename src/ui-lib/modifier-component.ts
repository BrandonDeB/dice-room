import { BaseAttributes, BaseComponent, ComponentMetadata } from './base-component';
import { Persistable, YamlStep } from './capabilities';
import { ActionMap, ActionResult } from './actions';
import { Modifier } from '../modifiers';
import { modifierFromFields, renderModifierSwitch } from './published-modifiers';
import { createCard } from './native';

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

/**
 * "Turns Bless on" as a preview, "Turned Bless on." once done. Previews get the
 * would-be result as `after` too, so both read the new state from it.
 */
const describeSwitch = ({ after, args, applied }: ActionResult<ModifierAttributes>) => {
	// From an effect the name comes in args; from the block's own `on` list, use its name.
	const name = typeof args.name === 'string' ? args.name : (typeof after.name === 'string' ? after.name : 'modifier');
	const state = after.active === true ? 'on' : 'off';
	return applied ? `Turned ${name} ${state}.` : `Turns ${name} ${state}`;
};

const modifierActions: ActionMap<ModifierAttributes> = {
	on: { run: () => [{ op: 'set', path: ['active'], value: true }], describe: describeSwitch },
	off: { run: () => [{ op: 'set', path: ['active'], value: false }], describe: describeSwitch },
	toggle: { run: (attrs) => [{ op: 'set', path: ['active'], value: attrs.active !== true }], describe: describeSwitch },
};

/**
 * A named bonus with an on/off switch, such as Bless (+1d4 to attacks and saves).
 * Rolls include it when it is on and they subscribe to its name or share a category.
 */
export class ModifierComponent extends BaseComponent<ModifierAttributes> implements Persistable {

	static readonly metadata: ComponentMetadata = {
		type: "modifier",
		label: "Modifier",
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
		renderModifierSwitch(createCard(this.containerEl, undefined, this.typeLabel), this.attributes, [], steps => this.onPersist(steps));
	}


}
