import { WorkspaceLeaf, Notice, Plugin } from 'obsidian';
import { DiceView, VIEW_TYPE_DICE } from './view';
import { DiceRoomPluginSettings, DiceRollSettingTab, DEFAULT_SETTINGS } from './settings';
import { setApp } from './ui-lib/app-provider';
import CodeBlock from './codeblock';

export default class DiceRoomPlugin extends Plugin {
	settings: DiceRoomPluginSettings;

	getDie() {
		return {
			foreground: this.settings.frontColor,
			background: this.settings.backColor,
			material: this.settings.material,
			texture: this.settings.texture
		}
	}

	async onload() {
		const rollTextEls: HTMLParagraphElement[] = [];
		await this.loadSettings();
		setApp(this.app);

		this.registerView(
			VIEW_TYPE_DICE,
			(leaf) => new DiceView(leaf, this)
		);

		this.addRibbonIcon('dice', 'Dice Roller', () => {
			this.activateView();
		});

		this.addSettingTab(new DiceRollSettingTab(this.app, this));

		this.registerMarkdownCodeBlockProcessor('dicelist', (source, el, ctx) => {
			const rollFn = (notation: string) => {
				const leaves =this.app.workspace.getLeavesOfType(VIEW_TYPE_DICE);
				const view = leaves[0]?.view as DiceView | undefined;
				if (view) view.rollDice(notation);
				else new Notice("Open the Dice View first!");
			};
			let codeblock = new CodeBlock(source, el, ctx, rollFn);
			codeblock.initialize();
		});
	}

	onunload() {

	}

	async activateView() {
		const { workspace } = this.app;

		let leaf: WorkspaceLeaf | null = null; const leaves = workspace.getLeavesOfType(VIEW_TYPE_DICE);

		if (leaves.length > 0) {

			leaf = leaves[0];
			leaf.detach();
		} else {

			leaf = workspace.getRightLeaf(false);
			if (leaf != null) {
				await leaf.setViewState({ type: VIEW_TYPE_DICE, active: true });
				workspace.revealLeaf(leaf);
			}
		}
	}


	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}
