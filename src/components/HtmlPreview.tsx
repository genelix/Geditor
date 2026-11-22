import React, { useState, useMemo } from 'react';
import {
  RefreshCw,
  ExternalLink,
  Monitor,
  Tablet,
  Smartphone,
  Sun,
  Moon,
  Globe,
} from 'lucide-react';
import { openPath } from '@tauri-apps/plugin-opener';

interface HtmlPreviewProps {
  content: string;
  filePath?: string;
  isLight?: boolean;
}

export const HtmlPreview: React.FC<HtmlPreviewProps> = ({
  content,
  filePath,
  isLight = false,
}) => {
  const [viewportMode, setViewportMode] = useState<'responsive' | 'tablet' | 'mobile'>('responsive');
  const [bgMode, setBgMode] = useState<'white' | 'dark'>('white');
  const [reloadKey, setReloadKey] = useState(0);

  // Calculate base directory for resolving relative paths (CSS, images, JS)
  const preparedHtml = useMemo(() => {
    let html = content || '<!DOCTYPE html><html><head><meta charset="utf-8"></head><body><p style="color:#888;padding:16px;">내용이 비어 있습니다.</p></body></html>';

    // Inject base href if filePath exists and no <base> tag is present
    if (filePath && !/<base\s/i.test(html)) {
      const lastSlash = filePath.lastIndexOf('/');
      const baseDir = lastSlash !== -1 ? filePath.substring(0, lastSlash) : '';
      if (baseDir) {
        const baseTag = `<base href="file://${baseDir}/">`;
        if (/<head[^>]*>/i.test(html)) {
          html = html.replace(/<head[^>]*>/i, `$&${baseTag}`);
        } else if (/<html[^>]*>/i.test(html)) {
          html = html.replace(/<html[^>]*>/i, `$&<head>${baseTag}</head>`);
        } else {
          html = `<head>${baseTag}</head>${html}`;
        }
      }
    }

    return html;
  }, [content, filePath]);

  const handleOpenInBrowser = async () => {
    if (!filePath) {
      alert('파일을 먼저 저장해야 기본 브라우저에서 열 수 있습니다.');
      return;
    }
    try {
      await openPath(filePath);
    } catch (e) {
      alert(`외부 브라우저 열기 실패: ${e}`);
    }
  };

  const getContainerWidth = () => {
    switch (viewportMode) {
      case 'mobile':
        return '375px';
      case 'tablet':
        return '768px';
      case 'responsive':
      default:
        return '100%';
    }
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        width: '100%',
        height: '100%',
        backgroundColor: isLight ? '#f4f4f5' : '#141416',
        overflow: 'hidden',
      }}
    >
      {/* Top Preview Toolbar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          padding: '4px 10px',
          backgroundColor: isLight ? '#e4e4e7' : '#18181b',
          borderBottom: isLight ? '1px solid #d4d4d8' : '1px solid #27272a',
          fontSize: '11px',
          userSelect: 'none',
        }}
      >
        <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#38bdf8', fontWeight: 600 }}>
          <Globe size={13} />
          HTML 실시간 렌더링
        </span>

        <div style={{ width: '1px', height: '14px', backgroundColor: isLight ? '#d4d4d8' : '#3f3f46', margin: '0 4px' }} />

        {/* Viewport size buttons */}
        <button
          onClick={() => setViewportMode('responsive')}
          title="데스크톱 (100% 반응형)"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '3px',
            padding: '2px 6px',
            borderRadius: '3px',
            border: 'none',
            cursor: 'pointer',
            backgroundColor: viewportMode === 'responsive' ? '#38bdf8' : 'transparent',
            color: viewportMode === 'responsive' ? '#000' : isLight ? '#52525b' : '#a1a1aa',
            fontWeight: viewportMode === 'responsive' ? 600 : 400,
          }}
        >
          <Monitor size={12} />
          100%
        </button>

        <button
          onClick={() => setViewportMode('tablet')}
          title="태블릿 뷰 (768px)"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '3px',
            padding: '2px 6px',
            borderRadius: '3px',
            border: 'none',
            cursor: 'pointer',
            backgroundColor: viewportMode === 'tablet' ? '#38bdf8' : 'transparent',
            color: viewportMode === 'tablet' ? '#000' : isLight ? '#52525b' : '#a1a1aa',
            fontWeight: viewportMode === 'tablet' ? 600 : 400,
          }}
        >
          <Tablet size={12} />
          768px
        </button>

        <button
          onClick={() => setViewportMode('mobile')}
          title="모바일 뷰 (375px)"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '3px',
            padding: '2px 6px',
            borderRadius: '3px',
            border: 'none',
            cursor: 'pointer',
            backgroundColor: viewportMode === 'mobile' ? '#38bdf8' : 'transparent',
            color: viewportMode === 'mobile' ? '#000' : isLight ? '#52525b' : '#a1a1aa',
            fontWeight: viewportMode === 'mobile' ? 600 : 400,
          }}
        >
          <Smartphone size={12} />
          375px
        </button>

        <div style={{ width: '1px', height: '14px', backgroundColor: isLight ? '#d4d4d8' : '#3f3f46', margin: '0 4px' }} />

        {/* Background color toggle */}
        <button
          onClick={() => setBgMode((prev) => (prev === 'white' ? 'dark' : 'white'))}
          title={bgMode === 'white' ? '어두운 배경으로 변경' : '밝은 배경으로 변경'}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '3px',
            padding: '2px 6px',
            borderRadius: '3px',
            border: 'none',
            cursor: 'pointer',
            backgroundColor: 'transparent',
            color: isLight ? '#52525b' : '#a1a1aa',
          }}
        >
          {bgMode === 'white' ? <Moon size={12} /> : <Sun size={12} />}
          {bgMode === 'white' ? '다크 배경' : '라이트 배경'}
        </button>

        {/* Reload button */}
        <button
          onClick={() => setReloadKey((k) => k + 1)}
          title="페이지 새로고침"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '3px',
            padding: '2px 6px',
            borderRadius: '3px',
            border: 'none',
            cursor: 'pointer',
            backgroundColor: 'transparent',
            color: isLight ? '#52525b' : '#a1a1aa',
          }}
        >
          <RefreshCw size={12} />
          새로고침
        </button>

        <div style={{ flex: 1 }} />

        {/* Open in external browser */}
        {filePath && (
          <button
            onClick={handleOpenInBrowser}
            title="기본 웹 브라우저에서 열기"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              padding: '2px 8px',
              borderRadius: '3px',
              border: isLight ? '1px solid #d4d4d8' : '1px solid #3f3f46',
              cursor: 'pointer',
              backgroundColor: isLight ? '#ffffff' : '#27272a',
              color: isLight ? '#18181b' : '#f4f4f5',
              fontSize: '11px',
            }}
          >
            <ExternalLink size={12} />
            브라우저로 열기
          </button>
        )}
      </div>

      {/* Preview Viewport Frame */}
      <div
        style={{
          flex: 1,
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'stretch',
          backgroundColor: isLight ? '#f4f4f5' : '#141416',
          overflow: 'auto',
          padding: viewportMode === 'responsive' ? 0 : '16px',
          boxSizing: 'border-box',
        }}
      >
        <div
          style={{
            width: getContainerWidth(),
            height: '100%',
            backgroundColor: bgMode === 'white' ? '#ffffff' : '#18181b',
            boxShadow: viewportMode === 'responsive' ? 'none' : '0 10px 30px rgba(0, 0, 0, 0.4)',
            borderRadius: viewportMode === 'responsive' ? 0 : '8px',
            overflow: 'hidden',
            transition: 'width 0.2s ease',
            display: 'flex',
          }}
        >
          <iframe
            key={reloadKey}
            title="HTML Preview"
            srcDoc={preparedHtml}
            sandbox="allow-scripts allow-modals allow-forms allow-same-origin"
            style={{
              width: '100%',
              height: '100%',
              border: 'none',
              backgroundColor: bgMode === 'white' ? '#ffffff' : '#18181b',
            }}
          />
        </div>
      </div>
    </div>
  );
};
