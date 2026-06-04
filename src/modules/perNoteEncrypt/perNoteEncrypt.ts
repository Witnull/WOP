import { ButtonComponent, MarkdownView, Notice, Plugin, TFile } from "obsidian";
import { NoteController } from "./noteController";
import MyPlugin from "main";

export class PerNoteEncryptModule {
    private static instance: PerNoteEncryptModule | null = null;
    private plugin: MyPlugin;
    private controller?: NoteController;
    private headerHost?: HTMLElement;
    private headerToken = 0;
    private commandsRegistered = false;
    private boundSyncHeader: () => void;

    private constructor(plugin: MyPlugin) {
        this.plugin = plugin;
        this.boundSyncHeader = () => {
            void this.syncHeaderButtons();
        };
    }

    public static getInstance(plugin: MyPlugin): PerNoteEncryptModule {
        if (!PerNoteEncryptModule.instance) {
            PerNoteEncryptModule.instance = new PerNoteEncryptModule(plugin);
        }
        return PerNoteEncryptModule.instance;
    }

    async register(): Promise<void> {
        // If already registered, destroy first to avoid duplicates
        if (this.controller) {
            this.destroy();
        }

        try {
            this.controller = new NoteController(this.plugin);
            await this.controller.initialize();
            this.controller.registerMarkdownProcessor();

            this.registerCommands();
            this.registerHeaderButtonSync();

            // Register editor context menu (fired every time, but our controller prevents duplicate dialogs)
            this.plugin.registerEvent(
                this.plugin.app.workspace.on("editor-menu", async (menu, _editor, view) => {
                    try {
                        const file = (view as any)?.file as TFile | null;
                        if (!file) return;

                        const isEncrypted = await this.controller?.isNoteEncrypted(file.path);
                        if (!isEncrypted) {
                            menu.addItem((item) =>
                                item
                                    .setTitle("Encrypt Note")
                                    .setIcon("lock")
                                    .onClick(() => {
                                        void this.controller?.promptEncrypt(file);
                                    })
                            );
                            return;
                        }

                        const unlocked = this.controller?.isNoteUnlocked(file.path);
                        if (unlocked) {
                            menu.addItem((item) =>
                                item
                                    .setTitle("Lock Note")
                                    .setIcon("lock")
                                    .onClick(() => {
                                        void this.controller?.lockNote(file);
                                    })
                            );
                            menu.addItem((item) =>
                                item
                                    .setTitle("Reset Password")
                                    .setIcon("settings")
                                    .onClick(() => {
                                        void this.controller?.resetPassword(file);
                                    })
                            );
                        } else {
                            menu.addItem((item) =>
                                item
                                    .setTitle("Unlock Note")
                                    .setIcon("unlock")
                                    .onClick(() => {
                                        void this.controller?.promptUnlock(file);
                                    })
                            );
                        }
                    } catch (error) {
                        this.reportError("Editor menu error", error);
                    }
                })
            );

            new Notice("Per-note encryption module loaded");
        } catch (error) {
            this.reportError("Per-note encryption module failed to load", error);
            throw error;
        }
    }

    destroy(): void {
        // Destroy controller (removes event listeners, clears timers)
        this.controller?.destroy();
        this.controller = undefined;

        // Remove header buttons from DOM
        this.headerHost?.remove();
        this.headerHost = undefined;

        // Unregister commands (Obsidian doesn't provide a direct API, but we can reset the flag)
        this.commandsRegistered = false;

        // Note: Markdown post-processor cannot be removed easily; but since we destroy the controller,
        // any future calls will be harmless or will re-init cleanly.
    }

    private reportError(message: string, error: unknown): void {
        console.error(message, error);
        new Notice(`${message}: ${error}`);
    }

    private registerCommands(): void {
        if (this.commandsRegistered) return;
        this.commandsRegistered = true;

        this.plugin.addCommand({
            id: "per-note-encrypt-current-note",
            name: "Encrypt current note",
            callback: () => {
                void this.encryptCurrentNote();
            },
        });

        this.plugin.addCommand({
            id: "per-note-unlock-current-note",
            name: "Unlock current note",
            callback: () => {
                void this.unlockCurrentNote();
            },
        });

        this.plugin.addCommand({
            id: "per-note-reset-current-note-password",
            name: "Reset current note password",
            callback: () => {
                void this.resetCurrentNotePassword();
            },
        });
    }

