import { Editor, EditorPosition, EditorSuggest, EditorSuggestTriggerInfo } from "obsidian";
import MyPlugin from "../main";

export interface SlashCommandItem {
    id: string;
    title: string;
    description?: string;
    value: string;
    run: (editor: Editor, context: EditorSuggestTriggerInfo) => void;
}

export class SlashCommandSuggest extends EditorSuggest<SlashCommandItem> {
    plugin: MyPlugin;
    private activeGroupId: string | null = null;

    constructor(plugin: MyPlugin) {
        super(plugin.app);
        this.plugin = plugin;
    }

    onTrigger(cursor: EditorPosition, editor: Editor, _view: any): EditorSuggestTriggerInfo | null {
        if (!this.plugin.settings.enabled) {
            this.activeGroupId = null;
            return null;
        }

        const line = editor.getLine(cursor.line);
        const typed = line.substring(0, cursor.ch);
        const tokenStart = typed.search(/[^\s]+$/);
        if (tokenStart < 0) {
            this.activeGroupId = null;
            return null;
        }

        const token = typed.substring(tokenStart);
        const groups = this.plugin.settings.triggerGroups.filter((group) => group.enabled);
        const group = groups.find((entry) => token.startsWith(entry.trigger));
        if (!group) {
            this.activeGroupId = null;
            return null;
        }

        this.activeGroupId = group.id;
        const startPos = { line: cursor.line, ch: tokenStart };
        const query = token.substring(group.trigger.length);
        return {
            start: startPos,
            end: cursor,
            query
        };
    }

    getSuggestions(context: EditorSuggestTriggerInfo): SlashCommandItem[] {
        if (!this.activeGroupId) {
            return [];
        }

        const query = context.query.trim().toLowerCase();
        const group = this.plugin.settings.triggerGroups.find((entry) => entry.id === this.activeGroupId);
        if (!group) {
            return [];
        }

        const commands = group.commands
            .filter((cmd) => cmd.enabled && cmd.command.trim().length > 0)
            .map((cmd) => ({
                id: cmd.id,
                title: cmd.command,
                description: cmd.alias || undefined,
                value: cmd.value,
                run: (editor: Editor) => {
                    const output = cmd.value.includes("{{date}}")
                        ? cmd.value.split("{{date}}").join(new Date().toISOString().slice(0, 10))
                        : cmd.value;
                    editor.replaceSelection(output);
                }
            }));

        if (!query) return commands;
        return commands.filter((cmd) =>
            cmd.title.toLowerCase().includes(query) ||
            (cmd.description?.toLowerCase() ?? "").includes(query),
        );
    }

    renderSuggestion(item: SlashCommandItem, el: HTMLElement): void {
        const titleEl = el.createEl("div", { text: item.title });
        titleEl.addClass("suggestion-title");
        if (item.description) {
            const descEl = el.createEl("div", { text: item.description });
            descEl.addClass("suggestion-description");
        }
    }

    selectSuggestion(item: SlashCommandItem): void {
        const context = this.context;
        if (!context) return;

        const editor = context.editor;
        if (!editor) return;

        // Remove the hotkey trigger and any query text that was typed.
        const from = { line: editor.getCursor().line, ch: context.start.ch };
        const to = { line: editor.getCursor().line, ch: context.end.ch };
        editor.replaceRange("", from, to);
        editor.setCursor(from);

        item.run(editor, context);
        this.activeGroupId = null;
    }
}
