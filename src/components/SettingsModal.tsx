import React, { useState } from 'react';
import { EditorSettings, DEFAULT_BLOCKED_EXTENSIONS, DEFAULT_AI_URLS } from '../types';
import {
  X,
  Type,
  Palette,
  Indent,
  Save,
  RotateCcw,
  ShieldAlert,
  Plus,
  Film,
  Database,
  Archive,
  Info,
  Bot,
} from 'lucide-react';

interface SettingsModalProps {
  isOpen: boolean;
  settings: EditorSettings;
  onUpdateSettings: (newSettings: EditorSettings) => void;
  onClose: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  settings,
  onUpdateSettings,
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState<'font' | 'theme' | 'indent' | 'save' | 'blocked' | 'ai'>('font');
  const [newExtInput, setNewExtInput] = useState('');

  if (!isOpen) return null;

  const update = <K extends keyof EditorSettings>(key: K, val: EditorSettings[K]) => {
    onUpdateSettings({ ...settings, [key]: val });
  };

  const isLight = settings.theme === 'vs';
  const blockedList = settings.blockedExtensions || DEFAULT_BLOCKED_EXTENSIONS;

  // Blocked extensions operations
  const handleAddExtension = () => {
    let clean = newExtInput.trim().toLowerCase();
    if (!clean) return;
    if (clean.startsWith('.')) clean = clean.slice(1);
    if (!clean) return;

    if (!blockedList.includes(clean)) {
      update('blockedExtensions', [...blockedList, clean]);
    }
    setNewExtInput('');
  };

  const handleRemoveExtension = (extToRemove: string) => {
    update(
      'blockedExtensions',
      blockedList.filter((ext) => ext !== extToRemove)
    );
  };

  const handleResetBlockedDefaults = () => {
    update('blockedExtensions', [...DEFAULT_BLOCKED_EXTENSIONS]);
  };

  const handleAddMediaPresets = () => {
    const media = [
      'mp4', 'mkv', 'avi', 'mov', 'wmv', 'flv', 'webm', 'm4v', '3gp', 'ts', 'mts',
      'mp3', 'wav', 'flac', 'aac', 'ogg', 'm4a', 'wma', 'aiff',
      'jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'ico', 'tiff', 'tif', 'psd', 'ai', 'raw', 'heic',
    ];
    const merged = Array.from(new Set([...blockedList, ...media]));
    update('blockedExtensions', merged);
  };

  const handleAddDbPresets = () => {
    const dbs = ['db', 'sqlite', 'sqlite3', 'dat', 'mdb', 'accdb', 'rdb'];
    const merged = Array.from(new Set([...blockedList, ...dbs]));
    update('blockedExtensions', merged);
  };

