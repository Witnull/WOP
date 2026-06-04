import { App, Setting } from "obsidian";

interface PerNoteEncryptSettingsPluginApi {
    app: App;
    settings: {
        perNoteEncrypt: PerNoteEncryptSettings;
    };
    saveSettings: () => Promise<void>;
}

export interface PerNoteEncryptSettings {
    enabled: boolean;
}

export const DEFAULT_PER_NOTE_ENCRYPT_SETTINGS: PerNoteEncryptSettings = {
    enabled: false,
};

export function normalizePerNoteEncryptSettings(data: Partial<PerNoteEncryptSettings> | null | undefined): PerNoteEncryptSettings {
    return {
        enabled: data?.enabled ?? DEFAULT_PER_NOTE_ENCRYPT_SETTINGS.enabled,
    };
}

export class PerNoteEncryptSettingsRenderer {
    private plugin: PerNoteEncryptSettingsPluginApi;

    constructor(plugin: PerNoteEncryptSettingsPluginApi) {
        this.plugin = plugin;
    }

    render(containerEl: HTMLElement): void {
        containerEl.empty();

        new Setting(containerEl)
            .setName("Enable per-note encryption (AES-256-GCM)")
            .setDesc("Only notes that already contain a non-empty 'enc' frontmatter value will be encrypted. The 'enc' value will be the password. This stores the password plaintext in frontmatter — ensure you understand the security implications.")
            .addToggle((toggle) =>
                toggle.setValue(this.plugin.settings.perNoteEncrypt.enabled).onChange(async (value) => {
                    this.plugin.settings.perNoteEncrypt.enabled = value;
                    await this.plugin.saveSettings();
                }),
            );
    }
}
