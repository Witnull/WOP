// import {
//     App,
//     MarkdownView,
//     Notice,
//     TFile,
// } from "obsidian";

// import {
//     decryptPayload,
//     encryptPayload,
//     encryptWithExistingKey,
//     reencryptPayload,
//     sha256Hex,
//     uuid,
// } from "./crypto";

// import {
//     EncStore,
// } from "./encStore";

// import {
//     buildPlaceholder,
//     isPlaceholder,
// } from "./placeholder";

// import {
//     PasswordModal,
//     ResetPasswordModal,
// } from "./passwordModal";

// import {
//     RuntimeStore,
// } from "./runtime";
// import { PerNoteEncryptModule } from "./perNoteEncrypt";
// import { Plugin } from 'obsidian';
// import MyPlugin from "main";


// export class NoteController {

//     private plugin: MyPlugin;
//     private app: App;

//     private store: EncStore;
//     private runtime =
//         new RuntimeStore();

//     private internalWrite =
//         new Set<string>();

//     private activeFile:
//         string | null = null;

//     private markdownProcessorRegistered =
//         false;

//     private openUnlockDialogs =
//         new Set<string>();

//     constructor(
//         plugin: MyPlugin
//     ) {
//         this.plugin = plugin;
//         this.app = this.plugin.app;
//         this.store =
//             new EncStore(
//                 this.app,
//             );
//     }

//     // async initialize(): Promise<void> {
//     //     await this.store.initialize();

//     //     this.app.vault.on(
//     //         "rename",
//     //         async (
//     //             file,
//     //             oldPath,
//     //         ) => {
//     //             if (
//     //                 !(file instanceof TFile)
//     //             ) {
//     //                 return;
//     //             }

//     //             await this.store.updatePath(
//     //                 oldPath,
//     //                 file.path,
//     //             );
//     //         },
//     //     );

//     //     this.app.workspace.on(
//     //         "file-open",
//     //         (
//     //             file,
//     //         ) => {
//     //             void this.onFileOpen(
//     //                 file as
//     //                 | TFile
//     //                 | null,
//     //             );
//     //         },
//     //     );

//     //     this.app.workspace.on(
//     //         "editor-change",
//     //         (
//     //             editor,
//     //         ) => {
//     //             const view =
//     //                 this.app.workspace.getActiveViewOfType(
//     //                     MarkdownView,
//     //                 );

//     //             const file =
//     //                 view?.file;

//     //             if (
//     //                 !file
//     //             ) {
//     //                 return;
//     //             }

//     //             if (
//     //                 this.runtime.isUnlocked(
//     //                     file.path,
//     //                 )
//     //             ) {
//     //                 this.runtime.updateContent(
//     //                     file.path,
//     //                     editor.getValue(),
//     //                 );
//     //             }
//     //         },
//     //     );
//     //     this.app.vault.on(
//     //         "delete",
//     //         (
//     //             file,
//     //         ) => {
//     //             void this.onDelete(
//     //                 file,
//     //             );
//     //         },
//     //     );
//     // }
//     async initialize(): Promise<void> {
//         await this.store.initialize();

//         this.app.vault.on(
//             "rename",
//             async (
//                 file,
//                 oldPath,
//             ) => {
//                 if (
//                     !(file instanceof TFile)
//                 ) {
//                     return;
//                 }

//                 await this.store.updatePath(
//                     oldPath,
//                     file.path,
//                 );
//             },
//         );

//         this.app.workspace.on(
//             "file-open",
//             (
//                 file,
//             ) => {
//                 void this.onFileOpen(
//                     file as
//                     | TFile
//                     | null,
//                 );
//             },
//         );

//         this.app.workspace.on(
//             "editor-change",
//             (
//                 editor,
//             ) => {
//                 const view =
//                     this.app.workspace.getActiveViewOfType(
//                         MarkdownView,
//                     );

//                 const file =
//                     view?.file;

//                 if (!file) {
//                     return;
//                 }

//                 if (
//                     !this.runtime.isUnlocked(
//                         file.path,
//                     )
//                 ) {
//                     return;
//                 }

//                 this.runtime.updateContent(
//                     file.path,
//                     editor.getValue(),
//                 );
//             },
//         );