    private registerHeaderButtonSync(): void {
        // Sync when active leaf changes or file opens
        this.plugin.registerEvent(this.plugin.app.workspace.on("active-leaf-change", this.boundSyncHeader));
        this.plugin.registerEvent(this.plugin.app.workspace.on("file-open", this.boundSyncHeader));
        this.plugin.app.workspace.onLayoutReady(this.boundSyncHeader);
    }

    private getActiveMarkdownFile(): TFile | null {
        const view = this.plugin.app.workspace.getActiveViewOfType(MarkdownView);
        return view?.file ?? null;
    }

    private async encryptCurrentNote(): Promise<void> {
        try {
            const file = this.getActiveMarkdownFile();
            if (!file) {
                new Notice("Open a note first");
                return;
            }
            const encrypted = await this.controller?.isNoteEncrypted(file.path);
            if (encrypted) {
                new Notice("Note is already encrypted");
                return;
            }
            await this.controller?.promptEncrypt(file);
            await this.syncHeaderButtons();
        } catch (error) {
            this.reportError("Encrypt current note failed", error);
        }
    }

    private async unlockCurrentNote(): Promise<void> {
        try {
            const file = this.getActiveMarkdownFile();
            if (!file) {
                new Notice("Open a note first");
                return;
            }
            const encrypted = await this.controller?.isNoteEncrypted(file.path);
            if (!encrypted) {
                new Notice("This note is not encrypted");
                return;
            }
            await this.controller?.promptUnlock(file);
            await this.syncHeaderButtons();
        } catch (error) {
            this.reportError("Unlock current note failed", error);
        }
    }

    private async resetCurrentNotePassword(): Promise<void> {
        try {
            const file = this.getActiveMarkdownFile();
            if (!file) {
                new Notice("Open a note first");
                return;
            }
            const encrypted = await this.controller?.isNoteEncrypted(file.path);
            if (!encrypted) {
                new Notice("This note is not encrypted");
                return;
            }
            if (!this.controller?.isNoteUnlocked(file.path)) {
                new Notice("Unlock the note before resetting the password");
                return;
            }
            await this.controller?.resetPassword(file);
            await this.syncHeaderButtons();
        } catch (error) {
            this.reportError("Reset current note password failed", error);
        }
    }

    private async syncHeaderButtons(): Promise<void> {
        try {
            const view = this.plugin.app.workspace.getActiveViewOfType(MarkdownView);
            const file = view?.file ?? null;
            if (!view || !file || !view.containerEl) {
                this.clearHeaderButtons();
                return;
            }

            const header = view.containerEl.querySelector(".view-header") as HTMLElement | null;
            const actions = header?.querySelector(".view-actions") as HTMLElement | null;
            if (!header || !actions || !this.controller) {
                this.clearHeaderButtons();
                return;
            }

            const token = ++this.headerToken;
            const encrypted = await this.controller.isNoteEncrypted(file.path);
            if (token !== this.headerToken) return;

            const unlocked = encrypted && this.controller.isNoteUnlocked(file.path);
            this.renderHeaderButtons(actions, file, encrypted, unlocked);
        } catch (error) {
            this.reportError("Header buttons sync failed", error);
        }
    }

    private clearHeaderButtons(): void {
        this.headerHost?.remove();
        this.headerHost = undefined;
    }

    private renderHeaderButtons(
        actions: HTMLElement,
        file: TFile,
        encrypted: boolean,
        unlocked: boolean
    ): void {
        // Remove previous host if any
        this.headerHost?.remove();

        const host = document.createElement("div");
        host.className = "wop-per-note-encrypt-header-actions";

        const addButton = (icon: string, label: string, onClick: () => void) => {
            new ButtonComponent(host).setIcon(icon).setTooltip(label).onClick(onClick);
        };

        if (!encrypted) {
            addButton("lock", "Encrypt note", () => {
                void this.controller?.promptEncrypt(file);
            });
        } else if (!unlocked) {
            addButton("unlock", "Unlock note", () => {
                void this.controller?.promptUnlock(file);
            });
        } else {
            addButton("lock", "Lock note", () => {
                void this.controller?.lockNote(file);
            });
            addButton("refresh-cw", "Reset password", () => {
                void this.controller?.resetPassword(file);
            });
        }

        actions.appendChild(host);
        this.headerHost = host;
    }
}