import {
    MarkdownView,
    TAbstractFile,
    TFile,
    TFolder,
    Vault,
    normalizePath,
} from "obsidian";

import type MyPlugin from "../../main";

const IMAGE_EXTENSIONS = [
    "png",
    "jpg",
    "jpeg",
    "gif",
    "webp",
    "bmp",
    "svg",
    "avif",
];

export class AutoNoteFolderNRenameModule {
    private lastNotePath: string | null =
        null;
    private processing =
        new Set<string>();
    private renameQueue =
        Promise.resolve();
    constructor(
        private plugin: MyPlugin,
    ) {
    }

    register() {
        this.patchAttachmentPath();

        this.plugin.registerEvent(
            this.plugin.app.vault.on(
                "create",
                async (file) => {
                    await this.handleFileCreated(
                        file,
                    );
                },
            ),
        );
    }

    destroy() {
        if (
            this.originalAttachmentPath
        ) {
            (
                Vault.prototype as any
            ).getAvailablePathForAttachments =
                this.originalAttachmentPath;
        }
    }

    updateEnabledState() { }


    private originalAttachmentPath?: Function;

    private patchAttachmentPath() {
        const self = this;

        const vaultProto =
            Vault.prototype as any;

        this.originalAttachmentPath =
            vaultProto.getAvailablePathForAttachments;

        vaultProto.getAvailablePathForAttachments =
            async function (
                ...args: any[]
            ) {
                const settings =
                    self.plugin.settings
                        .autoFolderNoteAndRename;

                if (settings.enabled) {
                    const note =
                        self.plugin.app.workspace.getActiveFile();

                    if (
                        note &&
                        note.extension === "md"
                    ) {
                        try {
                            const moved =
                                await self.ensureFolderNote(
                                    note,
                                );

                            await self.ensureAttachmentsFolder(
                                moved,
                            );

                            self.lastNotePath =
                                moved.path;
                        } catch (err) {
                            console.error(
                                "[AutoNoteFolderNRename]",
                                err,
                            );
                        }
                    }
                }

                return self.originalAttachmentPath!.apply(
                    this,
                    args,
                );
            };
    }
    private async handleFileCreated(
        file: TAbstractFile,
    ) {
        const settings =
            this.plugin.settings
                .autoFolderNoteAndRename;

        if (!settings.enabled) {
            return;
        }

        if (
            !(file instanceof TFile)
        ) {
            return;
        }

        if (
            !IMAGE_EXTENSIONS.includes(
                file.extension.toLowerCase(),
            )
        ) {
            return;
        }

        const age =
            Date.now() -
            file.stat.ctime;

        // Ignore old files during vault startup
        if (age > 5000) {
            return;
        }

        // Prevent duplicate processing
        if (
            this.processing.has(
                file.path,
            )
        ) {
            return;
        }

        this.processing.add(
            file.path,
        );

        try {
            const note =
                this.getTargetNote();

            if (!note) {
                return;
            }

            this.renameQueue =
                this.renameQueue.then(
                    async () => {
                        await this.renameImage(
                            file,
                            note,
                        );
                    },
                );
        } catch (err) {
            console.error(
                "[AutoNoteFolderNRename]",
                err,
            );
        } finally {
            this.processing.delete(
                file.path,
            );
        }
    }

    private getTargetNote():
        | TFile
        | null {
        if (
            this.lastNotePath
        ) {
            const file =
                this.plugin.app.vault.getAbstractFileByPath(
                    this.lastNotePath,
                );

            if (
                file instanceof
                TFile
            ) {
                return file;
            }
        }

        const active =
            this.plugin.app.workspace.getActiveFile();

        return active instanceof
            TFile
            ? active
            : null;
    }