//         this.app.vault.on(
//             "delete",
//             (
//                 file,
//             ) => {
//                 void this.onDelete(
//                     file,
//                 );
//             },
//         );
//     }
//     private async onFileOpen(
//         file: TFile | null,
//     ): Promise<void> {
//         if (!file) {
//             return;
//         }

//         if (
//             this.activeFile &&
//             this.activeFile !==
//             file.path
//         ) {
//             const previous =
//                 this.app.vault.getAbstractFileByPath(
//                     this.activeFile,
//                 );

//             if (
//                 previous instanceof TFile
//             ) {
//                 await this.forceLock(
//                     previous,
//                 );
//             }
//         }

//         this.activeFile =
//             file.path;

//         const entry =
//             await this.store.findByPath(
//                 file.path,
//             );

//         if (!entry) {
//             return;
//         }

//         const payload =
//             await this.store.loadPayload(
//                 entry.id,
//             );

//         if (!payload) {
//             return;
//         }

//         const content =
//             await this.app.vault.cachedRead(
//                 file,
//             );

//         if (
//             !isPlaceholder(
//                 content,
//             )
//         ) {
//             await this.forceLock(
//                 file,
//             );
//         }

//         this.showUnlockDialog(
//             file,
//             entry.id,
//         );
//     }

//     private showUnlockDialog(
//         file: TFile,
//         id: string,
//     ): void {

//         if (
//             this.openUnlockDialogs.has(
//                 file.path,
//             )
//         ) {
//             return;
//         }

//         this.openUnlockDialogs.add(
//             file.path,
//         );

//         const modal =
//             new PasswordModal(
//                 this.app,
//                 "Unlock Note",
//                 "Unlock",
//                 async (
//                     password,
//                 ) => {
//                     return this.unlockNote(
//                         file,
//                         id,
//                         password,
//                     );
//                 },
//             );

//         const originalClose =
//             modal.onClose?.bind(
//                 modal,
//             );

//         modal.onClose =
//             () => {

//                 this.openUnlockDialogs.delete(
//                     file.path,
//                 );

//                 if (
//                     originalClose
//                 ) {
//                     originalClose();
//                 }
//             };

//         modal.open();
//     }
//     private async unlockNote(
//         file: TFile,
//         id: string,
//         password: string,
//     ): Promise<boolean> {
//         try {
//             const payload =
//                 await this.store.loadPayload(
//                     id,
//                 );

//             if (!payload) {
//                 return false;
//             }

//             const result =
//                 await decryptPayload(
//                     payload,
//                     password,
//                 );

//             // this.internalWrite.add(
//             //     file.path,
//             // );

//             // await this.app.vault.modify(
//             //     file,
//             //     result.plaintext,
//             // );

//             // this.runtime.markUnlocked(
//             //     file.path,
//             //     id,
//             //     result.plaintext,
//             //     result.cryptoKey,
//             // );
//             this.runtime.markUnlocked(
//                 file.path,
//                 id,
//                 result.plaintext,
//                 result.cryptoKey,
//             );

//             this.internalWrite.add(
//                 file.path,
//             );

//             try {

//                 await this.app.vault.modify(
//                     file,
//                     result.plaintext,
//                 );

//             } finally {

//                 queueMicrotask(
//                     () => {
//                         this.internalWrite.delete(
//                             file.path,
//                         );
//                     },
//                 );
//             }

//             new Notice(
//                 "Note unlocked",
//             );

//             this.runtime.scheduleAutoLock(
//                 file.path,
//                 () => {
//                     void this.autoLock(
//                         file,
//                     );
//                 },
//             );

//             return true;
//         } catch (e) {
//             console.error(e);

//             return false;
//         }
//     }

//     async createEncryptedNote(
//         file: TFile,
//         password: string,
//     ): Promise<void> {
//         const plaintext =
//             await this.app.vault.read(
//                 file,
//             );

//         const id =
//             crypto.randomUUID();

//         const result =
//             await encryptPayload(
//                 id,
//                 plaintext,
//                 password,
//             );

//         await this.store.register(
//             file.path,
//             id,
//         );

//         await this.store.savePayload(
//             result.payload,
//         );

//         this.internalWrite.add(
//             file.path,
//         );

//         try {

