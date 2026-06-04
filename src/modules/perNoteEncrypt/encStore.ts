import { App } from "obsidian";
import * as fs from "fs/promises";
import * as path from "path";

import {
    BACKUP_DIR,
    ENC_DIR,
    INDEX_PATH,
    EncIndex,
    EncIndexEntry,
    EncPayload,
} from "./types";

export class EncStore {
    private vaultRoot: string;
    private indexLock = Promise.resolve();

    constructor(private app: App) {
        const adapter = this.app.vault.adapter as any;
        if (!adapter?.basePath) {
            throw new Error("PerNoteEncrypt requires desktop Obsidian.");
        }
        this.vaultRoot = adapter.basePath;
    }

    private abs(relativePath: string): string {
        return path.join(this.vaultRoot, relativePath);
    }

    async initialize(): Promise<void> {
        await fs.mkdir(this.abs(".wop"), { recursive: true });
        await fs.mkdir(this.abs(ENC_DIR), { recursive: true });
        await fs.mkdir(this.abs(BACKUP_DIR), { recursive: true });
        await this.ensureIndex();
    }

    private async ensureIndex(): Promise<void> {
        const file = this.abs(INDEX_PATH);
        try {
            await fs.access(file);
            JSON.parse(await fs.readFile(file, "utf8"));
        } catch {
            const empty: EncIndex = { version: 1, notes: {} };
            await fs.writeFile(file, JSON.stringify(empty, null, 2), "utf8");
        }
    }

    // ---------- Lock helper ----------
    private async withIndexLock<T>(fn: () => Promise<T>): Promise<T> {
        const previous = this.indexLock;
        let release!: () => void;
        this.indexLock = new Promise<void>((resolve) => {
            release = resolve;
        });
        await previous;
        try {
            return await fn();
        } finally {
            release();
        }
    }

    // FIX: loadIndex now protected by the same lock
    async loadIndex(): Promise<EncIndex> {
        return this.withIndexLock(async () => {
            await this.ensureIndex();
            return JSON.parse(await fs.readFile(this.abs(INDEX_PATH), "utf8"));
        });
    }

    async saveIndex(index: EncIndex): Promise<void> {
        await this.withIndexLock(async () => {
            await fs.writeFile(this.abs(INDEX_PATH), JSON.stringify(index, null, 2), "utf8");
        });
    }

    async findByPath(notePath: string): Promise<EncIndexEntry | null> {
        const index = await this.loadIndex();
        return index.notes[notePath] ?? null;
    }

    async register(notePath: string, id: string): Promise<EncIndexEntry> {
        return this.withIndexLock(async () => {
            const index = await this.loadIndex();
            const now = new Date().toISOString();
            const entry: EncIndexEntry = { id, notePath, createdAt: now, updatedAt: now };
            index.notes[notePath] = entry;
            await this.saveIndex(index);
            return entry;
        });
    }

    async unregister(notePath: string): Promise<void> {
        await this.withIndexLock(async () => {
            const index = await this.loadIndex();
            delete index.notes[notePath];
            await this.saveIndex(index);
        });
    }

    async updatePath(oldPath: string, newPath: string): Promise<void> {
        await this.withIndexLock(async () => {
            const index = await this.loadIndex();
            const entry = index.notes[oldPath];
            if (!entry) return;
            delete index.notes[oldPath];
            entry.notePath = newPath;
            entry.updatedAt = new Date().toISOString();
            index.notes[newPath] = entry;
            await this.saveIndex(index);
        });
    }

    payloadPath(id: string): string {
        return `${ENC_DIR}/${id}.enc`;
    }

    async loadPayload(id: string): Promise<EncPayload | null> {
        const file = this.abs(this.payloadPath(id));
        try {
            return JSON.parse(await fs.readFile(file, "utf8"));
        } catch {
            return null;
        }
    }

    async savePayload(payload: EncPayload): Promise<void> {
        await this.writeBackup(payload.id);
        await fs.writeFile(
            this.abs(this.payloadPath(payload.id)),
            JSON.stringify(payload, null, 2),
            "utf8"
        );
    }

    async deletePayload(id: string): Promise<void> {
        try {
            await fs.unlink(this.abs(this.payloadPath(id)));
        } catch {
            // ignore
        }
    }

    private async writeBackup(id: string): Promise<void> {
        const payloadFile = this.abs(this.payloadPath(id));
        try {
            const content = await fs.readFile(payloadFile, "utf8");
            const backupName = `${id}-${Date.now()}-${crypto.randomUUID()}.enc`;
            await fs.writeFile(this.abs(`${BACKUP_DIR}/${backupName}`), content, "utf8");
            await this.cleanupBackups(id);
        } catch {
            // no previous payload → no backup needed
        }
    }

    private async cleanupBackups(id: string): Promise<void> {
        const backupDir = this.abs(BACKUP_DIR);
        let files: string[];
        try {
            files = await fs.readdir(backupDir);
        } catch {
            return;
        }

        const matching: { file: string; mtime: number }[] = [];
        for (const file of files) {
            if (!file.startsWith(`${id}-`)) continue;
            try {
                const stat = await fs.stat(path.join(backupDir, file));
                matching.push({ file, mtime: stat.mtimeMs });
            } catch {
                // file disappeared – skip
            }
        }

        matching.sort((a, b) => b.mtime - a.mtime);
        const toRemove = matching.slice(5);
        for (const { file } of toRemove) {
            try {
                await fs.unlink(path.join(backupDir, file));
            } catch {
                // ignore
            }
        }
    }
}