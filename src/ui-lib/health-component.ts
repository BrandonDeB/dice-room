import { Notice, Setting } from 'obsidian';
import { BaseAttributes, BaseComponent, ComponentMetadata } from './base-component';
import { Persistable, Rollable, YamlStep } from './capabilities';
import { ActionError, ActionMap, ActionResult, applyStepsToData, getAction, optionalPositiveInt } from './actions';
import { createCallout, createCard, formatBonus } from './native';
import { normalizeEventName } from '../events';
import { Roll } from '../roll';
import { DiceNotation } from './ui-types';
import { loadSheet } from '../sheet';

export interface HealthAttributes extends BaseAttributes {
	max?: unknown;
	current?: unknown;
	temp?: unknown;
	/** e.g. { die: d10, max: 5, used: 1 } */
	hitDice?: { die?: unknown; max?: unknown; used?: unknown };
	/** Saved while at 0 hit points. */
	deathSaves?: { successes?: unknown; failures?: unknown };
}

/** Hit points with every field checked and defaulted. */
interface Health {
	max: number;
	current: number;
	temp: number;
	hitDice?: { die: string; max: number; used: number; remaining: number };
	successes: number;
	failures: number;
}

const wholeNumber = (value: unknown, fallback: number) =>
	typeof value === 'number' && Number.isInteger(value) && value >= 0 ? value : fallback;

/** Read the block's fields, or a message saying what's wrong. */
function readHealth(attrs: HealthAttributes): Health | string {
	const max = attrs?.max;
	if (typeof max !== 'number' || !Number.isInteger(max) || max < 1) return 'Hit points need a max: a whole number of 1 or more.';
	const health: Health = {
		max,
		current: Math.min(wholeNumber(attrs.current, max), max),
		temp: wholeNumber(attrs.temp, 0),
		successes: Math.min(wholeNumber(attrs.deathSaves?.successes, 0), 3),
		failures: Math.min(wholeNumber(attrs.deathSaves?.failures, 0), 3),
	};
	if (attrs.hitDice) {
		const die = String(attrs.hitDice.die ?? '').trim().toLowerCase();
		const diceMax = attrs.hitDice.max;
		if (!/^d\d+$/.test(die)) return 'Hit dice need a die, like d10.';
		if (typeof diceMax !== 'number' || !Number.isInteger(diceMax) || diceMax < 1) return 'Hit dice need a max: a whole number of 1 or more.';
		const used = Math.min(wholeNumber(attrs.hitDice.used, 0), diceMax);
		health.hitDice = { die, max: diceMax, used, remaining: diceMax - used };
	}
	return health;
}

function requireHealth(attrs: HealthAttributes): Health {
	const health = readHealth(attrs);
	if (typeof health === 'string') throw new ActionError(health);
	return health;
}

const resetDeathSaves: YamlStep = { op: 'delete', path: ['deathSaves'] };

/** "30 of 38 hit points" plus temporary hit points if any. */
function summary(health: Health): string {
	return `${health.current} of ${health.max} hit points${health.temp > 0 ? `, ${health.temp} temporary` : ''}`;
}

/** Describe from the hit points after the change: "Took 5 damage. 25 of 38 hit points." */
function describeWith(present: (amount: number) => string, past: (amount: number) => string) {
	return ({ after, args, applied }: ActionResult<HealthAttributes>) => {
		const health = readHealth(after);
		if (typeof health === 'string') return '';
		const amount = typeof args.amount === 'number' ? args.amount : 1;
		return applied ? `${past(amount)}. ${summary(health)}.` : `${present(amount)} (leaves ${summary(health)})`;
	};
}

/**
 * Actions that effects, events and the card's buttons use. `amount` is a whole number;
 * rolls can pass `$total` to use what they rolled.
 */
