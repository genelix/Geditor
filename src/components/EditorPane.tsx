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
  Bold,
  Italic,
  Strikethrough,
  Heading,
  Link as LinkIcon,
  List,
  ListOrdered,
  Quote,
  CheckSquare2,
} from 'lucide-react';
import { extractAiCode, adjustIndentation, generateAiPrompt, cleanInlineAiOutput } from '../utils/aiCodeParser';
import { applyMarkdownFormat, MarkdownFormatType } from '../utils/markdownFormatter';
import { CursorLineInfo, ScrollRatioInfo } from './MarkdownPreview';
import { InlineAiWidget } from './InlineAiWidget';

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

  // Synchronized cursor and scroll states for split markdown view
  const [cursorLineInfo, setCursorLineInfo] = useState<CursorLineInfo | null>(null);
  const [scrollRatioInfo, setScrollRatioInfo] = useState<ScrollRatioInfo | null>(null);

  // Editor container ref for positioning floating widgets
  const editorContainerRef = useRef<HTMLDivElement | null>(null);

  // Inline AI Floating Widget State
  const [inlineAiState, setInlineAiState] = useState<{
    isOpen: boolean;
    position: { top: number; left: number };
    hasSelection: boolean;
    selectedLineCount: number;
    selectedRange: monaco.Range | null;
    cursorPosition: monaco.Position | null;
    isLoading: boolean;
    statusText: string;
    error: string | null;
  }>({
    isOpen: false,
    position: { top: 60, left: 60 },
    hasSelection: false,
    selectedLineCount: 0,
    selectedRange: null,
    cursorPosition: null,
    isLoading: false,
    statusText: '',
    error: null,
  });

  // Markdown format applicator helper
  const handleApplyMdFormat = async (type: MarkdownFormatType) => {
    const editor = editorRef.current;
    if (!editor) return;
    editor.focus();
    let clip = '';
    if (type === 'link') {
      clip = await tauriApi.readClipboard().catch(() => '');
    }
    applyMarkdownFormat(editor, type, clip);
  };

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

  // Direct AI text insertion from AI Side Panel selection
  const handleDirectInsertText = (rawText: string) => {
    const editor = editorRef.current;
    if (!editor) return;
    editor.focus();

    const isMarkdownDoc = tab.language === 'markdown' || tab.name.endsWith('.md');
    const isTable = rawText.includes('|') && rawText.includes('---');

    const model = editor.getModel();
    const pos = editor.getPosition();
    let currentLinePrefix = '';
    if (model && pos) {
      const lineContent = model.getLineContent(pos.lineNumber);
      currentLinePrefix = lineContent.slice(0, pos.column - 1);
    }

    let textToInsert = rawText;
    // 마크다운 문서가 아니거나 표가 아닌 순수 코드 파일(.py, .js 등)인 경우에만 코드 블록 펜스 정돈 적용
    if (!isMarkdownDoc && !isTable) {
      const parsed = extractAiCode(rawText);
      if (parsed.isExtracted) {
        textToInsert = adjustIndentation(parsed.code, currentLinePrefix);
      }
    }

    const sel = editor.getSelection();
    if (sel) {
      editor.executeEdits('ai-direct-insert', [
        {
          range: sel,
          text: textToInsert,
          forceMoveMarkers: true,
        },
      ]);
      const newPos = editor.getPosition();
      if (newPos) {
        editor.revealPositionInCenterIfOutsideViewport(newPos);
      }
    }
    showToast?.('✨ 선택한 AI 마크다운 내용이 에디터 본문에 삽입되었습니다.');
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

  // Ask AI directly with selected text pre-filled into AI chat box
  const handleAskAiWithSelection = async () => {
    const editor = editorRef.current;
    if (!editor) return;
    const sel = editor.getSelection();
    const model = editor.getModel();
    if (!sel || sel.isEmpty() || !model) {
      showToast?.('💡 본문에서 AI 입력창에 붙여넣을 텍스트를 먼저 드래그하여 선택해 주세요.');
      return;
    }

    const selectedCode = model.getValueInRange(sel);
    if (!selectedCode.trim()) {
      showToast?.('💡 본문에서 AI 입력창에 붙여넣을 텍스트를 먼저 드래그하여 선택해 주세요.');
      return;
    }

    // Direct selected text pasted into AI chat box
    const prompt = selectedCode.trim();

    try {
      showToast?.('🤖 선택한 본문 텍스트를 AI 입력창에 붙여넣는 중...');
      await tauriApi.askAiWithPrompt(prompt);
      showToast?.('✅ 선택한 본문 텍스트가 AI 입력창에 입력되었습니다.');
    } catch (err) {
      console.error('Failed to ask AI with prompt:', err);
      showToast?.(`AI 질문 연동 실패: ${err}`);
    }
  };

  // Open Floating Inline AI Assistant
  const handleOpenInlineAi = () => {
    const editor = editorRef.current;
    if (!editor) return;
    const sel = editor.getSelection();
    const pos = editor.getPosition();
    const model = editor.getModel();

    const hasSel = Boolean(sel && !sel.isEmpty() && model);
    let lineCount = 0;
    if (hasSel && sel) {
      lineCount = Math.abs(sel.endLineNumber - sel.startLineNumber) + 1;
    }

    // Position relative to editor viewport
    const visiblePos = editor.getScrolledVisiblePosition(pos || { lineNumber: 1, column: 1 });
    let top = (visiblePos?.top || 70) + (visiblePos?.height || 22) + 8;
    let left = Math.max(20, Math.min(window.innerWidth - 560, visiblePos?.left || 40));

    const containerHeight = editorContainerRef.current?.clientHeight || 600;
    if (top + 230 > containerHeight) {
      top = Math.max(20, (visiblePos?.top || 70) - 230);
    }

    // Ensure AI side panel webview is active
    window.dispatchEvent(new CustomEvent('geditor-open-ai-panel'));

    setInlineAiState({
      isOpen: true,
      position: { top, left },
      hasSelection: hasSel,
      selectedLineCount: lineCount,
      selectedRange: sel
        ? new monaco.Range(sel.startLineNumber, sel.startColumn, sel.endLineNumber, sel.endColumn)
        : null,
      cursorPosition: pos ? new monaco.Position(pos.lineNumber, pos.column) : null,
      isLoading: false,
      statusText: '',
      error: null,
    });
  };

  // Submit and execute Inline AI Generation
  const handleSubmitInlineAi = async (userPrompt: string) => {
    const editor = editorRef.current;
    if (!editor) return;

    setInlineAiState((prev) => ({
      ...prev,
      isLoading: true,
      statusText: 'AI가 내용을 생성 중입니다...',
      error: null,
    }));

    try {
      const model = editor.getModel();
      let selectedSnippet: string | undefined = undefined;
      if (inlineAiState.hasSelection && inlineAiState.selectedRange && model) {
        selectedSnippet = model.getValueInRange(inlineAiState.selectedRange);
      }

      showToast?.('🤖 AI가 본문 내용을 생성 중입니다...');
      const rawOutput = await tauriApi.executeInlineAi(userPrompt, selectedSnippet);
      const isMd = tab.language === 'markdown' || tab.name.endsWith('.md');
      const cleaned = cleanInlineAiOutput(rawOutput, isMd);

      editor.focus();
      if (inlineAiState.hasSelection && inlineAiState.selectedRange) {
        editor.executeEdits('inline-ai', [
          {
            range: inlineAiState.selectedRange,
            text: cleaned,
            forceMoveMarkers: true,
          },
        ]);
        const endPos = editor.getPosition();
        if (endPos) editor.revealPositionInCenterIfOutsideViewport(endPos);
      } else if (inlineAiState.cursorPosition) {
        const cp = inlineAiState.cursorPosition;
        const insertRange = new monaco.Range(cp.lineNumber, cp.column, cp.lineNumber, cp.column);
        editor.executeEdits('inline-ai', [
          {
            range: insertRange,
            text: cleaned,
            forceMoveMarkers: true,
          },
        ]);
        const endPos = editor.getPosition();
        if (endPos) editor.revealPositionInCenterIfOutsideViewport(endPos);
      }

      setInlineAiState((prev) => ({ ...prev, isOpen: false, isLoading: false }));
      showToast?.('✨ AI 생성이 완료되었습니다! (⌘Z 로 실행 취소 가능)');
    } catch (err: any) {
      console.error('Inline AI execution failed:', err);
      const msg = typeof err === 'string' ? err : err?.message || 'AI 생성에 실패했습니다.';
      setInlineAiState((prev) => ({
        ...prev,
        isLoading: false,
        error: msg,
      }));
      showToast?.(`AI 생성 오류: ${msg}`);
    }
  };

  const handleCancelInlineAi = async () => {
    try {
      await tauriApi.cancelInlineAi();
    } catch (e) {}
    setInlineAiState((prev) => ({ ...prev, isOpen: false, isLoading: false }));
    editorRef.current?.focus();
    showToast?.('AI 생성이 취소되었습니다.');
  };

  const handleCloseInlineAi = () => {
    setInlineAiState((prev) => ({ ...prev, isOpen: false, isLoading: false, error: null }));
    editorRef.current?.focus();
  };

  // Listen to custom smart insert event (dispatched by App.tsx, TopMenuBar or shortcuts)
  useEffect(() => {
    const onAiInsert = () => {
      handleSmartInsertAiCode();
    };
    const onAskAi = () => {
      handleAskAiWithSelection();
    };
    const onInlineAi = () => {
      handleOpenInlineAi();
    };
    const onInsertText = (e: Event) => {
      const customEvent = e as CustomEvent<{ text: string }>;
      const text = customEvent.detail?.text;
      if (text) {
        handleDirectInsertText(text);
      }
    };
    window.addEventListener('geditor-smart-insert-ai', onAiInsert);
    window.addEventListener('geditor-ask-ai', onAskAi);
    window.addEventListener('geditor-inline-ai', onInlineAi);
    window.addEventListener('geditor-insert-text', onInsertText);
    return () => {
      window.removeEventListener('geditor-smart-insert-ai', onAiInsert);
      window.removeEventListener('geditor-ask-ai', onAskAi);
      window.removeEventListener('geditor-inline-ai', onInlineAi);
      window.removeEventListener('geditor-insert-text', onInsertText);
    };
  }, []);

  const handleEditorDidMount: OnMount = (editor) => {
    editorRef.current = editor;

    // Register Alt+V / Option+V inside Monaco Editor
    editor.addCommand(monaco.KeyMod.Alt | monaco.KeyCode.KeyV, () => {
      handleSmartInsertAiCode();
    });

    // Register Alt+K / Option+K to open Inline AI Assist
    editor.addCommand(monaco.KeyMod.Alt | monaco.KeyCode.KeyK, () => {
      handleOpenInlineAi();
    });

    // Register Alt+A / Option+A to ask AI with current selection
    editor.addCommand(monaco.KeyMod.Alt | monaco.KeyCode.KeyA, () => {
      handleAskAiWithSelection();
    });

    // Track cursor position for synchronized preview positioning
    editor.onDidChangeCursorPosition((e) => {
      const line = e.position.lineNumber;
      const totalLines = editor.getModel()?.getLineCount() || 1;
      setCursorLineInfo({ line, totalLines, timestamp: Date.now() });
    });

    // Track scroll position for synchronized preview scrolling
    editor.onDidScrollChange((e) => {
      const editorHeight = editor.getLayoutInfo()?.height || 600;
      const maxScrollTop = Math.max(1, e.scrollHeight - editorHeight);
      const ratio = Math.max(0, Math.min(1, e.scrollTop / maxScrollTop));
      setScrollRatioInfo({ ratio, timestamp: Date.now() });
    });

    // Obsidian / Standard Markdown Formatting Shortcuts
    const runMd = (type: MarkdownFormatType) => {
      handleApplyMdFormat(type);
    };

    // Cmd+B / Ctrl+B: Bold
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyB, () => runMd('bold'));
    // Cmd+I / Ctrl+I: Italic
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyI, () => runMd('italic'));
    // Cmd+Shift+X or Cmd+Shift+S: Strikethrough
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.KeyX, () => runMd('strikethrough'));
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.KeyS, () => runMd('strikethrough'));
    // Cmd+E: Inline Code
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyE, () => runMd('code'));
    // Cmd+Shift+C: Code Block
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.KeyC, () => runMd('codeblock'));
    // Cmd+K: Link
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyK, () => runMd('link'));
    // Cmd+Shift+H: Heading cycle
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.KeyH, () => runMd('heading'));
    // Cmd+1 ~ Cmd+6: Direct headings
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Digit1, () => runMd('heading-1'));
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Digit2, () => runMd('heading-2'));
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Digit3, () => runMd('heading-3'));
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Digit4, () => runMd('heading-4'));
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Digit5, () => runMd('heading-5'));
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Digit6, () => runMd('heading-6'));
    // Cmd+Shift+U or Cmd+Shift+8: Bullet List
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.KeyU, () => runMd('bullet'));
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.Digit8, () => runMd('bullet'));
    // Cmd+Shift+O or Cmd+Shift+7: Numbered List
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.KeyO, () => runMd('number'));
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.Digit7, () => runMd('number'));
    // Cmd+Shift+. or Cmd+Shift+9: Blockquote
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.Period, () => runMd('quote'));
    // Cmd+Enter / Ctrl+Enter: Checkbox / Task list toggle
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => {
      if (tab.language === 'markdown' || tab.name.endsWith('.md')) {
        runMd('task');
      }
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
      label: 'AI 인라인 작성 / 수정',
      icon: <Sparkles size={14} color="#a855f7" />,
      shortcut: isMac ? '⌥K' : 'Alt+K',
      onClick: handleOpenInlineAi,
    },
    {
      label: '선택 텍스트를 AI 입력창에 붙여넣기',
      icon: <Sparkles size={14} color="#38bdf8" />,
      shortcut: isMac ? '⌥A' : 'Alt+A',
      disabled: !hasSelection,
      onClick: handleAskAiWithSelection,
    },
    {
      label: 'AI 코드 스마트 삽입',
      icon: <Clipboard size={14} color="#38bdf8" />,
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

          {/* Quick Markdown Formatting Toolbar */}
          {isMarkdown && tab.viewMode !== 'preview' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '2px', marginLeft: '6px' }}>
              <div style={{ width: '1px', height: '14px', backgroundColor: isLight ? '#d4d4d8' : '#3f3f46', margin: '0 4px' }} />
              <button
                type="button"
                onClick={() => handleApplyMdFormat('bold')}
                title={`굵게 (${isMac ? '⌘B' : 'Ctrl+B'})`}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '3px 5px',
                  borderRadius: '4px',
                  border: 'none',
                  cursor: 'pointer',
                  backgroundColor: 'transparent',
                  color: isLight ? '#52525b' : '#a1a1aa',
                }}
              >
                <Bold size={12} />
              </button>
              <button
                type="button"
                onClick={() => handleApplyMdFormat('italic')}
                title={`기울임 (${isMac ? '⌘I' : 'Ctrl+I'})`}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '3px 5px',
                  borderRadius: '4px',
                  border: 'none',
                  cursor: 'pointer',
                  backgroundColor: 'transparent',
                  color: isLight ? '#52525b' : '#a1a1aa',
                }}
              >
                <Italic size={12} />
              </button>
              <button
                type="button"
                onClick={() => handleApplyMdFormat('strikethrough')}
                title={`취소선 (${isMac ? '⌘⇧X' : 'Ctrl+Shift+X'})`}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '3px 5px',
                  borderRadius: '4px',
                  border: 'none',
                  cursor: 'pointer',
                  backgroundColor: 'transparent',
                  color: isLight ? '#52525b' : '#a1a1aa',
                }}
              >
                <Strikethrough size={12} />
              </button>
              <button
                type="button"
                onClick={() => handleApplyMdFormat('heading')}
                title={`제목 H1~H3 순환 (${isMac ? '⌘⇧H' : 'Ctrl+Shift+H'})`}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '3px 5px',
                  borderRadius: '4px',
                  border: 'none',
                  cursor: 'pointer',
                  backgroundColor: 'transparent',
                  color: isLight ? '#52525b' : '#a1a1aa',
                }}
              >
                <Heading size={12} />
              </button>
              <button
                type="button"
                onClick={() => handleApplyMdFormat('code')}
                title={`인라인 코드 (${isMac ? '⌘E' : 'Ctrl+E'})`}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '3px 5px',
                  borderRadius: '4px',
                  border: 'none',
                  cursor: 'pointer',
                  backgroundColor: 'transparent',
                  color: isLight ? '#52525b' : '#a1a1aa',
                }}
              >
                <Code2 size={12} />
              </button>
              <button
                type="button"
                onClick={() => handleApplyMdFormat('link')}
                title={`링크 삽입 (${isMac ? '⌘K' : 'Ctrl+K'})`}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '3px 5px',
                  borderRadius: '4px',
                  border: 'none',
                  cursor: 'pointer',
                  backgroundColor: 'transparent',
                  color: isLight ? '#52525b' : '#a1a1aa',
                }}
              >
                <LinkIcon size={12} />
              </button>
              <button
                type="button"
                onClick={() => handleApplyMdFormat('bullet')}
                title={`글머리 기호 목록 (${isMac ? '⌘⇧U' : 'Ctrl+Shift+U'})`}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '3px 5px',
                  borderRadius: '4px',
                  border: 'none',
                  cursor: 'pointer',
                  backgroundColor: 'transparent',
                  color: isLight ? '#52525b' : '#a1a1aa',
                }}
              >
                <List size={12} />
              </button>
              <button
                type="button"
                onClick={() => handleApplyMdFormat('number')}
                title={`번호 매기기 목록 (${isMac ? '⌘⇧O' : 'Ctrl+Shift+O'})`}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '3px 5px',
                  borderRadius: '4px',
                  border: 'none',
                  cursor: 'pointer',
                  backgroundColor: 'transparent',
                  color: isLight ? '#52525b' : '#a1a1aa',
                }}
              >
                <ListOrdered size={12} />
              </button>
              <button
                type="button"
                onClick={() => handleApplyMdFormat('quote')}
                title={`인용구 (${isMac ? '⌘⇧.' : 'Ctrl+Shift+.'})`}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '3px 5px',
                  borderRadius: '4px',
                  border: 'none',
                  cursor: 'pointer',
                  backgroundColor: 'transparent',
                  color: isLight ? '#52525b' : '#a1a1aa',
                }}
              >
                <Quote size={12} />
              </button>
              <button
                type="button"
                onClick={() => handleApplyMdFormat('task')}
                title={`체크박스/할 일 (${isMac ? '⌘Enter' : 'Ctrl+Enter'})`}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '3px 5px',
                  borderRadius: '4px',
                  border: 'none',
                  cursor: 'pointer',
                  backgroundColor: 'transparent',
                  color: isLight ? '#52525b' : '#a1a1aa',
                }}
              >
                <CheckSquare2 size={12} />
              </button>
            </div>
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
            ref={editorContainerRef}
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

            {/* Floating Inline AI Widget (⌥K / Alt+K) */}
            <InlineAiWidget
              isOpen={inlineAiState.isOpen}
              isLight={isLight}
              position={inlineAiState.position}
              hasSelection={inlineAiState.hasSelection}
              selectedLineCount={inlineAiState.selectedLineCount}
              isLoading={inlineAiState.isLoading}
              statusText={inlineAiState.statusText}
              error={inlineAiState.error}
              onSubmit={handleSubmitInlineAi}
              onCancel={handleCancelInlineAi}
              onClose={handleCloseInlineAi}
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
            <MarkdownPreview
              content={tab.content}
              isLight={isLight}
              cursorLineInfo={cursorLineInfo}
              scrollRatioInfo={scrollRatioInfo}
            />
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
