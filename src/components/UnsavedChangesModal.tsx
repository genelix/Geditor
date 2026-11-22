import React, { useEffect } from 'react';
import { TabItem } from '../types';
import { AlertTriangle, Save, Trash2, X, FileText } from 'lucide-react';

interface UnsavedChangesModalProps {
  isOpen: boolean;
  dirtyTabs: TabItem[];
  theme: string;
  isSaving?: boolean;
  onSaveAndQuit: () => void;
  onDiscardAndQuit: () => void;
  onCancel: () => void;
}

export const UnsavedChangesModal: React.FC<UnsavedChangesModalProps> = ({
  isOpen,
  dirtyTabs,
  theme,
  isSaving = false,
  onSaveAndQuit,
  onDiscardAndQuit,
  onCancel,
}) => {
  const isLight = theme === 'vs';

  // Keyboard shortcut handler (Esc: Cancel, Enter: Save & Quit)
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onCancel();
      } else if (e.key === 'Enter' && !e.shiftKey && !e.altKey && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        onSaveAndQuit();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onCancel, onSaveAndQuit]);

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.65)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 2000,
        backdropFilter: 'blur(4px)',
      }}
      onClick={onCancel}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '520px',
          maxHeight: '440px',
          backgroundColor: isLight ? '#ffffff' : '#1e1e24',
          color: isLight ? '#18181b' : '#f4f4f5',
          borderRadius: '12px',
          border: isLight ? '1px solid #e4e4e7' : '1px solid #3f3f46',
          boxShadow: '0 24px 48px rgba(0, 0, 0, 0.5)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '16px 20px',
            borderBottom: isLight ? '1px solid #e4e4e7' : '1px solid #27272a',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            backgroundColor: isLight ? '#fafafa' : '#232329',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                backgroundColor: isLight ? '#fef3c7' : 'rgba(245, 158, 11, 0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#f59e0b',
                flexShrink: 0,
              }}
            >
              <AlertTriangle size={18} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 600 }}>
                저장되지 않은 변경사항이 있습니다
              </h3>
              <p style={{ margin: 0, fontSize: '12px', color: isLight ? '#71717a' : '#a1a1aa' }}>
                총 {dirtyTabs.length}개의 수정된 파일이 있습니다.
              </p>
            </div>
          </div>
          <button
            onClick={onCancel}
            style={{
              background: 'none',
              border: 'none',
              color: isLight ? '#71717a' : '#a1a1aa',
              cursor: 'pointer',
              padding: '6px',
              borderRadius: '6px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            title="닫기 (Esc)"
          >
            <X size={16} />
          </button>
        </div>

        {/* Body & File List */}
        <div style={{ padding: '16px 20px', overflowY: 'auto', flex: 1 }}>
          <p
            style={{
              margin: '0 0 12px 0',
              fontSize: '13px',
              lineHeight: 1.5,
              color: isLight ? '#3f3f46' : '#d4d4d8',
            }}
          >
            프로그램을 종료하기 전에 변경 내용을 저장하시겠습니까? 저장하지 않고 종료하면 최근 변경 사항이 사라집니다.
          </p>

          <div
            style={{
              maxHeight: '160px',
              overflowY: 'auto',
              borderRadius: '8px',
              border: isLight ? '1px solid #e4e4e7' : '1px solid #333338',
              backgroundColor: isLight ? '#f4f4f5' : '#141418',
              padding: '6px',
              display: 'flex',
              flexDirection: 'column',
              gap: '4px',
            }}
          >
            {dirtyTabs.map((tab) => (
              <div
                key={tab.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '6px 10px',
                  borderRadius: '6px',
                  backgroundColor: isLight ? '#ffffff' : '#1c1c22',
                  fontSize: '12px',
                }}
              >
                <span style={{ color: '#38bdf8', fontSize: '14px', lineHeight: 1 }}>●</span>
                <FileText size={14} color={isLight ? '#64748b' : '#94a3b8'} style={{ flexShrink: 0 }} />
                <span
                  style={{
                    fontWeight: 500,
                    color: isLight ? '#0f172a' : '#f8fafc',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {tab.name}
                </span>
                <span
                  style={{
                    color: isLight ? '#94a3b8' : '#64748b',
                    fontSize: '11px',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    flex: 1,
                    textAlign: 'right',
                    marginLeft: '8px',
                  }}
                  title={tab.path || '미저장 새 파일'}
                >
                  {tab.path || '미저장 새 파일'}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Footer Buttons */}
        <div
          style={{
            padding: '12px 20px',
            borderTop: isLight ? '1px solid #e4e4e7' : '1px solid #27272a',
            backgroundColor: isLight ? '#fafafa' : '#232329',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '10px',
          }}
        >
          <button
            onClick={onCancel}
            disabled={isSaving}
            style={{
              padding: '7px 14px',
              fontSize: '13px',
              borderRadius: '6px',
              border: isLight ? '1px solid #d4d4d8' : '1px solid #3f3f46',
              backgroundColor: isLight ? '#ffffff' : '#27272a',
              color: isLight ? '#3f3f46' : '#d4d4d8',
              cursor: isSaving ? 'not-allowed' : 'pointer',
              fontWeight: 500,
              transition: 'all 0.15s ease',
            }}
          >
            취소
          </button>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              onClick={onDiscardAndQuit}
              disabled={isSaving}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '7px 14px',
                fontSize: '13px',
                borderRadius: '6px',
                border: isLight ? '1px solid #fca5a5' : '1px solid rgba(239, 68, 68, 0.4)',
                backgroundColor: isLight ? '#fef2f2' : 'rgba(239, 68, 68, 0.15)',
                color: isLight ? '#dc2626' : '#f87171',
                cursor: isSaving ? 'not-allowed' : 'pointer',
                fontWeight: 500,
                transition: 'all 0.15s ease',
              }}
              title="변경 사항을 저장하지 않고 프로그램을 닫습니다"
            >
              <Trash2 size={14} />
              저장하지 않고 종료
            </button>

            <button
              onClick={onSaveAndQuit}
              disabled={isSaving}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '7px 16px',
                fontSize: '13px',
                borderRadius: '6px',
                border: 'none',
                backgroundColor: '#0284c7',
                color: '#ffffff',
                cursor: isSaving ? 'wait' : 'pointer',
                fontWeight: 600,
                boxShadow: '0 1px 3px rgba(0, 0, 0, 0.2)',
                transition: 'all 0.15s ease',
              }}
              title="모든 변경 사항을 저장한 후 프로그램을 닫습니다 (Enter)"
            >
              <Save size={14} />
              {isSaving ? '저장 중...' : '저장 후 종료'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
