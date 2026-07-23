import { BaseAttributes } from "./base-component"
import { DiceNotation } from "./ui-types";
import { getApp } from "./../app-provider"
import { App, MarkdownPostProcessorContext } from "obsidian";
import { RollableComponent } from "./rollable-component";

export interface AttackAttributes extends BaseAttributes {
	type: string;
	name: string | undefined;
	description: string | undefined;
	hitRoll: string;
	damageRoll: string;
	picture: string | undefined;
	range: string | undefined;
}

export abstract class AttackComponent implements RollableComponent {
	container: HTMLDivElement;
	hitRoll: DiceNotation;
	damageRoll: DiceNotation;
	attributes: AttackAttributes;
	name: string | undefined;
	description: string | undefined;
	picture: string | undefined;
	range: string | undefined;
	app: App; 
	sourcePath: string;
	ctx: MarkdownPostProcessorContext;
	el: HTMLElement;
	onRoll: (notation: string) => void;
	setRollCallback(cb: (notation: string) => void): void {
		this.onRoll = cb;
	}

	constructor(
		el: HTMLElement,
		ctx: MarkdownPostProcessorContext,
		attributes: AttackAttributes
	) {
		this.hitRoll = new DiceNotation(attributes.hitRoll);
		this.damageRoll = new DiceNotation(attributes.damageRoll);
		this.name = attributes.name;
		this.description = attributes.description;
		this.picture = attributes.picture;
		this.range = attributes.range;
		this.el = el;
		this.ctx = ctx;
		
		this.app = getApp();
		this.sourcePath = ctx.sourcePath;

		this.renderBase(el);
	}

	renderBase(el: HTMLElement) {
		this.container = el.createDiv({cls: 'component-container'});
		if (this.name) {
			this.container.createEl('h3', {text: this.name});
		}

		if (this.description) {
			this.container.createEl('p', {text: this.description});
		}

		if (this.range) {
			this.container.createEl('strong', {text: "Range: "})
			this.container.createEl('em', {text: this.range})
		}

		const pictureWithRolls = this.container.createDiv({cls: 'image-rolls'})

		if (this.picture) {
			const cleanPath = this.picture.replace(/\[\[|\]\]/g, "");

			const imgLocation = this.app.metadataCache.getFirstLinkpathDest(
				cleanPath,
				this.sourcePath
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

	abstract render(): void;
}
