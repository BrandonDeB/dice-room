import { BaseAttributes, BaseComponent } from "./base-component"
import { DiceNotation } from "./ui-types";
import { getApp } from "./../app-provider"
import { App } from "obsidian";
import { Persistable, Rollable, YamlStep } from "./capabilities";
import { renderPublishedSwitches } from "./published-modifiers";
import { Roll, RollField, parseRoll } from "../roll";
import { normalizeName, resolveRollModifiers } from "../modifiers";

export interface AttackAttributes extends BaseAttributes {
	type: string;
	name: string | undefined;
	description: string | undefined;
	hitRoll: RollField;
	damageRoll: RollField;
	picture: string | undefined;
	range: string | undefined;
	publishes?: unknown;
}

export abstract class AttackComponent extends BaseComponent<AttackAttributes> implements Rollable, Persistable {
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

	onPersist: (steps: YamlStep[]) => Promise<void>;
	setPersistCallback(cb: (steps: YamlStep[]) => Promise<void>): void {
		this.onPersist = cb;
	}

	/** Each roll's heading and modifier line, refreshed when modifiers change. */
	private rollLines: { label: string; roll: Roll; heading: HTMLElement; detail: HTMLElement }[] = [];

	private addRollLine(parent: HTMLElement, label: string, roll: Roll) {
		const row = parent.createDiv({cls: 'drawer-item'});
		const text = row.createDiv({cls: 'roll-text'});
		const heading = text.createEl('h4', {text: `${label}: ${roll.notation.toString()}`});
		const detail = text.createDiv({cls: 'roll-modifiers'});
		const button = row.createEl('button', {text: "Roll", type: "button", cls: "roller-button"});
		button.addEventListener('click', () => this.onRoll(roll));
		this.rollLines.push({ label, roll, heading, detail });
	}

	/** Show each roll's dice with active modifiers included, or why it can't be rolled. */
	private async refreshModifiers() {
		for (const line of this.rollLines) {
			const resolved = await resolveRollModifiers(this.ctx, line.roll);
			line.heading.setText(`${line.label}: ${resolved.notation}`);
			line.detail.toggleClass('roll-problem', resolved.problems.length > 0);
			if (resolved.problems.length > 0) {
				line.detail.setText(resolved.problems.join(' '));
			} else if (resolved.applied.length > 0) {
				line.detail.setText('Includes ' + resolved.applied.map(m => `${m.name} (${m.value.text})`).join(', '));
			} else {
				line.detail.setText('');
			}
		}
	}

	renderBase() {
		const kind = normalizeName(this.attributes.type);
		this.hitRoll = parseRoll(this.attributes.hitRoll, ['attack', kind]) ?? { notation: new DiceNotation('') };
		this.damageRoll = parseRoll(this.attributes.damageRoll, ['damage', kind]) ?? { notation: new DiceNotation('') };

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

		if (Array.isArray(this.attributes.publishes) && this.attributes.publishes.length > 0) {
			const switches = this.container.createDiv({cls: 'published-modifiers'});
			renderPublishedSwitches(switches, this.attributes, steps => this.onPersist(steps));
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

		this.rollLines = [];
		this.addRollLine(rollContainer, 'To Hit', this.hitRoll);
		this.addRollLine(rollContainer, 'Damage', this.damageRoll);

		this.guard(this.refreshModifiers());
		this.onCharacterChange(() => this.guard(this.refreshModifiers()));

	}

}
