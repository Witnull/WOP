
import { App, Notice, Setting, TFolder } from "obsidian";
import type { FileTreeColoringModule } from "./fileTreeColoring";

interface FileTreeColoringSettingsPluginApi {
    app: App;
    settings: {
        fileTreeColoring: FileTreeColorSettings;
    };
    saveSettings: () => Promise<void>;
    fileTreeColoring: FileTreeColoringModule;
}

export interface FileTreeGradientSettings {
    backgroundStart: string;
    backgroundEnd: string;
    textColor: string;
}

export interface FileTreeColorSettings {
    enabled: boolean;
    folder: FileTreeGradientSettings;
    note: FileTreeGradientSettings;
    textColor: string;
    backgroundOpacity: number;
    folderSeeds: Record<string, string>;
}

const DEFAULT_FOLDER_SETTINGS: FileTreeGradientSettings = {
    backgroundStart: "#0f766e",
    backgroundEnd: "#14b8a6",
    textColor: "#f8fafc",
};

const DEFAULT_NOTE_SETTINGS: FileTreeGradientSettings = {
    backgroundStart: "#1d4ed8",
    backgroundEnd: "#38bdf8",
    textColor: "#f8fafc",
};

export const DEFAULT_FILE_TREE_COLOR_SETTINGS: FileTreeColorSettings = {
    enabled: true,
    folder: DEFAULT_FOLDER_SETTINGS,
    note: DEFAULT_NOTE_SETTINGS,
    textColor: "#f8fafc",
    backgroundOpacity: 0.72,
    folderSeeds: {},
};

function clamp(value: number, min: number, max: number): number {
    return Math.min(max, Math.max(min, value));
}

function normalizeColor(value: unknown, fallback: string): string {
    const text = String(value ?? "").trim();
    return text.length > 0 ? text : fallback;
}

function normalizeOpacity(value: unknown, fallback: number): number {
    const parsed = Number(value);

    if (!Number.isFinite(parsed)) {
        return fallback;
    }

    return clamp(parsed, 0.05, 1);
}

function normalizeGradientSettings(
    data: Partial<FileTreeGradientSettings> | null | undefined,
    fallback: FileTreeGradientSettings,
): FileTreeGradientSettings {
    return {
        backgroundStart: normalizeColor(
            data?.backgroundStart,
            fallback.backgroundStart,
        ),
        backgroundEnd: normalizeColor(
            data?.backgroundEnd,
            fallback.backgroundEnd,
        ),
        textColor: normalizeColor(
            data?.textColor,
            fallback.textColor,
        ),
    };
}

function normalizeSeedMap(value: unknown): Record<string, string> {
    if (!value || typeof value !== "object") {
        return {};
    }

    return Object.entries(value as Record<string, unknown>).reduce<
        Record<string, string>
    >((accumulator, [key, rawValue]) => {
        const normalizedKey = String(key ?? "").trim();
        const normalizedValue = String(rawValue ?? "").trim();

        if (!normalizedKey || !normalizedValue) {
            return accumulator;
        }

        accumulator[normalizedKey] = normalizedValue;

        return accumulator;
    }, {});
}

export function normalizeFileTreeColorSettings(
    data: Partial<FileTreeColorSettings> | null | undefined,
): FileTreeColorSettings {
    return {
        enabled:
            typeof data?.enabled === "boolean"
                ? data.enabled
                : DEFAULT_FILE_TREE_COLOR_SETTINGS.enabled,

        folder: normalizeGradientSettings(
            data?.folder,
            DEFAULT_FOLDER_SETTINGS,
        ),

        note: normalizeGradientSettings(
            data?.note,
            DEFAULT_NOTE_SETTINGS,
        ),

        textColor: normalizeColor(
            data?.textColor,
            DEFAULT_FILE_TREE_COLOR_SETTINGS.textColor,
        ),

        backgroundOpacity: normalizeOpacity(
            data?.backgroundOpacity,
            DEFAULT_FILE_TREE_COLOR_SETTINGS.backgroundOpacity,
        ),

        folderSeeds: normalizeSeedMap(data?.folderSeeds),
    };
}

function readFileAsText(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();

        reader.onload = () => {
            resolve(String(reader.result ?? ""));
        };

        reader.onerror = () => {
            reject(reader.error ?? new Error("Unable to read file."));
        };

        reader.readAsText(file);
    });
}

function createSeedValue(): string {
    return `${Date.now().toString(36)}-${Math.random()
        .toString(36)
        .slice(2, 10)}`;
}

export class FileTreeColorSettingsRenderer {
    constructor(
        private readonly plugin: FileTreeColoringSettingsPluginApi,
    ) {}

    render(containerEl: HTMLElement): void {
        containerEl.empty();

        const panel = containerEl.createDiv({
            cls: "wop-filetree-panel",
        });

        this.renderGeneralSettings(panel);
        this.renderFolderPreview(panel);
        this.renderImportExport(panel);
    }

