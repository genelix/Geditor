import React, { useState, useEffect, useRef } from 'react';
import { Sparkles, Loader2, X, CornerDownLeft, AlertCircle, Wand2 } from 'lucide-react';

export interface InlineAiWidgetProps {
  isOpen: boolean;
  isLight: boolean;
  position: { top: number; left: number };
  hasSelection: boolean;
  selectedLineCount: number;
  isLoading: boolean;
  statusText: string;
  error: string | null;
  onSubmit: (prompt: string) => void;
  onCancel: () => void;
  onClose: () => void;
}

export const InlineAiWidget: React.FC<InlineAiWidgetProps> = ({
  isOpen,
  isLight,
  position,
  hasSelection,
  selectedLineCount,
  isLoading,
  statusText,
  error,
  onSubmit,
  onCancel,
  onClose,
}) => {
  const [prompt, setPrompt] = useState('');
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);

  // Focus input whenever widget opens
  useEffect(() => {
    if (isOpen) {
      setPrompt('');
      setElapsedSeconds(0);
      const timer = setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  // Elapsed time counter while loading
  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | null = null;
    if (isLoading) {
      setElapsedSeconds(0);
      const start = Date.now();
      timer = setInterval(() => {
        setElapsedSeconds(Math.round(((Date.now() - start) / 1000) * 10) / 10);
      }, 100);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [isLoading]);

  if (!isOpen) return null;

  const quickChips = hasSelection
    ? [
        { label: '🇰🇷 한국어 번역', text: '위 내용을 한국어로 자연스럽고 정확하게 번역해줘.' },
        { label: '✨ 문장 다듬기', text: '위 문장의 문법과 표현을 매끄럽고 명확하게 교정/다듬어줘.' },
        { label: '📊 표로 정리', text: '위 내용의 핵심 데이터를 알기 쉽게 GitHub Flavored Markdown 표(Table)로 정리해줘.' },
        { label: '📝 요약하기', text: '위 내용의 핵심 요점을 3~5개의 불릿포인트로 간결하게 요약해줘.' },
        { label: '💡 설명 주석 추가', text: '위 코드의 핵심 로직에 대한 상세한 한글 주석을 추가해줘.' },
      ]
    : [
        { label: '📝 마크다운 개요', text: '보고서 작성에 적합한 계층적 마크다운 개요 템플릿을 작성해줘.' },
        { label: '📊 데이터 표 생성', text: '예시 항목과 수치가 포함된 4열 5행의 마크다운 표를 생성해줘.' },
        { label: '⚡️ 파이썬 함수', text: '견고하고 타입 힌트와 예외 처리가 포함된 파이썬 함수 예제를 작성해줘.' },
        { label: '📋 할 일 목록', text: '체크박스(- [ ]) 형식의 단계별 실행 계획 체크리스트를 작성해줘.' },
      ];

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      if (isLoading) {
        onCancel();
      } else {
        onClose();
      }
      return;
    }

    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (prompt.trim() && !isLoading) {
        onSubmit(prompt.trim());
      }
    }
  };

  const handleChipClick = (chipPrompt: string) => {
    setPrompt(chipPrompt);
    if (!isLoading) {
      onSubmit(chipPrompt);
    }
  };

  // Adjust container position so it never overflows editor bounds
  const clampedTop = Math.max(16, position.top);
  const clampedLeft = Math.max(16, Math.min(position.left, window.innerWidth - 560));

  return (
    <div
      style={{
        position: 'absolute',
        top: `${clampedTop}px`,
        left: `${clampedLeft}px`,
        width: '520px',
        maxWidth: 'calc(100vw - 32px)',
        zIndex: 100,
        backgroundColor: isLight ? '#ffffff' : '#1e1e24',
        borderRadius: '10px',
        boxShadow: isLight
          ? '0 10px 25px -5px rgba(0, 0, 0, 0.15), 0 8px 10px -6px rgba(0, 0, 0, 0.1), 0 0 0 1px #e4e4e7'
          : '0 12px 28px -5px rgba(0, 0, 0, 0.6), 0 8px 12px -6px rgba(0, 0, 0, 0.4), 0 0 0 1px #3f3f46',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        fontFamily: 'system-ui, -apple-system, sans-serif',
        userSelect: 'none',
        animation: 'geditorFadeIn 0.15s ease-out',
      }}
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '8px 12px',
          backgroundColor: isLight ? '#f8fafc' : '#18181b',
          borderBottom: isLight ? '1px solid #e2e8f0' : '1px solid #27272a',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Sparkles size={15} color="#8b5cf6" />
          <span style={{ fontSize: '13px', fontWeight: 600, color: isLight ? '#0f172a' : '#f1f5f9' }}>
            AI 인라인 작성 / 수정
          </span>
          <span
            style={{
              fontSize: '11px',
              padding: '2px 7px',
              borderRadius: '999px',
              backgroundColor: hasSelection
                ? isLight
                  ? '#ede9fe'
                  : 'rgba(139, 92, 246, 0.2)'
                : isLight
                ? '#e0f2fe'
                : 'rgba(56, 189, 248, 0.2)',
              color: hasSelection ? (isLight ? '#6d28d9' : '#c4b5fd') : isLight ? '#0369a1' : '#7dd3fc',
              fontWeight: 500,
            }}
          >
            {hasSelection ? `선택 영역: ${selectedLineCount}줄 (대체)` : '커서 위치에 삽입'}
          </span>
        </div>

        <button
          onClick={isLoading ? onCancel : onClose}
          style={{
            background: 'none',
            border: 'none',
            color: isLight ? '#94a3b8' : '#71717a',
            cursor: 'pointer',
            padding: '2px 4px',
            borderRadius: '4px',
            display: 'flex',
            alignItems: 'center',
          }}
          title={isLoading ? '작성 취소 (Esc)' : '닫기 (Esc)'}
        >
          <X size={15} />
        </button>
      </div>

      {/* Quick Action Chips */}
      {!isLoading && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '8px 12px',
            overflowX: 'auto',
            backgroundColor: isLight ? '#ffffff' : '#1e1e24',
            borderBottom: isLight ? '1px solid #f1f5f9' : '1px solid #27272a',
          }}
        >
          {quickChips.map((chip, idx) => (
            <button
              key={idx}
              onClick={() => handleChipClick(chip.text)}
              style={{
                fontSize: '11px',
                padding: '3px 8px',
                borderRadius: '6px',
                border: isLight ? '1px solid #e2e8f0' : '1px solid #3f3f46',
                backgroundColor: isLight ? '#f8fafc' : '#27272a',
                color: isLight ? '#334155' : '#cbd5e1',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                transition: 'all 0.12s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = '#8b5cf6';
                e.currentTarget.style.color = '#8b5cf6';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = isLight ? '#e2e8f0' : '#3f3f46';
                e.currentTarget.style.color = isLight ? '#334155' : '#cbd5e1';
              }}
            >
              {chip.label}
            </button>
          ))}
        </div>
      )}

      {/* Main Input or Loading Status */}
      <div style={{ padding: '10px 12px' }}>
        {isLoading ? (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '24px 16px',
              gap: '12px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Loader2 size={20} color="#8b5cf6" style={{ animation: 'spin 1s linear infinite' }} />
              <span style={{ fontSize: '13px', fontWeight: 500, color: isLight ? '#0f172a' : '#f1f5f9' }}>
                {statusText || 'AI가 본문 내용을 생성 중입니다...'}
              </span>
            </div>
            <div style={{ fontSize: '11px', color: isLight ? '#64748b' : '#94a3b8' }}>
              경과 시간: {elapsedSeconds}초 · 실시간 웹뷰 스트리밍 감지 중
            </div>
            <button
              onClick={onCancel}
              style={{
                marginTop: '4px',
                padding: '4px 12px',
                borderRadius: '6px',
                border: isLight ? '1px solid #cbd5e1' : '1px solid #475569',
                backgroundColor: 'transparent',
                color: isLight ? '#475569' : '#cbd5e1',
                fontSize: '11px',
                cursor: 'pointer',
              }}
            >
              생성 취소 (Esc)
            </button>
          </div>
        ) : (
          <div>
            <textarea
              ref={inputRef}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={
                hasSelection
                  ? '선택된 영역에 대해 AI가 수행할 작업을 입력하세요... (예: 한국어로 번역해줘, 표 형식으로 정리해줘)'
                  : '커서 위치에 AI가 작성할 내용을 입력하세요... (예: 파이썬 웹 스크래핑 함수 작성해줘, 회의록 템플릿 생성해줘)'
              }
              rows={3}
              style={{
                width: '100%',
                boxSizing: 'border-box',
                border: 'none',
                outline: 'none',
                resize: 'none',
                backgroundColor: 'transparent',
                color: isLight ? '#0f172a' : '#f1f5f9',
                fontSize: '13px',
                lineHeight: '1.5',
                fontFamily: 'inherit',
              }}
            />

            {error && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  marginTop: '6px',
                  padding: '6px 8px',
                  borderRadius: '6px',
                  backgroundColor: isLight ? '#fef2f2' : 'rgba(239, 68, 68, 0.15)',
                  color: isLight ? '#b91c1c' : '#f87171',
                  fontSize: '12px',
                }}
              >
                <AlertCircle size={14} />
                <span>{error}</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer Actions */}
      {!isLoading && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '8px 12px',
            backgroundColor: isLight ? '#f8fafc' : '#18181b',
            borderTop: isLight ? '1px solid #e2e8f0' : '1px solid #27272a',
            fontSize: '11px',
            color: isLight ? '#64748b' : '#94a3b8',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span>실행: ↵ Enter</span>
            <span>·</span>
            <span>줄바꿈: ⇧↵</span>
            <span>·</span>
            <span>취소: Esc</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <button
              onClick={onClose}
              style={{
                padding: '4px 10px',
                borderRadius: '6px',
                border: 'none',
                backgroundColor: 'transparent',
                color: isLight ? '#64748b' : '#94a3b8',
                cursor: 'pointer',
                fontSize: '11px',
              }}
            >
              취소
            </button>
            <button
              disabled={!prompt.trim() || isLoading}
              onClick={() => {
                if (prompt.trim()) {
                  onSubmit(prompt.trim());
                }
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                padding: '5px 12px',
                borderRadius: '6px',
                border: 'none',
                backgroundColor: prompt.trim() ? '#8b5cf6' : isLight ? '#e2e8f0' : '#27272a',
                color: prompt.trim() ? '#ffffff' : isLight ? '#94a3b8' : '#71717a',
                fontWeight: 600,
                fontSize: '12px',
                cursor: prompt.trim() ? 'pointer' : 'default',
                transition: 'all 0.15s ease',
              }}
            >
              <Wand2 size={13} />
              <span>생성 실행</span>
              <CornerDownLeft size={11} style={{ opacity: 0.8 }} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
