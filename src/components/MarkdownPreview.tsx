import React, { useMemo } from 'react';
import { marked } from 'marked';
import DOMPurify from 'dompurify';

interface MarkdownPreviewProps {
  content: string;
}

export const MarkdownPreview: React.FC<MarkdownPreviewProps> = ({ content }) => {
  const htmlContent = useMemo(() => {
    try {
      const rawHtml = marked.parse(content || '', { async: false }) as string;
      return DOMPurify.sanitize(rawHtml);
    } catch (e) {
      return `<p style="color:red;">Error rendering markdown: ${e}</p>`;
    }
  }, [content]);

  return (
    <div
      className="markdown-preview-container"
      style={{
        width: '100%',
        height: '100%',
        overflowY: 'auto',
        padding: '24px 32px',
        backgroundColor: '#1e1e24',
        color: '#e4e4e7',
        boxSizing: 'border-box',
        lineHeight: 1.6,
        fontSize: '14px',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
      }}
      dangerouslySetInnerHTML={{ __html: htmlContent }}
    />
  );
};
