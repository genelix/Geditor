import React, { useEffect, useRef, useState, useMemo } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import '@xterm/xterm/css/xterm.css';
import { tauriApi } from '../services/tauriApi';
import { ContextMenu, ContextMenuItem } from './ContextMenu';
import { Copy, Clipboard, CheckSquare, Trash2 } from 'lucide-react';

interface TerminalPaneProps {
  id: string;
  cwd?: string;
}

export const TerminalPane: React.FC<TerminalPaneProps> = ({ id, cwd }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);

  const isMac = typeof navigator !== 'undefined' && navigator.platform.toUpperCase().indexOf('MAC') >= 0;

  useEffect(() => {
    if (!containerRef.current) return;

    const term = new Terminal({
      cursorBlink: true,
      cursorStyle: 'bar',
      fontSize: 13,
      fontFamily: 'Menlo, Monaco, "Courier New", monospace',
      theme: {
        background: '#18181b',
        foreground: '#f4f4f5',
        cursor: '#38bdf8',
        selectionBackground: 'rgba(56, 189, 248, 0.3)',
        black: '#27272a',
        red: '#f87171',
        green: '#4ade80',
        yellow: '#facc15',
        blue: '#60a5fa',
        magenta: '#c084fc',
        cyan: '#38bdf8',
        white: '#f4f4f5',
        brightBlack: '#71717a',
        brightRed: '#ef4444',
        brightGreen: '#22c55e',
        brightYellow: '#eab308',
        brightBlue: '#3b82f6',
        brightMagenta: '#a855f7',
        brightCyan: '#06b6d4',
        brightWhite: '#ffffff',
      },
    });

    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    term.loadAddon(new WebLinksAddon());

    term.open(containerRef.current);
    fitAddon.fit();

    termRef.current = term;
    fitAddonRef.current = fitAddon;

    let unlisten: (() => void) | null = null;
    let isSpawned = false;

    const initTerminal = async () => {
      try {
        const cols = term.cols || 80;
        const rows = term.rows || 24;

        await tauriApi.spawnTerminal(id, cols, rows, cwd);
        isSpawned = true;

        unlisten = await tauriApi.onTerminalOutput(id, (chunk) => {
          term.write(chunk);
        });

        term.onData((data) => {
          tauriApi.writeTerminal(id, data).catch(console.error);
        });

        term.onResize(({ cols, rows }) => {
          tauriApi.resizeTerminal(id, cols, rows).catch(console.error);
        });
      } catch (err) {
        term.writeln(`\x1b[31m[Failed to spawn terminal: ${err}]\x1b[0m`);
      }
    };

    initTerminal();

    const resizeObserver = new ResizeObserver(() => {
      try {
        fitAddon.fit();
      } catch (_) {}
    });

    resizeObserver.observe(containerRef.current);

    return () => {
      resizeObserver.disconnect();
      if (unlisten) unlisten();
      if (isSpawned) {
        tauriApi.closeTerminal(id).catch(console.error);
      }
      term.dispose();
    };
  }, [id, cwd]);

  const terminalMenuItems: ContextMenuItem[] = useMemo(() => [
    {
      label: '복사',
      icon: <Copy size={14} />,
      shortcut: isMac ? '⌘C' : 'Ctrl+Shift+C',
      onClick: () => {
        const selection = termRef.current?.getSelection();
        if (selection) {
          navigator.clipboard.writeText(selection);
        }
      },
    },
    {
      label: '붙여넣기',
      icon: <Clipboard size={14} />,
      shortcut: isMac ? '⌘V' : 'Ctrl+Shift+V',
      onClick: async () => {
        try {
          const text = await navigator.clipboard.readText();
          if (text) {
            tauriApi.writeTerminal(id, text);
          }
        } catch (e) {
          console.error('Terminal paste error:', e);
        }
      },
    },
    { separator: true },
    {
      label: '모두 선택',
      icon: <CheckSquare size={14} />,
      shortcut: isMac ? '⌘A' : 'Ctrl+Shift+A',
      onClick: () => {
        termRef.current?.selectAll();
      },
    },
    {
      label: '화면 지우기',
      icon: <Trash2 size={14} />,
      shortcut: isMac ? '⌘K' : 'Ctrl+L',
      onClick: () => {
        termRef.current?.clear();
      },
    },
  ], [id, isMac]);

  return (
    <div
      ref={containerRef}
      onContextMenu={(e) => {
        e.preventDefault();
        e.stopPropagation();
        setContextMenu({ x: e.clientX, y: e.clientY });
      }}
      style={{
        width: '100%',
        height: '100%',
        backgroundColor: '#18181b',
        padding: '6px',
        overflow: 'hidden',
        boxSizing: 'border-box',
        position: 'relative',
      }}
    >
      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          isLight={false}
          items={terminalMenuItems}
          onClose={() => setContextMenu(null)}
        />
      )}
    </div>
  );
};
