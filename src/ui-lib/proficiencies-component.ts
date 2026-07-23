import { MarkdownPostProcessorContext } from 'obsidian';
import { BaseComponent } from './base-component'

export class ProficienyComponent implements BaseComponent {

	type: string;
	ctx: MarkdownPostProcessorContext;
	container: HTMLDivElement;
	setRollCallback(cb: (notation: string) => void): void {
		this.onRoll = cb;
	}
	onRoll: (notation: string) => void;
	el: HTMLElement;

	constructor(
		el: HTMLElement,
		ctx: MarkdownPostProcessorContext
	) {
		this.type = 'proficiencies'
		this.ctx = ctx;
		this.el = el;
	}

	render() {
		this.container = this.el.createDiv({
			cls: 'proficiency-container'
		});
	}

}
