import { App, Editor, MarkdownPostProcessorContext, Menu, Notice } from "obsidian";
import type { CodeExecutorSettings } from "./settings";

interface CodeExecutorPluginApi {
    app: App;
    registerMarkdownCodeBlockProcessor: (
        language: string,
        handler: (source: string, el: HTMLElement, ctx: MarkdownPostProcessorContext) => void | Promise<void>,
    ) => void;
    registerEvent: (eventRef: unknown) => void;
    settings: {
        codeExecutor: CodeExecutorSettings;
    };
}

interface ConsoleProxy {
    log: (...args: unknown[]) => void;
    info: (...args: unknown[]) => void;
    warn: (...args: unknown[]) => void;
    error: (...args: unknown[]) => void;
}

interface InputSpec {
    key: string;
    defaultValue: string;
}

interface ParsedExecutorSource {
    executableSource: string;
    title: string;
    inputSpecs: InputSpec[];
    disableInputs: boolean;
}

function formatValue(value: unknown): string {
    if (value === undefined) {
        return "undefined";
    }

    if (value === null) {
        return "null";
    }

    if (typeof value === "string") {
        return value;
    }

    if (typeof value === "number") {
        if (Number.isNaN(value)) {
            return "NaN";
        }
        if (!Number.isFinite(value)) {
            return String(value);
        }
    }

    if (typeof value === "boolean" || typeof value === "bigint" || typeof value === "symbol") {
        return String(value);
    }

    if (typeof value === "function") {
        return value.name ? `[Function ${value.name}]` : "[Function anonymous]";
    }

    try {
        const serialized = JSON.stringify(value, null, 2);
        if (typeof serialized === "string") {
            return serialized;
        }
    } catch (_error) {
        // Fallback to String conversion below.
    }

    try {
        return String(value);
    } catch (_error) {
        return "[Unprintable value]";
    }
}

function normalizeLookupKey(value: string): string {
    return value.replace(/[^a-zA-Z0-9]+/g, "").toLowerCase();
}

function createInputLookupProxy(values: Record<string, string>): Record<string, string> {
    const canonical = new Map<string, string>();
    Object.entries(values).forEach(([key, val]) => {
        canonical.set(normalizeLookupKey(key), val);
    });

    return new Proxy(values, {
        get(target, prop: string | symbol): unknown {
            if (typeof prop !== "string") {
                return Reflect.get(target, prop);
            }

            if (Object.prototype.hasOwnProperty.call(target, prop)) {
                return target[prop];
            }

            const normalized = normalizeLookupKey(prop);
            if (canonical.has(normalized)) {
                return canonical.get(normalized);
            }

            return undefined;
        },
    });
}

function parseNumericCandidate(value: string): string | null {
    const compact = value.trim().replace(/,/g, "");
    if (!compact) {
        return null;
    }
    return /^-?\d+(?:\.\d+)?$/.test(compact) ? compact : null;
}

function formatNumericWithSeparators(value: string): string | null {
    const parsed = parseNumericCandidate(value);
    if (!parsed) {
        return null;
    }

    const sign = parsed.startsWith("-") ? "-" : "";
    const unsigned = sign ? parsed.slice(1) : parsed;
    const [integerPartRaw, fractionPart] = unsigned.split(".");
    const integerPart = (integerPartRaw ?? "0").replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    return fractionPart !== undefined ? `${sign}${integerPart}.${fractionPart}` : `${sign}${integerPart}`;
}

export class CodeExecutorModule {
    private readonly plugin: CodeExecutorPluginApi;

    constructor(plugin: CodeExecutorPluginApi) {
        this.plugin = plugin;
    }

    register(): void {
        const language = this.plugin.settings.codeExecutor.codeBlockLanguage;
        this.plugin.registerMarkdownCodeBlockProcessor(language, (source, el) => {
            this.renderExecutor(source, el);
        });

        this.plugin.registerEvent(
            this.plugin.app.workspace.on("editor-menu", (menu: Menu, editor: Editor) => {
                this.onEditorMenu(menu, editor);
            }),
        );
    }

    private onEditorMenu(menu: Menu, editor: Editor): void {
        if (!this.plugin.settings.codeExecutor.enabled) {
            return;
        }

        const selected = editor.getSelection().trim();
        if (!selected) {
            return;
        }

        const inputsDirective = this.convertConstSelectionToInputsDirective(selected);
        if (!inputsDirective) {
            return;
        }

        menu.addItem((item) => {
            item
                .setTitle("Code executor: Convert const to @inputs")
                .setIcon("wand-sparkles")
                .onClick(() => {
                    editor.replaceSelection(inputsDirective);
                    new Notice("Converted const declaration(s) to @inputs.");
                });
        });
    }

