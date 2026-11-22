export interface FileNode {
  name: string;
  path: string;
  is_dir: boolean;
  size?: number;
}

export interface FilePayload {
  path: string;
  name: string;
  content: string;
  encoding: string;
  line_ending: string;
  size: number;
}

export interface TabItem {
  id: string;
  path: string;
  name: string;
  content: string;
  savedContent: string;
  isDirty: boolean;
  encoding: string;
  lineEnding: string;
  language: string;
  viewMode: 'edit' | 'preview' | 'split'; // for markdown / csv
}

export type PaneType = 'editor' | 'terminal' | 'markdown-preview' | 'csv-table' | 'html-preview';

export interface PaneItem {
  id: string;
  type: PaneType;
  tabId?: string; // which tab is displayed if type is 'editor'
  title: string;
}

export interface SearchMatch {
  file_path: string;
  file_name: string;
  line_number: number;
  line_content: string;
  match_start: number;
  match_end: number;
}

export interface AiUrls {
  gemini: string;
  chatgpt: string;
  claude: string;
  enterprise?: string;
}

export interface EditorSettings {
  fontFamily: string;
  fontSize: number;
  lineHeight: number;
  theme: 'vs-dark' | 'vs' | 'hc-black';
  tabSize: number;
  insertSpaces: boolean;
  wordWrap: 'on' | 'off';
  showLineNumbers: 'on' | 'off';
  showMinimap: boolean;
  cursorBlinking: 'smooth' | 'blink' | 'solid';
  cursorStyle: 'line' | 'block' | 'underline';
  autoSave: boolean;
  autoSaveDelaySec: number;
  defaultEncoding: 'UTF-8' | 'EUC-KR';
  defaultLineEnding: 'LF' | 'CRLF';
  blockedExtensions: string[];
  aiUrls?: AiUrls;
}

export const DEFAULT_BLOCKED_EXTENSIONS: string[] = [
  // 동영상 (Video)
  'mp4', 'mkv', 'avi', 'mov', 'wmv', 'flv', 'webm', 'm4v', '3gp', 'ts', 'mts',
  // 사진/이미지 (Images)
  'jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'ico', 'tiff', 'tif', 'psd', 'ai', 'raw', 'heic', 'cr2',
  // 음악/오디오 (Audio)
  'mp3', 'wav', 'flac', 'aac', 'ogg', 'm4a', 'wma', 'aiff', 'mid', 'midi',
  // 데이터베이스 및 대용량 (DB & Binary Data)
  'db', 'sqlite', 'sqlite3', 'dat', 'mdb', 'accdb', 'rdb',
  // 압축 파일 (Archives)
  'zip', 'rar', '7z', 'tar', 'gz', 'bz2', 'xz', 'tgz', 'iso', 'dmg',
  // 바이너리 / 실행 파일 (Binaries & Executables)
  'exe', 'dll', 'so', 'dylib', 'bin', 'o', 'obj', 'class', 'jar', 'pyc', 'pyo', 'wasm',
  // 바이너리 오피스/문서 (Binary Docs)
  'pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'hwp', 'hwpx',
  // 폰트 파일 (Fonts)
  'ttf', 'otf', 'woff', 'woff2', 'eot',
];

export const DEFAULT_AI_URLS: AiUrls = {
  gemini: 'https://gemini.google.com/app',
  chatgpt: 'https://chatgpt.com',
  claude: 'https://claude.ai/new',
  enterprise: '',
};

export const DEFAULT_SETTINGS: EditorSettings = {
  fontFamily: 'Menlo, Monaco, "Courier New", "D2Coding", monospace',
  fontSize: 14,
  lineHeight: 21,
  theme: 'vs-dark',
  tabSize: 4,
  insertSpaces: true,
  wordWrap: 'on',
  showLineNumbers: 'on',
  showMinimap: true,
  cursorBlinking: 'smooth',
  cursorStyle: 'line',
  autoSave: false,
  autoSaveDelaySec: 3,
  defaultEncoding: 'UTF-8',
  defaultLineEnding: 'LF',
  blockedExtensions: DEFAULT_BLOCKED_EXTENSIONS,
  aiUrls: DEFAULT_AI_URLS,
};
