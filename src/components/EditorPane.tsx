import React, { useRef, useState, useMemo, useEffect } from 'react';
import Editor, { loader, OnMount } from '@monaco-editor/react';
import * as monaco from 'monaco-editor';
import { TabItem, EditorSettings } from '../types';
import { MarkdownPreview } from './MarkdownPreview';
import { CsvTablePreview } from './CsvTablePreview';
import { HtmlPreview } from './HtmlPreview';
import { ContextMenu, ContextMenuItem } from './ContextMenu';
import { extractLinkOrPathAt, openLinkOrPath, tauriApi } from '../services/tauriApi';
import {
  Code2,
  Eye,
  Columns,
  Undo2,
  Redo2,
  Scissors,
  Copy,
  Clipboard,
  Trash2,
  CheckSquare,
  Search,
  Replace,
  AlignLeft,
  MousePointerClick,
  MessageSquareCode,
  Terminal,
  ExternalLink,
  Sparkles,
  Bot,
} from 'lucide-react';
import { extractAiCode, adjustIndentation, generateAiPrompt } from '../utils/aiCodeParser';

// Configure monaco to use local installation (offline-ready)
loader.config({ monaco });

interface EditorPaneProps {
  tab: TabItem;
  settings: EditorSettings;
  workspacePath?: string;
  onOpenFile?: (path: string) => void;
  showToast?: (msg: string) => void;
  onChangeContent: (tabId: string, newContent: string) => void;
  onUpdateViewMode: (tabId: string, mode: 'edit' | 'preview' | 'split') => void;
  onOpenPreviewSplit?: () => void;
}

