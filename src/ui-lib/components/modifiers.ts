import { Setting } from 'obsidian';
import { Modifier, nameList, normalizeName } from '../../modifiers';
import { normalizeEventName } from '../../events';
import { ActionError, ActionMap, ActionResult, requireString } from '../actions';
import { CardComponent } from '../component';
import { addSwitch, createCallout } from '../native';

/** How a modifier is written in YAML: an entry of `modifiers`, or of an item's `modifiers`. */
export interface ModifierFields {
	name?: unknown;
	/** Dice, a number, a formula like "-2 * {{exhaustion}}", or advantage or disadvantage. */
	value?: unknown;
	active?: unknown;
	appliesTo?: unknown;
	description?: unknown;
	/** Only one concentration modifier can be on: switching one on ends the others. */
	concentration?: unknown;
	/** `false` keeps it out of rolls' "Off:" lists while it's switched off, as for conditions. */
	showWhenOff?: unknown;
}

/** The event fired when a concentration modifier is switched on. */
const CONCENTRATE_ON = 'concentrate on ';

export function concentrationEvent(name: string): string {
	return `${CONCENTRATE_ON}${name}`;
}

function entries(data: unknown): ModifierFields[] {
	return Array.isArray(data) ? data as ModifierFields[] : [];
}

function entryName(fields: ModifierFields): string | null {
	return typeof fields?.name === 'string' && fields.name.trim() !== '' ? fields.name.trim() : null;
}

/** The modifier described by these fields, or null if it has no name. */
export function modifierFromFields(fields: ModifierFields): Modifier | null {
	const name = entryName(fields);
	if (!name) return null;
	return {
		name,
		value: fields.value,
		active: fields.active === true,
		categories: nameList(fields.appliesTo).map(normalizeName),
		showWhenOff: fields.showWhenOff !== false,
	};
}

/** For a "concentrate on <name>" event: the indexes of other concentration modifiers that are on. */
function concentrationToEnd(list: ModifierFields[], event: string): number[] {
	const normalized = normalizeEventName(event);
	if (!normalized.startsWith(CONCENTRATE_ON)) return [];
	const keep = normalized.slice(CONCENTRATE_ON.length);
	return list.flatMap((entry, index) =>
		entry?.concentration === true && entry.active === true && normalizeName(String(entry.name ?? '')) !== keep ? [index] : []);
}

/** What a modifier applies to, and its description. Its value is added once it's worked out. */
function describeFields(fields: ModifierFields, value: string): string {
	const categories = nameList(fields.appliesTo);
	return [
		value,
		categories.length > 0 ? `Applies to: ${categories.join(', ')}` : 'Applies only to rolls that name it',
		fields.concentration === true ? 'Concentration' : '',
		typeof fields.description === 'string' ? fields.description : '',
	].filter(Boolean).join('. ');
}

/** The index of the modifier named in `args.name`, or throws. */
function requireIndex(data: unknown, args: Record<string, unknown>): number {
	const name = normalizeName(requireString(args, 'name'));
	const index = entries(data).findIndex(entry => normalizeName(entryName(entry) ?? '') === name);
	if (index === -1) throw new ActionError(`No modifier named "${args.name}"`);
	return index;
}

/** "Turns Bless on" as a preview, "Turned Bless on." once done. */
const describeSwitch = ({ after, args, applied }: ActionResult<ModifierFields[]>) => {
	const index = requireIndex(after, args);
	const name = entryName(entries(after)[index]) ?? String(args.name);
	const state = entries(after)[index].active === true ? 'on' : 'off';
	return applied ? `Turned ${name} ${state}.` : `Turns ${name} ${state}`;
};

const switchTo = (active: (current: boolean) => boolean) => ({
	run: (data: ModifierFields[], args: Record<string, unknown>) => {
		const index = requireIndex(data, args);
		return [{ op: 'set' as const, path: [index, 'active'], value: active(entries(data)[index].active === true) }];
	},
	describe: describeSwitch,
});

/** Switch a modifier by `name`, from effects and event subscriptions. */
const modifierActions: ActionMap<ModifierFields[]> = {
	on: switchTo(() => true),
	off: switchTo(() => false),
	toggle: switchTo(current => !current),
};

/**
 * Named bonuses with on/off switches, such as Bless (+1d4 to attacks and saves) or
 * Poisoned (disadvantage on attacks and checks). Rolls include one while it's on and
 * they name it or share a category with its `appliesTo`.
 */
export const modifiersComponent: CardComponent<ModifierFields[]> = {
	key: 'modifiers',
	label: 'Modifiers',
	entryLabel: 'modifier',
	entryNames: data => entries(data).map(entryName).filter((name): name is string => name !== null),
	actions: modifierActions,
	modifiers: data => entries(data).map(modifierFromFields).filter((modifier): modifier is Modifier => modifier !== null),
	onEvent: (data, event) => concentrationToEnd(entries(data), event)
		.map(index => ({ op: 'set', path: [index, 'active'], value: false })),
	describeEvent: ({ before, event }) => {
		const names = concentrationToEnd(entries(before), event).map(index => String(entries(before)[index].name));
		return names.length > 0 ? `Ended concentration on ${names.join(', ')}.` : '';
	},

	render(view) {
		const rows: { name: string; fields: ModifierFields; setting: Setting }[] = [];
		entries(view.data).forEach((fields, index) => {
			const name = entryName(fields);
			if (!name) {
				createCallout(view.el, 'error', 'Each modifier needs a name.');
				return;
			}
			const setting = new Setting(view.el)
				.setName(name)
				.setDesc(describeFields(fields, String(fields.value ?? '')));
			addSwitch(setting.controlEl, `Turn ${name} on or off`, fields.active === true, active => {
				fields.active = active;
				view.guard(view.persist([{ op: 'set', path: [index, 'active'], value: active }]).then(() => {
					if (active && fields.concentration === true) view.concentrateOn(name);
				}));
			});
			rows.push({ name, fields, setting });
		});

		// Show each value worked out, like "-4" for exhaustion, or why it can't be.
		view.refresh(character => {
			for (const { name, fields, setting } of rows) {
				const modifier = character.modifiers.find(m => normalizeName(m.name) === normalizeName(name));
				if (!modifier) continue;
				const value = modifier.value;
				setting.setDesc(describeFields(fields, value.valid ? value.text : ''));
				if (!value.valid) setting.descEl.createDiv({ cls: 'roll-modifiers roll-problem', text: `"${value.raw}" is not a valid value. ${value.reason}` });
			}
		});
	},
};