    private renderExecutor(source: string, el: HTMLElement): void {
        if (!this.plugin.settings.codeExecutor.enabled) {
            const disabledEl = el.createDiv({ cls: "wop-exec-disabled" });
            disabledEl.setText("Code executor is disabled in settings.");
            return;
        }

        el.empty();
        const parsed = this.parseExecutorSource(source);
        const cardEl = el.createDiv({ cls: "wop-exec" });

        const headerEl = cardEl.createDiv({ cls: "wop-exec-header" });
        const titleEl = headerEl.createDiv({ cls: "wop-exec-title" });
        titleEl.setText(parsed.title || "Code executor");

        const headerActionsEl = headerEl.createDiv({ cls: "wop-exec-header-actions" });
        const toggleBtn = headerActionsEl.createEl("button", {
            text: this.plugin.settings.codeExecutor.autoShowCard ? "Hide" : "Show",
            cls: "wop-exec-toggle",
        });

        const bodyEl = cardEl.createDiv({ cls: "wop-exec-body" });
        const controlsEl = bodyEl.createDiv({ cls: "wop-exec-controls" });

        const inputValues: Record<string, string> = {};
        if (!parsed.disableInputs) {
            if (parsed.inputSpecs.length === 0) {
                const inputEl = controlsEl.createEl("input", {
                    type: "text",
                    placeholder: "Input value",
                    cls: "wop-exec-input",
                });
                inputValues.input = "";
                this.bindInputFormatting(inputEl, "input", inputValues, "");
            } else {
                parsed.inputSpecs.forEach((spec) => {
                    const fieldEl = controlsEl.createDiv({ cls: "wop-exec-field" });
                    fieldEl.createEl("label", { cls: "wop-exec-field-label", text: spec.key });
                    const inputEl = fieldEl.createEl("input", {
                        type: "text",
                        placeholder: spec.defaultValue || spec.key,
                        cls: "wop-exec-input",
                    });
                    this.bindInputFormatting(inputEl, spec.key, inputValues, spec.defaultValue);
                });
            }
        }

        const runBtn = document.createElement("button");
        runBtn.setText("Activate");
        runBtn.addClass("mod-cta", "wop-exec-run");

        if (this.plugin.settings.codeExecutor.activateButtonPlacement === "header") {
            headerActionsEl.appendChild(runBtn);
        }

        const outputActionsEl = bodyEl.createDiv({ cls: "wop-exec-output-actions" });
        if (this.plugin.settings.codeExecutor.activateButtonPlacement === "before-output") {
            outputActionsEl.appendChild(runBtn);
        }

        const outputWrapEl = bodyEl.createDiv({ cls: "wop-exec-output-wrap" });
        const outputLabelEl = outputWrapEl.createDiv({ cls: "wop-exec-output-label" });
        outputLabelEl.setText("Console");
        const outputEl = outputWrapEl.createEl("pre", { cls: "wop-exec-output" });

        let isExpanded = this.plugin.settings.codeExecutor.autoShowCard;
        if (!isExpanded) {
            bodyEl.addClass("is-collapsed");
        }

        toggleBtn.addEventListener("click", () => {
            isExpanded = !isExpanded;
            bodyEl.toggleClass("is-collapsed", !isExpanded);
            toggleBtn.setText(isExpanded ? "Hide" : "Show");
        });

        runBtn.addEventListener("click", () => {
            this.executeSource(parsed.executableSource, inputValues, outputEl);
        });
    }

    private executeSource(source: string, inputValues: Record<string, string>, outputEl: HTMLElement): void {
        const lines: string[] = [];
        const maxLines = this.plugin.settings.codeExecutor.maxOutputLines;

        const appendLine = (line: string): void => {
            lines.push(line);
            if (lines.length > maxLines) {
                lines.splice(0, lines.length - maxLines);
            }
            outputEl.setText(lines.join("\n"));
        };

        const proxy: ConsoleProxy = {
            log: (...args) => appendLine(args.map(formatValue).join(" ")),
            info: (...args) => appendLine(args.map(formatValue).join(" ")),
            warn: (...args) => appendLine(`WARN: ${args.map(formatValue).join(" ")}`),
            error: (...args) => appendLine(`ERROR: ${args.map(formatValue).join(" ")}`),
        };

        try {
            const fn = new Function(
                "input",
                "inputs",
                "console",
                `"use strict";\n${source}`,
            ) as (
                inputValue: string,
                inputsMap: Record<string, string>,
                scopedConsole: ConsoleProxy,
            ) => unknown;

            const legacyInput = inputValues.input ?? "";
            const proxiedInputs = createInputLookupProxy(inputValues);
            const result = fn(legacyInput, proxiedInputs, proxy);
            if (result !== undefined) {
                appendLine(`=> ${formatValue(result)}`);
            }
        } catch (error) {
            appendLine(`ERROR: ${String(error)}`);
            new Notice("Code executor failed. Check output panel for details.");
        }
    }