//             await this.app.vault.modify(
//                 file,
//                 buildPlaceholder(
//                     result.payload.updatedAt,
//                 ),
//             );

//         } finally {

//             queueMicrotask(
//                 () => {
//                     this.internalWrite.delete(
//                         file.path,
//                     );
//                 },
//             );
//         }


//         this.runtime.markLocked(
//             file.path,
//         );

//         new Notice(
//             "Note encrypted",
//         );
//     }

//     async lockNote(
//         file: TFile,
//     ): Promise<void> {
//         const state =
//             this.runtime.get(
//                 file.path,
//             );

//         if (
//             state.locked
//         ) {
//             return;
//         }

//         if (
//             !state.plaintext
//         ) {
//             return;
//         }

//         const payload =
//             await this.store.loadPayload(
//                 state.id,
//             );

//         if (!payload) {
//             throw new Error(
//                 "Payload missing",
//             );
//         }

//         const hash =
//             await sha256Hex(
//                 state.plaintext,
//             );

//         if (
//             hash !==
//             payload.plaintextHash
//         ) {
//             // const result =
//             //     await encryptPayload(
//             //         state.id,
//             //         state.plaintext,
//             //         "__RUNTIME__",
//             //         payload.createdAt,
//             //     );

//             // result.payload.salt =
//             //     payload.salt;

//             // result.payload.verifier =
//             //     payload.verifier;

//             // await this.store.savePayload(
//             //     result.payload,
//             // );
//             const payload =
//                 await this.store.loadPayload(
//                     state.id,
//                 );

//             if (!payload) {
//                 throw new Error(
//                     "Payload missing",
//                 );
//             }

//             const updated =
//                 await encryptWithExistingKey(
//                     state.plaintext,
//                     state.cryptoKey!,
//                     payload,
//                 );

//             await this.store.savePayload(
//                 updated,
//             );
//         }

//         this.internalWrite.add(
//             file.path,
//         );

//         try {

//             await this.app.vault.modify(
//                 file,
//                 buildPlaceholder(
//                     new Date().toISOString(),
//                 ),
//             );

//         } finally {

//             queueMicrotask(
//                 () => {
//                     this.internalWrite.delete(
//                         file.path,
//                     );
//                 },
//             );
//         }

//         this.runtime.markLocked(
//             file.path,
//         );

//         new Notice(
//             "Note locked",
//         );
//     }

//     private async autoLock(
//         file: TFile,
//     ): Promise<void> {
//         const state =
//             this.runtime.get(
//                 file.path,
//             );

//         if (
//             state.locked
//         ) {
//             return;
//         }

//         const last =
//             state.lastActivity ??
//             0;

//         const age =
//             Date.now() -
//             last;

//         if (
//             age <
//             10000
//         ) {
//             this.runtime.scheduleAutoLock(
//                 file.path,
//                 () => {
//                     void this.autoLock(
//                         file,
//                     );
//                 },
//             );

//             return;
//         }

//         await this.lockNote(
//             file,
//         );
//     }

//     async forceLock(
//         file: TFile,
//     ): Promise<void> {
//         if (
//             !this.runtime.isUnlocked(
//                 file.path,
//             )
//         ) {
//             return;
//         }

//         await this.lockNote(
//             file,
//         );
//     }

//     async lockAll(): Promise<void> {
//         const unlocked =
//             this.runtime.getAllUnlocked();

//         for (const path of unlocked) {
//             const file =
//                 this.app.vault.getAbstractFileByPath(
//                     path,
//                 );

//             if (
//                 file instanceof TFile
//             ) {
//                 await this.lockNote(
//                     file,
//                 );
//             }
//         }
//     }

//     async resetPassword(
//         file: TFile,
//     ): Promise<void> {
//         const state =
//             this.runtime.get(
//                 file.path,
//             );

//         if (
//             state.locked
//         ) {
//             new Notice(
//                 "Unlock note first",
//             );

//             return;
//         }

//         const payload =
//             await this.store.loadPayload(
//                 state.id,
//             );

//         if (!payload) {
//             return;
//         }

//         new ResetPasswordModal(
//             this.app,
//             async (
//                 newPassword,
//             ) => {
//                 try {
//                     const result =
//                         await reencryptPayload(
//                             payload,
//                             state.plaintext ??
//                             "",
//                             newPassword,
//                         );

