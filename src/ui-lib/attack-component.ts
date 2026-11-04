import { BaseAttributes, BaseComponent } from "./base-component"
import { getApp } from "./../app-provider"
import { App, Setting } from "obsidian";
import { Persistable, Rollable, YamlStep } from "./capabilities";
import { renderPublishedSwitches } from "./published-modifiers";
import { addRollMenu, advantageChoices, createBlockLink, createCard, formatBonus, renderModifierList } from "./native";
import { Roll, RollField, parseRoll, previewEffects } from "../roll";
import { normalizeName, readableNotation, resolveRollModifiers } from "../modifiers";
import { Sheet, d20, loadSheet } from "../sheet";
import { Ability, abilityNamed } from "../abilites";

export interface AttackAttributes extends BaseAttributes {
	type: string;
	name: string | undefined;
	description: string | undefined;
	hitRoll?: RollField;
	damageRoll?: RollField;
	picture: string | undefined;
	range: string | undefined;
	publishes?: unknown;
	/**
	 * Works the rolls out from the character: the ability (a name, or `finesse` for the
	 * better of Strength and Dexterity), whether proficient (default yes), a magic
	 * `bonus`, and the `damage` dice.
	 */
	ability?: string;
	proficient?: boolean;
	bonus?: number;
	damage?: string;
}

/** The ability a weapon or spell uses; `finesse` picks the better of Strength and Dexterity. */
export function attackAbility(sheet: Sheet, spec: unknown): Ability | null {
	if (String(spec ?? '').trim().toLowerCase() === 'finesse') {
		return sheet.abilityModifier('Dexterity') >= sheet.abilityModifier('Strength') ? 'Dexterity' : 'Strength';
	}
	return abilityNamed(spec);
}

/** "+3", "-1", or "" for zero: a bonus to add to dice. */
function plus(n: number): string {
	return n === 0 ? '' : formatBonus(n);
}

/**
 * Combine a YAML roll field with dice worked out from the character. Written dice win;
 * a roll object without dice keeps its effects and modifiers on the worked-out dice.
 */
function withDice(field: RollField | undefined, dice: string | null): unknown {
	if (dice === null) return field;
	if (field === undefined) return dice;
	if (typeof field === 'object' && (field as { dice?: unknown }).dice === undefined) return { ...field, dice };
	return field;
}

/** False for a roll that is missing or just "0", which has nothing to throw. */
function hasDice(roll: Roll): boolean {
	const text = roll.notation.toString().trim();
	return text !== '' && text !== '0';
}

export abstract class AttackComponent extends BaseComponent<AttackAttributes> implements Rollable, Persistable {
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

	/** Each roll's settings row. Its roll is worked out again whenever the row refreshes. */
	private rollLines: { label: string; makeRoll: (sheet: Sheet) => Roll | null; roll?: Roll; setting: Setting; buttonEl?: HTMLElement }[] = [];

	/** A row for one roll: its total and modifiers on the left, a Roll button on the right. */
	private addRollLine(parent: HTMLElement, label: string, makeRoll: (sheet: Sheet) => Roll | null) {
		let buttonEl: HTMLElement | undefined;
		const line = { label, makeRoll, setting: new Setting(parent).setName(label), buttonEl } as AttackComponent['rollLines'][number];
		line.setting.addButton(button => {
			line.buttonEl = button.buttonEl;
			button
				.setButtonText('Roll')
				.setTooltip(`Roll ${label.toLowerCase()}`)
				.onClick(() => { if (line.roll) this.onRoll(line.roll); });
			// Right-click: hit rolls offer advantage; damage offers a critical hit.
			const rollWith = (change: Partial<Roll>) => { if (line.roll) this.onRoll({ ...line.roll, ...change }); };
			addRollMenu(button.buttonEl, label === 'Damage'
				? [{ title: 'Roll critical hit', onClick: () => rollWith({ critical: true }) }]
				: advantageChoices(advantage => rollWith({ advantage })));
		});
		this.rollLines.push(line);
	}

