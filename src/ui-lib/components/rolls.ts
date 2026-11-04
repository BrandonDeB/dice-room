import { Setting } from 'obsidian';
import { Roll, EffectPreview, hasDice, parseRoll, previewEffects } from '../../roll';
import { hasD20, readableNotation, resolveRollModifiers } from '../../modifiers';
import { CharacterData } from '../../character-data';
import { FormulaError } from '../../formula';
import { CardComponent, ComponentView } from '../component';
import { RollChange, addRollMenu, balanceGrid, createBlockLink, createCallout, formatBonus, renderModifierList, rollMenu } from '../native';

/** What a roll came to on the last refresh, for drawing. */
interface RollDetails {
	/** The worked-out notation, or "" if it can't be made or has no dice. */
	notation: string;
	/** The roll's `value`, worked out, such as an ability score. */
	value?: string;
	advantage?: string;
	problems: string[];
	/** Draws the modifiers and effects lines. */
	draw(el: HTMLElement): void;
}

/** One roll as drawn. */
interface RollLine {
	roll: Roll;
	notation: string;
	/** Hides or disables the button while effects can't be paid for, like no arrows left. */
	setEnabled(enabled: boolean): void;
	describe(details: RollDetails): void;
}

/** "Uses 1 of Arrows (2 left)", each linking to the block it changes. */
function renderEffectLines(view: ComponentView, desc: HTMLElement, effects: EffectPreview[]) {
	for (const effect of effects) {
		if (!effect.message) continue;
		const line = desc.createDiv({ cls: 'roll-modifiers roll-effect' });
		if (effect.target) createBlockLink(line, effect.message, effect.target, view.ctx.sourcePath, view.owner);
		else line.setText(effect.message);
	}
}

/** "+3" for a d20 roll with a bonus, so a grid of checks reads like a sheet; otherwise the dice. */
function shortNotation(notation: string): string {
	const match = /^1d20([+-]\d+)?$/i.exec(readableNotation(notation));
	return match ? formatBonus(Number(match[1] ?? 0)) : readableNotation(notation);
}

function buttonText(roll: Roll): string {
	return roll.button ?? (hasDice(roll) ? 'Roll' : 'Use');
}

/** Right-click choices, worked out when the menu opens, since they depend on the dice. */
function addMenu(view: ComponentView, el: HTMLElement, line: Partial<RollLine>) {
	const roll = line.roll!;
	if (!hasDice(roll)) return;
	addRollMenu(el, () => rollMenu(hasD20(line.notation ?? ''), (change: RollChange) => view.roll({ ...roll, ...change })));
}

/** Everything a row would show, as one sentence, for a tile's label and tooltip. */
function spokenDetails(prefix: string, roll: Roll, { notation, value, advantage, draw }: RollDetails): string {
	const scratch = createDiv();
	draw(scratch);
	return [
		prefix,
		value ?? '',
		notation ? readableNotation(notation) : '',
		advantage ? `with ${advantage}` : '',
		roll.description ?? '',
		scratch.textContent ?? '',
	].filter(Boolean).join(', ');
}

/** A row for a roll: its dice with modifiers, what its effects will do, and a button. */
function listLine(view: ComponentView, roll: Roll, parent?: Roll): RollLine {
	const line: Partial<RollLine> = { roll, notation: '' };
	const label = parent ? `${parent.name} ${roll.name}` : roll.name;
	let buttonEl: HTMLElement | undefined;
	const setting = new Setting(view.el).setName(roll.name);
	if (parent) setting.settingEl.addClass('dicelist-nested-roll');
	const valueEl = roll.value != null ? setting.controlEl.createSpan({ cls: 'dicelist-detail-value' }) : null;
	setting.addButton(button => {
		buttonEl = button.buttonEl;
		button.setButtonText(buttonText(roll)).setTooltip(`${buttonText(roll)} ${label}`).onClick(() => view.roll(roll));
	});
	if (buttonEl) addMenu(view, buttonEl, line);
	line.setEnabled = enabled => buttonEl?.toggle(enabled);
	line.describe = ({ notation, value, advantage, problems, draw }) => {
		valueEl?.setText(value ?? '');
		const desc = setting.descEl;
		desc.empty();
		if (roll.description) desc.createDiv({ text: roll.description });
		if (notation) desc.createDiv({ text: readableNotation(notation) });
		if (advantage) desc.createDiv({ cls: 'roll-modifiers', text: `With ${advantage}` });
		if (problems.length > 0) desc.createDiv({ cls: 'roll-modifiers roll-problem', text: problems.join(' ') });
		else draw(desc);
	};
	return line as RollLine;
}

/** A button in a grid, or inside a tile: the roll's name and its bonus. */
function gridButton(view: ComponentView, parentEl: HTMLElement, problemsEl: HTMLElement, roll: Roll, parent?: Roll): RollLine {
	const line: Partial<RollLine> = { roll, notation: '' };
	const label = parent ? `${parent.name} ${roll.name}` : roll.name;
	const button = parentEl.createEl('button', { cls: 'dicelist-roll-button', attr: { type: 'button', 'aria-label': `${buttonText(roll)} ${label}` } });
	button.createSpan({ cls: 'dicelist-roll-button-label', text: roll.name });
	const valueEl = button.createSpan({ cls: 'dicelist-roll-button-value' });
	button.addEventListener('click', event => {
		// Inside a tile, don't also roll the tile.
		event.stopPropagation();
		view.roll(roll);
	});
	button.addEventListener('keydown', event => event.stopPropagation());
	addMenu(view, button, line);
	line.setEnabled = enabled => { button.disabled = !enabled; };
	line.describe = details => {
		valueEl.setText(details.notation ? shortNotation(details.notation) : (details.value ?? ''));
		const spoken = spokenDetails(`${buttonText(roll)} ${label}`, roll, details);
		button.setAttr('aria-label', spoken);
		button.setAttr('title', spoken);
		for (const problem of details.problems) problemsEl.createDiv({ cls: 'roll-modifiers roll-problem', text: `${label}: ${problem}` });
	};
	return line as RollLine;
}

