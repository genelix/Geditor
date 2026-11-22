import React, { useState, useEffect, useRef } from 'react';
import { PaneItem, TabItem, EditorSettings } from '../types';
import { EditorPane } from './EditorPane';
import { TerminalPane } from './TerminalPane';
import { MarkdownPreview } from './MarkdownPreview';
import { CsvTablePreview } from './CsvTablePreview';
import { HtmlPreview } from './HtmlPreview';
import {
  X,
  Columns,
  Rows,
  Terminal,
  Code,
  Eye,
  Table,
  Globe,
} from 'lucide-react';

interface SplitContainerProps {
  panes: PaneItem[];
  activePaneId: string;
  tabs: TabItem[];
  activeTab?: TabItem;
  splitDirection: 'horizontal' | 'vertical';
  workspacePath: string;
  settings: EditorSettings;
  onSelectPane: (id: string) => void;
  onClosePane: (id: string) => void;
  onSplitPane: (paneId: string, direction: 'horizontal' | 'vertical') => void;
  onChangePaneType: (
    paneId: string,
    newType: 'editor' | 'terminal' | 'markdown-preview' | 'csv-table' | 'html-preview'
  ) => void;
  onChangeContent: (tabId: string, content: string) => void;
  onUpdateViewMode: (tabId: string, mode: 'edit' | 'preview' | 'split') => void;
  onOpenFile?: (path: string) => void;
  showToast?: (msg: string) => void;
  onOpenPreviewSplit?: () => void;
}

