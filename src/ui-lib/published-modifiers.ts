import { Setting } from 'obsidian';
import { Modifier, nameList, normalizeName, parseModifierValue } from '../modifiers';
import { YamlStep } from './capabilities';
import { createCallout } from './native';
import { normalizeEventName } from '../events';

/** How a modifier is written in YAML, in a modifier block or a `publishes` list. */
export interface ModifierFields {
	name?: unknown;
	value?: unknown;
	active?: unknown;
	appliesTo?: unknown;
	description?: unknown;
	/** Only one concentration modifier can be on: switching one on ends the others. */
	concentration?: unknown;
}

/** The event fired when a concentration modifier is switched on. */
const CONCENTRATE_ON = 'concentrate on ';

export function concentrationEvent(name: string): string {
	return `${CONCENTRATE_ON}${name}`;
}

/**
 * For a "concentrate on <name>" event: the indexes of other concentration modifiers that
 * are on and must end. Modifier blocks, spells and weapons use this when they react.
 */
export function concentrationToEnd(entries: ModifierFields[], event: string): number[] {
	const normalized = normalizeEventName(event);
	if (!normalized.startsWith(CONCENTRATE_ON)) return [];
	const keep = normalized.slice(CONCENTRATE_ON.length);
	return entries.flatMap((entry, index) =>
		entry?.concentration === true && entry.active === true &&
		String(entry.name ?? '').trim().toLowerCase() !== keep ? [index] : []);
}

/** "Ended concentration on Bless." for the entries a concentration event switches off. */
export function describeConcentrationEnded(entries: ModifierFields[], event: string): string {
	const names = concentrationToEnd(entries, event).map(index => String(entries[index].name));
	return names.length > 0 ? `Ended concentration on ${names.join(', ')}.` : '';
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
		fields.concentration === true ? 'Concentration' : '',
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
	/** Called after a concentration modifier is switched on, to end the others. */
	onConcentrate?: (name: string) => void,
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
				void persist([{ op: 'set', path: [...path, 'active'], value: active }]).then(() => {
					if (active && fields.concentration === true) onConcentrate?.(name);
				});
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
	onConcentrate?: (name: string) => void,
) {
	publishesList(attributes).forEach((fields, index) => {
		renderModifierSwitch(parent, fields, ['publishes', index], persist, onConcentrate);
	});
}

/** Spells and weapons end concentration on their published modifiers when another starts. */
export function publishesOnEvent(attributes: { publishes?: unknown }, event: string): YamlStep[] {
	return concentrationToEnd(publishesList(attributes), event)
		.map(index => ({ op: 'set', path: ['publishes', index, 'active'], value: false }));
}

export function describePublishesEvent({ before, event }: { before: { publishes?: unknown }; event: string }): string {
	return describeConcentrationEnded(publishesList(before), event);
}