/**
 * A tile for a roll with rolls inside it, like an ability: clicking the tile makes the
 * roll (the check), and its own buttons make the others (the save). A button can't hold
 * buttons, so the tile is a keyboard-usable role="button".
 */
function gridTile(view: ComponentView, grid: HTMLElement, problemsEl: HTMLElement, roll: Roll): RollLine[] {
	const line: Partial<RollLine> = { roll, notation: '' };
	const tile = grid.createDiv({ cls: 'dicelist-roll-tile', attr: { role: 'button', tabindex: '0', 'aria-label': `${buttonText(roll)} ${roll.name}` } });
	const header = tile.createDiv({ cls: 'dicelist-roll-tile-header' });
	header.createSpan({ cls: 'dicelist-roll-button-label', text: roll.name });
	const valueEl = header.createSpan({ cls: 'dicelist-roll-button-value' });
	let enabled = true;
	const make = () => { if (enabled) view.roll(roll); };
	tile.addEventListener('click', make);
	tile.addEventListener('keydown', (event: KeyboardEvent) => {
		if (event.target !== tile || (event.key !== 'Enter' && event.key !== ' ')) return;
		event.preventDefault();
		make();
	});
	addMenu(view, tile, line);
	line.setEnabled = on => { enabled = on; tile.toggleClass('is-disabled', !on); tile.setAttr('aria-disabled', String(!on)); };
	line.describe = details => {
		const bonus = details.notation ? shortNotation(details.notation) : '';
		valueEl.setText(details.value != null && bonus ? `${details.value} (${bonus})` : (details.value ?? bonus));
		const spoken = spokenDetails(`${buttonText(roll)} ${roll.name}`, roll, details);
		tile.setAttr('aria-label', spoken);
		tile.setAttr('title', spoken);
		for (const problem of details.problems) problemsEl.createDiv({ cls: 'roll-modifiers roll-problem', text: `${roll.name}: ${problem}` });
	};
	return [line as RollLine, ...(roll.rolls ?? []).map(child => gridButton(view, tile, problemsEl, child, roll))];
}

/** Work out a roll again: its dice, modifiers, effects and value, or why it can't be made. */
async function refreshLine(view: ComponentView, character: CharacterData, line: RollLine) {
	const { roll } = line;
	const effects = await previewEffects(view.ctx, character, roll.effects, hasDice(roll));
	const problems = effects.map(effect => effect.problem).filter((problem): problem is string => !!problem);
	// Out of what the effects need (no arrows, no spell slots): no button until there's enough.
	line.setEnabled(problems.length === 0);

	let value: string | undefined;
	if (roll.value != null) {
		try {
			value = String(character.evaluate(roll.value).flat);
		} catch (err) {
			if (!(err instanceof FormulaError)) throw err;
			problems.push(err.message);
		}
	}

	if (!hasDice(roll)) {
		line.describe({ notation: '', value, problems, draw: el => renderEffectLines(view, el, effects) });
		return;
	}
	const resolved = resolveRollModifiers(character, roll);
	line.notation = resolved.notation;
	line.describe({
		notation: resolved.notation,
		value,
		advantage: resolved.advantage,
		problems: [...resolved.problems, ...problems],
		draw: el => {
			// "Includes: Archery (+2)" and "Off: Bless (1d4)", each linking to where it's set.
			renderModifierList(el, 'Includes:', resolved.applied, 'roll-modifiers', view.ctx.sourcePath, view.owner);
			renderModifierList(el, 'Off:', resolved.inactive, 'roll-modifiers roll-modifiers-off', view.ctx.sourcePath, view.owner);
			renderEffectLines(view, el, effects);
		},
	});
}

/**
 * Rolls, each with a button: dice from a formula, modifiers by name or category, and
 * effects on other components. A roll without dice is a button that only runs effects.
 * A roll can hold rolls that belong with it, like an ability's check and save.
 */
export const rollsComponent: CardComponent<unknown[]> = {
	key: 'rolls',
	label: 'Rolls',

	render(view) {
		const rolls: Roll[] = [];
		for (const entry of Array.isArray(view.data) ? view.data : []) {
			const roll = parseRoll(entry);
			if (typeof roll === 'string') createCallout(view.el, 'error', roll);
			else rolls.push(roll);
		}

		const lines: RollLine[] = [];
		let problemsEl: HTMLElement | null = null;
		if (view.layout === 'grid') {
			// Tiles with rolls inside are narrower, so six abilities fit on a row.
			const tiles = rolls.some(roll => roll.rolls || roll.value != null);
			const grid = view.el.createDiv({ cls: ['dicelist-card-content', 'dicelist-roll-grid', ...(tiles ? ['dicelist-tile-grid'] : [])] });
			balanceGrid(grid, view.owner, view.columns);
			problemsEl = view.el.createDiv({ cls: 'dicelist-card-content' });
			for (const roll of rolls) {
				lines.push(...(roll.rolls || roll.value != null
					? gridTile(view, grid, problemsEl, roll)
					: [gridButton(view, grid, problemsEl, roll)]));
			}
		} else {
			for (const roll of rolls) {
				lines.push(listLine(view, roll), ...(roll.rolls ?? []).map(child => listLine(view, child, roll)));
			}
		}

		view.refresh(async character => {
			problemsEl?.empty();
			for (const line of lines) await refreshLine(view, character, line);
			problemsEl?.toggle(problemsEl.childElementCount > 0);
		});
	},
};
