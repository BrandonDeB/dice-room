import { Notice, Setting } from 'obsidian';
import { YamlStep } from '../capabilities';
import { ActionError, ActionMap, ActionResult, applyStepsToData, getAction, optionalPositiveInt } from '../actions';
import { CardComponent } from '../component';
import { createCallout } from '../native';

interface HealthFields {
	max?: unknown;
	current?: unknown;
	temp?: unknown;
}

/** Hit points with every field checked and defaulted. */
interface Health {
	max: number;
	current: number;
	temp: number;
}

const wholeNumber = (value: unknown, fallback: number) =>
	typeof value === 'number' && Number.isInteger(value) && value >= 0 ? value : fallback;

/** Read the fields, or a message saying what's wrong. */
function readHealth(fields: HealthFields): Health | string {
	const max = fields?.max;
	if (typeof max !== 'number' || !Number.isInteger(max) || max < 1) return 'Health needs a max: a whole number of 1 or more.';
	return {
		max,
		current: Math.min(wholeNumber(fields.current, max), max),
		temp: wholeNumber(fields.temp, 0),
	};
}

function requireHealth(fields: HealthFields): Health {
	const health = readHealth(fields);
	if (typeof health === 'string') throw new ActionError(health);
	return health;
}

/** "30 of 38 hit points" plus temporary hit points if any. */
function summary(health: Health): string {
	return `${health.current} of ${health.max} hit points${health.temp > 0 ? `, ${health.temp} temporary` : ''}`;
}

/** Describe from the hit points after the change: "Took 5 damage. 25 of 38 hit points." */
function describeWith(present: (amount: number) => string, past: (amount: number) => string) {
	return ({ after, args, applied }: ActionResult<HealthFields>) => {
		const health = readHealth(after);
		if (typeof health === 'string') return '';
		const amount = typeof args.amount === 'number' ? args.amount : 1;
		return applied ? `${past(amount)}. ${summary(health)}.` : `${present(amount)} (leaves ${summary(health)})`;
	};
}

/**
 * Actions that effects, event subscriptions and the card's buttons use. `amount` is a
 * whole number; rolls can pass `$total` to use what they rolled.
 */
const healthActions: ActionMap<HealthFields> = {
	/** Temporary hit points absorb damage first. */
	damage: {
		run: (fields, args) => {
			const health = requireHealth(fields);
			const amount = optionalPositiveInt(args, 'amount', 1);
			const absorbed = Math.min(health.temp, amount);
			return [
				{ op: 'set', path: ['temp'], value: health.temp - absorbed },
				{ op: 'set', path: ['current'], value: Math.max(0, health.current - (amount - absorbed)) },
			];
		},
		describe: describeWith(n => `Takes ${n} damage`, n => `Took ${n} damage`),
	},
	/** Up to the max. */
	heal: {
		run: (fields, args) => {
			const health = requireHealth(fields);
			return [{ op: 'set', path: ['current'], value: Math.min(health.max, health.current + optionalPositiveInt(args, 'amount', 1)) }];
		},
		describe: describeWith(n => `Heals ${n}`, n => `Healed ${n}`),
	},
	/** Temporary hit points don't stack: keep the higher amount. */
	temp: {
		run: (fields, args) => {
			const health = requireHealth(fields);
			return [{ op: 'set', path: ['temp'], value: Math.max(health.temp, optionalPositiveInt(args, 'amount', 1)) }];
		},
		describe: describeWith(n => `Gains ${n} temporary hit points`, n => `Gained ${n} temporary hit points`),
	},
	/** Back to full, with no temporary hit points, such as after a long rest. */
	restore: {
		run: (fields) => {
			const health = requireHealth(fields);
			const steps: YamlStep[] = [];
			if (health.current < health.max) steps.push({ op: 'set', path: ['current'], value: health.max });
			if (health.temp > 0) steps.push({ op: 'set', path: ['temp'], value: 0 });
			return steps;
		},
		describe: ({ before, after, applied }) => {
			const health = readHealth(applied ? after : before);
			if (typeof health === 'string') return '';
			return applied ? `Restored hit points. ${summary(health)}.` : `Restores hit points (${summary(health)})`;
		},
	},
};

/** Hit points and temporary hit points, with Damage, Heal and Temp buttons. */
export const healthComponent: CardComponent<HealthFields> = {
	key: 'health',
	label: 'Health',
	unique: true,
	actions: healthActions,

	render(view) {
		const health = readHealth(view.data);
		if (typeof health === 'string') {
			createCallout(view.el, 'error', health);
			return;
		}

		/** Run one of the actions from a button, and announce it. */
		const act = (action: string, amount: number) => {
			const definition = getAction(healthActions, action);
			if (!definition) return;
			try {
				const steps = definition.run(view.data, { amount });
				const after = applyStepsToData(view.data, steps);
				const message = definition.describe?.({ before: view.data, after, args: { amount }, applied: true });
				void view.persist(steps);
				if (message) new Notice(message);
			} catch (err) {
				new Notice(err instanceof ActionError ? err.message : 'Could not change hit points');
			}
		};

		let amountInput: HTMLInputElement | undefined;
		const apply = (action: string) => {
			const value = Number(amountInput?.value);
			if (!Number.isInteger(value) || value < 1) new Notice('Enter a whole number of 1 or more first.');
			else act(action, value);
		};
		new Setting(view.el)
			.setName(`${health.current} of ${health.max} hit points`)
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
	},
};