export const SplitContainer: React.FC<SplitContainerProps> = ({
  panes,
  activePaneId,
  tabs,
  activeTab,
  splitDirection,
  workspacePath,
  settings,
  onSelectPane,
  onClosePane,
  onSplitPane,
  onChangePaneType,
  onChangeContent,
  onUpdateViewMode,
  onOpenFile,
  showToast,
  onOpenPreviewSplit,
}) => {
  const isLight = settings.theme === 'vs';
  const containerRef = useRef<HTMLDivElement>(null);

  // Pane sizes in percentage
  const [paneSizes, setPaneSizes] = useState<number[]>(() =>
    Array(panes.length).fill(100 / Math.max(1, panes.length))
  );
  const [activeDivider, setActiveDivider] = useState<number | null>(null);

  // Reset or adjust sizes when panes count changes
  useEffect(() => {
    setPaneSizes((prev) => {
      if (prev.length === panes.length) return prev;
      return Array(panes.length).fill(100 / Math.max(1, panes.length));
    });
  }, [panes.length]);

  // Handle divider dragging for resizing
  const handleDividerMouseDown = (e: React.MouseEvent, index: number) => {
    e.preventDefault();
    setActiveDivider(index);

    const startPos = splitDirection === 'horizontal' ? e.clientX : e.clientY;
    const startSizes = [...paneSizes];

    const handleMouseMove = (moveEvent: MouseEvent) => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const totalPixels = splitDirection === 'horizontal' ? rect.width : rect.height;
      if (totalPixels <= 0) return;

      const currentPos = splitDirection === 'horizontal' ? moveEvent.clientX : moveEvent.clientY;
      const deltaPixels = currentPos - startPos;
      const deltaPercent = (deltaPixels / totalPixels) * 100;

      const combined = startSizes[index] + startSizes[index + 1];
      const minPercent = 15; // Minimum size for a pane

      let newSizeA = Math.max(
        minPercent,
        Math.min(combined - minPercent, startSizes[index] + deltaPercent)
      );
      let newSizeB = combined - newSizeA;

      setPaneSizes((prev) => {
        const next = [...prev];
        next[index] = newSizeA;
        next[index + 1] = newSizeB;
        return next;
      });
    };

    const handleMouseUp = () => {
      setActiveDivider(null);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  const handleDividerDoubleClick = (index: number) => {
    setPaneSizes((prev) => {
      const next = [...prev];
      const combined = next[index] + next[index + 1];
      next[index] = combined / 2;
      next[index + 1] = combined / 2;
      return next;
    });
  };

  return (
    <div
      ref={containerRef}
      style={{
        display: 'flex',
        flexDirection: splitDirection === 'horizontal' ? 'row' : 'column',
        width: '100%',
        height: '100%',
        overflow: 'hidden',
        backgroundColor: isLight ? '#f4f4f5' : '#18181b',
        position: 'relative',
      }}
    >
      {panes.map((pane, index) => {
        const isActive = pane.id === activePaneId;
        const assignedTab =
          tabs.find((t) => t.id === pane.tabId) || activeTab || tabs[0];

        const panePercent = paneSizes[index] ?? 100 / panes.length;

        // Determine title based on type
        let displayTitle = pane.title;
        if (pane.type === 'editor') {
          displayTitle = assignedTab?.name || '편집기';
        } else if (pane.type === 'markdown-preview') {
          displayTitle = assignedTab?.name ? `[미리보기] ${assignedTab.name}` : '마크다운 미리보기';
        } else if (pane.type === 'html-preview') {
          displayTitle = assignedTab?.name ? `[웹 페이지] ${assignedTab.name}` : 'HTML 웹 페이지';
        } else if (pane.type === 'csv-table') {
          displayTitle = assignedTab?.name ? `[테이블] ${assignedTab.name}` : 'CSV 테이블';
        }

        return (
          <React.Fragment key={pane.id}>
            {/* Pane Box */}
            <div
              onClick={() => onSelectPane(pane.id)}
              style={{
                flex: `0 0 ${panePercent}%`,
                width: splitDirection === 'horizontal' ? `${panePercent}%` : '100%',
                height: splitDirection === 'vertical' ? `${panePercent}%` : '100%',
                display: 'flex',
                flexDirection: 'column',
                minWidth: splitDirection === 'horizontal' ? '140px' : undefined,
                minHeight: splitDirection === 'vertical' ? '100px' : undefined,
                border: isActive
                  ? '1px solid #38bdf8'
                  : isLight
                  ? '1px solid #e4e4e7'
                  : '1px solid #27272a',
                boxSizing: 'border-box',
                overflow: 'hidden',
                backgroundColor: isLight ? '#ffffff' : '#1e1e1e',
              }}
            >
              {/* Pane Header Controls */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  height: '28px',
                  backgroundColor: isActive
                    ? isLight
                      ? '#e0f2fe'
                      : '#242429'
                    : isLight
                    ? '#f4f4f5'
                    : '#1b1b1e',
                  borderBottom: isLight ? '1px solid #e4e4e7' : '1px solid #27272a',
                  padding: '0 8px',
                  gap: '6px',
                  fontSize: '11px',
                  userSelect: 'none',
                }}
              >
                {/* Pane Icon */}
                {pane.type === 'editor' && <Code size={13} color="#38bdf8" />}
                {pane.type === 'terminal' && <Terminal size={13} color="#4ade80" />}
                {pane.type === 'markdown-preview' && <Eye size={13} color="#a78bfa" />}
                {pane.type === 'csv-table' && <Table size={13} color="#34d399" />}
                {pane.type === 'html-preview' && <Globe size={13} color="#38bdf8" />}

                {/* Pane Title */}
                <span
                  style={{
                    color: isActive
                      ? isLight
                        ? '#0284c7'
                        : '#f4f4f5'
                      : isLight
                      ? '#71717a'
                      : '#a1a1aa',
                    fontWeight: 600,
                    maxWidth: '240px',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                  title={displayTitle}
                >
                  {displayTitle}
                  {pane.type === 'editor' && assignedTab?.isDirty && ' ●'}
                </span>

                <div style={{ flex: 1 }} />

                {/* Switch Type Buttons */}
                <div style={{ display: 'flex', gap: '2px' }}>
                  <button
                    onClick={() => onChangePaneType(pane.id, 'editor')}
                    title="코드 편집기로 전환"
                    style={{
                      border: 'none',
                      background: pane.type === 'editor' ? '#38bdf8' : 'transparent',
                      color: pane.type === 'editor' ? '#000' : isLight ? '#71717a' : '#71717a',
                      borderRadius: '3px',
                      padding: '2px 4px',
                      cursor: 'pointer',
                    }}
                  >
                    <Code size={11} />
                  </button>
                  <button
                    onClick={() => onChangePaneType(pane.id, 'terminal')}
                    title="내장 터미널로 전환"
                    style={{
                      border: 'none',
                      background: pane.type === 'terminal' ? '#4ade80' : 'transparent',
                      color: pane.type === 'terminal' ? '#000' : isLight ? '#71717a' : '#71717a',
                      borderRadius: '3px',
                      padding: '2px 4px',
                      cursor: 'pointer',
                    }}
                  >
                    <Terminal size={11} />
                  </button>
                  {assignedTab?.language === 'markdown' && (
                    <button
                      onClick={() => onChangePaneType(pane.id, 'markdown-preview')}
                      title="마크다운 미리보기로 전환"
                      style={{
                        border: 'none',
                        background:
                          pane.type === 'markdown-preview' ? '#a78bfa' : 'transparent',
                        color: pane.type === 'markdown-preview' ? '#000' : isLight ? '#71717a' : '#71717a',
                        borderRadius: '3px',
                        padding: '2px 4px',
                        cursor: 'pointer',
                      }}
                    >
                      <Eye size={11} />
                    </button>
                  )}
                  {assignedTab?.language === 'csv' && (
                    <button
                      onClick={() => onChangePaneType(pane.id, 'csv-table')}
                      title="CSV 테이블 뷰로 전환"
                      style={{
                        border: 'none',
                        background: pane.type === 'csv-table' ? '#34d399' : 'transparent',
                        color: pane.type === 'csv-table' ? '#000' : isLight ? '#71717a' : '#71717a',
                        borderRadius: '3px',
                        padding: '2px 4px',
                        cursor: 'pointer',
                      }}
                    >
                      <Table size={11} />
                    </button>
                  )}
                  {(assignedTab?.language === 'html' || assignedTab?.path.endsWith('.html') || assignedTab?.path.endsWith('.htm')) && (
                    <button
                      onClick={() => onChangePaneType(pane.id, 'html-preview')}
                      title="HTML 웹 페이지 뷰로 전환"
                      style={{
                        border: 'none',
                        background: pane.type === 'html-preview' ? '#38bdf8' : 'transparent',
                        color: pane.type === 'html-preview' ? '#000' : isLight ? '#71717a' : '#71717a',
                        borderRadius: '3px',
                        padding: '2px 4px',
                        cursor: 'pointer',
                      }}
                    >
                      <Globe size={11} />
                    </button>
                  )}
                </div>

                {/* Split Actions */}
                <button
                  onClick={() => onSplitPane(pane.id, 'horizontal')}
                  title="우측으로 분할"
                  style={{
                    border: 'none',
                    background: 'transparent',
                    color: isLight ? '#71717a' : '#71717a',
                    cursor: 'pointer',
                    padding: '2px',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = '#38bdf8')}
                  onMouseLeave={(e) => (e.currentTarget.style.color = isLight ? '#71717a' : '#71717a')}
                >
                  <Columns size={12} />
                </button>
                <button
                  onClick={() => onSplitPane(pane.id, 'vertical')}
                  title="하단으로 분할"
                  style={{
                    border: 'none',
                    background: 'transparent',
                    color: isLight ? '#71717a' : '#71717a',
                    cursor: 'pointer',
                    padding: '2px',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = '#38bdf8')}
                  onMouseLeave={(e) => (e.currentTarget.style.color = isLight ? '#71717a' : '#71717a')}
                >
                  <Rows size={12} />
                </button>

                {/* Close Pane (if more than 1 pane) */}
                {panes.length > 1 && (
                  <button
                    onClick={() => onClosePane(pane.id)}
                    title="패널 닫기"
                    style={{
                      border: 'none',
                      background: 'transparent',
                      color: isLight ? '#71717a' : '#71717a',
                      cursor: 'pointer',
                      padding: '2px',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.color = '#ef4444')}
                    onMouseLeave={(e) => (e.currentTarget.style.color = isLight ? '#71717a' : '#71717a')}
                  >
                    <X size={12} />
                  </button>
                )}
              </div>

              {/* Pane Body */}
              <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
                {pane.type === 'editor' && assignedTab && (
                  <EditorPane
                    tab={assignedTab}
                    settings={settings}
                    workspacePath={workspacePath}
                    onOpenFile={onOpenFile}
                    showToast={showToast}
                    onChangeContent={onChangeContent}
                    onUpdateViewMode={onUpdateViewMode}
                    onOpenPreviewSplit={onOpenPreviewSplit}
                  />
                )}

                {pane.type === 'editor' && !assignedTab && (
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      height: '100%',
                      color: isLight ? '#a1a1aa' : '#71717a',
                      fontSize: '13px',
                    }}
                  >
                    열린 파일이 없습니다. 탐색기에서 파일을 선택하거나 Cmd+N을 누르세요.
                  </div>
                )}

                {pane.type === 'terminal' && (
                  <TerminalPane id={pane.id} cwd={workspacePath} />
                )}

                {pane.type === 'markdown-preview' && assignedTab && (
                  <MarkdownPreview content={assignedTab.content} isLight={isLight} />
                )}

                {pane.type === 'csv-table' && assignedTab && (
                  <CsvTablePreview content={assignedTab.content} />
                )}

                {pane.type === 'html-preview' && assignedTab && (
                  <HtmlPreview
                    content={assignedTab.content}
                    filePath={assignedTab.path}
                    isLight={isLight}
                  />
                )}
              </div>
            </div>

            {/* Draggable Divider between panes */}
            {index < panes.length - 1 && (
              <div
                onMouseDown={(e) => handleDividerMouseDown(e, index)}
                onDoubleClick={() => handleDividerDoubleClick(index)}
                title="드래그하여 크기 조절 (더블 클릭: 50:50 정렬)"
                style={{
                  backgroundColor:
                    activeDivider === index
                      ? '#0284c7'
                      : isLight
                      ? '#d4d4d8'
                      : '#27272a',
                  width: splitDirection === 'horizontal' ? '6px' : '100%',
                  height: splitDirection === 'horizontal' ? '100%' : '6px',
                  cursor: splitDirection === 'horizontal' ? 'col-resize' : 'row-resize',
                  zIndex: 10,
                  position: 'relative',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'background-color 0.15s ease',
                  userSelect: 'none',
                }}
                onMouseEnter={(e) => {
                  if (activeDivider === null) {
                    e.currentTarget.style.backgroundColor = '#38bdf8';
                  }
                }}
                onMouseLeave={(e) => {
                  if (activeDivider === null) {
                    e.currentTarget.style.backgroundColor = isLight ? '#d4d4d8' : '#27272a';
                  }
                }}
              >
                {/* Small indicator notch in the center */}
                <div
                  style={{
                    backgroundColor: isLight ? '#9ca3af' : '#52525b',
                    borderRadius: '2px',
                    width: splitDirection === 'horizontal' ? '2px' : '24px',
                    height: splitDirection === 'horizontal' ? '24px' : '2px',
                  }}
                />
              </div>
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
};
