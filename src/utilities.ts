import { getApp } from "./app-provider";
import { MarkdownPostProcessorContext, TFile } from "obsidian";
import { parse as yamlParse } from "yaml";

export function getCharacterFiles(ctx: MarkdownPostProcessorContext): TFile[] | null {
	const app = getApp()

	const currentFile = app.vault.getAbstractFileByPath(ctx.sourcePath);

	if (!(currentFile instanceof TFile)) {
		console.warn("Current file not found.");
		return null;
	}

	const currentFM = app.metadataCache.getFileCache(currentFile)?.frontmatter;

	if (!currentFM) return [currentFile];

	const characterFiles = app.vault.getMarkdownFiles().filter(file => {
		const fm = app.metadataCache.getFileCache(file)?.frontmatter
		return fm?.character === currentFM.character
	})

	return characterFiles;

}

export async function getInstancesOfBlock<T>(
    type: string,
	ctx: MarkdownPostProcessorContext
): Promise<T[] | null> {
    const app = getApp();
	const files: TFile[] | null = getCharacterFiles(ctx);
	
	if (files === null) return null;

	let results: T[] = []

	for (const file of files) {

		const text = await app.vault.cachedRead(file);

		const regex = new RegExp(
			"```dicelist\\s*\\r?\\n" +
			"(\\s*type:\\s*" + type + "\\s*\\r?\\n" +
			"[\\s\\S]*?)```",
			"gm"
		);

		for (const match of text.matchAll(regex)) {
			results.push(yamlParse(match[1]) as T);
		}

	}

	return results;

}

export async function getCodeBlock<T>(
    type: string,
	ctx: MarkdownPostProcessorContext
): Promise<T | null> {
	const results = await getInstancesOfBlock<T>(type, ctx);

	if (!results) return null;

	if (results.length > 1) {
		console.warn(`Multiple ${type} blocks found`);
		return null;
	}

	if (results.length === 0) { 
		console.warn(`No ${type} block found`);
		return null;
	}

	return results[0];

}
