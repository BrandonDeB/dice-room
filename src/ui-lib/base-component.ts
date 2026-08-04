import { MarkdownPostProcessorContext } from "obsidian";
import { Rollable } from "./capabilities";

export interface BaseAttributes {
	type: string;
}

export interface TraitMap {
	rollable: Rollable
}

export type Trait = keyof TraitMap;

export type Policy = "unique";

export interface ComponentMetadata {
	type: string;
	policies: readonly Policy[] | null;
}

export abstract class BaseComponent<T extends BaseAttributes> {

	static readonly metadata: ComponentMetadata;

	constructor(
		protected readonly el: HTMLElement,
		protected readonly ctx: MarkdownPostProcessorContext,
		protected readonly attributes: T,
	) {
		this.el = el;
		this.ctx = ctx;
		this.attributes = attributes;
	}

	abstract render(): void;

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
		this.registry.set(component.metadata.type, component);
	}

	static checkPolicies(metadata: ComponentMetadata, el: HTMLElement, ctx: MarkdownPostProcessorContext) {
		// TO-DO implement checking for each policy
		return true
	}

	static create(
		el: HTMLElement,
		ctx: MarkdownPostProcessorContext,
		attributes: BaseAttributes
	) {
		const Component = this.registry.get(attributes.type);

		if (!Component) return null;

		const comp = new Component(el, ctx, attributes)
		this.checkPolicies(Component.metadata, el, ctx);
		comp.render();
	}
}
