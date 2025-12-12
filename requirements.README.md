
Here’s a consolidated view of what the app is supposed to be, and what’s still left to implement.

---

## 1. Summary of all requirements

### 1.1. Overall goal

* Desktop **Electron** application with **React** UI.
* Purpose: a **NanDeck-like** tool for creating card decks:

    * Card data in **CSV**.
    * Card layout in **HTML templates**.
    * Per-project configuration and localization in **YAML**.
* Output: cards will eventually be exported to PDF/images for printing.

---

### 1.2. Tech stack & architecture

* **Electron**:

    * Main process manages window, IPC, and file-system access.
    * Preload exposes a sandboxed `window.api` for React.

* **React (standalone)**:
    * React Material for UI.
    * Monaco editor for code editing.


---

### 1.3. Project structure on disk

Each project lives in a folder chosen by the user and must look like this (minimum):

```text
project-root/
  card-deck-project.yml   # project config (YAML)
  cards.csv               # card data (CSV)
  templates/
    default.html          # default card template
    ... other templates ...
  images/
    ... card images ...
  i18n/
    en.yml                # per-project localization for cards/columns
    ... optional other locales ...
```

* Templates and images are referenced using **paths relative to `card-deck-project.yml`**.
* Project config (`card-deck-project.yml`) is always stored in the project root and uses YAML.

---

### 1.4. Project configuration (YAML)

* Required/standard sections in `card-deck-project.yml`:

  ```yaml
  paths:
    csv: "cards.csv"

  templates:
    default: "templates/default.html"
    # wrapper: "templates/wrap.html"   # optional wrapper for future

  localization:
    defaultLocale: "en"
    directory: "i18n"

  csv:
    templateColumn: "template"
    idColumn: "id"

  layout:
    card:
      width: 63        # numeric
      height: 88       # numeric
      unit: "mm"       # "mm", "cm", "inch", "px", etc.
      # dpi: 120       # optional for export
  ```

* `templates.default` is used if a card row doesn’t specify a template.

* `localization.*` defines where to find localization files in the project.

* `csv.templateColumn` / `csv.idColumn` tell the app which CSV columns to use for template path and card ID.

* `layout.card` defines **default card dimensions** (used for preview aspect ratio and later export).

* `supportedLocales` are *discovered* by scanning `localization` directory, not stored explicitly.

---

### 1.5. CSV semantics (card data)

* `cards.csv` is the **primary card data source**.

* Each row represents a card; columns are mostly free-form.

* Some “well-known” columns have special meaning:

  ```ts
  export interface CardRecord {
    [key: string]: string | undefined;
    id?: string;        // used to link with localization cards.<id>
    template?: string;  // per-card template path (relative to cards.csv)
    image?: string;     // optional image path (relative)
    width?: string;     // per-card override for width (unit consistent with layout)
    height?: string;    // per-card override for height
    count?: string;     // how many copies to generate on export
  }
  ```

* Other columns (e.g. `Name`, `Info`, `Damage`, `Cost`, etc.) are available to templates as `{{FieldName}}`.

* CSV may contain heterogeneous cards:

    * Some cards have `attack`, others `defense`, others `regeneration`, etc.
    * The schema is intentionally flexible via the `Record<string, string | undefined>` pattern.

---

### 1.6. Templates & rendering

* Templates are **HTML fragments** (not full documents).

* A per-card template is chosen by:

    1. Card row’s `template` column (relative path) if present.
    2. Otherwise, `templates.default` from project YAML.

* Template placeholders:

    * **Raw CSV fields**:
      `{{FieldName}}` → replaced with the string from `CardRecord[FieldName]` or `''` if missing.
    * **Meta fields**:

        * `{{index}}` → 0-based index of card in the deck.
        * `{{index1}}` / `{{row}}` → 1-based index.
    * **i18n / localization**:

        * `{{t:...}}` or `{{i18n:...}}` (synonyms).
        * `{{t:card.Name}}` → card-specific text (per-ID).
        * `{{t:columns.Name}}` → column/label text.
        * `{{t:common.cost}}` → common UI text.

