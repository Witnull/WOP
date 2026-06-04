
import { App, TAbstractFile, TFile, TFolder } from "obsidian";
import type { FileTreeColorSettings } from "./settings";

interface FileTreeColoringPluginApi {
    app: App;
    settings: {
        fileTreeColoring: FileTreeColorSettings;
    };
    saveSettings: () => Promise<void>;
}

interface HslColor {
    hue: number;
    saturation: number;
    lightness: number;
}

interface RgbColor {
    red: number;
    green: number;
    blue: number;
}

const FILE_EXPLORER_SELECTOR =
    ".workspace-leaf-content[data-type='file-explorer'] .nav-file-title, .workspace-leaf-content[data-type='file-explorer'] .nav-folder-title";

const SAFE_BG_LIGHTNESS = {
    min: 28,
    max: 72,
};

const SAFE_BG_SATURATION = {
    min: 35,
    max: 90,
};

function clamp(value: number, min: number, max: number): number {
    return Math.min(max, Math.max(min, value));
}

function normalizePath(path: string): string {
    return path
        .trim()
        .replace(/\\/g, "/")
        .replace(/\/+$/, "");
}
function pathSegments(path: string): string[] {
    return normalizePath(path)
        .split("/")
        .map((segment) => segment.trim())
        .filter(Boolean);
}

function folderDepth(path: string): number {
    return Math.max(0, pathSegments(path).length - 1);
}

function rootFolderPath(path: string): string {
    return pathSegments(path)[0] ?? "";
}

function hashString(value: string): number {
    let hash = 0;

    for (let index = 0; index < value.length; index += 1) {
        hash = ((hash << 5) - hash + value.charCodeAt(index)) | 0;
    }

    return hash >>> 0;
}

function hashRatio(value: string): number {
    return hashString(value) / 0xffffffff;
}

