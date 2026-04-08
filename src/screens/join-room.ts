import { DiceView } from '../view'

export default class JoinRoomScreen {

	container: HTMLElement;
	parent: DiceView;

	constructor(container: HTMLElement, parent: DiceView) {
		this.container = container;
		this.parent = parent
	}


	render() {
		this.container.createEl('h2', { text: 'Join a Room' });
		const textInp = this.container.createEl('input', { text: 'Room Name', type: 'text' });
		const btn = this.container.createEl('button', { text: 'Join', type: 'button' });

		btn.addEventListener('click', () => {
			this.parent.joinRoom(textInp.value);	
		});

		textInp.addEventListener("keypress", function(event) {
			if (event.key === "Enter") {
				event.preventDefault();
				btn.click();
			}
		});
	}
}
