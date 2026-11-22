import React from 'react';
import { TabItem } from '../types';
import { Terminal, Cpu, Settings, Sparkles } from 'lucide-react';

interface StatusBarProps {
  activeTab?: TabItem;
  paneCount: number;
  isLight?: boolean;
  onToggleTerminal: () => void;
  onToggleEncoding: () => void;
  onToggleLineEnding: () => void;
  onOpenSettings: () => void;
  onToggleAiAssistant?: () => void;
}

export const StatusBar: React.FC<StatusBarProps> = ({
  activeTab,
  paneCount,
  isLight = false,
  onToggleTerminal,
  onToggleEncoding,
  onToggleLineEnding,
  onOpenSettings,
  onToggleAiAssistant,
}) => {
  const lineCount = activeTab ? activeTab.content.split('\n').length : 0;
  const charCount = activeTab ? activeTab.content.length : 0;

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        height: '24px',
        backgroundColor: isLight ? '#f4f4f5' : '#18181b',
        borderTop: isLight ? '1px solid #e4e4e7' : '1px solid #27272a',
        padding: '0 12px',
        fontSize: '11px',
        color: isLight ? '#71717a' : '#a1a1aa',
        userSelect: 'none',
        gap: '16px',
      }}
    >
      {/* Engine Indicator */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#0284c7' }}>
        <Cpu size={12} />
        <span style={{ fontWeight: 600 }}>Rust 코어 (Tauri)</span>
      </div>

      {/* Pane Count */}
      <div>분할 패널: {paneCount}개</div>

      {/* Current File Path */}
      {activeTab && (
        <div
          style={{
            maxWidth: '380px',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            color: isLight ? '#4b5563' : '#9ca3af',
          }}
          title={activeTab.path ? `저장 위치: ${activeTab.path}` : '아직 디스크에 저장되지 않은 새 문서입니다.'}
        >
          {activeTab.path ? `📍 ${activeTab.path}` : '📍 (새 문서 - 저장 시 위치 지정)'}
        </div>
      )}

      <div style={{ flex: 1 }} />

      {activeTab && (
        <>
          <div>
            줄: {lineCount} | 글자: {charCount}
          </div>

          <div
            onClick={onToggleEncoding}
            style={{
              cursor: 'pointer',
              padding: '1px 6px',
              borderRadius: '3px',
              backgroundColor: isLight ? '#e4e4e7' : '#27272a',
              color: isLight ? '#18181b' : '#f4f4f5',
            }}
            title="클릭하여 인코딩 전환 (UTF-8 / EUC-KR)"
          >
            {activeTab.encoding}
          </div>

          <div
            onClick={onToggleLineEnding}
            style={{
              cursor: 'pointer',
              padding: '1px 6px',
              borderRadius: '3px',
              backgroundColor: isLight ? '#e4e4e7' : '#27272a',
              color: isLight ? '#18181b' : '#f4f4f5',
            }}
            title="클릭하여 줄바꿈 문자 전환 (LF / CRLF)"
          >
            {activeTab.lineEnding}
          </div>

          <div
            style={{
              color: '#0284c7',
              textTransform: 'capitalize',
              fontWeight: 500,
            }}
          >
            {activeTab.language}
          </div>
        </>
      )}

      {/* Quick Terminal Button */}
      <button
        onClick={onToggleTerminal}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '4px',
          border: 'none',
          background: 'transparent',
          color: isLight ? '#52525b' : '#a1a1aa',
          cursor: 'pointer',
          padding: '2px 4px',
          borderRadius: '3px',
        }}
        onMouseEnter={(e) => (e.currentTarget.style.color = '#0284c7')}
        onMouseLeave={(e) => (e.currentTarget.style.color = isLight ? '#52525b' : '#a1a1aa')}
      >
        <Terminal size={12} />
        <span>터미널</span>
      </button>

      {/* AI Assistant Button */}
      {onToggleAiAssistant && (
        <button
          onClick={onToggleAiAssistant}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            border: 'none',
            background: isLight ? '#e0f2fe' : '#0369a133',
            color: isLight ? '#0369a1' : '#38bdf8',
            cursor: 'pointer',
            padding: '2px 8px',
            borderRadius: '12px',
            fontWeight: 600,
            fontSize: '11px',
          }}
          title="AI 도우미 창 열기 / 닫기 (Gemini · ChatGPT · Claude) [⌘/Ctrl+⇧+A]"
        >
          <Sparkles size={12} color="#38bdf8" />
          <span>AI 도우미</span>
        </button>
      )}

      {/* Settings Button */}
      <button
        onClick={onOpenSettings}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '4px',
          border: 'none',
          background: 'transparent',
          color: isLight ? '#52525b' : '#a1a1aa',
          cursor: 'pointer',
          padding: '2px 4px',
          borderRadius: '3px',
        }}
        onMouseEnter={(e) => (e.currentTarget.style.color = '#0284c7')}
        onMouseLeave={(e) => (e.currentTarget.style.color = isLight ? '#52525b' : '#a1a1aa')}
        title="환경설정 (Cmd+,)"
      >
        <Settings size={12} />
        <span>설정</span>
      </button>
    </div>
  );
};
