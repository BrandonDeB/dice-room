import { HoverParent, Keymap, Menu, Modal, Setting, SettingGroup, TFile, setIcon } from 'obsidian';
import { modifierValue } from '../modifiers';
import type { Advantage, PublishedModifier } from '../modifiers';
import { getApp } from '../app-provider';

/*
 * Building blocks that reuse Obsidian's own components and classes, so dicelist
 * blocks follow the user's theme instead of drawing their own borders and colors.
 */

/**
 * Obsidian's native settings group (SettingGroup, 1.11+): the title is the group's
 * heading above the box, and rows inside are spaced and divided by Obsidian.
 * Returns the box's list element to add Setting rows to. On older Obsidian versions
 * the same structure is built by hand.
 */
export function createSettingGroup(
	parent: HTMLElement,
	title?: string | DocumentFragment,
	cls?: string,
	/** Adds content to the right-hand side of the heading row, such as a picture. */
	decorateHeading?: (controlEl: HTMLElement) => void,
): HTMLDivElement {
	if (typeof SettingGroup === 'function') {
		const group = new SettingGroup(parent);
		if (cls) group.addClass(cls);
		// The group's elements are not in the public typings; their classes are what
		// Obsidian's own styles target, so fall back to looking them up by those.
		const internals = group as unknown as { groupEl?: HTMLElement; listEl?: HTMLDivElement; controlEl?: HTMLElement };
		// Decorate before setting the heading: the heading row is only shown once it
		// has text or content.
		if (decorateHeading && internals.controlEl) decorateHeading(internals.controlEl);
		if (title) group.setHeading(title);
		const groupEl = internals.groupEl ?? (parent.lastElementChild as HTMLElement | null);
		const listEl = internals.listEl ?? groupEl?.querySelector<HTMLDivElement>(':scope > .setting-items');
		if (listEl) return listEl;
	}

	const groupEl = parent.createDiv({ cls: ['setting-group', ...(cls ? [cls] : [])] });
	if (title || decorateHeading) {
		const heading = new Setting(groupEl).setName(title ?? '').setHeading();
		decorateHeading?.(heading.controlEl);
	}
	return groupEl.createDiv({ cls: 'setting-items' });
}

/**
 * A grouped panel for a card: a settings group that fills the note's width. Add
 * Setting rows to the returned element, and wrap other content in an element with
 * the `dicelist-card-content` class so it gets row padding.
 *
 * The heading is the card's name, followed by its `type` tag as a badge (Obsidian's
 * flair style), like "Longbow" then "Weapon". With only a tag, the tag is the heading.
 */
export interface CardOptions {
	/** Adds content to the right of the heading, such as the card's picture. */
	decorateHeading?: (controlEl: HTMLElement) => void;
}

export function createCard(
	parent: HTMLElement,
	title: string | undefined,
	tag: string | undefined,
	options: CardOptions = {},
): HTMLDivElement {
	const heading = title && tag
		? createFragment(fragment => {
			fragment.appendText(title);
			fragment.createSpan({ cls: 'flair dicelist-type', text: tag });
		})
		: (title || tag);
	return createSettingGroup(parent, heading, 'dicelist-card', options.decorateHeading);
}

const CALLOUT_ICONS = { error: 'zap', warning: 'alert-triangle', info: 'info' } as const;

/**
 * An Obsidian callout, as Markdown `> [!error]` would render, so errors and warnings
 * look like the rest of the vault. Returns the content element for extra details.
 */
export function createCallout(
	parent: HTMLElement,
	kind: keyof typeof CALLOUT_ICONS,
	title: string,
	detail?: string,
): HTMLElement {
	const callout = parent.createDiv({ cls: 'callout dicelist-callout', attr: { 'data-callout': kind } });
	const titleEl = callout.createDiv({ cls: 'callout-title' });
	setIcon(titleEl.createDiv({ cls: 'callout-icon' }), CALLOUT_ICONS[kind]);
	titleEl.createDiv({ cls: 'callout-title-inner', text: title });
	const content = callout.createDiv({ cls: 'callout-content' });
	if (detail) content.createEl('p', { text: detail });
	return content;
}

/**
 * Keep a grid's rows even: as many columns as fit (and at most `maxColumns`), then
 * spread the tiles so rows are as full as each other. Six tiles with room for five
 * become two rows of three, not five and one. Updates when the note's width changes.
 */
export function balanceGrid(grid: HTMLElement, owner: { register(cb: () => unknown): void }, maxColumns?: number) {
	const update = () => {
		const count = grid.childElementCount;
		if (count === 0 || grid.clientWidth === 0) return;
		const style = getComputedStyle(grid);
		const fontSize = parseFloat(style.fontSize) || 16;
		const gap = parseFloat(style.columnGap) || 0;
		const tile = (parseFloat(style.getPropertyValue('--dicelist-tile-width')) || 11) * fontSize;
		const fit = Math.max(1, Math.floor((grid.clientWidth + gap) / (tile + gap)));
		const most = Math.min(fit, maxColumns ?? Infinity, count);
		const rows = Math.ceil(count / most);
		grid.setCssProps({ '--dicelist-columns': String(Math.ceil(count / rows)) });
	};
	const observer = new ResizeObserver(() => update());
	observer.observe(grid);
	owner.register(() => observer.disconnect());
	update();
}

