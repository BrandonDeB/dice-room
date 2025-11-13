import { App, WorkspaceLeaf, Modal, Plugin, PluginSettingTab, Setting } from 'obsidian';
import { DiceView, VIEW_TYPE_DICE } from 'view';


interface DiceRoomPluginSettings {
	serverAddress: string;
	displayName: string;
	frontColor: string;
	backColor: string;
}

const DEFAULT_SETTINGS: DiceRoomPluginSettings = {
	serverAddress: 'ws://localhost:8765',
	displayName: 'Anonymous',
	frontColor: '#ffffff',
	backColor: '#000000'
}

export default class DiceRoomPlugin extends Plugin {
	settings: DiceRoomPluginSettings;

	async onload() {
		await this.loadSettings();

		this.registerView(
			VIEW_TYPE_DICE,
			(leaf) => new DiceView(leaf, this)
		);

		this.addRibbonIcon('dice', 'Dice Roller', () => {
			this.activateView();
		});


		this.addCommand({
			id: 'open-sample-modal-simple',
			name: 'Open sample modal (simple)',
			callback: () => {
				new SampleModal(this.app).open();
			}
		});

		this.addSettingTab(new DiceRollSettingTab(this.app, this));

	}

	onunload() {
	}

	async activateView() {
		const { workspace } = this.app;

		let leaf: WorkspaceLeaf | null = null;
		const leaves = workspace.getLeavesOfType(VIEW_TYPE_DICE);


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

class SampleModal extends Modal {
	constructor(app: App) {
		super(app);
	}

	onOpen() {
		const {contentEl} = this;
		contentEl.setText('Woah!');
	}

	onClose() {
		const {contentEl} = this;
		contentEl.empty();
	}
}

class DiceRollSettingTab extends PluginSettingTab {
	plugin: DiceRoomPlugin;

	constructor(app: App, plugin: DiceRoomPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const {containerEl} = this;

		containerEl.empty();

		new Setting(containerEl)
			.setName('Backend Server Address')
			.setDesc('Put address to host')
			.addText(text => text
				.setPlaceholder('Enter the address')
				.setValue(this.plugin.settings.serverAddress)
				.onChange(async (value) => {
					this.plugin.settings.serverAddress = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Display Name')
			.setDesc('The name that will show to other room members')
			.addText(text => text
				.setPlaceholder('Enter your name')
				.setValue(this.plugin.settings.displayName)
				.onChange(async (value) => {
					this.plugin.settings.displayName = value;
				}));

		new Setting(containerEl)
			.setName('Dice Background Color')
			.setDesc('Main color of dice')
			.addColorPicker(value =>  { value
				.setValue(this.plugin.settings.frontColor)
				.onChange(async (value) => {
					this.plugin.settings.frontColor = value;
				})
			})

		new Setting(containerEl)
			.setName('Dice Foreground Color')
			.setDesc('Text Color on Dice')
			.addColorPicker(value =>  { value
				.setValue(this.plugin.settings.backColor)
				.onChange(async (value) => {
					this.plugin.settings.backColor = value;
				})
			})
	}
}
