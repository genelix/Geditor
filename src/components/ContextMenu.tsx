import React, { useEffect, useRef, useState, useLayoutEffect } from 'react';

export interface ContextMenuItem {
  id?: string;
  label?: string;
  icon?: React.ReactNode;
  shortcut?: string;
  disabled?: boolean;
  danger?: boolean;
  separator?: boolean;
  onClick?: () => void;
}

interface ContextMenuProps {
  x: number;
  y: number;
  items: ContextMenuItem[];
  isLight?: boolean;
  onClose: () => void;
}

export const ContextMenu: React.FC<ContextMenuProps> = ({
  x,
  y,
  items,
  isLight = false,
  onClose,
}) => {
  const menuRef = useRef<HTMLDivElement>(null);
  const [coords, setCoords] = useState<{ top: number; left: number }>({ top: y, left: x });

  // Reposition to stay within viewport
  useLayoutEffect(() => {
    if (!menuRef.current) return;
    const rect = menuRef.current.getBoundingClientRect();
    const padding = 8;
    let nextLeft = x;
    let nextTop = y;

    if (x + rect.width > window.innerWidth - padding) {
      nextLeft = Math.max(padding, window.innerWidth - rect.width - padding);
    }
    if (y + rect.height > window.innerHeight - padding) {
      nextTop = Math.max(padding, window.innerHeight - rect.height - padding);
    }

    setCoords({ top: nextTop, left: nextLeft });
  }, [x, y]);

  // Click outside and keydown listeners
  useEffect(() => {
    const handlePointerDown = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    const handleWindowBlur = () => {
      onClose();
    };

    window.addEventListener('mousedown', handlePointerDown, true);
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('blur', handleWindowBlur);
    window.addEventListener('resize', onClose);

    return () => {
      window.removeEventListener('mousedown', handlePointerDown, true);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('blur', handleWindowBlur);
      window.removeEventListener('resize', onClose);
    };
  }, [onClose]);

  return (
    <div
      ref={menuRef}
      style={{
        position: 'fixed',
        top: `${coords.top}px`,
        left: `${coords.left}px`,
        zIndex: 99999,
        minWidth: '180px',
        backgroundColor: isLight ? '#ffffff' : '#1f1f23',
        color: isLight ? '#18181b' : '#f4f4f5',
        borderRadius: '7px',
        boxShadow: isLight
          ? '0 10px 25px -5px rgba(0, 0, 0, 0.15), 0 4px 6px -2px rgba(0, 0, 0, 0.05), 0 0 0 1px rgba(0, 0, 0, 0.08)'
          : '0 10px 25px -5px rgba(0, 0, 0, 0.6), 0 4px 6px -2px rgba(0, 0, 0, 0.4), 0 0 0 1px rgba(255, 255, 255, 0.12)',
        padding: '5px',
        fontSize: '12px',
        userSelect: 'none',
        animation: 'geditorFadeIn 0.1s ease-out',
      }}
      onContextMenu={(e) => {
        e.preventDefault();
        e.stopPropagation();
      }}
    >
      <style>{`
        @keyframes geditorFadeIn {
          from { opacity: 0; transform: scale(0.97); }
          to { opacity: 1; transform: scale(1); }
        }
      `}</style>

      {items.map((item, idx) => {
        if (item.separator) {
          return (
            <div
              key={`sep-${idx}`}
              style={{
                height: '1px',
                backgroundColor: isLight ? '#e4e4e7' : '#2e2e33',
                margin: '4px 2px',
              }}
            />
          );
        }

        const isDisabled = !!item.disabled;
        const isDanger = !!item.danger;

        return (
          <div
            key={item.id || item.label || idx}
            onClick={(e) => {
              e.stopPropagation();
              if (isDisabled) return;
              onClose();
              item.onClick?.();
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              padding: '6px 8px',
              borderRadius: '4px',
              cursor: isDisabled ? 'not-allowed' : 'pointer',
              color: isDisabled
                ? isLight
                  ? '#a1a1aa'
                  : '#52525b'
                : isDanger
                ? '#ef4444'
                : isLight
                ? '#18181b'
                : '#f4f4f5',
              transition: 'background-color 0.1s',
              gap: '8px',
            }}
            onMouseEnter={(e) => {
              if (isDisabled) return;
              e.currentTarget.style.backgroundColor = isDanger
                ? isLight
                  ? '#fee2e2'
                  : '#7f1d1d'
                : isLight
                ? '#f4f4f5'
                : '#2e2e36';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
            }}
          >
            {item.icon && (
              <span
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  opacity: isDisabled ? 0.4 : 0.8,
                  flexShrink: 0,
                }}
              >
                {item.icon}
              </span>
            )}
            <span style={{ flex: 1, whiteSpace: 'nowrap' }}>{item.label}</span>
            {item.shortcut && (
              <span
                style={{
                  marginLeft: '16px',
                  fontSize: '11px',
                  fontFamily: 'SF Mono, Menlo, Monaco, Consolas, monospace',
                  color: isLight ? '#71717a' : '#888892',
                  opacity: isDisabled ? 0.4 : 0.9,
                }}
              >
                {item.shortcut}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
};
