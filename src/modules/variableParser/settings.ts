import { Notice, Setting } from "obsidian";
import variableSeedData from "./defaultRules.json";

interface VariableSettingsPluginApi {
    settings: {
        variableParser: VariableParserSettings;
    };
    saveSettings: () => Promise<void>;
}

export interface VariableRuleConfig {
    id: string;
    pattern: string;
    replacement: string;
    enabled: boolean;
}

export interface VariableParserSettings {
    enabled: boolean;
    rules: VariableRuleConfig[];
}

interface VariableSeedRule {
    pattern: string;
    replacement: string;
}

interface VariableSeedData {
    rules: VariableSeedRule[];
}

const variableSeed = variableSeedData as VariableSeedData;

function toSafeId(value: string, fallback: string): string {
    const id = value.trim().toLowerCase().replace(/[^a-z0-9_-]+/g, "-").replace(/^-+|-+$/g, "");
    return id || fallback;
}

function makeUniqueIds(values: string[], prefix: string): string[] {
    const seen = new Map<string, number>();
    return values.map((value, index) => {
        const base = toSafeId(value, `${prefix}-${index + 1}`);
        const count = seen.get(base) ?? 0;
        seen.set(base, count + 1);
        return count === 0 ? base : `${base}-${count + 1}`;
    });
}

function buildDefaultVariableRules(data: VariableSeedData): VariableRuleConfig[] {
    return (data.rules ?? []).map((rule, index) => ({
        id: toSafeId(rule.pattern, `rule-${index + 1}`),
        pattern: rule.pattern ?? "",
        replacement: rule.replacement ?? "",
        enabled: true
    }));
}

function toSeedDataFromRules(rules: VariableRuleConfig[]): VariableSeedData {
    return {
        rules: rules.map((rule) => ({
            pattern: rule.pattern,
            replacement: rule.replacement
        }))
    };
}

function readFileAsText(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result ?? ""));
        reader.onerror = () => reject(reader.error ?? new Error("Failed to read file"));
        reader.readAsText(file);
    });
}

export const DEFAULT_VARIABLE_PARSER_SETTINGS: VariableParserSettings = {
    enabled: true,
    rules: buildDefaultVariableRules(variableSeed)
};

export function normalizeVariableParserSettings(
    data: Partial<VariableParserSettings> | null | undefined,
): VariableParserSettings {
    const sourceRules = data?.rules ?? DEFAULT_VARIABLE_PARSER_SETTINGS.rules;
    const merged: VariableParserSettings = {
        enabled: data?.enabled ?? DEFAULT_VARIABLE_PARSER_SETTINGS.enabled,
        rules: sourceRules.map((rule, index) => ({
            id: rule.id || `rule-${index + 1}`,
            pattern: rule.pattern || "",
            replacement: rule.replacement || "",
            enabled: rule.enabled ?? true
        }))
    };

    if (merged.rules.length === 0) {
        merged.rules = DEFAULT_VARIABLE_PARSER_SETTINGS.rules.map((rule) => ({ ...rule }));
    }

    const ruleIds = makeUniqueIds(merged.rules.map((rule) => rule.id), "rule");
    merged.rules.forEach((rule, index) => {
        rule.id = ruleIds[index] ?? `rule-${index + 1}`;
    });

    return merged;
}

export class VariableParserSettingsRenderer {
    private plugin: VariableSettingsPluginApi;

    constructor(plugin: VariableSettingsPluginApi) {
        this.plugin = plugin;
    }

