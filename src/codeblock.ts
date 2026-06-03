import { MarkdownPostProcessorContext } from "obsidian";
import { parse as yamlParse } from "yaml";
import { WeaponComponent, WeaponAttributes } from "./ui-lib/weapon-component";
import { SpellComponent, SpellAttributes } from "./ui-lib/spell-component";
import { StatsComponent, StatAttributes } from "./ui-lib/stats-component";
import { BaseComponent, BaseAttributes } from "./ui-lib/base-component";

const UITypes = {
	WEAPON: "weapon",
	CHARACTER: "character",
	SPELL: "spell",
	STATS: "stats",
}

export default class CodeBlock {

	source: string;
	el: HTMLElement;
	ctx: MarkdownPostProcessorContext;
	component: BaseComponent;
	onRoll: (notation: string) => void;

	constructor(
		source: string,
		el: HTMLElement,
		ctx: MarkdownPostProcessorContext,
		onRoll: (notation: string) => void,	
	) {
		this.source = source;
		this.el = el;
		this.ctx = ctx;
		this.onRoll = onRoll;
	}

	initialize() {
		const componentData = yamlParse(this.source) as BaseAttributes;
		if (!componentData?.type) return;
		const uiType = componentData.type.toLowerCase().trim();
		switch (uiType) {
			case UITypes.WEAPON:
				const weaponData = yamlParse(this.source) as WeaponAttributes;
				this.component = new WeaponComponent(
					this.el,
					weaponData,
				);
			break;
			case UITypes.SPELL:
				const spellData = yamlParse(this.source) as SpellAttributes;
				this.component = new SpellComponent(
					this.el,
					spellData,
				);
			break;
			case UITypes.STATS:
				const statData = yamlParse(this.source) as StatAttributes;
				this.component = new StatsComponent(
					this.el,
					statData,
				);
			break;
			default:
				return;
		}
		this.component.setRollCallback(this.onRoll)
		this.component.render();
	}
}
