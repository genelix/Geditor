import React, { useState, useMemo } from 'react';
import { TabItem } from '../types';
import {
  X,
  Plus,
  Columns,
  Rows,
  Terminal as TerminalIcon,
  Save,
  Copy,
  FolderMinus,
  ArrowRight,
} from 'lucide-react';
import { ContextMenu, ContextMenuItem } from './ContextMenu';

interface TabBarProps {
  tabs: TabItem[];
  activeTabId: string;
  isLight?: boolean;
  onSelectTab: (id: string) => void;
  onCloseTab: (id: string) => void;
  onCloseOtherTabs?: (id: string) => void;
  onCloseTabsToRight?: (id: string) => void;
  onSaveTab?: (id: string) => void;
  onNewTab: () => void;
  onSplitRight: () => void;
  onSplitDown: () => void;
  onAddTerminalPane: () => void;
  onOpenPreviewSplit?: () => void;
}

export const TabBar: React.FC<TabBarProps> = ({
  tabs,
  activeTabId,
  isLight = false,
  onSelectTab,
  onCloseTab,
  onCloseOtherTabs,
  onCloseTabsToRight,
  onSaveTab,
  onNewTab,
  onSplitRight,
  onSplitDown,
  onAddTerminalPane,
  onOpenPreviewSplit,
}) => {
  const activeTab = tabs.find((t) => t.id === activeTabId);
  const isPreviewable =
    activeTab &&
    (activeTab.language === 'markdown' ||
      activeTab.language === 'html' ||
      activeTab.path.endsWith('.html') ||
      activeTab.path.endsWith('.htm'));

  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    tab?: TabItem;
  } | null>(null);

  const isMac = typeof navigator !== 'undefined' && navigator.platform.toUpperCase().indexOf('MAC') >= 0;

  const contextMenuItems: ContextMenuItem[] = useMemo(() => {
    if (!contextMenu) return [];
    const targetTab = contextMenu.tab;

    if (!targetTab) {
      // Empty area context menu
      return [
        {
          label: '새 탭 열기',
          icon: <Plus size={14} />,
          shortcut: isMac ? '⌘N' : 'Ctrl+N',
          onClick: onNewTab,
        },
      ];
    }

    const tabIndex = tabs.findIndex((t) => t.id === targetTab.id);
    const isOnlyTab = tabs.length <= 1;
    const isLastTab = tabIndex === tabs.length - 1;
    const isTargetPreviewable =
      targetTab.language === 'markdown' ||
      targetTab.language === 'html' ||
      targetTab.path.endsWith('.html') ||
      targetTab.path.endsWith('.htm');

    return [
      ...(isTargetPreviewable && onOpenPreviewSplit
        ? [
            {
              label: '실시간 미리보기 패널 분할 (코드 | 렌더링)',
              icon: <Columns size={14} />,
              shortcut: isMac ? '⌘⇧V' : 'Ctrl+Shift+V',
              onClick: () => {
                onSelectTab(targetTab.id);
                onOpenPreviewSplit();
              },
            },
            { separator: true },
          ]
        : []),
      {
        label: '탭 닫기',
        icon: <X size={14} />,
        shortcut: isMac ? '⌘W' : 'Ctrl+W',
        onClick: () => onCloseTab(targetTab.id),
      },
      {
        label: '다른 탭 모두 닫기',
        icon: <FolderMinus size={14} />,
        disabled: isOnlyTab,
        onClick: () => onCloseOtherTabs?.(targetTab.id),
      },
      {
        label: '오른쪽 탭 모두 닫기',
        icon: <ArrowRight size={14} />,
        disabled: isLastTab,
        onClick: () => onCloseTabsToRight?.(targetTab.id),
      },
      { separator: true },
      {
        label: '저장',
        icon: <Save size={14} />,
        shortcut: isMac ? '⌘S' : 'Ctrl+S',
        onClick: () => onSaveTab?.(targetTab.id),
      },
      {
        label: '전체 파일 경로 복사',
        icon: <Copy size={14} />,
        disabled: !targetTab.path,
        onClick: () => {
          if (targetTab.path) {
            navigator.clipboard.writeText(targetTab.path);
          }
        },
      },
      {
        label: '파일 이름 복사',
        icon: <Copy size={14} />,
        onClick: () => {
          navigator.clipboard.writeText(targetTab.name);
        },
      },
    ];
  }, [contextMenu, tabs, isMac, onCloseTab, onCloseOtherTabs, onCloseTabsToRight, onSaveTab, onNewTab, onOpenPreviewSplit, onSelectTab]);

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        height: '36px',
        backgroundColor: isLight ? '#f4f4f5' : '#18181b',
        borderBottom: isLight ? '1px solid #e4e4e7' : '1px solid #27272a',
        paddingLeft: '8px',
        paddingRight: '8px',
        userSelect: 'none',
      }}
      onContextMenu={(e) => {
        e.preventDefault();
        e.stopPropagation();
        setContextMenu({ x: e.clientX, y: e.clientY });
      }}
    >
      {/* Tab Items */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '2px',
          overflowX: 'auto',
          flex: 1,
          height: '100%',
        }}
      >
        {tabs.map((tab) => {
          const isActive = tab.id === activeTabId;
          return (
            <div
              key={tab.id}
              onClick={() => onSelectTab(tab.id)}
              onContextMenu={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setContextMenu({ x: e.clientX, y: e.clientY, tab });
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '0 12px',
                height: '100%',
                backgroundColor: isActive
                  ? isLight
                    ? '#ffffff'
                    : '#1e1e1e'
                  : 'transparent',
                borderTop: isActive ? '2px solid #38bdf8' : '2px solid transparent',
                borderRight: isLight ? '1px solid #e4e4e7' : '1px solid #27272a',
                color: isActive
                  ? isLight
                    ? '#18181b'
                    : '#f4f4f5'
                  : isLight
                  ? '#71717a'
                  : '#a1a1aa',
                fontSize: '12px',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                transition: 'background-color 0.15s',
              }}
            >
              <span>{tab.name}</span>

              {/* Dirty indicator */}
              {tab.isDirty && (
                <span
                  style={{
                    width: '6px',
                    height: '6px',
                    borderRadius: '50%',
                    backgroundColor: '#38bdf8',
                  }}
                  title="저장되지 않은 변경사항"
                />
              )}

              {/* Close tab button */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onCloseTab(tab.id);
                }}
                title="탭 닫기"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '16px',
                  height: '16px',
                  borderRadius: '3px',
                  border: 'none',
                  background: 'transparent',
                  color: isLight ? '#71717a' : '#71717a',
                  cursor: 'pointer',
                  padding: 0,
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = isLight ? '#e4e4e7' : '#3f3f46';
                  e.currentTarget.style.color = isLight ? '#000' : '#fff';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent';
                  e.currentTarget.style.color = isLight ? '#71717a' : '#71717a';
                }}
              >
                <X size={12} />
              </button>
            </div>
          );
        })}

        {/* Add new tab button */}
        <button
          onClick={onNewTab}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '24px',
            height: '24px',
            borderRadius: '4px',
            border: 'none',
            background: 'transparent',
            color: isLight ? '#71717a' : '#a1a1aa',
            cursor: 'pointer',
            marginLeft: '4px',
          }}
          title={isMac ? '새 파일 열기 (⌘N)' : '새 파일 열기 (Ctrl+N)'}
          onMouseEnter={(e) =>
            (e.currentTarget.style.backgroundColor = isLight ? '#e4e4e7' : '#27272a')
          }
          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
        >
          <Plus size={14} />
        </button>
      </div>

      {/* Pane and Terminal controls */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '4px',
          marginLeft: 'auto',
          borderLeft: isLight ? '1px solid #e4e4e7' : '1px solid #27272a',
          paddingLeft: '8px',
        }}
      >
        {isPreviewable && onOpenPreviewSplit && (
          <button
            onClick={onOpenPreviewSplit}
            title={isMac ? '코드와 렌더링 2개 패널 실시간 분할 (⌘⇧V)' : '코드와 렌더링 2개 패널 실시간 분할 (Ctrl+Shift+V)'}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '5px',
              padding: '4px 10px',
              backgroundColor: '#0284c7',
              border: '1px solid #0284c7',
              borderRadius: '4px',
              color: '#ffffff',
              fontSize: '11px',
              fontWeight: 600,
              cursor: 'pointer',
              boxShadow: '0 1px 2px rgba(0,0,0,0.15)',
            }}
          >
            <Columns size={13} />
            ⚡ 실시간 미리보기 분할
          </button>
        )}

        <button
          onClick={onSplitRight}
          title={isMac ? '우측으로 분할 (⌘\\)' : '우측으로 분할 (Ctrl+\\)'}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            padding: '4px 8px',
            backgroundColor: isLight ? '#e4e4e7' : '#27272a',
            border: isLight ? '1px solid #d4d4d8' : '1px solid #3f3f46',
            borderRadius: '4px',
            color: isLight ? '#18181b' : '#d4d4d8',
            fontSize: '11px',
            cursor: 'pointer',
          }}
        >
          <Columns size={13} />
          우측 분할
        </button>

        <button
          onClick={onSplitDown}
          title="하단으로 분할"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            padding: '4px 6px',
            backgroundColor: isLight ? '#e4e4e7' : '#27272a',
            border: isLight ? '1px solid #d4d4d8' : '1px solid #3f3f46',
            borderRadius: '4px',
            color: isLight ? '#18181b' : '#d4d4d8',
            fontSize: '11px',
            cursor: 'pointer',
          }}
        >
          <Rows size={13} />
        </button>

        <button
          onClick={onAddTerminalPane}
          title={isMac ? '새 터미널 열기 (⌘T)' : '새 터미널 열기 (Ctrl+T)'}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            padding: '4px 8px',
            backgroundColor: '#0284c7',
            border: '1px solid #0284c7',
            borderRadius: '4px',
            color: '#ffffff',
            fontSize: '11px',
            fontWeight: 500,
            cursor: 'pointer',
          }}
        >
          <TerminalIcon size={13} />
          터미널
        </button>
      </div>

      {/* Korean Tab Context Menu */}
      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          isLight={isLight}
          items={contextMenuItems}
          onClose={() => setContextMenu(null)}
        />
      )}
    </div>
  );
};