    render(containerEl: HTMLElement, refresh: () => void): void {
        const panelEl = containerEl.createDiv({ cls: "wop-variable-panel" });

        new Setting(panelEl)
            .setName("Enable variable parser")
            .setDesc("Automatically replaces text patterns while typing, for example '->' to '→'.")
            .addToggle((toggle) =>
                toggle.setValue(this.plugin.settings.variableParser.enabled).onChange(async (value) => {
                    this.plugin.settings.variableParser.enabled = value;
                    await this.plugin.saveSettings();
                }),
            );

        panelEl.createEl("hr", { cls: "wop-section-divider" });

        new Setting(panelEl)
            .setName("Rules")
            .setDesc("Add or edit pattern replacements.")
            .addButton((button) =>
                button.setButtonText("+ Add rule").setCta().onClick(async () => {
                    const nextNumber = this.plugin.settings.variableParser.rules.length + 1;
                    this.plugin.settings.variableParser.rules.push({
                        id: `rule-${nextNumber}`,
                        pattern: "",
                        replacement: "",
                        enabled: true
                    });
                    this.plugin.settings.variableParser = normalizeVariableParserSettings(this.plugin.settings.variableParser);
                    await this.plugin.saveSettings();
                    refresh();
                }),
            );

        this.plugin.settings.variableParser.rules.forEach((rule) => {
            new Setting(panelEl)
                .addToggle((toggle) =>
                    toggle.setValue(rule.enabled).setTooltip("Enable rule").onChange(async (value) => {
                        rule.enabled = value;
                        await this.plugin.saveSettings();
                    }),
                )
                .addText((text) => {
                    text.inputEl.addClass("wop-responsive-input");
                    return text.setPlaceholder("pattern (e.g. ->)").setValue(rule.pattern).onChange(async (value) => {
                        rule.pattern = value;
                        await this.plugin.saveSettings();
                    });
                })
                .addText((text) => {
                    text.inputEl.addClass("wop-responsive-input");
                    return text
                        .setPlaceholder("replacement (e.g. →)")
                        .setValue(rule.replacement)
                        .onChange(async (value) => {
                            rule.replacement = value;
                            await this.plugin.saveSettings();
                        });
                })
                .addExtraButton((button) =>
                    button.setIcon("trash").setTooltip("Delete rule").onClick(async () => {
                        this.plugin.settings.variableParser.rules = this.plugin.settings.variableParser.rules.filter(
                            (entry) => entry.id !== rule.id,
                        );
                        this.plugin.settings.variableParser = normalizeVariableParserSettings(this.plugin.settings.variableParser);
                        await this.plugin.saveSettings();
                        refresh();
                    }),
                );
        });

        new Setting(panelEl)
            .setName("Import or export rules")
            .setDesc("Import rules from JSON or export current rules in json format.")
            .addButton((button) =>
                button.setButtonText("Export JSON").onClick(() => {
                    this.exportRulesJson();
                }),
            )
            .addButton((button) =>
                button.setButtonText("Import JSON").onClick(async () => {
                    await this.importRulesJson(refresh);
                }),
            );
    }

    private exportRulesJson(): void {
        const payload = toSeedDataFromRules(this.plugin.settings.variableParser.rules);
        const data = JSON.stringify(payload, null, 2);
        const blob = new Blob([data], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = "variable-parser-rules.json";
        document.body.appendChild(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(url);
        new Notice("Exported variable parser rules.");
    }

    private async importRulesJson(refresh: () => void): Promise<void> {
        const input = document.createElement("input");
        input.type = "file";
        input.accept = ".json,application/json";

        input.addEventListener("change", async () => {
            const file = input.files?.[0];
            if (!file) {
                return;
            }

            try {
                const raw = await readFileAsText(file);
                const parsed = JSON.parse(raw) as Partial<VariableSeedData>;
                if (!parsed || typeof parsed !== "object" || !Array.isArray(parsed.rules)) {
                    new Notice("Invalid variable parser JSON format.");
                    return;
                }

                const confirmed = window.confirm(
                    "Importing will replace all variable parser rules. Continue?",
                );
                if (!confirmed) {
                    new Notice("Import canceled.");
                    return;
                }

                this.plugin.settings.variableParser.rules = buildDefaultVariableRules({
                    rules: parsed.rules,
                });
                this.plugin.settings.variableParser = normalizeVariableParserSettings(this.plugin.settings.variableParser);
                await this.plugin.saveSettings();
                refresh();
                new Notice("Imported variable parser rules.");
            } catch (_error) {
                new Notice("Failed to import variable parser rules.");
            }
        });

        input.click();
    }
}