export const EditorPane: React.FC<EditorPaneProps> = ({
  tab,
  settings,
  workspacePath,
  onOpenFile,
  showToast,
  onChangeContent,
  onUpdateViewMode,
  onOpenPreviewSplit,
}) => {
  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);
  const [hasSelection, setHasSelection] = useState(false);
  const [detectedLink, setDetectedLink] = useState<string | null>(null);

  const isMac = typeof navigator !== 'undefined' && navigator.platform.toUpperCase().indexOf('MAC') >= 0;
  const isMarkdown = tab.language === 'markdown';
  const isCsv = tab.language === 'csv';
  const isHtml = tab.language === 'html' || tab.path.endsWith('.html') || tab.path.endsWith('.htm');
  const isLight = settings.theme === 'vs';

  // Whenever viewMode changes (e.g. from 'edit' directly to 'split'), trigger Monaco layout calculation
  useEffect(() => {
    if (editorRef.current) {
      requestAnimationFrame(() => {
        editorRef.current?.layout();
      });
      const timer = setTimeout(() => {
        editorRef.current?.layout();
      }, 60);
      return () => clearTimeout(timer);
    }
  }, [tab.viewMode]);

  // Open detected link or folder/file path
  const handleOpenLink = async (target: string) => {
    try {
      const res = await openLinkOrPath(target, workspacePath, onOpenFile);
      if (!res.success && res.message) {
        showToast?.(res.message);
      }
    } catch (err) {
      showToast?.(`열기 오류: ${err}`);
    }
  };

  // Smart AI Code Insertion (Alt+V / ⌥V / Context Menu / Floating Pill)
  const handleSmartInsertAiCode = async () => {
    const editor = editorRef.current;
    if (!editor) return;
    editor.focus();

    try {
      const clipText = await tauriApi.readClipboard();
      if (!clipText || !clipText.trim()) {
        showToast?.('클립보드가 비어 있습니다.');
        return;
      }

      const parsed = extractAiCode(clipText);
      const model = editor.getModel();
      const pos = editor.getPosition();
      let currentLinePrefix = '';
      if (model && pos) {
        const lineContent = model.getLineContent(pos.lineNumber);
        currentLinePrefix = lineContent.slice(0, pos.column - 1);
      }

      const formattedCode = adjustIndentation(parsed.code, currentLinePrefix);
      const sel = editor.getSelection();

      if (sel) {
        editor.executeEdits('ai-insert', [
          {
            range: sel,
            text: formattedCode,
            forceMoveMarkers: true,
          },
        ]);
        const newPos = editor.getPosition();
        if (newPos) {
          editor.revealPositionInCenterIfOutsideViewport(newPos);
        }
      }

      const msg = parsed.isExtracted
        ? `🤖 AI 코드 스마트 정돈 삽입 완료 (${parsed.lineCount}줄${parsed.language ? ` · ${parsed.language}` : ''})`
        : `🤖 클립보드 코드 삽입 완료 (${parsed.lineCount}줄)`;
      showToast?.(msg);
    } catch (err) {
      console.error('AI code insert failed:', err);
      showToast?.('클립보드 접근 권한이 없거나 읽기에 실패했습니다.');
    }
  };

  // Copy selected code with AI Prompt template
  const handleCopyAsAiPrompt = async (intent: 'general' | 'fix' | 'optimize' | 'explain' = 'general') => {
    const editor = editorRef.current;
    if (!editor) return;
    const sel = editor.getSelection();
    const model = editor.getModel();
    if (!sel || sel.isEmpty() || !model) return;

    const selectedCode = model.getValueInRange(sel);
    const prompt = generateAiPrompt(selectedCode, tab.language, intent);
    try {
      await tauriApi.writeClipboard(prompt);
      showToast?.('💡 선택한 코드의 AI 질문 템플릿이 복사되었습니다. AI 도우미 창에 붙여넣으세요!');
    } catch (err) {
      console.error('Failed to copy prompt:', err);
      showToast?.('클립보드 복사에 실패했습니다.');
    }
  };

  // Listen to custom smart insert event (dispatched by App.tsx, TopMenuBar or shortcuts)
  useEffect(() => {
    const onAiInsert = () => {
      handleSmartInsertAiCode();
    };
    window.addEventListener('geditor-smart-insert-ai', onAiInsert);
    return () => window.removeEventListener('geditor-smart-insert-ai', onAiInsert);
  }, []);

  const handleEditorDidMount: OnMount = (editor) => {
    editorRef.current = editor;

    // Register Alt+V / Option+V inside Monaco Editor
    editor.addCommand(monaco.KeyMod.Alt | monaco.KeyCode.KeyV, () => {
      handleSmartInsertAiCode();
    });

    // Track text selection
    editor.onDidChangeCursorSelection(() => {
      const sel = editor.getSelection();
      setHasSelection(sel ? !sel.isEmpty() : false);
    });

    // Control + Click (or Cmd + Click) to open URL links or file/folder paths
    editor.onMouseDown((e) => {
      if ((e.event.ctrlKey || e.event.metaKey) && e.event.leftButton && e.target.position) {
        const model = editor.getModel();
        if (!model) return;
        const line = model.getLineContent(e.target.position.lineNumber);
        const link = extractLinkOrPathAt(line, e.target.position.column);
        if (link) {
          e.event.preventDefault();
          e.event.stopPropagation();
          handleOpenLink(link);
        }
      }
    });

    // Right click inside editor -> Show Korean Context Menu
    editor.onContextMenu((e) => {
      e.event.preventDefault();
      e.event.stopPropagation();

      const sel = editor.getSelection();
      const model = editor.getModel();

      // If right clicked outside active selection, move cursor to click position
      if (e.target.position) {
        if (!sel || sel.isEmpty() || !sel.containsPosition(e.target.position)) {
          editor.setPosition(e.target.position);
          setHasSelection(false);
        } else {
          setHasSelection(true);
        }
      } else {
        setHasSelection(sel ? !sel.isEmpty() : false);
      }

      // Detect link or path for context menu "링크 열기"
      let activeLink: string | null = null;
      if (sel && !sel.isEmpty() && model) {
        const selectedText = model.getValueInRange(sel).trim();
        if (
          selectedText &&
          (selectedText.startsWith('http://') ||
            selectedText.startsWith('https://') ||
            selectedText.startsWith('/') ||
            selectedText.startsWith('./') ||
            selectedText.startsWith('../') ||
            selectedText.startsWith('~/') ||
            /^[a-zA-Z]:[\\\/]/.test(selectedText))
        ) {
          activeLink = selectedText;
        }
      }

      if (!activeLink && e.target.position && model) {
        const line = model.getLineContent(e.target.position.lineNumber);
        activeLink = extractLinkOrPathAt(line, e.target.position.column);
      }

      setDetectedLink(activeLink);

      setContextMenu({
        x: e.event.browserEvent.clientX,
        y: e.event.browserEvent.clientY,
      });
    });
  };

  // Editor Korean Context Menu Items
  const editorMenuItems: ContextMenuItem[] = useMemo(() => [
    {
      label: detectedLink
        ? `링크 열기 (${detectedLink.length > 25 ? detectedLink.slice(0, 25) + '...' : detectedLink})`
        : '링크 열기',
      icon: <ExternalLink size={14} />,
      shortcut: isMac ? '⌘+클릭' : 'Ctrl+클릭',
      disabled: !detectedLink,
      onClick: () => {
        if (detectedLink) {
          handleOpenLink(detectedLink);
        }
      },
    },
    { separator: true },
    {
      label: '실행 취소',
      icon: <Undo2 size={14} />,
      shortcut: isMac ? '⌘Z' : 'Ctrl+Z',
      onClick: () => {
        editorRef.current?.focus();
        editorRef.current?.trigger('context-menu', 'undo', null);
      },
    },
    {
      label: '다시 실행',
      icon: <Redo2 size={14} />,
      shortcut: isMac ? '⇧⌘Z' : 'Ctrl+Y',
      onClick: () => {
        editorRef.current?.focus();
        editorRef.current?.trigger('context-menu', 'redo', null);
      },
    },
    { separator: true },
    {
      label: '잘라내기',
      icon: <Scissors size={14} />,
      shortcut: isMac ? '⌘X' : 'Ctrl+X',
      disabled: !hasSelection,
      onClick: async () => {
        const editor = editorRef.current;
        if (!editor) return;
        editor.focus();
        const sel = editor.getSelection();
        if (sel && !sel.isEmpty()) {
          const text = editor.getModel()?.getValueInRange(sel) || '';
          try {
            await tauriApi.writeClipboard(text);
            editor.executeEdits('cut', [{ range: sel, text: '', forceMoveMarkers: true }]);
          } catch {
            document.execCommand('cut');
          }
        }
      },
    },
    {
      label: '복사',
      icon: <Copy size={14} />,
      shortcut: isMac ? '⌘C' : 'Ctrl+C',
      disabled: !hasSelection,
      onClick: async () => {
        const editor = editorRef.current;
        if (!editor) return;
        editor.focus();
        const sel = editor.getSelection();
        if (sel && !sel.isEmpty()) {
          const text = editor.getModel()?.getValueInRange(sel) || '';
          try {
            await tauriApi.writeClipboard(text);
          } catch {
            document.execCommand('copy');
          }
        }
      },
    },
    {
      label: '붙여넣기',
      icon: <Clipboard size={14} />,
      shortcut: isMac ? '⌘V' : 'Ctrl+V',
      onClick: async () => {
        const editor = editorRef.current;
        if (!editor) return;
        editor.focus();
        try {
          const text = await tauriApi.readClipboard();
          const sel = editor.getSelection();
          if (sel) {
            editor.executeEdits('paste', [{ range: sel, text, forceMoveMarkers: true }]);
          }
        } catch {
          document.execCommand('paste');
        }
      },
    },
    {
      label: 'AI 코드 스마트 삽입',
      icon: <Sparkles size={14} color="#38bdf8" />,
      shortcut: isMac ? '⌥V' : 'Alt+V',
      onClick: handleSmartInsertAiCode,
    },
    {
      label: '선택 코드로 AI 질문 복사',
      icon: <Bot size={14} color="#a855f7" />,
      disabled: !hasSelection,
      onClick: () => handleCopyAsAiPrompt('general'),
    },
    {
      label: '삭제',
      icon: <Trash2 size={14} />,
      disabled: !hasSelection,
      onClick: () => {
        const editor = editorRef.current;
        if (!editor) return;
        editor.focus();
        const sel = editor.getSelection();
        if (sel && !sel.isEmpty()) {
          editor.executeEdits('delete', [{ range: sel, text: '', forceMoveMarkers: true }]);
        }
      },
    },
    { separator: true },
    {
      label: '모두 선택',
      icon: <CheckSquare size={14} />,
      shortcut: isMac ? '⌘A' : 'Ctrl+A',
      onClick: () => {
        const editor = editorRef.current;
        if (!editor) return;
        editor.focus();
        const model = editor.getModel();
        if (model) {
          editor.setSelection(model.getFullModelRange());
        }
      },
    },
    { separator: true },
    {
      label: '찾기',
      icon: <Search size={14} />,
      shortcut: isMac ? '⌘F' : 'Ctrl+F',
      onClick: () => {
        const editor = editorRef.current;
        if (!editor) return;
        editor.focus();
        editor.getAction('actions.find')?.run();
      },
    },
    {
      label: '바꾸기',
      icon: <Replace size={14} />,
      shortcut: isMac ? '⌥⌘F' : 'Ctrl+H',
      onClick: () => {
        const editor = editorRef.current;
        if (!editor) return;
        editor.focus();
        editor.getAction('editor.action.startFindReplaceAction')?.run();
      },
    },
    { separator: true },
    {
      label: '코드 서식 정리 (Format)',
      icon: <AlignLeft size={14} />,
      shortcut: isMac ? '⇧⌥F' : 'Shift+Alt+F',
      onClick: () => {
        const editor = editorRef.current;
        if (!editor) return;
        editor.focus();
        editor.getAction('editor.action.formatDocument')?.run();
      },
    },
    {
      label: '모든 일치 항목 변경',
      icon: <MousePointerClick size={14} />,
      shortcut: isMac ? '⌘F2' : 'Ctrl+F2',
      onClick: () => {
        const editor = editorRef.current;
        if (!editor) return;
        editor.focus();
        editor.getAction('editor.action.changeAll')?.run();
      },
    },
    {
      label: '행 주석 토글',
      icon: <MessageSquareCode size={14} />,
      shortcut: isMac ? '⌘/' : 'Ctrl+/',
      onClick: () => {
        const editor = editorRef.current;
        if (!editor) return;
        editor.focus();
        editor.getAction('editor.action.commentLine')?.run();
      },
    },
    { separator: true },
    {
      label: '명령 팔레트 (Command Palette)',
      icon: <Terminal size={14} />,
      shortcut: 'F1',
      onClick: () => {
        const editor = editorRef.current;
        if (!editor) return;
        editor.focus();
        editor.getAction('editor.action.quickCommand')?.run();
      },
    },
  ], [detectedLink, hasSelection, isMac]);

  // Preview Context Menu (for markdown/csv preview zones)
  const handlePreviewContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    // Check selected text in preview
    const selected = window.getSelection()?.toString().trim();
    if (selected && (/^https?:\/\//i.test(selected) || selected.startsWith('/') || selected.startsWith('./') || selected.startsWith('~/'))) {
      setDetectedLink(selected);
    } else {
      setDetectedLink(null);
    }

    setContextMenu({ x: e.clientX, y: e.clientY });
  };

  const previewMenuItems: ContextMenuItem[] = useMemo(() => [
    ...(detectedLink ? [
      {
        label: `링크 열기 (${detectedLink.length > 25 ? detectedLink.slice(0, 25) + '...' : detectedLink})`,
        icon: <ExternalLink size={14} />,
        onClick: () => handleOpenLink(detectedLink),
      },
      { separator: true },
    ] : []),
    {
      label: '복사',
      icon: <Copy size={14} />,
      shortcut: isMac ? '⌘C' : 'Ctrl+C',
      onClick: () => {
        const selected = window.getSelection()?.toString();
        if (selected) {
          navigator.clipboard.writeText(selected);
        }
      },
    },
    {
      label: '모두 선택',
      icon: <CheckSquare size={14} />,
      shortcut: isMac ? '⌘A' : 'Ctrl+A',
      onClick: () => {
        document.execCommand('selectAll');
      },
    },
    { separator: true },
    {
      label: '에디터 모드로 전환',
      icon: <Code2 size={14} />,
      onClick: () => {
        onUpdateViewMode(tab.id, 'edit');
      },
    },
    ...((isMarkdown || isHtml) ? [
      {
        label: '나란히 보기 모드 (Split)',
        icon: <Columns size={14} />,
        onClick: () => {
          onUpdateViewMode(tab.id, 'split');
        },
      },
    ] : []),
  ], [detectedLink, isMac, isMarkdown, isHtml, onUpdateViewMode, tab.id]);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        width: '100%',
        height: '100%',
        overflow: 'hidden',
        backgroundColor: isLight ? '#ffffff' : '#1e1e1e',
      }}
    >
      {/* Subheader for Markdown, CSV, and HTML view mode toggles */}
      {(isMarkdown || isCsv || isHtml) && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            padding: '4px 12px',
            backgroundColor: isLight ? '#f4f4f5' : '#18181b',
            borderBottom: isLight ? '1px solid #e4e4e7' : '1px solid #27272a',
            gap: '8px',
            fontSize: '11px',
          }}
        >
          <span style={{ color: isLight ? '#71717a' : '#a1a1aa' }}>
            {isHtml ? 'HTML 보기 모드:' : isMarkdown ? '마크다운 보기 모드:' : 'CSV 보기 모드:'}
          </span>
          <button
            onClick={() => onUpdateViewMode(tab.id, 'edit')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              padding: '2px 8px',
              borderRadius: '4px',
              border: 'none',
              cursor: 'pointer',
              backgroundColor: tab.viewMode === 'edit' ? '#38bdf8' : isLight ? '#e4e4e7' : '#27272a',
              color: tab.viewMode === 'edit' ? '#000' : isLight ? '#3f3f46' : '#d4d4d8',
              fontWeight: 500,
            }}
          >
            <Code2 size={12} />
            에디터
          </button>
          <button
            onClick={() => onUpdateViewMode(tab.id, 'preview')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              padding: '2px 8px',
              borderRadius: '4px',
              border: 'none',
              cursor: 'pointer',
              backgroundColor: tab.viewMode === 'preview' ? '#38bdf8' : isLight ? '#e4e4e7' : '#27272a',
              color: tab.viewMode === 'preview' ? '#000' : isLight ? '#3f3f46' : '#d4d4d8',
              fontWeight: 500,
            }}
          >
            <Eye size={12} />
            {isHtml ? '웹 페이지' : isMarkdown ? '미리보기' : '표 보기'}
          </button>
          {(isMarkdown || isHtml) && (
            <button
              onClick={() => onUpdateViewMode(tab.id, 'split')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                padding: '2px 8px',
                borderRadius: '4px',
                border: 'none',
                cursor: 'pointer',
                backgroundColor: tab.viewMode === 'split' ? '#38bdf8' : isLight ? '#e4e4e7' : '#27272a',
                color: tab.viewMode === 'split' ? '#000' : isLight ? '#3f3f46' : '#d4d4d8',
                fontWeight: 500,
              }}
            >
              <Columns size={12} />
              나란히 보기
            </button>
          )}
          {onOpenPreviewSplit && (isMarkdown || isHtml) && (
            <button
              onClick={onOpenPreviewSplit}
              title={isMac ? "독립된 2개 패널로 코드와 실시간 렌더링 나란히 열기 (⌘⇧V)" : "독립된 2개 패널로 코드와 실시간 렌더링 나란히 열기 (Ctrl+Shift+V)"}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                padding: '2px 10px',
                borderRadius: '4px',
                border: 'none',
                cursor: 'pointer',
                backgroundColor: '#0284c7',
                color: '#ffffff',
                fontWeight: 600,
                marginLeft: 'auto',
                boxShadow: '0 1px 2px rgba(0,0,0,0.15)',
              }}
            >
              <Columns size={12} />
              ⚡ 2패널 실시간 뷰 분할
            </button>
          )}
        </div>
      )}

      {/* Main Content Area */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden', width: '100%', height: '100%' }}>
        {/* Editor component */}
        {(tab.viewMode === 'edit' || ((isMarkdown || isHtml) && tab.viewMode === 'split')) && (
          <div
            style={{
              flex: tab.viewMode === 'split' ? '0 0 50%' : 1,
              width: tab.viewMode === 'split' ? '50%' : '100%',
              minWidth: 0,
              height: '100%',
              position: 'relative',
              overflow: 'hidden',
            }}
          >
            <Editor
              height="100%"
              language={tab.language}
              value={tab.content}
              theme={settings.theme}
              onChange={(value) => onChangeContent(tab.id, value || '')}
              onMount={handleEditorDidMount}
              options={{
                contextmenu: false, // Disables English Monaco default context menu
                fontSize: settings.fontSize,
                fontFamily: settings.fontFamily,
                lineHeight: settings.lineHeight,
                tabSize: settings.tabSize,
                insertSpaces: settings.insertSpaces,
                wordWrap: settings.wordWrap,
                minimap: { enabled: settings.showMinimap, maxColumn: 80 },
                lineNumbers: settings.showLineNumbers,
                cursorBlinking: settings.cursorBlinking,
                cursorStyle: settings.cursorStyle,
                renderWhitespace: 'selection',
                scrollBeyondLastLine: false,
                smoothScrolling: true,
                cursorSmoothCaretAnimation: 'on',
                formatOnPaste: true,
                automaticLayout: true,
                bracketPairColorization: { enabled: true },
                links: true,
              }}
            />
          </div>
        )}

        {/* Markdown Preview component */}
        {isMarkdown && (tab.viewMode === 'preview' || tab.viewMode === 'split') && (
          <div
            onContextMenu={handlePreviewContextMenu}
            style={{
              flex: tab.viewMode === 'split' ? '0 0 50%' : 1,
              width: tab.viewMode === 'split' ? '50%' : '100%',
              minWidth: 0,
              height: '100%',
              borderLeft: tab.viewMode === 'split' ? (isLight ? '1px solid #e4e4e7' : '1px solid #27272a') : 'none',
              overflow: 'hidden',
            }}
          >
            <MarkdownPreview content={tab.content} isLight={isLight} />
          </div>
        )}

        {/* HTML Preview component */}
        {isHtml && (tab.viewMode === 'preview' || tab.viewMode === 'split') && (
          <div
            style={{
              flex: tab.viewMode === 'split' ? '0 0 50%' : 1,
              width: tab.viewMode === 'split' ? '50%' : '100%',
              minWidth: 0,
              height: '100%',
              borderLeft: tab.viewMode === 'split' ? (isLight ? '1px solid #e4e4e7' : '1px solid #27272a') : 'none',
              overflow: 'hidden',
            }}
          >
            <HtmlPreview content={tab.content} filePath={tab.path} isLight={isLight} />
          </div>
        )}

        {/* CSV Table Preview component */}
        {isCsv && tab.viewMode === 'preview' && (
          <div
            onContextMenu={handlePreviewContextMenu}
            style={{ flex: 1, height: '100%' }}
          >
            <CsvTablePreview content={tab.content} />
          </div>
        )}
      </div>

      {/* Korean Context Menu */}
      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          isLight={isLight}
          items={
            tab.viewMode === 'preview' && (isMarkdown || isCsv || isHtml)
              ? previewMenuItems
              : editorMenuItems
          }
          onClose={() => setContextMenu(null)}
        />
      )}
    </div>
  );
};