//                     await this.store.savePayload(
//                         result.payload,
//                     );

//                     state.cryptoKey =
//                         result.cryptoKey;

//                     new Notice(
//                         "Password updated",
//                     );

//                     return true;
//                 } catch (
//                 e
//                 ) {
//                     console.error(
//                         e,
//                     );

//                     return false;
//                 }
//             },
//         ).open();
//     }

//     async promptEncrypt(
//         file: TFile,
//     ): Promise<void> {
//         new ResetPasswordModal(
//             this.app,
//             async (
//                 password,
//             ) => {
//                 await this.createEncryptedNote(
//                     file,
//                     password,
//                 );

//                 return true;
//             },
//         ).open();
//     }

//     // Public API for UI integrations
//     public async promptUnlock(file: TFile): Promise<void> {
//         const entry = await this.store.findByPath(file.path);

//         if (!entry) {
//             return;
//         }

//         this.showUnlockDialog(file, entry.id);
//     }

//     public async isNoteEncrypted(path: string): Promise<boolean> {
//         const entry = await this.store.findByPath(path);

//         return !!entry;
//     }

//     public isNoteUnlocked(path: string): boolean {
//         return this.runtime.isUnlocked(path);
//     }
//     registerMarkdownProcessor(): void {

//         if (
//             this.markdownProcessorRegistered
//         ) {
//             return;
//         }

//         this.markdownProcessorRegistered =
//             true;

//         this.plugin.registerMarkdownPostProcessor(
//             async (
//                 element: HTMLElement,
//                 context: any,
//             ) => {

//                 const file =
//                     this.app.vault.getAbstractFileByPath(
//                         context.sourcePath,
//                     );

//                 if (
//                     !(file instanceof TFile)
//                 ) {
//                     return;
//                 }

//                 if (
//                     element.querySelector(
//                         ".wop-buttons",
//                     )
//                 ) {
//                     return;
//                 }

//                 const entry =
//                     await this.store.findByPath(
//                         file.path,
//                     );

//                 const wrap =
//                     document.createElement(
//                         "div",
//                     );

//                 wrap.className =
//                     "wop-buttons";

//                 if (!entry) {

//                     const encrypt =
//                         document.createElement(
//                             "button",
//                         );

//                     encrypt.textContent =
//                         "Encrypt Note";

//                     encrypt.onclick =
//                         () => {
//                             void this.promptEncrypt(
//                                 file,
//                             );
//                         };

//                     wrap.appendChild(
//                         encrypt,
//                     );

//                     element.prepend(
//                         wrap,
//                     );

//                     return;
//                 }

//                 const text =
//                     element.textContent ??
//                     "";

//                 if (
//                     !text.includes(
//                         "Encrypted Note",
//                     )
//                 ) {
//                     return;
//                 }

//                 const state =
//                     this.runtime.get(
//                         file.path,
//                     );

//                 if (
//                     state.locked
//                 ) {

//                     const unlock =
//                         document.createElement(
//                             "button",
//                         );

//                     unlock.textContent =
//                         "Unlock";

//                     unlock.onclick =
//                         () => {
//                             void this.openUnlock(
//                                 file,
//                             );
//                         };

//                     wrap.appendChild(
//                         unlock,
//                     );

//                 } else {

//                     const lock =
//                         document.createElement(
//                             "button",
//                         );

//                     lock.textContent =
//                         "Lock";

//                     lock.onclick =
//                         () => {
//                             void this.lockNote(
//                                 file,
//                             );
//                         };

//                     wrap.appendChild(
//                         lock,
//                     );

//                     const reset =
//                         document.createElement(
//                             "button",
//                         );

//                     reset.textContent =
//                         "Reset Password";

//                     reset.onclick =
//                         () => {
//                             void this.resetPassword(
//                                 file,
//                             );
//                         };

//                     wrap.appendChild(
//                         reset,
//                     );
//                 }

//                 element.prepend(
//                     wrap,
//                 );
//             },
//         );
//     }
//     private async openUnlock(
//         file: TFile,
//     ): Promise<void> {
//         const entry =
//             await this.store.findByPath(
//                 file.path,
//             );

//         if (!entry) {
//             return;
//         }

//         this.showUnlockDialog(
//             file,
//             entry.id,
//         );
//     }

