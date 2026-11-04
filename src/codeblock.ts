import { MarkdownPostProcessorContext, TFile } from "obsidian";
import { processFile } from "./file-edit";
import { parse as yamlParse, parseDocument } from "yaml";
import { YamlStep } from "./ui-lib/capabilities";
import { getApp } from "./app-provider";
import { applyYamlSteps } from "./ui-lib/actions";
import { DiceRoller, performRoll } from "./roll";
import { checkPolicies } from "./ui-lib/policies";
import { errorMessage, renderBlockError } from "./ui-lib/block-error";
import { Card } from "./ui-lib/card";
import { loadCharacter } from "./character-data";

export default class CodeBlock {

	source: string;
	el: HTMLElement;
	ctx: MarkdownPostProcessorContext;
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

		await processFile(file, (data) => {
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

	/** Build the block's card, or show why it can't be built. Never leaves it blank. */
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

		if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
			renderBlockError(this.el, 'This dicelist block is empty or not a list of fields', 'For example, start it with: name: Longbow');
			return;
		}
		const data = parsed as Record<string, unknown>;
		const violations = checkPolicies(await loadCharacter(this.ctx), data);

		this.ctx.addChild(new Card(this.el, {
			ctx: this.ctx,
			persist: this.applySteps,
			roll: roll => void performRoll(this.ctx, roll, this.roller),
			lineStart: this.ctx.getSectionInfo(this.el)?.lineStart,
		}, data, violations));
	}
}
