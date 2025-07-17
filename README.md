# cleanshyt

**cleanshyt** is a VS Code extension that transforms your import statements from messy to clean, readable, and maintainable code.

## Features

- **Alias Imports:** Converts relative imports (e.g. `../../components/Layout`) to workspace aliases (e.g. `@/components/Layout`) based on your `tsconfig.json` or project configuration.
- **Sort Imports:** Automatically sorts all import statements in a file by their source path, keeping your imports organized and easy to scan.
- **Remove Unused Imports:** Detects and removes unused imports from your JS/TS files, keeping your code lean and free of clutter.
- **Works on Files, Folders, and Workspace Folders:** All commands can be run on a single file, a folder, or an entire workspace folder.
- **Context Menu Integration:** Commands are available via right-click in the editor, explorer, and command palette.

## Usage

1. **Right-click** inside a JS/TS file or on a file/folder in the explorer and select one of:
   - `cleanshyt.aliasImports`
   - `cleanshyt.sortImports`
   - `cleanshyt.removeUnusedImports`
2. Or, open the **Command Palette** (`Ctrl+Shift+P` or `Cmd+Shift+P`) and run any of the above commands.

## Requirements

- Works with JavaScript and TypeScript files (`.js`, `.jsx`, `.ts`, `.tsx`).
- For aliasing, your project should have a `tsconfig.json` with `compilerOptions.paths` and `baseUrl` configured.

## Extension Settings

No settings are required. The extension automatically detects workspace configuration.

## Known Issues

- Aliasing only works if your workspace uses `tsconfig.json` path aliases.
- Sorting and unused import removal may not handle all edge cases for very complex import patterns.

## Release Notes

### 0.0.1

- Initial release: alias, sort, and remove unused imports for JS/TS files.

---

**Enjoy clean imports with cleanshyt!**
Fixed issue #.

### 1.1.0

Added features X, Y, and Z.

---

## Following extension guidelines

Ensure that you've read through the extensions guidelines and follow the best practices for creating your extension.

* [Extension Guidelines](https://code.visualstudio.com/api/references/extension-guidelines)

## Working with Markdown

You can author your README using Visual Studio Code. Here are some useful editor keyboard shortcuts:

* Split the editor (`Cmd+\` on macOS or `Ctrl+\` on Windows and Linux).
* Toggle preview (`Shift+Cmd+V` on macOS or `Shift+Ctrl+V` on Windows and Linux).
* Press `Ctrl+Space` (Windows, Linux, macOS) to see a list of Markdown snippets.

## For more information

* [Visual Studio Code's Markdown Support](http://code.visualstudio.com/docs/languages/markdown)
* [Markdown Syntax Reference](https://help.github.com/articles/markdown-basics/)

**Enjoy!**
