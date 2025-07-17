import * as path from 'path';
import * as ts from 'typescript';
// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';

// Utility: Get workspace folder for a file
function getWorkspaceFolderForFile(fileUri: vscode.Uri): vscode.WorkspaceFolder | undefined {
	return vscode.workspace.getWorkspaceFolder(fileUri);
}

// Utility: Get all JS/TS files in a folder (recursively)
async function getJsTsFilesInFolder(folderUri: vscode.Uri): Promise<vscode.Uri[]> {
	const files: vscode.Uri[] = [];
	const entries = await vscode.workspace.fs.readDirectory(folderUri);
	for (const [name, type] of entries) {
		const entryUri = vscode.Uri.joinPath(folderUri, name);
		if (type === vscode.FileType.File && /\.(jsx?|tsx?)$/.test(name)) {
			files.push(entryUri);
		} else if (type === vscode.FileType.Directory && name !== 'node_modules') {
			files.push(...await getJsTsFilesInFolder(entryUri));
		}
	}
	return files;
}

// Utility: Read tsconfig.json and get path aliases
async function getTsconfigAliases(workspaceFolder: vscode.WorkspaceFolder): Promise<Record<string, string>> {
	const tsconfigPath = path.join(workspaceFolder.uri.fsPath, 'tsconfig.json');
	try {
		const tsconfigContent = Buffer.from(await vscode.workspace.fs.readFile(vscode.Uri.file(tsconfigPath))).toString('utf8');
		const tsconfig = JSON.parse(tsconfigContent);
		const paths = tsconfig.compilerOptions?.paths || {};
		const baseUrl = tsconfig.compilerOptions?.baseUrl || '.';
		const aliases: Record<string, string> = {};
		for (const alias in paths) {
			const realPath = path.join(workspaceFolder.uri.fsPath, baseUrl, paths[alias][0].replace(/\*$/, ''));
			aliases[alias.replace(/\*$/, '')] = realPath;
		}
		return aliases;
	} catch {
		return {};
	}
}

// Utility: Find alias for a given file path
function findAliasForImport(importPath: string, filePath: string, workspaceFolder: vscode.WorkspaceFolder, aliases: Record<string, string>): string | null {
	const absImportPath = path.resolve(path.dirname(filePath), importPath);
	for (const alias in aliases) {
		if (absImportPath.startsWith(aliases[alias])) {
			const relPath = absImportPath.slice(aliases[alias].length).replace(/^\/+/, '');
			return `@/${relPath}`; // You can make this dynamic based on alias
		}
	}
	return null;
}