function hexToRgb(value: string): RgbColor | null {
    const hex = value.trim().replace(/^#/, "");

    if (!/^[0-9a-fA-F]{3}$|^[0-9a-fA-F]{6}$/.test(hex)) {
        return null;
    }

    const normalized =
        hex.length === 3
            ? hex
                  .split("")
                  .map((part) => `${part}${part}`)
                  .join("")
            : hex;

    return {
        red: Number.parseInt(normalized.slice(0, 2), 16),
        green: Number.parseInt(normalized.slice(2, 4), 16),
        blue: Number.parseInt(normalized.slice(4, 6), 16),
    };
}

function rgbToHex(color: RgbColor): string {
    const toHex = (component: number): string =>
        clamp(component, 0, 255).toString(16).padStart(2, "0");

    return `#${toHex(color.red)}${toHex(color.green)}${toHex(color.blue)}`;
}

function hslToRgb(color: HslColor): RgbColor {
    const hue = ((color.hue % 360) + 360) % 360;
    const saturation = clamp(color.saturation, 0, 100) / 100;
    const lightness = clamp(color.lightness, 0, 100) / 100;

    const chroma = (1 - Math.abs(2 * lightness - 1)) * saturation;
    const hPrime = hue / 60;
    const x = chroma * (1 - Math.abs((hPrime % 2) - 1));

    let red = 0;
    let green = 0;
    let blue = 0;

    if (hPrime >= 0 && hPrime < 1) {
        red = chroma;
        green = x;
    } else if (hPrime < 2) {
        red = x;
        green = chroma;
    } else if (hPrime < 3) {
        green = chroma;
        blue = x;
    } else if (hPrime < 4) {
        green = x;
        blue = chroma;
    } else if (hPrime < 5) {
        red = x;
        blue = chroma;
    } else {
        red = chroma;
        blue = x;
    }

    const match = lightness - chroma / 2;

    return {
        red: Math.round((red + match) * 255),
        green: Math.round((green + match) * 255),
        blue: Math.round((blue + match) * 255),
    };
}

function applyOpacity(hex: string, opacity: number): string {
    const rgb = hexToRgb(hex);

    if (!rgb) {
        return hex;
    }

    return `rgba(${rgb.red}, ${rgb.green}, ${rgb.blue}, ${clamp(opacity, 0, 1).toFixed(2)})`;
}

function safeBackgroundColor(color: HslColor): string {
    return rgbToHex(
        hslToRgb({
            hue: color.hue,
            saturation: clamp(
                color.saturation,
                SAFE_BG_SATURATION.min,
                SAFE_BG_SATURATION.max,
            ),
            lightness: clamp(
                color.lightness,
                SAFE_BG_LIGHTNESS.min,
                SAFE_BG_LIGHTNESS.max,
            ),
        }),
    );
}

export class FileTreeColoringModule {
    private observer: MutationObserver | null = null;
    private scheduled = false;

    private readonly folderColorCache = new Map<string, string>();
    private readonly textColorCache = new Map<string, string>();

    constructor(private readonly plugin: FileTreeColoringPluginApi) {}

    register(): void {
        this.plugin.app.workspace.onLayoutReady(() => {
            this.refresh();
        });
    }

    destroy(): void {
        this.stopObserver();
        this.clearStyles();

        this.folderColorCache.clear();
        this.textColorCache.clear();
    }

    refresh(): void {
        this.stopObserver();

        this.folderColorCache.clear();
        this.textColorCache.clear();

        if (!this.plugin.settings.fileTreeColoring.enabled) {
            this.clearStyles();
            return;
        }

        this.applyToVisibleItems();
        this.startObserver();
    }

    getMainFolderColor(folderPath: string): string {
        const normalized = normalizePath(folderPath);

        if (!normalized) {
            return safeBackgroundColor(this.createBaseHsl("root"));
        }

        return this.getFolderColor(normalized);
    }

    private startObserver(): void {
        if (this.observer) {
            return;
        }

        this.observer = new MutationObserver(() => {
            this.scheduleApply();
        });

        this.observer.observe(document.body, {
            childList: true,
            subtree: true,
        });
    }

    private stopObserver(): void {
        this.observer?.disconnect();
        this.observer = null;
        this.scheduled = false;
    }

    private scheduleApply(): void {
        if (this.scheduled) {
            return;
        }

        this.scheduled = true;

        window.requestAnimationFrame(() => {
            this.scheduled = false;
            this.applyToVisibleItems();
        });
    }

    private applyToVisibleItems(): void {
        const items = document.querySelectorAll<HTMLElement>(FILE_EXPLORER_SELECTOR);

        items.forEach((item) => {
            this.applyToItem(item);
        });
    }

    private clearStyles(): void {
        const items = document.querySelectorAll<HTMLElement>(FILE_EXPLORER_SELECTOR);

        items.forEach((item) => {
            item.classList.remove(
                "wop-filetree-colored",
                "wop-filetree-folder",
                "wop-filetree-note",
            );

            item.style.removeProperty("--wop-filetree-bg");
            item.style.removeProperty("--wop-filetree-text");
        });
    }

    private applyToItem(item: HTMLElement): void {
        const path = this.resolveItemPath(item);

        if (!path) {
            return;
        }

        const abstractFile = this.plugin.app.vault.getAbstractFileByPath(path);

        if (!abstractFile) {
            return;
        }

        if (abstractFile instanceof TFolder) {
            this.applyFolderStyle(item, abstractFile.path);
            return;
        }

        if (abstractFile instanceof TFile) {
            this.applyFileStyle(item, abstractFile);
        }
    }

    private applyFolderStyle(item: HTMLElement, folderPath: string): void {
        const color = this.getFolderColor(folderPath);

        this.applyElementStyle(item, {
            background: color,
            text: this.getTextColor(folderPath),
            className: "wop-filetree-folder",
        });
    }

    private applyFileStyle(item: HTMLElement, file: TFile): void {
        const parentPath = normalizePath(file.parent?.path ?? "");
        const color = parentPath
            ? this.getFolderColor(parentPath)
            : this.getRootFileColor(file.path);

        this.applyElementStyle(item, {
            background: color,
            text: this.getTextColor(file.path),
            className: "wop-filetree-note",
        });
    }

    private applyElementStyle(
        item: HTMLElement,
        options: {
            background: string;
            text: string;
            className: string;
        },
    ): void {
        const opacity = this.plugin.settings.fileTreeColoring.backgroundOpacity;

        item.classList.remove(
            "wop-filetree-folder",
            "wop-filetree-note",
        );

        item.classList.add("wop-filetree-colored", options.className);

        item.style.setProperty(
            "--wop-filetree-bg",
            applyOpacity(options.background, opacity),
        );

        item.style.setProperty("--wop-filetree-text", options.text);
    }

    private resolveItemPath(item: HTMLElement): string | null {
        const directPath = item.getAttribute("data-path")?.trim();

        if (directPath) {
            return directPath;
        }

        const ancestorPath = item
            .closest<HTMLElement>("[data-path]")
            ?.getAttribute("data-path")
            ?.trim();

        return ancestorPath ?? null;
    }

    private getFolderColor(folderPath: string): string {
        const normalized = normalizePath(folderPath);

        const cached = this.folderColorCache.get(normalized);

        if (cached) {
            return cached;
        }

        const depth = folderDepth(normalized);
        const rootPath = rootFolderPath(normalized) || "root";

        const seedOverride =
            this.plugin.settings.fileTreeColoring.folderSeeds[rootPath];

        const seed = seedOverride
            ? `${rootPath}:${seedOverride}`
            : rootPath;

        const base = this.createBaseHsl(seed);

        const adjusted =
            depth === 0
                ? base
                : this.createNestedFolderColor(base, normalized, depth);

        const result = safeBackgroundColor(adjusted);

        this.folderColorCache.set(normalized, result);

        return result;
    }

    private createBaseHsl(seed: string): HslColor {
        return {
            hue: Math.floor(hashRatio(`${seed}:hue`) * 360),
            saturation:
                SAFE_BG_SATURATION.min +
                hashRatio(`${seed}:sat`) *
                    (SAFE_BG_SATURATION.max - SAFE_BG_SATURATION.min),
            lightness:
                SAFE_BG_LIGHTNESS.min +
                hashRatio(`${seed}:light`) *
                    (SAFE_BG_LIGHTNESS.max - SAFE_BG_LIGHTNESS.min),
        };
    }

    private createNestedFolderColor(
        base: HslColor,
        folderPath: string,
        depth: number,
    ): HslColor {
        const saturationOffset =
            (hashRatio(`${folderPath}:sat-offset`) - 0.5) * 10;

        const lightnessDrop =
            clamp(
                5 + hashRatio(`${folderPath}:light-drop`) * 7,
                4,
                12,
            ) * depth;

        return {
            hue: base.hue,
            saturation: clamp(
                base.saturation + saturationOffset,
                SAFE_BG_SATURATION.min,
                SAFE_BG_SATURATION.max,
            ),
            lightness: clamp(
                base.lightness - lightnessDrop,
                SAFE_BG_LIGHTNESS.min,
                SAFE_BG_LIGHTNESS.max,
            ),
        };
    }

    private getRootFileColor(filePath: string): string {
        return safeBackgroundColor(
            this.createBaseHsl(`root-file:${normalizePath(filePath)}`),
        );
    }

    private getTextColor(path: string): string {
        const normalized = normalizePath(path);

        const cached = this.textColorCache.get(normalized);

        if (cached) {
            return cached;
        }

        const configured =
            this.plugin.settings.fileTreeColoring.textColor.trim() || "#ffffff";

        this.textColorCache.set(normalized, configured);

        return configured;
    }
}
