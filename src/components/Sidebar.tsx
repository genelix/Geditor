import React, { useState, useMemo, useEffect } from 'react';
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
  FolderUp,
  AlertTriangle,
} from 'lucide-react';
import { FileNode, SearchMatch } from '../types';
import { tauriApi, isSupportedTextFile } from '../services/tauriApi';
import { ContextMenu, ContextMenuItem } from './ContextMenu';

const FAVORITES_STORAGE_KEY = 'geditor_favorite_folders';

function getCommonAncestor(pathA: string, pathB: string): string {
  if (!pathA || !pathB) return pathA || pathB;
  const normA = pathA.replace(/\\/g, '/').replace(/\/+$/, '');
  const normB = pathB.replace(/\\/g, '/').replace(/\/+$/, '');

  const partsA = normA.split('/').filter(Boolean);
  const partsB = normB.split('/').filter(Boolean);

  const common: string[] = [];
  const minLen = Math.min(partsA.length, partsB.length);
  for (let i = 0; i < minLen; i++) {
    if (partsA[i] === partsB[i]) {
      common.push(partsA[i]);
    } else {
      break;
    }
  }

  const isUnix = pathA.startsWith('/') || pathB.startsWith('/');
  if (common.length === 0) {
    return isUnix ? '/' : normA;
  }
  return (isUnix ? '/' : '') + common.join('/');
}

interface SidebarProps {
  workspacePath: string;
  files: FileNode[];
  isLight?: boolean;
  width: number;
  blockedExtensions?: string[];
  onOpenFile: (path: string) => void;
  onRefreshWorkspace: () => Promise<void> | void;
  onSelectSearchResult: (match: SearchMatch) => void;
  onChangeWorkspace?: (path: string) => Promise<void> | void;
  onDeleteFile?: (path: string) => void;
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
  onDeleteFile,
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

  // Selected / Highlighted folder or file path in tree
  const [selectedPath, setSelectedPath] = useState<string | null>(null);

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

  // Delete Confirmation Modal State
  const [deleteTarget, setDeleteTarget] = useState<{
    path: string;
    name: string;
    isDir: boolean;
  } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Rename Modal State
  const [renameTarget, setRenameTarget] = useState<{
    path: string;
    name: string;
    isDir: boolean;
  } | null>(null);
  const [renameInput, setRenameInput] = useState('');
  const [isRenaming, setIsRenaming] = useState(false);

  // Toast message state
  const [toastMessage, setToastMessage] = useState<{ text: string; isError?: boolean } | null>(null);

  const showToast = (text: string, isError = false) => {
    setToastMessage({ text, isError });
    setTimeout(() => {
      setToastMessage((cur) => (cur?.text === text ? null : cur));
    }, 3500);
  };

  // Delete / Backspace key listener on selectedPath
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeTag = document.activeElement?.tagName?.toLowerCase();
      if (activeTag === 'input' || activeTag === 'textarea') return;