    private parseExecutorSource(source: string): ParsedExecutorSource {
        const lines = source.split("\n");
        let title = "Code executor";
        let disableInputs = false;
        let parsedSpecs: InputSpec[] = [];

        for (const line of lines) {
            const trimmed = line.trim();

            const titleMatch = trimmed.match(/^\/\/\s*@title\s*:?[ \t]*(.+)$/i);
            if (titleMatch) {
                const parsedTitle = (titleMatch[1] ?? "").trim();
                if (parsedTitle) {
                    title = parsedTitle;
                }
                continue;
            }

            const inputsMatch = trimmed.match(/^\/\/\s*@inputs\s*:\s*(.+)$/i);
            if (!inputsMatch) {
                continue;
            }

            const rawValue = (inputsMatch[1] ?? "").trim();
            if (!rawValue) {
                continue;
            }

            if (rawValue.toLowerCase() === "none") {
                disableInputs = true;
                parsedSpecs = [];
                continue;
            }

            parsedSpecs = rawValue
                .split(",")
                .map((chunk) => chunk.trim())
                .filter(Boolean)
                .map((chunk) => {
                    const eqIndex = chunk.indexOf("=");
                    if (eqIndex < 0) {
                        return { key: this.toSafeInputKey(chunk), defaultValue: "" };
                    }

                    const key = this.toSafeInputKey(chunk.slice(0, eqIndex).trim());
                    const defaultValue = chunk.slice(eqIndex + 1).trim();
                    return { key, defaultValue };
                })
                .filter((spec) => spec.key.length > 0);
        }

        return {
            executableSource: source,
            title,
            inputSpecs: this.uniqueInputSpecs(parsedSpecs),
            disableInputs,
        };
    }

    private toSafeInputKey(value: string): string {
        return value
            .trim()
            .toLowerCase()
            .replace(/[^a-z0-9_]+/g, "_")
            .replace(/^_+|_+$/g, "");
    }

    private uniqueInputSpecs(specs: InputSpec[]): InputSpec[] {
        const seen = new Set<string>();
        const unique: InputSpec[] = [];

        for (const spec of specs) {
            if (!spec.key || seen.has(spec.key)) {
                continue;
            }
            seen.add(spec.key);
            unique.push(spec);
        }

        return unique;
    }

    private bindInputFormatting(
        inputEl: HTMLInputElement,
        key: string,
        inputValues: Record<string, string>,
        initialValue: string,
    ): void {
        const normalizedInitial = parseNumericCandidate(initialValue) ?? initialValue;
        inputValues[key] = normalizedInitial;
        inputEl.value = formatNumericWithSeparators(initialValue) ?? initialValue;

        inputEl.addEventListener("focus", () => {
            const parsed = parseNumericCandidate(inputEl.value);
            if (parsed !== null) {
                inputEl.value = parsed;
            }
        });

        inputEl.addEventListener("input", () => {
            const parsed = parseNumericCandidate(inputEl.value);
            inputValues[key] = parsed ?? inputEl.value;
        });

        inputEl.addEventListener("blur", () => {
            const parsed = parseNumericCandidate(inputEl.value);
            if (parsed !== null) {
                inputValues[key] = parsed;
                inputEl.value = formatNumericWithSeparators(parsed) ?? parsed;
                return;
            }
            inputValues[key] = inputEl.value;
        });
    }

    private convertConstSelectionToInputsDirective(selection: string): string | null {
        const lines = selection.split("\n");
        const orderedKeys: string[] = [];
        const valueByKey = new Map<string, string>();

        const pushEntry = (key: string, value: string): void => {
            if (!key) {
                return;
            }
            if (!valueByKey.has(key)) {
                orderedKeys.push(key);
                valueByKey.set(key, value);
                return;
            }

            const prev = valueByKey.get(key) ?? "";
            // Prefer a non-empty default value when multiple candidates exist.
            if (!prev && value) {
                valueByKey.set(key, value);
            }
        };

        for (const rawLine of lines) {
            const line = rawLine.trim();
            if (!line) {
                continue;
            }

            const inputsDirective = line.match(/@inputs\s*:\s*(.+)$/i);
            if (inputsDirective) {
                const body = (inputsDirective[1] ?? "").trim();
                if (body.toLowerCase() === "none") {
                    continue;
                }

                body
                    .split(",")
                    .map((chunk) => chunk.trim())
                    .filter(Boolean)
                    .forEach((chunk) => {
                        const eqIndex = chunk.indexOf("=");
                        if (eqIndex < 0) {
                            const key = this.toSafeInputKey(chunk);
                            pushEntry(key, "");
                            return;
                        }

                        const key = this.toSafeInputKey(chunk.slice(0, eqIndex));
                        const value = chunk.slice(eqIndex + 1).trim();
                        pushEntry(key, value);
                    });
            }

            const constRegex = /const\s+([A-Za-z_$][\w$]*)(?:\s*:[^=;]+)?(?:\s*=\s*([^;\n]+))?/g;
            let match: RegExpExecArray | null = constRegex.exec(line);
            while (match) {
                const key = this.toSafeInputKey(match[1] ?? "");
                const rawDefault = (match[2] ?? "").trim();
                const value = rawDefault.replace(/^['"]|['"]$/g, "");
                pushEntry(key, value);
                match = constRegex.exec(line);
            }
        }

        if (orderedKeys.length === 0) {
            return null;
        }

        const merged = orderedKeys.map((key) => {
            const value = valueByKey.get(key) ?? "";
            return value ? `${key}=${value}` : key;
        });

        return `// @inputs: ${merged.join(", ")}`;
    }
}
