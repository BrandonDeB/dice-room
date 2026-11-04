import { MarkdownPostProcessorContext, MarkdownRenderChild, debounce } from "obsidian";
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
 * "uniqueModifierNames": every modifier this block publishes has a name no other
 * modifier of the character uses, whichever component publishes it.
 */
export type Policy = "unique" | "uniqueModifierNames";

export interface ComponentMetadata {
	type: string;
	policies: readonly Policy[] | null;
	actions?: ActionMap;
	targetKey?: string;
	modifiers?: ModifierPublisher;
}

export abstract class BaseComponent<T extends BaseAttributes> extends MarkdownRenderChild {

	static readonly metadata: ComponentMetadata;

	constructor(
		el: HTMLElement,
		protected readonly ctx: MarkdownPostProcessorContext,
		protected readonly attributes: T,
	) {
		super(el);
	}

	abstract render(): void;

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
