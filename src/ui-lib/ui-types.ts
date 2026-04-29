import { TFile } from "obsidian";
import { getApp } from "./app-provider";

export type Dice = {
	sides: number;
}

export class DiceNotation {
	notation: string;

	constructor(notationString: string) {
		this.notation = this.parseNotationString(notationString);
	}

	public parseNotationString(notationString: string): string {
		const app = getApp();
		return notationString.replace(
			/\{\{\s*(.+?)\s*\}\}/g,
			(match, key) => {
				const [fileName, property] = key.split(".");
				const file = app.vault.getAbstractFileByPath(`${fileName}.md`);
				if (!(file instanceof TFile)) return match;
				const cache = app.metadataCache.getFileCache(file);
				const value = cache?.frontmatter?.[property];
				if (value != null) return String(value);
				return match;
			}
		)
	}

	public toString(): string {
		return this.notation;
	}

}
