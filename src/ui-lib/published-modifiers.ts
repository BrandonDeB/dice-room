import { Setting } from 'obsidian';
import { Modifier, nameList, normalizeName, parseModifierValue } from '../modifiers';
import { YamlStep } from './capabilities';
import { createCallout } from './native';

/** How a modifier is written in YAML, in a modifier block or a `publishes` list. */
export interface ModifierFields {
	name?: unknown;
	value?: unknown;
	active?: unknown;
	appliesTo?: unknown;
	description?: unknown;
}

/** The modifier described by these fields, or null if it has no name. */
export function modifierFromFields(fields: ModifierFields): Modifier | null {
	if (typeof fields?.name !== 'string' || fields.name.trim() === '') return null;
	return {
		name: fields.name.trim(),
		value: parseModifierValue(fields.value),
		active: fields.active === true,
		categories: nameList(fields.appliesTo).map(normalizeName),
	};
}

/** One line describing a modifier: its value, what it applies to, and any description. */
export function describeModifier(fields: ModifierFields): string {
	const categories = nameList(fields.appliesTo);
	const value = parseModifierValue(fields.value);
	return [
		value.valid ? value.text : value.raw,
		categories.length > 0 ? `Applies to: ${categories.join(', ')}` : 'Applies only to rolls that name it',
		typeof fields.description === 'string' ? fields.description : '',
	].filter(Boolean).join('. ');
}

/**
 * Draw an on/off switch for one modifier. Flipping it saves `active` at `path` in the
 * block's YAML; other rolls of the character then refresh their totals.
 * Shows what's wrong instead if the fields are invalid.
 */
export function renderModifierSwitch(
	parent: HTMLElement,
	fields: ModifierFields,
	path: (string | number)[],
	persist: (steps: YamlStep[]) => Promise<void>,
) {
	if (typeof fields?.name !== 'string' || fields.name.trim() === '') {
		createCallout(parent, 'error', 'A published modifier needs a name.');
		return;
	}
	const name = fields.name.trim();

	new Setting(parent)
		.setName(name)
		.setDesc(describeModifier(fields))
		.addToggle(toggle => toggle
			.setValue(fields.active === true)
			.setTooltip(`Turn ${name} on or off`)
			.onChange(active => {
				fields.active = active;
				void persist([{ op: 'set', path: [...path, 'active'], value: active }]);
			}));

	const value = parseModifierValue(fields.value);
	if (!value.valid) {
		createCallout(parent, 'error', `"${value.raw}" is not a valid value for ${name}`, value.reason);
	}
}

/** The `publishes` list of a component's YAML, if it has one. */
function publishesList(attributes: { publishes?: unknown }): ModifierFields[] {
	return Array.isArray(attributes?.publishes) ? attributes.publishes as ModifierFields[] : [];
}

/**
 * Modifiers a component publishes through a `publishes` list in its YAML, such as a
 * Bless spell publishing the Bless modifier. Use as a component's metadata `modifiers`.
 */
export function modifiersFromPublishes(attributes: { publishes?: unknown }): Modifier[] {
	return publishesList(attributes)
		.map(modifierFromFields)
		.filter((modifier): modifier is Modifier => modifier !== null);
}

/** A switch for each modifier in the component's `publishes` list. */
export function renderPublishedSwitches(
	parent: HTMLElement,
	attributes: { publishes?: unknown },
	persist: (steps: YamlStep[]) => Promise<void>,
) {
	publishesList(attributes).forEach((fields, index) => {
		renderModifierSwitch(parent, fields, ['publishes', index], persist);
	});
}