// Utility: Parse and rewrite import statements
function rewriteImports(text: string, filePath: string, workspaceFolder: vscode.WorkspaceFolder, aliases: Record<string, string>): string {
	const importRegex = /^import\s+.*?from\s+['"](.*?)['"];?/gm;
	return text.replace(importRegex, (match, importPath) => {
		if (importPath.startsWith('.') || importPath.startsWith('..')) {
			const aliasImport = findAliasForImport(importPath, filePath, workspaceFolder, aliases);
			if (aliasImport) {
				return match.replace(importPath, aliasImport);
			}
		}
		return match;
	});
}

// Command: Alias Imports
async function aliasImports(target: vscode.Uri) {
	const workspaceFolder = getWorkspaceFolderForFile(target);
	if (!workspaceFolder) {
		vscode.window.showErrorMessage('Workspace folder not found for target.');
		return;
	}
	const aliases = await getTsconfigAliases(workspaceFolder);
	let files: vscode.Uri[] = [];
	const stat = await vscode.workspace.fs.stat(target);
	if (stat.type === vscode.FileType.File) {
		files = [target];
	} else if (stat.type === vscode.FileType.Directory) {
		files = await getJsTsFilesInFolder(target);
	}
	for (const file of files) {
		const doc = await vscode.workspace.openTextDocument(file);
		let text = doc.getText();
		const newText = rewriteImports(text, file.fsPath, workspaceFolder, aliases);
		if (newText !== text) {
			const edit = new vscode.WorkspaceEdit();
			edit.replace(file, new vscode.Range(0, 0, doc.lineCount, 0), newText);
			await vscode.workspace.applyEdit(edit);
		}
	}
	vscode.window.showInformationMessage('Alias Imports completed.');
}

// Utility: Sort import statements by file path (robust, multiline-safe)
function sortImportStatements(text: string): string {
	const lines = text.split('\n');
	const importBlocks: string[] = [];
	const otherLines: string[] = [];
	let i = 0;
	while (i < lines.length) {
		// Detect start of import block
		if (/^\s*import\s/.test(lines[i])) {
			let importBlock = lines[i];
			// Continue until we reach a line ending with ';' or a line not part of the import
			while (
				!importBlock.trim().endsWith(';') &&
				i + 1 < lines.length &&
				(/^\s/.test(lines[i + 1]) || lines[i + 1].trim() === '')
			) {
				i++;
				importBlock += '\n' + lines[i];
			}
			importBlocks.push(importBlock);
		} else {
			otherLines.push(lines[i]);
		}
		i++;
	}
	// Sort import blocks by their source path (from '...')
	importBlocks.sort((a, b) => {
		const aMatch = a.match(/from\s+['"](.*?)['"]/);
		const bMatch = b.match(/from\s+['"](.*?)['"]/);
		return (aMatch?.[1] || '').localeCompare(bMatch?.[1] || '');
	});
	// Reconstruct file: sorted imports + other lines (preserve original spacing)
	const result = [
		...importBlocks,
		// Add a blank line between imports and rest if not already present
		otherLines.length && importBlocks.length ? '' : '',
		...otherLines
	].join('\n');
	return result;
}

// Command: Sort Imports
async function sortImports(target: vscode.Uri) {
	const stat = await vscode.workspace.fs.stat(target);
	let files: vscode.Uri[] = [];
	if (stat.type === vscode.FileType.File) {
		files = [target];
	} else if (stat.type === vscode.FileType.Directory) {
		files = await getJsTsFilesInFolder(target);
	}
	for (const file of files) {
		const doc = await vscode.workspace.openTextDocument(file);
		let text = doc.getText();
		const newText = sortImportStatements(text);
		if (newText !== text) {
			const edit = new vscode.WorkspaceEdit();
			edit.replace(file, new vscode.Range(0, 0, doc.lineCount, 0), newText);
			await vscode.workspace.applyEdit(edit);
		}
	}
	vscode.window.showInformationMessage('Sort Imports completed.');
}

// Utility: Remove unused imports using TypeScript API
function removeUnusedImportsFromText(text: string): string {
	const sourceFile = ts.createSourceFile('file.ts', text, ts.ScriptTarget.Latest, true);
	const usedIdentifiers = new Set<string>();
	ts.forEachChild(sourceFile, function visit(node) {
		if (ts.isIdentifier(node)) {
			usedIdentifiers.add(node.text);
		}
		ts.forEachChild(node, visit);
	});
	const importRegex = /^import\s+(.*)\s+from\s+['"](.*?)['"];?/gm;
	return text.replace(importRegex, (match, imports, fromPath) => {
		if (imports.includes('{')) {
			const namedImports = imports.match(/{([^}]*)}/)?.[1].split(',').map((i: string) => i.trim()).filter(Boolean) || [];
			const used = namedImports.filter((i: string) => usedIdentifiers.has(i));
			if (used.length === 0) return '';
			return match.replace(/{[^}]*}/, `{ ${used.join(', ')} }`);
		}
		if (imports && !usedIdentifiers.has(imports.replace(/['"]/g, ''))) {
			return '';
		}
		return match;
	});
}

// Command: Remove Unused Imports
async function removeUnusedImports(target: vscode.Uri) {
	const stat = await vscode.workspace.fs.stat(target);
	let files: vscode.Uri[] = [];
	if (stat.type === vscode.FileType.File) {
		files = [target];
	} else if (stat.type === vscode.FileType.Directory) {
		files = await getJsTsFilesInFolder(target);
	}
	for (const file of files) {
		const doc = await vscode.workspace.openTextDocument(file);
		let text = doc.getText();
		const newText = removeUnusedImportsFromText(text);
		if (newText !== text) {
			const edit = new vscode.WorkspaceEdit();
			edit.replace(file, new vscode.Range(0, 0, doc.lineCount, 0), newText);
			await vscode.workspace.applyEdit(edit);
		}
	}
	vscode.window.showInformationMessage('Remove Unused Imports completed.');
}

// Register commands for command palette, editor context menu, and explorer context menu
export function activate(context: vscode.ExtensionContext) {
	const aliasCmd = vscode.commands.registerCommand('cleanshyt.aliasImports', async (uri?: vscode.Uri) => {
		const target = uri || vscode.window.activeTextEditor?.document.uri;
		if (target) await aliasImports(target);
	});
	const sortCmd = vscode.commands.registerCommand('cleanshyt.sortImports', async (uri?: vscode.Uri) => {
		const target = uri || vscode.window.activeTextEditor?.document.uri;
		if (target) await sortImports(target);
	});
	const removeCmd = vscode.commands.registerCommand('cleanshyt.removeUnusedImports', async (uri?: vscode.Uri) => {
		const target = uri || vscode.window.activeTextEditor?.document.uri;
		if (target) await removeUnusedImports(target);
	});

	context.subscriptions.push(aliasCmd, sortCmd, removeCmd);

	// Editor context menu
	context.subscriptions.push(vscode.commands.registerCommand('cleanshyt.editor.aliasImports', async () => {
		const target = vscode.window.activeTextEditor?.document.uri;
		if (target) await aliasImports(target);
	}));
	context.subscriptions.push(vscode.commands.registerCommand('cleanshyt.editor.sortImports', async () => {
		const target = vscode.window.activeTextEditor?.document.uri;
		if (target) await sortImports(target);
	}));
	context.subscriptions.push(vscode.commands.registerCommand('cleanshyt.editor.removeUnusedImports', async () => {
		const target = vscode.window.activeTextEditor?.document.uri;
		if (target) await removeUnusedImports(target);
	}));

	// Explorer context menu
	context.subscriptions.push(vscode.commands.registerCommand('cleanshyt.explorer.aliasImports', async (uri: vscode.Uri) => {
		if (uri) await aliasImports(uri);
	}));
	context.subscriptions.push(vscode.commands.registerCommand('cleanshyt.explorer.sortImports', async (uri: vscode.Uri) => {
		if (uri) await sortImports(uri);
	}));
	context.subscriptions.push(vscode.commands.registerCommand('cleanshyt.explorer.removeUnusedImports', async (uri: vscode.Uri) => {
		if (uri) await removeUnusedImports(uri);
	}));
}

export function deactivate() {}
