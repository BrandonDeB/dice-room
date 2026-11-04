import { Setting } from 'obsidian';
import { BaseAttributes, BaseComponent, ComponentMetadata } from './base-component';
import { Persistable, YamlStep } from './capabilities';
import { ActionError, ActionMap, requireString } from './actions';
import { createCard } from './native';
import { normalizeEventName } from '../events';

export interface ConditionsAttributes extends BaseAttributes {
	/** The conditions in effect, e.g. [poisoned, prone]. */
	active?: unknown;
	/** 0 to 6. */
	exhaustion?: unknown;
}

/**
 * The standard conditions, and what each does to your own rolls, as a reminder: conditions
 * are tracked here and applied when rolling (right-click a roll for advantage or
 * disadvantage), not added to every roll automatically.
 */
const CONDITIONS: { name: string; value?: string; appliesTo?: string[] }[] = [
	{ name: 'Blinded', value: 'disadvantage', appliesTo: ['attack'] },
	{ name: 'Charmed' },
	{ name: 'Deafened' },
	{ name: 'Frightened', value: 'disadvantage', appliesTo: ['attack', 'check'] },
	{ name: 'Grappled' },
	{ name: 'Incapacitated' },
	{ name: 'Invisible', value: 'advantage', appliesTo: ['attack'] },
	{ name: 'Paralyzed' },
	{ name: 'Petrified' },
	{ name: 'Poisoned', value: 'disadvantage', appliesTo: ['attack', 'check'] },
	{ name: 'Prone', value: 'disadvantage', appliesTo: ['attack'] },
	{ name: 'Restrained', value: 'disadvantage', appliesTo: ['attack'] },
	{ name: 'Stunned' },
	{ name: 'Unconscious' },
];

const MAX_EXHAUSTION = 6;

function activeList(attrs: ConditionsAttributes): string[] {
	return Array.isArray(attrs?.active) ? attrs.active.map(name => String(name).trim().toLowerCase()) : [];
}

function exhaustionOf(attrs: ConditionsAttributes): number {
	const level = attrs?.exhaustion;
	return typeof level === 'number' && Number.isInteger(level) ? Math.min(Math.max(level, 0), MAX_EXHAUSTION) : 0;
}

/** The condition named, ignoring case, or throws a user-facing error. */
function requireCondition(args: Record<string, unknown>): string {
	const name = requireString(args, 'name').toLowerCase();
	const condition = CONDITIONS.find(c => c.name.toLowerCase() === name);
	if (!condition) throw new ActionError(`"${args.name}" is not a condition`);
	return condition.name.toLowerCase();
}

/** Add or remove a condition by `name`, from effects or event subscriptions. */
const conditionActions: ActionMap<ConditionsAttributes> = {
	add: {
		run: (attrs, args) => {
			const name = requireCondition(args);
			const active = activeList(attrs);
			return active.includes(name) ? [] : [{ op: 'set', path: ['active'], value: [...active, name] }];
		},
		describe: ({ args, applied }) => applied ? `Now ${String(args.name).toLowerCase()}.` : `Makes you ${String(args.name).toLowerCase()}`,
	},
	remove: {
		run: (attrs, args) => {
			const name = requireCondition(args);
			const active = activeList(attrs);
			return active.includes(name) ? [{ op: 'set', path: ['active'], value: active.filter(n => n !== name) }] : [];
		},
		describe: ({ args, applied }) => applied ? `No longer ${String(args.name).toLowerCase()}.` : `Ends ${String(args.name).toLowerCase()}`,
	},
};

/** A long rest removes one level of exhaustion. */
function conditionsOnEvent(attrs: ConditionsAttributes, event: string): YamlStep[] {
	const exhaustion = exhaustionOf(attrs);
	if (normalizeEventName(event) !== 'long rest' || exhaustion === 0) return [];
	return [{ op: 'set', path: ['exhaustion'], value: exhaustion - 1 }];
}

/** Conditions in effect, and exhaustion, with the roll effects they cause. */
export class ConditionsComponent extends BaseComponent<ConditionsAttributes> implements Persistable {

	static readonly metadata: ComponentMetadata = {
		type: "conditions",
		label: "Conditions",
		policies: ['unique'],
		actions: conditionActions,
		onEvent: conditionsOnEvent,
		describeEvent: ({ after }) => `Exhaustion is now ${exhaustionOf(after)}.`,
	}

	onPersist: (steps: YamlStep[]) => Promise<void>;
	setPersistCallback(cb: (steps: YamlStep[]) => Promise<void>): void {
		this.onPersist = cb;
	}

	render() {
		const card = createCard(this.containerEl, undefined, this.typeLabel);
		const active = activeList(this.attributes);
		const exhaustion = exhaustionOf(this.attributes);

		const setExhaustion = (level: number) =>
			void this.onPersist([{ op: 'set', path: ['exhaustion'], value: level }]);
		const row = new Setting(card)
			.setName('Exhaustion')
			.setDesc(exhaustion === 0 ? 'None' : `Level ${exhaustion} of ${MAX_EXHAUSTION}: ${-2 * exhaustion} to every d20 roll. Add it with "Roll with a modifier" when you roll.${exhaustion === MAX_EXHAUSTION ? ' Level 6 is death.' : ''}`);
		row.addExtraButton(button => button.setIcon('minus').setTooltip('Remove a level of exhaustion')
			.setDisabled(exhaustion === 0).onClick(() => setExhaustion(exhaustion - 1)));
		row.addExtraButton(button => button.setIcon('plus').setTooltip('Add a level of exhaustion')
			.setDisabled(exhaustion === MAX_EXHAUSTION).onClick(() => setExhaustion(exhaustion + 1)));

		for (const condition of CONDITIONS) {
			const key = condition.name.toLowerCase();
			const effect = condition.value
				? `${condition.value === 'advantage' ? 'Advantage' : 'Disadvantage'} on ${condition.appliesTo?.join(' and ')} rolls: right-click a roll to apply it`
				: 'Tracked only';
			new Setting(card)
				.setName(condition.name)
				.setDesc(effect)
				.addToggle(toggle => toggle
					.setValue(active.includes(key))
					.setTooltip(`${condition.name} on or off`)
					.onChange(on => void this.onPersist([{
						op: 'set',
						path: ['active'],
						value: on ? [...activeList(this.attributes), key] : activeList(this.attributes).filter(n => n !== key),
					}])));
		}
	}
}
