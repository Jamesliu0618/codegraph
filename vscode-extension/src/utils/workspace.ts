import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

/**
 * Returns all workspace folders. Empty array when none are open.
 * Use this for code paths that need to operate on every folder
 * (e.g. status checks), not for code that needs a single "primary" root.
 */
export function getWorkspaceRoots(): string[] {
  const folders = vscode.workspace.workspaceFolders;
  if (!folders || folders.length === 0) {
    return [];
  }
  return folders.map(f => f.uri.fsPath);
}

/**
 * Backwards-compatible: returns the first workspace folder, or undefined.
 * Prefer {@link getWorkspaceRoots} for new code, or {@link pickWorkspaceRoot}
 * when the command needs to choose interactively.
 */
export function getWorkspaceRoot(): string | undefined {
  const roots = getWorkspaceRoots();
  return roots.length > 0 ? roots[0] : undefined;
}

/**
 * When the workspace has multiple folders, ask the user which one to operate
 * on. When there is exactly one, return it without prompting. When there are
 * none, return undefined.
 */
export async function pickWorkspaceRoot(
  prompt: string = 'Select a workspace folder to operate on:'
): Promise<string | undefined> {
  const folders = vscode.workspace.workspaceFolders;
  if (!folders || folders.length === 0) {
    return undefined;
  }
  if (folders.length === 1) {
    return folders[0].uri.fsPath;
  }

  const items: vscode.QuickPickItem[] = folders.map((f, i) => ({
    label: f.name,
    description: f.uri.fsPath,
    detail: i === 0 ? '(default)' : undefined,
  }));

  const picked = await vscode.window.showQuickPick(items, {
    placeHolder: prompt,
    canPickMany: false,
  });
  if (!picked) return undefined;

  const index = folders.findIndex(f => f.name === picked.label);
  return index >= 0 ? folders[index].uri.fsPath : undefined;
}

export function getCodegraphDirFor(root: string): string {
  return path.join(root, '.codegraph');
}

export function getCodegraphDir(): string | undefined {
  const root = getWorkspaceRoot();
  if (!root) return undefined;
  return getCodegraphDirFor(root);
}

export function isCodegraphInitializedFor(root: string): boolean {
  const dir = getCodegraphDirFor(root);
  return fs.existsSync(dir) && fs.existsSync(path.join(dir, 'codegraph.db'));
}

export function isCodegraphInitialized(): boolean {
  const root = getWorkspaceRoot();
  if (!root) return false;
  return isCodegraphInitializedFor(root);
}

export function getDatabasePathFor(root: string): string {
  return path.join(getCodegraphDirFor(root), 'codegraph.db');
}

export function getDatabasePath(): string | undefined {
  const dir = getCodegraphDir();
  if (!dir) return undefined;
  return path.join(dir, 'codegraph.db');
}

/**
 * Reports how many workspace folders have an initialized .codegraph.
 * Useful for the status bar to show "3 / 5 folders indexed" instead of
 * a single yes/no answer.
 */
export function getInitializationSummary(): { initialized: number; total: number } {
  const roots = getWorkspaceRoots();
  const initialized = roots.filter(isCodegraphInitializedFor).length;
  return { initialized, total: roots.length };
}

/**
 * Default set of directory names to skip when walking a workspace tree.
 * Centralized so the indexer, the WebView file browser, and any future
 * walk all agree on the same exclusions.
 */
export const DEFAULT_EXCLUDED_DIRS = [
  'node_modules', '.git', 'dist', 'build', '.codegraph',
  '.next', '.nuxt', 'out', 'target', '.cache', 'coverage',
];

/**
 * Default set of file extensions to surface as "code files" in the
 * workspace browser / indexer. Mirrors what the parent CodeGraph project
 * supports out of the box.
 */
export const DEFAULT_CODE_EXTENSIONS = [
  '.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs',
  '.py', '.go', '.rs', '.java', '.c', '.cpp', '.h', '.hpp',
  '.rb', '.php', '.cs', '.swift', '.kt', '.scala',
];

export interface FileNode {
  /** Absolute path on disk. */
  absPath: string;
  /** Path relative to the workspace root, using forward slashes. */
  relPath: string;
  /** Base name (last path segment). */
  name: string;
  /** File size in bytes (0 for directories). */
  size: number;
}

