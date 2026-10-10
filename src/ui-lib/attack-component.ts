import { BaseAttributes, BaseComponent } from "./base-component"
import { DiceNotation } from "./ui-types";
import { getApp } from "./../app-provider"
import { App } from "obsidian";
import { Rollable } from "./capabilities";

export interface AttackAttributes extends BaseAttributes {
	type: string;
	name: string | undefined;
	description: string | undefined;
	hitRoll: string;
	damageRoll: string;
	picture: string | undefined;
	range: string | undefined;
}

export abstract class AttackComponent extends BaseComponent<AttackAttributes> implements Rollable {
	hitRoll: DiceNotation;
	damageRoll: DiceNotation;
	name: string | undefined;
	description: string | undefined;
	picture: string | undefined;
	range: string | undefined;
	app: App; 
	container: HTMLDivElement;
	onRoll: (notation: string) => void;
	setRollCallback(cb: (notation: string) => void): void {
		this.onRoll = cb;
	}

	renderBase() {
		this.hitRoll = new DiceNotation(this.attributes.hitRoll);
		this.damageRoll = new DiceNotation(this.attributes.damageRoll);

		this.app = getApp();
		this.container = this.containerEl.createDiv({cls: 'component-container'});
		if (this.attributes.name) {
			this.container.createEl('h3', {text: this.attributes.name});
		}

		if (this.attributes.description) {
			this.container.createEl('p', {text: this.attributes.description});
		}

		if (this.attributes.range) {
			this.container.createEl('strong', {text: "Range: "})
			this.container.createEl('em', {text: this.attributes.range})
		}

		const pictureWithRolls = this.container.createDiv({cls: 'image-rolls'})

		if (this.attributes.picture) {
			const cleanPath = this.attributes.picture.replace(/\[\[|\]\]/g, "");

			const imgLocation = this.app.metadataCache.getFirstLinkpathDest(
				cleanPath,
				this.ctx.sourcePath
			);

			if (imgLocation) {
				const img = pictureWithRolls.createEl("img", {cls: "attack-img"});
				img.src = this.app.vault.getResourcePath(imgLocation);
			}
		}

		const rollContainer = pictureWithRolls.createDiv({cls: 'roll-components'})

		const toHitContainer = rollContainer.createDiv({cls: 'drawer-item'})
		toHitContainer.createEl('h4', {text: `To Hit: ${this.hitRoll.toString()}`})
		const toHitButton = toHitContainer.createEl('button', {text: "Roll", type: "button", cls: "roller-button"});
		toHitButton.addEventListener('click', () => {
			this.onRoll(this.hitRoll.toString());
		});

		const damageContainer = rollContainer.createDiv({cls: 'drawer-item'})
		damageContainer.createEl('h4', {text: `Damage: ${this.damageRoll.toString()}`})
		const damageButton = damageContainer.createEl('button', {text: "Roll", type: "button", cls: "roller-button"})

		damageButton.addEventListener('click', () => {
			this.onRoll(this.damageRoll.toString());
		});

	}

}
