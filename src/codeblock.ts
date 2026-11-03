import { MarkdownPostProcessorContext, TFile } from "obsidian";
import { parse as yamlParse, parseDocument } from "yaml";
import { BaseComponent, BaseAttributes, ComponentFactory } from "./ui-lib/base-component";
import { Persistable, Rollable, YamlStep } from "./ui-lib/capabilities";
import { getApp } from "./app-provider";
import { applyYamlSteps } from "./ui-lib/actions";
import { DiceRoller, performRoll } from "./roll";

function isRollable(
    component: BaseComponent<any>
): component is BaseComponent<any> & Rollable {
    return typeof (component as any).setRollCallback === "function";
}

function isPersistable(
	component: BaseComponent<any>
): component is BaseComponent<any> & Persistable {
	return typeof (component as any).setPersistCallback === "function";
}

export default class CodeBlock {

	source: string;
	el: HTMLElement;
	ctx: MarkdownPostProcessorContext;
	component: BaseComponent<BaseAttributes>;
	roller: DiceRoller;

	constructor(
		source: string,
		el: HTMLElement,
		ctx: MarkdownPostProcessorContext,
		roller: DiceRoller,
	) {
		this.source = source;
		this.el = el;
		this.ctx = ctx;
		this.roller = roller;
	}

	private applySteps = async (steps: YamlStep[]) => {
		if (steps.length === 0) return;

		const app = getApp();

		const file = app.vault.getAbstractFileByPath(this.ctx.sourcePath);
		if (!(file instanceof TFile)) return;

		const section = this.ctx.getSectionInfo(this.el);
		if (!section) return;

		const { lineStart, lineEnd } = section;

		await app.vault.process(file, (data) => {
			const lines = data.split('\n');

			if (!lines[lineStart]?.startsWith('```dicelist')) return data;

			const doc = parseDocument(lines.slice(lineStart + 1, lineEnd).join('\n'));

			applyYamlSteps(doc, steps);

			lines.splice(
				lineStart + 1,
				lineEnd - lineStart - 1,
				...doc.toString().trimEnd().split('\n')
			);

			return lines.join('\n');
		});
	}

	initialize() {
		const componentData = yamlParse(this.source) as BaseAttributes;
		if (!componentData?.type) return;

		const component = ComponentFactory.create(this.el, this.ctx, componentData);
		if (!component) return;

		this.component = component;

		if (isRollable(this.component)) {
			this.component.setRollCallback((roll) => {
				void performRoll(this.ctx, roll, this.roller);
			});
		}

		if (isPersistable(this.component)) {
			this.component.setPersistCallback(this.applySteps);
		}

		this.ctx.addChild(this.component);
	}
}
