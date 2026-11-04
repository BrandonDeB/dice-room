import { MarkdownView, TFile } from "obsidian";
import { getApp } from "./app-provider";

/** The open editor showing this note, if any. */
function openEditor(file: TFile): MarkdownView | null {
	for (const leaf of getApp().workspace.getLeavesOfType('markdown')) {
		const view = leaf.view;
		if (view instanceof MarkdownView && view.file?.path === file.path) return view;
	}
	return null;
}

/**
 * Change a note's text, like `vault.process`. If the note is open, the change goes
 * through its editor and replaces only the text that changed, so the reader's scroll
 * position and cursor stay where they were. Rewriting the whole file instead makes
 * Obsidian reload it, which jumps back to the top.
 */
export async function processFile(file: TFile, change: (data: string) => string): Promise<void> {
	const view = openEditor(file);
	if (!view) {
		await getApp().vault.process(file, change);
		return;
	}
	const editor = view.editor;
	const before = editor.getValue();
	const after = change(before);
	if (after === before) return;

	// Only the part between the unchanged start and unchanged end is replaced.
	let start = 0;
	while (start < before.length && start < after.length && before[start] === after[start]) start++;
	let end = 0;
	while (end < before.length - start && end < after.length - start
		&& before[before.length - 1 - end] === after[after.length - 1 - end]) end++;
	editor.replaceRange(after.slice(start, after.length - end), editor.offsetToPos(start), editor.offsetToPos(before.length - end));
	// Save now, so cards reading the note from disk see the change straight away.
	await view.save();
}
