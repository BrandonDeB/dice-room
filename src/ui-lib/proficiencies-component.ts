import { BaseComponent } from './base-component'



export class ProficienyComponent implements BaseComponent {

	readonly metadata = {
		type: "proficiency",
		singleton: false,
		rollable: true
	}

	render() {
		this.container = this.el.createDiv({
			cls: 'proficiency-container'
		});
	}

}
