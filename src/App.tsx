import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { listen } from '@tauri-apps/api/event';
import { TabItem, PaneItem, PaneType, FileNode, SearchMatch, EditorSettings, DEFAULT_SETTINGS } from './types';
import { tauriApi, detectLanguage, isSupportedTextFile } from './services/tauriApi';
import { TopMenuBar } from './components/TopMenuBar';
import { Sidebar } from './components/Sidebar';
import { TabBar } from './components/TabBar';
import { SplitContainer } from './components/SplitContainer';
import { StatusBar } from './components/StatusBar';
import { SettingsModal } from './components/SettingsModal';
import { UnsavedChangesModal } from './components/UnsavedChangesModal';
import { AiSidePanel } from './components/AiSidePanel';
import { AlertTriangle, X, Sparkles } from 'lucide-react';
import { extractAiCode } from './utils/aiCodeParser';

const SETTINGS_STORAGE_KEY = 'geditor_settings';
const SESSION_STORAGE_KEY = 'geditor_saved_session_v1';

interface SavedSession {
  tabs: TabItem[];
  activeTabId: string;
  panes: PaneItem[];
  activePaneId: string;
  workspacePath?: string;
}

const createDefaultBlankTab = (settings?: EditorSettings): TabItem => ({
  id: `tab-${Date.now()}`,
  path: '',
  name: '새문서.md',
  content: '',
  savedContent: '',
  isDirty: false,
  encoding: settings?.defaultEncoding || 'UTF-8',
  lineEnding: settings?.defaultLineEnding || 'LF',
  language: 'markdown',
  viewMode: 'edit',
});

const loadSavedSession = (settings?: EditorSettings): SavedSession => {
  try {
    const raw = localStorage.getItem(SESSION_STORAGE_KEY);
    if (raw) {
      const data = JSON.parse(raw) as SavedSession;
      if (Array.isArray(data.tabs) && data.tabs.length > 0) {
        // Filter out legacy Welcome.md tab
        const validTabs = data.tabs.filter(
          (t) => t.id !== 'tab-welcome' && t.name !== 'Welcome.md'
        );
        if (validTabs.length > 0) {
          const activeTabId = validTabs.some((t) => t.id === data.activeTabId)
            ? data.activeTabId
            : validTabs[0].id;
          const validPanes =
            Array.isArray(data.panes) && data.panes.length > 0
              ? data.panes.map((p) => ({
                  ...p,
                  tabId: validTabs.some((t) => t.id === p.tabId) ? p.tabId : activeTabId,
                }))
              : [
                  {
                    id: 'pane-1',
                    type: 'editor' as PaneType,
                    title: '편집기',
                    tabId: activeTabId,
                  },
                ];

          return {
            tabs: validTabs,
            activeTabId,
            panes: validPanes,
            activePaneId: data.activePaneId || validPanes[0].id,
            workspacePath: data.workspacePath,
          };
        }
      }
    }
  } catch (e) {
    console.error('Failed to load saved session:', e);
  }

  const defTab = createDefaultBlankTab(settings);
  return {
    tabs: [defTab],
    activeTabId: defTab.id,
    panes: [{ id: 'pane-1', type: 'editor', title: '편집기', tabId: defTab.id }],
    activePaneId: 'pane-1',
  };
};

