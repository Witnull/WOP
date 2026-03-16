import { Plugin } from "obsidian";
import { MyPluginSettings, WopSettingTab, normalizeSettings } from "./settings";
import { SlashCommandSuggest } from "./modules/slashCommand/slashCommand";
import { VariableParserModule } from "./modules/variableParser/variableParser";
import { TemplateCommandSuggest } from "./modules/templateCommand/templateCommand";
import { MagicWikilinkModule } from "./modules/magicWikilink/magicWikilink";
import { CodeExecutorModule } from "./modules/codeExecutor/codeExecutor";

export default class MyPlugin extends Plugin {
	settings: MyPluginSettings;

	async onload() {
		await this.loadSettings();

		// Register slash command suggestions in markdown editors.
		this.registerEditorSuggest(new SlashCommandSuggest(this));
		this.registerEditorSuggest(new TemplateCommandSuggest(this));
		new VariableParserModule(this).register();
		new MagicWikilinkModule(this).register();
		new CodeExecutorModule(this).register();

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
