import { TFile } from "obsidian";

export const PLACEHOLDER_MARKER =
    "WOP_ENCRYPTED_NOTE";

export function buildPlaceholder(
    updatedAt?: string,
): string {
    return `---
wopEncrypted: true
wopVersion: 2
---

# 🔒 Encrypted Note

<!-- ${PLACEHOLDER_MARKER} -->

This note is encrypted.

Use the buttons below:

- Unlock
- Reset Password (after unlock)

Protected by Web Obsidian

Last Updated:
${updatedAt ?? "Unknown"}
`;
}

export function isPlaceholder(
    content: string,
): boolean {
    return content.includes(
        PLACEHOLDER_MARKER,
    );
}

export function stripPlaceholder(
    content: string,
): string {
    if (
        !isPlaceholder(content)
    ) {
        return content;
    }

    return "";
}

export function isMarkdown(
    file: TFile | null,
): file is TFile {
    return !!file &&
        file.extension.toLowerCase() ===
            "md";
}