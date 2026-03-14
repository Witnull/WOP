import { App, Notice, PluginSettingTab, Setting } from "obsidian";
import MyPlugin from "./main";
import slashSeedData from "./commands/data.json";

const MODULE_SLASH = "slash";

export interface SlashCommandConfig {
	id: string;
	command: string;
	alias: string;
	value: string;
	enabled: boolean;
}

export interface TriggerGroupConfig {
	id: string;
	trigger: string;
	enabled: boolean;
	commands: SlashCommandConfig[];
}

export interface MyPluginSettings {
	enabled: boolean;
	triggerGroups: TriggerGroupConfig[];
}

interface SlashSeedCommand {
	command: string;
	alias: string | null;
	value: string;
}

interface SlashSeedData {
	hotKey: string;
	commands: Record<string, SlashSeedCommand>;
}

function toSeedDataFromGroup(group: TriggerGroupConfig): SlashSeedData {
	const commands = group.commands.reduce<Record<string, SlashSeedCommand>>((acc, command, index) => {
		const key = toSafeId(command.command || command.id, `command-${index + 1}`);
		acc[key] = {
			command: command.command,
			alias: command.alias?.trim() ? command.alias : null,
			value: command.value
		};
		return acc;
	}, {});

	return {
		hotKey: group.trigger,
		commands
	};
}

function readFileAsText(file: File): Promise<string> {
	return new Promise((resolve, reject) => {
		const reader = new FileReader();
		reader.onload = () => resolve(String(reader.result ?? ""));
		reader.onerror = () => reject(reader.error ?? new Error("Failed to read file"));
		reader.readAsText(file);
	});
}

function buildDefaultSlashCommands(data: SlashSeedData): SlashCommandConfig[] {
	const entries = Object.values(data.commands);

	return entries.map((entry, index) => {
		const command = entry.command?.trim() || `command-${index + 1}`;
		return {
			id: toSafeId(command, `cmd-${index + 1}`),
			command,
			alias: entry.alias?.trim() ?? "",
			value: entry.value ?? "",
			enabled: true
		};
	});
}

const seed = slashSeedData as SlashSeedData;

export const DEFAULT_SETTINGS: MyPluginSettings = {
	enabled: true,
	triggerGroups: [
		{
			id: "slash",
			trigger: seed.hotKey?.slice(0, 1) || "/",
			enabled: true,
			commands: buildDefaultSlashCommands(seed)
		}
	]
};

function toSafeId(value: string, fallback: string): string {
	const id = value.trim().toLowerCase().replace(/[^a-z0-9_-]+/g, "-").replace(/^-+|-+$/g, "");
	return id || fallback;
}

function makeUniqueIds(values: string[], prefix: string): string[] {
	const seen = new Map<string, number>();
	return values.map((value, index) => {
		const base = toSafeId(value, `${prefix}-${index + 1}`);
		const count = seen.get(base) ?? 0;
		seen.set(base, count + 1);
		return count === 0 ? base : `${base}-${count + 1}`;
	});
}

function maybeHydrateGroupFromSeed(settings: MyPluginSettings): void {
	if (settings.triggerGroups.length === 0) {
		return;
	}

	const defaultTrigger = seed.hotKey?.slice(0, 1) || "/";
	const targetGroup =
		settings.triggerGroups.find((group) => group.trigger === defaultTrigger) ?? settings.triggerGroups[0];
	if (!targetGroup) {
		return;
	}

	const shouldHydrate = targetGroup.commands.length === 0;
	if (shouldHydrate) {
		targetGroup.commands = buildDefaultSlashCommands(seed);
	}
}