//     private async onDelete(
//         file: unknown,
//     ): Promise<void> {
//         if (
//             !(file instanceof TFile)
//         ) {
//             return;
//         }

//         const entry =
//             await this.store.findByPath(
//                 file.path,
//             );

//         if (!entry) {
//             return;
//         }

//         await this.store.deletePayload(
//             entry.id,
//         );

//         await this.store.unregister(
//             file.path,
//         );

//         this.runtime.remove(
//             file.path,
//         );
//     }
//     private isInternalWrite(
//         path: string,
//     ): boolean {
//         return this.internalWrite.has(
//             path,
//         );
//     }
// }
import {
    App,
    MarkdownView,
    Notice,
    TFile,
    Editor,
} from "obsidian";

import {
    decryptPayload,
    encryptPayload,
    encryptWithExistingKey,
    reencryptPayload,
    sha256Hex,
} from "./crypto";

import { EncStore } from "./encStore";
import { buildPlaceholder, PLACEHOLDER_MARKER } from "./placeholder";
import { PasswordModal, ResetPasswordModal } from "./passwordModal";
import { RuntimeStore } from "./runtime";
import MyPlugin from "main";

export class NoteController {
    private plugin: MyPlugin;
    private app: App;
    private store: EncStore;
    private runtime = new RuntimeStore();

    // Tracks files that we are currently writing (to ignore editor-change events)
    private internalWrite = new Set<string>();

    // Guards against concurrent lock/unlock operations per file
    private pendingOps = new Map<string, Promise<void>>();

    // Currently active file path
    private activeFile: string | null = null;

    // Prevent double registration of the markdown post-processor
    private markdownProcessorRegistered = false;

    // Ensure only one unlock dialog per file is shown
    private openUnlockDialogs = new Set<string>();

    // Bound event handlers for clean removal
    private boundRenameHandler: (file: TFile, oldPath: string) => Promise<void>;
    private boundDeleteHandler: (file: TFile) => Promise<void>;
    private boundFileOpenHandler: (file: TFile | null) => void;
    private boundEditorChangeHandler: (editor: Editor) => void;

    constructor(plugin: MyPlugin) {
        this.plugin = plugin;
        this.app = this.plugin.app;
        this.store = new EncStore(this.app);

        // Bind methods to keep consistent `this` for event removal
        this.boundRenameHandler = async (file, oldPath) => {
            if (file instanceof TFile) {
                await this.store.updatePath(oldPath, file.path);
            }
        };
        this.boundDeleteHandler = async (file) => {
            if (file instanceof TFile) {
                await this.onDelete(file);
            }
        };
        this.boundFileOpenHandler = (file) => {
            void this.onFileOpen(file as TFile | null);
        };
        this.boundEditorChangeHandler = (editor) => {
            const view = this.app.workspace.getActiveViewOfType(MarkdownView);
            const file = view?.file;
            if (!file) return;

            // Ignore changes triggered by our own writes
            if (this.internalWrite.has(file.path)) return;

            if (this.runtime.isUnlocked(file.path)) {
                this.runtime.updateContent(file.path, editor.getValue());
            }
        };
    }

    async initialize(): Promise<void> {
        await this.store.initialize();

        // Register vault and workspace events
        this.app.vault.on("rename", this.boundRenameHandler);
        this.app.vault.on("delete", this.boundDeleteHandler);
        this.app.workspace.on("file-open", this.boundFileOpenHandler);
        this.app.workspace.on("editor-change", this.boundEditorChangeHandler);
    }

    destroy(): void {
        // Remove all event listeners
        this.app.vault.off("rename", this.boundRenameHandler);
        this.app.vault.off("delete", this.boundDeleteHandler);
        this.app.workspace.off("file-open", this.boundFileOpenHandler);
        this.app.workspace.off("editor-change", this.boundEditorChangeHandler);

        // Clear all pending auto-lock timers
        for (const path of this.runtime.getAllUnlocked()) {
            const state = this.runtime.get(path);
            if (state.pendingTimer) {
                clearTimeout(state.pendingTimer);
            }
        }

        // Clear runtime data
        this.runtime.clearAll();
        this.internalWrite.clear();
        this.openUnlockDialogs.clear();
        this.pendingOps.clear();
        this.activeFile = null;
        this.markdownProcessorRegistered = false;
    }

