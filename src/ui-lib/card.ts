import { HoverParent, HoverPopover, MarkdownPostProcessorContext, MarkdownRenderChild, MarkdownRenderer, Notice, debounce } from "obsidian";
import { getApp } from "../app-provider";
import { isCharacterFile } from "../utilities";
import { CharacterData, loadCharacter } from "../character-data";
import { checkSubscriptions, fireEvent } from "../events";
import { Roll } from "../roll";
import { YamlStep } from "./capabilities";
import { CARD_FIELDS, ComponentView, allComponents, componentsOf, underKey } from "./component";
import { PolicyViolation } from "./policies";
import { concentrationEvent } from "./components/modifiers";
import { createBlockLink, createCallout, createCard, headingPicture } from "./native";
import { errorMessage, renderBlockError } from "./block-error";

/** What a card needs from the code block that holds it. */
export interface CardHost {
	ctx: MarkdownPostProcessorContext;
	/** Save YAML edits to this block. */
	persist(steps: YamlStep[]): Promise<void>;
	roll(roll: Roll): void;
	/** The line this block starts on, to mark it in lists of blocks. */
	lineStart: number | undefined;
}

/** "weapon" reads as "Weapon" in the badge; anything else is shown as written. */
function tagLabel(tag: unknown): string | undefined {
	if (typeof tag !== 'string' || tag.trim() === '') return undefined;
	const text = tag.trim();
	return text.charAt(0).toUpperCase() + text.slice(1);
}

/**
 * A dicelist block: a name, a `type` tag, a picture and a Markdown description, then
 * each of its components in the order the YAML lists them.
 */
export class Card extends MarkdownRenderChild implements HoverParent {

	/** Lets links in the card show Obsidian's page preview popover. */
	hoverPopover: HoverPopover | null = null;

	private refreshers: ((character: CharacterData) => void | Promise<void>)[] = [];

	constructor(
		el: HTMLElement,
		private readonly host: CardHost,
		private readonly data: Record<string, unknown>,
		private readonly violations: PolicyViolation[],
	) {
		super(el);
	}

	onload() {
		try {
			this.render();
		} catch (err) {
			this.showError(err);
		}
	}

	private render() {
		const { data } = this;
		const name = typeof data.name === 'string' && data.name.trim() !== '' ? data.name.trim() : undefined;
		const el = createCard(this.containerEl, name, tagLabel(data.type), {
			decorateHeading: headingPicture(data.picture, this.host.ctx.sourcePath, name ?? 'Picture'),
		});

		this.renderViolations(el);
		this.renderWarnings(el);

		if (typeof data.description === 'string' && data.description.trim() !== '') {
			const text = el.createDiv({ cls: 'dicelist-card-content dicelist-card-text' });
			void MarkdownRenderer.render(getApp(), data.description, text, this.host.ctx.sourcePath, this);
		}

		const layout = data.layout === 'grid' ? 'grid' : 'list';
		let grid: HTMLElement | null = null;
		for (const component of componentsOf(data)) {
			if (!component.render) continue;
			const view: ComponentView = {
				el,
				data: data[component.key],
				ctx: this.host.ctx,
				owner: this,
				layout,
				grid: () => grid ??= el.createDiv({ cls: 'dicelist-card-content dicelist-roll-grid' }),
				persist: steps => this.host.persist(underKey(component.key, steps)),
				roll: roll => this.host.roll(roll),
				refresh: update => { this.refreshers.push(update); },
				guard: task => this.guard(task),
				concentrateOn: name => this.concentrateOn(name),
			};
			component.render(view);
		}

		if (this.refreshers.length > 0) {
			this.guard(this.refresh());
			const refresh = debounce(() => this.guard(this.refresh()), 250, true);
			this.registerEvent(getApp().metadataCache.on('changed', file => {
				if (isCharacterFile(this.host.ctx, file)) refresh();
			}));
		}
	}

	/** Load the character once, and give it to every component that shows something from it. */
	private async refresh() {
		const character = await loadCharacter(this.host.ctx);
		for (const update of this.refreshers) await update(character);
	}

	/** Character-wide rules this card breaks, linking to each block involved. */
	private renderViolations(el: HTMLElement) {
		for (const violation of this.violations) {
			const content = createCallout(el, 'error', violation.message);
			const list = content.createEl('ul');
			for (const { file, location } of violation.blocks) {
				const item = list.createEl('li');
				createBlockLink(item, `${file.basename}, line ${location.lineStart + 1}`,
					{ file, line: location.lineStart }, this.host.ctx.sourcePath, this);
				if (file.path === this.host.ctx.sourcePath && location.lineStart === this.host.lineStart) item.appendText(' (this card)');
			}
		}
	}

	/** Fields the card doesn't know, and mistakes in its `on` list. */
	private renderWarnings(el: HTMLElement) {
		const known = new Set<string>([...CARD_FIELDS, ...allComponents().map(component => component.key)]);
		const unknown = Object.keys(this.data).filter(key => !known.has(key));
		if (unknown.length > 0) {
			createCallout(el, 'warning', `Unknown ${unknown.length === 1 ? 'field' : 'fields'}: ${unknown.join(', ')}`,
				`A card can have ${CARD_FIELDS.join(', ')}, and these components: ${allComponents().map(component => component.key).join(', ')}.`);
		}
		const problems = checkSubscriptions(this.data);
		if (problems.length > 0) {
			const content = createCallout(el, 'warning', "Problems with this card's event subscriptions");
			const list = content.createEl('ul');
			for (const problem of problems) list.createEl('li', { text: problem });
		}
	}

	/** Fire the concentration event for `name`, ending other concentration modifiers. */
	private concentrateOn(name: string) {
		this.guard(fireEvent(this.host.ctx, concentrationEvent(name)).then(messages => {
			if (messages.length > 0) new Notice(messages.join(' '));
		}));
	}

	/** For async work: if it fails, show the error in the card instead of losing it. */
	private guard(task: Promise<unknown>) {
		task.catch(err => this.showError(err));
	}

	private showError(err: unknown) {
		console.error(err);
		this.containerEl.empty();
		renderBlockError(this.containerEl, 'Could not display this card', errorMessage(err));
	}
}