export function normalizeSettings(data: Partial<MyPluginSettings> | null | undefined): MyPluginSettings {
	const sourceGroups = data?.triggerGroups ?? DEFAULT_SETTINGS.triggerGroups;
	const merged: MyPluginSettings = {
		enabled: data?.enabled ?? DEFAULT_SETTINGS.enabled,
		triggerGroups: sourceGroups.map((group, groupIndex) => ({
			id: group.id || `group-${groupIndex + 1}`,
			trigger: (group.trigger ?? "/").slice(0, 1) || "/",
			enabled: group.enabled ?? true,
			commands: (group.commands ?? []).map((command, commandIndex) => ({
				id: command.id || `cmd-${groupIndex + 1}-${commandIndex + 1}`,
				command: command.command || "",
				alias: command.alias || "",
				value: command.value || "",
				enabled: command.enabled ?? true
			}))
		}))
	};

	if (merged.triggerGroups.length === 0) {
		merged.triggerGroups = DEFAULT_SETTINGS.triggerGroups.map((group) => ({
			...group,
			commands: group.commands.map((command) => ({ ...command }))
		}));
	}

	maybeHydrateGroupFromSeed(merged);

	const groupIds = makeUniqueIds(merged.triggerGroups.map((group) => group.id), "group");
	merged.triggerGroups.forEach((group, groupIndex) => {
		group.id = groupIds[groupIndex] ?? `group-${groupIndex + 1}`;
		const commandIds = makeUniqueIds(group.commands.map((command) => command.id), `${group.id}-cmd`);
		group.commands.forEach((command, commandIndex) => {
			command.id = commandIds[commandIndex] ?? `${group.id}-cmd-${commandIndex + 1}`;
		});
	});

	return merged;
}

export class WopSettingTab extends PluginSettingTab {
	plugin: MyPlugin;
	private activeGroupId: string | null = null;
	private activeModuleId = MODULE_SLASH;

	constructor(app: App, plugin: MyPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;

		containerEl.empty();
		containerEl.createEl("h2", { text: "WOP settings" });
		containerEl.createEl("h3", { text: "Modules" });

		const moduleTabsEl = containerEl.createDiv({ cls: "wop-module-tabs" });
		const slashModuleButton = moduleTabsEl.createEl("button", {
			text: "Slash commands",
			cls: "wop-module-tab"
		});
		if (this.activeModuleId === MODULE_SLASH) {
			slashModuleButton.addClass("is-active");
		}

		slashModuleButton.addEventListener("click", () => {
			this.activeModuleId = MODULE_SLASH;
			this.display();
		});

		containerEl.createEl("hr", { cls: "wop-section-divider" });

		const modulePanelEl = containerEl.createDiv({ cls: "wop-module-panel" });
		if (this.activeModuleId === MODULE_SLASH) {
			this.renderSlashCommandModule(modulePanelEl);
		}
	}

	private renderSlashCommandModule(containerEl: HTMLElement): void {

		new Setting(containerEl)
			.setName("Enable slash command suggestions")
			.setDesc("Turn slash command suggestions on or off.")
			.addToggle((toggle) =>
				toggle.setValue(this.plugin.settings.enabled).onChange(async (value) => {
					this.plugin.settings.enabled = value;
					await this.plugin.saveSettings();
				}),
			);

		containerEl.createEl("hr", { cls: "wop-section-divider" });

		containerEl.createEl("h3", { text: "Trigger groups" });

		new Setting(containerEl)
			.setName("Add trigger group")
			.setDesc("Create another command list per special char, for example '>'")
			.addButton((button) =>
				button.setButtonText("+ Add group").onClick(async () => {
					const nextNumber = this.plugin.settings.triggerGroups.length + 1;
					const nextId = `group-${nextNumber}`;
					this.plugin.settings.triggerGroups.push({
						id: nextId,
						trigger: ">",
						enabled: false,
						commands: [
							{
								id: `group-${nextNumber}-cmd-1`,
								command: "new-command",
								alias: "",
								value: "",
								enabled: false
							}
						]
					});
					this.plugin.settings = normalizeSettings(this.plugin.settings);
					this.activeGroupId = nextId;
					await this.plugin.saveSettings();
					this.display();
				}),
			);

		if (this.plugin.settings.triggerGroups.length === 0) {
			return;
		}

		const hasActiveGroup = this.plugin.settings.triggerGroups.some((group) => group.id === this.activeGroupId);
		if (!hasActiveGroup) {
			this.activeGroupId = this.plugin.settings.triggerGroups[0]?.id ?? null;
		}

		const tabsEl = containerEl.createDiv({ cls: "wop-group-tabs" });
		this.plugin.settings.triggerGroups.forEach((group, groupIndex) => {
			const label = `${group.trigger} Group ${groupIndex + 1}`;
			const tabButton = tabsEl.createEl("button", {
				text: label,
				cls: "wop-group-tab"
			});
			if (group.id === this.activeGroupId) {
				tabButton.addClass("is-active");
			}

			tabButton.addEventListener("click", () => {
				this.activeGroupId = group.id;
				this.display();
			});
		});

		containerEl.createEl("hr", { cls: "wop-section-divider" });
		this.renderTriggerGroup(containerEl, this.activeGroupId);
	}