* Rendering pipeline:

    1. Resolve i18n placeholders (`{{t:...}}`) with a card-aware resolver.
    2. Fallback from missing i18n to **CSV field** (see i18n section below).
    3. Replace `{{FieldName}}` from CSV.
    4. Rewrite local asset URLs (images) to `file:///…` using project folder.

* Card HTML is embedded into a **full HTML document** and loaded into an `<iframe srcdoc>` for:

    * isolation of CSS,
    * support for template-defined `<style>`.

---

### 1.7. i18n (localization)

* Per-project i18n files live in `i18n/<locale>.yml` (e.g., `i18n/en.yml`) or other folder specified in project YAML.

* Typical structure:

  ```yaml
  columns:
    Name: "Name"
    Info: "Info"
    Damage: "Damage"
    Cost: "Cost"

  common:
    cost: "Cost"
    cardNumber: "Card #"

  cards:
    FIREBALL:
      Name: "Fireball"
      Info: "Deal {{Damage}} damage"
    HEAL:
      Name: "Heal"
      Info: "Restore 3 HP"
  ```

* Key resolution:

    * `{{t:card.Name}}` → `cards.<id>.Name` using card `id` column, with fallback to raw CSV `Name`.
    * `{{t:columns.Name}}` → `columns.Name`, with fallback to raw CSV `Name`.
    * `{{t:whatever.FunnyField}}` → `whatever.FunnyField`, fallback to CSV field `FunnyField`.

* i18n files are **project-level**. Application-level UI localization is separate and bundled into the app.

* The `card.` prefix is used to indicate “per-card localized text” that varies by card `id`.

---

### 1.8. UI layout & panels

Main window layout:

* **Top toolbar**:

    * Buttons: “New project”, “Open project”.
    * Potential future controls (locale selection, export).
* **Left: Project Tree panel**:

    * Tree view of all files/folders in project root.
    * Single-click on file → open in editor.
    * Double-click on folder → expand/collapse.
    * Currently open file highlighted.
* **Center: Editor panel (Monaco)**:

    * Shows contents of selected file.
    * Tracks dirty state; Save button enabled when there are unsaved changes.
* **Right: Card Preview panel**:

    * Shows the rendered card HTML in an iframe.
    * Bottom toolbar:

        * Zoom buttons (out/in/reset/fit) – currently placeholders.
        * Card selection dropdown with search:

            * List of cards from CSV.
            * Search field pinned at top of dropdown.
            * Selected label shows `[index] Title`, with title chosen from `Name/title/id` fallback.
* **Bottom: Log panel**:

    * Shows app and project logs.
    * Uses shared panel header styles.

Panel behavior:

* Panels share common SCSS (`.panel`, `.panel__header`, `.panel__content`).
* Collapse behavior exists for some panels (tree, preview, logs) using header buttons and global styles.
* Resizing via splitters is planned but not currently active (previous attempt rolled back; to re-introduce later, purely via CSS/DOM, not App TS).

---

### 1.9. Editor behavior (Monaco)

* Editor is a **single Monaco instance** in the center panel.
* It:

    * Initializes once when the view is ready.
    * Gets its initial content and language from `ProjectService`.
    * Syncs **both ways** with `ProjectService`:

        * Service → editor via `currentFileContent$`.
        * Editor → service via `updateCurrentFileContent`.
* Language detection based on file extension:

    * `html`, `css/scss`, `ts`, `js`, `json`, `yml/yaml`, `csv` (as plaintext), etc.
* Monaco workers are configured via `MonacoEnvironment.getWorker` and custom worker paths in `monaco-setup.ts`.
* Monaco is preloaded at app startup (`preloadMonaco()`), so the first editor use is snappy.

---

### 1.10. Preview behavior

