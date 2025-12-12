# Deck Studio Installation

This document covers installing Deck Studio either from a packaged installer or by building from source.

## System requirements
- Node.js 20.x and npm 10.x (recommended for consistency with the project lockfile).
- Git for fetching the repository.
- macOS, Windows, or Linux capable of running Electron apps.

## Option 1: Install from prebuilt installer
When a packaged build is available, follow these steps:
1. Download the latest installer (`.exe`, `.dmg`, or `.AppImage`) from the release page.
2. Run the installer and follow the OS prompts.
3. Launch **Deck Studio** from your applications menu.
4. Use **File → Open Project** to choose an existing project folder that matches the structure in `README.md`.

> Placeholder image for installer flow: `![Installer placeholder](docs/images/installer.png)`

## Option 2: Build from source
Use this path when developing or when no installer is available.

1. Clone the repository and install dependencies:
   ```bash
   git clone https://example.com/Deck-Studio.git
   cd Deck-Studio
   npm install
   ```
2. Start the development environment (Electron + Vite):
   ```bash
   npm run dev
   ```
   Wait for the Electron window to open after the Vite server starts.
3. Build the React bundle for production:
   ```bash
   npm run build
   ```
4. Create a distributable installer (requires platform-specific tooling such as `mono` on Linux for Windows builds):
   ```bash
   npm run dist
   ```
   The generated installer files will appear under the `dist/` directory produced by `electron-builder`.

> Placeholder image for build output: `![Build pipeline placeholder](docs/images/build-pipeline.png)`

## Verification
- Run linting before distributing changes:
  ```bash
  npm run lint
  ```
- Run tests (after building test artifacts):
  ```bash
  npm test
  ```

> Placeholder image for verification: `![Verification placeholder](docs/images/verification.png)`

## Troubleshooting
- If `npm run dev` does not start Electron, check that port 5173 is free and that `wait-on` is installed via `npm install`.
- For build errors, ensure platform-specific dependencies for `electron-builder` are available (e.g., system libraries for packaging on Linux).
- Delete `node_modules` and reinstall if dependency resolution fails: `rm -rf node_modules && npm install`.
