import { getApp } from "./app-provider";
import { MarkdownPostProcessorContext, TFile } from "obsidian";
import { parse as yamlParse } from "yaml";

export function getCharacterFiles(ctx: MarkdownPostProcessorContext): TFile | null {
	const app = getApp()

	const currentFile = app.vault.getAbstractFileByPath(ctx.sourcePath);

	if (!(currentFile instanceof TFile)) {
		console.warn("Current file not found.");
		return null;
	}

	const currentFM = app.metadataCache.getFileCache(currentFile)?.frontmatter;

	if (!currentFM) return null;

	const foundFile = app.vault.getMarkdownFiles().find(file => {
		const fm = app.metadataCache.getFileCache(file)?.frontmatter;
		return fm?.character === currentFM.character;
	});

	if (!foundFile) return null;

	return foundFile;

}

export async function getCodeBlock<T>(
    type: string,
	ctx: MarkdownPostProcessorContext
): Promise<T | null> {
    const app = getApp();
	const file = getCharacterFiles(ctx);
	
	if (!file) return null;

    const text = await app.vault.read(file);

	const regex = new RegExp(
		"```dicelist\\s*\\r?\\n" +
		"\\s*type:\\s*" + type + "\\s*\\r?\\n" +
		"([\\s\\S]*?)```",
		"m"
	);

    const match = regex.exec(text);

    if (!match) {
        console.warn(`No ${type} block found in ${file.path}`);
        return null;
    }

    return yamlParse(match[1]) as T;
}
