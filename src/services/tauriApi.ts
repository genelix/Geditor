import { invoke } from '@tauri-apps/api/core';
import { listen, UnlistenFn } from '@tauri-apps/api/event';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { openUrl, openPath } from '@tauri-apps/plugin-opener';
import { FileNode, FilePayload, SearchMatch, DEFAULT_BLOCKED_EXTENSIONS } from '../types';

export interface PathInfo {
  exists: boolean;
  is_dir: boolean;
  is_file: boolean;
  canonical_path: string;
}

export const tauriApi = {
  // File operations
  readFile: async (path: string): Promise<FilePayload> => {
    return await invoke<FilePayload>('read_file_content', { path });
  },

  writeFile: async (path: string, content: string, encoding?: string): Promise<void> => {
    return await invoke('write_file_content', { path, content, encoding });
  },

  listDirectory: async (path: string): Promise<FileNode[]> => {
    return await invoke<FileNode[]>('list_directory', { path });
  },

  createFile: async (path: string): Promise<void> => {
    return await invoke('create_file_entry', { path });
  },

  createDir: async (path: string): Promise<void> => {
    return await invoke('create_dir_entry', { path });
  },

  deleteEntry: async (path: string): Promise<void> => {
    return await invoke('delete_entry', { path });
  },

  renameEntry: async (oldPath: string, newPath: string): Promise<void> => {
    return await invoke('rename_entry', { oldPath, newPath });
  },

  getDefaultWorkspace: async (): Promise<string> => {
    return await invoke<string>('get_default_workspace');
  },

  inspectPath: async (path: string, baseDir?: string): Promise<PathInfo> => {
    return await invoke<PathInfo>('inspect_path', { path, baseDir });
  },

  saveFileDialog: async (defaultName?: string, defaultDir?: string): Promise<string | null> => {
    return await invoke<string | null>('save_file_dialog', { defaultName, defaultDir });
  },

  openFileDialog: async (defaultDir?: string): Promise<string | null> => {
    return await invoke<string | null>('open_file_dialog', { defaultDir });
  },

  openFolderDialog: async (defaultDir?: string): Promise<string | null> => {
    return await invoke<string | null>('open_folder_dialog', { defaultDir });
  },

  // Search
  searchInFiles: async (
    rootPath: string,
    query: string,
    isRegex = false,
    matchCase = false,
    maxResults = 200
  ): Promise<SearchMatch[]> => {
    return await invoke<SearchMatch[]>('search_in_files', {
      rootPath,
      query,
      isRegex,
      matchCase,
      maxResults,
    });
  },

  // Terminal PTY
  spawnTerminal: async (
    id: string,
    cols: number,
    rows: number,
    cwd?: string
  ): Promise<void> => {
    return await invoke('terminal_spawn', { id, cols, rows, cwd });
  },

  writeTerminal: async (id: string, data: string): Promise<void> => {
    return await invoke('terminal_write', { id, data });
  },

  resizeTerminal: async (id: string, cols: number, rows: number): Promise<void> => {
    return await invoke('terminal_resize', { id, cols, rows });
  },

  closeTerminal: async (id: string): Promise<void> => {
    return await invoke('terminal_close', { id });
  },

  onTerminalOutput: async (
    id: string,
    callback: (data: string) => void
  ): Promise<UnlistenFn> => {
    return await listen<string>(`terminal-output-${id}`, (event) => {
      callback(event.payload);
    });
  },

  // AI Assistant Window
  openAiAssistant: async (service: 'gemini' | 'chatgpt' | 'claude' | string = 'gemini', snap = false): Promise<void> => {
    return await invoke('open_ai_assistant', { service, snap });
  },

  toggleAiAssistant: async (service?: string): Promise<boolean> => {
    return await invoke<boolean>('toggle_ai_assistant', { service });
  },

  snapAiAssistant: async (): Promise<void> => {
    return await invoke('snap_ai_assistant');
  },

  setAiAssistantAlwaysOnTop: async (alwaysOnTop: boolean): Promise<void> => {
    return await invoke('set_ai_assistant_always_on_top', { alwaysOnTop });
  },

  // Ask AI with pre-filled text inserted into the AI's input box
  askAiWithPrompt: async (prompt: string, service?: string): Promise<void> => {
    return await invoke('ask_ai_with_prompt', { prompt, service });
  },

  // Native Native Clipboard (bypasses browser permissions & WebKit Paste tooltip popups)
  readClipboard: async (): Promise<string> => {
    try {
      return await invoke<string>('read_clipboard_text');
    } catch {
      return await navigator.clipboard.readText().catch(() => '');
    }
  },

  writeClipboard: async (text: string): Promise<void> => {
    try {
      await invoke('write_clipboard_text', { text });
    } catch {
      await navigator.clipboard.writeText(text).catch(() => {});
    }
  },

  // Open URL or local HTML file in system default browser (Safari/Chrome/Edge)
  openInBrowser: async (pathOrUrl?: string, htmlContent?: string): Promise<void> => {
    return await invoke('open_in_browser', { pathOrUrl, htmlContent });
  },

  // Exit application cleanly
  exitApp: async (): Promise<void> => {
    try {
      await invoke('exit_app');
    } catch {
      await getCurrentWindow().destroy();
    }
  },
};

