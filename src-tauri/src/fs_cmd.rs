use encoding_rs::EUC_KR;
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::Path;

#[derive(Debug, Serialize, Deserialize)]
pub struct FilePayload {
    pub path: String,
    pub name: String,
    pub content: String,
    pub encoding: String,
    pub line_ending: String,
    pub size: u64,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct FileNode {
    pub name: String,
    pub path: String,
    pub is_dir: bool,
    pub size: Option<u64>,
}

#[tauri::command]
pub fn read_file_content(path: String) -> Result<FilePayload, String> {
    let p = Path::new(&path);
    if !p.exists() {
        return Err(format!("파일이 존재하지 않습니다: {}", path));
    }

    // Check file size: limit to 20MB for editor safety
    let metadata = fs::metadata(p).map_err(|e| format!("메타데이터 확인 실패: {}", e))?;
    if metadata.len() > 20 * 1024 * 1024 {
        return Err(format!(
            "파일 크기({:.1}MB)가 너무 커서 텍스트 편집기에서 열 수 없습니다. (최대 20MB 제한)",
            metadata.len() as f64 / 1_048_576.0
        ));
    }

    // Binary check: read first 8KB to check for null bytes
    let mut file = fs::File::open(p).map_err(|e| format!("파일 열기 실패: {}", e))?;
    let mut header = [0u8; 8192];
    use std::io::Read;
    let n = file.read(&mut header).unwrap_or(0);
    if header[..n].contains(&0) {
        return Err("바이너리 파일(동영상, 이미지, 압축 파일 등)은 텍스트 편집기에서 지원하지 않습니다.".to_string());
    }

    let bytes = fs::read(p).map_err(|e| format!("파일 읽기 실패: {}", e))?;
    let size = bytes.len() as u64;
    let name = p
        .file_name()
        .map(|s| s.to_string_lossy().to_string())
        .unwrap_or_else(|| "Untitled".to_string());

    let (content, encoding) = match std::str::from_utf8(&bytes) {
        Ok(s) => (s.to_string(), "UTF-8".to_string()),
        Err(_) => {
            // Check EUC-KR
            let (cow, _, malformed) = EUC_KR.decode(&bytes);
            if !malformed {
                (cow.into_owned(), "EUC-KR".to_string())
            } else {
                (String::from_utf8_lossy(&bytes).to_string(), "UTF-8 (Lossy)".to_string())
            }
        }
    };

    let line_ending = if content.contains("\r\n") {
        "CRLF".to_string()
    } else {
        "LF".to_string()
    };

    Ok(FilePayload {
        path,
        name,
        content,
        encoding,
        line_ending,
        size,
    })
}

#[tauri::command]
pub fn write_file_content(
    path: String,
    content: String,
    encoding: Option<String>,
) -> Result<(), String> {
    let p = Path::new(&path);
    if let Some(parent) = p.parent() {
        if !parent.exists() {
            fs::create_dir_all(parent).map_err(|e| format!("Failed to create directory: {}", e))?;
        }
    }

    let target_encoding = encoding.unwrap_or_else(|| "UTF-8".to_string());
    let bytes = if target_encoding.to_uppercase() == "EUC-KR" {
        let (cow, _, _) = EUC_KR.encode(&content);
        cow.into_owned()
    } else {
        content.into_bytes()
    };

    fs::write(p, bytes).map_err(|e| format!("Failed to write file: {}", e))?;
    Ok(())
}

#[tauri::command]
pub fn list_directory(path: String) -> Result<Vec<FileNode>, String> {
    let p = Path::new(&path);
    if !p.exists() {
        return Err(format!("Directory does not exist: {}", path));
    }
    if !p.is_dir() {
        return Err(format!("Path is not a directory: {}", path));
    }

    let mut entries = Vec::new();
    let read_dir = fs::read_dir(p).map_err(|e| format!("Failed to list directory: {}", e))?;

    for entry in read_dir.flatten() {
        let path = entry.path();
        let name = entry.file_name().to_string_lossy().to_string();

        // Skip common noisy directories
        if name.starts_with('.') && name != ".env" && name != ".gitignore" {
            continue;
        }

        let is_dir = path.is_dir();
        let size = if is_dir {
            None
        } else {
            entry.metadata().ok().map(|m| m.len())
        };

        entries.push(FileNode {
            name,
            path: path.to_string_lossy().to_string(),
            is_dir,
            size,
        });
    }

    // Sort: directories first, then alphabetical
    entries.sort_by(|a, b| match (a.is_dir, b.is_dir) {
        (true, false) => std::cmp::Ordering::Less,
        (false, true) => std::cmp::Ordering::Greater,
        _ => a.name.to_lowercase().cmp(&b.name.to_lowercase()),
    });

    Ok(entries)
}

#[tauri::command]
pub fn create_file_entry(path: String) -> Result<(), String> {
    let p = Path::new(&path);
    if p.exists() {
        return Err("File already exists".to_string());
    }
    if let Some(parent) = p.parent() {
        if !parent.exists() {
            fs::create_dir_all(parent).map_err(|e| e.to_string())?;
        }
    }
    fs::write(p, b"").map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn create_dir_entry(path: String) -> Result<(), String> {
    let p = Path::new(&path);
    if p.exists() {
        return Err("Directory already exists".to_string());
    }
    fs::create_dir_all(p).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn delete_entry(path: String) -> Result<(), String> {
    let p = Path::new(&path);
    if !p.exists() {
        return Err("Path does not exist".to_string());
    }
    if p.is_dir() {
        fs::remove_dir_all(p).map_err(|e| e.to_string())?;
    } else {
        fs::remove_file(p).map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
pub fn rename_entry(old_path: String, new_path: String) -> Result<(), String> {
    let old = Path::new(&old_path);
    let new = Path::new(&new_path);
    if !old.exists() {
        return Err("Source path does not exist".to_string());
    }
    fs::rename(old, new).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn get_default_workspace() -> String {
    std::env::current_dir()
        .map(|p| p.to_string_lossy().to_string())
        .unwrap_or_else(|_| {
            std::env::var("HOME").unwrap_or_else(|_| ".".to_string())
        })
}

#[derive(serde::Serialize)]
pub struct PathInfo {
    pub exists: bool,
    pub is_dir: bool,
    pub is_file: bool,
    pub canonical_path: String,
}

#[tauri::command]
pub fn inspect_path(path: String, base_dir: Option<String>) -> Result<PathInfo, String> {
    let mut target = path.trim().to_string();
    if target.starts_with("~/") || target == "~" {
        if let Ok(home) = std::env::var("HOME") {
            target = format!("{}{}", home, &target[1..]);
        }
    }

    let p = Path::new(&target);
    let resolved = if p.is_relative() {
        if let Some(base) = base_dir {
            Path::new(&base).join(p)
        } else {
            p.to_path_buf()
        }
    } else {
        p.to_path_buf()
    };

    if !resolved.exists() {
        return Ok(PathInfo {
            exists: false,
            is_dir: false,
            is_file: false,
            canonical_path: resolved.to_string_lossy().to_string(),
        });
    }

    let is_dir = resolved.is_dir();
    let is_file = resolved.is_file();
    let canonical = resolved.canonicalize().unwrap_or(resolved);

    Ok(PathInfo {
        exists: true,
        is_dir,
        is_file,
        canonical_path: canonical.to_string_lossy().to_string(),
    })
}

#[tauri::command]
pub fn save_file_dialog(default_name: Option<String>, default_dir: Option<String>) -> Option<String> {
    let mut dialog = rfd::FileDialog::new();
    if let Some(ref name) = default_name {
        dialog = dialog.set_file_name(name);
    }
    if let Some(ref dir) = default_dir {
        let p = Path::new(dir);
        if p.exists() {
            if p.is_dir() {
                dialog = dialog.set_directory(p);
            } else if let Some(parent) = p.parent() {
                dialog = dialog.set_directory(parent);
            }
        }
    }
    dialog.save_file().map(|p| p.to_string_lossy().to_string())
}

#[tauri::command]
pub fn open_file_dialog(default_dir: Option<String>) -> Option<String> {
    let mut dialog = rfd::FileDialog::new();
    if let Some(ref dir) = default_dir {
        let p = Path::new(dir);
        if p.exists() {
            if p.is_dir() {
                dialog = dialog.set_directory(p);
            } else if let Some(parent) = p.parent() {
                dialog = dialog.set_directory(parent);
            }
        }
    }
    dialog.pick_file().map(|p| p.to_string_lossy().to_string())
}

#[tauri::command]
pub fn open_folder_dialog(default_dir: Option<String>) -> Option<String> {
    let mut dialog = rfd::FileDialog::new();
    if let Some(ref dir) = default_dir {
        let p = Path::new(dir);
        if p.exists() {
            if p.is_dir() {
                dialog = dialog.set_directory(p);
            } else if let Some(parent) = p.parent() {
                dialog = dialog.set_directory(parent);
            }
        }
    }
    dialog.pick_folder().map(|p| p.to_string_lossy().to_string())
}

#[tauri::command]
pub fn exit_app(app_handle: tauri::AppHandle) {
    app_handle.exit(0);
}


