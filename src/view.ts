import { ItemView, Notice, WorkspaceLeaf } from 'obsidian';
import { DiceBox, DiceNotation } from '@3d-dice/dice-box-threejs';
import DiceRoomPlugin from "./main";
import { CustomDice } from "./types";

export const VIEW_TYPE_DICE = 'dice-view';
let currentUser = 0;

export class DiceView extends ItemView {
	plugin: DiceRoomPlugin;
	rollers: Map<number, DiceBox>;
	container: HTMLElement;
	ws: WebSocket;
	room: string;
	popupTimeouts: Map<number, NodeJS.Timeout>;
	die: CustomDice;

	constructor(leaf: WorkspaceLeaf, plugin: DiceRoomPlugin) {
		super(leaf);
		this.plugin = plugin;
		this.container = this.contentEl.createDiv({cls: 'dice-parent'})
		this.rollers = new Map();
		this.popupTimeouts = new Map();
	}

	getViewType() {
		return VIEW_TYPE_DICE;
	}


	getDisplayText() {
		return 'Dice View';
	}

	getRollAreaId(user:number) {
		return `roll-area-${user}`;
	}

	getIcon() {
		return "dice"
	}



	createPopup(parent: HTMLDivElement, user: number) {
		const popup = parent.createDiv({cls: 'popup', attr: {id: `popup-${user}`}});
		const closeButton = popup.createEl("span", {text: "×", cls: 'close-btn'});
		const popupText = popup.createEl("p");
		const popupHeader = popup.createEl("h4", {text: "Roll Results"});
		popup.style.display = "none";
		popupText.id = `popup-text-${user}`;
		closeButton.onclick = () => {
			popup.style.display = "none";
		}

		popup.appendChild(closeButton);
		popup.appendChild(popupHeader);
		popup.appendChild(popupText);

		return popup;
	}

	private createDiceBox(user: number, diceSettings: CustomDice) {
		return new DiceBox(`#${this.getRollAreaId(user)}`, {
			theme_customColorset: diceSettings,
			light_intensity: 1,
			gravity_multiplier: 400,
			baseScale: 100,
			strength: 8,
			onRollComplete: (results) => {

				const popupText = document.getElementById(`popup-text-${user}`);
				if (popupText != null) {
					popupText.textContent = `${results.notation}=${results.total}`;
				}
				const userPopup = document.getElementById(`popup-${user}`);
				if (userPopup != null) {
					userPopup.style.display = "block";

					this.popupTimeouts.set(user, setTimeout(() => {
						userPopup.style.display = "none";
						this.popupTimeouts.delete(user);
					}, 10000));
				}
			}
		});

	}

	private removeUser(user: number) {
		let roller = this.rollers.get(user);
		if (roller) {
			this.rollers.delete(user);
		}
		const elem = document.getElementById(this.getRollAreaId(user));
		if (elem && elem.parentElement) {
			elem.parentElement.removeChild(elem);
		}
	}

	private createDiceObject(user: {id: number, name: string, die: CustomDice}, rollView: HTMLDivElement) {
		const ua = rollView.createDiv({cls: "single-roller", attr: {id: this.getRollAreaId(user.id)}});
		ua.createEl("h3", {cls: "player-label", text: user.name});
		this.createPopup(ua, user.id);
		const Box = this.createDiceBox(user.id, user.die);
		Box.initialize();
		this.rollers.set(user.id, Box);
	}

	private createDiceObjects(users: {id: number, name: string, die: CustomDice}[]) {
		const rollView = this.container.createDiv({ cls: 'rollView', attr: {id: "scene-container"} });
		users.forEach(user => {
			this.createDiceObject(user, rollView);
		});
	}

	public rollDice(notation: string) {
		const results = new DiceNotation(notation, true);
		if (this.ws && this.ws.readyState == WebSocket.OPEN) {
			this.ws.send(JSON.stringify({
				"type": "roll",
				"user": currentUser,
				"results": results.stringify(true),
				"room":  this.room,
			}));
		} else {
			new Notice("Join a room to roll your dice!");	
		}
	}

	joinRoom(room: string) {

		this.ws = new WebSocket(`${this.plugin.settings.serverAddress}`);

		this.ws.onopen = (event) => {
			this.ws.send(JSON.stringify({
				"type": "join",
				"name": this.plugin.settings.displayName,
				"room": room,
				"die": this.plugin.getDie(),
			}))
		};

		this.ws.onmessage = (e) => {
			const data = JSON.parse(e.data);

			if (data.type == "roll") {
				const notation = data.results;
				const popup = document.getElementById(`popup-${data.user}`);
				if (popup) popup.style.display = "none";
				if (this.popupTimeouts.has(data.user)) {
					const popupTimeoutID = this.popupTimeouts.get(data.user);
					clearTimeout(popupTimeoutID);
				}
				const roller = this.rollers.get(data.user);
				if (roller) {
					roller.roll(notation);
				}
			} else if (data.type == "join") {
				const rollView = document.getElementById('scene-container');
				if (rollView != null && rollView.instanceOf(HTMLDivElement)) {
					this.createDiceObject(data.user, rollView);
				}
			} else if (data.type == "leave") {
				this.removeUser(data.user);
			} else if (data.type == "join_ack") {
				this.container.empty();
				this.container.createEl('h2', { text: this.room });
				const textInp = this.container.createEl('input', { text: 'Dice View', type: 'text' });
				const btn = this.container.createEl('button', { text: 'Roll', type: 'button' });
				const leave = this.container.createEl('button', { text: 'Leave Room', type: 'button' });
				currentUser = data.user_id;

				btn.addEventListener('click', () => {
					this.rollDice(textInp.value);
				});

				leave.addEventListener('click', () => {
					this.ws.send(JSON.stringify({
						"type": "leave",
						"id": currentUser,
						"room":  this.room,
					}));

					currentUser = 0;
					this.room = "";
					this.ws?.close();
					this.onOpen();

				});

				textInp.addEventListener("keypress", function(event) {
					if (event.key === "Enter") {
						event.preventDefault();
						btn.click();
					}
				});

				requestAnimationFrame(() => {
					this.createDiceObjects(data.users);
				})
			}
		}
		this.room = room;
	}

	async onOpen() {

		this.container.empty();
		this.container.createEl('h2', { text: 'Join a Room' });
		const textInp = this.container.createEl('input', { text: 'Room Name', type: 'text' });
		const btn = this.container.createEl('button', { text: 'Join', type: 'button' });

		btn.addEventListener('click', () => {
			this.joinRoom(textInp.value);
		});

		textInp.addEventListener("keypress", function(event) {
			if (event.key === "Enter") {
				event.preventDefault();
				btn.click();
			}
		});
	}

	async onClose() {
		this.ws?.close();
	}
}
