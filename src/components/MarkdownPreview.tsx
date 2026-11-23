import React, { useMemo, useRef, useEffect } from 'react';
import { marked } from 'marked';
import DOMPurify from 'dompurify';

export interface CursorLineInfo {
  line: number;
  totalLines: number;
  timestamp: number;
}

export interface ScrollRatioInfo {
  ratio: number;
  timestamp: number;
}

interface MarkdownPreviewProps {
  content: string;
  isLight?: boolean;
  cursorLineInfo?: CursorLineInfo | null;
  scrollRatioInfo?: ScrollRatioInfo | null;
}

export const MarkdownPreview: React.FC<MarkdownPreviewProps> = ({
  content,
  isLight = false,
  cursorLineInfo,
  scrollRatioInfo,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);

  const htmlContent = useMemo(() => {
    try {
      const rawHtml = marked.parse(content || '', { async: false }) as string;
      return DOMPurify.sanitize(rawHtml);
    } catch (e) {
      return `<p style="color:red;">마크다운 렌더링 오류: ${e}</p>`;
    }
  }, [content]);

  // Synchronize rendered view location when editor cursor changes
  useEffect(() => {
    if (!cursorLineInfo || !containerRef.current) return;
    const container = containerRef.current;
    const { line, totalLines } = cursorLineInfo;
    if (totalLines <= 1) return;

    const maxScroll = container.scrollHeight - container.clientHeight;
    if (maxScroll <= 0) return;

    // 1. Heading-aware positioning:
    // Search upwards from cursor line to find active heading title
    const lines = content.split('\n');
    let activeHeading = '';
    for (let i = line - 1; i >= 0; i--) {
      const match = lines[i]?.match(/^#{1,6}\s+(.+)$/);
      if (match) {
        activeHeading = match[1].trim();
        break;
      }
    }

    if (activeHeading) {
      const headings = container.querySelectorAll('h1, h2, h3, h4, h5, h6');
      for (let i = 0; i < headings.length; i++) {
        const h = headings[i] as HTMLElement;
        if (h.textContent?.trim() === activeHeading) {
          const containerRect = container.getBoundingClientRect();
          const hRect = h.getBoundingClientRect();
          const targetTop = hRect.top - containerRect.top + container.scrollTop - 24;
          container.scrollTo({ top: Math.max(0, targetTop), behavior: 'smooth' });
          return;
        }
      }
    }

    // 2. Proportional smooth scroll based on cursor line
    const progress = Math.max(0, Math.min(1, (line - 1) / (totalLines - 1)));
    const targetScroll = progress * maxScroll;
    container.scrollTo({ top: targetScroll, behavior: 'smooth' });
  }, [cursorLineInfo, content]);

  // Synchronize view when editor scrolls
  useEffect(() => {
    if (!scrollRatioInfo || !containerRef.current) return;
    const container = containerRef.current;
    const maxScroll = container.scrollHeight - container.clientHeight;
    if (maxScroll <= 0) return;

    const targetScroll = scrollRatioInfo.ratio * maxScroll;
    container.scrollTop = targetScroll;
  }, [scrollRatioInfo]);

  const bgColor = isLight ? '#ffffff' : '#1e1e24';
  const textColor = isLight ? '#1f2937' : '#e4e4e7';
  const codeBg = isLight ? '#f3f4f6' : '#27272a';
  const borderColor = isLight ? '#e5e7eb' : '#3f3f46';
  const linkColor = isLight ? '#2563eb' : '#38bdf8';
  const quoteBg = isLight ? '#f9fafb' : '#18181b';
  const tableHeaderBg = isLight ? '#f3f4f6' : '#27272a';

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        backgroundColor: bgColor,
      }}
    >
      <style>{`
        .md-preview-body {
          color: ${textColor};
          line-height: 1.65;
          font-size: 14px;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
        }
        .md-preview-body h1, .md-preview-body h2, .md-preview-body h3, .md-preview-body h4, .md-preview-body h5, .md-preview-body h6 {
          color: ${isLight ? '#111827' : '#f9fafb'};
          margin-top: 24px;
          margin-bottom: 12px;
          font-weight: 600;
          line-height: 1.25;
        }
        .md-preview-body h1 {
          font-size: 1.8em;
          padding-bottom: 8px;
          border-bottom: 1px solid ${borderColor};
        }
        .md-preview-body h2 {
          font-size: 1.4em;
          padding-bottom: 6px;
          border-bottom: 1px solid ${borderColor};
        }
        .md-preview-body h3 { font-size: 1.2em; }
        .md-preview-body p { margin-top: 0; margin-bottom: 16px; }
        .md-preview-body a {
          color: ${linkColor};
          text-decoration: underline;
        }
        .md-preview-body code {
          background-color: ${codeBg};
          padding: 2px 6px;
          border-radius: 4px;
          font-size: 12px;
          font-family: Menlo, Monaco, Consolas, "Courier New", monospace;
        }
        .md-preview-body pre {
          background-color: ${codeBg};
          border: 1px solid ${borderColor};
          border-radius: 6px;
          padding: 12px 16px;
          overflow-x: auto;
          margin-bottom: 16px;
        }
        .md-preview-body pre code {
          background-color: transparent;
          padding: 0;
          border-radius: 0;
        }
        .md-preview-body blockquote {
          margin: 0 0 16px 0;
          padding: 8px 16px;
          border-left: 4px solid ${linkColor};
          background-color: ${quoteBg};
          border-radius: 0 4px 4px 0;
          color: ${isLight ? '#4b5563' : '#a1a1aa'};
        }
        .md-preview-body ul, .md-preview-body ol {
          padding-left: 24px;
          margin-top: 0;
          margin-bottom: 16px;
        }
        .md-preview-body li {
          margin-bottom: 4px;
        }
        .md-preview-body table {
          border-collapse: collapse;
          width: 100%;
          margin-bottom: 16px;
          border: 1px solid ${borderColor};
        }
        .md-preview-body th, .md-preview-body td {
          border: 1px solid ${borderColor};
          padding: 8px 12px;
          text-align: left;
        }
        .md-preview-body th {
          background-color: ${tableHeaderBg};
          font-weight: 600;
        }
        .md-preview-body hr {
          height: 1px;
          border: none;
          background-color: ${borderColor};
          margin: 24px 0;
        }
        .md-preview-body img {
          max-width: 100%;
          height: auto;
          border-radius: 4px;
        }
      `}</style>
      <div
        ref={containerRef}
        className="md-preview-body"
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '24px 32px',
          boxSizing: 'border-box',
          position: 'relative',
        }}
        dangerouslySetInnerHTML={{ __html: htmlContent }}
      />
    </div>
  );
};