    // ---------- Public API ----------
    async isNoteEncrypted(path: string): Promise<boolean> {
        const entry = await this.store.findByPath(path);
        return !!entry;
    }

    isNoteUnlocked(path: string): boolean {
        return this.runtime.isUnlocked(path);
    }

    async promptEncrypt(file: TFile): Promise<void> {
        new ResetPasswordModal(this.app, async (password) => {
            await this.createEncryptedNote(file, password);
            return true;
        }).open();
    }

    async promptUnlock(file: TFile): Promise<void> {
        const entry = await this.store.findByPath(file.path);
        if (!entry) return;
        this.showUnlockDialog(file, entry.id);
    }

    async lockNote(file: TFile): Promise<void> {
        // Serialise operations per file to avoid races
        const existing = this.pendingOps.get(file.path);
        const op = (async () => {
            if (existing) await existing;
            await this.lockNoteInternal(file);
        })();
        this.pendingOps.set(file.path, op);
        await op;
        this.pendingOps.delete(file.path);
    }

    async resetPassword(file: TFile): Promise<void> {
        const state = this.runtime.get(file.path);
        if (state.locked) {
            new Notice("Unlock note first");
            return;
        }

        const payload = await this.store.loadPayload(state.id);
        if (!payload) return;

        new ResetPasswordModal(this.app, async (newPassword) => {
            try {
                const result = await reencryptPayload(
                    payload,
                    state.plaintext ?? "",
                    newPassword
                );
                await this.store.savePayload(result.payload);
                state.cryptoKey = result.cryptoKey;
                new Notice("Password updated");
                return true;
            } catch (e) {
                console.error(e);
                return false;
            }
        }).open();
    }

    async lockAll(): Promise<void> {
        const unlocked = this.runtime.getAllUnlocked();
        for (const path of unlocked) {
            const file = this.app.vault.getAbstractFileByPath(path);
            if (file instanceof TFile) {
                await this.lockNote(file);
            }
        }
    }

    // ---------- Markdown post-processor ----------
    registerMarkdownProcessor(): void {
        if (this.markdownProcessorRegistered) return;
        this.markdownProcessorRegistered = true;

        this.plugin.registerMarkdownPostProcessor(async (element: HTMLElement, context: any) => {
            const file = this.app.vault.getAbstractFileByPath(context.sourcePath);
            if (!(file instanceof TFile)) return;

            // Avoid duplicate button containers
            if (element.querySelector(".wop-buttons")) return;

            const entry = await this.store.findByPath(file.path);
            const wrap = document.createElement("div");
            wrap.className = "wop-buttons";

            if (!entry) {
                // Not encrypted – show Encrypt button
                const encryptBtn = document.createElement("button");
                encryptBtn.textContent = "Encrypt Note";
                encryptBtn.onclick = () => void this.promptEncrypt(file);
                wrap.appendChild(encryptBtn);
                element.prepend(wrap);
                return;
            }

            // Encrypted note: show appropriate buttons based on locked/unlocked state
            const content = element.textContent ?? "";
            if (!content.includes(PLACEHOLDER_MARKER)) return; // not a placeholder

            const state = this.runtime.get(file.path);
            if (state.locked) {
                const unlockBtn = document.createElement("button");
                unlockBtn.textContent = "Unlock";
                unlockBtn.onclick = () => void this.openUnlock(file);
                wrap.appendChild(unlockBtn);
            } else {
                const lockBtn = document.createElement("button");
                lockBtn.textContent = "Lock";
                lockBtn.onclick = () => void this.lockNote(file);
                wrap.appendChild(lockBtn);

                const resetBtn = document.createElement("button");
                resetBtn.textContent = "Reset Password";
                resetBtn.onclick = () => void this.resetPassword(file);
                wrap.appendChild(resetBtn);
            }
            element.prepend(wrap);
        });
    }

    // ---------- Private methods ----------
    private async createEncryptedNote(file: TFile, password: string): Promise<void> {
        const plaintext = await this.app.vault.read(file);
        const id = crypto.randomUUID();
        const result = await encryptPayload(id, plaintext, password);

        await this.store.register(file.path, id);
        await this.store.savePayload(result.payload);

        // Write placeholder
        await this.writePlaceholder(file, result.payload.updatedAt);

        this.runtime.markLocked(file.path);
        new Notice("Note encrypted");
    }

