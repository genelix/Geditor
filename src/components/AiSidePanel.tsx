import React, { useState, useEffect } from 'react';
import { EditorSettings } from '../types';
import {
  Sparkles,
  RotateCw,
  ExternalLink,
  X,
  ClipboardPaste,
  Building2,
  Globe,
} from 'lucide-react';

interface AiSidePanelProps {
  isOpen: boolean;
  isLight: boolean;
  width: number;
  settings: EditorSettings;
  activeService: 'gemini' | 'chatgpt' | 'claude' | 'enterprise';
  onChangeService: (service: 'gemini' | 'chatgpt' | 'claude' | 'enterprise') => void;
  onPasteSelectedToEditor: () => void;
  onReload: () => void;
  onPopOutToWindow: () => void;
  onClose: () => void;
  onWidthChange: (newWidth: number) => void;
  viewportRef: React.RefObject<HTMLDivElement | null>;
}

export const AiSidePanel: React.FC<AiSidePanelProps> = ({
  isOpen,
  isLight,
  width,
  settings,
  activeService,
  onChangeService,
  onPasteSelectedToEditor,
  onReload,
  onPopOutToWindow,
  onClose,
  onWidthChange,
  viewportRef,
}) => {
  const [isResizing, setIsResizing] = useState(false);

  // Resize handling
  useEffect(() => {
    if (!isResizing) return;

    const handleMouseMove = (e: MouseEvent) => {
      const newWidth = Math.max(340, Math.min(950, window.innerWidth - e.clientX));
      onWidthChange(newWidth);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing, onWidthChange]);

  if (!isOpen) return null;

  const hasEnterpriseUrl = Boolean(settings.aiUrls?.enterprise?.trim());

  return (
    <div
      style={{
        width: `${width}px`,
        height: '100%',
        display: 'flex',
        flexDirection: 'row',
        position: 'relative',
        flexShrink: 0,
        zIndex: 25,
      }}
    >
      {/* Draggable resize handle on left border */}
      <div
        onMouseDown={(e) => {
          e.preventDefault();
          setIsResizing(true);
        }}
        style={{
          width: '5px',
          height: '100%',
          cursor: 'col-resize',
          backgroundColor: isResizing ? '#38bdf8' : isLight ? '#e4e4e7' : '#27272a',
          transition: isResizing ? 'none' : 'background-color 0.15s',
          flexShrink: 0,
          zIndex: 30,
        }}
        onMouseEnter={(e) => {
          if (!isResizing) e.currentTarget.style.backgroundColor = '#38bdf8';
        }}
        onMouseLeave={(e) => {
          if (!isResizing)
            e.currentTarget.style.backgroundColor = isLight ? '#e4e4e7' : '#27272a';
        }}
        title="드래그하여 AI 사이드 패널 너비 조절"
      />

      {/* Main Panel Content */}
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          backgroundColor: isLight ? '#ffffff' : '#18181b',
          borderLeft: isLight ? '1px solid #e4e4e7' : '1px solid #27272a',
          overflow: 'hidden',
          height: '100%',
        }}
      >
        {/* Top Header / Toolbar */}
        <div
          style={{
            height: '38px',
            backgroundColor: isLight ? '#f4f4f5' : '#1f1f23',
            borderBottom: isLight ? '1px solid #e4e4e7' : '1px solid #27272a',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0 8px',
            fontSize: '12px',
            gap: '6px',
            flexShrink: 0,
            userSelect: 'none',
          }}
        >
          {/* Service Selector Tabs */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '3px', overflowX: 'auto' }}>
            <button
              onClick={() => onChangeService('gemini')}
              style={{
                padding: '4px 8px',
                borderRadius: '5px',
                border: 'none',
                backgroundColor: activeService === 'gemini' ? (isLight ? '#0284c7' : '#0284c7') : 'transparent',
                color: activeService === 'gemini' ? '#ffffff' : isLight ? '#52525b' : '#a1a1aa',
                fontSize: '11px',
                fontWeight: activeService === 'gemini' ? 600 : 500,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
              }}
              title="Google Gemini 열기"
            >
              <Sparkles size={12} />
              Gemini
            </button>

            <button
              onClick={() => onChangeService('chatgpt')}
              style={{
                padding: '4px 8px',
                borderRadius: '5px',
                border: 'none',
                backgroundColor: activeService === 'chatgpt' ? (isLight ? '#0284c7' : '#0284c7') : 'transparent',
                color: activeService === 'chatgpt' ? '#ffffff' : isLight ? '#52525b' : '#a1a1aa',
                fontSize: '11px',
                fontWeight: activeService === 'chatgpt' ? 600 : 500,
                cursor: 'pointer',
              }}
              title="ChatGPT (Codex) 열기"
            >
              ChatGPT
            </button>

            <button
              onClick={() => onChangeService('claude')}
              style={{
                padding: '4px 8px',
                borderRadius: '5px',
                border: 'none',
                backgroundColor: activeService === 'claude' ? (isLight ? '#0284c7' : '#0284c7') : 'transparent',
                color: activeService === 'claude' ? '#ffffff' : isLight ? '#52525b' : '#a1a1aa',
                fontSize: '11px',
                fontWeight: activeService === 'claude' ? 600 : 500,
                cursor: 'pointer',
              }}
              title="Anthropic Claude 열기"
            >
              Claude
            </button>

            {hasEnterpriseUrl && (
              <button
                onClick={() => onChangeService('enterprise')}
                style={{
                  padding: '4px 8px',
                  borderRadius: '5px',
                  border: 'none',
                  backgroundColor: activeService === 'enterprise' ? (isLight ? '#0284c7' : '#0284c7') : 'transparent',
                  color: activeService === 'enterprise' ? '#ffffff' : isLight ? '#52525b' : '#a1a1aa',
                  fontSize: '11px',
                  fontWeight: activeService === 'enterprise' ? 600 : 500,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                }}
                title={`사내 엔터프라이즈 AI 열기 (${settings.aiUrls?.enterprise})`}
              >
                <Building2 size={12} />
                사내 AI
              </button>
            )}
          </div>

          {/* Action Buttons */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
            {/* "선택영역 본문붙혀넣기" 버튼 */}
            <button
              onMouseDown={(e) => {
                // 버튼 클릭 시 웹뷰의 포커스 이탈 및 텍스트 선택 해제 방지
                e.preventDefault();
              }}
              onClick={onPasteSelectedToEditor}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                padding: '4px 9px',
                borderRadius: '5px',
                border: isLight ? '1px solid #bae6fd' : '1px solid rgba(56, 189, 248, 0.4)',
                backgroundColor: isLight ? '#f0f9ff' : 'rgba(56, 189, 248, 0.15)',
                color: isLight ? '#0369a1' : '#38bdf8',
                fontSize: '11px',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
              title="AI 창에서 드래그하여 선택한 텍스트 또는 코드를 에디터 커서 위치에 바로 붙여넣습니다"
            >
              <ClipboardPaste size={13} />
              <span>선택영역 본문붙혀넣기</span>
            </button>

            {/* 새로고침 */}
            <button
              onClick={onReload}
              style={{
                background: 'transparent',
                border: 'none',
                color: isLight ? '#71717a' : '#a1a1aa',
                cursor: 'pointer',
                padding: '4px',
                borderRadius: '4px',
                display: 'flex',
                alignItems: 'center',
              }}
              title="AI 페이지 새로고침"
            >
              <RotateCw size={13} />
            </button>

            {/* 새 창으로 분리 */}
            <button
              onClick={onPopOutToWindow}
              style={{
                background: 'transparent',
                border: 'none',
                color: isLight ? '#71717a' : '#a1a1aa',
                cursor: 'pointer',
                padding: '4px',
                borderRadius: '4px',
                display: 'flex',
                alignItems: 'center',
              }}
              title="독립 창으로 분리하여 열기"
            >
              <ExternalLink size={13} />
            </button>

            {/* 패널 닫기 */}
            <button
              onClick={onClose}
              style={{
                background: 'transparent',
                border: 'none',
                color: isLight ? '#71717a' : '#a1a1aa',
                cursor: 'pointer',
                padding: '4px',
                borderRadius: '4px',
                display: 'flex',
                alignItems: 'center',
              }}
              title="AI 패널 닫기"
            >
              <X size={14} />
            </button>
          </div>
        </div>

        {/* Webview Mounting Viewport */}
        <div
          ref={viewportRef}
          style={{
            flex: 1,
            width: '100%',
            height: 'calc(100% - 38px)',
            position: 'relative',
            backgroundColor: isLight ? '#fafafa' : '#141416',
          }}
        >
          {/* Subtle placeholder behind the native child webview */}
          <div
            style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              textAlign: 'center',
              color: isLight ? '#a1a1aa' : '#52525b',
              fontSize: '12px',
              pointerEvents: 'none',
            }}
          >
            <Globe size={24} style={{ marginBottom: '8px', opacity: 0.5 }} />
            <div>AI 서비스 로딩 중...</div>
          </div>
        </div>
      </div>
    </div>
  );
};
