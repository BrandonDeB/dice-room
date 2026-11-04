import { Setting } from 'obsidian';
import { Roll, EffectPreview, hasDice, parseRoll, previewEffects } from '../../roll';
import { hasD20, readableNotation, resolveRollModifiers } from '../../modifiers';
import { CharacterData } from '../../character-data';
import { CardComponent, ComponentView } from '../component';
import { RollChange, addRollMenu, createBlockLink, createCallout, formatBonus, renderModifierList, rollMenu } from '../native';

/** One roll as drawn: what's known about it after the last refresh. */
interface RollLine {
	roll: Roll;
	/** The worked-out notation, or "" if the roll can't be made. */
	notation: string;
	/** Hides or disables the button while effects can't be paid for, like no arrows left. */
	setEnabled(enabled: boolean): void;
	/** Shows the dice, modifiers, effects and problems. */
	describe(details: RollDetails): void;
}

interface RollDetails {
	notation: string;
	advantage?: string;
	problems: string[];
	draw(el: HTMLElement): void;
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

/** A row per roll: the dice with modifiers, what its effects will do, and a button. */
function listLine(view: ComponentView, roll: Roll, line: Partial<RollLine>): RollLine {
	let buttonEl: HTMLElement | undefined;
	const setting = new Setting(view.el).setName(roll.name).addButton(button => {
		buttonEl = button.buttonEl;
		button.setButtonText(buttonText(roll)).setTooltip(`${buttonText(roll)} ${roll.name}`).onClick(() => view.roll(roll));
	});
	if (buttonEl && hasDice(roll)) {
		addRollMenu(buttonEl, () => rollMenu(hasD20(line.notation ?? ''), (change: RollChange) => view.roll({ ...roll, ...change })));
	}
	return {
		roll,
		notation: '',
		setEnabled: enabled => buttonEl?.toggle(enabled),
		describe: ({ notation, advantage, problems, draw }) => {
			const desc = setting.descEl;
			desc.empty();
			if (roll.description) desc.createDiv({ text: roll.description });
			if (notation) desc.createDiv({ text: readableNotation(notation) });
			if (advantage) desc.createDiv({ cls: 'roll-modifiers', text: `With ${advantage}` });
			if (problems.length > 0) desc.createDiv({ cls: 'roll-modifiers roll-problem', text: problems.join(' ') });
			else draw(desc);
		},
	};
}

/** A tile per roll in `layout: grid`, like a sheet's skill list. Details go in its label. */
function gridLine(view: ComponentView, grid: HTMLElement, problemsEl: HTMLElement, roll: Roll, line: Partial<RollLine>): RollLine {
	const button = grid.createEl('button', { cls: 'dicelist-roll-button', attr: { type: 'button', 'aria-label': `${buttonText(roll)} ${roll.name}` } });
	button.createSpan({ cls: 'dicelist-roll-button-label', text: roll.name });
	const valueEl = button.createSpan({ cls: 'dicelist-roll-button-value' });
	button.addEventListener('click', () => view.roll(roll));
	if (hasDice(roll)) {
		addRollMenu(button, () => rollMenu(hasD20(line.notation ?? ''), (change: RollChange) => view.roll({ ...roll, ...change })));
	}
	return {
		roll,
		notation: '',
		setEnabled: enabled => { button.disabled = !enabled; },
		describe: ({ notation, advantage, problems, draw }) => {
			valueEl.setText(notation ? shortNotation(notation) : '');
			// Everything the row would show is read out with the button instead.
			const scratch = createDiv();
			draw(scratch);
			const label = [
				`${buttonText(roll)} ${roll.name}`,
				notation ? readableNotation(notation) : '',
				advantage ? `with ${advantage}` : '',
				roll.description ?? '',
				scratch.textContent ?? '',
			].filter(Boolean).join(', ');
			button.setAttr('aria-label', label);
			button.setAttr('title', label);
			for (const problem of problems) problemsEl.createDiv({ cls: 'roll-modifiers roll-problem', text: `${roll.name}: ${problem}` });
		},
	};
}

/** Work out each roll again: its dice, modifiers and effects, or why it can't be made. */
async function refreshLine(view: ComponentView, character: CharacterData, line: RollLine) {
	const { roll } = line;
	const effects = await previewEffects(view.ctx, character, roll.effects, hasDice(roll));
	const effectProblems = effects.map(effect => effect.problem).filter((problem): problem is string => !!problem);
	// Out of what the effects need (no arrows, no spell slots): no button until there's enough.
	line.setEnabled(effectProblems.length === 0);

	if (!hasDice(roll)) {
		line.describe({ notation: '', problems: effectProblems, draw: el => renderEffectLines(view, el, effects) });
		return;
	}
	const resolved = resolveRollModifiers(character, roll);
	line.notation = resolved.notation;
	line.describe({
		notation: resolved.notation,
		advantage: resolved.advantage,
		problems: [...resolved.problems, ...effectProblems],
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
 */
export const rollsComponent: CardComponent<unknown[]> = {
	key: 'rolls',
	label: 'Rolls',

	render(view) {
		const grid = view.layout === 'grid' ? view.el.createDiv({ cls: 'dicelist-card-content dicelist-roll-grid' }) : null;
		const problemsEl = view.el.createDiv({ cls: 'dicelist-card-content' });
		problemsEl.hide();
		const lines: RollLine[] = [];
		for (const entry of Array.isArray(view.data) ? view.data : []) {
			const roll = parseRoll(entry);
			if (typeof roll === 'string') {
				createCallout(view.el, 'error', roll);
				continue;
			}
			const line: Partial<RollLine> = {};
			Object.assign(line, grid ? gridLine(view, grid, problemsEl, roll, line) : listLine(view, roll, line));
			lines.push(line as RollLine);
		}

		view.refresh(async character => {
			problemsEl.empty();
			for (const line of lines) await refreshLine(view, character, line);
			problemsEl.toggle(problemsEl.childElementCount > 0);
		});
	},
};
