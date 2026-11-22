import React, { useState, useRef, useEffect } from 'react';
import { EditorSettings } from '../types';
import {
  FileText,
  Save,
  X,
  Columns,
  Rows,
  Terminal,
  Settings,
  Sun,
  Moon,
  Sparkles,
  HelpCircle,
  FolderTree,
  Folder,
  Pin,
  Zap,
  Brain,
  ClipboardPaste,
} from 'lucide-react';

interface TopMenuBarProps {
  isLight: boolean;
  settings: EditorSettings;
  onNewFile: () => void;
  onOpenFilePrompt?: () => void;
  onOpenFolderPrompt?: () => void;
  onSaveFile: () => void;
  onSaveAsFile?: () => void;
  onCloseTab: () => void;
  onToggleSidebar: () => void;
  onSplitRight: () => void;
  onSplitDown: () => void;
  onOpenTerminal: () => void;
  onOpenSettings: () => void;
  onUpdateSettings: (settings: EditorSettings) => void;
  onOpenPreviewSplit?: () => void;
  onOpenAiAssistant?: (service: 'gemini' | 'chatgpt' | 'claude') => void;
  onToggleAiAssistant?: () => void;
  onSnapAiAssistant?: () => void;
  onToggleAiAlwaysOnTop?: () => void;
  isAiAlwaysOnTop?: boolean;
  onSmartInsertAiCode?: () => void;
}

type MenuKey = 'file' | 'edit' | 'view' | 'ai' | 'settings' | 'help' | null;