export interface DirectoryListing {
  /** Sorted directory entries (files and folders) at this level. */
  entries: FileNode[];
  /** Number of `readdir` failures encountered while building the tree. */
  errorCount: number;
}

/**
 * Walk a workspace root and return a flat list of code files (one level of
 * "files" — directories are not included, so callers can render a tree).
 *
 * Symlink cycles are guarded. Read errors (EACCES, EPERM, ENOENT) are
 * collected but do not abort the walk.
 */
export async function listWorkspaceFiles(
  root: string,
  options: {
    extensions?: string[];
    excludeDirs?: string[];
  } = {}
): Promise<{ files: FileNode[]; errorCount: number }> {
  const extensions = options.extensions ?? DEFAULT_CODE_EXTENSIONS;
  const excludeDirs = new Set(options.excludeDirs ?? DEFAULT_EXCLUDED_DIRS);
  const files: FileNode[] = [];
  let errorCount = 0;

  async function walk(dir: string): Promise<void> {
    let entries: fs.Dirent[];
    try {
      entries = await fs.promises.readdir(dir, { withFileTypes: true });
    } catch {
      errorCount++;
      return;
    }

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);

      if (entry.isSymbolicLink()) {
        try {
          const real = await fs.promises.realpath(fullPath);
          if (real.startsWith(root + path.sep) || real === root) {
            await walk(real);
          }
        } catch {
          // broken or unreadable symlink — skip
        }
        continue;
      }

      if (entry.isDirectory()) {
        if (!excludeDirs.has(entry.name)) {
          await walk(fullPath);
        }
        continue;
      }

      if (entry.isFile() && extensions.includes(path.extname(entry.name))) {
        let size = 0;
        try {
          size = (await fs.promises.stat(fullPath)).size;
        } catch {
          // file vanished or unreadable; size stays 0
        }
        files.push({
          absPath: fullPath,
          relPath: path.relative(root, fullPath).split(path.sep).join('/'),
          name: entry.name,
          size,
        });
      }
    }
  }

  await walk(root);
  // Sort by relative path for deterministic output (helps diffing tests).
  files.sort((a, b) => a.relPath.localeCompare(b.relPath));
  return { files, errorCount };
}

/**
 * Build a directory-grouped view of a workspace listing, suitable for
 * rendering as a tree in a WebView. Returns directories and files at each
 * level — does not recursively nest (the WebView can do that).
 */
export function groupByDirectory(files: FileNode[], root: string): DirectoryListing {
  const grouped = new Map<string, FileNode[]>();
  for (const f of files) {
    const dir = path.dirname(f.relPath).split('/').join('/');
    const list = grouped.get(dir) ?? [];
    list.push(f);
    grouped.set(dir, list);
  }

  const entries: FileNode[] = [];
  // Top-level files (no directory segment).
  for (const f of grouped.get('.') ?? []) {
    entries.push(f);
  }
  // Top-level directories — synthesize a FileNode per directory so the
  // WebView can render the same shape for files and folders.
  const topDirs = new Set<string>();
  for (const f of files) {
    const head = f.relPath.split('/')[0];
    if (head && head !== f.relPath) {
      topDirs.add(head);
    }
  }
  for (const d of [...topDirs].sort()) {
    entries.push({
      absPath: path.join(root, d),
      relPath: d,
      name: d,
      size: 0,
    });
  }

  entries.sort((a, b) => a.name.localeCompare(b.name));
  return { entries, errorCount: 0 };
}

/**
 * Aggregate stats for a workspace root — used by the WebView footer and
 * the status bar. Falls back to zeros when nothing is initialized yet.
 */
export async function getWorkspaceStats(root: string): Promise<{
  files: number;
  initialized: boolean;
  dbSizeBytes: number;
  totalSizeBytes: number;
}> {
  const { files } = await listWorkspaceFiles(root);
  const totalSizeBytes = files.reduce((sum, f) => sum + f.size, 0);
  const dbPath = getDatabasePathFor(root);
  let dbSizeBytes = 0;
  let initialized = false;
  try {
    const st = await fs.promises.stat(dbPath);
    dbSizeBytes = st.size;
    initialized = st.size > 0;
  } catch {
    initialized = false;
  }
  return { files: files.length, initialized, dbSizeBytes, totalSizeBytes };
}
