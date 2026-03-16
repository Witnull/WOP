import { Setting } from "obsidian";

interface MagicWikilinkSettingsPluginApi {
    settings: {
        magicWikilink: MagicWikilinkSettings;
    };
    saveSettings: () => Promise<void>;
}

export interface MagicWikilinkSettings {
    enabled: boolean;
    autoConvertOnBoundary: boolean;
    minCharsForSuggest: number;
    maxSuggestions: number;
    enableSelectionCreateLink: boolean;
    newNoteFolder: string;
}

export const DEFAULT_MAGIC_WIKILINK_SETTINGS: MagicWikilinkSettings = {
    enabled: true,
    autoConvertOnBoundary: true,
    minCharsForSuggest: 2,
    maxSuggestions: 8,
    enableSelectionCreateLink: true,
    newNoteFolder: "",
};

function toNumberOrDefault(value: unknown, fallback: number): number {
    const asNumber = Number(value);
    return Number.isFinite(asNumber) ? asNumber : fallback;
}

export function normalizeMagicWikilinkSettings(
    data: Partial<MagicWikilinkSettings> | null | undefined,
): MagicWikilinkSettings {
    const minChars = Math.max(1, Math.min(12, Math.floor(toNumberOrDefault(data?.minCharsForSuggest, 2))));
    const maxSuggestions = Math.max(1, Math.min(20, Math.floor(toNumberOrDefault(data?.maxSuggestions, 8))));

    return {
        enabled: data?.enabled ?? DEFAULT_MAGIC_WIKILINK_SETTINGS.enabled,
        autoConvertOnBoundary: data?.autoConvertOnBoundary ?? DEFAULT_MAGIC_WIKILINK_SETTINGS.autoConvertOnBoundary,
        minCharsForSuggest: minChars,
        maxSuggestions,
        enableSelectionCreateLink:
            data?.enableSelectionCreateLink ?? DEFAULT_MAGIC_WIKILINK_SETTINGS.enableSelectionCreateLink,
        newNoteFolder: (data?.newNoteFolder ?? DEFAULT_MAGIC_WIKILINK_SETTINGS.newNoteFolder).trim(),
    };
}

export class MagicWikilinkSettingsRenderer {
    private plugin: MagicWikilinkSettingsPluginApi;

    constructor(plugin: MagicWikilinkSettingsPluginApi) {
        this.plugin = plugin;
    }

    render(containerEl: HTMLElement): void {
        new Setting(containerEl)
            .setName("Enable magic wikilink")
            .setDesc("Turn wikilink autocomplete and auto-convert on or off.")
            .addToggle((toggle) =>
                toggle.setValue(this.plugin.settings.magicWikilink.enabled).onChange(async (value) => {
                    this.plugin.settings.magicWikilink.enabled = value;
                    await this.plugin.saveSettings();
                }),
            );

        new Setting(containerEl)
            .setName("Auto convert on boundary")
            .setDesc("When you finish a keyword with space or punctuation, convert it into a wikilink if a note title matches.")
            .addToggle((toggle) =>
                toggle.setValue(this.plugin.settings.magicWikilink.autoConvertOnBoundary).onChange(async (value) => {
                    this.plugin.settings.magicWikilink.autoConvertOnBoundary = value;
                    await this.plugin.saveSettings();
                }),
            );

        new Setting(containerEl)
            .setName("Minimum chars for suggestions")
            .setDesc("How many characters are needed before suggestion popup appears.")
            .addText((text) => {
                text.inputEl.addClass("wop-responsive-input");
                return text
                    .setPlaceholder("2")
                    .setValue(String(this.plugin.settings.magicWikilink.minCharsForSuggest))
                    .onChange(async (value) => {
                        const parsed = normalizeMagicWikilinkSettings({
                            ...this.plugin.settings.magicWikilink,
                            minCharsForSuggest: Number(value),
                        });
                        this.plugin.settings.magicWikilink.minCharsForSuggest = parsed.minCharsForSuggest;
                        text.setValue(String(parsed.minCharsForSuggest));
                        await this.plugin.saveSettings();
                    });
            });

        new Setting(containerEl)
            .setName("Maximum suggestions")
            .setDesc("Maximum wikilink suggestions shown in popup.")
            .addText((text) => {
                text.inputEl.addClass("wop-responsive-input");
                return text
                    .setPlaceholder("8")
                    .setValue(String(this.plugin.settings.magicWikilink.maxSuggestions))
                    .onChange(async (value) => {
                        const parsed = normalizeMagicWikilinkSettings({
                            ...this.plugin.settings.magicWikilink,
                            maxSuggestions: Number(value),
                        });
                        this.plugin.settings.magicWikilink.maxSuggestions = parsed.maxSuggestions;
                        text.setValue(String(parsed.maxSuggestions));
                        await this.plugin.saveSettings();
                    });
            });

        new Setting(containerEl)
            .setName("Selection to note and wikilink")
            .setDesc("Add an editor menu action that creates a note from selected text and replaces it with a wikilink.")
            .addToggle((toggle) =>
                toggle.setValue(this.plugin.settings.magicWikilink.enableSelectionCreateLink).onChange(async (value) => {
                    this.plugin.settings.magicWikilink.enableSelectionCreateLink = value;
                    await this.plugin.saveSettings();
                }),
            );

        new Setting(containerEl)
            .setName("New note folder")
            .setDesc("Fallback folder when source-note location cannot be resolved. Leave empty to use vault root.")
            .addText((text) => {
                text.inputEl.addClass("wop-responsive-input");
                return text
                    .setPlaceholder("")
                    .setValue(this.plugin.settings.magicWikilink.newNoteFolder)
                    .onChange(async (value) => {
                        this.plugin.settings.magicWikilink.newNoteFolder = value.trim();
                        await this.plugin.saveSettings();
                    });
            });
    }
}