	/** Ability modifier, plus proficiency if proficient, plus the magic bonus. */
	protected attackBonus(sheet: Sheet): number | null {
		const ability = attackAbility(sheet, this.attributes.ability);
		if (!ability) return null;
		const proficiency = this.attributes.proficient === false ? 0 : sheet.proficiencyBonus;
		return sheet.abilityModifier(ability) + proficiency + (this.attributes.bonus ?? 0);
	}

	/** The hit roll: written dice, or a d20 plus the attack bonus. */
	protected hitRollFor(sheet: Sheet): Roll | null {
		const bonus = this.attackBonus(sheet);
		return parseRoll(withDice(this.attributes.hitRoll, bonus === null ? null : d20(bonus)), ['attack', this.kind]);
	}

	/** Damage dice worked out from the character. Weapons add the ability modifier and magic bonus. */
	protected damageDice(sheet: Sheet): string | null {
		const ability = attackAbility(sheet, this.attributes.ability);
		if (!ability || !this.attributes.damage) return null;
		return `${this.attributes.damage}${plus(sheet.abilityModifier(ability) + (this.attributes.bonus ?? 0))}`;
	}

	private get kind(): string {
		return normalizeName(this.attributes.type);
	}

	/** Called on every refresh with the current sheet, for rows that depend on it (like a save DC). */
	protected refreshDetails(sheet: Sheet) {}

	/**
	 * Show each roll's dice with active modifiers included, what its effects will do
	 * ("Uses 1 of Arrows (2 left)"), or why it can't be rolled. Uses the same previews
	 * that performRoll checks, so what's shown is what will happen.
	 */
	private async refreshRollInfo() {
		const sheet = await loadSheet(this.ctx);
		this.refreshDetails(sheet);
		for (const line of this.rollLines) {
			// A spell like Bless has nothing to roll; hide rolls that are missing or 0.
			const roll = line.makeRoll(sheet);
			line.setting.settingEl.toggle(!!roll && hasDice(roll));
			if (!roll || !hasDice(roll)) continue;
			line.roll = roll;

			const resolved = await resolveRollModifiers(this.ctx, roll);
			const effects = await previewEffects(this.ctx, roll);
			const problems = [
				...resolved.problems,
				...effects.map(effect => effect.problem).filter((problem): problem is string => !!problem),
			];

			// Out of what the effects need (no arrows, no spell slots): hide the Roll
			// button until there's enough again. The reason shows in the description.
			const cannotPay = effects.some(effect => effect.problem);
			line.buttonEl?.toggle(!cannotPay);

			const desc = line.setting.descEl;
			desc.empty();
			desc.createDiv({ text: readableNotation(resolved.notation) });
			if (resolved.advantage) desc.createDiv({ cls: 'roll-modifiers', text: `With ${resolved.advantage}` });
			if (problems.length > 0) {
				desc.createDiv({ cls: 'roll-modifiers roll-problem', text: problems.join(' ') });
				continue;
			}
			// "Includes Archery (+2)" and "Off: Bless (1d4)". Each name links to where
			// the modifier is set, so it can be previewed and switched on from there.
			renderModifierList(desc, 'Includes', resolved.applied, 'roll-modifiers', this.ctx.sourcePath, this);
			renderModifierList(desc, 'Off:', resolved.inactive, 'roll-modifiers roll-modifiers-off', this.ctx.sourcePath, this);
			// "Uses 1 of Arrows (2 left)", linking to the block it changes.
			for (const effect of effects) {
				if (!effect.message || !effect.target) continue;
				const effectLine = desc.createDiv({ cls: 'roll-modifiers roll-effect' });
				createBlockLink(effectLine, effect.message, effect.target, this.ctx.sourcePath, this);
			}
		}
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

		// Categories let modifiers like "+1d4 to attacks" apply without being named.
		this.rollLines = [];
		this.addRollLine(this.container, 'Hit', sheet => this.hitRollFor(sheet));
		this.addRollLine(this.container, 'Damage', sheet =>
			parseRoll(withDice(this.attributes.damageRoll, this.damageDice(sheet)), ['damage', this.kind]));

		this.guard(this.refreshRollInfo());
		this.onCharacterChange(() => this.guard(this.refreshRollInfo()));
	}


}