* Uses `currentCardPreviewHtml$` from `ProjectService`, wrapped into a full HTML document and set as `srcdoc` of an iframe.
* The preview card container respects **aspect ratio** derived from `layout.card.width/height`.
* Card selection dropdown:

    * Shows `[1] Fireball`, `[2] Heal`, etc.
    * Search filter inside the dropdown panel.
    * Resets search when a new project is loaded.
* Zoom buttons (UI only for now):

    * Zoom Out, Zoom In, Reset, Fit – actions to be implemented.

---

### 1.11. Project tree behavior

* Tree is built from the project folder recursively.
* Nodes:

    * `type: 'folder'` or `type: 'file'`.
    * Sorted: folders first, then files, both alphabetically (case-insensitive).
* Behavior:

    * Single-click file → open in editor via `ProjectService.openFileFromTree(node)`.
    * Double-click folder → toggles expansion.
    * Currently open file is visually highlighted in the tree.

---

### 1.12. Persistence: app info, logs, configs

* **Project-level**:

    * Project config and i18n are YAML inside the project folder.
    * Card data in CSV inside the project folder.
* **App-level (requirement)**:

    * Application properties and logs must be stored in a cross-platform way:

        * `{APPDATA}/{app}` on Windows.
        * `{user home}/{app}` or equivalent on other OSes.
    * Storage format: YAML.
    * Examples: last opened project(s), app preferences, log files or at least persisted error reports.

(Actual implementation of this storage is still pending – see TODO.)

---

### 1.13. Packaging

* Final deliverable is a desktop app:

    * Electron main uses `app.isPackaged` to switch between dev server and built React app.
    * Packaging via `electron-builder`:

        * `npm run build` — React + Electron build.
        * `npm run dist` — run electron-builder to create `.exe` (NSIS installer and/or portable).

---

## 2. Extracted TODO list (implementation requests)

These are all the *explicit* or clearly implied implementation tasks you’ve requested that are not fully done yet.

### 2.1. Layout & card sizing

* [ ] **Per-card width/height from CSV**:

    * Read `width` and `height` columns from `CardRecord`.
    * If present and valid, override `layout.card.width` / `height` for that card when computing aspect ratio and later for export.
    * Decide unit handling:

        * Either same units as `layout.card.unit`, or allow explicit `mm`, `px`, etc. per card.

* [ ] **Use `count` column when generating output**:

    * Respect `count` in CSV when exporting cards to PDF/images (repeat card N times).

* [ ] **Real zoom & fit in Preview**:

    * Implement the logic behind `onZoomOut`, `onZoomIn`, `onZoomReset`, `onToggleFit`:

        * Probably using a CSS transform (scale) on inner content.
        * “Fit” should scale card to fit the panel while preserving aspect ratio.

---

### 2.2. Asset/URL handling in rendered HTML

* [ ] **Implement local asset URL rewriting**:

    * After `renderCardTemplate`, run `rewriteAssetUrls(renderedHtml)`:

        * Find `<img src="...">` (and optionally `<link>`, `<source>`, etc.).
        * If `src` is **relative** and not `http/https/file/data`, convert to `file:///…` based on `projectFolder`.
    * Ensure this handles paths from CSV variables (images, icons, backgrounds) and hard-coded template paths.

---

### 2.3. Export / generation

* [ ] **Add export to PDF (and/or images)**:

    * Generate a deck of rendered cards (honoring per-card size and `count`).
    * Render each card to:

        * Multi-page PDF (cards arranged on sheets), and/or
        * Individual PNGs (per card instance).
    * Use Electron/Chromium print-to-PDF or a suitable rendering strategy.
    * Provide simple export options (output folder, basic layout on page).

---

### 2.4. App-level persistence & logs

