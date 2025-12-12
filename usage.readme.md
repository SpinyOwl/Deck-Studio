# Deck Studio Usage

This guide walks you through running Deck Studio, opening a project, editing templates, and exporting previews. Image references use placeholders—replace them with actual screenshots when available.

## Quick start
1. Ensure dependencies are installed (see `installation.readme.md`).
2. From the repository root, start the development app:
   ```bash
   npm run dev
   ```
   This launches Vite for the React front end and opens Electron once the dev server is ready.
3. When the Electron window opens, choose **File → Open Project** and select a folder that matches the expected structure described in `README.md`.

> Placeholder preview: `![Project selection placeholder](docs/images/project-selection.png)`

## Creating a sample project
Use the template below to create a minimal project folder that can be opened immediately.

```
my-sample-project/
  card-deck-project.yml
  cards.csv
  templates/
    default.html
  images/
    sample.png
  i18n/
    en.yml
```

- `card-deck-project.yml` points to `cards.csv`, default template, and localization directory.
- `cards.csv` contains card rows; ensure column headers include `id` and `template` when per-card templates are used.
- `templates/default.html` defines the layout for each card.
- `images/sample.png` is referenced from CSV columns like `image` or custom fields.

> Placeholder preview: `![Project tree placeholder](docs/images/project-tree.png)`

## Common workflows
### Editing card data
1. Open `cards.csv` in the editor pane.
2. Use the CSV columns to add or update card fields. The `template` column can point to `templates/default.html` or another template file.
3. Save changes and check the Preview panel for live updates.

### Updating templates
1. Open any file under `templates/`.
2. Modify HTML and inline CSS as needed; template variables use `{{FieldName}}` and localization keys use `{{t:key.path}}`.
3. Save and verify the card preview updates automatically.

> Placeholder preview: `![Template editing placeholder](docs/images/template-editor.png)`

### Localization
1. Add localization YAML files under `i18n/` (e.g., `en.yml`).
2. Reference localized strings with `{{t:card.description}}` or similar keys in templates.
3. Reload the project if new locale files are added so they are discovered by the app.

### Exporting previews
Export functionality depends on project progress, but the general flow is:
1. Confirm card dimensions in `card-deck-project.yml` under `layout.card`.
2. Use the preview panel to verify sizing; when export is available, use the toolbar action (e.g., **Export**) to generate images or PDF.

> Placeholder preview: `![Export preview placeholder](docs/images/export-preview.png)`

## Troubleshooting tips
- If the preview does not refresh, ensure the dev server is running and check the terminal output from `npm run dev` for errors.
- For missing assets, verify paths in CSV and YAML files are relative to `card-deck-project.yml`.
- Run `npm run lint` to catch TypeScript/React issues before building.

## Keyboard shortcuts (planned)
- **Ctrl/Cmd + S**: Save current file.
- **Ctrl/Cmd + P**: Quick file search in the project tree.

> Placeholder preview: `![Shortcut helper placeholder](docs/images/shortcuts.png)`
