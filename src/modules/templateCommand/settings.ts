import { App, Modal, Notice, Setting, TFolder, normalizePath } from "obsidian";

interface TemplateSettingsPluginApi {
    app: App;
    settings: {
        templateCommand: TemplateCommandSettings;
    };
    saveSettings: () => Promise<void>;
}

class InvalidTemplateFolderModal extends Modal {
    private readonly folderPath: string;

    constructor(app: App, folderPath: string) {
        super(app);
        this.folderPath = folderPath;
    }

    onOpen(): void {
        const { contentEl } = this;
        contentEl.empty();
        contentEl.createEl("h3", { text: "Template folder not found" });
        contentEl.createEl("p", {
            text: `The folder '${this.folderPath}' does not exist in your vault.`,
        });
        contentEl.createEl("p", {
            text: "Create the folder or update Template folder in settings.",
        });
    }

    onClose(): void {
        this.contentEl.empty();
    }
}

function doesTemplateFolderExist(app: App, folderPath: string): boolean {
    const normalized = normalizePath(folderPath.trim()).replace(/\/+$/, "");
    if (!normalized) {
        return false;
    }

    const file = app.vault.getAbstractFileByPath(normalized);
    return file instanceof TFolder;
}

export interface TemplateCommandSettings {
    enabled: boolean;
    trigger: string;
    templateFolder: string;
}

export const DEFAULT_TEMPLATE_COMMAND_SETTINGS: TemplateCommandSettings = {
    enabled: true,
    trigger: "!",
    templateFolder: "templates/",
};

export function normalizeTemplateCommandSettings(
    data: Partial<TemplateCommandSettings> | null | undefined,
): TemplateCommandSettings {
    const rawFolder = (data?.templateFolder ?? DEFAULT_TEMPLATE_COMMAND_SETTINGS.templateFolder).trim();
    const folder = rawFolder.length > 0 ? rawFolder : DEFAULT_TEMPLATE_COMMAND_SETTINGS.templateFolder;
    return {
        enabled: data?.enabled ?? DEFAULT_TEMPLATE_COMMAND_SETTINGS.enabled,
        trigger: (data?.trigger ?? DEFAULT_TEMPLATE_COMMAND_SETTINGS.trigger).slice(0, 1) || DEFAULT_TEMPLATE_COMMAND_SETTINGS.trigger,
        templateFolder: folder,
    };
}

export class TemplateCommandSettingsRenderer {
    private plugin: TemplateSettingsPluginApi;
    private lastWarnedInvalidPath: string | null = null;

    constructor(plugin: TemplateSettingsPluginApi) {
        this.plugin = plugin;
    }

    render(containerEl: HTMLElement): void {
        new Setting(containerEl)
            .setName("Enable template command")
            .setDesc("Turn template command suggestions on or off.")
            .addToggle((toggle) =>
                toggle.setValue(this.plugin.settings.templateCommand.enabled).onChange(async (value) => {
                    this.plugin.settings.templateCommand.enabled = value;
                    await this.plugin.saveSettings();
                }),
            );

        new Setting(containerEl)
            .setName("Trigger symbol")
            .setDesc("One character used to open template suggestions.")
            .addText((text) => {
                text.inputEl.addClass("wop-responsive-input");
                return text
                    .setPlaceholder("!")
                    .setValue(this.plugin.settings.templateCommand.trigger)
                    .onChange(async (value) => {
                        if (value.length > 1) {
                            new Notice("Trigger symbol must be exactly 1 character.");
                        }
                        const next = value.slice(0, 1);
                        if (!next) {
                            return;
                        }
                        if (value !== next) {
                            text.setValue(next);
                        }
                        this.plugin.settings.templateCommand.trigger = next;
                        await this.plugin.saveSettings();
                    });
            });

        new Setting(containerEl)
            .setName("Template folder")
            .setDesc("Folder path to scan for template files. Example: templates/")
            .addText((text) => {
                text.inputEl.addClass("wop-responsive-input");
                return text
                    .setPlaceholder("templates/")
                    .setValue(this.plugin.settings.templateCommand.templateFolder)
                    .onChange(async (value) => {
                        this.plugin.settings.templateCommand.templateFolder = value;
                        await this.plugin.saveSettings();
                        this.warnInvalidFolderOnce(value);
                    });
            });
    }

    private warnInvalidFolderOnce(folderPath: string): void {
        const trimmed = folderPath.trim();
        if (!trimmed) {
            return;
        }

        if (doesTemplateFolderExist(this.plugin.app, trimmed)) {
            this.lastWarnedInvalidPath = null;
            return;
        }

        if (this.lastWarnedInvalidPath === trimmed) {
            return;
        }

        this.lastWarnedInvalidPath = trimmed;
        new InvalidTemplateFolderModal(this.plugin.app, trimmed).open();
    }
}