const healthActions: ActionMap<HealthAttributes> = {
	/** Temporary hit points absorb damage first. At 0 hit points, damage is a failed death save. */
	damage: {
		run: (attrs, args) => {
			const health = requireHealth(attrs);
			const amount = optionalPositiveInt(args, 'amount', 1);
			if (health.current === 0) {
				return [{ op: 'set', path: ['deathSaves', 'failures'], value: Math.min(3, health.failures + 1) }];
			}
			const absorbed = Math.min(health.temp, amount);
			return [
				{ op: 'set', path: ['temp'], value: health.temp - absorbed },
				{ op: 'set', path: ['current'], value: Math.max(0, health.current - (amount - absorbed)) },
			];
		},
		describe: describeWith(n => `Takes ${n} damage`, n => `Took ${n} damage`),
	},
	/** Up to the max. Healing from 0 clears death saves. */
	heal: {
		run: (attrs, args) => {
			const health = requireHealth(attrs);
			const amount = optionalPositiveInt(args, 'amount', 1);
			const steps: YamlStep[] = [{ op: 'set', path: ['current'], value: Math.min(health.max, health.current + amount) }];
			if (health.current === 0) steps.push(resetDeathSaves);
			return steps;
		},
		describe: describeWith(n => `Heals ${n}`, n => `Healed ${n}`),
	},
	/** Temporary hit points don't stack: keep the higher amount. */
	temp: {
		run: (attrs, args) => {
			const health = requireHealth(attrs);
			return [{ op: 'set', path: ['temp'], value: Math.max(health.temp, optionalPositiveInt(args, 'amount', 1)) }];
		},
		describe: describeWith(n => `Gains ${n} temporary hit points`, n => `Gained ${n} temporary hit points`),
	},
	/** Spend one hit die. Refuses if none are left. */
	spendHitDie: {
		run: (attrs) => {
			const dice = requireHealth(attrs).hitDice;
			if (!dice) throw new ActionError('This character has no hit dice.');
			if (dice.remaining === 0) throw new ActionError(`No hit dice left: 0 of ${dice.max}`);
			return [{ op: 'set', path: ['hitDice', 'used'], value: dice.used + 1 }];
		},
		describe: ({ before, after, applied }) => {
			const dice = (readHealth(applied ? after : before) as Health).hitDice;
			if (!dice) return '';
			return applied ? `Spent a hit die. ${dice.remaining} of ${dice.max} left.` : `Spends a hit die (${dice.remaining} of ${dice.max} left)`;
		},
	},
	/** Record a death saving throw from its `roll`: 10 or more succeeds, 1 fails twice, 20 regains 1 hit point. */
	deathSave: {
		run: (attrs, args) => {
			const health = requireHealth(attrs);
			const roll = args.roll;
			if (typeof roll !== 'number') throw new ActionError('A death save needs the roll\'s result.');
			if (health.current > 0) throw new ActionError('Death saves are only made at 0 hit points.');
			if (roll >= 20) return [{ op: 'set', path: ['current'], value: 1 }, resetDeathSaves];
			if (roll >= 10) return [{ op: 'set', path: ['deathSaves', 'successes'], value: Math.min(3, health.successes + 1) }];
			return [{ op: 'set', path: ['deathSaves', 'failures'], value: Math.min(3, health.failures + (roll <= 1 ? 2 : 1)) }];
		},
		describe: ({ args, after, applied }) => {
			const health = readHealth(after) as Health;
			const outcome = health.current > 0 ? 'Back up with 1 hit point'
				: `${health.successes} of 3 successes, ${health.failures} of 3 failures`;
			return applied ? `Death save (${args.roll}): ${outcome}.` : 'Records a death save';
		},
	},
};

/** A long rest restores all hit points, half the hit dice (at least one), and clears temporary hit points and death saves. */
function healthOnEvent(attrs: HealthAttributes, event: string): YamlStep[] {
	if (normalizeEventName(event) !== 'long rest') return [];
	const health = readHealth(attrs);
	if (typeof health === 'string') return [];
	const steps: YamlStep[] = [];
	if (health.current < health.max) steps.push({ op: 'set', path: ['current'], value: health.max });
	if (health.temp > 0) steps.push({ op: 'set', path: ['temp'], value: 0 });
	if (health.successes || health.failures) steps.push(resetDeathSaves);
	if (health.hitDice && health.hitDice.used > 0) {
		const regained = Math.max(1, Math.floor(health.hitDice.max / 2));
		steps.push({ op: 'set', path: ['hitDice', 'used'], value: Math.max(0, health.hitDice.used - regained) });
	}
	return steps;
}

function describeHealthEvent({ before, after, applied }: ActionResult<HealthAttributes> & { event: string }): string {
	const now = readHealth(applied ? after : before);
	const then = readHealth(after);
	if (typeof now === 'string' || typeof then === 'string') return '';
	const dice = then.hitDice ? `, ${then.hitDice.remaining} of ${then.hitDice.max} hit dice` : '';
	return applied ? `Restored hit points to ${then.current} of ${then.max}${dice}.` : `Restores hit points (${summary(now)})`;
}

