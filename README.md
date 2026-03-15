# WOP for Obsidian

WOP is a writing utility plugin with three editor modules:

- Slash commands: type a trigger like `/` or `>` and insert saved snippets
- Variable parser: auto-replace typed patterns like `->` with symbols like `→`
- Template importer: type a trigger like `!` and insert a template file by name

## Features

### Slash commands

- Multi-trigger groups (for example `/` and `>`), one character per group
- Enable or disable at module, group, and command level
- Search suggestions by command key and alias
- Multiline command values
- Built-in `{{date}}` token replacement to `YYYY-MM-DD`
- Per-group JSON import/export
- Load default commands from bundled `data.json`

Example:

- `/h1` inserts `# `
- `/todo` inserts `- [ ] `
- `>sig` inserts custom signature text

### Variable parser

- Replaces configured patterns while typing
- Rules are sorted by pattern length so more specific rules match first
- Enable or disable per rule
- JSON import/export for rule sets

Example defaults include:

- `->` to `→`
- `=>` to `⇒`
- `!=` to `≠`

### Template importer

- Trigger-based template suggestions by file name
- Configurable template folder (default `templates/`)
- One-character trigger symbol (default `!`)
- Inserts full template content at cursor after selecting a suggestion
- Warns in settings when the configured folder does not exist

## Settings

Open:

- **Settings -> Community plugins -> obsidian-wop -> Options**

The settings page has module tabs:

- `/ Slash commands`
- `* Variable parser`
- `! Templates importer`

## JSON formats

### Slash group import/export

```json
{
  "hotKey": "/",
  "commands": {
    "h1": {
      "command": "h1",
      "alias": "Heading 1",
      "value": "# "
    }
  }
}
```

### Variable parser import/export

```json
{
  "rules": [
    { "pattern": "->", "replacement": "→" },
    { "pattern": "!=", "replacement": "≠" }
  ]
}
```

## Development

Requirements:

- Node.js 18+
- npm

Install dependencies:

```bash
npm install
```

Watch build:

```bash
npm run dev
```

Production build:

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
