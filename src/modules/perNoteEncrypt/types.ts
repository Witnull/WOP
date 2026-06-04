import type { CryptoKey } from "./polyfill";

export const ENC_VERSION = 2;

export const ENC_ROOT = ".wop";
export const ENC_DIR = ".wop/encrypted";
export const INDEX_PATH = ".wop/index.json";
export const BACKUP_DIR = ".wop/backups";

export const PBKDF2_ITERATIONS = 200_000;
export const AES_KEY_LENGTH = 256;
export const AUTO_LOCK_MS = 10_000;      // will be made configurable later

// Marker used in placeholder notes (must match placeholder.ts)
export const PLACEHOLDER_MARKER = "WOP_ENCRYPTED_NOTE";

export interface EncIndexEntry {
    id: string;
    notePath: string;
    createdAt: string;
    updatedAt: string;
}

export interface EncIndex {
    version: number;
    notes: Record<string, EncIndexEntry>;
}

export interface KdfInfo {
    algorithm: "PBKDF2";
    hash: "SHA-256";
    iterations: number;
}

export interface EncPayload {
    version: number;
    id: string;
    salt: string;
    iv: string;
    ciphertext: string;
    verifier: string;
    plaintextHash: string;          // kept temporarily – see security note
    createdAt: string;
    updatedAt: string;
    kdf: KdfInfo;
}

export interface RuntimeNoteState {
    id: string;
    locked: boolean;
    dirty: boolean;                  // kept for future use (unsaved changes warning)
    plaintext?: string;
    lastKnownGoodPlaintext?: string; // ← FIX: added to avoid placeholder overwrite
    cryptoKey?: CryptoKey;
    pendingTimer?: number;
    lastActivity?: number;
    locking?: boolean;               // optional flag to prevent concurrent locks
}

export interface EncryptRequest {
    notePath: string;
    plaintext: string;
    password: string;
}

export interface DecryptRequest {
    payload: EncPayload;
    password: string;
}

export interface EncryptionResult {
    payload: EncPayload;
    cryptoKey: CryptoKey;
}

export interface PasswordResetRequest {
    plaintext: string;
    newPassword: string;
    id: string;
    createdAt: string;
}