/** Hit points, temporary hit points, hit dice and death saves for one character. */
export class HealthComponent extends BaseComponent<HealthAttributes> implements Rollable, Persistable {

	static readonly metadata: ComponentMetadata = {
		type: "health",
		label: "Hit points",
		policies: ['unique'],
		actions: healthActions,
		onEvent: healthOnEvent,
		describeEvent: describeHealthEvent,
	}

	onRoll: (roll: Roll) => void;
	setRollCallback(cb: (roll: Roll) => void): void {
		this.onRoll = cb;
	}

	onPersist: (steps: YamlStep[]) => Promise<void>;
	setPersistCallback(cb: (steps: YamlStep[]) => Promise<void>): void {
		this.onPersist = cb;
	}

	/** Run one of the block's own actions from a button, and announce it. */
	private act(action: string, amount: number) {
		const definition = getAction(healthActions, action);
		if (!definition) return;
		try {
			const steps = definition.run(this.attributes, { amount });
			const after = applyStepsToData(this.attributes, steps);
			const message = definition.describe?.({ before: this.attributes, after, args: { amount }, applied: true });
			void this.onPersist(steps);
			if (message) new Notice(message);
		} catch (err) {
			new Notice(err instanceof ActionError ? err.message : 'Could not change hit points');
		}
	}

	render() {
		const card = createCard(this.containerEl, undefined, this.typeLabel);
		const health = readHealth(this.attributes);
		if (typeof health === 'string') {
			createCallout(card, 'error', health);
			return;
		}

		// "30 of 38", with an amount field and Damage, Heal and Temp buttons.
		let amountInput: HTMLInputElement | undefined;
		const amount = () => {
			const value = Number(amountInput?.value);
			return Number.isInteger(value) && value > 0 ? value : null;
		};
		const apply = (action: string) => {
			const value = amount();
			if (value === null) new Notice('Enter a whole number of 1 or more first.');
			else this.act(action, value);
		};
		new Setting(card)
			.setName(`${health.current} of ${health.max}`)
			.setDesc(health.temp > 0 ? `${health.temp} temporary hit points` : 'Enter an amount, then choose what happens.')
			.addText(text => {
				amountInput = text.inputEl;
				text.inputEl.type = 'number';
				text.inputEl.min = '1';
				text.inputEl.addClass('dicelist-quantity');
				text.inputEl.setAttr('aria-label', 'Amount');
			})
			.addButton(button => button.setButtonText('Damage').onClick(() => apply('damage')))
			.addButton(button => button.setButtonText('Heal').onClick(() => apply('heal')))
			.addButton(button => button.setButtonText('Temp').setTooltip('Gain temporary hit points').onClick(() => apply('temp')));

		if (health.current === 0) this.renderDeathSaves(card, health);
		if (health.hitDice) this.guard(this.renderHitDice(card, health.hitDice));
	}

	private renderDeathSaves(card: HTMLElement, health: Health) {
		const state = health.failures >= 3 ? 'Dead' : health.successes >= 3 ? 'Stable' : null;
		new Setting(card)
			.setName('Death saves')
			.setDesc(`${health.successes} of 3 successes, ${health.failures} of 3 failures${state ? `. ${state}.` : ''}`)
			.addButton(button => button
				.setButtonText('Roll')
				.setDisabled(state !== null)
				.setTooltip('Roll a death saving throw')
				.onClick(() => this.onRoll({
					notation: new DiceNotation('1d20'),
					categories: ['death save', 'save'],
					effects: [{ target: 'health', action: 'deathSave', args: { roll: '$total' } }],
				})));
	}

	/** Hit dice heal by the die plus the Constitution modifier, spending one die. */
	private async renderHitDice(card: HTMLElement, dice: NonNullable<Health['hitDice']>) {
		const con = (await loadSheet(this.ctx)).abilityModifier('Constitution');
		const notation = `1${dice.die}${con === 0 ? '' : formatBonus(con)}`;
		const row = new Setting(card)
			.setName('Hit dice')
			.setDesc(`${dice.remaining} of ${dice.max} left. Rolling heals ${notation}.`);
		if (dice.remaining > 0) {
			row.addButton(button => button
				.setButtonText('Roll')
				.setTooltip('Spend a hit die to heal')
				.onClick(() => this.onRoll({
					notation: new DiceNotation(notation),
					categories: ['hit die'],
					effects: [
						{ target: 'health', action: 'spendHitDie' },
						{ target: 'health', action: 'heal', args: { amount: '$total' } },
					],
				})));
		}
	}
}
