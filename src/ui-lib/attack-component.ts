import { BaseAttributes, BaseComponent } from "./base-component"
import { DiceNotation } from "./ui-types";
import { getApp } from "./../app-provider"
import { App, Setting } from "obsidian";
import { Persistable, Rollable, YamlStep } from "./capabilities";
import { renderPublishedSwitches } from "./published-modifiers";
import { createBlockLink, createCard } from "./native";
import { Roll, RollField, parseRoll } from "../roll";
import { PublishedModifier, normalizeName, resolveRollModifiers } from "../modifiers";

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

/** False for a roll that is missing or just "0", which has nothing to throw. */
function hasDice(roll: Roll): boolean {
	const text = roll.notation.toString().trim();
	return text !== '' && text !== '0';
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

	/** Each roll's settings row, refreshed when modifiers change. */
	private rollLines: { label: string; roll: Roll; setting: Setting }[] = [];

	/** A row for one roll: its total and modifiers on the left, a Roll button on the right. */
	private addRollLine(parent: HTMLElement, label: string, roll: Roll) {
		const setting = new Setting(parent)
			.setName(label)
			.setDesc(roll.notation.toString())
			.addButton(button => button
				.setButtonText('Roll')
				.setTooltip(`Roll ${label.toLowerCase()}`)
				.onClick(() => this.onRoll(roll)));
		this.rollLines.push({ label, roll, setting });
	}

	/** Show each roll's dice with active modifiers included, or why it can't be rolled. */
	private async refreshModifiers() {
		for (const line of this.rollLines) {
			const resolved = await resolveRollModifiers(this.ctx, line.roll);
			const desc = line.setting.descEl;
			desc.empty();
			desc.createDiv({ text: resolved.notation });
			if (resolved.problems.length > 0) {
				desc.createDiv({ cls: 'roll-modifiers roll-problem', text: resolved.problems.join(' ') });
			} else {
				// "Includes Archery (+2)" and "Off: Bless (1d4)". Each name links to where
				// the modifier is set, so it can be previewed and switched on from there.
				this.renderModifierList(desc, 'Includes', resolved.applied, 'roll-modifiers');
				this.renderModifierList(desc, 'Off:', resolved.inactive, 'roll-modifiers roll-modifiers-off');
			}
		}
	}

	/** One line listing modifiers, each name linking to where it is set. */
	private renderModifierList(parent: HTMLElement, label: string, modifiers: PublishedModifier[], cls: string) {
		if (modifiers.length === 0) return;
		const line = parent.createDiv({ cls, text: `${label} ` });
		modifiers.forEach((modifier, i) => {
			if (i > 0) line.appendText(', ');
			createBlockLink(line, modifier.name, { file: modifier.file, line: modifier.lineStart }, this.ctx.sourcePath, this);
			line.appendText(` (${modifier.value.valid ? modifier.value.text : modifier.value.raw})`);
		});
	}

	/** The vault resource path for the `picture` field, or null if there is none or it isn't found. */
	private picturePath(): string | null {
		if (!this.attributes.picture) return null;
		const cleanPath = this.attributes.picture.replace(/\[\[|\]\]/g, "");
		const file = this.app.metadataCache.getFirstLinkpathDest(cleanPath, this.ctx.sourcePath);
		return file ? this.app.vault.getResourcePath(file) : null;
	}

		/** A simple labelled row, like "Range: 150/600 ft". */
	protected addDetailRow(parent: HTMLElement, label: string, value: string) {
		const setting = new Setting(parent).setName(label);
		setting.controlEl.createSpan({ cls: 'dicelist-detail-value', text: value });
	}

	/** Extra rows for a subtype, drawn after range. Spells add casting time and so on. */
	protected renderDetails(card: HTMLElement) {}

	renderBase() {
		// Categories let modifiers like "+1d4 to attacks" apply without being named.
		const kind = normalizeName(this.attributes.type);
		this.hitRoll = parseRoll(this.attributes.hitRoll, ['attack', kind]) ?? { notation: new DiceNotation('') };
		this.damageRoll = parseRoll(this.attributes.damageRoll, ['damage', kind]) ?? { notation: new DiceNotation('') };

		this.app = getApp();
		// The picture sits on the right of the heading, with the title centered beside it.
		const picture = this.picturePath();
		this.container = createCard(this.containerEl, this.attributes.name, this.typeLabel, {
			description: this.attributes.description,
			decorateHeading: picture ? controlEl => {
				const img = controlEl.createEl("img", {cls: "dicelist-card-image"});
				img.src = picture;
				img.alt = this.attributes.name ?? '';
			} : undefined,
		});

		if (this.attributes.range) this.addDetailRow(this.container, 'Range', this.attributes.range);
		this.renderDetails(this.container);

		if (Array.isArray(this.attributes.publishes) && this.attributes.publishes.length > 0) {
			renderPublishedSwitches(this.container, this.attributes, steps => this.onPersist(steps));
		}

		// A spell like Bless has nothing to roll; leave out rolls that are missing or 0.
		this.rollLines = [];
		if (hasDice(this.hitRoll)) this.addRollLine(this.container, 'Hit', this.hitRoll);
		if (hasDice(this.damageRoll)) this.addRollLine(this.container, 'Damage', this.damageRoll);

		this.guard(this.refreshModifiers());
		this.onCharacterChange(() => this.guard(this.refreshModifiers()));
	}


}
