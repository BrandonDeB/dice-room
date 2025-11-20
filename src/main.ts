import { WorkspaceLeaf, Notice, Plugin } from 'obsidian';
import { DiceView, VIEW_TYPE_DICE } from './view';
import { parse as yamlParse } from "yaml";
import { DiceRoomPluginSettings, DiceRollSettingTab, DEFAULT_SETTINGS } from './settings';

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

		this.registerView(
			VIEW_TYPE_DICE,
			(leaf) => new DiceView(leaf, this)
		);

		this.addRibbonIcon('dice', 'Dice Roller', () => {
			this.activateView();
		});

		this.addSettingTab(new DiceRollSettingTab(this.app, this));

		this.registerMarkdownCodeBlockProcessor('dicelist', (source, el, ctx) => {

			const modHeader = el.createEl("h1", {text: "Modifiers"});
			const modWrapper = el.createEl('div', { cls: 'modifier-wrapper' });
			modWrapper.style.display = "flex";
			modWrapper.style.alignItems = "center";
			modWrapper.style.gap = "8px";

			const modifiers = new Map<string, number>();
			const rollTextEls: HTMLParagraphElement[] = [];
			const rollData = yamlParse(source) as YAMLConfig;
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
			el.createEl("h1", {text: "Rolls"});
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
						leaves[0].view.rollDice(backendText);
					} else {
						new Notice("Open the rolling menu and join a room!");
					}

				});
			}
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
