import { Notice, Setting } from "obsidian";

interface CodeExecutorSettingsPluginApi {
    settings: {
        codeExecutor: CodeExecutorSettings;
    };
    saveSettings: () => Promise<void>;
}

export interface CodeExecutorSettings {
    enabled: boolean;
    autoShowCard: boolean;
    activateButtonPlacement: "header" | "before-output";
    codeBlockLanguage: string;
    maxOutputLines: number;
}

export const DEFAULT_CODE_EXECUTOR_SETTINGS: CodeExecutorSettings = {
    enabled: true,
    autoShowCard: true,
    activateButtonPlacement: "header",
    codeBlockLanguage: "wop-run",
    maxOutputLines: 120,
};

function toNumberOrDefault(value: unknown, fallback: number): number {
    const asNumber = Number(value);
    return Number.isFinite(asNumber) ? asNumber : fallback;
}

function normalizeLanguage(value: unknown): string {
    const raw = String(value ?? "").trim().toLowerCase();
    return raw || DEFAULT_CODE_EXECUTOR_SETTINGS.codeBlockLanguage;
}

function normalizeButtonPlacement(value: unknown): "header" | "before-output" {
    return value === "before-output" ? "before-output" : "header";
}

export function normalizeCodeExecutorSettings(
    data: Partial<CodeExecutorSettings> | null | undefined,
): CodeExecutorSettings {
    const maxOutputLines = Math.max(10, Math.min(600, Math.floor(toNumberOrDefault(data?.maxOutputLines, 120))));

    return {
        enabled: data?.enabled ?? DEFAULT_CODE_EXECUTOR_SETTINGS.enabled,
        autoShowCard: data?.autoShowCard ?? DEFAULT_CODE_EXECUTOR_SETTINGS.autoShowCard,
        activateButtonPlacement: normalizeButtonPlacement(data?.activateButtonPlacement),
        codeBlockLanguage: normalizeLanguage(data?.codeBlockLanguage),
        maxOutputLines,
    };
}

export class CodeExecutorSettingsRenderer {
    private plugin: CodeExecutorSettingsPluginApi;

    constructor(plugin: CodeExecutorSettingsPluginApi) {
        this.plugin = plugin;
    }

    render(containerEl: HTMLElement): void {
        new Setting(containerEl)
            .setName("Enable code executor")
            .setDesc("Render a runnable code block UI with input, Activate button, and captured console output.")
            .addToggle((toggle) =>
                toggle.setValue(this.plugin.settings.codeExecutor.enabled).onChange(async (value) => {
                    this.plugin.settings.codeExecutor.enabled = value;
                    await this.plugin.saveSettings();
                }),
            );

        new Setting(containerEl)
            .setName("Code block language")
            .setDesc("Language name used by the executor block. Example: wop-run")
            .addText((text) => {
                text.inputEl.addClass("wop-responsive-input");
                return text
                    .setPlaceholder("wop-run")
                    .setValue(this.plugin.settings.codeExecutor.codeBlockLanguage)
                    .onChange(async (value) => {
                        const parsed = normalizeCodeExecutorSettings({
                            ...this.plugin.settings.codeExecutor,
                            codeBlockLanguage: value,
                        });
                        this.plugin.settings.codeExecutor.codeBlockLanguage = parsed.codeBlockLanguage;
                        text.setValue(parsed.codeBlockLanguage);
                        await this.plugin.saveSettings();
                    });
            });

        new Setting(containerEl)
            .setName("Auto show card")
            .setDesc("Show executor inputs/output by default. If disabled, the card starts collapsed and can be expanded with a toggle button.")
            .addToggle((toggle) =>
                toggle.setValue(this.plugin.settings.codeExecutor.autoShowCard).onChange(async (value) => {
                    this.plugin.settings.codeExecutor.autoShowCard = value;
                    await this.plugin.saveSettings();
                }),
            );

        new Setting(containerEl)
            .setName("Activate button position")
            .setDesc("Choose where the Activate button appears: near the title or above output.")
            .addDropdown((dropdown) =>
                dropdown
                    .addOption("header", "Near title")
                    .addOption("before-output", "Above output")
                    .setValue(this.plugin.settings.codeExecutor.activateButtonPlacement)
                    .onChange(async (value) => {
                        const parsed = normalizeCodeExecutorSettings({
                            ...this.plugin.settings.codeExecutor,
                            activateButtonPlacement: value as "header" | "before-output",
                        });
                        this.plugin.settings.codeExecutor.activateButtonPlacement = parsed.activateButtonPlacement;
                        await this.plugin.saveSettings();
                    }),
            );

        new Setting(containerEl)
            .setName("Max output lines")
            .setDesc("Limit stored output lines per execution.")
            .addText((text) => {
                text.inputEl.addClass("wop-responsive-input");
                return text
                    .setPlaceholder("120")
                    .setValue(String(this.plugin.settings.codeExecutor.maxOutputLines))
                    .onChange(async (value) => {
                        const parsed = normalizeCodeExecutorSettings({
                            ...this.plugin.settings.codeExecutor,
                            maxOutputLines: Number(value),
                        });
                        this.plugin.settings.codeExecutor.maxOutputLines = parsed.maxOutputLines;
                        text.setValue(String(parsed.maxOutputLines));
                        await this.plugin.saveSettings();
                    });
            });

        const help = containerEl.createDiv({ cls: "wop-help-box" });
        help.createEl("strong", { text: "Usage and syntax" });
        help.createEl("p", {
            text: "In reading view, create a fenced block using the configured language. Use console.log for output. You can define none, one, or many inputs in code comments.",
        });

        const exampleNoInput = [
            "```wop-run",
            "// @title: Quick test",
            "// @inputs: none",
            "console.log('No input required');",
            "```",
        ].join("\n");
        this.renderExampleWithCopy(help, "No input", exampleNoInput);

        const exampleOneInput = [
            "```wop-run",
            "// default mode (no @inputs line): one input field named 'input'",
            "console.log('Hello', input);",
            "```",
        ].join("\n");
        this.renderExampleWithCopy(help, "Single input", exampleOneInput);

        const exampleManyInputs = [
            "```wop-run",
            "// @inputs: name=Guest, qty=1, note",
            "const total = Number(inputs.qty || '0') * 2;",
            "console.log('Name:', inputs.name);",
            "console.log('Note:', inputs.note || '(empty)');",
            "console.log('Total:', total);",
            "```",
        ].join("\n");
        this.renderExampleWithCopy(help, "Many inputs", exampleManyInputs);
    }

    private renderExampleWithCopy(containerEl: HTMLElement, label: string, code: string): void {
        const wrap = containerEl.createDiv({ cls: "wop-settings-example-wrap" });
        const topRow = wrap.createDiv({ cls: "wop-settings-example-header" });
        topRow.createEl("strong", { text: label });
        const copyButton = topRow.createEl("button", {
            cls: "wop-settings-copy-btn",
            text: "Copy",
        });

        wrap.createEl("pre", { cls: "wop-settings-code-example", text: code });

        copyButton.addEventListener("click", () => {
            void this.copyToClipboard(code);
        });
    }

    private async copyToClipboard(text: string): Promise<void> {
        try {
            await navigator.clipboard.writeText(text);
            new Notice("Sample code copied.");
        } catch (_error) {
            new Notice("Could not copy sample code.");
        }
    }
}
