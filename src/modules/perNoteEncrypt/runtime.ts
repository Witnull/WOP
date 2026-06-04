import { AUTO_LOCK_MS, PLACEHOLDER_MARKER, RuntimeNoteState } from "./types";

export class RuntimeStore {
    private states = new Map<string, RuntimeNoteState>();

    get(path: string): RuntimeNoteState {
        let state = this.states.get(path);
        if (!state) {
            state = {
                id: "",
                locked: true,
                dirty: false,
            };
            this.states.set(path, state);
        }
        return state;
    }

    remove(path: string): void {
        const state = this.states.get(path);
        if (state?.pendingTimer) {
            window.clearTimeout(state.pendingTimer);
        }
        this.states.delete(path);
    }

    clearAll(): void {
        for (const state of this.states.values()) {
            if (state.pendingTimer) {
                window.clearTimeout(state.pendingTimer);
            }
        }
        this.states.clear();
    }

    markUnlocked(path: string, id: string, plaintext: string, cryptoKey: CryptoKey): void {
        const state = this.get(path);
        state.id = id;
        state.locked = false;
        state.dirty = false;
        state.plaintext = plaintext;
        state.lastKnownGoodPlaintext = plaintext;   // FIX
        state.cryptoKey = cryptoKey;
        state.lastActivity = Date.now();
    }

    markLocked(path: string): void {
        const state = this.get(path);
        state.locked = true;
        state.dirty = false;
        delete state.plaintext;
        delete state.cryptoKey;
        delete state.lastActivity;
        if (state.pendingTimer) {
            window.clearTimeout(state.pendingTimer);
            delete state.pendingTimer;
        }
    }

    updateContent(path: string, content: string): void {
        const state = this.get(path);
        // Ignore updates that contain the placeholder marker (e.g., after lock)
        if (content.includes(PLACEHOLDER_MARKER)) {
            return;
        }
        state.plaintext = content;
        state.lastKnownGoodPlaintext = content;
        state.dirty = true;
        state.lastActivity = Date.now();
    }

    isUnlocked(path: string): boolean {
        return !this.get(path).locked;
    }

    isDirty(path: string): boolean {
        return this.get(path).dirty;
    }

    clearDirty(path: string): void {
        this.get(path).dirty = false;
    }

    scheduleAutoLock(path: string, callback: () => void): void {
        const state = this.get(path);
        if (state.pendingTimer) {
            window.clearTimeout(state.pendingTimer);
        }
        state.pendingTimer = window.setTimeout(callback, AUTO_LOCK_MS);
    }

    getAllUnlocked(): string[] {
        const result: string[] = [];
        for (const [path, state] of this.states) {
            if (!state.locked) {
                result.push(path);
            }
        }
        return result;
    }
}