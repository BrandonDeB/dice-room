import { HoverParent, HoverPopover, MarkdownPostProcessorContext, MarkdownRenderChild, debounce } from "obsidian";
import { getApp } from "../app-provider";
import { isCharacterFile } from "../utilities";
import { errorMessage, renderBlockError } from "./block-error";
import { Persistable, Rollable } from "./capabilities";
import { ActionMap } from "./actions";
import type { ModifierPublisher } from "../modifiers";

export interface BaseAttributes {
	type: string;
}

export interface TraitMap {
	rollable: Rollable
	persistable: Persistable
}

export type Trait = keyof TraitMap;

/**
 * "unique": at most one block of this type per character.
 * "uniqueModifierNames": no other modifier of the character shares a name with one
 * this block publishes.
 * "uniqueEntryNames": no other block of this type shares an entry name with this one
 * (see `entryNames`), e.g. two consumables both called "Ki points".
 */
export type Policy = "unique" | "uniqueModifierNames" | "uniqueEntryNames";

export interface ComponentMetadata {
	type: string;
	label?: string;
	policies: readonly Policy[] | null;
	actions?: ActionMap;
	targetKey?: string;
	/**
	 * For types holding a list of named entries (like consumables): the names in a
	 * block. Actions pick the block that holds the entry named by their `name`
	 * argument, and the "uniqueEntryNames" policy keeps names unique per character.
	 */
	entryNames?: (attributes: any) => string[];
	modifiers?: ModifierPublisher;
}

export abstract class BaseComponent<T extends BaseAttributes> extends MarkdownRenderChild implements HoverParent {

	/** Lets links in the component show Obsidian's page preview popover. */
	hoverPopover: HoverPopover | null = null;

	static readonly metadata: ComponentMetadata;

	constructor(
		el: HTMLElement,
		protected readonly ctx: MarkdownPostProcessorContext,
		protected readonly attributes: T,
	) {
		super(el);
	}

	abstract render(): void;

	/** This component's display name, shown on its card so its kind is clear. */
	protected get typeLabel(): string {
		const metadata = (this.constructor as ComponentConstructor).metadata;
		if (metadata?.label) return metadata.label;
		const type = metadata?.type ?? this.attributes.type ?? '';
		return type.charAt(0).toUpperCase() + type.slice(1);
	}

	/**
	 * Call `callback` (debounced) whenever any note belonging to this character
	 * changes, e.g. a modifier being switched on in another note. The listener is
	 * removed automatically when the component unloads.
	 */
	protected onCharacterChange(callback: () => void) {
		const refresh = debounce(callback, 250, true);
		this.registerEvent(getApp().metadataCache.on('changed', (file) => {
			if (isCharacterFile(this.ctx, file)) refresh();
		}));
	}

	onload() {
		this.safely(() => this.render());
	}

	/** Run drawing code. If it throws, the block shows the error instead of vanishing. */
	protected safely(draw: () => void) {
		try {
			draw();
		} catch (err) {
			this.showError(err);
		}
	}

	/**
	 * For async work started while drawing (loading stats, resolving modifiers):
	 * if it fails, show the error in the block instead of losing it.
	 */
	protected guard(task: Promise<unknown>) {
		task.catch(err => this.showError(err));
	}

	/** Replace the block's contents with an explanation of what went wrong. */
	protected showError(err: unknown) {
		console.error(err);
		const type = (this.constructor as ComponentConstructor).metadata?.type ?? this.attributes?.type ?? 'dicelist';
		this.containerEl.empty();
		renderBlockError(this.containerEl, `Could not display this ${type} block`, errorMessage(err));
	}

}

export type ComponentConstructor<T extends BaseAttributes = BaseAttributes> = {
	new (
		el: HTMLElement,
		ctx: MarkdownPostProcessorContext,
		attributes: T,
	): BaseComponent<T>;

	metadata: ComponentMetadata;
}


export class ComponentFactory {
	private static registry = new Map<string, ComponentConstructor>();

	static register(component: ComponentConstructor) {
		const type = component.metadata.type.toLowerCase().trim();
		this.registry.set(type, component);
	}

	static getMetadata(type: string): ComponentMetadata | undefined {
		return this.registry.get(type.toLowerCase().trim())?.metadata;
	}

	/** Metadata for every registered component type. */
	static allMetadata(): ComponentMetadata[] {
		return [...this.registry.values()].map(component => component.metadata);
	}

	static create(
		el: HTMLElement,
		ctx: MarkdownPostProcessorContext,
		attributes: BaseAttributes
	) {
		const Component = this.registry.get(attributes.type.toLowerCase().trim());

		if (!Component) return null;

		return new Component(el, ctx, attributes);
	}
}
