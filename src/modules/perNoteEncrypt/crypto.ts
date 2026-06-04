import {
    AES_KEY_LENGTH,
    ENC_VERSION,
    PBKDF2_ITERATIONS,
    type EncPayload,
    type EncryptionResult,
} from "./types";

const VERIFY_STRING = "WOP_VERIFY_V2";

function encoder(): TextEncoder {
    return new TextEncoder();
}

function decoder(): TextDecoder {
    return new TextDecoder();
}

export function bytesToBase64(bytes: Uint8Array): string {
    return Buffer.from(bytes).toString("base64");
}

export function base64ToBytes(value: string): Uint8Array {
    return new Uint8Array(Buffer.from(value, "base64"));
}

export function stringToBytes(value: string): Uint8Array {
    return encoder().encode(value);
}

export function bytesToString(bytes: Uint8Array): string {
    return decoder().decode(bytes);
}

export function randomBytes(length: number): Uint8Array {
    const bytes = new Uint8Array(length);
    crypto.getRandomValues(bytes);
    return bytes;
}

export function uuid(): string {
    return crypto.randomUUID();
}

export async function sha256Hex(content: string): Promise<string> {
    const digest = await crypto.subtle.digest(
        "SHA-256",
        stringToBytes(content),
    );

    return Array.from(new Uint8Array(digest))
        .map((v) => v.toString(16).padStart(2, "0"))
        .join("");
}

async function deriveBits(
    password: string,
    salt: Uint8Array,
): Promise<ArrayBuffer> {
    const baseKey = await crypto.subtle.importKey(
        "raw",
        stringToBytes(password),
        "PBKDF2",
        false,
        ["deriveBits", "deriveKey"],
    );

    return crypto.subtle.deriveBits(
        {
            name: "PBKDF2",
            hash: "SHA-256",
            iterations: PBKDF2_ITERATIONS,
            salt,
        },
        baseKey,
        AES_KEY_LENGTH,
    );
}

export async function deriveKey(
    password: string,
    salt: Uint8Array,
): Promise<CryptoKey> {
    const baseKey = await crypto.subtle.importKey(
        "raw",
        stringToBytes(password),
        "PBKDF2",
        false,
        ["deriveKey"],
    );

    return crypto.subtle.deriveKey(
        {
            name: "PBKDF2",
            hash: "SHA-256",
            iterations: PBKDF2_ITERATIONS,
            salt,
        },
        baseKey,
        {
            name: "AES-GCM",
            length: AES_KEY_LENGTH,
        },
        false,
        ["encrypt", "decrypt"],
    );
}

async function encryptText(
    key: CryptoKey,
    plaintext: string,
): Promise<{
    iv: Uint8Array;
    ciphertext: Uint8Array;
}> {
    const iv = randomBytes(12);

    const encrypted = await crypto.subtle.encrypt(
        {
            name: "AES-GCM",
            iv,
        },
        key,
        stringToBytes(plaintext),
    );

    return {
        iv,
        ciphertext: new Uint8Array(encrypted),
    };
}

async function decryptText(
    key: CryptoKey,
    iv: Uint8Array,
    ciphertext: Uint8Array,
): Promise<string> {
    const decrypted = await crypto.subtle.decrypt(
        {
            name: "AES-GCM",
            iv,
        },
        key,
        ciphertext,
    );

    return bytesToString(new Uint8Array(decrypted));
}

export async function encryptPayload(
    id: string,
    plaintext: string,
    password: string,
    createdAt?: string,
): Promise<EncryptionResult> {
    const salt = randomBytes(16);

    const key = await deriveKey(password, salt);

    const payloadEnc = await encryptText(
        key,
        plaintext,
    );

    const verifierEnc = await encryptText(
        key,
        VERIFY_STRING,
    );

    const now = new Date().toISOString();

    return {
        cryptoKey: key,

        payload: {
            version: ENC_VERSION,

            id,

            salt: bytesToBase64(salt),

            iv: bytesToBase64(payloadEnc.iv),

            ciphertext: bytesToBase64(
                payloadEnc.ciphertext,
            ),

            verifier: JSON.stringify({
                iv: bytesToBase64(verifierEnc.iv),
                data: bytesToBase64(
                    verifierEnc.ciphertext,
                ),
            }),

            plaintextHash: await sha256Hex(
                plaintext,
            ),

            createdAt: createdAt ?? now,
            updatedAt: now,

            kdf: {
                algorithm: "PBKDF2",
                hash: "SHA-256",
                iterations: PBKDF2_ITERATIONS,
            },
        },
    };
}

export async function decryptPayload(
    payload: EncPayload,
    password: string,
): Promise<{
    plaintext: string;
    cryptoKey: CryptoKey;
}> {
    const salt = base64ToBytes(
        payload.salt,
    );

    const key = await deriveKey(
        password,
        salt,
    );

    const verifier = JSON.parse(
        payload.verifier,
    ) as {
        iv: string;
        data: string;
    };

    const verifierText =
        await decryptText(
            key,
            base64ToBytes(verifier.iv),
            base64ToBytes(verifier.data),
        );

    if (verifierText !== VERIFY_STRING) {
        throw new Error(
            "Invalid password",
        );
    }

    const plaintext =
        await decryptText(
            key,
            base64ToBytes(payload.iv),
            base64ToBytes(
                payload.ciphertext,
            ),
        );

    const hash = await sha256Hex(
        plaintext,
    );

    if (hash !== payload.plaintextHash) {
        throw new Error(
            "Integrity check failed",
        );
    }

    return {
        plaintext,
        cryptoKey: key,
    };
}

export async function encryptWithExistingKey(
    plaintext: string,
    key: CryptoKey,
    existing: EncPayload,
): Promise<EncPayload> {
    const iv = randomBytes(12);

    const encrypted =
        await crypto.subtle.encrypt(
            {
                name: "AES-GCM",
                iv,
            },
            key,
            stringToBytes(
                plaintext,
            ),
        );

    return {
        ...existing,

        iv: bytesToBase64(
            iv,
        ),

        ciphertext:
            bytesToBase64(
                new Uint8Array(
                    encrypted,
                ),
            ),

        plaintextHash:
            await sha256Hex(
                plaintext,
            ),

        updatedAt:
            new Date().toISOString(),
    };
}

export async function reencryptPayload(
    payload: EncPayload,
    plaintext: string,
    newPassword: string,
): Promise<EncryptionResult> {
    return encryptPayload(
        payload.id,
        plaintext,
        newPassword,
        payload.createdAt,
    );
}