	private renderTriggerGroup(containerEl: HTMLElement, groupId: string | null): void {
		if (!groupId) {
			return;
		}

		const group = this.plugin.settings.triggerGroups.find((entry) => entry.id === groupId);
		if (!group) {
			return;
		}

		const groupIndex = this.plugin.settings.triggerGroups.findIndex((entry) => entry.id === groupId);
		const panelEl = containerEl.createDiv({ cls: "wop-group-panel" });
		panelEl.createEl("h4", { text: `Group ${groupIndex + 1}: ${group.trigger}` });

		new Setting(panelEl)
			.setName("Trigger")
			.setDesc("One character that opens this command list.")
			.addText((text) => {
				text.inputEl.addClass("wop-responsive-input");
				return text.setPlaceholder("/").setValue(group.trigger).onChange(async (value) => {
					const trigger = value.slice(0, 1);
					if (!trigger) {
						new Notice("Trigger must contain at least one character.");
						this.display();
						return;
					}

					const isTriggerUsed = this.plugin.settings.triggerGroups.some(
						(entry) => entry.id !== group.id && entry.trigger === trigger,
					);
					if (isTriggerUsed) {
						new Notice(`Trigger '${trigger}' is already used by another group.`);
						this.display();
						return;
					}

					group.trigger = trigger;
					this.plugin.settings = normalizeSettings(this.plugin.settings);
					await this.plugin.saveSettings();
					this.display();
				});
			})
			.addToggle((toggle) =>
				toggle
					.setTooltip("Enable this trigger group")
					.setValue(group.enabled)
					.onChange(async (value) => {
						group.enabled = value;
						await this.plugin.saveSettings();
					}),
			)
			.addExtraButton((button) =>
				button.setIcon("trash").setTooltip("Delete group").onClick(async () => {
					this.plugin.settings.triggerGroups = this.plugin.settings.triggerGroups.filter(
						(entry) => entry.id !== group.id,
					);
					this.plugin.settings = normalizeSettings(this.plugin.settings);
					this.activeGroupId = this.plugin.settings.triggerGroups[0]?.id ?? null;
					await this.plugin.saveSettings();
					this.display();
				}),
			);

		panelEl.createEl("hr", { cls: "wop-section-divider" });

		new Setting(panelEl)
			.setName("Commands")
			.setDesc("Manage commands in this trigger group.")
			.addButton((button) =>
				button.setButtonText("+ Add cmd").setCta().onClick(async () => {
					const nextNumber = group.commands.length + 1;
					group.commands.push({
						id: `${group.id}-cmd-${nextNumber}`,
						command: `command-${nextNumber}`,
						alias: "",
						value: "",
						enabled: true
					});
					this.plugin.settings = normalizeSettings(this.plugin.settings);
					await this.plugin.saveSettings();
					this.display();
				}),
			);

		group.commands.forEach((command) => {
			new Setting(panelEl)
				.addToggle((toggle) =>
					toggle.setValue(command.enabled).setTooltip("Enable command").onChange(async (value) => {
						command.enabled = value;
						await this.plugin.saveSettings();
					}),
				)
				.addText((text) => {
					text.inputEl.addClass("wop-responsive-input");
					return text.setPlaceholder("command").setValue(command.command).onChange(async (value) => {
						command.command = value.trim();
						await this.plugin.saveSettings();
					});
				})
				.addText((text) => {
					text.inputEl.addClass("wop-responsive-input");
					return text.setPlaceholder("alias").setValue(command.alias).onChange(async (value) => {
						command.alias = value.trim();
						await this.plugin.saveSettings();
					});
				})
				.addTextArea((text) => {
					text.inputEl.addClass("wop-responsive-textarea");
					text.inputEl.rows = 2;
					return text.setPlaceholder("inserted value (multiline supported)").setValue(command.value).onChange(async (value) => {
						command.value = value;
						await this.plugin.saveSettings();
					});
				})
				.addExtraButton((button) =>
					button.setIcon("trash").setTooltip("Delete command").onClick(async () => {
						group.commands = group.commands.filter((entry) => entry.id !== command.id);
						this.plugin.settings = normalizeSettings(this.plugin.settings);
						await this.plugin.saveSettings();
						this.display();
					}),
				);
		});

		new Setting(panelEl)
			.setName("Load default commands")
			.setDesc("Replace this group's command list with defaults from data.json.")
			.addButton((button) =>
				button.setButtonText("Load default commands").onClick(async () => {
					group.commands = buildDefaultSlashCommands(seed);
					this.plugin.settings = normalizeSettings(this.plugin.settings);
					await this.plugin.saveSettings();
					this.display();
				}),
			);

		new Setting(panelEl)
			.setName("Import or export data.json")
			.setDesc("Import commands into this group or export this group as data.json format.")
			.addButton((button) =>
				button.setButtonText("Export data.json").onClick(() => {
					this.exportGroupDataJson(group, groupIndex);
				}),
			)
			.addButton((button) =>
				button.setButtonText("Import data.json").onClick(async () => {
					await this.importGroupDataJson(group);
				}),
			);
	}

