import {
    App,
    Editor,
    EditorPosition,
    EditorSuggest,
    EditorSuggestTriggerInfo,
    Menu,
    Notice,
    TFile,
    TFolder,
    normalizePath,
} from "obsidian";
import type { MagicWikilinkSettings } from "./settings";

interface MagicWikilinkPluginApi {
    app: App;
    registerEditorSuggest: (suggest: EditorSuggest<WikilinkSuggestionItem>) => void;
    registerEvent: (eventRef: unknown) => void;
    settings: {
        magicWikilink: MagicWikilinkSettings;
    };
}

interface WikilinkSuggestionItem {
    title: string;
    path: string;
}

function isBoundaryChar(char: string): boolean {
    return /[\s.,!?;:()\[\]{}"'`]/.test(char);
}

function isFenceLine(line: string): boolean {
    const trimmed = line.trim();
    return trimmed.startsWith("```") || trimmed.startsWith("~~~");
}

function isInsideFencedCodeBlock(editor: Editor, lineNumber: number): boolean {
    let inFence = false;
    for (let line = 0; line <= lineNumber; line += 1) {
        if (isFenceLine(editor.getLine(line))) {
            inFence = !inFence;
        }
    }
    return inFence;
}

function buildTitleIndex(files: TFile[]): Map<string, string[]> {
    const index = new Map<string, string[]>();
    for (const file of files) {
        if (file.extension.toLowerCase() !== "md") {
            continue;
        }
        const lower = file.basename.toLowerCase();
        const list = index.get(lower) ?? [];
        list.push(file.basename);
        index.set(lower, list);
    }
    return index;
}

function sanitizeNoteTitle(input: string): string {
    return input
        .replace(/[\\/:*?"<>|]/g, " ")
        .replace(/\s+/g, " ")
        .trim();
}

class MagicWikilinkSuggest extends EditorSuggest<WikilinkSuggestionItem> {
    private plugin: MagicWikilinkPluginApi;

    constructor(plugin: MagicWikilinkPluginApi) {
        super(plugin.app);
        this.plugin = plugin;
    }

    onTrigger(cursor: EditorPosition, editor: Editor, _view: unknown): EditorSuggestTriggerInfo | null {
        const settings = this.plugin.settings.magicWikilink;
        if (!settings.enabled) {
            return null;
        }
        if (isInsideFencedCodeBlock(editor, cursor.line)) {
            return null;
        }

        const line = editor.getLine(cursor.line);
        const typed = line.substring(0, cursor.ch);
        const tokenStart = typed.search(/[^\s]+$/);
        if (tokenStart < 0) {
            return null;
        }

        const token = typed.substring(tokenStart);
        if (token.startsWith("[[") || token.includes("]")) {
            return null;
        }
        if (token.length < settings.minCharsForSuggest) {
            return null;
        }

        return {
            start: { line: cursor.line, ch: tokenStart },
            end: cursor,
            query: token,
        };
    }

    getSuggestions(context: EditorSuggestTriggerInfo): WikilinkSuggestionItem[] {
        const settings = this.plugin.settings.magicWikilink;
        const query = context.query.trim().toLowerCase();
        if (!query) {
            return [];
        }

        return this.plugin.app.vault
            .getMarkdownFiles()
            .map((file) => ({ title: file.basename, path: file.path }))
            .filter((item) => item.title.toLowerCase().includes(query))
            .sort((a, b) => a.title.localeCompare(b.title))
            .slice(0, settings.maxSuggestions);
    }

    renderSuggestion(item: WikilinkSuggestionItem, el: HTMLElement): void {
        const titleEl = el.createEl("div", { text: item.title });
        titleEl.addClass("suggestion-title");
        const descEl = el.createEl("div", { text: item.path });
        descEl.addClass("suggestion-description", "wop-suggest-alias");
    }

    selectSuggestion(item: WikilinkSuggestionItem): void {
        const context = this.context;
        if (!context?.editor) {
            return;
        }

        const editor = context.editor;
        const from = { line: editor.getCursor().line, ch: context.start.ch };
        const to = { line: editor.getCursor().line, ch: context.end.ch };
        editor.replaceRange(`[[${item.title}]]`, from, to);
    }
}

export class MagicWikilinkModule {
    private plugin: MagicWikilinkPluginApi;
    private applyingAutoReplace = false;

    constructor(plugin: MagicWikilinkPluginApi) {
        this.plugin = plugin;
    }

    register(): void {
        this.plugin.registerEditorSuggest(new MagicWikilinkSuggest(this.plugin));

        this.plugin.registerEvent(
            this.plugin.app.workspace.on("editor-change", (editor: Editor) => {
                this.onEditorChange(editor);
            }),
        );

        this.plugin.registerEvent(
            this.plugin.app.workspace.on("editor-menu", (menu: Menu, editor: Editor) => {
                this.onEditorMenu(menu, editor);
            }),
        );
    }

    private onEditorMenu(menu: Menu, editor: Editor): void {
        const settings = this.plugin.settings.magicWikilink;
        if (!settings.enabled || !settings.enableSelectionCreateLink) {
            return;
        }

        const selected = editor.getSelection().trim();
        if (!selected) {
            return;
        }

        menu.addItem((item) => {
            item
                .setTitle("Magic Wikilink: Create note from selection")
                .setIcon("file-plus")
                .onClick(() => {
                    void this.createNoteAndReplaceSelection(editor, selected);
                });
        });
    }

    private async createNoteAndReplaceSelection(editor: Editor, selectedText: string): Promise<void> {
        const title = sanitizeNoteTitle(selectedText);
        if (!title) {
            new Notice("Selection cannot be converted to a note title.");
            return;
        }

        const existing = this.findNoteByTitle(title);
        const noteFile = existing ?? (await this.createNoteFromTitle(title));
        if (!noteFile) {
            return;
        }

        editor.replaceSelection(`[[${noteFile.basename}]]`);
    }

    private findNoteByTitle(title: string): TFile | null {
        const lower = title.toLowerCase();
        const exact = this.plugin.app.vault
            .getMarkdownFiles()
            .find((file) => file.basename.toLowerCase() === lower);
        return exact ?? null;
    }

    private async createNoteFromTitle(title: string): Promise<TFile | null> {
        const folder = this.resolveTargetFolderFromSourceNote();
        await this.ensureFolderExists(folder);

        const path = folder ? normalizePath(`${folder}/${title}.md`) : normalizePath(`${title}.md`);
        const already = this.plugin.app.vault.getAbstractFileByPath(path);
        if (already instanceof TFile) {
            return already;
        }

        const content = `# ${title}\n\n`;
        return this.plugin.app.vault.create(path, content);
    }

    private resolveTargetFolderFromSourceNote(): string {
        const active = this.plugin.app.workspace.getActiveFile();
        if (active && active.extension.toLowerCase() === "md") {
            const parent = active.parent;
            const parentName = parent?.name?.toLowerCase() ?? "";
            const noteName = active.basename.toLowerCase();
            const isFolderNote = parentName.length > 0 && parentName === noteName;

            if (isFolderNote) {
                const grandParentPath = this.toFolderPath(parent?.parent ?? null);
                return grandParentPath;
            }

            return this.toFolderPath(parent ?? null);
        }

        return normalizePath(this.plugin.settings.magicWikilink.newNoteFolder || "").replace(/^\/+|\/+$/g, "");
    }

    private toFolderPath(folder: TFolder | null): string {
        if (!folder) {
            return "";
        }

        // Obsidian root folder path is '/', use empty for vault root operations.
        if (folder.path === "/") {
            return "";
        }

        return normalizePath(folder.path).replace(/^\/+|\/+$/g, "");
    }

    private async ensureFolderExists(folderPath: string): Promise<void> {
        if (!folderPath) {
            return;
        }

        const segments = folderPath.split("/").filter(Boolean);
        let current = "";
        for (const segment of segments) {
            current = current ? `${current}/${segment}` : segment;
            const existing = this.plugin.app.vault.getAbstractFileByPath(current);
            if (!existing) {
                await this.plugin.app.vault.createFolder(current);
            }
            if (existing && !(existing instanceof TFolder)) {
                new Notice(`Cannot create folder '${folderPath}' because '${current}' is a file.`);
                return;
            }
        }
    }

    private onEditorChange(editor: Editor): void {
        if (this.applyingAutoReplace) {
            return;
        }

        const settings = this.plugin.settings.magicWikilink;
        if (!settings.enabled || !settings.autoConvertOnBoundary) {
            return;
        }

        const cursor = editor.getCursor();
        if (isInsideFencedCodeBlock(editor, cursor.line)) {
            return;
        }
        const line = editor.getLine(cursor.line);
        const beforeCursor = line.substring(0, cursor.ch);
        if (beforeCursor.length < 2) {
            return;
        }

        const lastChar = beforeCursor.substring(beforeCursor.length - 1);
        if (!isBoundaryChar(lastChar)) {
            return;
        }

        const withoutBoundary = beforeCursor.substring(0, beforeCursor.length - 1);
        const match = withoutBoundary.match(/(^|[\s([{"'`])([^\s\[\]]+)$/);
        if (!match) {
            return;
        }

        const keyword = match[2] ?? "";
        if (!keyword || keyword.length < settings.minCharsForSuggest) {
            return;
        }

        const tokenStart = withoutBoundary.length - keyword.length;
        if (tokenStart >= 2 && withoutBoundary.substring(tokenStart - 2, tokenStart) === "[[") {
            return;
        }

        const files = this.plugin.app.vault.getMarkdownFiles();
        const titleIndex = buildTitleIndex(files);
        const candidates = titleIndex.get(keyword.toLowerCase()) ?? [];
        if (candidates.length !== 1) {
            return;
        }

        const targetTitle = candidates[0];
        const from = { line: cursor.line, ch: tokenStart };
        const to = { line: cursor.line, ch: tokenStart + keyword.length };

        this.applyingAutoReplace = true;
        try {
            editor.replaceRange(`[[${targetTitle}]]`, from, to);
        } finally {
            this.applyingAutoReplace = false;
        }
    }
}
