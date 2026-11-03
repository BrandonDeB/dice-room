import { BaseAttributes, BaseComponent } from "./base-component"
import { DiceNotation } from "./ui-types";
import { getApp } from "./../app-provider"
import { App } from "obsidian";
import { Rollable } from "./capabilities";
import { Roll, RollField, parseRoll } from "../roll";

export interface AttackAttributes extends BaseAttributes {
	type: string;
	name: string | undefined;
	description: string | undefined;
	hitRoll: RollField;
	damageRoll: RollField;
	picture: string | undefined;
	range: string | undefined;
}

export abstract class AttackComponent extends BaseComponent<AttackAttributes> implements Rollable {
	hitRoll: Roll;
	damageRoll: Roll;
	name: string | undefined;
	description: string | undefined;
	picture: string | undefined;
	range: string | undefined;
	app: App; 
	container: HTMLDivElement;
	onRoll: (roll: Roll) => void;
	setRollCallback(cb: (roll: Roll) => void): void {
		this.onRoll = cb;
	}

	renderBase() {
		this.hitRoll = parseRoll(this.attributes.hitRoll) ?? { notation: new DiceNotation('') };
		this.damageRoll = parseRoll(this.attributes.damageRoll) ?? { notation: new DiceNotation('') };

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
		toHitContainer.createEl('h4', {text: `To Hit: ${this.hitRoll.notation.toString()}`})
		const toHitButton = toHitContainer.createEl('button', {text: "Roll", type: "button", cls: "roller-button"});
		toHitButton.addEventListener('click', () => {
			this.onRoll(this.hitRoll);
		});

		const damageContainer = rollContainer.createDiv({cls: 'drawer-item'})
		damageContainer.createEl('h4', {text: `Damage: ${this.damageRoll.notation.toString()}`})
		const damageButton = damageContainer.createEl('button', {text: "Roll", type: "button", cls: "roller-button"})

		damageButton.addEventListener('click', () => {
			this.onRoll(this.damageRoll);
		});

	}

}
