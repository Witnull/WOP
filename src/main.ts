import { Plugin } from "obsidian";
import { DEFAULT_SETTINGS, MyPluginSettings, WopSettingTab, normalizeSettings } from "./settings";
import { SlashCommandSuggest } from "./commands/slashCommand";

export default class MyPlugin extends Plugin {
	settings: MyPluginSettings;

	async onload() {
		await this.loadSettings();

		// Register slash command suggestions in markdown editors.
		this.registerEditorSuggest(new SlashCommandSuggest(this));

		// Add plugin settings UI for triggers and command lists.
		this.addSettingTab(new WopSettingTab(this.app, this));
	}

	onunload() { }

	async loadSettings() {
		const data = (await this.loadData()) as Partial<MyPluginSettings> | null;
		this.settings = normalizeSettings({
			...DEFAULT_SETTINGS,
			...data
		});
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}
