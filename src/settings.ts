import { App, PluginSettingTab } from "obsidian";
import type MyPlugin from "./main";
import {
    DEFAULT_SLASH_SETTINGS,
    normalizeSlashSettings,
    SlashModuleSettings,
    SlashModuleSettingsRenderer,
    TriggerGroupConfig,
} from "./modules/slashCommand/settings";
import {
    DEFAULT_VARIABLE_PARSER_SETTINGS,
    normalizeVariableParserSettings,
    VariableParserSettings,
    VariableParserSettingsRenderer,
} from "./modules/variableParser/settings";
import {
    DEFAULT_TEMPLATE_COMMAND_SETTINGS,
    normalizeTemplateCommandSettings,
    TemplateCommandSettings,
    TemplateCommandSettingsRenderer,
} from "./modules/templateCommand/settings";

const MODULE_SLASH = "slash";
const MODULE_VARIABLE_PARSER = "variable-parser";
const MODULE_TEMPLATE_COMMAND = "template-command";

type ModuleId = typeof MODULE_SLASH | typeof MODULE_VARIABLE_PARSER | typeof MODULE_TEMPLATE_COMMAND;

interface LegacySettingsShape {
    enabled?: boolean;
    triggerGroups?: TriggerGroupConfig[];
    variableParser?: Partial<VariableParserSettings>;
    templateCommand?: Partial<TemplateCommandSettings>;
}

export interface MyPluginSettings {
    slash: SlashModuleSettings;
    variableParser: VariableParserSettings;
    templateCommand: TemplateCommandSettings;
}

export const DEFAULT_SETTINGS: MyPluginSettings = {
    slash: DEFAULT_SLASH_SETTINGS,
    variableParser: DEFAULT_VARIABLE_PARSER_SETTINGS,
    templateCommand: DEFAULT_TEMPLATE_COMMAND_SETTINGS,
};

export function normalizeSettings(data: Partial<MyPluginSettings> | LegacySettingsShape | null | undefined): MyPluginSettings {
    const legacy = data as LegacySettingsShape | undefined;
    const maybeNew = data as Partial<MyPluginSettings> | undefined;

    const slashData = maybeNew?.slash ??
        ((legacy?.enabled !== undefined || legacy?.triggerGroups !== undefined)
            ? { enabled: legacy.enabled, triggerGroups: legacy.triggerGroups }
            : undefined);

    return {
        slash: normalizeSlashSettings(slashData),
        variableParser: normalizeVariableParserSettings(maybeNew?.variableParser ?? legacy?.variableParser),
        templateCommand: normalizeTemplateCommandSettings(maybeNew?.templateCommand ?? legacy?.templateCommand),
    };
}

export class WopSettingTab extends PluginSettingTab {
    plugin: MyPlugin;
    private activeModuleId: ModuleId = MODULE_SLASH;
    private readonly slashRenderer: SlashModuleSettingsRenderer;
    private readonly variableRenderer: VariableParserSettingsRenderer;
    private readonly templateRenderer: TemplateCommandSettingsRenderer;

    constructor(app: App, plugin: MyPlugin) {
        super(app, plugin);
        this.plugin = plugin;
        this.slashRenderer = new SlashModuleSettingsRenderer(plugin);
        this.variableRenderer = new VariableParserSettingsRenderer(plugin);
        this.templateRenderer = new TemplateCommandSettingsRenderer(plugin);
    }

    display(): void {
        const { containerEl } = this;

        containerEl.empty();
        containerEl.createEl("h2", { text: "Settings" });

        const moduleTabsEl = containerEl.createDiv({ cls: "wop-module-tabs" });
        const slashModuleButton = moduleTabsEl.createEl("button", {
            text: "/ Slash commands",
            cls: "wop-module-tab",
        });
        const variableParserButton = moduleTabsEl.createEl("button", {
            text: "* Variable parser",
            cls: "wop-module-tab",
        });
        const templateCommandButton = moduleTabsEl.createEl("button", {
            text: "! Templates importer",
            cls: "wop-module-tab",
        });
        if (this.activeModuleId === MODULE_SLASH) {
            slashModuleButton.addClass("is-active");
        }
        if (this.activeModuleId === MODULE_VARIABLE_PARSER) {
            variableParserButton.addClass("is-active");
        }
        if (this.activeModuleId === MODULE_TEMPLATE_COMMAND) {
            templateCommandButton.addClass("is-active");
        }

        slashModuleButton.addEventListener("click", () => {
            this.activeModuleId = MODULE_SLASH;
            this.display();
        });

        variableParserButton.addEventListener("click", () => {
            this.activeModuleId = MODULE_VARIABLE_PARSER;
            this.display();
        });

        templateCommandButton.addEventListener("click", () => {
            this.activeModuleId = MODULE_TEMPLATE_COMMAND;
            this.display();
        });

        containerEl.createEl("hr", { cls: "wop-section-divider" });

        const modulePanelEl = containerEl.createDiv({ cls: "wop-module-panel" });
        if (this.activeModuleId === MODULE_SLASH) {
            this.slashRenderer.render(modulePanelEl, () => this.display());
        } else if (this.activeModuleId === MODULE_VARIABLE_PARSER) {
            this.variableRenderer.render(modulePanelEl, () => this.display());
        } else {
            this.templateRenderer.render(modulePanelEl);
        }
    }
}
