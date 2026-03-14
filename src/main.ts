import { Plugin } from "obsidian";
import { MyPluginSettings, WopSettingTab, normalizeSettings } from "./settings";
import { SlashCommandSuggest } from "./modules/slashCommand/slashCommand";
import { VariableParserModule } from "./modules/variableParser/variableParser";

export default class MyPlugin extends Plugin {
	settings: MyPluginSettings;

	async onload() {
		await this.loadSettings();

		// Register slash command suggestions in markdown editors.
		this.registerEditorSuggest(new SlashCommandSuggest(this));
		new VariableParserModule(this).register();

		// Add plugin settings UI for triggers and command lists.
		this.addSettingTab(new WopSettingTab(this.app, this));
	}

	onunload() { }

	async loadSettings() {
		const data = (await this.loadData()) as Partial<MyPluginSettings> | null;
		this.settings = normalizeSettings(data);
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}
