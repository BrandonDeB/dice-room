import { MarkdownPostProcessorContext, TFile } from "obsidian";
import { parse as yamlParse, parseDocument } from "yaml";
import { getApp } from "./app-provider";
import { getCharacterFiles } from "./utilities";
import { ComponentFactory } from "./ui-lib/base-component";
import { ActionArgs, ActionError, applyYamlSteps } from "./ui-lib/actions";
import { YamlStep } from "./ui-lib/capabilities";

interface BlockLocation {
	/** Line of the opening ```dicelist fence. */
	lineStart: number;
	/** Line of the closing ``` fence. */
	lineEnd: number;
	type: string;
}

function normalizeType(type: string) {
	return type.toLowerCase().trim();
}

/** Parse the block between two fence lines, or null if it is not a valid dicelist block. */
function readBlock(lines: string[], lineStart: number, lineEnd: number): BlockLocation | null {
	if (!lines[lineStart]?.trim().startsWith('```dicelist')) return null;
	if (lines[lineEnd]?.trim() !== '```') return null;

	try {
		const data = yamlParse(lines.slice(lineStart + 1, lineEnd).join('\n'));
		if (data && typeof data.type === 'string') {
			return { lineStart, lineEnd, type: normalizeType(data.type) };
		}
	} catch {
		// Malformed YAML: not a valid target.
	}
	return null;
}

/** Find every dicelist block in a note by scanning each line. Used only as a fallback. */
export function findBlocks(lines: string[]): BlockLocation[] {
	const blocks: BlockLocation[] = [];

	for (let i = 0; i < lines.length; i++) {
		if (!lines[i].trim().startsWith('```dicelist')) continue;

		let end = i + 1;
		while (end < lines.length && lines[end].trim() !== '```') end++;
		if (end >= lines.length) break;

		const block = readBlock(lines, i, end);
		if (block) blocks.push(block);
		i = end;
	}

	return blocks;
}

/**
 * Code block line ranges from Obsidian's metadata cache, so notes need not be
 * scanned line by line. Returns null when the note has not been indexed yet.
 */
function cachedCodeRanges(file: TFile): { start: number; end: number }[] | null {
	const sections = getApp().metadataCache.getFileCache(file)?.sections;
	if (!sections) return null;
	return sections
		.filter(section => section.type === 'code')
		.map(section => ({ start: section.position.start.line, end: section.position.end.line }));
}

interface Target {
	file: TFile;
	/** Where the block was when found; re-checked before editing. */
	hint: BlockLocation;
}

async function findTarget(ctx: MarkdownPostProcessorContext, type: string): Promise<Target> {
	const app = getApp();
	const files = getCharacterFiles(ctx) ?? [];

	const matches: Target[] = [];
	for (const file of files) {
		const ranges = cachedCodeRanges(file);
		// Indexed note with no code blocks: skip it without reading.
		if (ranges && ranges.length === 0) continue;

		const lines = (await app.vault.cachedRead(file)).split('\n');
		const blocks = ranges
			? ranges.map(r => readBlock(lines, r.start, r.end)).filter((b): b is BlockLocation => b !== null)
			: findBlocks(lines);

		for (const block of blocks) {
			if (block.type === type) matches.push({ file, hint: block });
		}
	}

	if (matches.length === 0) throw new ActionError(`No ${type} found for this character`);
	if (matches.length > 1) throw new ActionError(`This character has more than one ${type}`);
	return matches[0];
}

/**
 * Run an action published by another component type on this character.
 * The target block is located among the character's notes and edited in
 * place, so the target does not need to be open or rendered.
 * Throws ActionError with a user-facing message if the action is rejected.
 */
export async function invokeAction(
	ctx: MarkdownPostProcessorContext,
	targetType: string,
	action: string,
	args: ActionArgs = {},
): Promise<void> {
	const type = normalizeType(targetType);
	const handler = ComponentFactory.getMetadata(type)?.actions?.[action];
	if (!handler) throw new ActionError(`"${targetType}" has no action named "${action}"`);

	const { file, hint } = await findTarget(ctx, type);

	// Errors thrown inside vault.process are captured and re-thrown after,
	// so a rejected action leaves the file untouched.
	let failure: unknown = null;

	await getApp().vault.process(file, (data) => {
		try {
			const lines = data.split('\n');
			// Normally the block is still where we found it; scan only if the note changed.
			const atHint = readBlock(lines, hint.lineStart, hint.lineEnd);
			const block = atHint?.type === type
				? atHint
				: findBlocks(lines).find(b => b.type === type);
			if (!block) throw new ActionError(`No ${type} found for this character`);

			const doc = parseDocument(lines.slice(block.lineStart + 1, block.lineEnd).join('\n'));
			const steps: YamlStep[] = handler(doc.toJS(), args);
			if (steps.length === 0) return data;

			applyYamlSteps(doc, steps);
			lines.splice(
				block.lineStart + 1,
				block.lineEnd - block.lineStart - 1,
				...doc.toString().trimEnd().split('\n'),
			);
			return lines.join('\n');
		} catch (err) {
			failure = err;
			return data;
		}
	});

	if (failure) throw failure;
}
