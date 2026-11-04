import { MarkdownPostProcessorContext, TFile } from "obsidian";
import { parse as yamlParse, parseDocument } from "yaml";
import { getApp } from "./app-provider";
import { getCharacterFiles } from "./utilities";
import { blockAction, getComponent } from "./ui-lib/component";
import { ActionArgs, ActionDefinition, ActionError, applyStepsToData, applyYamlSteps } from "./ui-lib/actions";
import { YamlStep } from "./ui-lib/capabilities";

export interface BlockLocation {
	lineStart: number;
	lineEnd: number;
	/** The block's `type` tag, lower case, or "" without one. It's only a label. */
	type: string;
	data: Record<string, unknown>;
}

/** A dicelist block found in one of the character's notes. */
export interface BlockMatch<T = Record<string, unknown>> {
	file: TFile;
	location: BlockLocation;
	data: T;
}

/** Result of looking for a component that should exist once per character. */
export type UniqueLookup<T = Record<string, unknown>> =
	| { status: 'found'; match: BlockMatch<T> }
	| { status: 'missing' }
	| { status: 'duplicate'; matches: BlockMatch<T>[] };

export function normalizeType(type: string) {
	return type.toLowerCase().trim();
}

/** Parse the block between two fence lines, or null if it is not a valid dicelist block. */
function readBlock(lines: string[], lineStart: number, lineEnd: number): BlockLocation | null {
	if (!lines[lineStart]?.trim().startsWith('```dicelist')) return null;
	if (lines[lineEnd]?.trim() !== '```') return null;

	try {
		const data = yamlParse(lines.slice(lineStart + 1, lineEnd).join('\n'));
		if (data && typeof data === 'object' && !Array.isArray(data)) {
			return { lineStart, lineEnd, type: typeof data.type === 'string' ? normalizeType(data.type) : '', data };
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

function isFenceLine(line: string | undefined): boolean {
	const trimmed = line?.trim() ?? '';
	return trimmed.startsWith('```') || trimmed.startsWith('~~~');
}

/** All dicelist blocks in one note, using cached positions when they still line up. */
async function blocksInFile(file: TFile): Promise<BlockLocation[]> {
	const ranges = cachedCodeRanges(file);
	// Indexed note with no code blocks: skip it without reading.
	if (ranges && ranges.length === 0) return [];

	const lines = (await getApp().vault.cachedRead(file)).split('\n');

	// If the cache is behind the file, its line numbers will not land on fences.
	if (!ranges || !ranges.every(r => isFenceLine(lines[r.start]) && isFenceLine(lines[r.end]))) {
		return findBlocks(lines);
	}
	return ranges
		.map(r => readBlock(lines, r.start, r.end))
		.filter((b): b is BlockLocation => b !== null);
}

/** Every dicelist block across the character's notes, of any type. */
export async function findAllBlocks(ctx: MarkdownPostProcessorContext): Promise<BlockMatch[]> {
	const matches: BlockMatch[] = [];
	for (const file of getCharacterFiles(ctx) ?? []) {
		for (const location of await blocksInFile(file)) {
			matches.push({ file, location, data: location.data });
		}
	}
	return matches;
}

/** Every block that has a component, such as every block with an `inventory`. */
export async function findBlocksWith(ctx: MarkdownPostProcessorContext, key: string): Promise<BlockMatch[]> {
	return (await findAllBlocks(ctx)).filter(match => hasComponent(match.data, key));
}

/** Whether a block's YAML has this component's key, even if it's empty. */
export function hasComponent(data: Record<string, unknown>, key: string): boolean {
	return Object.prototype.hasOwnProperty.call(data ?? {}, key);
}

/** Compare two key values (such as modifier names) ignoring case and spacing. */
export function sameKey(a: unknown, b: unknown): boolean {
	return String(a ?? '').trim().toLowerCase() === String(b ?? '').trim().toLowerCase();
}

/** A user-facing explanation for a failed unique lookup. */
export function describeLookupProblem(what: string, lookup: UniqueLookup<unknown>): string {
	if (lookup.status === 'missing') return `No ${what} found for this character`;
	if (lookup.status === 'duplicate') {
		const notes = [...new Set(lookup.matches.map(m => m.file.basename))].join(', ');
		return `This character has ${lookup.matches.length} cards with ${what} (in ${notes}). Keep only one.`;
	}
	return '';
}

/** Where an action will run: its definition, and the block it targets. */
interface ActionTarget {
	key: string;
	definition: ActionDefinition;
	file: TFile;
	hint: BlockLocation;
	isTarget: (block: BlockLocation) => boolean;
	before: Record<string, unknown>;
}

/** A note and line to link to, such as the block an action changes. */
export interface BlockTarget {
	file: TFile;
	line: number;
}

/**
 * Find the action and the one block it should change among the character's notes.
 * The target is a component key, like `inventory`. Components holding named entries
 * (consumables, values, modifiers) pick the block holding the entry named by `name`.
 * Shared by previews and real runs, so both pick the same target.
 * Throws ActionError with a user-facing message if that isn't possible.
 */
async function resolveActionTarget(
	ctx: MarkdownPostProcessorContext,
	target: string,
	action: string,
	args: ActionArgs,
): Promise<ActionTarget> {
	const key = target.trim();
	const component = getComponent(key);
	if (!component) throw new ActionError(`There's no component called "${target}"`);
	const definition = blockAction(component, action);
	if (!definition) throw new ActionError(`${component.label} has no action named "${action}"`);

	const entryNames = component.entryNames;
	const wanted = entryNames ? args.name : undefined;
	if (entryNames && (typeof wanted !== 'string' || wanted.trim() === '')) {
		throw new ActionError(`Missing "name" to choose which of the ${component.label.toLowerCase()} to change`);
	}
	const isTarget = (b: BlockLocation) => hasComponent(b.data, key) &&
		(!entryNames || entryNames(b.data[key]).some(name => sameKey(name, wanted)));

	const matches = (await findAllBlocks(ctx)).filter(m => isTarget(m.location));
	if (matches.length !== 1) {
		const lookup: UniqueLookup = matches.length === 0
			? { status: 'missing' }
			: { status: 'duplicate', matches };
		const what = entryNames ? `${component.label.toLowerCase()} named "${wanted}"` : component.label.toLowerCase();
		throw new ActionError(describeLookupProblem(what, lookup));
	}
	const { file, location, data } = matches[0];
	return { key, definition, file, hint: location, isTarget, before: data };
}

/** What an action would do, worked out without changing anything. */
export interface ActionPreview {
	message?: string;
	target: BlockTarget;
}

/**
 * Work out what an action would do, without saving: the same lookup and handler as
 * invokeAction, run on the current data. Throws ActionError if it would be rejected,
 * such as "Not enough Arrows", so rolls can show that before they're made.
 */
export async function previewAction(
	ctx: MarkdownPostProcessorContext,
	targetType: string,
	action: string,
	args: ActionArgs = {},
): Promise<ActionPreview> {
	const target = await resolveActionTarget(ctx, targetType, action, args);
	const steps = target.definition.run(target.before, args);
	const after = applyStepsToData(target.before, steps);
	return {
		message: target.definition.describe?.({ before: target.before, after, args, applied: false }),
		target: { file: target.file, line: target.hint.lineStart },
	};
}

/**
 * Run a component's action on this character, such as `use` on consumables.
 * The target block is located among the character's notes and edited in
 * place, so the target does not need to be open or rendered.
 * Returns the action's announcement, if it has a description, such as
 * "Used 1 of Arrows. 1 left."
 * Throws ActionError with a user-facing message if the action is rejected.
 */
export async function invokeAction(
	ctx: MarkdownPostProcessorContext,
	targetType: string,
	action: string,
	args: ActionArgs = {},
): Promise<string | undefined> {
	const { key, definition, file, hint, isTarget } = await resolveActionTarget(ctx, targetType, action, args);

	// Errors thrown inside vault.process are captured and re-thrown after,
	// so a rejected action leaves the file untouched.
	let failure: unknown = null;
	let message: string | undefined;

	await getApp().vault.process(file, (data) => {
		try {
			const lines = data.split('\n');
			// Normally the block is still where we found it; scan only if the note changed.
			const atHint = readBlock(lines, hint.lineStart, hint.lineEnd);
			const block = atHint && isTarget(atHint)
				? atHint
				: findBlocks(lines).find(isTarget);
			if (!block) throw new ActionError(`No ${key} found for this character`);

			const doc = parseDocument(lines.slice(block.lineStart + 1, block.lineEnd).join('\n'));
			const before = doc.toJS();
			const steps: YamlStep[] = definition.run(before, args);
			if (steps.length === 0) return data;

			applyYamlSteps(doc, steps);
			message = definition.describe?.({ before, after: doc.toJS(), args, applied: true });
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
	return message;
}
