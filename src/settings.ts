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

const MODULE_SLASH = "slash";
const MODULE_VARIABLE_PARSER = "variable-parser";

type ModuleId = typeof MODULE_SLASH | typeof MODULE_VARIABLE_PARSER;

interface LegacySettingsShape {
    enabled?: boolean;
    triggerGroups?: TriggerGroupConfig[];
    variableParser?: Partial<VariableParserSettings>;
}

export interface MyPluginSettings {
    slash: SlashModuleSettings;
    variableParser: VariableParserSettings;
}

export const DEFAULT_SETTINGS: MyPluginSettings = {
    slash: DEFAULT_SLASH_SETTINGS,
    variableParser: DEFAULT_VARIABLE_PARSER_SETTINGS,
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
    };
}

export class WopSettingTab extends PluginSettingTab {
    plugin: MyPlugin;
    private activeModuleId: ModuleId = MODULE_SLASH;
    private readonly slashRenderer: SlashModuleSettingsRenderer;
    private readonly variableRenderer: VariableParserSettingsRenderer;

    constructor(app: App, plugin: MyPlugin) {
        super(app, plugin);
        this.plugin = plugin;
        this.slashRenderer = new SlashModuleSettingsRenderer(plugin);
        this.variableRenderer = new VariableParserSettingsRenderer(plugin);
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
        if (this.activeModuleId === MODULE_SLASH) {
            slashModuleButton.addClass("is-active");
        }
        if (this.activeModuleId === MODULE_VARIABLE_PARSER) {
            variableParserButton.addClass("is-active");
        }

        slashModuleButton.addEventListener("click", () => {
            this.activeModuleId = MODULE_SLASH;
            this.display();
        });

        variableParserButton.addEventListener("click", () => {
            this.activeModuleId = MODULE_VARIABLE_PARSER;
            this.display();
        });

        containerEl.createEl("hr", { cls: "wop-section-divider" });

        const modulePanelEl = containerEl.createDiv({ cls: "wop-module-panel" });
        if (this.activeModuleId === MODULE_SLASH) {
            this.slashRenderer.render(modulePanelEl, () => this.display());
        } else {
            this.variableRenderer.render(modulePanelEl, () => this.display());
        }
    }
}