export default function App() {
  const [settings, setSettings] = useState<EditorSettings>(() => {
    try {
      const saved = localStorage.getItem(SETTINGS_STORAGE_KEY);
      if (saved) {
        return { ...DEFAULT_SETTINGS, ...JSON.parse(saved) };
      }
    } catch (e) {
      console.error('Failed to load settings:', e);
    }
    return DEFAULT_SETTINGS;
  });

  const initialSession = useMemo(() => loadSavedSession(settings), []);

  const [workspacePath, setWorkspacePath] = useState<string>(() => initialSession.workspacePath || '');
  const [files, setFiles] = useState<FileNode[]>([]);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // AI Assistant Window & Clipboard state
  const [isAiAlwaysOnTop, setIsAiAlwaysOnTop] = useState(false);
  const [aiClipboardPill, setAiClipboardPill] = useState<{
    code: string;
    language?: string;
    lineCount: number;
  } | null>(null);
  const lastClipboardTextRef = useRef<string>('');

  // AI Side Panel state
  const [isAiPanelOpen, setIsAiPanelOpen] = useState(false);
  const [aiPanelWidth, setAiPanelWidth] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('geditor_ai_panel_width');
      if (saved) return Math.max(340, Math.min(950, Number(saved)));
    } catch (e) {}
    return 480;
  });
  const [activeAiService, setActiveAiService] = useState<'gemini' | 'chatgpt' | 'claude' | 'enterprise'>('gemini');
  const aiViewportRef = useRef<HTMLDivElement | null>(null);

  // Resizable Sidebar width state
  const [sidebarWidth, setSidebarWidth] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('geditor_sidebar_width');
      if (saved) return Math.max(160, Math.min(800, Number(saved)));
    } catch (e) {}
    return 260;
  });
  const [isResizingSidebar, setIsResizingSidebar] = useState(false);

  // Toast / notification banner for binary or error feedback
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const showToast = (msg: string) => {
    setToastMessage(msg);
  };

  useEffect(() => {
    if (!toastMessage) return;
    const timer = setTimeout(() => {
      setToastMessage(null);
    }, 4500);
    return () => clearTimeout(timer);
  }, [toastMessage]);

  // Detect AI Code from native clipboard when returning to Geditor window from other apps
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;

    const checkClipboardOnFocus = async () => {
      try {
        const text = await tauriApi.readClipboard();
        if (!text || !text.trim() || text === lastClipboardTextRef.current) {
          return;
        }
        lastClipboardTextRef.current = text;

        const parsed = extractAiCode(text);
        const hasCodeHints =
          parsed.isExtracted ||
          (parsed.lineCount >= 2 &&
            (/[;{}()<>=+\-*\/[\]]/.test(text) ||
              /^(const|let|var|function|def|import|export|class|public|private|fn|struct|impl|if|for|while|return)\b/m.test(text)));

        if (hasCodeHints && parsed.code.length > 5) {
          setAiClipboardPill({
            code: parsed.code,
            language: parsed.language,
            lineCount: parsed.lineCount,
          });

          if (timer) clearTimeout(timer);
          timer = setTimeout(() => {
            setAiClipboardPill(null);
          }, 8000);
        }
      } catch (e) {
        // Native clipboard read failure fallback
      }
    };

    // Use Tauri OS-level window focus event so that internal button clicks or iframe focus don't trigger it
    const unlistenPromise = getCurrentWindow().onFocusChanged(({ payload: focused }) => {
      if (focused) {
        checkClipboardOnFocus();
      }
    });

    return () => {
      unlistenPromise.then((unlisten) => unlisten());
      if (timer) clearTimeout(timer);
    };
  }, []);

  // Sidebar drag resize effect
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizingSidebar) return;
      const newWidth = Math.max(160, Math.min(800, e.clientX));
      setSidebarWidth(newWidth);
    };

    const handleMouseUp = () => {
      if (isResizingSidebar) {
        setIsResizingSidebar(false);
        try {
          localStorage.setItem('geditor_sidebar_width', sidebarWidth.toString());
        } catch (e) {}
      }
    };

    if (isResizingSidebar) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizingSidebar, sidebarWidth]);

  // Prevent browser default English context menu across the entire app
  useEffect(() => {
    const handleGlobalContextMenu = (e: MouseEvent) => {
      e.preventDefault();
    };
    window.addEventListener('contextmenu', handleGlobalContextMenu);
    return () => {
      window.removeEventListener('contextmenu', handleGlobalContextMenu);
    };
  }, []);

  const handleUpdateSettings = (newSettings: EditorSettings) => {
    setSettings(newSettings);
    try {
      localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(newSettings));
    } catch (e) {
      console.error('Failed to save settings:', e);
    }
  };

  const isLight = settings.theme === 'vs';

  // Tabs state initialized from saved session (No Welcome.md!)
  const [tabs, setTabs] = useState<TabItem[]>(initialSession.tabs);
  const [activeTabId, setActiveTabId] = useState<string>(initialSession.activeTabId);

  // Split Panes state initialized from saved session
  const [panes, setPanes] = useState<PaneItem[]>(initialSession.panes);
  const [activePaneId, setActivePaneId] = useState<string>(initialSession.activePaneId);
  const [splitDirection, setSplitDirection] = useState<'horizontal' | 'vertical'>('horizontal');

  // Restore workspace files if workspacePath was restored from session
  useEffect(() => {
    if (initialSession.workspacePath) {
      refreshWorkspace(initialSession.workspacePath);
    }
  }, []);

  // Save session state to localStorage on every change
  useEffect(() => {
    try {
      const sessionData: SavedSession = {
        tabs,
        activeTabId,
        panes,
        activePaneId,
        workspacePath,
      };
      localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(sessionData));
    } catch (e) {
      console.error('Failed to save session to localStorage:', e);
    }
  }, [tabs, activeTabId, panes, activePaneId, workspacePath]);

  // Save session state immediately on beforeunload
  useEffect(() => {
    const handleBeforeUnload = () => {
      try {
        const sessionData: SavedSession = {
          tabs: tabsRef.current,
          activeTabId,
          panes,
          activePaneId,
          workspacePath,
        };
        localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(sessionData));
      } catch (e) {}
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [activeTabId, panes, activePaneId, workspacePath]);

  // Unsaved close confirmation state & handlers
  const [isCloseModalOpen, setIsCloseModalOpen] = useState(false);
  const [isSavingAndQuitting, setIsSavingAndQuitting] = useState(false);
  const isForceClosingRef = useRef(false);
  const tabsRef = useRef(tabs);
  useEffect(() => {
    tabsRef.current = tabs;
  }, [tabs]);

  // Intercept window close request when files are unsaved
  useEffect(() => {
    let isMounted = true;
    let unlistenFn: (() => void) | null = null;

    const setupCloseListener = async () => {
      try {
        const unlisten = await getCurrentWindow().onCloseRequested(async (event) => {
          if (isForceClosingRef.current) {
            return;
          }
          const dirty = tabsRef.current.filter((t) => t.isDirty);
          if (dirty.length > 0) {
            event.preventDefault();
            setIsCloseModalOpen(true);
          }
        });
        if (isMounted) {
          unlistenFn = unlisten;
        } else {
          unlisten();
        }
      } catch (err) {
        console.error('Failed to register onCloseRequested listener:', err);
      }
    };

    setupCloseListener();

    return () => {
      isMounted = false;
      if (unlistenFn) unlistenFn();
    };
  }, []);

  const handleRequestQuit = useCallback(() => {
    const dirty = tabsRef.current.filter((t) => t.isDirty);
    if (dirty.length > 0) {
      setIsCloseModalOpen(true);
    } else {
      isForceClosingRef.current = true;
      tauriApi.exitApp().catch(() => getCurrentWindow().destroy());
    }
  }, []);

  const handleCancelClose = useCallback(() => {
    setIsCloseModalOpen(false);
  }, []);

  const handleDiscardAndQuit = useCallback(async () => {
    isForceClosingRef.current = true;
    setIsCloseModalOpen(false);
    try {
      await tauriApi.exitApp();
    } catch {
      await getCurrentWindow().destroy();
    }
  }, []);

  const handleSaveAndQuit = useCallback(async () => {
    setIsSavingAndQuitting(true);
    try {
      const dirty = tabsRef.current.filter((t) => t.isDirty);
      for (const tab of dirty) {
        let targetPath = tab.path;
        if (!targetPath) {
          const chosen = await tauriApi.saveFileDialog(tab.name, workspacePath);
          if (!chosen) {
            // Cancelled by user during save dialog; abort quitting
            setIsSavingAndQuitting(false);
            return;
          }
          targetPath = chosen;
        }
        await tauriApi.writeFile(targetPath, tab.content, tab.encoding);
      }
      isForceClosingRef.current = true;
      setIsCloseModalOpen(false);
      await tauriApi.exitApp();
    } catch (err) {
      console.error('Failed to save files on exit:', err);
      alert('파일 저장 중 오류가 발생했습니다: ' + String(err));
      setIsSavingAndQuitting(false);
    }
  }, [workspacePath]);

  // Load workspace files on start
  const refreshWorkspace = useCallback(async (path?: string) => {
    const target = path || workspacePath;
    if (!target) return;
    try {
      const items = await tauriApi.listDirectory(target);
      setFiles(items);
    } catch (e) {
      console.error('Failed to list workspace:', e);
    }
  }, [workspacePath]);

  useEffect(() => {
    const init = async () => {
      try {
        const defaultPath = await tauriApi.getDefaultWorkspace();
        setWorkspacePath(defaultPath);
        const items = await tauriApi.listDirectory(defaultPath);
        setFiles(items);
      } catch (e) {
        console.error('Failed to init workspace:', e);
      }
    };
    init();
  }, []);

  // Select active tab with auto-follow for preview panes
  const handleSelectTab = (id: string) => {
    setActiveTabId(id);
    setTabs((currentTabs) => {
      const selected = currentTabs.find((t) => t.id === id);
      if (selected) {
        const isMdOrHtml =
          selected.language === 'markdown' ||
          selected.language === 'html' ||
          selected.path.endsWith('.html') ||
          selected.path.endsWith('.htm');

        setPanes((prevPanes) =>
          prevPanes.map((p) => {
            if (p.id === activePaneId && p.type === 'editor') {
              return { ...p, tabId: id };
            }
            if ((p.type === 'markdown-preview' || p.type === 'html-preview') && isMdOrHtml) {
              const nextType: PaneType =
                selected.language === 'markdown' ? 'markdown-preview' : 'html-preview';
              return {
                ...p,
                type: nextType,
                tabId: id,
                title:
                  selected.language === 'markdown'
                    ? `[미리보기] ${selected.name}`
                    : `[웹 페이지] ${selected.name}`,
              };
            }
            return p;
          })
        );
      }
      return currentTabs;
    });
  };

  // Open file in editor
  const handleOpenFile = async (filePath: string) => {
    const fileName = filePath.split('/').pop() || filePath;
    const check = isSupportedTextFile(fileName, settings.blockedExtensions);
    if (!check.ok) {
      showToast(check.reason || '바이너리 파일은 열 수 없습니다.');
      return;
    }

    const existing = tabs.find((t) => t.path === filePath);
    if (existing) {
      handleSelectTab(existing.id);
      return;
    }

    try {
      const payload = await tauriApi.readFile(filePath);
      const language = detectLanguage(payload.name);
      const newTab: TabItem = {
        id: `tab-${Date.now()}`,
        path: payload.path,
        name: payload.name,
        content: payload.content,
        savedContent: payload.content,
        isDirty: false,
        encoding: payload.encoding,
        lineEnding: payload.line_ending,
        language,
        viewMode: 'edit',
      };

      setTabs((prev) => [...prev, newTab]);
      handleSelectTab(newTab.id);
    } catch (err) {
      showToast(`파일을 열 수 없습니다: ${err}`);
    }
  };

  // Open file prompt using native OS dialog
  const handleOpenFilePrompt = async () => {
    try {
      const chosen = await tauriApi.openFileDialog(workspacePath);
      if (chosen) {
        handleOpenFile(chosen);
      }
    } catch (err) {
      showToast(`파일 열기 실패: ${err}`);
    }
  };

  // Change workspace directory
  const handleChangeWorkspace = async (newPath: string) => {
    try {
      const items = await tauriApi.listDirectory(newPath);
      setWorkspacePath(newPath);
      setFiles(items);
      showToast(`워크스페이스를 변경했습니다: ${newPath}`);
    } catch (err) {
      showToast(`워크스페이스 열기 실패: ${err}`);
    }
  };

  // Open folder prompt using native OS dialog
  const handleOpenFolderPrompt = async () => {
    try {
      const chosen = await tauriApi.openFolderDialog(workspacePath);
      if (chosen) {
        handleChangeWorkspace(chosen);
      }
    } catch (err) {
      showToast(`폴더 열기 실패: ${err}`);
    }
  };

  // Save current active tab
  const handleSaveActiveTab = async () => {
    const current = tabs.find((t) => t.id === activeTabId);
    if (!current) return;

    let targetPath = current.path;
    if (!targetPath) {
      // Open native system save dialog so user chooses folder and filename
      const chosen = await tauriApi.saveFileDialog(current.name, workspacePath);
      if (!chosen) {
        showToast('저장이 취소되었습니다.');
        return;
      }
      targetPath = chosen;
    }

    try {
      await tauriApi.writeFile(targetPath, current.content, current.encoding);
      const fileName = targetPath.split('/').pop() || current.name;
      setTabs((prev) =>
        prev.map((t) =>
          t.id === current.id
            ? {
                ...t,
                path: targetPath,
                name: fileName,
                savedContent: t.content,
                isDirty: false,
                language: detectLanguage(targetPath),
              }
            : t
        )
      );
      refreshWorkspace();
      showToast(`💾 파일이 저장되었습니다: ${targetPath}`);
    } catch (err) {
      alert(`저장에 실패했습니다: ${err}`);
    }
  };

  // Save As (always prompts for location and filename)
  const handleSaveAsActiveTab = async () => {
    const current = tabs.find((t) => t.id === activeTabId);
    if (!current) return;

    const defaultDir = current.path
      ? current.path.substring(0, current.path.lastIndexOf('/'))
      : workspacePath;

    try {
      const chosen = await tauriApi.saveFileDialog(current.name, defaultDir);
      if (!chosen) {
        showToast('다른 이름으로 저장이 취소되었습니다.');
        return;
      }

      await tauriApi.writeFile(chosen, current.content, current.encoding);
      const fileName = chosen.split('/').pop() || current.name;
      setTabs((prev) =>
        prev.map((t) =>
          t.id === current.id
            ? {
                ...t,
                path: chosen,
                name: fileName,
                savedContent: t.content,
                isDirty: false,
                language: detectLanguage(chosen),
              }
            : t
        )
      );
      refreshWorkspace();
      showToast(`💾 다른 이름으로 저장되었습니다: ${chosen}`);
    } catch (err) {
      alert(`다른 이름으로 저장 실패: ${err}`);
    }
  };

  // Auto-save debounce effect
  const autoSaveTimerRef = useRef<number | null>(null);
  useEffect(() => {
    if (!settings.autoSave) return;
    const current = tabs.find((t) => t.id === activeTabId);
    if (!current || !current.isDirty || !current.path) return;

    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
    }

    autoSaveTimerRef.current = setTimeout(async () => {
      try {
        await tauriApi.writeFile(current.path, current.content, current.encoding);
        setTabs((prev) =>
          prev.map((t) =>
            t.id === current.id ? { ...t, savedContent: current.content, isDirty: false } : t
          )
        );
      } catch (err) {
        console.error('Auto-save error:', err);
      }
    }, Math.max(1, settings.autoSaveDelaySec) * 1000);

    return () => {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
      }
    };
  }, [tabs, activeTabId, settings.autoSave, settings.autoSaveDelaySec]);

  // New blank tab (default format: Markdown .md)
  const handleNewTab = () => {
    const newTab: TabItem = {
      id: `tab-${Date.now()}`,
      path: '',
      name: '새문서.md',
      content: '',
      savedContent: '',
      isDirty: false,
      encoding: settings.defaultEncoding,
      lineEnding: settings.defaultLineEnding,
      language: 'markdown',
      viewMode: 'edit',
    };
    setTabs((prev) => [...prev, newTab]);
    setActiveTabId(newTab.id);
  };

  // Close tab
  const handleCloseTab = (id: string) => {
    const tabToClose = tabs.find((t) => t.id === id);
    if (tabToClose?.isDirty) {
      if (!confirm(`'${tabToClose.name}'의 변경 내용을 저장하시겠습니까?`)) {
        // user chooses not to save
      } else {
        handleSaveActiveTab();
      }
    }

    const filtered = tabs.filter((t) => t.id !== id);
    setTabs(filtered);
    if (activeTabId === id && filtered.length > 0) {
      setActiveTabId(filtered[filtered.length - 1].id);
    }
  };

  // Close other tabs
  const handleCloseOtherTabs = (id: string) => {
    const dirtyTabs = tabs.filter((t) => t.id !== id && t.isDirty);
    if (dirtyTabs.length > 0) {
      if (!confirm(`저장되지 않은 파일이 ${dirtyTabs.length}개 있습니다. 저장하지 않고 모두 닫으시겠습니까?`)) {
        return;
      }
    }
    const remaining = tabs.filter((t) => t.id === id);
    setTabs(remaining);
    setActiveTabId(id);
    setPanes((prev) =>
      prev.map((p) => (p.type === 'editor' ? { ...p, tabId: id } : p))
    );
  };

  // Close tabs to right
  const handleCloseTabsToRight = (id: string) => {
    const idx = tabs.findIndex((t) => t.id === id);
    if (idx === -1) return;
    const rightTabs = tabs.slice(idx + 1);
    const dirtyTabs = rightTabs.filter((t) => t.isDirty);
    if (dirtyTabs.length > 0) {
      if (!confirm(`오른쪽에 저장되지 않은 파일이 ${dirtyTabs.length}개 있습니다. 모두 닫으시겠습니까?`)) {
        return;
      }
    }
    const remaining = tabs.slice(0, idx + 1);
    setTabs(remaining);
    if (!remaining.some((t) => t.id === activeTabId)) {
      setActiveTabId(id);
      setPanes((prev) =>
        prev.map((p) => (p.type === 'editor' ? { ...p, tabId: id } : p))
      );
    }
  };

  // Save specific tab
  const handleSaveTab = async (id: string) => {
    const current = tabs.find((t) => t.id === id);
    if (!current) return;

    let targetPath = current.path;
    if (!targetPath) {
      const chosen = await tauriApi.saveFileDialog(current.name, workspacePath);
      if (!chosen) {
        showToast('저장이 취소되었습니다.');
        return;
      }
      targetPath = chosen;
    }

    try {
      await tauriApi.writeFile(targetPath, current.content, current.encoding);
      const fileName = targetPath.split('/').pop() || current.name;
      setTabs((prev) =>
        prev.map((t) =>
          t.id === current.id
            ? {
                ...t,
                path: targetPath,
                name: fileName,
                savedContent: t.content,
                isDirty: false,
                language: detectLanguage(targetPath),
              }
            : t
        )
      );
      refreshWorkspace();
      showToast(`💾 파일이 저장되었습니다: ${targetPath}`);
    } catch (err) {
      alert(`저장에 실패했습니다: ${err}`);
    }
  };

  // Content change in editor
  const handleChangeContent = (tabId: string, newContent: string) => {
    setTabs((prev) =>
      prev.map((t) =>
        t.id === tabId
          ? {
              ...t,
              content: newContent,
              isDirty: newContent !== t.savedContent,
            }
          : t
      )
    );
  };

  // View mode update for Markdown / CSV
  const handleUpdateViewMode = (tabId: string, mode: 'edit' | 'preview' | 'split') => {
    setTabs((prev) => prev.map((t) => (t.id === tabId ? { ...t, viewMode: mode } : t)));
  };

  // Pane operations
  const handleSplitPane = (_sourcePaneId: string, direction: 'horizontal' | 'vertical') => {
    setSplitDirection(direction);
    const newPaneId = `pane-${Date.now()}`;
    const newPane: PaneItem = {
      id: newPaneId,
      type: 'editor',
      title: '편집기',
      tabId: activeTabId,
    };
    setPanes((prev) => [...prev, newPane]);
    setActivePaneId(newPaneId);
  };

  // Open live preview split (Dual-panel: Left code editor | Right live renderer)
  const handleOpenPreviewSplit = (targetTabId?: string) => {
    const targetId = targetTabId || activeTabId;
    const target = tabs.find((t) => t.id === targetId);
    if (!target) return;

    const isMd = target.language === 'markdown';
    const isHtml =
      target.language === 'html' ||
      target.path.endsWith('.html') ||
      target.path.endsWith('.htm');

    if (!isMd && !isHtml) {
      showToast('마크다운(.md) 또는 HTML(.html) 파일만 실시간 미리보기 분할을 지원합니다.');
      return;
    }

    const previewType: PaneType = isMd ? 'markdown-preview' : 'html-preview';
    const previewTitle = isMd ? `[미리보기] ${target.name}` : `[웹 페이지] ${target.name}`;

    setSplitDirection('horizontal');

    // Check if a preview pane is already open
    const previewPaneIndex = panes.findIndex(
      (p) => p.type === 'markdown-preview' || p.type === 'html-preview'
    );

    if (previewPaneIndex !== -1) {
      // Point existing preview pane to target
      setPanes((prev) =>
        prev.map((p, idx) =>
          idx === previewPaneIndex
            ? { ...p, type: previewType, tabId: target.id, title: previewTitle }
            : p
        )
      );
      showToast(`우측 패널에 '${target.name}' 실시간 렌더링이 연동되었습니다.`);
    } else {
      // Create preview pane on the right
      const previewPaneId = `pane-preview-${Date.now()}`;
      const newPreviewPane: PaneItem = {
        id: previewPaneId,
        type: previewType,
        title: previewTitle,
        tabId: target.id,
      };

      setPanes((prev) => {
        const firstPane: PaneItem =
          prev.length > 0
            ? { ...prev[0], type: 'editor', tabId: target.id, title: target.name }
            : { id: 'pane-1', type: 'editor', tabId: target.id, title: target.name };
        return [firstPane, newPreviewPane];
      });
      showToast(`'${target.name}' 실시간 렌더링 분할 패널을 열었습니다.`);
    }
  };

  const handleClosePane = (paneId: string) => {
    if (panes.length <= 1) return;
    const next = panes.filter((p) => p.id !== paneId);
    setPanes(next);
    if (activePaneId === paneId) {
      setActivePaneId(next[0].id);
    }
  };

  const handleChangePaneType = (
    paneId: string,
    newType: PaneType
  ) => {
    setPanes((prev) =>
      prev.map((p) =>
        p.id === paneId
          ? {
              ...p,
              type: newType,
              title:
                newType === 'terminal'
                  ? '터미널 (zsh)'
                  : newType === 'markdown-preview'
                  ? '마크다운 미리보기'
                  : newType === 'csv-table'
                  ? 'CSV 테이블'
                  : newType === 'html-preview'
                  ? 'HTML 웹 페이지'
                  : '편집기',
            }
          : p
      )
    );
  };

  const handleAddTerminalPane = () => {
    const termPaneId = `term-${Date.now()}`;
    const newPane: PaneItem = {
      id: termPaneId,
      type: 'terminal',
      title: '터미널 (zsh)',
    };
    setPanes((prev) => [...prev, newPane]);
    setActivePaneId(termPaneId);
  };

  // Toggle encoding between UTF-8 and EUC-KR
  const handleToggleEncoding = () => {
    const current = tabs.find((t) => t.id === activeTabId);
    if (!current) return;
    const next = current.encoding === 'UTF-8' ? 'EUC-KR' : 'UTF-8';
    setTabs((prev) =>
      prev.map((t) => (t.id === current.id ? { ...t, encoding: next, isDirty: true } : t))
    );
  };

  // Toggle line ending between LF and CRLF
  const handleToggleLineEnding = () => {
    const current = tabs.find((t) => t.id === activeTabId);
    if (!current) return;
    const next = current.lineEnding === 'LF' ? 'CRLF' : 'LF';
    setTabs((prev) =>
      prev.map((t) => (t.id === current.id ? { ...t, lineEnding: next, isDirty: true } : t))
    );
  };

  // AI Side Panel bounds synchronizer
  const syncAiPanelBounds = useCallback(async () => {
    if (!isAiPanelOpen || !aiViewportRef.current) return;
    const rect = aiViewportRef.current.getBoundingClientRect();
    if (rect.width > 20 && rect.height > 20) {
      await tauriApi.updateAiPanelBounds({
        x: Math.round(rect.left),
        y: Math.round(rect.top),
        width: Math.round(rect.width),
        height: Math.round(rect.height),
      }).catch(console.error);
    }
  }, [isAiPanelOpen]);

  // Manage AI Side Panel visibility and URL
  useEffect(() => {
    if (!isAiPanelOpen) {
      tauriApi.hideAiPanel().catch(console.error);
      return;
    }

    const timer = setTimeout(async () => {
      if (!aiViewportRef.current) return;
      const rect = aiViewportRef.current.getBoundingClientRect();
      const customUrl = activeAiService === 'enterprise'
        ? settings.aiUrls?.enterprise
        : settings.aiUrls?.[activeAiService];

      await tauriApi.showAiPanel({
        service: activeAiService,
        customUrl,
        x: Math.round(rect.left),
        y: Math.round(rect.top),
        width: Math.round(rect.width),
        height: Math.round(rect.height),
      }).catch(console.error);
    }, 40);

    return () => clearTimeout(timer);
  }, [isAiPanelOpen, activeAiService, settings.aiUrls]);

  // Keep AI Side Panel bounds in sync on window resize & viewport resize
  useEffect(() => {
    if (!isAiPanelOpen || !aiViewportRef.current) return;
    const observer = new ResizeObserver(() => {
      syncAiPanelBounds();
    });
    observer.observe(aiViewportRef.current);
    window.addEventListener('resize', syncAiPanelBounds);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', syncAiPanelBounds);
    };
  }, [isAiPanelOpen, syncAiPanelBounds]);

  useEffect(() => {
    syncAiPanelBounds();
  }, [isSidebarOpen, sidebarWidth, syncAiPanelBounds]);

  const handleAiPanelWidthChange = (newWidth: number) => {
    setAiPanelWidth(newWidth);
    try {
      localStorage.setItem('geditor_ai_panel_width', String(newWidth));
    } catch (e) {}
    syncAiPanelBounds();
  };

  const handleOpenAiAssistant = useCallback((service: 'gemini' | 'chatgpt' | 'claude' | 'enterprise' = 'gemini') => {
    setActiveAiService(service);
    setIsAiPanelOpen(true);
  }, []);

  const handleToggleAiAssistant = useCallback((service?: string) => {
    if (service && (service === 'gemini' || service === 'chatgpt' || service === 'claude' || service === 'enterprise')) {
      setActiveAiService(service);
      setIsAiPanelOpen(true);
      return;
    }
    setIsAiPanelOpen((prev) => !prev);
  }, []);

  const handleSnapAiAssistant = useCallback(async () => {
    try {
      await tauriApi.snapAiAssistant();
      showToast('📌 AI 도우미 창을 에디터 우측에 나란히 배치했습니다.');
    } catch (e) {
      console.error('Failed to snap AI assistant:', e);
      showToast('AI 도우미 창을 먼저 열어주세요.');
    }
  }, []);

  const handleToggleAiAlwaysOnTop = useCallback(async () => {
    try {
      const next = !isAiAlwaysOnTop;
      await tauriApi.setAiAssistantAlwaysOnTop(next);
      setIsAiAlwaysOnTop(next);
      showToast(next ? '📌 AI 도우미 창이 항상 위에 고정되었습니다.' : '📌 AI 도우미 창 고정이 해제되었습니다.');
    } catch (e) {
      console.error('Failed to toggle always on top:', e);
    }
  }, [isAiAlwaysOnTop]);

  const handlePopOutAiWindow = useCallback(async () => {
    setIsAiPanelOpen(false);
    await tauriApi.hideAiPanel().catch(console.error);
    const customUrl = activeAiService === 'enterprise'
      ? settings.aiUrls?.enterprise
      : settings.aiUrls?.[activeAiService];
    await tauriApi.openAiAssistant(activeAiService, customUrl, false).catch(console.error);
    showToast('↗ AI 도우미가 독립 창으로 분리되었습니다.');
  }, [activeAiService, settings.aiUrls]);

  // Paste selected AI text into active document ("선택영역 본문붙혀넣기")
  const handlePasteAiSelectionToEditor = useCallback(async () => {
    try {
      let text = await tauriApi.getAiSelectedText().catch(() => '');
      if (!text || !text.trim()) {
        text = await tauriApi.readClipboard().catch(() => '');
      }

      if (!text || !text.trim()) {
        showToast('💡 AI 화면에서 본문에 넣을 텍스트나 코드를 마우스로 드래그하여 선택한 후 버튼을 눌러주세요.');
        return;
      }

      window.dispatchEvent(new CustomEvent('geditor-insert-text', { detail: { text } }));
      showToast('📋 AI 선택 내용을 본문에 붙여넣었습니다.');
    } catch (err) {
      console.error('Failed to paste AI selection:', err);
      showToast(`본문 붙여넣기 실패: ${err}`);
    }
  }, []);

  const handleSmartInsertAiCode = useCallback(() => {
    window.dispatchEvent(new CustomEvent('geditor-smart-insert-ai'));
  }, []);

  const handleAskAiWithSelection = useCallback(() => {
    setIsAiPanelOpen(true);
    window.dispatchEvent(new CustomEvent('geditor-ask-ai'));
  }, []);

  const handleNewTabWithContent = useCallback((content: string, language?: string) => {
    const ext = language === 'python' ? 'py' : language === 'javascript' ? 'js' : language === 'typescript' ? 'ts' : language === 'html' ? 'html' : language === 'rust' ? 'rs' : language === 'markdown' ? 'md' : 'txt';
    const newTabId = `tab-${Date.now()}`;
    const newTab: TabItem = {
      id: newTabId,
      path: '',
      name: `AI_Snippet.${ext}`,
      content,
      savedContent: '',
      isDirty: true,
      encoding: 'UTF-8',
      lineEnding: 'LF',
      language: language || 'plaintext',
      viewMode: 'edit',
    };
    setTabs((prev) => [...prev, newTab]);
    setActiveTabId(newTabId);
    setPanes((prev) =>
      prev.map((p) => (p.id === activePaneId ? { ...p, tabId: newTabId } : p))
    );
    showToast(`🤖 새 문서(AI_Snippet.${ext})가 생성되었습니다.`);
  }, [activePaneId]);

  // Keyboard Shortcuts
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const isMeta = e.metaKey || e.ctrlKey;
      if (isMeta && e.shiftKey && (e.key === 's' || e.key === 'S')) {
        e.preventDefault();
        handleSaveAsActiveTab();
      } else if (isMeta && (e.key === 's' || e.key === 'S')) {
        e.preventDefault();
        handleSaveActiveTab();
      } else if (isMeta && e.shiftKey && (e.key === 'o' || e.key === 'O')) {
        e.preventDefault();
        handleOpenFolderPrompt();
      } else if (isMeta && !e.shiftKey && (e.key === 'o' || e.key === 'O')) {
        e.preventDefault();
        handleOpenFilePrompt();
      } else if (isMeta && e.key === 'n') {
        e.preventDefault();
        handleNewTab();
      } else if (isMeta && e.key === 'w') {
        e.preventDefault();
        if (panes.length > 1) {
          handleClosePane(activePaneId);
        } else if (tabs.length > 0) {
          handleCloseTab(activeTabId);
        }
      } else if (isMeta && e.shiftKey && (e.key === 'b' || e.key === 'B')) {
        e.preventDefault();
        setIsSidebarOpen((v) => !v);
      } else if (isMeta && e.key === '\\') {
        e.preventDefault();
        handleSplitPane(activePaneId, 'horizontal');
      } else if (isMeta && e.shiftKey && (e.key === 'v' || e.key === 'V')) {
        e.preventDefault();
        handleOpenPreviewSplit();
      } else if (isMeta && e.shiftKey && (e.key === 'a' || e.key === 'A')) {
        e.preventDefault();
        handleToggleAiAssistant();
      } else if (e.altKey && (e.key === 'a' || e.key === 'A')) {
        e.preventDefault();
        handleAskAiWithSelection();
      } else if (e.altKey && (e.key === 'v' || e.key === 'V' || e.code === 'KeyV')) {
        e.preventDefault();
        handleSmartInsertAiCode();
      } else if (isMeta && e.key === 't') {
        e.preventDefault();
        handleAddTerminalPane();
      } else if (isMeta && e.key === ',') {
        e.preventDefault();
        setIsSettingsOpen((v) => !v);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [activeTabId, activePaneId, tabs, panes, workspacePath, handleOpenPreviewSplit, handleSaveActiveTab, handleSaveAsActiveTab, handleOpenFilePrompt, handleOpenFolderPrompt, handleToggleAiAssistant, handleSmartInsertAiCode, handleAskAiWithSelection]);

  // Listen to native menu events
  useEffect(() => {
    const unlistenPromise = listen<string>('menu_event', (event) => {
      const id = event.payload;
      if (id === 'open_settings') {
        setIsSettingsOpen(true);
      } else if (id === 'new_file') {
        handleNewTab();
      } else if (id === 'open_file') {
        handleOpenFilePrompt();
      } else if (id === 'save_file') {
        handleSaveActiveTab();
      } else if (id === 'save_as_file') {
        handleSaveAsActiveTab();
      } else if (id === 'close_tab') {
        if (panes.length > 1) {
          handleClosePane(activePaneId);
        } else if (tabs.length > 0) {
          handleCloseTab(activeTabId);
        }
      } else if (id === 'toggle_sidebar') {
        setIsSidebarOpen((v) => !v);
      } else if (id === 'split_right') {
        handleSplitPane(activePaneId, 'horizontal');
      } else if (id === 'open_terminal') {
        handleAddTerminalPane();
      } else if (id === 'ai_toggle') {
        handleToggleAiAssistant();
      } else if (id === 'ai_gemini') {
        handleOpenAiAssistant('gemini');
      } else if (id === 'ai_chatgpt') {
        handleOpenAiAssistant('chatgpt');
      } else if (id === 'ai_claude') {
        handleOpenAiAssistant('claude');
      } else if (id === 'ai_snap') {
        handleSnapAiAssistant();
      } else if (id === 'ai_always_on_top') {
        handleToggleAiAlwaysOnTop();
      } else if (id === 'ai_ask') {
        handleAskAiWithSelection();
      } else if (id === 'ai_smart_insert') {
        handleSmartInsertAiCode();
      } else if (id === 'theme_dark') {
        handleUpdateSettings({ ...settings, theme: 'vs-dark' });
      } else if (id === 'theme_light') {
        handleUpdateSettings({ ...settings, theme: 'vs' });
      } else if (id === 'theme_hc') {
        handleUpdateSettings({ ...settings, theme: 'hc-black' });
      } else if (id === 'toggle_maximize') {
        getCurrentWindow().toggleMaximize().catch(console.error);
      } else if (id === 'help_shortcuts') {
        alert(
          'Geditor v0.1.0\n\n' +
            '고성능 Rust 코어 기반 경량 텍스트 에디터\n\n' +
            '단축키 안내:\n' +
            '• Cmd+S: 파일 저장\n' +
            '• Cmd+N: 새 파일 생성\n' +
            '• Cmd+W: 탭 / 패널 닫기\n' +
            '• Cmd+B: 탐색기 토글\n' +
            '• Cmd+\\: 우측 화면 분할\n' +
            '• Cmd+Shift+V: 실시간 나란히 보기\n' +
            '• Cmd+Shift+A: AI 도우미 창 열기/닫기\n' +
            '• Alt+A: 선택 영역으로 AI에 질문하기\n' +
            '• Alt+V: AI 코드 스마트 삽입\n' +
            '• Cmd+T: 내장 터미널 열기\n' +
            '• Cmd+,: 환경설정 열기'
        );
      } else if (id === 'quit_app') {
        handleRequestQuit();
      }
    });

    return () => {
      unlistenPromise.then((f) => f());
    };
  }, [activeTabId, activePaneId, tabs, panes, settings, handleToggleAiAssistant, handleOpenAiAssistant, handleSnapAiAssistant, handleToggleAiAlwaysOnTop, handleSmartInsertAiCode, handleAskAiWithSelection, handleRequestQuit]);

  // Handle window dragging & double-click maximize
  const handleTitleBarMouseDown = async (e: React.MouseEvent) => {
    if (e.button !== 0) return;

    if (e.detail === 2) {
      try {
        await getCurrentWindow().toggleMaximize();
      } catch (err) {
        console.error('Failed to toggle maximize:', err);
      }
      return;
    }

    try {
      await getCurrentWindow().startDragging();
    } catch (err) {
      console.error('Failed to start dragging:', err);
    }
  };

  const activeTab = tabs.find((t) => t.id === activeTabId);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        width: '100vw',
        height: '100vh',
        backgroundColor: isLight ? '#ffffff' : '#18181b',
        color: isLight ? '#18181b' : '#f4f4f5',
        overflow: 'hidden',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      }}
    >
      {/* Native-style drag header bar for macOS */}
      <div
        data-tauri-drag-region
        onMouseDown={handleTitleBarMouseDown}
        style={{
          display: 'flex',
          alignItems: 'center',
          height: '28px',
          backgroundColor: isLight ? '#f4f4f5' : '#141416',
          borderBottom: isLight ? '1px solid #e4e4e7' : '1px solid #27272a',
          paddingLeft: '78px', // Space for macOS window traffic lights
          paddingRight: '12px',
          fontSize: '11px',
          color: isLight ? '#71717a' : '#a1a1aa',
          userSelect: 'none',
          cursor: 'default',
        }}
      >
        <span style={{ fontWeight: 600, color: isLight ? '#0284c7' : '#38bdf8', pointerEvents: 'none' }}>Geditor</span>
        <span style={{ margin: '0 8px', pointerEvents: 'none' }}>—</span>
        <span style={{ pointerEvents: 'none' }}>{activeTab ? activeTab.name : '열린 파일 없음'}</span>
        {activeTab?.isDirty && <span style={{ color: '#38bdf8', marginLeft: '6px', pointerEvents: 'none' }}>●</span>}

        <div style={{ flex: 1, height: '100%', pointerEvents: 'none' }} />
        <span style={{ fontSize: '10px', color: isLight ? '#a1a1aa' : '#52525b', pointerEvents: 'none' }}>
          Cmd+S 저장 | Cmd+N 새 파일 | Cmd+B 탐색기 | Cmd+\ 우측 분할 | Cmd+Shift+V 실시간 미리보기 | Cmd+T 터미널 | Cmd+, 환경설정
        </span>
      </div>

      {/* In-Window Top Menu Bar */}
      <TopMenuBar
        isLight={isLight}
        settings={settings}
        onNewFile={handleNewTab}
        onOpenFilePrompt={handleOpenFilePrompt}
        onOpenFolderPrompt={handleOpenFolderPrompt}
        onSaveFile={handleSaveActiveTab}
        onSaveAsFile={handleSaveAsActiveTab}
        onCloseTab={() => {
          if (panes.length > 1) {
            handleClosePane(activePaneId);
          } else if (tabs.length > 0) {
            handleCloseTab(activeTabId);
          }
        }}
        onQuitApp={handleRequestQuit}
        onToggleSidebar={() => setIsSidebarOpen((v) => !v)}
        onSplitRight={() => handleSplitPane(activePaneId, 'horizontal')}
        onSplitDown={() => handleSplitPane(activePaneId, 'vertical')}
        onOpenTerminal={handleAddTerminalPane}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onUpdateSettings={handleUpdateSettings}
        onOpenPreviewSplit={handleOpenPreviewSplit}
        onOpenAiAssistant={handleOpenAiAssistant}
        onToggleAiAssistant={handleToggleAiAssistant}
        onSnapAiAssistant={handleSnapAiAssistant}
        onToggleAiAlwaysOnTop={handleToggleAiAlwaysOnTop}
        isAiAlwaysOnTop={isAiAlwaysOnTop}
        onSmartInsertAiCode={handleSmartInsertAiCode}
        onAskAiWithSelection={handleAskAiWithSelection}
      />

      {/* Main Workspace Body */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* Sidebar */}
        {isSidebarOpen && (
          <Sidebar
            workspacePath={workspacePath}
            files={files}
            isLight={isLight}
            width={sidebarWidth}
            blockedExtensions={settings.blockedExtensions}
            onOpenFile={handleOpenFile}
            onRefreshWorkspace={refreshWorkspace}
            onSelectSearchResult={(match: SearchMatch) => handleOpenFile(match.file_path)}
            onChangeWorkspace={handleChangeWorkspace}
          />
        )}

        {/* Draggable Divider for resizing Sidebar */}
        {isSidebarOpen && (
          <div
            onMouseDown={(e) => {
              e.preventDefault();
              setIsResizingSidebar(true);
            }}
            style={{
              width: '4px',
              cursor: 'col-resize',
              backgroundColor: isResizingSidebar
                ? '#38bdf8'
                : isLight
                ? '#e4e4e7'
                : '#27272a',
              transition: isResizingSidebar ? 'none' : 'background-color 0.15s',
              zIndex: 30,
              flexShrink: 0,
            }}
            onMouseEnter={(e) => {
              if (!isResizingSidebar) e.currentTarget.style.backgroundColor = '#38bdf8';
            }}
            onMouseLeave={(e) => {
              if (!isResizingSidebar)
                e.currentTarget.style.backgroundColor = isLight ? '#e4e4e7' : '#27272a';
            }}
            title="드래그하여 탐색기 너비 조절"
          />
        )}

        {/* Center Area (Tab bar + Split Panes) */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <TabBar
            tabs={tabs}
            activeTabId={activeTabId}
            isLight={isLight}
            onSelectTab={handleSelectTab}
            onCloseTab={handleCloseTab}
            onCloseOtherTabs={handleCloseOtherTabs}
            onCloseTabsToRight={handleCloseTabsToRight}
            onSaveTab={handleSaveTab}
            onNewTab={handleNewTab}
            onSplitRight={() => handleSplitPane(activePaneId, 'horizontal')}
            onSplitDown={() => handleSplitPane(activePaneId, 'vertical')}
            onAddTerminalPane={handleAddTerminalPane}
            onOpenPreviewSplit={handleOpenPreviewSplit}
          />

          <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
            <SplitContainer
              panes={panes}
              activePaneId={activePaneId}
              tabs={tabs}
              activeTab={activeTab}
              splitDirection={splitDirection}
              workspacePath={workspacePath}
              settings={settings}
              onSelectPane={(id) => setActivePaneId(id)}
              onClosePane={handleClosePane}
              onSplitPane={handleSplitPane}
              onChangePaneType={handleChangePaneType}
              onChangeContent={handleChangeContent}
              onUpdateViewMode={handleUpdateViewMode}
              onOpenFile={handleOpenFile}
              showToast={showToast}
              onOpenPreviewSplit={handleOpenPreviewSplit}
            />
          </div>
        </div>

        {/* AI Side Panel */}
        <AiSidePanel
          isOpen={isAiPanelOpen}
          isLight={isLight}
          width={aiPanelWidth}
          settings={settings}
          activeService={activeAiService}
          onChangeService={(svc) => setActiveAiService(svc)}
          onPasteSelectedToEditor={handlePasteAiSelectionToEditor}
          onReload={() => tauriApi.reloadAiPanel().catch(console.error)}
          onPopOutToWindow={handlePopOutAiWindow}
          onClose={() => setIsAiPanelOpen(false)}
          onWidthChange={handleAiPanelWidthChange}
          viewportRef={aiViewportRef}
        />
      </div>

      {/* Bottom Status Bar */}
      <StatusBar
        activeTab={activeTab}
        paneCount={panes.length}
        isLight={isLight}
        onToggleTerminal={handleAddTerminalPane}
        onToggleEncoding={handleToggleEncoding}
        onToggleLineEnding={handleToggleLineEnding}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onToggleAiAssistant={handleToggleAiAssistant}
      />

      {/* Floating AI Clipboard Pill */}
      {aiClipboardPill && (
        <div
          style={{
            position: 'fixed',
            bottom: '36px',
            right: '24px',
            backgroundColor: isLight ? 'rgba(255, 255, 255, 0.96)' : 'rgba(24, 24, 27, 0.96)',
            color: isLight ? '#18181b' : '#f4f4f5',
            border: '1px solid #38bdf8',
            borderRadius: '10px',
            padding: '10px 14px',
            boxShadow: '0 12px 30px rgba(0, 0, 0, 0.35)',
            backdropFilter: 'blur(8px)',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            gap: '14px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Sparkles size={16} color="#38bdf8" />
            <div>
              <div style={{ fontWeight: 600, fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span>방금 복사한 AI 코드</span>
                <span
                  style={{
                    fontSize: '10px',
                    backgroundColor: '#0284c7',
                    color: '#ffffff',
                    padding: '1px 5px',
                    borderRadius: '4px',
                  }}
                >
                  {aiClipboardPill.lineCount}줄{aiClipboardPill.language ? ` · ${aiClipboardPill.language}` : ''}
                </span>
              </div>
              <div
                style={{
                  fontSize: '11px',
                  color: isLight ? '#71717a' : '#a1a1aa',
                  maxWidth: '240px',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  fontFamily: 'monospace',
                }}
              >
                {aiClipboardPill.code.split('\n')[0]}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <button
              onClick={() => {
                handleSmartInsertAiCode();
                setAiClipboardPill(null);
              }}
              style={{
                backgroundColor: '#0284c7',
                color: '#ffffff',
                border: 'none',
                borderRadius: '5px',
                padding: '4px 10px',
                fontSize: '11px',
                fontWeight: 600,
                cursor: 'pointer',
              }}
              title="현재 커서 위치에 들여쓰기를 맞춰 삽입합니다 (Alt+V)"
            >
              커서에 삽입 (Alt+V)
            </button>
            <button
              onClick={() => {
                handleNewTabWithContent(aiClipboardPill.code, aiClipboardPill.language);
                setAiClipboardPill(null);
              }}
              style={{
                backgroundColor: isLight ? '#e4e4e7' : '#27272a',
                color: isLight ? '#18181b' : '#f4f4f5',
                border: 'none',
                borderRadius: '5px',
                padding: '4px 8px',
                fontSize: '11px',
                cursor: 'pointer',
              }}
              title="새 파일 탭을 열어 코드를 붙여넣습니다"
            >
              새 문서로
            </button>
            <button
              onClick={() => setAiClipboardPill(null)}
              style={{
                background: 'transparent',
                border: 'none',
                color: isLight ? '#71717a' : '#a1a1aa',
                cursor: 'pointer',
                padding: '2px 4px',
                fontSize: '12px',
              }}
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* Preferences / Settings Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        settings={settings}
        onUpdateSettings={handleUpdateSettings}
        onClose={() => setIsSettingsOpen(false)}
      />

      {/* Unsaved Changes Confirmation Modal on Exit */}
      <UnsavedChangesModal
        isOpen={isCloseModalOpen}
        dirtyTabs={tabs.filter((t) => t.isDirty)}
        theme={settings.theme}
        isSaving={isSavingAndQuitting}
        onSaveAndQuit={handleSaveAndQuit}
        onDiscardAndQuit={handleDiscardAndQuit}
        onCancel={handleCancelClose}
      />

      {/* Floating Warning/Info Toast */}
      {toastMessage && (
        <div
          style={{
            position: 'fixed',
            top: '42px',
            right: '20px',
            backgroundColor:
              toastMessage.startsWith('🤖') ||
              toastMessage.startsWith('✨') ||
              toastMessage.startsWith('💡') ||
              toastMessage.startsWith('📌')
                ? '#0284c7'
                : '#dc2626',
            color: '#ffffff',
            padding: '10px 14px',
            borderRadius: '6px',
            boxShadow: '0 10px 25px rgba(0, 0, 0, 0.45)',
            fontSize: '12px',
            zIndex: 99999,
            display: 'flex',
            alignItems: 'flex-start',
            gap: '10px',
            maxWidth: '420px',
            lineHeight: '1.45',
          }}
        >
          {toastMessage.startsWith('🤖') ||
          toastMessage.startsWith('✨') ||
          toastMessage.startsWith('💡') ||
          toastMessage.startsWith('📌') ? (
            <Sparkles size={18} style={{ flexShrink: 0, marginTop: '1px' }} />
          ) : (
            <AlertTriangle size={18} style={{ flexShrink: 0, marginTop: '1px' }} />
          )}
          <span style={{ flex: 1, whiteSpace: 'pre-line' }}>{toastMessage}</span>
          <button
            onClick={() => setToastMessage(null)}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#ffffff',
              cursor: 'pointer',
              padding: '2px',
              display: 'flex',
              alignItems: 'center',
            }}
          >
            <X size={14} />
          </button>
        </div>
      )}
    </div>
  );
}