/** Hover source id for page previews of dicelist links. Registered in main.ts. */
export const HOVER_SOURCE = 'dice-room';

/**
 * A link to a dicelist block (a note and line), colored like Obsidian's internal links.
 * Clicking opens the note at that block; Ctrl or Cmd click opens it in a new tab;
 * hovering shows the Page preview popover, like other links in the vault.
 *
 * It deliberately avoids the `internal-link` class and an href: Obsidian's own link
 * handling picks those up and would read the href as a section of the current note.
 * It stays keyboard friendly: announced as a link, focusable, and opened with Enter.
 */
export function createBlockLink(
	parent: HTMLElement,
	text: string,
	target: { file: TFile; line: number },
	sourcePath: string,
	hoverParent: HoverParent = { hoverPopover: null },
): HTMLAnchorElement {
	const app = getApp();
	const link = parent.createEl('a', { text, cls: 'dicelist-link', attr: { role: 'link', tabindex: '0' } });
	const open = (event: MouseEvent | KeyboardEvent) => {
		event.preventDefault();
		void app.workspace.openLinkText(target.file.path, sourcePath, Keymap.isModEvent(event), {
			eState: { line: target.line },
		});
	};
	link.addEventListener('click', open);
	link.addEventListener('keydown', (event) => {
		if (event.key === 'Enter') open(event);
	});
	link.addEventListener('mouseover', (event) => {
		app.workspace.trigger('hover-link', {
			event,
			source: HOVER_SOURCE,
			hoverParent,
			targetEl: link,
			linktext: target.file.path,
			sourcePath,
			state: { scroll: target.line },
		});
	});
	return link;
}

/** One line listing modifiers, like "Includes Bless (1d4), Archery (+2)", each linking to where it is set. */
export function renderModifierList(
	parent: HTMLElement,
	label: string,
	modifiers: PublishedModifier[],
	cls: string,
	sourcePath: string,
	hoverParent?: HoverParent,
) {
	if (modifiers.length === 0) return;
	const line = parent.createDiv({ cls, text: `${label} ` });
	modifiers.forEach((modifier, i) => {
		if (i > 0) line.appendText(', ');
		createBlockLink(line, modifier.name, { file: modifier.file, line: modifier.lineStart }, sourcePath, hoverParent);
		line.appendText(` (${modifier.value.valid ? modifier.value.text : modifier.value.raw})`);
	});
}

/** Another way to make a roll, offered on right-click: "Roll with advantage". */
export interface RollChoice {
	title: string;
	onClick: () => void;
}

/** Right-click, or the context menu key, on a roll offers other ways to make it. */
export function addRollMenu(el: HTMLElement, choices: RollChoice[] | (() => RollChoice[])) {
	el.addEventListener('contextmenu', (event: MouseEvent) => {
		event.preventDefault();
		event.stopPropagation();
		const menu = new Menu();
		for (const choice of typeof choices === 'function' ? choices() : choices) menu.addItem(item => item.setTitle(choice.title).onClick(choice.onClick));
		menu.showAtMouseEvent(event);
	});
}

/** Changes a right-click choice makes to a roll. */
export interface RollChange {
	advantage?: Advantage;
	critical?: boolean;
	temporary?: string;
}

/**
 * "Roll with a modifier...": a dialog for this roll only. d20 rolls can also choose
 * advantage or disadvantage; damage rolls can choose a critical hit.
 */
export function modifierChoice(roll: (change: RollChange) => void, kind: 'd20' | 'damage' = 'd20'): RollChoice {
	return { title: 'Roll with a modifier...', onClick: () => new OneRollModal(roll, kind).open() };
}

/** The right-click choices for a d20 roll: advantage, disadvantage, or a modifier for this roll. */
export function rollChoices(roll: (change: RollChange) => void): RollChoice[] {
	return [
		{ title: 'Roll with advantage', onClick: () => roll({ advantage: 'advantage' }) },
		{ title: 'Roll with disadvantage', onClick: () => roll({ advantage: 'disadvantage' }) },
		modifierChoice(roll),
	];
}

/**
 * Right-click choices for any roll: advantage for rolls with a d20, and for other
 * rolls, doubling the dice as for a critical hit.
 */
export function rollMenu(d20: boolean, roll: (change: RollChange) => void): RollChoice[] {
	return d20
		? rollChoices(roll)
		: [{ title: 'Roll critical hit (double the dice)', onClick: () => roll({ critical: true }) }, modifierChoice(roll, 'damage')];
}