    private renderGeneralSettings(panel: HTMLElement): void {
        panel.createEl("h2", {
            text: "File Tree Coloring",
        });

        new Setting(panel)
            .setName("Enable coloring")
            .setDesc(
                "Apply deterministic colors to folders and notes in the file explorer.",
            )
            .addToggle((toggle) => {
                toggle
                    .setValue(
                        this.plugin.settings.fileTreeColoring.enabled,
                    )
                    .onChange(async (value) => {
                        this.plugin.settings.fileTreeColoring.enabled =
                            value;

                        await this.saveAndRefresh();
                    });
            });

        new Setting(panel)
            .setName("Text color")
            .setDesc(
                "Global text color applied to all file tree entries.",
            )
            .addColorPicker((picker) => {
                picker
                    .setValue(
                        this.plugin.settings.fileTreeColoring.textColor,
                    )
                    .onChange(async (value) => {
                        this.plugin.settings.fileTreeColoring.textColor =
                            value;

                        await this.saveAndRefresh();
                    });
            });

        new Setting(panel)
            .setName("Background opacity")
            .setDesc(
                "Control folder and file background transparency.",
            )
            .addSlider((slider) => {
                slider
                    .setLimits(0.1, 1, 0.05)
                    .setDynamicTooltip()
                    .setValue(
                        this.plugin.settings.fileTreeColoring
                            .backgroundOpacity,
                    )
                    .onChange(async (value) => {
                        this.plugin.settings.fileTreeColoring.backgroundOpacity =
                            Number(value.toFixed(2));

                        await this.saveAndRefresh();
                    });
            });
    }

    private renderFolderPreview(panel: HTMLElement): void {
        panel.createEl("hr");

        panel.createEl("h3", {
            text: "Top-level folders",
        });

        panel.createEl("p", {
            text: "Repick generates a new deterministic color seed for the selected root folder.",
        });

        const folders = this.plugin.app.vault
            .getRoot()
            .children.filter(
                (child): child is TFolder => child instanceof TFolder,
            );

        if (folders.length === 0) {
            panel.createEl("p", {
                text: "No top-level folders found.",
            });

            return;
        }

        folders.forEach((folder) => {
            const color =
                this.plugin.fileTreeColoring.getMainFolderColor(
                    folder.path,
                );

            const setting = new Setting(panel)
                .setName(folder.name)
                .setDesc(folder.path);

            const swatch = setting.controlEl.createDiv({
                cls: "wop-filetree-swatch",
            });

            swatch.style.width = "32px";
            swatch.style.height = "20px";
            swatch.style.borderRadius = "6px";
            swatch.style.marginRight = "12px";
            swatch.style.background = color;

            setting.controlEl.createSpan({
                text: color,
            });

            setting.addButton((button) => {
                button
                    .setButtonText("Repick")
                    .setCta()
                    .onClick(async () => {
                        this.repickFolderColor(folder.path);

                        await this.saveAndRefresh();

                        new Notice(
                            `Updated color seed for ${folder.name}`,
                        );
                    });
            });
        });
    }

    private renderImportExport(panel: HTMLElement): void {
        panel.createEl("hr");

        panel.createEl("h3", {
            text: "Backup and Restore",
        });

        const setting = new Setting(panel)
            .setName("Import / Export")
            .setDesc(
                "Export settings to JSON or import a previously saved configuration.",
            );

        setting.addButton((button) => {
            button
                .setButtonText("Export")
                .onClick(() => {
                    this.exportSettingsJson();
                });
        });

        setting.addButton((button) => {
            button
                .setButtonText("Import")
                .setWarning()
                .onClick(async () => {
                    await this.importSettingsJson();
                });
        });
    }

    private repickFolderColor(folderPath: string): void {
        const normalized = folderPath
            .trim()
            .replace(/\\/g, "/")
            .replace(/\/+$/, "");

        if (!normalized) {
            return;
        }

        this.plugin.settings.fileTreeColoring.folderSeeds[
            normalized
        ] = createSeedValue();
    }

    private async saveAndRefresh(): Promise<void> {
        await this.plugin.saveSettings();
        this.plugin.fileTreeColoring.refresh();
    }

    private exportSettingsJson(): void {
        const data = JSON.stringify(
            this.plugin.settings.fileTreeColoring,
            null,
            2,
        );

        const blob = new Blob([data], {
            type: "application/json",
        });

        const url = URL.createObjectURL(blob);

        const link = document.createElement("a");

        link.href = url;
        link.download = "file-tree-color-settings.json";

        document.body.appendChild(link);

        link.click();

        link.remove();

        URL.revokeObjectURL(url);

        new Notice("Exported settings.");
    }

    private async importSettingsJson(): Promise<void> {
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

                const parsed = JSON.parse(
                    raw,
                ) as Partial<FileTreeColorSettings>;

                this.plugin.settings.fileTreeColoring =
                    normalizeFileTreeColorSettings(parsed);

                await this.saveAndRefresh();

                new Notice("Imported settings successfully.");
            } catch (error) {
                console.error(error);

                new Notice(
                    "Failed to import settings. Invalid JSON file.",
                );
            }
        });

        input.click();
    }
}
