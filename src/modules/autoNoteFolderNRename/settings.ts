import { Setting } from "obsidian";
import type MyPlugin from "../../main";

export interface autoFolderNoteAndRenameSettings {
    enabled: boolean;

    imageNameFormat: string;

    imageAlign:
        | "center"
        | "left"
        | "right";
}

export const DEFAULT_AUTO_FOLDER_RENAME_SETTINGS: autoFolderNoteAndRenameSettings = {
    enabled: true,

    imageNameFormat: "{noteName}_{counter}",

    imageAlign: "center",
};

export function normalizeautoFolderNoteAndRenameSettings(
    data?: Partial<autoFolderNoteAndRenameSettings>,
): autoFolderNoteAndRenameSettings {
    return {
        enabled:
            data?.enabled ??
            DEFAULT_AUTO_FOLDER_RENAME_SETTINGS.enabled,

        imageNameFormat:
            data?.imageNameFormat ??
            DEFAULT_AUTO_FOLDER_RENAME_SETTINGS.imageNameFormat,

        imageAlign:
            data?.imageAlign ??
            DEFAULT_AUTO_FOLDER_RENAME_SETTINGS.imageAlign,
    };
}

export class autoFolderNoteAndRenameSettingsRenderer {
    constructor(
        private plugin: MyPlugin,
    ) {}

    render(
        containerEl: HTMLElement,
        refresh: () => void,
    ) {
        const settings =
            this.plugin.settings.autoFolderNoteAndRename;

        new Setting(containerEl)
            .setName("Enable module")
            .setDesc(
                "Automatically convert notes to folder notes and rename pasted images",
            )
            .addToggle((toggle) =>
                toggle
                    .setValue(settings.enabled)
                    .onChange(async (value) => {
                        settings.enabled = value;

                        await this.plugin.saveSettings();

                        this.plugin.autoFolderRename
                            ?.updateEnabledState();

                        refresh();
                    }),
            );

        new Setting(containerEl)
            .setName("Default image name format")
            .setDesc(
                "{noteName}, {counter}, {date}, {time}",
            )
            .addText((text) =>
                text
                    .setValue(
                        settings.imageNameFormat,
                    )
                    .setPlaceholder(
                        "{noteName}_{counter}",
                    )
                    .onChange(async (value) => {
                        settings.imageNameFormat =
                            value.trim() ||
                            "{noteName}_{counter}";

                        await this.plugin.saveSettings();
                    }),
            );

        new Setting(containerEl)
            .setName("Default image alignment")
            .addDropdown((dropdown) =>
                dropdown
                    .addOption(
                        "center",
                        "Center",
                    )
                    .addOption(
                        "left",
                        "Left",
                    )
                    .addOption(
                        "right",
                        "Right",
                    )
                    .setValue(
                        settings.imageAlign,
                    )
                    .onChange(async (value) => {
                        settings.imageAlign =
                            value as
                                | "center"
                                | "left"
                                | "right";

                        await this.plugin.saveSettings();
                    }),
            );
    }
}