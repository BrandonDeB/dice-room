import { WorkspaceLeaf, Notice, Plugin } from 'obsidian';
import { DiceView, VIEW_TYPE_DICE } from './view';
import { DiceRoomPluginSettings, DiceRollSettingTab, DEFAULT_SETTINGS } from './settings';
import { setApp } from './app-provider';
import CodeBlock from './codeblock';
import { registerComponents } from './ui-lib/register';
import { DiceRoller } from './roll';
import { HOVER_SOURCE } from './ui-lib/native';

export default class DiceRoomPlugin extends Plugin {
	settings: DiceRoomPluginSettings;

	getDie() {
		return {
			foreground: this.settings.frontColor,
			background: this.settings.backColor,
			material: this.settings.material,
			texture: this.settings.texture,
			textureOpacity: this.settings.textureOpacity / 100,
		}
	}

	async onload() {
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

		registerComponents();

		// Links in dicelist blocks (e.g. to where a modifier is set) show page previews.
		this.registerHoverLinkSource(HOVER_SOURCE, { display: 'Dice Room', defaultMod: false });

		const getDiceView = () =>
			this.app.workspace.getLeavesOfType(VIEW_TYPE_DICE)[0]?.view as DiceView | undefined;

		const roller: DiceRoller = {
			ready: () => {
				const view = getDiceView();
				if (!view) {
					new Notice("Open the Dice View first!");
					return false;
				}
				return view.canRoll();
			},
			roll: (notation) => getDiceView()?.rollDice(notation),
		};

		this.registerMarkdownCodeBlockProcessor('dicelist', (source, el, ctx) => {
			return new CodeBlock(source, el, ctx, roller).initialize();
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
