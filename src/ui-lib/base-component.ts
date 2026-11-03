import { MarkdownPostProcessorContext, MarkdownRenderChild } from "obsidian";
import { Persistable, Rollable } from "./capabilities";
import { ActionMap } from "./actions";

export interface BaseAttributes {
	type: string;
}

export interface TraitMap {
	rollable: Rollable
	persistable: Persistable
}

export type Trait = keyof TraitMap;

export type Policy = "unique";

export interface ComponentMetadata {
	type: string;
	policies: readonly Policy[] | null;
	actions?: ActionMap;
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

	onload() {this.render();}

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

	static checkPolicies(metadata: ComponentMetadata, el: HTMLElement, ctx: MarkdownPostProcessorContext) {
		// TO-DO implement checking for each policy
		return true
	}

	static create(
		el: HTMLElement,
		ctx: MarkdownPostProcessorContext,
		attributes: BaseAttributes
	) {
		const Component = this.registry.get(attributes.type.toLowerCase().trim());

		if (!Component) return null;

		const comp = new Component(el, ctx, attributes)
		this.checkPolicies(Component.metadata, el, ctx);

		return comp;
	}
}