export function detectLanguage(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase() || '';
  switch (ext) {
    case 'py':
    case 'pyw':
      return 'python';
    case 'js':
    case 'jsx':
    case 'mjs':
    case 'cjs':
      return 'javascript';
    case 'ts':
    case 'tsx':
      return 'typescript';
    case 'html':
    case 'htm':
    case 'xhtml':
      return 'html';
    case 'css':
    case 'scss':
    case 'sass':
    case 'less':
      return 'css';
    case 'json':
    case 'jsonc':
    case 'json5':
      return 'json';
    case 'md':
    case 'markdown':
      return 'markdown';
    case 'csv':
    case 'tsv':
      return 'csv';
    case 'rs':
      return 'rust';
    case 'sh':
    case 'bash':
    case 'zsh':
    case 'fish':
    case 'command':
      return 'shell';
    case 'bat':
    case 'cmd':
      return 'bat';
    case 'yaml':
    case 'yml':
      return 'yaml';
    case 'toml':
    case 'ini':
    case 'conf':
    case 'cfg':
    case 'properties':
    case 'env':
      return 'ini';
    case 'sql':
      return 'sql';
    case 'xml':
    case 'svg':
      return 'xml';
    case 'c':
    case 'h':
      return 'c';
    case 'cpp':
    case 'hpp':
    case 'cc':
    case 'cxx':
      return 'cpp';
    case 'cs':
      return 'csharp';
    case 'go':
      return 'go';
    case 'java':
      return 'java';
    case 'kt':
    case 'kts':
      return 'kotlin';
    case 'swift':
      return 'swift';
    case 'smi':
    case 'srt':
    case 'vtt':
    case 'sub':
    case 'txt':
    case 'log':
      return 'plaintext';
    default:
      return 'plaintext';
  }
}

/**
 * Checks if a file is supported for text editing based on user preferences.
 * By default, media (video, audio, image) and DB/large binary files are blocked.
 * Any extension NOT in blockedExtensions (e.g. .command, .sh, .txt, .py) is allowed to open.
 */
export function isSupportedTextFile(
  filename: string,
  blockedExtensions?: string[]
): { ok: boolean; reason?: string } {
  const lower = filename.toLowerCase();

  // Always allow known extensionless or text files
  const exactTextNames = [
    'dockerfile', 'makefile', 'gemfile', 'rakefile', 'procfile', 'license', 'readme',
    '.gitignore', '.gitattributes', '.env', '.editorconfig', '.npmrc', '.prettierrc',
    '.eslintrc', '.babelrc', 'cargo.lock', 'package-lock.json'
  ];
  if (exactTextNames.includes(lower) || exactTextNames.some((name) => lower.endsWith(name))) {
    return { ok: true };
  }

  const parts = lower.split('.');
  if (parts.length > 1) {
    const ext = parts.pop()!;
    const blockedList = blockedExtensions && blockedExtensions.length > 0
      ? blockedExtensions
      : DEFAULT_BLOCKED_EXTENSIONS;

    if (blockedList.includes(ext)) {
      return {
        ok: false,
        reason: `바이너리 파일(.${ext})은 열기가 제한되어 있습니다.\n[환경설정 > 바이너리 파일 제한]에서 확장자 차단을 해제할 수 있습니다.`,
      };
    }
  }

  return { ok: true };
}

/**
 * Extracts a URL link (http://, https://) or local file/folder path at a given column in a line.
 */
export function extractLinkOrPathAt(line: string, column: number): string | null {
  if (!line) return null;

  const urlRegex = /(https?:\/\/[^\s"'`<>()[\]{}]+)/g;
  const pathRegex = /((?:~[\\\/]|\.{1,2}[\\\/]|\/|[a-zA-Z]:[\\\/])[^\s"'`<>()[\]{}]+)/g;

  let match: RegExpExecArray | null;

  // Check URL matches
  while ((match = urlRegex.exec(line)) !== null) {
    const start = match.index + 1; // 1-based column
    let text = match[0].replace(/[,;.:!?'")\]]+$/, '');
    const end = match.index + text.length;
    if (column >= start && column <= end + 1) {
      return text;
    }
  }

  // Check Path matches
  while ((match = pathRegex.exec(line)) !== null) {
    const start = match.index + 1; // 1-based column
    let text = match[0].replace(/[,;.:!?'")\]]+$/, '');
    const end = match.index + text.length;
    if (column >= start && column <= end + 1) {
      return text;
    }
  }

  return null;
}

/**
 * Opens a link or path:
 * - URLs: opens in default web browser
 * - Directories: reveals/opens folder in Finder / Explorer
 * - Text files: opens as an editor tab in Geditor (via onOpenFile)
 */
export async function openLinkOrPath(
  target: string,
  workspacePath?: string,
  onOpenFile?: (path: string) => void
): Promise<{ success: boolean; message?: string }> {
  const trimmed = target.trim();
  if (!trimmed) return { success: false, message: '경로 또는 URL이 비어 있습니다.' };

  // 1. Web URL (http:// or https:// or mailto:)
  if (/^(https?:\/\/|mailto:)/i.test(trimmed)) {
    try {
      await openUrl(trimmed);
      return { success: true };
    } catch (err) {
      return { success: false, message: `URL 열기 실패: ${err}` };
    }
  }

  // 2. Local File or Folder path
  try {
    const info = await tauriApi.inspectPath(trimmed, workspacePath);
    if (!info.exists) {
      return { success: false, message: `경로를 찾을 수 없습니다: ${trimmed}` };
    }

    if (info.is_dir) {
      await openPath(info.canonical_path);
      return { success: true };
    }

    if (info.is_file) {
      if (onOpenFile) {
        onOpenFile(info.canonical_path);
      } else {
        await openPath(info.canonical_path);
      }
      return { success: true };
    }

    await openPath(info.canonical_path);
    return { success: true };
  } catch (err) {
    return { success: false, message: `열기 오류: ${err}` };
  }
}