  const handleAddArchivePresets = () => {
    const archives = ['zip', 'rar', '7z', 'tar', 'gz', 'bz2', 'xz', 'tgz', 'iso', 'dmg'];
    const merged = Array.from(new Set([...blockedList, ...archives]));
    update('blockedExtensions', merged);
  };

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
        zIndex: 1000,
        backdropFilter: 'blur(3px)',
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '680px',
          height: '520px',
          backgroundColor: isLight ? '#ffffff' : '#1e1e24',
          color: isLight ? '#18181b' : '#f4f4f5',
          borderRadius: '10px',
          border: isLight ? '1px solid #e4e4e7' : '1px solid #3f3f46',
          boxShadow: '0 20px 40px rgba(0, 0, 0, 0.4)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            padding: '12px 18px',
            borderBottom: isLight ? '1px solid #e4e4e7' : '1px solid #27272a',
            backgroundColor: isLight ? '#f4f4f5' : '#18181b',
          }}
        >
          <span style={{ fontSize: '14px', fontWeight: 600 }}>환경 설정 (Preferences)</span>
          <div style={{ flex: 1 }} />
          <button
            onClick={onClose}
            style={{
              border: 'none',
              background: 'transparent',
              color: isLight ? '#71717a' : '#a1a1aa',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              padding: '4px',
              borderRadius: '4px',
            }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Body (Left sidebar + Right form) */}
        <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
          {/* Navigation */}
          <div
            style={{
              width: '175px',
              backgroundColor: isLight ? '#f4f4f5' : '#141416',
              borderRight: isLight ? '1px solid #e4e4e7' : '1px solid #27272a',
              display: 'flex',
              flexDirection: 'column',
              padding: '10px 8px',
              gap: '4px',
            }}
          >
            <button
              onClick={() => setActiveTab('font')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '8px 10px',
                borderRadius: '6px',
                border: 'none',
                backgroundColor: activeTab === 'font' ? (isLight ? '#e4e4e7' : '#27272a') : 'transparent',
                color: activeTab === 'font' ? '#38bdf8' : isLight ? '#3f3f46' : '#a1a1aa',
                fontSize: '12px',
                fontWeight: activeTab === 'font' ? 600 : 400,
                cursor: 'pointer',
                textAlign: 'left',
              }}
            >
              <Type size={14} />
              글꼴 및 표시
            </button>

            <button
              onClick={() => setActiveTab('theme')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '8px 10px',
                borderRadius: '6px',
                border: 'none',
                backgroundColor: activeTab === 'theme' ? (isLight ? '#e4e4e7' : '#27272a') : 'transparent',
                color: activeTab === 'theme' ? '#38bdf8' : isLight ? '#3f3f46' : '#a1a1aa',
                fontSize: '12px',
                fontWeight: activeTab === 'theme' ? 600 : 400,
                cursor: 'pointer',
                textAlign: 'left',
              }}
            >
              <Palette size={14} />
              테마 및 커서
            </button>

            <button
              onClick={() => setActiveTab('indent')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '8px 10px',
                borderRadius: '6px',
                border: 'none',
                backgroundColor: activeTab === 'indent' ? (isLight ? '#e4e4e7' : '#27272a') : 'transparent',
                color: activeTab === 'indent' ? '#38bdf8' : isLight ? '#3f3f46' : '#a1a1aa',
                fontSize: '12px',
                fontWeight: activeTab === 'indent' ? 600 : 400,
                cursor: 'pointer',
                textAlign: 'left',
              }}
            >
              <Indent size={14} />
              들여쓰기 및 서식
            </button>

            <button
              onClick={() => setActiveTab('save')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '8px 10px',
                borderRadius: '6px',
                border: 'none',
                backgroundColor: activeTab === 'save' ? (isLight ? '#e4e4e7' : '#27272a') : 'transparent',
                color: activeTab === 'save' ? '#38bdf8' : isLight ? '#3f3f46' : '#a1a1aa',
                fontSize: '12px',
                fontWeight: activeTab === 'save' ? 600 : 400,
                cursor: 'pointer',
                textAlign: 'left',
              }}
            >
              <Save size={14} />
              파일 및 인코딩
            </button>

            <button
              onClick={() => setActiveTab('blocked')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '8px 10px',
                borderRadius: '6px',
                border: 'none',
                backgroundColor: activeTab === 'blocked' ? (isLight ? '#e4e4e7' : '#27272a') : 'transparent',
                color: activeTab === 'blocked' ? '#38bdf8' : isLight ? '#3f3f46' : '#a1a1aa',
                fontSize: '12px',
                fontWeight: activeTab === 'blocked' ? 600 : 400,
                cursor: 'pointer',
                textAlign: 'left',
              }}
            >
              <ShieldAlert size={14} />
              바이너리 파일 제한
            </button>

            <button
              onClick={() => setActiveTab('ai')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '8px 10px',
                borderRadius: '6px',
                border: 'none',
                backgroundColor: activeTab === 'ai' ? (isLight ? '#e4e4e7' : '#27272a') : 'transparent',
                color: activeTab === 'ai' ? '#38bdf8' : isLight ? '#3f3f46' : '#a1a1aa',
                fontSize: '12px',
                fontWeight: activeTab === 'ai' ? 600 : 400,
                cursor: 'pointer',
                textAlign: 'left',
              }}
            >
              <Bot size={14} />
              AI 도우미 주소
            </button>
          </div>

          {/* Form Content */}
          <div style={{ flex: 1, padding: '18px 24px', overflowY: 'auto' }}>
            {/* 1. 글꼴 및 표시 */}
            {activeTab === 'font' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, marginBottom: '6px' }}>
                    글꼴 서체 (Font Family)
                  </label>
                  <input
                    type="text"
                    value={settings.fontFamily}
                    onChange={(e) => update('fontFamily', e.target.value)}
                    style={{
                      width: '100%',
                      padding: '6px 10px',
                      backgroundColor: isLight ? '#ffffff' : '#27272a',
                      border: isLight ? '1px solid #d4d4d8' : '1px solid #3f3f46',
                      borderRadius: '5px',
                      color: isLight ? '#18181b' : '#fff',
                      fontSize: '12px',
                      outline: 'none',
                    }}
                  />
                </div>

                <div style={{ display: 'flex', gap: '16px' }}>
                  <div style={{ flex: 1 }}>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, marginBottom: '6px' }}>
                      글꼴 크기 (Font Size): {settings.fontSize}px
                    </label>
                    <input
                      type="range"
                      min={10}
                      max={32}
                      value={settings.fontSize}
                      onChange={(e) => update('fontSize', Number(e.target.value))}
                      style={{ width: '100%' }}
                    />
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, marginBottom: '6px' }}>
                      줄 간격 (Line Height): {settings.lineHeight}px
                    </label>
                    <input
                      type="range"
                      min={14}
                      max={48}
                      value={settings.lineHeight}
                      onChange={(e) => update('lineHeight', Number(e.target.value))}
                      style={{ width: '100%' }}
                    />
                  </div>
                </div>

                <div style={{ borderTop: isLight ? '1px solid #e4e4e7' : '1px solid #27272a', paddingTop: '12px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', cursor: 'pointer', marginBottom: '8px' }}>
                    <input
                      type="checkbox"
                      checked={settings.showLineNumbers === 'on'}
                      onChange={(e) => update('showLineNumbers', e.target.checked ? 'on' : 'off')}
                    />
                    줄 번호 표시 (Line Numbers)
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={settings.showMinimap}
                      onChange={(e) => update('showMinimap', e.target.checked)}
                    />
                    코드 미니맵 표시 (Minimap)
                  </label>
                </div>
              </div>
            )}

            {/* 2. 테마 및 커서 */}
            {activeTab === 'theme' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, marginBottom: '6px' }}>
                    편집기 테마 (Theme)
                  </label>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    {[
                      { id: 'vs-dark', label: '어두운 테마 (Dark)' },
                      { id: 'vs', label: '밝은 테마 (Light)' },
                      { id: 'hc-black', label: '고대비 (High Contrast)' },
                    ].map((t) => (
                      <button
                        key={t.id}
                        onClick={() => update('theme', t.id as any)}
                        style={{
                          flex: 1,
                          padding: '8px',
                          borderRadius: '6px',
                          border: settings.theme === t.id ? '2px solid #38bdf8' : isLight ? '1px solid #d4d4d8' : '1px solid #3f3f46',
                          backgroundColor: settings.theme === t.id ? (isLight ? '#e0f2fe' : '#0369a1') : isLight ? '#f4f4f5' : '#27272a',
                          color: settings.theme === t.id ? (isLight ? '#0369a1' : '#fff') : isLight ? '#18181b' : '#d4d4d8',
                          fontSize: '11px',
                          fontWeight: 500,
                          cursor: 'pointer',
                        }}
                      >
                        {t.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '16px' }}>
                  <div style={{ flex: 1 }}>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, marginBottom: '6px' }}>
                      커서 스타일 (Cursor Style)
                    </label>
                    <select
                      value={settings.cursorStyle}
                      onChange={(e) => update('cursorStyle', e.target.value as any)}
                      style={{
                        width: '100%',
                        padding: '6px',
                        backgroundColor: isLight ? '#ffffff' : '#27272a',
                        border: isLight ? '1px solid #d4d4d8' : '1px solid #3f3f46',
                        borderRadius: '5px',
                        color: isLight ? '#18181b' : '#fff',
                        fontSize: '12px',
                      }}
                    >
                      <option value="line">라인 (|)</option>
                      <option value="block">블록 (█)</option>
                      <option value="underline">언더라인 (_)</option>
                    </select>
                  </div>

                  <div style={{ flex: 1 }}>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, marginBottom: '6px' }}>
                      커서 깜빡임 (Blinking)
                    </label>
                    <select
                      value={settings.cursorBlinking}
                      onChange={(e) => update('cursorBlinking', e.target.value as any)}
                      style={{
                        width: '100%',
                        padding: '6px',
                        backgroundColor: isLight ? '#ffffff' : '#27272a',
                        border: isLight ? '1px solid #d4d4d8' : '1px solid #3f3f46',
                        borderRadius: '5px',
                        color: isLight ? '#18181b' : '#fff',
                        fontSize: '12px',
                      }}
                    >
                      <option value="smooth">부드럽게 (Smooth)</option>
                      <option value="blink">일반 깜빡임 (Blink)</option>
                      <option value="solid">고정 (Solid)</option>
                    </select>
                  </div>
                </div>
              </div>
            )}

            {/* 3. 들여쓰기 및 서식 */}
            {activeTab === 'indent' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div style={{ display: 'flex', gap: '16px' }}>
                  <div style={{ flex: 1 }}>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, marginBottom: '6px' }}>
                      탭 크기 (Tab Size)
                    </label>
                    <select
                      value={settings.tabSize}
                      onChange={(e) => update('tabSize', Number(e.target.value))}
                      style={{
                        width: '100%',
                        padding: '6px',
                        backgroundColor: isLight ? '#ffffff' : '#27272a',
                        border: isLight ? '1px solid #d4d4d8' : '1px solid #3f3f46',
                        borderRadius: '5px',
                        color: isLight ? '#18181b' : '#fff',
                        fontSize: '12px',
                      }}
                    >
                      <option value={2}>2 칸</option>
                      <option value={4}>4 칸 (기본)</option>
                      <option value={8}>8 칸</option>
                    </select>
                  </div>

                  <div style={{ flex: 1 }}>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, marginBottom: '6px' }}>
                      자동 줄바꿈 (Word Wrap)
                    </label>
                    <select
                      value={settings.wordWrap}
                      onChange={(e) => update('wordWrap', e.target.value as any)}
                      style={{
                        width: '100%',
                        padding: '6px',
                        backgroundColor: isLight ? '#ffffff' : '#27272a',
                        border: isLight ? '1px solid #d4d4d8' : '1px solid #3f3f46',
                        borderRadius: '5px',
                        color: isLight ? '#18181b' : '#fff',
                        fontSize: '12px',
                      }}
                    >
                      <option value="on">화면 끝에서 줄바꿈 (On)</option>
                      <option value="off">줄바꿈 안 함 (Off)</option>
                    </select>
                  </div>
                </div>

                <div style={{ borderTop: isLight ? '1px solid #e4e4e7' : '1px solid #27272a', paddingTop: '12px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={settings.insertSpaces}
                      onChange={(e) => update('insertSpaces', e.target.checked)}
                    />
                    탭 키 입력 시 스페이스 공백으로 변환
                  </label>
                </div>
              </div>
            )}

            {/* 4. 파일 및 인코딩 */}
            {activeTab === 'save' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, marginBottom: '6px' }}>
                    기본 텍스트 인코딩 (Default Encoding)
                  </label>
                  <select
                    value={settings.defaultEncoding}
                    onChange={(e) => update('defaultEncoding', e.target.value as any)}
                    style={{
                      width: '100%',
                      padding: '6px',
                      backgroundColor: isLight ? '#ffffff' : '#27272a',
                      border: isLight ? '1px solid #d4d4d8' : '1px solid #3f3f46',
                      borderRadius: '5px',
                      color: isLight ? '#18181b' : '#fff',
                      fontSize: '12px',
                    }}
                  >
                    <option value="UTF-8">UTF-8 (표준 권장)</option>
                    <option value="EUC-KR">EUC-KR (레거시 한글 인코딩)</option>
                  </select>
                </div>

                <div style={{ borderTop: isLight ? '1px solid #e4e4e7' : '1px solid #27272a', paddingTop: '12px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', cursor: 'pointer', marginBottom: '10px' }}>
                    <input
                      type="checkbox"
                      checked={settings.autoSave}
                      onChange={(e) => update('autoSave', e.target.checked)}
                    />
                    주기적 자동 저장 활성화 (Auto-save)
                  </label>

                  {settings.autoSave && (
                    <div>
                      <label style={{ display: 'block', fontSize: '11px', color: '#71717a', marginBottom: '4px' }}>
                        자동 저장 지연 시간: {settings.autoSaveDelaySec}초
                      </label>
                      <input
                        type="range"
                        min={1}
                        max={10}
                        value={settings.autoSaveDelaySec}
                        onChange={(e) => update('autoSaveDelaySec', Number(e.target.value))}
                        style={{ width: '200px' }}
                      />
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* 5. 바이너리 파일 제한 (NEW) */}
            {activeTab === 'blocked' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                    <ShieldAlert size={16} color="#38bdf8" />
                    <span style={{ fontSize: '13px', fontWeight: 600 }}>
                      바이너리 파일 열기 제한 (Blocked Extensions)
                    </span>
                  </div>
                  <p style={{ fontSize: '11px', color: isLight ? '#52525b' : '#a1a1aa', margin: 0, lineHeight: 1.5 }}>
                    동영상, 사진, 음악 등 미디어 파일 및 데이터베이스(.db) 등 대용량 바이너리 파일의 오픈을 차단합니다.
                    특정 확장자를 추가하거나 태그의 ✖️를 눌러 차단을 해제할 수 있습니다.
                  </p>
                </div>

                {/* Info callout */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '8px 12px',
                    backgroundColor: isLight ? '#f0f9ff' : '#082f49',
                    border: isLight ? '1px solid #bae6fd' : '1px solid #0369a1',
                    borderRadius: '6px',
                    fontSize: '11px',
                    color: isLight ? '#0369a1' : '#bae6fd',
                  }}
                >
                  <Info size={14} style={{ flexShrink: 0 }} />
                  <span>
                    <strong>안내:</strong> .command, .sh, .bash 등 실행 스크립트 파일은 텍스트 편집이 가능하도록 기본적으로 열기가 허용되어 있습니다.
                  </span>
                </div>

                {/* Add new extension input */}
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, marginBottom: '6px' }}>
                    새로운 차단 확장자 추가
                  </label>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <input
                      type="text"
                      value={newExtInput}
                      onChange={(e) => setNewExtInput(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleAddExtension()}
                      placeholder="예: iso, dat, bak, bin (점 제외 또는 포함)"
                      style={{
                        flex: 1,
                        padding: '6px 10px',
                        backgroundColor: isLight ? '#ffffff' : '#27272a',
                        border: isLight ? '1px solid #d4d4d8' : '1px solid #3f3f46',
                        borderRadius: '5px',
                        color: isLight ? '#18181b' : '#fff',
                        fontSize: '12px',
                        outline: 'none',
                      }}
                    />
                    <button
                      onClick={handleAddExtension}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        padding: '6px 14px',
                        backgroundColor: '#38bdf8',
                        color: '#000',
                        border: 'none',
                        borderRadius: '5px',
                        fontSize: '12px',
                        fontWeight: 600,
                        cursor: 'pointer',
                      }}
                    >
                      <Plus size={14} />
                      추가
                    </button>
                  </div>
                </div>

                {/* Quick Presets */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                  <button
                    onClick={handleAddMediaPresets}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      padding: '4px 8px',
                      backgroundColor: isLight ? '#f4f4f5' : '#27272a',
                      border: isLight ? '1px solid #e4e4e7' : '1px solid #3f3f46',
                      borderRadius: '4px',
                      color: isLight ? '#3f3f46' : '#d4d4d8',
                      fontSize: '11px',
                      cursor: 'pointer',
                    }}
                    title="mp4, mkv, jpg, png, mp3 등 미디어 전체 추가"
                  >
                    <Film size={12} />
                    미디어 파일 일괄 추가
                  </button>

                  <button
                    onClick={handleAddDbPresets}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      padding: '4px 8px',
                      backgroundColor: isLight ? '#f4f4f5' : '#27272a',
                      border: isLight ? '1px solid #e4e4e7' : '1px solid #3f3f46',
                      borderRadius: '4px',
                      color: isLight ? '#3f3f46' : '#d4d4d8',
                      fontSize: '11px',
                      cursor: 'pointer',
                    }}
                    title="db, sqlite, sqlite3, dat 등 DB 파일 추가"
                  >
                    <Database size={12} />
                    DB/대용량 파일 추가
                  </button>

                  <button
                    onClick={handleAddArchivePresets}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      padding: '4px 8px',
                      backgroundColor: isLight ? '#f4f4f5' : '#27272a',
                      border: isLight ? '1px solid #e4e4e7' : '1px solid #3f3f46',
                      borderRadius: '4px',
                      color: isLight ? '#3f3f46' : '#d4d4d8',
                      fontSize: '11px',
                      cursor: 'pointer',
                    }}
                    title="zip, 7z, tar, gz 등 압축 파일 추가"
                  >
                    <Archive size={12} />
                    압축 파일 추가
                  </button>

                  <button
                    onClick={handleResetBlockedDefaults}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      padding: '4px 8px',
                      backgroundColor: isLight ? '#fef2f2' : '#450a0a',
                      border: isLight ? '1px solid #fecaca' : '1px solid #7f1d1d',
                      borderRadius: '4px',
                      color: isLight ? '#b91c1c' : '#fca5a5',
                      fontSize: '11px',
                      cursor: 'pointer',
                      marginLeft: 'auto',
                    }}
                    title="기본 설정으로 되돌립니다"
                  >
                    <RotateCcw size={12} />
                    기본값 복원
                  </button>
                </div>

                {/* Chips container */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                    <span style={{ fontSize: '11px', color: isLight ? '#71717a' : '#a1a1aa' }}>
                      현재 열기 차단 중인 확장자 목록 ({blockedList.length}개):
                    </span>
                  </div>

                  <div
                    style={{
                      display: 'flex',
                      flexWrap: 'wrap',
                      gap: '5px',
                      maxHeight: '140px',
                      overflowY: 'auto',
                      padding: '8px',
                      backgroundColor: isLight ? '#f4f4f5' : '#141416',
                      border: isLight ? '1px solid #e4e4e7' : '1px solid #27272a',
                      borderRadius: '6px',
                    }}
                  >
                    {blockedList.map((ext) => (
                      <span
                        key={ext}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                          padding: '2px 8px',
                          backgroundColor: isLight ? '#e4e4e7' : '#27272a',
                          color: isLight ? '#18181b' : '#f4f4f5',
                          borderRadius: '12px',
                          fontSize: '11px',
                          fontWeight: 500,
                          border: isLight ? '1px solid #d4d4d8' : '1px solid #3f3f46',
                        }}
                      >
                        .{ext}
                        <button
                          onClick={() => handleRemoveExtension(ext)}
                          title={`'${ext}' 차단 해제`}
                          style={{
                            border: 'none',
                            background: 'transparent',
                            color: isLight ? '#71717a' : '#a1a1aa',
                            cursor: 'pointer',
                            padding: 0,
                            display: 'flex',
                            alignItems: 'center',
                            marginLeft: '2px',
                          }}
                          onMouseEnter={(e) => (e.currentTarget.style.color = '#ef4444')}
                          onMouseLeave={(e) => (e.currentTarget.style.color = isLight ? '#71717a' : '#a1a1aa')}
                        >
                          <X size={11} />
                        </button>
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* 6. AI 도우미 접속 주소 설정 */}
            {activeTab === 'ai' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div style={{ borderBottom: isLight ? '1px solid #e4e4e7' : '1px solid #27272a', paddingBottom: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                    <Bot size={16} color="#38bdf8" />
                    <span style={{ fontSize: '13px', fontWeight: 600 }}>
                      AI 도우미 접속 주소 (URL) 설정
                    </span>
                  </div>
                  <p style={{ margin: 0, fontSize: '11px', color: isLight ? '#71717a' : '#a1a1aa', lineHeight: 1.5 }}>
                    회사 사내 프라이빗 엔터프라이즈 AI 포털이나 맞춤 프록시 웹 주소를 설정할 수 있습니다.
                  </p>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, marginBottom: '6px' }}>
                    Google Gemini 접속 주소
                  </label>
                  <input
                    type="text"
                    value={settings.aiUrls?.gemini ?? DEFAULT_AI_URLS.gemini}
                    onChange={(e) => update('aiUrls', { ...(settings.aiUrls || DEFAULT_AI_URLS), gemini: e.target.value })}
                    placeholder="https://gemini.google.com/app"
                    style={{
                      width: '100%',
                      padding: '6px 10px',
                      backgroundColor: isLight ? '#ffffff' : '#27272a',
                      border: isLight ? '1px solid #d4d4d8' : '1px solid #3f3f46',
                      borderRadius: '5px',
                      color: isLight ? '#18181b' : '#fff',
                      fontSize: '12px',
                      outline: 'none',
                    }}
                  />
                  <span style={{ fontSize: '10px', color: isLight ? '#71717a' : '#71717a', marginTop: '4px', display: 'block' }}>
                    기본값: {DEFAULT_AI_URLS.gemini}
                  </span>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, marginBottom: '6px' }}>
                    ChatGPT (Codex) 접속 주소
                  </label>
                  <input
                    type="text"
                    value={settings.aiUrls?.chatgpt ?? DEFAULT_AI_URLS.chatgpt}
                    onChange={(e) => update('aiUrls', { ...(settings.aiUrls || DEFAULT_AI_URLS), chatgpt: e.target.value })}
                    placeholder="https://chatgpt.com"
                    style={{
                      width: '100%',
                      padding: '6px 10px',
                      backgroundColor: isLight ? '#ffffff' : '#27272a',
                      border: isLight ? '1px solid #d4d4d8' : '1px solid #3f3f46',
                      borderRadius: '5px',
                      color: isLight ? '#18181b' : '#fff',
                      fontSize: '12px',
                      outline: 'none',
                    }}
                  />
                  <span style={{ fontSize: '10px', color: isLight ? '#71717a' : '#71717a', marginTop: '4px', display: 'block' }}>
                    기본값: {DEFAULT_AI_URLS.chatgpt}
                  </span>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, marginBottom: '6px' }}>
                    Anthropic Claude 접속 주소
                  </label>
                  <input
                    type="text"
                    value={settings.aiUrls?.claude ?? DEFAULT_AI_URLS.claude}
                    onChange={(e) => update('aiUrls', { ...(settings.aiUrls || DEFAULT_AI_URLS), claude: e.target.value })}
                    placeholder="https://claude.ai/new"
                    style={{
                      width: '100%',
                      padding: '6px 10px',
                      backgroundColor: isLight ? '#ffffff' : '#27272a',
                      border: isLight ? '1px solid #d4d4d8' : '1px solid #3f3f46',
                      borderRadius: '5px',
                      color: isLight ? '#18181b' : '#fff',
                      fontSize: '12px',
                      outline: 'none',
                    }}
                  />
                  <span style={{ fontSize: '10px', color: isLight ? '#71717a' : '#71717a', marginTop: '4px', display: 'block' }}>
                    기본값: {DEFAULT_AI_URLS.claude}
                  </span>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, marginBottom: '6px' }}>
                    사내 엔터프라이즈 AI 접속 주소 (Enterprise Portal)
                  </label>
                  <input
                    type="text"
                    value={settings.aiUrls?.enterprise ?? ''}
                    onChange={(e) => update('aiUrls', { ...(settings.aiUrls || DEFAULT_AI_URLS), enterprise: e.target.value })}
                    placeholder="예: https://ai.mycompany.internal 또는 사내 AI 웹 주소"
                    style={{
                      width: '100%',
                      padding: '6px 10px',
                      backgroundColor: isLight ? '#ffffff' : '#27272a',
                      border: isLight ? '1px solid #d4d4d8' : '1px solid #3f3f46',
                      borderRadius: '5px',
                      color: isLight ? '#18181b' : '#fff',
                      fontSize: '12px',
                      outline: 'none',
                    }}
                  />
                  <span style={{ fontSize: '10px', color: isLight ? '#71717a' : '#71717a', marginTop: '4px', display: 'block' }}>
                    사내 전용 포털 주소를 입력하면 AI 도우미 사이드 패널 상단에 '사내 AI' 탭이 활성화됩니다.
                  </span>
                </div>

                <div style={{ paddingTop: '8px' }}>
                  <button
                    onClick={() => update('aiUrls', { ...DEFAULT_AI_URLS })}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '6px 12px',
                      backgroundColor: isLight ? '#e4e4e7' : '#27272a',
                      border: isLight ? '1px solid #d4d4d8' : '1px solid #3f3f46',
                      borderRadius: '5px',
                      color: isLight ? '#18181b' : '#e4e4e7',
                      fontSize: '11px',
                      fontWeight: 500,
                      cursor: 'pointer',
                    }}
                  >
                    <RotateCcw size={12} />
                    기본 접속 주소로 초기화
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'flex-end',
            padding: '10px 18px',
            borderTop: isLight ? '1px solid #e4e4e7' : '1px solid #27272a',
            backgroundColor: isLight ? '#f4f4f5' : '#18181b',
          }}
        >
          <button
            onClick={onClose}
            style={{
              padding: '6px 16px',
              backgroundColor: '#38bdf8',
              color: '#000',
              border: 'none',
              borderRadius: '5px',
              fontSize: '12px',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            확인 및 닫기
          </button>
        </div>
      </div>
    </div>
  );
};
