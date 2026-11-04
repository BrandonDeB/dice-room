import { HoverParent, Keymap, Menu, Modal, Setting, SettingGroup, TFile, setIcon } from 'obsidian';
import { parseModifierValue } from '../modifiers';
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
 * A grouped panel for a dicelist component: a settings group that fills the note's
 * width. Add Setting rows to the returned element, and wrap other content in an
 * element with the `dicelist-card-content` class so it gets row padding.
 *
 * The heading says what kind of component this is. With a title it reads like
 * "Longbow" followed by a "Weapon" badge (Obsidian's flair style); without one, the
 * type label is the heading, like "Inventory".
 */
export interface CardOptions {
	/** Shown under the title in muted text, like a setting's description. */
	description?: string;
	/** Adds content to the right of the heading, such as the component's picture. */
	decorateHeading?: (controlEl: HTMLElement) => void;
}

export function createCard(
	parent: HTMLElement,
	title: string | undefined,
	typeLabel: string,
	options: CardOptions = {},
): HTMLDivElement {
	const { description, decorateHeading } = options;
	const heading = title || description
		? createFragment(fragment => {
			fragment.appendText(title || typeLabel);
			if (title) fragment.createSpan({ cls: 'flair dicelist-type', text: typeLabel });
			if (description) fragment.createDiv({ cls: 'setting-item-description dicelist-card-description', text: description });
		})
		: typeLabel;
	return createSettingGroup(parent, heading, 'dicelist-card', decorateHeading);
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

/** One entry in a grid of roll buttons (abilities, skills). */
export interface RollButton {
	/** Short text on the button, e.g. "STR" or "Stealth". */
	label: string;
	/** The value shown with it, e.g. "+2". */
	value: string;
	/** Read by screen readers and shown as a tooltip, e.g. "Roll Stealth, +2". */
	description: string;
	onClick: () => void;
	/** Other ways to roll it, offered on right-click. */
	menu?: RollChoice[];
}

/**
 * A grid of native Obsidian buttons. Unlike clickable divs, these follow the theme,
 * show hover and focus states, and can be used with the keyboard.
 */
export function createRollButtonGrid(parent: HTMLElement, buttons: RollButton[], cls: string): HTMLElement {
	const grid = parent.createDiv({ cls: `dicelist-card-content dicelist-roll-grid ${cls}` });
	for (const entry of buttons) {
		const button = grid.createEl('button', {
			cls: 'dicelist-roll-button',
			attr: { type: 'button', 'aria-label': entry.description },
		});
		button.createSpan({ cls: 'dicelist-roll-button-label', text: entry.label });
		button.createSpan({ cls: 'dicelist-roll-button-value', text: entry.value });
		button.addEventListener('click', entry.onClick);
		if (entry.menu) addRollMenu(button, entry.menu);
	}
	return grid;
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
export function addRollMenu(el: HTMLElement, choices: RollChoice[]) {
	el.addEventListener('contextmenu', (event: MouseEvent) => {
		event.preventDefault();
		event.stopPropagation();
		const menu = new Menu();
		for (const choice of choices) menu.addItem(item => item.setTitle(choice.title).onClick(choice.onClick));
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
				const parsed = parseModifierValue(value);
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
			new Setting(this.contentEl)
				.setName('Roll')
				.addDropdown(dropdown => dropdown
					.addOption('', 'Normal')
					.addOption('advantage', 'With advantage')
					.addOption('disadvantage', 'With disadvantage')
					.onChange(choice => { change.advantage = (choice || undefined) as Advantage | undefined; }));
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
