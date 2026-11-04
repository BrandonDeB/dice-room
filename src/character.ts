import { MarkdownPostProcessorContext, TFile } from "obsidian";
import { parse as yamlParse, parseDocument } from "yaml";
import { getApp } from "./app-provider";
import { getCharacterFiles } from "./utilities";
import { ComponentFactory } from "./ui-lib/base-component";
import { ActionArgs, ActionError, applyYamlSteps } from "./ui-lib/actions";
import { YamlStep } from "./ui-lib/capabilities";

export interface BlockLocation {
	/** Line of the opening ```dicelist fence. */
	lineStart: number;
	/** Line of the closing ``` fence. */
	lineEnd: number;
	type: string;
	/** The block's parsed YAML. */
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
		if (data && typeof data.type === 'string') {
			return { lineStart, lineEnd, type: normalizeType(data.type), data };
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

/** Every block of a type across the character's notes. */
export async function findBlocksOfType<T = Record<string, unknown>>(
	ctx: MarkdownPostProcessorContext,
	type: string,
): Promise<BlockMatch<T>[]> {
	const wanted = normalizeType(type);
	return (await findAllBlocks(ctx))
		.filter(match => match.location.type === wanted) as unknown as BlockMatch<T>[];
}

/** Compare two key values (such as modifier names) ignoring case and spacing. */
export function sameKey(a: unknown, b: unknown): boolean {
	return String(a ?? '').trim().toLowerCase() === String(b ?? '').trim().toLowerCase();
}

/** Look up a component that should appear exactly once for this character. */
export async function findUniqueBlock<T = Record<string, unknown>>(
	ctx: MarkdownPostProcessorContext,
	type: string,
): Promise<UniqueLookup<T>> {
	const matches = await findBlocksOfType<T>(ctx, type);
	if (matches.length === 0) return { status: 'missing' };
	if (matches.length > 1) return { status: 'duplicate', matches };
	return { status: 'found', match: matches[0] };
}

/** A user-facing explanation for a failed unique lookup. */
export function describeLookupProblem(type: string, lookup: UniqueLookup<unknown>): string {
	if (lookup.status === 'missing') return `No ${type} found for this character`;
	if (lookup.status === 'duplicate') {
		const notes = [...new Set(lookup.matches.map(m => m.file.basename))].join(', ');
		return `This character has ${lookup.matches.length} ${type} blocks (in ${notes}). Keep only one.`;
	}
	return '';
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
	const metadata = ComponentFactory.getMetadata(type);
	const handler = metadata?.actions?.[action];
	if (!handler) throw new ActionError(`"${targetType}" has no action named "${action}"`);

	// Types with a targetKey (like modifiers, by name) can have many blocks per
	// character; the action's argument of that name picks which one.
	const key = metadata?.targetKey;
	const wanted = key ? args[key] : undefined;
	if (key && (typeof wanted !== 'string' || wanted.trim() === '')) {
		throw new ActionError(`Missing "${key}" to choose which ${type} to change`);
	}
	const isTarget = (b: BlockLocation) => b.type === type && (!key || sameKey(b.data[key], wanted));

	const matches = (await findBlocksOfType(ctx, type)).filter(m => isTarget(m.location));
	if (matches.length !== 1) {
		const lookup: UniqueLookup = matches.length === 0
			? { status: 'missing' }
			: { status: 'duplicate', matches };
		const what = key ? `${type} named "${wanted}"` : type;
		throw new ActionError(describeLookupProblem(what, lookup));
	}
	const { file, location: hint } = matches[0];

	// Errors thrown inside vault.process are captured and re-thrown after,
	// so a rejected action leaves the file untouched.
	let failure: unknown = null;

	await getApp().vault.process(file, (data) => {
		try {
			const lines = data.split('\n');
			// Normally the block is still where we found it; scan only if the note changed.
			const atHint = readBlock(lines, hint.lineStart, hint.lineEnd);
			const block = atHint && isTarget(atHint)
				? atHint
				: findBlocks(lines).find(isTarget);
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
