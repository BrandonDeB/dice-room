import { App, AbstractInputSuggest, TextComponent, PluginSettingTab, Setting } from 'obsidian';
import DiceRoomPlugin from './main';
import { TEXTURELIST } from '@3d-dice/dice-box-threejs/src/const/texturelist';
import { MATERIALTYPES} from '@3d-dice/dice-box-threejs/src/const/materialtypes';

export interface DiceRoomPluginSettings {
	serverAddress: string;
	displayName: string;
	frontColor: string;
	backColor: string;
	texture: string;
	material: string;
}

export const DEFAULT_SETTINGS: DiceRoomPluginSettings = {
	serverAddress: 'ws://localhost:8765',
	displayName: 'Anonymous',
	frontColor: '#ffffff',
	backColor: '#000000',
	texture: '',
	material: 'none'
}

export class TextureSuggest extends AbstractInputSuggest<string> {
	inputEl: TextComponent["inputEl"]

    constructor(app: App, inputEl: TextComponent["inputEl"]) {
        super(app, inputEl);
		this.inputEl = inputEl;
    }

    getSuggestions(inputStr: string): string[] {
        const all = Object.keys(TEXTURELIST);
        if (!inputStr) return all;
        return all.filter((t) =>
            t.toLowerCase().includes(inputStr.toLowerCase())
        );
    }

    renderSuggestion(item: string, el: HTMLElement) {
        el.setText(item);
    }

    selectSuggestion(item: string) {
        this.inputEl.value = item;
        this.inputEl.focus();
        this.inputEl.dispatchEvent(
            new Event("input", { bubbles: true, cancelable: true })
        );
    }
}

export class DiceRollSettingTab extends PluginSettingTab {
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
				.setValue(this.plugin.settings.backColor)
				.onChange(async (value) => {
					this.plugin.settings.backColor = value;
				})
			})

		new Setting(containerEl)
			.setName('Dice Foreground Color')
			.setDesc('Text Color on Dice')
			.addColorPicker(value =>  { value
				.setValue(this.plugin.settings.frontColor)
				.onChange(async (value) => {
					this.plugin.settings.frontColor = value;
				})
			})
		
		new Setting(containerEl)
			.setName("Dice Texture")
			.setDesc("Choose a texture to use for new dice color sets")
			.addText((text) => {
				text.setPlaceholder("Search textures…")
					.setValue(this.plugin.settings.texture)
					.onChange(async (value) => {
						this.plugin.settings.texture = value;
						await this.plugin.saveSettings();
					});

				// Attach the suggest
				new TextureSuggest(this.app, text.inputEl);
			});

		new Setting(containerEl)
			.setName("Dice Material")
			.addDropdown((dropdown) => { 
				const materials = Object.keys(MATERIALTYPES);
				materials.forEach(mat => dropdown.addOption(mat, mat));

				dropdown.setValue(this.plugin.settings.material || "none");

				dropdown.onChange(async (value) => {
					this.plugin.settings.material = value;
					await this.plugin.saveSettings();
				});
			});
	}
}
