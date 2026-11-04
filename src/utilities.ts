import { getApp } from "./app-provider";
import { MarkdownPostProcessorContext, TFile } from "obsidian";

export function getCharacterFiles(ctx: MarkdownPostProcessorContext): TFile[] | null {
	const app = getApp()

	const currentFile = app.vault.getAbstractFileByPath(ctx.sourcePath);

	if (!(currentFile instanceof TFile)) {
		console.warn("Current file not found.");
		return null;
	}

	const currentFM = app.metadataCache.getFileCache(currentFile)?.frontmatter;

	if (currentFM?.character == null) return [currentFile];

	const characterFiles = app.vault.getMarkdownFiles().filter(file => {
		const fm = app.metadataCache.getFileCache(file)?.frontmatter
		return fm?.character === currentFM.character
	})

	return characterFiles;

}

/**
 * True if `file` is one of the notes belonging to the same character as the note
 * being rendered. Cheaper than getCharacterFiles for checking a single file, such
 * as one reported by a metadata change event.
 */
export function isCharacterFile(ctx: MarkdownPostProcessorContext, file: TFile): boolean {
	if (file.path === ctx.sourcePath) return true;
	const app = getApp();
	const current = app.vault.getAbstractFileByPath(ctx.sourcePath);
	if (!(current instanceof TFile)) return false;
	const character = app.metadataCache.getFileCache(current)?.frontmatter?.character;
	if (character == null) return false;
	return app.metadataCache.getFileCache(file)?.frontmatter?.character === character;
}