* [ ] **Implement app-level storage in `APPDATA` / home**:

    * On startup, determine platform-specific config directory:

        * Windows: `%APPDATA%/{appName}`
        * macOS/Linux: use standard user config/home patterns.
    * Store:

        * App properties (e.g., most recent projects, last window size, last locale).
        * Optionally, persistent logs (or at least error reports) in YAML files.

* [ ] **Wire log service to optional file persistence**:

    * Provide a mode where logs are appended to a YAML or text file in app data dir.
    * Keep the log panel as the in-UI view.

---

### 2.5. Preview & layout extras

* [ ] **Integrate layout with export logic**:

    * Use layout.unit + layout.dpi + per-card overrides when computing:

        * Physical size in mm/inches.
        * Pixel size for rendering/export.

* [ ] (Optional) **Pan/scroll improvements for zoomed cards**:

    * Decide whether zoomed preview uses scrollbars, drag-to-pan, or both.

---

### 2.6. Panel UX & layout

* [ ] **Reintroduce stable panel collapsing** (with shared SCSS, no TS dimension logic):

    * Implement collapse/expand for Project Tree, Preview, and Log panel:

        * Using `panel--collapsed` class and CSS only.
        * Vertical header style for collapsed side panels.
    * Ensure hover/active states and button alignment work consistently.

* [ ] **Add resizable splitters** (if you still want this):

    * Horizontal/vertical splitters between Project Tree / Editor / Preview / Log.
    * Implement purely with DOM + CSS (`flex-basis`, `resize`, or manual `mousedown` handlers).

---

### 2.7. Editor features

* [ ] **Multiple open files (tabs)**:

    * Maintain list of open files with their own Monaco models and view states.
    * Material tabs above editor to switch between them.
    * Single-click on tree:

        * If file is already open: activate tab.
        * If not: open new tab.
    * Handle closing tabs, default tab, and fallback when last tab closes.

* [ ] **Unsaved changes protection**:

    * Warn before:

        * Closing the app.
        * Opening another project.
        * Closing a tab.
    * Offer “Save / Discard / Cancel” dialog where appropriate.

* [ ] **Better save feedback**:

    * Show a small snackbar/toast or status message when a file is saved.

---

### 2.8. i18n & localization enhancements

* [ ] **Multi-locale support in project**:

    * Scan `localization` directory for available `<locale>.yml`.
    * Provide a way (toolbar menu or settings) to switch current locale.
    * Reload localization data and rerender previews when locale changes.

* [ ] **Missing translation diagnostics (optional)**:

    * When a `{{t:...}}` key is missing and CSV fallback is used or empty:

        * Optionally log a warning in the log panel (or tagged diagnostics view).
    * Maybe allow a “debug mode” to show markers in the rendered card.

---

### 2.9. Template system extras

* [ ] **Optional wrapper template support**:

    * Allow `templates.wrapper` in project YAML.
    * Wrapper HTML should have a placeholder (e.g., `{{content}}`).
    * Rendering pipeline:

        * Render card fragment from per-card template.
        * Inject fragment into wrapper and pass that to Preview/export.

* [ ] (Future) **Template validation**:

    * Detect obvious mistakes (missing default template, unresolved paths, etc.).
    * Provide helpful messages in log panel.

---

### 2.10. Project tree & file UX

* [ ] **Context menu in project tree** (when/if you decide you want it):

    * Actions like “New file”, “Rename”, “Delete”, “Reveal in Explorer/Finder”.
    * Ensure these operations also update the tree and editor tabs.

---

### 2.11. Packaging & distribution

* [ ] **Finalize electron-builder config & scripts**:

    * Ensure `main` points to your Electron entry (`electron/main.cjs`).
    * Ensure `build.files` includes React `dist`, `electron/` directory, and `package.json`.
    * Verify `loadFile` path for production is correct (`dist/<project>/browser/index.html`).
    * Test `npm run dist` builds a working installer `.exe`.

---

If you want, we can next pick **one specific TODO** (for example, per-card width/height overrides, or the asset URL rewriting) and wire it end-to-end in the current codebase.
