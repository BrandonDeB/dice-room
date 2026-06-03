import { BaseComponent } from './base-component'

enum PROFICIENCIES {
	"Acrobatics"
}

export class ProficienyComponent implements BaseComponent {

	type: string;
	container: HTMLDivElement;
	setRollCallback(cb: (notation: string) => void): void {
		this.onRoll = cb;
	}
	onRoll: (notation: string) => void;
	el: HTMLElement;

	constructor(
		el: HTMLElement
	) {
		this.type = 'proficiencies'
		this.el = el;
	}

	render() {
		this.container = this.el.createDiv({
			cls: 'proficiency-container'
		});
	}

}