	private exportGroupDataJson(group: TriggerGroupConfig, groupIndex: number): void {
		const payload = toSeedDataFromGroup(group);
		const data = JSON.stringify(payload, null, 2);
		const blob = new Blob([data], { type: "application/json" });
		const url = URL.createObjectURL(blob);
		const link = document.createElement("a");
		const safeGroup = toSafeId(group.id, `group-${groupIndex + 1}`);
		link.href = url;
		link.download = `${safeGroup}-data.json`;
		document.body.appendChild(link);
		link.click();
		link.remove();
		URL.revokeObjectURL(url);
		new Notice("Exported group data.json");
	}

	private async importGroupDataJson(group: TriggerGroupConfig): Promise<void> {
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
				const parsed = JSON.parse(raw) as Partial<SlashSeedData>;
				if (!parsed || typeof parsed !== "object" || !parsed.commands || typeof parsed.commands !== "object") {
					new Notice("Invalid data.json format.");
					return;
				}

				const importedCommands = buildDefaultSlashCommands({
					hotKey: String(parsed.hotKey ?? (group.trigger || "/")),
					commands: parsed.commands as Record<string, SlashSeedCommand>
				});

				const confirmed = window.confirm(
					"Importing will replace all commands in this group. Continue?",
				);
				if (!confirmed) {
					new Notice("Import canceled.");
					return;
				}

				group.commands = importedCommands;
				const importedTrigger = String(parsed.hotKey ?? "").slice(0, 1);
				if (importedTrigger) {
					const alreadyUsed = this.plugin.settings.triggerGroups.some(
						(entry) => entry.id !== group.id && entry.trigger === importedTrigger,
					);
					if (!alreadyUsed) {
						group.trigger = importedTrigger;
					}
				}

				this.plugin.settings = normalizeSettings(this.plugin.settings);
				await this.plugin.saveSettings();
				this.display();
				new Notice("Imported data.json into this group.");
			} catch (_error) {
				new Notice("Failed to import data.json.");
			}
		});

		input.click();
	}
}
