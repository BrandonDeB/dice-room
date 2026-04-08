import { BaseComponent } from "./base-component"
import { DiceNotation, DiceRoll } from "./ui-types";

export interface AttackAttributes {
	type: string;
	name: string | undefined;
	description: string | undefined;
	hitRoll: string;
	damageRoll: string;
	picture: string | undefined;
	range: string | undefined;
}

export abstract class AttackComponent implements BaseComponent {
	container: HTMLDivElement;
	hitRoll: DiceRoll;
	damageRoll: DiceRoll;
	type: string;
	name: string | undefined;
	description: string | undefined;
	picture: string | undefined;
	range: string | undefined;
	onRoll: (notation: string) => void;
	setRollCallback(cb: (notation: string) => void): void {
		this.onRoll = cb;
	}

	constructor(
		el: HTMLElement,
		attributes: AttackAttributes
	) {
		this.hitRoll = new DiceRoll(new DiceNotation(attributes.hitRoll))
		this.damageRoll = new DiceRoll(new DiceNotation(attributes.damageRoll));
		this.name = attributes.name;
		this.description = attributes.description;
		this.picture = attributes.picture;
		this.range = attributes.range;
		this.type = attributes.type;
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

		const toHitContainer = this.container.createDiv({cls: 'drawer-item'})
		toHitContainer.createEl('h4', {text: `To Hit: ${this.hitRoll.toString()}`})
		const toHitButton = toHitContainer.createEl('button', {text: "Roll", type: "button"});
		toHitButton.addEventListener('click', () => {
			this.onRoll(this.hitRoll.toString());
		});

		const damageContainer = this.container.createDiv({cls: 'drawer-item'})
		damageContainer.createEl('h4', {text: `Damage: ${this.damageRoll.toString()}`})
		const damageButton = damageContainer.createEl('button', {text: "Roll"})

		damageButton.addEventListener('click', () => {
			this.onRoll(this.hitRoll.toString());
		});

	}

	abstract render(): void;
}
