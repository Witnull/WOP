import { Plugin } from "obsidian";
import { MyPluginSettings, WopSettingTab } from "./settings";
import { SlashCommandSuggest } from "./modules/slashCommand/slashCommand";
import { VariableParserModule } from "./modules/variableParser/variableParser";
import { TemplateCommandSuggest } from "./modules/templateCommand/templateCommand";
import { MagicWikilinkModule } from "./modules/magicWikilink/magicWikilink";
import { CodeExecutorModule } from "./modules/codeExecutor/codeExecutor";
import { FileTreeColoringModule } from "./modules/fileTreeColoring/fileTreeColoring";
//import { PerNoteEncryptModule } from "./modules/perNoteEncrypt/perNoteEncrypt";
import { AutoNoteFolderNRenameModule } from "./modules/autoNoteFolderNRename/autoNoteFolderNRename";

export default class MyPlugin extends Plugin {
	settings!: MyPluginSettings;
	fileTreeColoring!: FileTreeColoringModule;
	autoFolderRename!: AutoNoteFolderNRenameModule;



	async onload() {
		await this.loadSettings();
		this.fileTreeColoring = new FileTreeColoringModule(this);
		this.fileTreeColoring.register();
		this.autoFolderRename =new AutoNoteFolderNRenameModule(this);
		this.autoFolderRename.register();

		new SlashCommandSuggest(this).register();
		new TemplateCommandSuggest(this).register();
		new VariableParserModule(this).register();
		new MagicWikilinkModule(this).register();
		new CodeExecutorModule(this).register();

		// Add plugin settings UI for triggers and command lists.
		this.addSettingTab(new WopSettingTab(this.app, this));
	}

	onunload() {
		this.fileTreeColoring?.destroy();
		// this.encryptModule?.destroy();
	}

	async loadSettings() {
		const data = await this.loadData();
		this.settings = data;
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}
