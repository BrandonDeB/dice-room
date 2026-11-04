import { MarkdownPostProcessorContext, TFile } from "obsidian";
import { parse as yamlParse, parseDocument } from "yaml";
import { BaseComponent, BaseAttributes, ComponentFactory } from "./ui-lib/base-component";
import { Persistable, Rollable, YamlStep } from "./ui-lib/capabilities";
import { getApp } from "./app-provider";
import { applyYamlSteps } from "./ui-lib/actions";
import { DiceRoller, performRoll } from "./roll";
import { PolicyViolation, checkPolicies } from "./ui-lib/policies";
import { errorMessage, renderBlockError } from "./ui-lib/block-error";
import { createBlockLink } from "./ui-lib/native";

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

	/** Show why the component cannot be displayed, linking to each block involved. */
	private renderViolations(violations: PolicyViolation[]) {
		const here = this.ctx.getSectionInfo(this.el)?.lineStart;

		for (const violation of violations) {
			const content = renderBlockError(this.el, violation.message);
			const list = content.createEl('ul');

			for (const { file, location } of violation.blocks) {
				const isThis = file.path === this.ctx.sourcePath && location.lineStart === here;
				const item = list.createEl('li');
				createBlockLink(item, `${file.basename}, line ${location.lineStart + 1}`,
					{ file, line: location.lineStart }, this.ctx.sourcePath);
				if (isThis) item.appendText(' (this block)');
			}
		}
	}

	/** Build the block's component, or show why it can't be built. Never leaves it blank. */
	async initialize() {
		try {
			await this.build();
		} catch (err) {
			console.error(err);
			this.el.empty();
			renderBlockError(this.el, 'Could not display this dicelist block', errorMessage(err));
		}
	}

	private async build() {
		let parsed: unknown;
		try {
			parsed = yamlParse(this.source);
		} catch (err) {
			// The first line has the reason and position; the rest is a text-art pointer.
			renderBlockError(this.el, "This block's YAML can't be read", errorMessage(err).split('\n')[0]);
			return;
		}

		const example = 'For example, start it with: type: inventory';
		if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
			renderBlockError(this.el, 'This dicelist block is empty or not a list of fields', example);
			return;
		}
		const componentData = parsed as BaseAttributes;
		if (typeof componentData.type !== 'string' || componentData.type.trim() === '') {
			renderBlockError(this.el, 'This dicelist block needs a type', example);
			return;
		}

		const metadata = ComponentFactory.getMetadata(componentData.type);
		if (!metadata) {
			const known = ComponentFactory.allMetadata().map(m => m.type).join(', ');
			renderBlockError(this.el, `Unknown component type "${componentData.type}"`, `Available types: ${known}.`);
			return;
		}

		const violations = await checkPolicies(metadata, this.ctx, componentData);
		if (violations.length > 0) {
			this.renderViolations(violations);
			return;
		}

		const component = ComponentFactory.create(this.el, this.ctx, componentData);
		if (!component) {
			renderBlockError(this.el, `Could not create a ${componentData.type} block`);
			return;
		}

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
