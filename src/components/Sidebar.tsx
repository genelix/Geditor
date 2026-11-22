import React, { useState, useMemo } from 'react';
import {
  Folder,
  FolderOpen,
  FileCode,
  FileText,
  FileSpreadsheet,
  File,
  Search,
  Files,
  Plus,
  RefreshCw,
  Trash2,
  ChevronRight,
  ChevronDown,
  Film,
  Image,
  Music,
  Archive,
  Edit2,
  FilePlus,
  FolderPlus,
  Copy,
} from 'lucide-react';
import { FileNode, SearchMatch } from '../types';
import { tauriApi, isSupportedTextFile } from '../services/tauriApi';
import { ContextMenu, ContextMenuItem } from './ContextMenu';

interface SidebarProps {
  workspacePath: string;
  files: FileNode[];
  isLight?: boolean;
  width: number;
  blockedExtensions?: string[];
  onOpenFile: (path: string) => void;
  onRefreshWorkspace: () => void;
  onSelectSearchResult: (match: SearchMatch) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  workspacePath,
  files,
  isLight = false,
  width,
  blockedExtensions,
  onOpenFile,
  onRefreshWorkspace,
  onSelectSearchResult,
}) => {
  const [activeTab, setActiveTab] = useState<'files' | 'search'>('files');

  // New file / folder dialog state
  const [creatingType, setCreatingType] = useState<'file' | 'dir' | null>(null);
  const [createName, setCreateName] = useState('');
  const [targetParentDir, setTargetParentDir] = useState<string>(workspacePath);

  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [isRegex, setIsRegex] = useState(false);
  const [matchCase, setMatchCase] = useState(false);
  const [searchResults, setSearchResults] = useState<SearchMatch[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  // Expanded folders cache
  const [expandedFolders, setExpandedFolders] = useState<Record<string, FileNode[]>>({});

  // Context Menu State
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    item?: FileNode;
  } | null>(null);

  const handleToggleFolder = async (folderPath: string) => {
    if (expandedFolders[folderPath]) {
      const next = { ...expandedFolders };
      delete next[folderPath];
      setExpandedFolders(next);
    } else {
      try {
        const children = await tauriApi.listDirectory(folderPath);
        setExpandedFolders((prev) => ({ ...prev, [folderPath]: children }));
      } catch (e) {
        console.error('Failed to list sub directory:', e);
      }
    }
  };

  const handleStartCreate = (type: 'file' | 'dir', parentDir?: string) => {
    setTargetParentDir(parentDir || workspacePath);
    setCreatingType(type);
    setCreateName('');
  };

  const handleCreateEntry = async () => {
    if (!createName.trim()) return;
    const parent = targetParentDir || workspacePath;
    const targetPath = `${parent}/${createName.trim()}`;
    try {
      if (creatingType === 'file') {
        await tauriApi.createFile(targetPath);
      } else if (creatingType === 'dir') {
        await tauriApi.createDir(targetPath);
      }
      setCreatingType(null);
      setCreateName('');
      onRefreshWorkspace();
    } catch (e) {
      alert(`생성 중 오류 발생: ${e}`);
    }
  };

  const handleDeleteEntry = async (path: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const itemName = path.split('/').pop();
    if (confirm(`정말로 "${itemName}" 항목을 삭제하시겠습니까?`)) {
      try {
        await tauriApi.deleteEntry(path);
        onRefreshWorkspace();
      } catch (err) {
        alert(`삭제 실패: ${err}`);
      }
    }
  };

  const handleRenameEntry = async (item: FileNode) => {
    const newName = window.prompt(`"${item.name}"의 새 이름을 입력하세요:`, item.name);
    if (!newName || !newName.trim() || newName.trim() === item.name) return;
    const lastSlash = item.path.lastIndexOf('/');
    const parentDir = lastSlash !== -1 ? item.path.substring(0, lastSlash) : workspacePath;
    const newPath = `${parentDir}/${newName.trim()}`;
    try {
      await tauriApi.renameEntry(item.path, newPath);
      onRefreshWorkspace();
    } catch (err) {
      alert(`이름 변경 실패: ${err}`);
    }
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    setIsSearching(true);
    try {
      const results = await tauriApi.searchInFiles(
        workspacePath,
        searchQuery,
        isRegex,
        matchCase
      );
      setSearchResults(results);
    } catch (err) {
      alert(`검색 중 오류: ${err}`);
    } finally {
      setIsSearching(false);
    }
  };

  const getFileIcon = (name: string, isDir: boolean, isExpanded: boolean) => {
    if (isDir) {
      return isExpanded ? (
        <FolderOpen size={14} color="#38bdf8" />
      ) : (
        <Folder size={14} color="#38bdf8" />
      );
    }
    const ext = name.split('.').pop()?.toLowerCase() || '';
    switch (ext) {
      // Media / Video
      case 'mp4':
      case 'mkv':
      case 'avi':
      case 'mov':
      case 'wmv':
      case 'webm':
      case 'flv':
      case 'm4v':
        return <Film size={14} color="#f43f5e" />;
      // Images
      case 'jpg':
      case 'jpeg':
      case 'png':
      case 'gif':
      case 'bmp':
      case 'webp':
      case 'ico':
      case 'tiff':
        return <Image size={14} color="#ec4899" />;
      // Audio
      case 'mp3':
      case 'wav':
      case 'flac':
      case 'aac':
      case 'ogg':
      case 'm4a':
        return <Music size={14} color="#a855f7" />;
      // Archives
      case 'zip':
      case 'tar':
      case 'gz':
      case '7z':
      case 'rar':
      case 'bz2':
        return <Archive size={14} color="#eab308" />;
      // Subtitles & Text Docs
      case 'smi':
      case 'srt':
      case 'vtt':
      case 'sub':
      case 'ass':
      case 'txt':
      case 'log':
        return <FileText size={14} color="#38bdf8" />;
      // Markdown
      case 'md':
      case 'markdown':
        return <FileText size={14} color="#38bdf8" />;
      // Spreadsheet / CSV
      case 'csv':
      case 'tsv':
        return <FileSpreadsheet size={14} color="#22c55e" />;
      // Code files
      case 'rs':
        return <FileCode size={14} color="#f97316" />;
      case 'ts':
      case 'tsx':
        return <FileCode size={14} color="#3b82f6" />;
      case 'js':
      case 'jsx':
        return <FileCode size={14} color="#facc15" />;
      case 'json':
      case 'html':
      case 'css':
      case 'scss':
      case 'py':
      case 'yaml':
      case 'yml':
      case 'sql':
      case 'sh':
      case 'bash':
      case 'zsh':
      case 'command':
      case 'bat':
      case 'c':
      case 'cpp':
      case 'h':
      case 'hpp':
        return <FileCode size={14} color="#fbbf24" />;
      default:
        return <File size={14} color="#9ca3af" />;
    }
  };

  // Build Context Menu Items
  const contextMenuItems: ContextMenuItem[] = useMemo(() => {
    if (!contextMenu) return [];
    const item = contextMenu.item;

    if (!item) {
      // Empty area context menu
      return [
        {
          label: '새 파일 생성...',
          icon: <FilePlus size={14} />,
          onClick: () => handleStartCreate('file', workspacePath),
        },
        {
          label: '새 폴더 생성...',
          icon: <FolderPlus size={14} />,
          onClick: () => handleStartCreate('dir', workspacePath),
        },
        { separator: true },
        {
          label: '목록 새로고침',
          icon: <RefreshCw size={14} />,
          onClick: onRefreshWorkspace,
        },
      ];
    }

    if (item.is_dir) {
      // Directory context menu
      return [
        {
          label: '새 파일 생성...',
          icon: <FilePlus size={14} />,
          onClick: () => handleStartCreate('file', item.path),
        },
        {
          label: '새 폴더 생성...',
          icon: <FolderPlus size={14} />,
          onClick: () => handleStartCreate('dir', item.path),
        },
        { separator: true },
        {
          label: '이름 바꾸기...',
          icon: <Edit2 size={14} />,
          onClick: () => handleRenameEntry(item),
        },
        {
          label: '전체 경로 복사',
          icon: <Copy size={14} />,
          onClick: () => navigator.clipboard.writeText(item.path),
        },
        { separator: true },
        {
          label: '목록 새로고침',
          icon: <RefreshCw size={14} />,
          onClick: onRefreshWorkspace,
        },
        { separator: true },
        {
          label: '삭제',
          icon: <Trash2 size={14} />,
          danger: true,
          onClick: () => handleDeleteEntry(item.path),
        },
      ];
    }

    // File context menu
    return [
      {
        label: '파일 열기',
        icon: <FileText size={14} />,
        onClick: () => onOpenFile(item.path),
      },
      { separator: true },
      {
        label: '이름 바꾸기...',
        icon: <Edit2 size={14} />,
        onClick: () => handleRenameEntry(item),
      },
      {
        label: '전체 경로 복사',
        icon: <Copy size={14} />,
        onClick: () => navigator.clipboard.writeText(item.path),
      },
      {
        label: '파일 이름 복사',
        icon: <Copy size={14} />,
        onClick: () => navigator.clipboard.writeText(item.name),
      },
      { separator: true },
      {
        label: '삭제',
        icon: <Trash2 size={14} />,
        danger: true,
        onClick: () => handleDeleteEntry(item.path),
      },
    ];
  }, [contextMenu, workspacePath, onRefreshWorkspace, onOpenFile]);

  const renderFileList = (items: FileNode[], depth = 0) => {
    return items.map((item) => {
      const isExpanded = !!expandedFolders[item.path];
      const isBinary = !item.is_dir && !isSupportedTextFile(item.name, blockedExtensions).ok;

      return (
        <div key={item.path}>
          <div
            onClick={() => {
              if (item.is_dir) {
                handleToggleFolder(item.path);
              } else {
                onOpenFile(item.path);
              }
            }}
            onContextMenu={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setContextMenu({ x: e.clientX, y: e.clientY, item });
            }}
            title={item.name}
            style={{
              display: 'flex',
              alignItems: 'center',
              padding: '4px 8px',
              paddingLeft: `${depth * 14 + 10}px`,
              fontSize: '12px',
              color: isBinary
                ? isLight
                  ? '#9ca3af'
                  : '#71717a'
                : isLight
                ? '#27272a'
                : '#d4d4d8',
              cursor: 'pointer',
              userSelect: 'none',
              gap: '6px',
              minWidth: 'max-content',
            }}
            onMouseEnter={(e) =>
              (e.currentTarget.style.backgroundColor = isLight ? '#e4e4e7' : '#27272a')
            }
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
          >
            {item.is_dir ? (
              isExpanded ? (
                <ChevronDown size={12} color="#71717a" />
              ) : (
                <ChevronRight size={12} color="#71717a" />
              )
            ) : (
              <span style={{ width: '12px' }} />
            )}
            {getFileIcon(item.name, item.is_dir, isExpanded)}
            <span
              style={{
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                maxWidth: `${Math.max(120, width - (depth * 14 + 75))}px`,
                fontWeight: isBinary ? 400 : 450,
              }}
              title={item.name}
            >
              {item.name}
            </span>

            {/* Quick delete on hover */}
            <button
              onClick={(e) => handleDeleteEntry(item.path, e)}
              style={{
                border: 'none',
                background: 'transparent',
                color: '#71717a',
                cursor: 'pointer',
                padding: '2px',
                display: 'none',
              }}
              title="삭제"
              className="file-hover-action"
            >
              <Trash2 size={12} />
            </button>
          </div>

          {/* Sub directory children */}
          {item.is_dir && isExpanded && expandedFolders[item.path] && (
            <div>{renderFileList(expandedFolders[item.path], depth + 1)}</div>
          )}
        </div>
      );
    });
  };

  const workspaceName = workspacePath.split('/').pop() || '워크스페이스';

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        width: `${width}px`,
        minWidth: `${width}px`,
        maxWidth: `${width}px`,
        height: '100%',
        backgroundColor: isLight ? '#f4f4f5' : '#141416',
        borderRight: isLight ? '1px solid #e4e4e7' : '1px solid #27272a',
        boxSizing: 'border-box',
        overflow: 'hidden',
      }}
    >
      {/* Sidebar Tabs */}
      <div
        style={{
          display: 'flex',
          borderBottom: isLight ? '1px solid #e4e4e7' : '1px solid #27272a',
          backgroundColor: isLight ? '#e4e4e7' : '#18181b',
        }}
      >
        <button
          onClick={() => setActiveTab('files')}
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px',
            padding: '7px 0',
            border: 'none',
            borderBottom: activeTab === 'files' ? '2px solid #38bdf8' : 'none',
            background: 'transparent',
            color: activeTab === 'files' ? '#38bdf8' : isLight ? '#71717a' : '#a1a1aa',
            fontSize: '11px',
            fontWeight: activeTab === 'files' ? 600 : 400,
            cursor: 'pointer',
          }}
        >
          <Files size={13} />
          <span>탐색기</span>
        </button>
        <button
          onClick={() => setActiveTab('search')}
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px',
            padding: '7px 0',
            border: 'none',
            borderBottom: activeTab === 'search' ? '2px solid #38bdf8' : 'none',
            background: 'transparent',
            color: activeTab === 'search' ? '#38bdf8' : isLight ? '#71717a' : '#a1a1aa',
            fontSize: '11px',
            fontWeight: activeTab === 'search' ? 600 : 400,
            cursor: 'pointer',
          }}
        >
          <Search size={13} />
          <span>전체 검색</span>
        </button>
      </div>

      {/* Explorer Mode */}
      {activeTab === 'files' && (
        <div
          style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
          onContextMenu={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setContextMenu({ x: e.clientX, y: e.clientY });
          }}
        >
          {/* Workspace Root Header */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              padding: '6px 10px',
              fontSize: '11px',
              fontWeight: 600,
              color: isLight ? '#52525b' : '#a1a1aa',
              gap: '6px',
              borderBottom: isLight ? '1px solid #e4e4e7' : '1px solid #27272a',
            }}
          >
            <Folder size={13} color="#0284c7" />
            <span
              style={{
                flex: 1,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
              title={workspacePath}
            >
              {workspaceName}
            </span>
            <button
              onClick={() => handleStartCreate('file', workspacePath)}
              style={{
                border: 'none',
                background: 'transparent',
                color: isLight ? '#52525b' : '#a1a1aa',
                cursor: 'pointer',
                padding: '2px',
              }}
              title="새 파일 생성"
            >
              <Plus size={14} />
            </button>
            <button
              onClick={() => handleStartCreate('dir', workspacePath)}
              style={{
                border: 'none',
                background: 'transparent',
                color: isLight ? '#52525b' : '#a1a1aa',
                cursor: 'pointer',
                padding: '2px',
              }}
              title="새 폴더 생성"
            >
              <Folder size={14} />
            </button>
            <button
              onClick={onRefreshWorkspace}
              style={{
                border: 'none',
                background: 'transparent',
                color: isLight ? '#52525b' : '#a1a1aa',
                cursor: 'pointer',
                padding: '2px',
              }}
              title="목록 새로고침"
            >
              <RefreshCw size={12} />
            </button>
          </div>

          {/* New Entry Input */}
          {creatingType && (
            <div
              style={{
                padding: '8px',
                backgroundColor: isLight ? '#e4e4e7' : '#1e1e24',
                borderBottom: isLight ? '1px solid #d4d4d8' : '1px solid #27272a',
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div
                style={{
                  fontSize: '11px',
                  color: isLight ? '#52525b' : '#a1a1aa',
                  marginBottom: '4px',
                }}
              >
                {creatingType === 'file' ? '새 파일 이름 입력:' : '새 폴더 이름 입력:'}
              </div>
              <input
                type="text"
                value={createName}
                autoFocus
                onChange={(e) => setCreateName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleCreateEntry();
                  if (e.key === 'Escape') setCreatingType(null);
                }}
                placeholder={creatingType === 'file' ? '예: main.py, memo.txt' : '예: src, docs'}
                style={{
                  width: '100%',
                  padding: '4px 6px',
                  backgroundColor: isLight ? '#ffffff' : '#27272a',
                  border: '1px solid #38bdf8',
                  borderRadius: '3px',
                  color: isLight ? '#18181b' : '#fff',
                  fontSize: '12px',
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'flex-end',
                  gap: '4px',
                  marginTop: '4px',
                }}
              >
                <button
                  onClick={() => setCreatingType(null)}
                  style={{
                    fontSize: '10px',
                    padding: '2px 6px',
                    background: isLight ? '#d4d4d8' : '#27272a',
                    border: 'none',
                    color: isLight ? '#18181b' : '#a1a1aa',
                    borderRadius: '2px',
                    cursor: 'pointer',
                  }}
                >
                  취소
                </button>
                <button
                  onClick={handleCreateEntry}
                  style={{
                    fontSize: '10px',
                    padding: '2px 6px',
                    background: '#38bdf8',
                    border: 'none',
                    color: '#000',
                    borderRadius: '2px',
                    cursor: 'pointer',
                    fontWeight: 600,
                  }}
                >
                  생성
                </button>
              </div>
            </div>
          )}

          {/* File Tree with Horizontal and Vertical Scrolling */}
          <div
            style={{
              flex: 1,
              overflowY: 'auto',
              overflowX: 'auto',
              padding: '4px 0',
            }}
          >
            {renderFileList(files)}
          </div>
        </div>
      )}

      {/* Search Mode */}
      {activeTab === 'search' && (
        <div
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            padding: '10px',
            gap: '8px',
          }}
        >
          <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              placeholder="워크스페이스 전체 검색..."
              style={{
                flex: 1,
                padding: '5px 8px',
                backgroundColor: isLight ? '#ffffff' : '#27272a',
                border: isLight ? '1px solid #d4d4d8' : '1px solid #3f3f46',
                borderRadius: '4px',
                color: isLight ? '#18181b' : '#fff',
                fontSize: '12px',
                outline: 'none',
              }}
            />
            <button
              onClick={handleSearch}
              disabled={isSearching}
              style={{
                backgroundColor: '#38bdf8',
                border: 'none',
                borderRadius: '4px',
                padding: '5px 8px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
              }}
            >
              <Search size={14} color="#000" />
            </button>
          </div>

          {/* Filter options */}
          <div
            style={{
              display: 'flex',
              gap: '12px',
              fontSize: '11px',
              color: isLight ? '#52525b' : '#a1a1aa',
            }}
          >
            <label style={{ display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={matchCase}
                onChange={(e) => setMatchCase(e.target.checked)}
              />
              대소문자 구분
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={isRegex}
                onChange={(e) => setIsRegex(e.target.checked)}
              />
              정규 표현식 사용
            </label>
          </div>

          {/* Search Results */}
          <div
            style={{
              flex: 1,
              overflowY: 'auto',
              overflowX: 'auto',
              marginTop: '4px',
              display: 'flex',
              flexDirection: 'column',
              gap: '4px',
            }}
          >
            {isSearching && (
              <div
                style={{
                  textAlign: 'center',
                  padding: '20px',
                  color: isLight ? '#71717a' : '#a1a1aa',
                  fontSize: '12px',
                }}
              >
                검색 중...
              </div>
            )}
            {!isSearching && searchResults.length === 0 && searchQuery && (
              <div
                style={{
                  textAlign: 'center',
                  padding: '20px',
                  color: isLight ? '#71717a' : '#a1a1aa',
                  fontSize: '12px',
                }}
              >
                일치하는 검색 결과가 없습니다.
              </div>
            )}
            {!isSearching &&
              searchResults.map((match, idx) => (
                <div
                  key={idx}
                  onClick={() => onSelectSearchResult(match)}
                  title={`${match.file_name}:${match.line_number}\n${match.line_content}`}
                  style={{
                    padding: '5px 8px',
                    borderRadius: '4px',
                    backgroundColor: isLight ? '#e4e4e7' : '#1e1e24',
                    cursor: 'pointer',
                    fontSize: '11px',
                    minWidth: 'max-content',
                  }}
                  onMouseEnter={(e) =>
                    (e.currentTarget.style.backgroundColor = isLight ? '#d4d4d8' : '#27272a')
                  }
                  onMouseLeave={(e) =>
                    (e.currentTarget.style.backgroundColor = isLight ? '#e4e4e7' : '#1e1e24')
                  }
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      color: '#0284c7',
                      fontWeight: 600,
                    }}
                  >
                    <FileCode size={12} />
                    <span>{match.file_name}</span>
                    <span style={{ color: '#71717a', fontSize: '10px' }}>:{match.line_number}</span>
                  </div>
                  <div
                    style={{
                      color: isLight ? '#3f3f46' : '#d4d4d8',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      marginTop: '2px',
                      fontFamily: 'monospace',
                      maxWidth: `${Math.max(160, width - 36)}px`,
                    }}
                  >
                    {match.line_content}
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Korean Context Menu */}
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
