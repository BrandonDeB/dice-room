import { App, WorkspaceLeaf, Notice, Plugin, PluginSettingTab, Setting } from 'obsidian';
import { DiceView, VIEW_TYPE_DICE } from 'view';
import { parse as yamlParse } from "yaml";

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

type YAMLConfig = {
	modifiers: {
		[key: string]: number
	};
	rolls: string[];
};

function collapseAdditions(str: string): string {
    const numbers = str.match(/\b\d+\b/g)?.map(Number) || [];

    if (numbers.length === 0) return str;

    const strWithoutNumbers = str.replace(/\b\d+\b/g, '').replace(/\+\s*\+/g, '+').trim();

    const sum = numbers.reduce((a, b) => a + b, 0);

    return strWithoutNumbers + sum;
}

export default class DiceRoomPlugin extends Plugin {
	settings: DiceRoomPluginSettings;


	async onload() {
		const rollTextEls: HTMLParagraphElement[] = [];
		await this.loadSettings();

		this.registerView(
			VIEW_TYPE_DICE,
			(leaf) => new DiceView(leaf, this)
		);

		this.addRibbonIcon('dice', 'Dice Roller', () => {
			this.activateView();
		});

		this.addSettingTab(new DiceRollSettingTab(this.app, this));

		this.registerMarkdownCodeBlockProcessor('dicelist', (source, el, ctx) => {
			//const lines = source.split('\n').filter(str => str.trim().length > 0);
			//let lineIndex = 0;

			const modWrapper = el.createEl('div', { cls: 'modifier-wrapper' });
			modWrapper.style.display = "flex";
			modWrapper.style.alignItems = "center";
			modWrapper.style.gap = "8px";

			const modifiers = new Map<string, number>();
			const rollTextEls: HTMLParagraphElement[] = [];
			const rollData = yamlParse(source) as YAMLConfig;
			console.log(JSON.stringify(rollData));
			for (const [name, value] of Object.entries(rollData.modifiers)) {
				modifiers.set(name, 0);

				modWrapper.createEl('p', { text: name });

				const toggleContainer = modWrapper.createDiv({ cls: 'checkbox-container' });
				const toggle = toggleContainer.createEl('input', { type: 'checkbox', cls: 'checkbox-input' });
				toggle.style.width = "100%";
				toggle.style.height = "100%";

				toggle.addEventListener('change', () => {
					if (toggle.checked) {
						toggleContainer.classList.add('is-enabled'); 
						modifiers.set(name, value);
					} else {
						toggleContainer.classList.remove('is-enabled');
						modifiers.set(name, 0);
					}

					rollTextEls.forEach(textEl => {
						const originalSource = textEl.getAttribute('data-source')!;
						const name = textEl.getAttribute('data-name')!;
						const updatedText = originalSource.replace(/\{\{\s*([\w-]+)\s*\}\}/g, (match, key) => {
							const modVal = modifiers.get(key);
							return modVal !== undefined ? modVal.toString() : "0";
						});
						textEl.innerHTML = `<strong>${name}:</strong> ${updatedText}`;
					});
				});
			}
			for (const [name, value] of Object.entries(rollData.rolls)) {
				const rollWrapper = el.createEl('div', { cls: 'roll-wrapper' });
				rollWrapper.style.display = "flex";
				rollWrapper.style.alignItems = "center";
				rollWrapper.style.gap = "8px";

				const textEl = rollWrapper.createEl('p', { text: value });
				textEl.setAttribute('data-source', value);
				textEl.setAttribute('data-name', name);
				rollTextEls.push(textEl);

				const parsedText = value.replace(/\{\{\s*([\w-]+)\s*\}\}/g, (match, key) => {
					const value = modifiers.get(key);
					return value !== undefined ? value.toString() : "0";
				});
				textEl.innerHTML = `<strong>${name}:</strong> ${parsedText}`;
				
				const btn = rollWrapper.createEl('button', { text: "Roll", cls: 'roll-me' });
				btn.addEventListener('click', () => {
					const leaves = this.app.workspace.getLeavesOfType(VIEW_TYPE_DICE);
					const currentText = textEl.getAttribute('data-source')!.replace(/\{\{\s*([\w-]+)\s*\}\}/g, (match, key) => {
						const modVal = modifiers.get(key);
						return modVal !== undefined ? modVal.toString() : "0"; // fallback 0
					});

					const backendText = collapseAdditions(currentText);

					if (leaves.length > 0) {
						console.log(`parsedText: ${backendText}`);
						leaves[0].view.rollDice(backendText);
					} else {
						new Notice("Not connected to a room");
					}

				});
			}
			// while (lineIndex < lines.length && (lines[lineIndex].includes(':') || /^\s*$/.test(lines[lineIndex]))) {
			// 	const parts = lines[lineIndex].split(':');
			// 	if (parts.length < 2) { lineIndex++; continue; }
			//
			// 	const name = parts[0].trim();
			// 	const value = Number(parts[1].trim());
			//
			// 	modifiers.set(name, 0);
			//
			// 	modWrapper.createEl('p', { text: lines[lineIndex] });
			//
			// 	const toggleContainer = modWrapper.createDiv({ cls: 'checkbox-container' });
			// 	const toggle = toggleContainer.createEl('input', { type: 'checkbox', cls: 'checkbox-input' });
			// 	toggle.style.width = "100%";
			// 	toggle.style.height = "100%";
			//
			// 	toggle.addEventListener('change', () => {
			// 		if (toggle.checked) {
			// 			toggleContainer.classList.add('is-enabled'); 
			// 			modifiers.set(name, value);
			// 		} else {
			// 			toggleContainer.classList.remove('is-enabled');
			// 			modifiers.set(name, 0);
			// 		}
			//
			// 		rollTextEls.forEach(textEl => {
			// 			const originalSource = textEl.getAttribute('data-source')!;
			// 			const updatedText = originalSource.replace(/\{\{\s*([\w-]+)\s*\}\}/g, (match, key) => {
			// 				const modVal = modifiers.get(key);
			// 				return modVal !== undefined ? modVal.toString() : "0";
			// 			});
			// 			textEl.textContent = updatedText;
			// 		});
			// 	});
			//
			// 	lineIndex++;
			// 	}

			// while (lineIndex < lines.length && (/\d/.test(lines[lineIndex]) || /^\s*$/.test(lines[lineIndex]))) {
			// 	const rollWrapper = el.createEl('div', { cls: 'roll-wrapper' });
			// 	rollWrapper.style.display = "flex";
			// 	rollWrapper.style.alignItems = "center";
			// 	rollWrapper.style.gap = "8px";
			//
			// 	const textEl = rollWrapper.createEl('p', { text: lines[lineIndex] });
			// 	textEl.setAttribute('data-source', lines[lineIndex]);
			// 	rollTextEls.push(textEl);
			//
			// 	const parsedText = lines[lineIndex].replace(/\{\{\s*([\w-]+)\s*\}\}/g, (match, key) => {
			// 		const value = modifiers.get(key);
			// 		return value !== undefined ? value.toString() : "0";
			// 	});
			// 	textEl.textContent = parsedText;
			//
			// 	const btn = rollWrapper.createEl('button', { text: "Roll", cls: 'roll-me' });
			// 	btn.addEventListener('click', () => {
			// 		const leaves = this.app.workspace.getLeavesOfType(VIEW_TYPE_DICE);
			// 		const currentText = textEl.getAttribute('data-source')!.replace(/\{\{\s*([\w-]+)\s*\}\}/g, (match, key) => {
			// 			const modVal = modifiers.get(key);
			// 			return modVal !== undefined ? modVal.toString() : "0"; // fallback 0
			// 		});
			// 		const backendText = collapseAdditions(currentText);
			// 		if (leaves.length > 0) {
			// 			console.log(`parsedText: ${backendText}`);
			// 			leaves[0].view.rollDice(backendText);
			// 		} else {
			// 			new Notice("Not connected to a room");
			// 		}
			// 	});

				//lineIndex++;    
		// 	}
		});


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
