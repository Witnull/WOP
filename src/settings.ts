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
import {
    DEFAULT_MAGIC_WIKILINK_SETTINGS,
    MagicWikilinkSettings,
    MagicWikilinkSettingsRenderer,
    normalizeMagicWikilinkSettings,
} from "./modules/magicWikilink/settings";
import {
    CodeExecutorSettings,
    CodeExecutorSettingsRenderer,
    DEFAULT_CODE_EXECUTOR_SETTINGS,
    normalizeCodeExecutorSettings,
} from "./modules/codeExecutor/settings";

const MODULE_SLASH = "slash";
const MODULE_VARIABLE_PARSER = "variable-parser";
const MODULE_TEMPLATE_COMMAND = "template-command";
const MODULE_MAGIC_WIKILINK = "magic-wikilink";
const MODULE_CODE_EXECUTOR = "code-executor";

type ModuleId =
    | typeof MODULE_SLASH
    | typeof MODULE_VARIABLE_PARSER
    | typeof MODULE_TEMPLATE_COMMAND
    | typeof MODULE_MAGIC_WIKILINK
    | typeof MODULE_CODE_EXECUTOR;

interface LegacySettingsShape {
    enabled?: boolean;
    triggerGroups?: TriggerGroupConfig[];
    variableParser?: Partial<VariableParserSettings>;
    templateCommand?: Partial<TemplateCommandSettings>;
    magicWikilink?: Partial<MagicWikilinkSettings>;
    codeExecutor?: Partial<CodeExecutorSettings>;
}

export interface MyPluginSettings {
    slash: SlashModuleSettings;
    variableParser: VariableParserSettings;
    templateCommand: TemplateCommandSettings;
    magicWikilink: MagicWikilinkSettings;
    codeExecutor: CodeExecutorSettings;
}

export const DEFAULT_SETTINGS: MyPluginSettings = {
    slash: DEFAULT_SLASH_SETTINGS,
    variableParser: DEFAULT_VARIABLE_PARSER_SETTINGS,
    templateCommand: DEFAULT_TEMPLATE_COMMAND_SETTINGS,
    magicWikilink: DEFAULT_MAGIC_WIKILINK_SETTINGS,
    codeExecutor: DEFAULT_CODE_EXECUTOR_SETTINGS,
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
        magicWikilink: normalizeMagicWikilinkSettings(maybeNew?.magicWikilink ?? legacy?.magicWikilink),
        codeExecutor: normalizeCodeExecutorSettings(maybeNew?.codeExecutor ?? legacy?.codeExecutor),
    };
}

export class WopSettingTab extends PluginSettingTab {
    plugin: MyPlugin;
    private activeModuleId: ModuleId = MODULE_SLASH;
    private readonly slashRenderer: SlashModuleSettingsRenderer;
    private readonly variableRenderer: VariableParserSettingsRenderer;
    private readonly templateRenderer: TemplateCommandSettingsRenderer;
    private readonly magicWikilinkRenderer: MagicWikilinkSettingsRenderer;
    private readonly codeExecutorRenderer: CodeExecutorSettingsRenderer;

    constructor(app: App, plugin: MyPlugin) {
        super(app, plugin);
        this.plugin = plugin;
        this.slashRenderer = new SlashModuleSettingsRenderer(plugin);
        this.variableRenderer = new VariableParserSettingsRenderer(plugin);
        this.templateRenderer = new TemplateCommandSettingsRenderer(plugin);
        this.magicWikilinkRenderer = new MagicWikilinkSettingsRenderer(plugin);
        this.codeExecutorRenderer = new CodeExecutorSettingsRenderer(plugin);
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
        const magicWikilinkButton = moduleTabsEl.createEl("button", {
            text: "[[ Magic wikilink",
            cls: "wop-module-tab",
        });
        const codeExecutorButton = moduleTabsEl.createEl("button", {
            text: "[<> Code executor",
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
        if (this.activeModuleId === MODULE_MAGIC_WIKILINK) {
            magicWikilinkButton.addClass("is-active");
        }
        if (this.activeModuleId === MODULE_CODE_EXECUTOR) {
            codeExecutorButton.addClass("is-active");
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

        magicWikilinkButton.addEventListener("click", () => {
            this.activeModuleId = MODULE_MAGIC_WIKILINK;
            this.display();
        });

        codeExecutorButton.addEventListener("click", () => {
            this.activeModuleId = MODULE_CODE_EXECUTOR;
            this.display();
        });

        window.requestAnimationFrame(() => {
            const activeTab = moduleTabsEl.querySelector<HTMLButtonElement>(".wop-module-tab.is-active");
            activeTab?.scrollIntoView({ block: "nearest", inline: "center" });
        });


        containerEl.createEl("hr", { cls: "wop-section-divider" });

        const modulePanelEl = containerEl.createDiv({ cls: "wop-module-panel" });
        if (this.activeModuleId === MODULE_SLASH) {
            this.slashRenderer.render(modulePanelEl, () => this.display());
        } else if (this.activeModuleId === MODULE_VARIABLE_PARSER) {
            this.variableRenderer.render(modulePanelEl, () => this.display());
        } else if (this.activeModuleId === MODULE_TEMPLATE_COMMAND) {
            this.templateRenderer.render(modulePanelEl);
        } else if (this.activeModuleId === MODULE_MAGIC_WIKILINK) {
            this.magicWikilinkRenderer.render(modulePanelEl);
        } else if (this.activeModuleId === MODULE_CODE_EXECUTOR) {
            this.codeExecutorRenderer.render(modulePanelEl);
        }
    }
}