      if (deleteTarget || renameTarget || creatingType) return;

      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedPath) {
        e.preventDefault();
        const itemName = selectedPath.split('/').pop() || selectedPath;
        const isDir = !!expandedFolders[selectedPath] || favoriteFolders.includes(selectedPath);
        setDeleteTarget({ path: selectedPath, name: itemName, isDir });
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedPath, deleteTarget, renameTarget, creatingType, expandedFolders, favoriteFolders]);

  // Parent directory calculations for Go To Parent Folder button
  const normalizedWorkspace = workspacePath.replace(/\\/g, '/').replace(/\/+$/, '');
  const lastSlashIndex = normalizedWorkspace.lastIndexOf('/');
  const parentDirPath =
    lastSlashIndex > 0
      ? normalizedWorkspace.substring(0, lastSlashIndex)
      : lastSlashIndex === 0
      ? '/'
      : '';
  const canGoToParent = !!parentDirPath && parentDirPath !== normalizedWorkspace;

  const handleGoToParentFolder = () => {
    if (canGoToParent && onChangeWorkspace) {
      onChangeWorkspace(parentDirPath);
    }
  };

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
      showToast(`폴더 추가 실패: ${err}`, true);
    }
  };

  const handleClickFavorite = async (favPath: string) => {
    const normWorkspace = workspacePath.replace(/\\/g, '/').replace(/\/+$/, '');
    const normFav = favPath.replace(/\\/g, '/').replace(/\/+$/, '');

    // Case 1: Exact match with current workspace
    if (normFav === normWorkspace) {
      await handleFullRefresh();
      setSelectedPath(normFav);
      return;
    }

    let activeRoot = normWorkspace;

    // Case 2: favPath is inside current workspace -> Keep root as is!
    if (normFav.startsWith(normWorkspace + '/')) {
      activeRoot = normWorkspace;
    } else {
      // Case 3: favPath is outside current workspace -> Find common ancestor or parent of favPath
      const common = getCommonAncestor(normWorkspace, normFav);
      const commonParts = common.split('/').filter(Boolean);

      if (commonParts.length >= 2) {
        activeRoot = common;
      } else {
        const lastSlash = normFav.lastIndexOf('/');
        const parentOfFav = lastSlash > 0 ? normFav.substring(0, lastSlash) : normFav;
        activeRoot = parentOfFav || normFav;
      }

      if (onChangeWorkspace && activeRoot !== normWorkspace) {
        await onChangeWorkspace(activeRoot);
      }
    }

    // Expand path from activeRoot down to normFav
    if (normFav.startsWith(activeRoot + '/')) {
      const relative = normFav.slice(activeRoot.length).replace(/^\/+/, '');
      const segments = relative.split('/');
      let currentSub = activeRoot;
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
    }

    setSelectedPath(normFav);

    // Smooth scroll to target element
    setTimeout(() => {
      const el = document.getElementById(`file-item-${encodeURIComponent(normFav)}`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    }, 200);
  };

  const [isRefreshing, setIsRefreshing] = useState(false);

  // Full refresh of workspace root AND all currently expanded subfolders
  const handleFullRefresh = async () => {
    setIsRefreshing(true);
    try {
      if (onRefreshWorkspace) {
        await onRefreshWorkspace();
      }

      const paths = Object.keys(expandedFolders);
      if (paths.length > 0) {
        const updated: Record<string, FileNode[]> = {};
        await Promise.all(
          paths.map(async (folderPath) => {
            try {
              const children = await tauriApi.listDirectory(folderPath);
              updated[folderPath] = children;
            } catch (e) {
              // Folder likely removed
            }
          })
        );
        setExpandedFolders(updated);
      }
    } catch (err) {
      console.error('Full refresh error:', err);
    } finally {
      setTimeout(() => setIsRefreshing(false), 350);
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

      // If created in a subfolder, ensure that folder is loaded in expandedFolders
      if (parent !== workspacePath) {
        try {
          const children = await tauriApi.listDirectory(parent);
          setExpandedFolders((prev) => ({ ...prev, [parent]: children }));
        } catch (e) {}
      }

      await handleFullRefresh();

      setSelectedPath(targetPath);
      setTimeout(() => {
        const el = document.getElementById(`file-item-${encodeURIComponent(targetPath)}`);
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }, 150);
    } catch (e) {
      showToast(`생성 중 오류 발생: ${e}`, true);
    }
  };

  const handleRequestDelete = (path: string, name?: string, isDir = false, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const itemName = name || path.split('/').pop() || path;
    setDeleteTarget({ path, name: itemName, isDir });
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    const targetPath = deleteTarget.path;
    const targetName = deleteTarget.name;
    try {
      await tauriApi.deleteEntry(targetPath);

      // Remove from expandedFolders
      setExpandedFolders((prev) => {
        const next = { ...prev };
        delete next[targetPath];
        Object.keys(next).forEach((k) => {
          if (k.startsWith(targetPath + '/')) {
            delete next[k];
          }
        });
        return next;
      });

      // Remove from favoriteFolders if present
      setFavoriteFolders((prev) => {
        const next = prev.filter((p) => p !== targetPath && !p.startsWith(targetPath + '/'));
        try {
          localStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(next));
        } catch (e) {}
        return next;
      });

      if (onDeleteFile) {
        onDeleteFile(targetPath);
      }

      await handleFullRefresh();
      setDeleteTarget(null);
      showToast(`"${targetName}" 항목이 삭제되었습니다.`);
    } catch (err) {
      console.error('삭제 실패:', err);
      showToast(`삭제 실패: ${err}`, true);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleRequestRename = (item: FileNode) => {
    setRenameTarget({ path: item.path, name: item.name, isDir: item.is_dir });
    setRenameInput(item.name);
  };

  const handleConfirmRename = async () => {
    if (!renameTarget) return;
    const trimmed = renameInput.trim();
    if (!trimmed || trimmed === renameTarget.name) {
      setRenameTarget(null);
      return;
    }
    setIsRenaming(true);
    const lastSlash = renameTarget.path.lastIndexOf('/');
    const parentDir = lastSlash !== -1 ? renameTarget.path.substring(0, lastSlash) : workspacePath;
    const newPath = `${parentDir}/${trimmed}`;
    try {
      await tauriApi.renameEntry(renameTarget.path, newPath);

      setExpandedFolders((prev) => {
        const next = { ...prev };
        if (next[renameTarget.path]) {
          next[newPath] = next[renameTarget.path];
          delete next[renameTarget.path];
        }
        return next;
      });

      setFavoriteFolders((prev) => {
        const next = prev.map((p) => (p === renameTarget.path ? newPath : p));
        try {
          localStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(next));
        } catch (e) {}
        return next;
      });

      await handleFullRefresh();
      setSelectedPath(newPath);
      setRenameTarget(null);
      showToast(`이름이 "${trimmed}"(으)로 변경되었습니다.`);
    } catch (err) {
      console.error('이름 변경 실패:', err);
      showToast(`이름 변경 실패: ${err}`, true);
    } finally {
      setIsRenaming(false);
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
      showToast(`검색 중 오류: ${err}`, true);
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
      return [
        {
          label: '폴더 경로로 이동 (트리에서 펼치기)',
          icon: <ChevronRight size={14} color="#38bdf8" />,
          onClick: () => handleClickFavorite(fPath),
        },
        {
          label: '상위 폴더 기준으로 열기 (전체 트리 유지)',
          icon: <FolderUp size={14} />,
          onClick: () => {
            const lastSlash = fPath.lastIndexOf('/');
            const parent = lastSlash > 0 ? fPath.substring(0, lastSlash) : fPath;
            if (onChangeWorkspace) onChangeWorkspace(parent);
            handleClickFavorite(fPath);
          },
        },
        {
          label: `"${fName}" 폴더만 단독 워크스페이스로 열기`,
          icon: <FolderOpen size={14} color="#a1a1aa" />,
          onClick: () => onChangeWorkspace?.(fPath),
        },
        { separator: true },
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
          onClick: handleFullRefresh,
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
          label: '이 폴더를 단독 워크스페이스로 열기',
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
          onClick: () => handleRequestRename(item),
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
          onClick: handleFullRefresh,
        },
        { separator: true },
        {
          label: '삭제',
          icon: <Trash2 size={14} />,
          danger: true,
          onClick: () => handleRequestDelete(item.path, item.name, true),
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
        onClick: () => handleRequestRename(item),
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
        onClick: () => handleRequestDelete(item.path, item.name, false),
      },
    ];
  }, [contextMenu, workspacePath, favoriteFolders, handleFullRefresh, onOpenFile, onChangeWorkspace]);

  const renderFileList = (items: FileNode[], depth = 0) => {
    return items.map((item) => {
      const isExpanded = !!expandedFolders[item.path];
      const isBinary = !item.is_dir && !isSupportedTextFile(item.name, blockedExtensions).ok;
      const isFav = item.is_dir && favoriteFolders.includes(item.path);
      const isSelected = item.path === selectedPath;

      return (
        <div key={item.path}>
          <div
            id={`file-item-${encodeURIComponent(item.path)}`}
            onClick={() => {
              setSelectedPath(item.path);
              if (item.is_dir) {
                handleToggleFolder(item.path);
              } else {
                onOpenFile(item.path);
              }
            }}
            onContextMenu={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setSelectedPath(item.path);
              setContextMenu({ x: e.clientX, y: e.clientY, item });
            }}
            title={item.name}
            style={{
              display: 'flex',
              alignItems: 'center',
              padding: '4px 8px',
              paddingLeft: `${depth * 14 + 10}px`,
              fontSize: '12px',
              color: isSelected
                ? isLight
                  ? '#0284c7'
                  : '#38bdf8'
                : isBinary
                ? isLight
                  ? '#9ca3af'
                  : '#71717a'
                : isLight
                ? '#27272a'
                : '#d4d4d8',
              backgroundColor: isSelected
                ? isLight
                  ? '#e0f2fe'
                  : '#1e293b'
                : 'transparent',
              borderLeft: isSelected
                ? '3px solid #38bdf8'
                : '3px solid transparent',
              cursor: 'pointer',
              userSelect: 'none',
              gap: '6px',
              minWidth: 'max-content',
              transition: 'background-color 0.1s, border-left-color 0.1s',
            }}
            onMouseEnter={(e) => {
              if (!isSelected) {
                e.currentTarget.style.backgroundColor = isLight ? '#e4e4e7' : '#27272a';
              }
            }}
            onMouseLeave={(e) => {
              if (!isSelected) {
                e.currentTarget.style.backgroundColor = 'transparent';
              }
            }}
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
                onClick={(e) => handleRequestDelete(item.path, item.name, item.is_dir, e)}
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
            {/* Go to parent folder button */}
            {canGoToParent && (
              <button
                onClick={handleGoToParentFolder}
                style={{
                  border: 'none',
                  background: 'transparent',
                  color: isLight ? '#0284c7' : '#38bdf8',
                  cursor: 'pointer',
                  padding: '2px',
                  display: 'flex',
                  alignItems: 'center',
                }}
                title={`상위 폴더로 이동: ${parentDirPath}`}
              >
                <FolderUp size={14} />
              </button>
            )}
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
              onClick={handleFullRefresh}
              style={{
                border: 'none',
                background: 'transparent',
                color: isLight ? '#52525b' : '#a1a1aa',
                cursor: 'pointer',
                padding: '2px',
                display: 'flex',
                alignItems: 'center',
              }}
              title="목록 새로고침"
            >
              <RefreshCw size={12} className={isRefreshing ? 'spin-icon' : undefined} />
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
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                <span>{creatingType === 'file' ? '새 파일 이름 입력:' : '새 폴더 이름 입력:'}</span>
                <span
                  style={{
                    color: '#0284c7',
                    fontSize: '10px',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    maxWidth: '140px',
                  }}
                  title={targetParentDir}
                >
                  ({targetParentDir === workspacePath ? '루트' : targetParentDir.split('/').pop()})
                </span>
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

      {/* Delete Confirmation Modal */}
      {deleteTarget && (
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
            zIndex: 99999,
            backdropFilter: 'blur(3px)',
          }}
          onClick={() => !isDeleting && setDeleteTarget(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '420px',
              maxWidth: '92vw',
              backgroundColor: isLight ? '#ffffff' : '#1e1e24',
              color: isLight ? '#18181b' : '#f4f4f5',
              borderRadius: '10px',
              border: isLight ? '1px solid #e4e4e7' : '1px solid #3f3f46',
              boxShadow: '0 20px 40px rgba(0, 0, 0, 0.5)',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
              animation: 'geditorFadeIn 0.15s ease-out',
            }}
          >
            {/* Modal Header */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '14px 18px',
                borderBottom: isLight ? '1px solid #f4f4f5' : '1px solid #27272a',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div
                  style={{
                    width: '28px',
                    height: '28px',
                    borderRadius: '6px',
                    backgroundColor: 'rgba(239, 68, 68, 0.15)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#ef4444',
                  }}
                >
                  <Trash2 size={16} />
                </div>
                <span style={{ fontWeight: 600, fontSize: '14px' }}>
                  {deleteTarget.isDir ? '폴더 삭제 확인' : '파일 삭제 확인'}
                </span>
              </div>
              <button
                onClick={() => !isDeleting && setDeleteTarget(null)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: isLight ? '#71717a' : '#a1a1aa',
                  cursor: 'pointer',
                  padding: '4px',
                  borderRadius: '4px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <X size={16} />
              </button>
            </div>

            {/* Modal Body */}
            <div style={{ padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{ fontSize: '13px', lineHeight: 1.5 }}>
                정말로 <strong style={{ color: isLight ? '#111827' : '#ffffff' }}>"{deleteTarget.name}"</strong> 항목을 삭제하시겠습니까?
              </div>
              <div
                style={{
                  fontSize: '11px',
                  color: '#ef4444',
                  backgroundColor: 'rgba(239, 68, 68, 0.08)',
                  padding: '8px 10px',
                  borderRadius: '6px',
                  border: '1px solid rgba(239, 68, 68, 0.2)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                <AlertTriangle size={14} style={{ flexShrink: 0 }} />
                <span>
                  {deleteTarget.isDir
                    ? '폴더 및 폴더 내의 모든 파일이 영구 삭제되며 복구할 수 없습니다.'
                    : '삭제된 파일은 영구적으로 제거되며 복구할 수 없습니다.'}
                </span>
              </div>
              <div
                style={{
                  fontSize: '11px',
                  fontFamily: 'monospace',
                  color: isLight ? '#71717a' : '#a1a1aa',
                  backgroundColor: isLight ? '#f4f4f5' : '#141416',
                  padding: '6px 10px',
                  borderRadius: '4px',
                  border: isLight ? '1px solid #e4e4e7' : '1px solid #27272a',
                  wordBreak: 'break-all',
                }}
              >
                {deleteTarget.path}
              </div>
            </div>

            {/* Modal Footer */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'flex-end',
                gap: '8px',
                padding: '12px 18px',
                backgroundColor: isLight ? '#f9fafb' : '#16161a',
                borderTop: isLight ? '1px solid #f4f4f5' : '1px solid #27272a',
              }}
            >
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => setDeleteTarget(null)}
                style={{
                  padding: '6px 14px',
                  borderRadius: '5px',
                  border: isLight ? '1px solid #d4d4d8' : '1px solid #3f3f46',
                  backgroundColor: 'transparent',
                  color: isLight ? '#3f3f46' : '#d4d4d8',
                  fontSize: '12px',
                  fontWeight: 500,
                  cursor: isDeleting ? 'not-allowed' : 'pointer',
                }}
              >
                취소 (Esc)
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={handleConfirmDelete}
                autoFocus
                style={{
                  padding: '6px 16px',
                  borderRadius: '5px',
                  border: 'none',
                  backgroundColor: '#ef4444',
                  color: '#ffffff',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: isDeleting ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  boxShadow: '0 2px 6px rgba(239, 68, 68, 0.4)',
                }}
              >
                {isDeleting ? '삭제 중...' : '삭제 (Enter)'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Rename Modal */}
      {renameTarget && (
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
            zIndex: 99999,
            backdropFilter: 'blur(3px)',
          }}
          onClick={() => !isRenaming && setRenameTarget(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '400px',
              maxWidth: '92vw',
              backgroundColor: isLight ? '#ffffff' : '#1e1e24',
              color: isLight ? '#18181b' : '#f4f4f5',
              borderRadius: '10px',
              border: isLight ? '1px solid #e4e4e7' : '1px solid #3f3f46',
              boxShadow: '0 20px 40px rgba(0, 0, 0, 0.5)',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
              animation: 'geditorFadeIn 0.15s ease-out',
            }}
          >
            {/* Modal Header */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '14px 18px',
                borderBottom: isLight ? '1px solid #f4f4f5' : '1px solid #27272a',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div
                  style={{
                    width: '28px',
                    height: '28px',
                    borderRadius: '6px',
                    backgroundColor: 'rgba(56, 189, 248, 0.15)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#38bdf8',
                  }}
                >
                  <Edit2 size={16} />
                </div>
                <span style={{ fontWeight: 600, fontSize: '14px' }}>이름 바꾸기</span>
              </div>
              <button
                onClick={() => !isRenaming && setRenameTarget(null)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: isLight ? '#71717a' : '#a1a1aa',
                  cursor: 'pointer',
                  padding: '4px',
                  borderRadius: '4px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <X size={16} />
              </button>
            </div>

            {/* Modal Body */}
            <div style={{ padding: '16px 18px' }}>
              <input
                type="text"
                value={renameInput}
                onChange={(e) => setRenameInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleConfirmRename();
                  } else if (e.key === 'Escape') {
                    e.preventDefault();
                    setRenameTarget(null);
                  }
                }}
                autoFocus
                onFocus={(e) => {
                  const dotIdx = renameInput.lastIndexOf('.');
                  if (dotIdx > 0 && !renameTarget.isDir) {
                    e.target.setSelectionRange(0, dotIdx);
                  } else {
                    e.target.select();
                  }
                }}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  fontSize: '13px',
                  borderRadius: '6px',
                  border: '1px solid #38bdf8',
                  outline: 'none',
                  backgroundColor: isLight ? '#ffffff' : '#141416',
                  color: isLight ? '#18181b' : '#f4f4f5',
                  boxSizing: 'border-box',
                }}
              />
            </div>

            {/* Modal Footer */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'flex-end',
                gap: '8px',
                padding: '12px 18px',
                backgroundColor: isLight ? '#f9fafb' : '#16161a',
                borderTop: isLight ? '1px solid #f4f4f5' : '1px solid #27272a',
              }}
            >
              <button
                type="button"
                disabled={isRenaming}
                onClick={() => setRenameTarget(null)}
                style={{
                  padding: '6px 14px',
                  borderRadius: '5px',
                  border: isLight ? '1px solid #d4d4d8' : '1px solid #3f3f46',
                  backgroundColor: 'transparent',
                  color: isLight ? '#3f3f46' : '#d4d4d8',
                  fontSize: '12px',
                  fontWeight: 500,
                  cursor: isRenaming ? 'not-allowed' : 'pointer',
                }}
              >
                취소 (Esc)
              </button>
              <button
                type="button"
                disabled={isRenaming || !renameInput.trim()}
                onClick={handleConfirmRename}
                style={{
                  padding: '6px 16px',
                  borderRadius: '5px',
                  border: 'none',
                  backgroundColor: '#0284c7',
                  color: '#ffffff',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: isRenaming || !renameInput.trim() ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                {isRenaming ? '변경 중...' : '확인 (Enter)'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast Notification */}
      {toastMessage && (
        <div
          style={{
            position: 'absolute',
            bottom: '16px',
            left: '12px',
            right: '12px',
            padding: '8px 12px',
            backgroundColor: toastMessage.isError ? '#ef4444' : '#10b981',
            color: '#ffffff',
            borderRadius: '6px',
            fontSize: '12px',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '8px',
            animation: 'geditorFadeIn 0.15s ease-out',
          }}
        >
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {toastMessage.text}
          </span>
          <button
            onClick={() => setToastMessage(null)}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#ffffff',
              cursor: 'pointer',
              padding: 0,
              display: 'flex',
            }}
          >
            <X size={14} />
          </button>
        </div>
      )}
    </div>
  );
};