/**
 * Choices shown side by side as one control, with one selected, like Disadvantage,
 * Normal and Advantage. They're Obsidian's own buttons, with the selected one
 * highlighted like a dialog's main button, so they follow the theme. For keyboards and
 * screen readers they act as one group of options: Tab reaches the selected one, and
 * arrow keys move the selection.
 */
export function createSegmentedControl(
	parent: HTMLElement,
	label: string,
	options: { value: string; label: string }[],
	selected: string,
	onChange: (value: string) => void,
): HTMLElement {
	const group = parent.createDiv({ cls: 'dicelist-segmented', attr: { role: 'radiogroup', 'aria-label': label } });
	const buttons = options.map(option => group.createEl('button', { text: option.label, attr: { type: 'button', role: 'radio' } }));
	const select = (index: number, focus: boolean) => {
		buttons.forEach((button, i) => {
			const on = i === index;
			button.toggleClass('mod-cta', on);
			button.setAttr('aria-checked', String(on));
			button.tabIndex = on ? 0 : -1;
		});
		if (focus) buttons[index].focus();
		onChange(options[index].value);
	};
	buttons.forEach((button, index) => {
		button.addEventListener('click', () => select(index, false));
		button.addEventListener('keydown', (event: KeyboardEvent) => {
			const step = event.key === 'ArrowRight' || event.key === 'ArrowDown' ? 1
				: event.key === 'ArrowLeft' || event.key === 'ArrowUp' ? -1 : 0;
			if (step === 0) return;
			event.preventDefault();
			select((index + step + buttons.length) % buttons.length, true);
		});
	});
	select(Math.max(0, options.findIndex(option => option.value === selected)), false);
	return group;
}

/**
 * A small native dialog for one roll: an optional modifier, plus advantage or
 * disadvantage (d20 rolls) or a critical hit (damage). Enter rolls; bad values are explained.
 */
class OneRollModal extends Modal {
	constructor(private readonly onRoll: (change: RollChange) => void, private readonly kind: 'd20' | 'damage') {
		super(getApp());
	}

	onOpen() {
		this.setTitle('Roll with a modifier');
		const change: RollChange = {};
		let value = '';
		const error = this.contentEl.createDiv({ cls: 'roll-modifiers roll-problem' });
		const submit = () => {
			if (value.trim() !== '') {
				const parsed = modifierValue(value);
				if (!parsed.valid) {
					error.setText(parsed.reason);
					return;
				}
				change.temporary = value;
			}
			this.close();
			this.onRoll(change);
		};

		new Setting(this.contentEl)
			.setName('Modifier')
			.setDesc('Optional, for this roll only: a number like -4 or dice like 1d4.')
			.addText(text => {
				text.inputEl.setAttr('aria-label', 'Modifier for this roll');
				text.onChange(next => { value = next; error.setText(''); });
				text.inputEl.addEventListener('keydown', event => {
					if (event.key === 'Enter') { event.preventDefault(); submit(); }
				});
				window.setTimeout(() => text.inputEl.focus(), 0);
			});

		if (this.kind === 'd20') {
			const setting = new Setting(this.contentEl).setName('Roll');
			createSegmentedControl(setting.controlEl, 'Roll', [
				{ value: 'disadvantage', label: 'Disadvantage' },
				{ value: '', label: 'Normal' },
				{ value: 'advantage', label: 'Advantage' },
			], '', choice => { change.advantage = (choice || undefined) as Advantage | undefined; });
		} else {
			new Setting(this.contentEl)
				.setName('Critical hit')
				.setDesc('Doubles every damage die.')
				.addToggle(toggle => toggle.onChange(on => { change.critical = on || undefined; }));
		}

		new Setting(this.contentEl)
			.addButton(button => button.setButtonText('Roll').setCta().onClick(submit));
	}

	onClose() {
		this.contentEl.empty();
	}
}

/**
 * Show a vault image on the right of a card's heading, for the card's `decorateHeading`
 * option. `picture` is a path or a wiki link like [[image.png]]. Returns undefined, so
 * nothing is added, if there's no picture or it isn't found.
 */
export function headingPicture(picture: unknown, sourcePath: string, alt: string): ((controlEl: HTMLElement) => void) | undefined {
	if (typeof picture !== 'string' || picture.trim() === '') return undefined;
	const app = getApp();
	const file = app.metadataCache.getFirstLinkpathDest(picture.replace(/\[\[|\]\]/g, ''), sourcePath);
	if (!file) return undefined;
	const src = app.vault.getResourcePath(file);
	return controlEl => {
		const img = controlEl.createEl('img', { cls: 'dicelist-card-image' });
		img.src = src;
		img.alt = alt;
	};
}

/** "+2", "-1", "+0": how a bonus reads on a sheet. */
export function formatBonus(n: number): string {
	return n < 0 ? `${n}` : `+${n}`;
}
