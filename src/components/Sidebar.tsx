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
  Star,
  StarOff,
  X,
} from 'lucide-react';
import { FileNode, SearchMatch } from '../types';
import { tauriApi, isSupportedTextFile } from '../services/tauriApi';
import { ContextMenu, ContextMenuItem } from './ContextMenu';

const FAVORITES_STORAGE_KEY = 'geditor_favorite_folders';

interface SidebarProps {
  workspacePath: string;
  files: FileNode[];
  isLight?: boolean;
  width: number;
  blockedExtensions?: string[];
  onOpenFile: (path: string) => void;
  onRefreshWorkspace: () => void;
  onSelectSearchResult: (match: SearchMatch) => void;
  onChangeWorkspace?: (path: string) => void;
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
  onChangeWorkspace,
}) => {
  const [activeTab, setActiveTab] = useState<'files' | 'search'>('files');

  // Favorite folders state
  const [favoriteFolders, setFavoriteFolders] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem(FAVORITES_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch (e) {
      console.error('Failed to load favorite folders:', e);
    }
    return [];
  });
  const [isFavoritesExpanded, setIsFavoritesExpanded] = useState<boolean>(true);

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
    isFavoriteItem?: boolean;
    favoritePath?: string;
  } | null>(null);

  const handleToggleFavorite = (folderPath: string) => {
    setFavoriteFolders((prev) => {
      let updated: string[];
      if (prev.includes(folderPath)) {
        updated = prev.filter((p) => p !== folderPath);
      } else {
        updated = [...prev, folderPath];
      }
      try {
        localStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(updated));
      } catch (e) {}
      return updated;
    });
  };

  const handleRemoveFavorite = (folderPath: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setFavoriteFolders((prev) => {
      const updated = prev.filter((p) => p !== folderPath);
      try {
        localStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(updated));
      } catch (e) {}
      return updated;
    });
  };

  const handleAddFolderByPicker = async () => {
    try {
      const chosen = await tauriApi.openFolderDialog(workspacePath);
      if (chosen) {
        setFavoriteFolders((prev) => {
          if (prev.includes(chosen)) return prev;
          const updated = [...prev, chosen];
          try {
            localStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(updated));
          } catch (e) {}
          return updated;
        });
      }
    } catch (err) {
      alert(`폴더 추가 실패: ${err}`);
    }
  };

  const handleClickFavorite = async (favPath: string) => {
    if (favPath === workspacePath) {
      onRefreshWorkspace();
      return;
    }
    if (favPath.startsWith(workspacePath + '/')) {
      const relative = favPath.slice(workspacePath.length).replace(/^\/+/, '');
      const segments = relative.split('/');
      let currentSub = workspacePath;
      const nextExpanded = { ...expandedFolders };

      for (const seg of segments) {
        currentSub = `${currentSub}/${seg}`;
        try {
          const children = await tauriApi.listDirectory(currentSub);
          nextExpanded[currentSub] = children;
        } catch (e) {
          console.error(`Failed to expand ${currentSub}:`, e);
        }
      }
      setExpandedFolders(nextExpanded);
    } else {
      if (onChangeWorkspace) {
        onChangeWorkspace(favPath);
      }
    }
  };

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

    // Favorite item context menu
    if (contextMenu.isFavoriteItem && contextMenu.favoritePath) {
      const fPath = contextMenu.favoritePath;
      const fName = fPath.split('/').filter(Boolean).pop() || fPath;
      const isCurrentWorkspace = fPath === workspacePath;
      return [
        {
          label: isCurrentWorkspace ? '현재 워크스페이스 (새로고침)' : `"${fName}" 워크스페이스로 열기`,
          icon: <FolderOpen size={14} color="#38bdf8" />,
          onClick: () => {
            if (onChangeWorkspace) {
              onChangeWorkspace(fPath);
            } else {
              handleClickFavorite(fPath);
            }
          },
        },
        {
          label: '트리에서 탐색 / 펼치기',
          icon: <ChevronRight size={14} />,
          onClick: () => handleClickFavorite(fPath),
        },
        {
          label: '새 파일 생성...',
          icon: <FilePlus size={14} />,
          onClick: () => handleStartCreate('file', fPath),
        },
        {
          label: '새 폴더 생성...',
          icon: <FolderPlus size={14} />,
          onClick: () => handleStartCreate('dir', fPath),
        },
        { separator: true },
        {
          label: '전체 경로 복사',
          icon: <Copy size={14} />,
          onClick: () => navigator.clipboard.writeText(fPath),
        },
        { separator: true },
        {
          label: '즐겨찾기에서 제거',
          icon: <StarOff size={14} color="#eab308" />,
          danger: true,
          onClick: () => handleRemoveFavorite(fPath),
        },
      ];
    }

    const item = contextMenu.item;

    if (!item) {
      // Empty area context menu
      const isWorkspaceFav = favoriteFolders.includes(workspacePath);
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
          label: isWorkspaceFav ? '현재 워크스페이스 즐겨찾기에서 제거' : '현재 워크스페이스를 즐겨찾기에 추가',
          icon: isWorkspaceFav ? <StarOff size={14} color="#eab308" /> : <Star size={14} color="#eab308" />,
          onClick: () => handleToggleFavorite(workspacePath),
        },
        {
          label: '폴더 선택하여 즐겨찾기에 추가...',
          icon: <Plus size={14} />,
          onClick: handleAddFolderByPicker,
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
      const isFav = favoriteFolders.includes(item.path);
      return [
        {
          label: isFav ? '즐겨찾기에서 제거' : '⭐ 즐겨찾기에 추가',
          icon: isFav ? <StarOff size={14} color="#eab308" /> : <Star size={14} color="#eab308" />,
          onClick: () => handleToggleFavorite(item.path),
        },
        {
          label: '이 폴더를 워크스페이스로 열기',
          icon: <FolderOpen size={14} color="#38bdf8" />,
          onClick: () => onChangeWorkspace?.(item.path),
        },
        { separator: true },
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
  }, [contextMenu, workspacePath, favoriteFolders, onRefreshWorkspace, onOpenFile, onChangeWorkspace]);

  const renderFileList = (items: FileNode[], depth = 0) => {
    return items.map((item) => {
      const isExpanded = !!expandedFolders[item.path];
      const isBinary = !item.is_dir && !isSupportedTextFile(item.name, blockedExtensions).ok;
      const isFav = item.is_dir && favoriteFolders.includes(item.path);

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
                maxWidth: `${Math.max(120, width - (depth * 14 + 85))}px`,
                fontWeight: isBinary ? 400 : 450,
              }}
              title={item.name}
            >
              {item.name}
            </span>

            {/* Actions: Folder Favorite toggle & Quick delete */}
            <div
              style={{
                marginLeft: 'auto',
                display: 'flex',
                alignItems: 'center',
                gap: '2px',
              }}
            >
              {item.is_dir && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleToggleFavorite(item.path);
                  }}
                  style={{
                    border: 'none',
                    background: 'transparent',
                    color: isFav ? '#eab308' : '#71717a',
                    cursor: 'pointer',
                    padding: '2px',
                    display: isFav ? 'flex' : 'none',
                    alignItems: 'center',
                  }}
                  title={isFav ? '즐겨찾기에서 제거' : '즐겨찾기에 추가'}
                  className={isFav ? undefined : 'file-hover-action'}
                >
                  <Star size={12} fill={isFav ? '#eab308' : 'none'} />
                </button>
              )}

              <button
                onClick={(e) => handleDeleteEntry(item.path, e)}
                style={{
                  border: 'none',
                  background: 'transparent',
                  color: '#71717a',
                  cursor: 'pointer',
                  padding: '2px',
                  display: 'none',
                  alignItems: 'center',
                }}
                title="삭제 (휴지통/삭제 확인)"
                className="file-hover-action"
              >
                <Trash2 size={12} />
              </button>
            </div>
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
          {/* Favorites Accordion Section */}
          <div
            style={{
              borderBottom: isLight ? '1px solid #e4e4e7' : '1px solid #27272a',
              backgroundColor: isLight ? '#f9fafb' : '#141417',
            }}
          >
            <div
              onClick={() => setIsFavoritesExpanded(!isFavoritesExpanded)}
              style={{
                display: 'flex',
                alignItems: 'center',
                padding: '6px 10px',
                fontSize: '11px',
                fontWeight: 600,
                color: isLight ? '#4b5563' : '#a1a1aa',
                cursor: 'pointer',
                userSelect: 'none',
                gap: '6px',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = isLight ? '#e5e7eb' : '#1f1f23')}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
            >
              {isFavoritesExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
              <Star size={12} color="#eab308" fill="#eab308" />
              <span style={{ flex: 1 }}>즐겨찾기 {favoriteFolders.length > 0 && `(${favoriteFolders.length})`}</span>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleAddFolderByPicker();
                }}
                style={{
                  border: 'none',
                  background: 'transparent',
                  color: isLight ? '#6b7280' : '#a1a1aa',
                  cursor: 'pointer',
                  padding: '2px',
                  display: 'flex',
                  alignItems: 'center',
                }}
                title="외부 폴더 선택하여 즐겨찾기에 추가..."
              >
                <Plus size={13} />
              </button>
            </div>

            {isFavoritesExpanded && (
              <div style={{ padding: '2px 0 6px 0' }}>
                {favoriteFolders.length === 0 ? (
                  <div
                    style={{
                      padding: '8px 12px',
                      fontSize: '11px',
                      color: '#71717a',
                      fontStyle: 'italic',
                      lineHeight: 1.4,
                    }}
                  >
                    즐겨찾기한 폴더가 없습니다.<br />
                    폴더 우클릭 후 <b>'즐겨찾기에 추가'</b>를 선택하세요.
                  </div>
                ) : (
                  favoriteFolders.map((favPath) => {
                    const folderName = favPath.split('/').filter(Boolean).pop() || favPath;
                    const isCurrent = favPath === workspacePath;

                    return (
                      <div
                        key={favPath}
                        onClick={() => handleClickFavorite(favPath)}
                        onContextMenu={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setContextMenu({
                            x: e.clientX,
                            y: e.clientY,
                            isFavoriteItem: true,
                            favoritePath: favPath,
                          });
                        }}
                        title={`${favPath}\n(클릭: 열기/탐색, 우클릭: 추가 메뉴)`}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          padding: '4px 8px 4px 16px',
                          fontSize: '12px',
                          color: isCurrent
                            ? '#38bdf8'
                            : isLight
                            ? '#1f2937'
                            : '#e4e4e7',
                          cursor: 'pointer',
                          userSelect: 'none',
                          gap: '6px',
                          position: 'relative',
                        }}
                        onMouseEnter={(e) =>
                          (e.currentTarget.style.backgroundColor = isLight ? '#e4e4e7' : '#27272a')
                        }
                        onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                      >
                        <Star size={11} color="#eab308" fill="#eab308" />
                        <Folder size={13} color={isCurrent ? '#38bdf8' : '#60a5fa'} />
                        <span
                          style={{
                            flex: 1,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                            fontWeight: isCurrent ? 600 : 450,
                          }}
                        >
                          {folderName}
                        </span>
                        {isCurrent && (
                          <span
                            style={{
                              fontSize: '9px',
                              padding: '1px 4px',
                              backgroundColor: isLight ? '#e0f2fe' : '#0369a1',
                              color: isLight ? '#0284c7' : '#bae6fd',
                              borderRadius: '3px',
                              fontWeight: 600,
                            }}
                          >
                            현재
                          </span>
                        )}
                        <button
                          onClick={(e) => handleRemoveFavorite(favPath, e)}
                          style={{
                            border: 'none',
                            background: 'transparent',
                            color: '#71717a',
                            cursor: 'pointer',
                            padding: '2px',
                            display: 'none',
                            alignItems: 'center',
                          }}
                          title="즐겨찾기에서 제거"
                          className="file-hover-action"
                        >
                          <X size={12} />
                        </button>
                      </div>
                    );
                  })
                )}
              </div>
            )}
          </div>

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
              onClick={() => handleToggleFavorite(workspacePath)}
              style={{
                border: 'none',
                background: 'transparent',
                color: favoriteFolders.includes(workspacePath) ? '#eab308' : isLight ? '#52525b' : '#a1a1aa',
                cursor: 'pointer',
                padding: '2px',
                display: 'flex',
                alignItems: 'center',
              }}
              title={
                favoriteFolders.includes(workspacePath)
                  ? '현재 워크스페이스 즐겨찾기에서 제거'
                  : '현재 워크스페이스 즐겨찾기에 추가'
              }
            >
              <Star
                size={13}
                fill={favoriteFolders.includes(workspacePath) ? '#eab308' : 'none'}
              />
            </button>
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
              <FolderPlus size={14} />
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
