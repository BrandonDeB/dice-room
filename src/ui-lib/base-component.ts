import { MarkdownPostProcessorContext } from "obsidian";

export interface BaseAttributes {
	type: string;
}

export abstract class BaseComponent {
	attributes: BaseAttributes;

	el: HTMLElement;
	ctx: MarkdownPostProcessorContext

	abstract render(): void;

}