    private async renameImage(
        image: TFile,
        note: TFile,
    ) {
        const attachmentFolderPath =
            normalizePath(
                `${note.parent?.path}/Attachments`,
            );

        let attachmentFolder =
            this.plugin.app.vault.getAbstractFileByPath(
                attachmentFolderPath,
            );

        if (
            !attachmentFolder
        ) {
            await this.plugin.app.vault.createFolder(
                attachmentFolderPath,
            );

            attachmentFolder =
                this.plugin.app.vault.getAbstractFileByPath(
                    attachmentFolderPath,
                );
        }

        if (
            !(attachmentFolder instanceof
                TFolder)
        ) {
            return;
        }

        const newFilename =
            await this.generateImageName(
                attachmentFolder,
                note,
                image.extension,
            );

        const oldLink =
            this.plugin.app.fileManager.generateMarkdownLink(
                image,
                note.path,
            );

        const targetPath =
            normalizePath(
                `${attachmentFolder.path}/${newFilename}`,
            );

        await this.plugin.app.fileManager.renameFile(
            image,
            targetPath,
        );

        const renamed =
            this.plugin.app.vault.getAbstractFileByPath(
                targetPath,
            );

        if (
            !(renamed instanceof
                TFile)
        ) {
            return;
        }

        const newLink =
            this.plugin.app.fileManager.generateMarkdownLink(
                renamed,
                note.path,
            );

        const editor =
            this.getActiveEditor();

        if (!editor) {
            return;
        }

        const content =
            editor.getValue();

        editor.setValue(
            content.replace(
                oldLink,
                newLink,
            ),
        );
    }

    private async ensureFolderNote(
        note: TFile,
    ): Promise<TFile> {
        if (
            note.parent?.name ===
            note.basename
        ) {
            return note;
        }

        const parentPath =
            note.parent?.path ??
            "";

        const folderPath =
            parentPath
                ? normalizePath(
                    `${parentPath}/${note.basename}`,
                )
                : note.basename;

        let folder =
            this.plugin.app.vault.getAbstractFileByPath(
                folderPath,
            );

        if (!folder) {
            await this.plugin.app.vault.createFolder(
                folderPath,
            );

            folder =
                this.plugin.app.vault.getAbstractFileByPath(
                    folderPath,
                );
        }

        const newPath =
            normalizePath(
                `${folderPath}/${note.name}`,
            );

        if (
            note.path ===
            newPath
        ) {
            return note;
        }

        await this.plugin.app.fileManager.renameFile(
            note,
            newPath,
        );

        const moved =
            this.plugin.app.vault.getAbstractFileByPath(
                newPath,
            );

        if (
            !(moved instanceof
                TFile)
        ) {
            throw new Error(
                "Failed to create folder note",
            );
        }

        return moved;
    }

    private async ensureAttachmentsFolder(
        note: TFile,
    ) {
        const folder =
            normalizePath(
                `${note.parent?.path}/Attachments`,
            );

        if (
            !this.plugin.app.vault.getAbstractFileByPath(
                folder,
            )
        ) {
            await this.plugin.app.vault.createFolder(
                folder,
            );
        }
    }

    private async generateImageName(
        folder: TFolder,
        note: TFile,
        ext: string,
    ): Promise<string> {
        const format =
            this.plugin.settings
                .autoFolderNoteAndRename
                .imageNameFormat ||
            "{noteName}_{counter}";

        let counter = 1;

        while (true) {
            const stem =
                format
                    .replace(
                        /\{noteName\}/g,
                        note.basename,
                    )
                    .replace(
                        /\{counter\}/g,
                        String(counter),
                    );

            const candidate =
                `${stem}.${ext}`;

            const fullPath =
                normalizePath(
                    `${folder.path}/${candidate}`,
                );

            if (
                !this.plugin.app.vault.getAbstractFileByPath(
                    fullPath,
                )
            ) {
                return candidate;
            }

            counter++;
        }
    }

    private getActiveEditor() {
        const view =
            this.plugin.app.workspace.getActiveViewOfType(
                MarkdownView,
            );

        return view?.editor;
    }
}