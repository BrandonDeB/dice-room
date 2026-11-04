import { Setting } from 'obsidian';
import { nameList, normalizeName } from '../../modifiers';
import { FormulaError } from '../../formula';
import { ValueDefinition } from '../../character-data';
import { ActionError, ActionMap, ActionResult, optionalPositiveInt, requireString } from '../actions';
import { CardComponent } from '../component';
import { balanceGrid, createCallout, renderModifierList } from '../native';

/** One entry of a `values` list. */
interface ValueEntry {
	name?: unknown;
	/** A number, or a formula like "floor(({{dex}} - 10) / 2)". */
	value?: unknown;
	/** Modifiers with these categories add to it, like `armor class`. */
	categories?: unknown;
	description?: unknown;
	/** With a min or max, a number gets minus and plus buttons, and stays within them. */
	min?: unknown;
	max?: unknown;
	/** Not shown on the card, for values that only feed formulas, like ability modifiers. */
	hidden?: unknown;
}

function entries(data: unknown): ValueEntry[] {
	return Array.isArray(data) ? data as ValueEntry[] : [];
}

function entryName(entry: ValueEntry): string | null {
	return typeof entry?.name === 'string' && entry.name.trim() !== '' ? entry.name.trim() : null;
}

const bound = (value: unknown) => typeof value === 'number' ? value : undefined;

/** A value you count up and down, like exhaustion: a plain number with a min or max. */
function isCounter(entry: ValueEntry): boolean {
	return typeof entry.value === 'number' && (bound(entry.min) !== undefined || bound(entry.max) !== undefined);
}

function clamp(entry: ValueEntry, n: number): number {
	const min = bound(entry.min) ?? -Infinity;
	const max = bound(entry.max) ?? Infinity;
	return Math.min(max, Math.max(min, n));
}

/** The named entry with its index, if its value is a plain number that can change. */
function requireNumber(data: unknown, args: Record<string, unknown>): { index: number; entry: ValueEntry; value: number } {
	const name = normalizeName(requireString(args, 'name'));
	const index = entries(data).findIndex(entry => normalizeName(entryName(entry) ?? '') === name);
	if (index === -1) throw new ActionError(`No value named "${args.name}"`);
	const entry = entries(data)[index];
	if (typeof entry.value !== 'number') throw new ActionError(`${entryName(entry)} is worked out from a formula, so it can't be changed`);
	return { index, entry, value: entry.value };
}

/** "Increases Exhaustion (now 1)" as a preview, "Increased Exhaustion to 2." once done. */
function describeChange(present: string, past: string) {
	return ({ before, after, args, applied }: ActionResult<ValueEntry[]>) => {
		const { entry, value } = requireNumber(applied ? after : before, args);
		const name = entryName(entry);
		return applied ? `${past} ${name} to ${value}.` : `${present} ${name} (now ${value})`;
	};
}

const change = (by: (value: number, args: Record<string, unknown>) => number) =>
	(data: ValueEntry[], args: Record<string, unknown>) => {
		const { index, entry, value } = requireNumber(data, args);
		const next = clamp(entry, by(value, args));
		return next === value ? [] : [{ op: 'set' as const, path: [index, 'value'], value: next }];
	};

/** Change a plain number by `name`, from effects and event subscriptions. Min and max still hold. */
const valueActions: ActionMap<ValueEntry[]> = {
	increase: { run: change((value, args) => value + optionalPositiveInt(args, 'amount', 1)), describe: describeChange('Increases', 'Increased') },
	decrease: { run: change((value, args) => value - optionalPositiveInt(args, 'amount', 1)), describe: describeChange('Decreases', 'Decreased') },
	set: {
		run: change((_, args) => {
			if (typeof args.value !== 'number') throw new ActionError('"value" must be a number');
			return args.value;
		}),
		describe: describeChange('Sets', 'Set'),
	},
};

/**
 * Named numbers that formulas anywhere on the character can use as {{name}}, like
 * ability scores, level, proficiency or armor class. A value can be a formula using
 * other values, and modifiers can add to it through its `categories`.
 */
export const valuesComponent: CardComponent<ValueEntry[]> = {
	key: 'values',
	label: 'Values',
	entryNames: data => entries(data).map(entryName).filter((name): name is string => name !== null),
	actions: valueActions,
	values: data => entries(data).flatMap((entry): ValueDefinition[] => {
		const name = entryName(entry);
		return name ? [{ name, formula: entry.value, categories: nameList(entry.categories) }] : [];
	}),

	render(view) {
		const list = entries(view.data);
		const grid = view.layout === 'grid' ? view.el.createDiv({ cls: 'dicelist-card-content dicelist-roll-grid' }) : null;
		if (grid) balanceGrid(grid, view.owner, view.columns);
		const shown: { name: string; show: (total: string, detail: (el: HTMLElement) => void) => void }[] = [];

		list.forEach((entry, index) => {
			const name = entryName(entry);
			if (!name) {
				createCallout(view.el, 'error', 'Each value needs a name.');
				return;
			}
			if (entry.hidden === true) return;
			const description = typeof entry.description === 'string' ? entry.description : '';

			if (grid && !isCounter(entry)) {
				const tile = grid.createDiv({ cls: 'dicelist-roll-button dicelist-value-tile' });
				tile.createSpan({ cls: 'dicelist-roll-button-label', text: name });
				const valueEl = tile.createSpan({ cls: 'dicelist-roll-button-value' });
				shown.push({
					name, show: (total) => {
						valueEl.setText(total);
						// Obsidian shows the label as the tooltip, so the description goes in it too.
						tile.setAttr('aria-label', [`${name}: ${total}`, description].filter(Boolean).join('\n'));
					},
				});
				return;
			}

			const row = new Setting(view.el).setName(name);
			if (isCounter(entry)) {
				const set = (value: number) => void view.persist([{ op: 'set', path: [index, 'value'], value: clamp(entry, value) }]);
				const value = entry.value as number;
				row.addExtraButton(button => button
					.setIcon('minus')
					.setTooltip(`Decrease ${name}`)
					.setDisabled(value <= (bound(entry.min) ?? -Infinity))
					.onClick(() => set(value - 1)));
			}
			const valueEl = row.controlEl.createSpan({ cls: 'dicelist-detail-value', attr: { 'aria-live': 'polite' } });
			if (isCounter(entry)) {
				const value = entry.value as number;
				row.addExtraButton(button => button
					.setIcon('plus')
					.setTooltip(`Increase ${name}`)
					.setDisabled(value >= (bound(entry.max) ?? Infinity))
					.onClick(() => void view.persist([{ op: 'set', path: [index, 'value'], value: clamp(entry, value + 1) }])));
			}
			shown.push({
				name, show: (total, detail) => {
					valueEl.setText(total);
					row.descEl.empty();
					if (description) row.descEl.createDiv({ text: description });
					detail(row.descEl);
				},
			});
		});
		const problems = grid ? view.el.createDiv({ cls: 'dicelist-card-content' }) : null;

		view.refresh(character => {
			problems?.empty();
			for (const { name, show } of shown) {
				try {
					const { total, modifiers } = character.value(name);
					show(String(total), el => renderModifierList(el, 'Includes:', modifiers, 'roll-modifiers', view.ctx.sourcePath, view.owner));
				} catch (err) {
					if (!(err instanceof FormulaError)) throw err;
					show('?', el => el.createDiv({ cls: 'roll-modifiers roll-problem', text: err.message }));
					problems?.createDiv({ cls: 'roll-modifiers roll-problem', text: `${name}: ${err.message}` });
				}
			}
		});
	},
};
