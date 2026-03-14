# WOP: Multi-trigger slash command suggester for Obsidian

WOP adds configurable command suggestions in the editor based on trigger characters.

You can create one or many trigger groups (for example `/` and `>`), each with its own command list, and enable or disable groups and commands independently.

## Features

- Slash-style suggestion menu while typing in markdown editors
- Multiple trigger groups (`/`, `>`, or any single character)
- Per-group enable toggle
- Per-command enable toggle
- Add and remove groups and commands from settings
- Built-in date token replacement: `{{date}}` -> `YYYY-MM-DD`

## How it works

Type a trigger character followed by a command key.

Examples:

- `/h1` -> inserts `# `
- `/todo` -> inserts `- [ ] `
- `>sig` -> inserts your custom signature text

Suggestions match both:

- command key (`command`)
- alias (`alias`)

## Settings

Open Obsidian settings:

- **Settings -> Community plugins -> WOP -> Options**

You can configure:

- Global enable toggle for all suggestions
- Trigger groups
  - Trigger character (first character is used)
  - Group enable toggle
  - Delete group
- Commands inside each group
  - Command key
  - Alias (optional)
  - Inserted value
  - Enable toggle
  - Delete command

## Development

Requirements:

- Node.js 18+
- npm

Install dependencies:

```bash
npm install
```

Run watch build:

```bash
npm run dev
```

Run production build:

```bash
npm run build
```

## Manual install for testing

Copy these files to your vault plugin folder:

- `main.js`
- `manifest.json`
- `styles.css`

Target folder:

```text
<Vault>/.obsidian/plugins/obsidian-wop/
```

Then reload Obsidian and enable the plugin.

## Notes

- This plugin currently focuses only on command suggestion and insertion behavior.
- If all trigger groups are removed, defaults are restored on normalization to keep the plugin usable.
