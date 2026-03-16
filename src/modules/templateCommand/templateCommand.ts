import { App, Editor, EditorPosition, EditorSuggest, EditorSuggestTriggerInfo, TFile, normalizePath } from "obsidian";
import type { TemplateCommandSettings } from "./settings";

interface TemplatePluginApi {
    app: App;
    settings: {
        templateCommand: TemplateCommandSettings;
    };
}

interface TemplateSuggestionItem {
    id: string;
    title: string;
    description: string;
    file: TFile;
}

function getDisplayName(file: TFile): string {
    const fileName = file.name;
    const ext = file.extension;
    if (!ext) {
        return fileName;
    }
    return fileName.slice(0, Math.max(0, fileName.length - ext.length - 1));
}

function normalizeTemplateFolder(folder: string): string {
    const cleaned = normalizePath((folder || "templates/").trim());
    if (cleaned.length === 0) {
        return "templates/";
    }
    return cleaned.endsWith("/") ? cleaned : `${cleaned}/`;
}

export class TemplateCommandSuggest extends EditorSuggest<TemplateSuggestionItem> {
    private plugin: TemplatePluginApi;

    constructor(plugin: TemplatePluginApi) {
        super(plugin.app);
        this.plugin = plugin;
    }

    onTrigger(cursor: EditorPosition, editor: Editor, _view: unknown): EditorSuggestTriggerInfo | null {
        if (!this.plugin.settings.templateCommand.enabled) {
            return null;
        }

        const trigger = this.plugin.settings.templateCommand.trigger;
        const line = editor.getLine(cursor.line);
        const typed = line.substring(0, cursor.ch);
        const tokenStart = typed.search(/[^\s]+$/);
        if (tokenStart < 0) {
            return null;
        }

        const token = typed.substring(tokenStart);
        if (!token.startsWith(trigger)) {
            return null;
        }

        return {
            start: { line: cursor.line, ch: tokenStart },
            end: cursor,
            query: token.substring(trigger.length),
        };
    }

    async getSuggestions(context: EditorSuggestTriggerInfo): Promise<TemplateSuggestionItem[]> {
        const query = context.query.trim().toLowerCase();
        const folderPrefix = normalizeTemplateFolder(this.plugin.settings.templateCommand.templateFolder);
        const files = this.plugin.app.vault
            .getFiles()
            .filter((file) => file.path.startsWith(folderPrefix));

        const items = files
            .map((file) => ({
                id: file.path,
                title: getDisplayName(file),
                description: file.path,
                file,
            }))
            .sort((a, b) => a.title.localeCompare(b.title));

        if (!query) {
            return items;
        }

        return items.filter((item) => item.title.toLowerCase().includes(query));
    }

    renderSuggestion(item: TemplateSuggestionItem, el: HTMLElement): void {
        const titleEl = el.createEl("div", { text: item.title });
        titleEl.addClass("suggestion-title");
        const descEl = el.createEl("div", { text: item.description });
        descEl.addClass("suggestion-description", "wop-suggest-alias");
    }

    selectSuggestion(item: TemplateSuggestionItem): void {
        const context = this.context;
        if (!context || !context.editor) {
            return;
        }

        void this.insertTemplate(context.editor, context, item.file);
    }

    private async insertTemplate(editor: Editor, context: EditorSuggestTriggerInfo, file: TFile): Promise<void> {
        const from = { line: context.start.line, ch: context.start.ch };
        const to = { line: context.end.line, ch: context.end.ch };
        editor.replaceRange("", from, to);
        editor.setCursor(from);

        const content = await this.plugin.app.vault.cachedRead(file);
        editor.replaceRange(content, from, from);
    }
}