    private async lockNoteInternal(file: TFile): Promise<void> {
        const state = this.runtime.get(file.path);
        if (state.locked) return;

        // Immediately mark as locked to prevent further edits
        state.locked = true;

        try {
            if (!state.plaintext) return;

            const payload = await this.store.loadPayload(state.id);
            if (!payload) throw new Error("Payload missing");

            const hash = await sha256Hex(state.plaintext);
            if (hash !== payload.plaintextHash) {
                // Content changed – re‑encrypt before locking
                const updated = await encryptWithExistingKey(
                    state.plaintext,
                    state.cryptoKey!,
                    payload
                );
                await this.store.savePayload(updated);
            }

            await this.writePlaceholder(file, new Date().toISOString());
        } finally {
            this.runtime.markLocked(file.path); // clears plaintext and cryptoKey
        }
    }

    private async writePlaceholder(file: TFile, updatedAt: string): Promise<void> {
        this.internalWrite.add(file.path);
        try {
            await this.app.vault.modify(file, buildPlaceholder(updatedAt));
        } finally {
            queueMicrotask(() => this.internalWrite.delete(file.path));
        }
    }

    private async unlockNote(file: TFile, id: string, password: string): Promise<boolean> {
        const payload = await this.store.loadPayload(id);
        if (!payload) return false;

        try {
            const result = await decryptPayload(payload, password);

            this.runtime.markUnlocked(
                file.path,
                id,
                result.plaintext,
                result.cryptoKey
            );

            // Write plaintext to the note
            this.internalWrite.add(file.path);
            try {
                await this.app.vault.modify(file, result.plaintext);
            } finally {
                queueMicrotask(() => this.internalWrite.delete(file.path));
            }

            new Notice("Note unlocked");
            this.runtime.scheduleAutoLock(file.path, () => {
                void this.lockNote(file);
            });
            return true;
        } catch (e) {
            console.error(e);
            return false;
        }
    }

    private async onFileOpen(file: TFile | null): Promise<void> {
        if (!file) return;

        // Lock previous active file if it was unlocked
        if (this.activeFile && this.activeFile !== file.path) {
            const prevFile = this.app.vault.getAbstractFileByPath(this.activeFile);
            if (prevFile instanceof TFile) {
                await this.lockNote(prevFile);
            }
        }
        this.activeFile = file.path;

        const entry = await this.store.findByPath(file.path);
        if (!entry) return;

        const payload = await this.store.loadPayload(entry.id);
        if (!payload) return;

        const content = await this.app.vault.cachedRead(file);
        // If the file no longer contains the placeholder, assume it's already unlocked or corrupted
        if (!content.includes(PLACEHOLDER_MARKER)) {
            // Force lock to re-encrypt (will write placeholder)
            await this.lockNote(file);
        }

        this.showUnlockDialog(file, entry.id);
    }

    private showUnlockDialog(file: TFile, id: string): void {
        if (this.openUnlockDialogs.has(file.path)) return;
        this.openUnlockDialogs.add(file.path);

        const modal = new PasswordModal(
            this.app,
            "Unlock Note",
            "Unlock",
            async (password) => {
                return this.unlockNote(file, id, password);
            }
        );

        const originalClose = modal.onClose?.bind(modal);
        modal.onClose = () => {
            this.openUnlockDialogs.delete(file.path);
            if (originalClose) originalClose();
        };
        modal.open();
    }

    private async openUnlock(file: TFile): Promise<void> {
        const entry = await this.store.findByPath(file.path);
        if (!entry) return;
        this.showUnlockDialog(file, entry.id);
    }

    private async onDelete(file: TFile): Promise<void> {
        const entry = await this.store.findByPath(file.path);
        if (!entry) return;

        await this.store.deletePayload(entry.id);
        await this.store.unregister(file.path);
        this.runtime.remove(file.path);
    }

    // For internal use – force lock without checking (used by file-open)
    async forceLock(file: TFile): Promise<void> {
        if (!this.runtime.isUnlocked(file.path)) return;
        await this.lockNote(file);
    }
}