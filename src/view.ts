import { ItemView, Notice, WorkspaceLeaf } from 'obsidian';
import { DiceBox, DiceNotation } from '@3d-dice/dice-box-threejs';
import DiceRoomPlugin from "./main";
import { CustomDice } from "./types";
import JoinRoomScreen from "./screens/join-room"
import { ThrownRoll, rollOutcome } from "./roll";

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

	private createDiceBox(user: number, diceSettings: CustomDice, container: HTMLElement) {
		// Pass the element, not a selector, so this works if the view is popped out.
		return new DiceBox(container, {
			theme_customColorset: diceSettings,
			light_intensity: 1,
			gravity_multiplier: 400,
			baseScale: 100,
			strength: 8,
			onRollComplete: (results: { notation: string; total: number }) => {

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

	/**
	 * Stop a dice box and free its WebGL context. Browsers only allow about 16 at once,
	 * so boxes that are dropped without this eventually stop any new one from starting.
	 */
	private destroyRoller(user: number) {
		const roller = this.rollers.get(user);
		if (!roller) return;
		this.rollers.delete(user);
		try {
			// dispose() alone leaves the context for the garbage collector; release it now.
			roller.renderer?.forceContextLoss?.();
			roller.destroy();
		} catch (err) {
			console.error(err);
		}
	}

	private destroyAllRollers() {
		for (const user of [...this.rollers.keys()]) this.destroyRoller(user);
		for (const timeout of this.popupTimeouts.values()) clearTimeout(timeout);
		this.popupTimeouts.clear();
	}

	private removeUser(user: number) {
		this.destroyRoller(user);
		const elem = this.container.querySelector(`#${this.getRollAreaId(user)}`);
		elem?.remove();
	}

	private async createDiceObject(user: {id: number, name: string, die: CustomDice}, rollView: HTMLDivElement) {
		// Someone joining twice replaces their old box instead of leaking it.
		this.removeUser(user.id);
		const ua = rollView.createDiv({cls: "single-roller", attr: {id: this.getRollAreaId(user.id)}});
		ua.createEl("h3", {cls: "player-label", text: user.name});
		this.createPopup(ua, user.id);
		const Box = this.createDiceBox(user.id, user.die, ua);
		try {
			await Box.initialize();
		} catch (err) {
			// Without a renderer the box can't roll; leave it out so rolls don't throw.
			console.error(err);
			ua.createEl("p", { text: `Couldn't show ${user.name}'s dice: ${err instanceof Error ? err.message : String(err)}. Reloading Obsidian frees up 3D views.` });
			new Notice("Couldn't start the 3D dice. Reload Obsidian, then join again.");
			return;
		}
		this.rollers.set(user.id, Box);
	}

	private createDiceObjects(users: {id: number, name: string, die: CustomDice}[]) {
		const rollView = this.container.createDiv({ cls: 'rollView', attr: {id: "scene-container"} });
		users.forEach(user => {
			void this.createDiceObject(user, rollView);
		});
	}

	/** True if connected to a room. Otherwise tells the user to join one. */
	public canRoll(): boolean {
		if (this.ws && this.ws.readyState == WebSocket.OPEN) return true;
		new Notice("Join a room to roll your dice!");
		return false;
	}

	/** Roll for the room. Returns the total, known up front because results are pre-rolled. */
	/** Resolves each of your own rolls, oldest first, once its dice have landed. */
	private landingQueue: (() => void)[] = [];

	/** Your next roll has landed, or can't be shown: let whatever waits on it go ahead. */
	private landNext() {
		this.landingQueue.shift()?.();
	}

	public rollDice(notation: string): ThrownRoll | null {
		const results = new DiceNotation(notation, true);
		if (this.ws && this.ws.readyState == WebSocket.OPEN) {
			this.ws.send(JSON.stringify({
				"type": "roll",
				"user": currentUser,
				"results": results.stringify(true),
				"room":  this.room,
			}));
			// The room sends the roll back, and it's thrown then. Don't wait forever if
			// it never comes, such as when the connection drops.
			const landed = new Promise<void>(resolve => {
				const done = () => { window.clearTimeout(timeout); resolve(); };
				const timeout = window.setTimeout(() => {
					this.landingQueue = this.landingQueue.filter(entry => entry !== done);
					resolve();
				}, 15000);
				this.landingQueue.push(done);
			});
			return { outcome: rollOutcome(results), landed };
		} else {
			new Notice("Join a room to roll your dice!");
			return null;
		}
	}

	public joinRoom(room: string) {
		// Joining again closes the old connection instead of leaving it open.
		this.ws?.close();
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
				const own = String(data.user) === String(currentUser);
				if (roller) {
					roller.roll(notation)
						.catch((err: unknown) => console.error(err))
						.finally(() => { if (own) this.landNext(); });
				} else if (own) {
					this.landNext();
				}
			} else if (data.type == "join") {
				const rollView = document.getElementById('scene-container');
				if (rollView != null && rollView.instanceOf(HTMLDivElement)) {
					void this.createDiceObject(data.user, rollView);
				}
			} else if (data.type == "leave") {
				this.removeUser(data.user);
			} else if (data.type == "join_ack") {
				this.destroyAllRollers();
				this.container.empty();
				const header = this.container.createDiv({cls: 'header'})
				header.createEl('h2', { text: this.room });
				const textInp = header.createEl('input', { text: 'Dice View', type: 'text' });
				const btn = header.createEl('button', { text: 'Roll', type: 'button' });
				const leave = header.createEl('button', { text: 'Leave Room', type: 'button' });
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
					while (this.landingQueue.length > 0) this.landNext();
					this.ws?.close();
					this.destroyAllRollers();
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
		let joinRoomScreen = new JoinRoomScreen(this.container, this)
		joinRoomScreen.render()

	}

	async onClose() {
		this.ws?.close();
		// Also runs when the plugin reloads: free every 3D view so reloads don't use them up.
		this.destroyAllRollers();
	}
}
