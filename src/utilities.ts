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