export const TopMenuBar: React.FC<TopMenuBarProps> = ({
  isLight,
  settings,
  onNewFile,
  onOpenFilePrompt,
  onOpenFolderPrompt,
  onSaveFile,
  onSaveAsFile,
  onCloseTab,
  onToggleSidebar,
  onSplitRight,
  onSplitDown,
  onOpenTerminal,
  onOpenSettings,
  onUpdateSettings,
  onOpenPreviewSplit,
  onOpenAiAssistant,
  onToggleAiAssistant,
  onSnapAiAssistant,
  onToggleAiAlwaysOnTop,
  isAiAlwaysOnTop = false,
  onSmartInsertAiCode,
}) => {
  const [openMenu, setOpenMenu] = useState<MenuKey>(null);
  const menuBarRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (menuBarRef.current && !menuBarRef.current.contains(e.target as Node)) {
        setOpenMenu(null);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpenMenu(null);
      }
    };

    window.addEventListener('mousedown', handleOutsideClick);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('mousedown', handleOutsideClick);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  const handleMenuClick = (key: MenuKey) => {
    setOpenMenu((prev) => (prev === key ? null : key));
  };

  const handleMenuHover = (key: MenuKey) => {
    if (openMenu !== null) {
      setOpenMenu(key);
    }
  };

  const executeAction = (action: () => void) => {
    setOpenMenu(null);
    action();
  };

  const menuButtonBaseStyle: React.CSSProperties = {
    background: 'transparent',
    border: 'none',
    fontSize: '12px',
    padding: '3px 8px',
    borderRadius: '4px',
    cursor: 'pointer',
    color: isLight ? '#27272a' : '#e4e4e7',
    fontWeight: 500,
  };

  const dropdownContainerStyle: React.CSSProperties = {
    position: 'absolute',
    top: '100%',
    left: 0,
    backgroundColor: isLight ? '#ffffff' : '#1e1e24',
    border: isLight ? '1px solid #d4d4d8' : '1px solid #3f3f46',
    borderRadius: '6px',
    boxShadow: '0 8px 24px rgba(0, 0, 0, 0.3)',
    minWidth: '220px',
    padding: '4px',
    zIndex: 9999,
    fontSize: '12px',
  };

  const dropdownItemStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '6px 10px',
    borderRadius: '4px',
    cursor: 'pointer',
    color: isLight ? '#18181b' : '#f4f4f5',
    userSelect: 'none',
  };

  const shortcutStyle: React.CSSProperties = {
    fontSize: '11px',
    color: isLight ? '#71717a' : '#a1a1aa',
    marginLeft: '16px',
  };

  const separatorStyle: React.CSSProperties = {
    height: '1px',
    backgroundColor: isLight ? '#e4e4e7' : '#2e2e34',
    margin: '4px 0',
  };

  return (
    <div
      ref={menuBarRef}
      style={{
        display: 'flex',
        alignItems: 'center',
        height: '27px',
        backgroundColor: isLight ? '#ececed' : '#1a1a1d',
        borderBottom: isLight ? '1px solid #d4d4d8' : '1px solid #27272a',
        padding: '0 8px',
        userSelect: 'none',
        fontSize: '12px',
        position: 'relative',
        zIndex: 500,
      }}
    >
      {/* 1. 파일 (File) */}
      <div style={{ position: 'relative' }}>
        <button
          onClick={() => handleMenuClick('file')}
          onMouseEnter={() => handleMenuHover('file')}
          style={{
            ...menuButtonBaseStyle,
            backgroundColor: openMenu === 'file' ? (isLight ? '#d4d4d8' : '#2e2e34') : 'transparent',
          }}
        >
          파일
        </button>
        {openMenu === 'file' && (
          <div style={dropdownContainerStyle}>
            <div
              style={dropdownItemStyle}
              onClick={() => executeAction(onNewFile)}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = isLight ? '#f4f4f5' : '#2e2e34')}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <FileText size={14} />
                <span>새 파일</span>
              </div>
              <span style={shortcutStyle}>⌘N</span>
            </div>

            {onOpenFilePrompt && (
              <div
                style={dropdownItemStyle}
                onClick={() => executeAction(onOpenFilePrompt)}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = isLight ? '#f4f4f5' : '#2e2e34')}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <FolderTree size={14} />
                  <span>파일 열기...</span>
                </div>
                <span style={shortcutStyle}>⌘O</span>
              </div>
            )}

            {onOpenFolderPrompt && (
              <div
                style={dropdownItemStyle}
                onClick={() => executeAction(onOpenFolderPrompt)}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = isLight ? '#f4f4f5' : '#2e2e34')}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Folder size={14} />
                  <span>폴더 열기...</span>
                </div>
                <span style={shortcutStyle}>⇧⌘O</span>
              </div>
            )}

            <div
              style={dropdownItemStyle}
              onClick={() => executeAction(onSaveFile)}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = isLight ? '#f4f4f5' : '#2e2e34')}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Save size={14} />
                <span>저장</span>
              </div>
              <span style={shortcutStyle}>⌘S</span>
            </div>

            {onSaveAsFile && (
              <div
                style={dropdownItemStyle}
                onClick={() => executeAction(onSaveAsFile)}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = isLight ? '#f4f4f5' : '#2e2e34')}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Save size={14} />
                  <span>다른 이름으로 저장...</span>
                </div>
                <span style={shortcutStyle}>⇧⌘S</span>
              </div>
            )}

            <div style={separatorStyle} />

            <div
              style={dropdownItemStyle}
              onClick={() => executeAction(onCloseTab)}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = isLight ? '#f4f4f5' : '#2e2e34')}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <X size={14} />
                <span>탭 / 창 닫기</span>
              </div>
              <span style={shortcutStyle}>⌘W</span>
            </div>
          </div>
        )}
      </div>

      {/* 2. 편집 (Edit) */}
      <div style={{ position: 'relative' }}>
        <button
          onClick={() => handleMenuClick('edit')}
          onMouseEnter={() => handleMenuHover('edit')}
          style={{
            ...menuButtonBaseStyle,
            backgroundColor: openMenu === 'edit' ? (isLight ? '#d4d4d8' : '#2e2e34') : 'transparent',
          }}
        >
          편집
        </button>
        {openMenu === 'edit' && (
          <div style={dropdownContainerStyle}>
            <div
              style={dropdownItemStyle}
              onClick={() => executeAction(() => document.execCommand('undo'))}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = isLight ? '#f4f4f5' : '#2e2e34')}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
            >
              <span>실행 취소 (Undo)</span>
              <span style={shortcutStyle}>⌘Z</span>
            </div>
            <div
              style={dropdownItemStyle}
              onClick={() => executeAction(() => document.execCommand('redo'))}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = isLight ? '#f4f4f5' : '#2e2e34')}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
            >
              <span>다시 실행 (Redo)</span>
              <span style={shortcutStyle}>⇧⌘Z</span>
            </div>

            <div style={separatorStyle} />

            <div
              style={dropdownItemStyle}
              onClick={() => executeAction(() => document.execCommand('selectAll'))}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = isLight ? '#f4f4f5' : '#2e2e34')}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
            >
              <span>모두 선택</span>
              <span style={shortcutStyle}>⌘A</span>
            </div>
          </div>
        )}
      </div>

      {/* 3. 보기 (View) */}
      <div style={{ position: 'relative' }}>
        <button
          onClick={() => handleMenuClick('view')}
          onMouseEnter={() => handleMenuHover('view')}
          style={{
            ...menuButtonBaseStyle,
            backgroundColor: openMenu === 'view' ? (isLight ? '#d4d4d8' : '#2e2e34') : 'transparent',
          }}
        >
          보기
        </button>
        {openMenu === 'view' && (
          <div style={dropdownContainerStyle}>
            <div
              style={dropdownItemStyle}
              onClick={() => executeAction(onToggleSidebar)}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = isLight ? '#f4f4f5' : '#2e2e34')}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <FolderTree size={14} />
                <span>탐색기 표시 / 숨기기</span>
              </div>
              <span style={shortcutStyle}>⌘B</span>
            </div>

            <div style={separatorStyle} />

            {onOpenPreviewSplit && (
              <div
                style={dropdownItemStyle}
                onClick={() => executeAction(onOpenPreviewSplit)}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = isLight ? '#f4f4f5' : '#2e2e34')}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Columns size={14} color="#0284c7" />
                  <span style={{ fontWeight: 600, color: '#0284c7' }}>실시간 미리보기 패널 분할 (코드 | 렌더링)</span>
                </div>
                <span style={shortcutStyle}>⇧⌘V</span>
              </div>
            )}

            <div
              style={dropdownItemStyle}
              onClick={() => executeAction(onSplitRight)}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = isLight ? '#f4f4f5' : '#2e2e34')}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Columns size={14} />
                <span>화면 우측으로 분할</span>
              </div>
              <span style={shortcutStyle}>⌘\</span>
            </div>

            <div
              style={dropdownItemStyle}
              onClick={() => executeAction(onSplitDown)}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = isLight ? '#f4f4f5' : '#2e2e34')}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Rows size={14} />
                <span>화면 하단으로 분할</span>
              </div>
            </div>

            <div
              style={dropdownItemStyle}
              onClick={() => executeAction(onOpenTerminal)}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = isLight ? '#f4f4f5' : '#2e2e34')}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Terminal size={14} />
                <span>내장 터미널 (zsh) 추가</span>
              </div>
              <span style={shortcutStyle}>⌘T</span>
            </div>
          </div>
        )}
      </div>

      {/* 4. AI 도우미 (AI Assistant) */}
      <div style={{ position: 'relative' }}>
        <button
          onClick={() => handleMenuClick('ai')}
          onMouseEnter={() => handleMenuHover('ai')}
          style={{
            ...menuButtonBaseStyle,
            backgroundColor: openMenu === 'ai' ? (isLight ? '#d4d4d8' : '#2e2e34') : 'transparent',
            color: '#38bdf8',
            fontWeight: 600,
          }}
        >
          🤖 AI 도우미
        </button>
        {openMenu === 'ai' && (
          <div style={{ ...dropdownContainerStyle, width: '270px' }}>
            <div
              style={dropdownItemStyle}
              onClick={() => executeAction(() => onToggleAiAssistant?.())}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = isLight ? '#f4f4f5' : '#2e2e34')}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Sparkles size={14} color="#38bdf8" />
                <span>AI 도우미 열기 / 닫기</span>
              </div>
              <span style={shortcutStyle}>⌘/Ctrl+⇧+A</span>
            </div>

            <div style={separatorStyle} />

            <div
              style={dropdownItemStyle}
              onClick={() => executeAction(() => onOpenAiAssistant?.('gemini'))}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = isLight ? '#f4f4f5' : '#2e2e34')}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Sparkles size={14} color="#38bdf8" />
                <span>Google Gemini 열기</span>
              </div>
              <span style={{ fontSize: '10px', color: '#38bdf8', fontWeight: 500 }}>웹인증</span>
            </div>

            <div
              style={dropdownItemStyle}
              onClick={() => executeAction(() => onOpenAiAssistant?.('chatgpt'))}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = isLight ? '#f4f4f5' : '#2e2e34')}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Zap size={14} color="#10b981" />
                <span>ChatGPT (Codex) 열기</span>
              </div>
              <span style={{ fontSize: '10px', color: '#10b981', fontWeight: 500 }}>웹인증</span>
            </div>

            <div
              style={dropdownItemStyle}
              onClick={() => executeAction(() => onOpenAiAssistant?.('claude'))}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = isLight ? '#f4f4f5' : '#2e2e34')}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Brain size={14} color="#d97706" />
                <span>Anthropic Claude 열기</span>
              </div>
              <span style={{ fontSize: '10px', color: '#d97706', fontWeight: 500 }}>웹인증</span>
            </div>

            <div style={separatorStyle} />

            <div
              style={dropdownItemStyle}
              onClick={() => executeAction(() => onSnapAiAssistant?.())}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = isLight ? '#f4f4f5' : '#2e2e34')}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Columns size={14} />
                <span>에디터 우측에 나란히 붙이기</span>
              </div>
              <span style={shortcutStyle}>Snap</span>
            </div>

            <div
              style={dropdownItemStyle}
              onClick={() => executeAction(() => onToggleAiAlwaysOnTop?.())}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = isLight ? '#f4f4f5' : '#2e2e34')}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Pin size={14} color={isAiAlwaysOnTop ? '#38bdf8' : undefined} />
                <span>항상 위에 고정 {isAiAlwaysOnTop ? '(켜짐)' : '(꺼짐)'}</span>
              </div>
              {isAiAlwaysOnTop && <span style={{ color: '#38bdf8' }}>✓</span>}
            </div>

            <div style={separatorStyle} />

            <div
              style={{
                ...dropdownItemStyle,
                color: '#38bdf8',
                fontWeight: 600,
              }}
              onClick={() => executeAction(() => onSmartInsertAiCode?.())}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = isLight ? '#f4f4f5' : '#2e2e34')}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <ClipboardPaste size={14} color="#38bdf8" />
                <span>AI 코드 스마트 삽입</span>
              </div>
              <span style={shortcutStyle}>⌥V / Alt+V</span>
            </div>
          </div>
        )}
      </div>

      {/* 5. 설정 (Settings / Preferences) */}
      <div style={{ position: 'relative' }}>
        <button
          onClick={() => handleMenuClick('settings')}
          onMouseEnter={() => handleMenuHover('settings')}
          style={{
            ...menuButtonBaseStyle,
            backgroundColor: openMenu === 'settings' ? (isLight ? '#d4d4d8' : '#2e2e34') : 'transparent',
            color: '#0284c7',
            fontWeight: 600,
          }}
        >
          설정
        </button>
        {openMenu === 'settings' && (
          <div style={dropdownContainerStyle}>
            <div
              style={{
                ...dropdownItemStyle,
                color: '#38bdf8',
                fontWeight: 600,
              }}
              onClick={() => executeAction(onOpenSettings)}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = isLight ? '#f4f4f5' : '#2e2e34')}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Settings size={14} />
                <span>환경설정 열기 (Preferences)...</span>
              </div>
              <span style={shortcutStyle}>⌘,</span>
            </div>

            <div style={separatorStyle} />

            <div
              style={dropdownItemStyle}
              onClick={() => executeAction(() => onUpdateSettings({ ...settings, theme: 'vs-dark' }))}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = isLight ? '#f4f4f5' : '#2e2e34')}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Moon size={14} />
                <span>다크 테마 (VS Dark)</span>
              </div>
              {settings.theme === 'vs-dark' && <span style={{ color: '#38bdf8' }}>✓</span>}
            </div>

            <div
              style={dropdownItemStyle}
              onClick={() => executeAction(() => onUpdateSettings({ ...settings, theme: 'vs' }))}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = isLight ? '#f4f4f5' : '#2e2e34')}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Sun size={14} />
                <span>라이트 테마 (VS Light)</span>
              </div>
              {settings.theme === 'vs' && <span style={{ color: '#38bdf8' }}>✓</span>}
            </div>

            <div
              style={dropdownItemStyle}
              onClick={() => executeAction(() => onUpdateSettings({ ...settings, theme: 'hc-black' }))}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = isLight ? '#f4f4f5' : '#2e2e34')}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Sparkles size={14} />
                <span>고대비 블랙 테마 (High Contrast)</span>
              </div>
              {settings.theme === 'hc-black' && <span style={{ color: '#38bdf8' }}>✓</span>}
            </div>

            <div style={separatorStyle} />

            <div
              style={dropdownItemStyle}
              onClick={() =>
                executeAction(() =>
                  onUpdateSettings({ ...settings, wordWrap: settings.wordWrap === 'on' ? 'off' : 'on' })
                )
              }
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = isLight ? '#f4f4f5' : '#2e2e34')}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
            >
              <span>자동 줄바꿈 (Word Wrap)</span>
              <span style={{ color: settings.wordWrap === 'on' ? '#38bdf8' : '#71717a' }}>
                {settings.wordWrap === 'on' ? '켜짐 ✓' : '꺼짐'}
              </span>
            </div>

            <div
              style={dropdownItemStyle}
              onClick={() =>
                executeAction(() => onUpdateSettings({ ...settings, showMinimap: !settings.showMinimap }))
              }
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = isLight ? '#f4f4f5' : '#2e2e34')}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
            >
              <span>미니맵 표시 (Minimap)</span>
              <span style={{ color: settings.showMinimap ? '#38bdf8' : '#71717a' }}>
                {settings.showMinimap ? '켜짐 ✓' : '꺼짐'}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* 5. 도움말 (Help) */}
      <div style={{ position: 'relative' }}>
        <button
          onClick={() => handleMenuClick('help')}
          onMouseEnter={() => handleMenuHover('help')}
          style={{
            ...menuButtonBaseStyle,
            backgroundColor: openMenu === 'help' ? (isLight ? '#d4d4d8' : '#2e2e34') : 'transparent',
          }}
        >
          도움말
        </button>
        {openMenu === 'help' && (
          <div style={dropdownContainerStyle}>
            <div
              style={dropdownItemStyle}
              onClick={() =>
                executeAction(() => {
                  alert(
                    'Geditor v0.1.0\n\n' +
                      '고성능 Rust 코어 기반 경량 텍스트 에디터\n\n' +
                      '단축키 안내:\n' +
                      '• Cmd+S: 파일 저장\n' +
                      '• Cmd+N: 새 파일 생성\n' +
                      '• Cmd+W: 탭 / 패널 닫기\n' +
                      '• Cmd+B: 탐색기 토글\n' +
                      '• Cmd+\\: 우측 화면 분할\n' +
                      '• Cmd+T: 내장 터미널 열기\n' +
                      '• Cmd+,: 환경설정 열기'
                  );
                })
              }
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = isLight ? '#f4f4f5' : '#2e2e34')}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <HelpCircle size={14} />
                <span>Geditor 정보 및 단축키 안내</span>
              </div>
            </div>
          </div>
        )}
      </div>

      <div style={{ flex: 1 }} />

      {/* Quick Settings Shortcut button on the right of the menu bar */}
      <button
        onClick={onOpenSettings}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '5px',
          border: 'none',
          background: isLight ? '#d4d4d8' : '#27272a',
          color: isLight ? '#18181b' : '#f4f4f5',
          borderRadius: '4px',
          padding: '2px 8px',
          fontSize: '11px',
          cursor: 'pointer',
          fontWeight: 500,
        }}
        title="환경설정 열기 (Cmd+,)"
      >
        <Settings size={12} color="#0284c7" />
        <span>환경설정 (Cmd+,)</span>
      </button>
    </div>
  );
};
