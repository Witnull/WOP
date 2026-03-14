import { Editor } from "obsidian";
import type { VariableParserSettings } from "./settings";

interface VariableParserPluginApi {
    registerEvent: (eventRef: unknown) => void;
    app: {
        workspace: {
            on: (eventName: string, callback: (editor: Editor) => void) => unknown;
        };
    };
    settings: {
        variableParser: VariableParserSettings;
    };
}

export class VariableParserModule {
    private plugin: VariableParserPluginApi;
    private isApplying = false;

    constructor(plugin: VariableParserPluginApi) {
        this.plugin = plugin;
    }

    register(): void {
        this.plugin.registerEvent(
            this.plugin.app.workspace.on("editor-change", (editor: Editor) => {
                this.onEditorChange(editor);
            }),
        );
    }

    private onEditorChange(editor: Editor): void {
        if (this.isApplying || !this.plugin.settings.variableParser.enabled) {
            return;
        }

        const activeRules = this.plugin.settings.variableParser.rules
            .filter((rule) => rule.enabled && rule.pattern.length > 0)
            .slice()
            .sort((a, b) => b.pattern.length - a.pattern.length);
        if (activeRules.length === 0) {
            return;
        }

        const cursor = editor.getCursor();
        const line = editor.getLine(cursor.line);
        const beforeCursor = line.substring(0, cursor.ch);

        for (const rule of activeRules) {
            if (!beforeCursor.endsWith(rule.pattern)) {
                continue;
            }

            const start = { line: cursor.line, ch: cursor.ch - rule.pattern.length };
            const end = { line: cursor.line, ch: cursor.ch };
            this.isApplying = true;
            try {
                editor.replaceRange(rule.replacement, start, end);
                editor.setCursor({ line: cursor.line, ch: start.ch + rule.replacement.length });
            } finally {
                this.isApplying = false;
            }
            return;
        }
    }
}
