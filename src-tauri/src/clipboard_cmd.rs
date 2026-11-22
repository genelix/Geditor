use std::path::PathBuf;

#[tauri::command]
pub fn read_clipboard_text() -> Result<String, String> {
    let mut clipboard = arboard::Clipboard::new().map_err(|e| format!("클립보드 열기 실패: {}", e))?;
    let text = clipboard.get_text().unwrap_or_default();
    Ok(text)
}

#[tauri::command]
pub fn write_clipboard_text(text: String) -> Result<(), String> {
    let mut clipboard = arboard::Clipboard::new().map_err(|e| format!("클립보드 열기 실패: {}", e))?;
    clipboard.set_text(text).map_err(|e| format!("클립보드 쓰기 실패: {}", e))?;
    Ok(())
}

#[tauri::command]
pub fn open_in_browser(path_or_url: Option<String>, html_content: Option<String>) -> Result<(), String> {
    let target_url = if let Some(content) = html_content {
        if path_or_url.as_ref().map(|s| s.trim().is_empty()).unwrap_or(true) {
            // Unsaved document: write to temp file and open in browser
            let temp_file = std::env::temp_dir().join("geditor_preview.html");
            std::fs::write(&temp_file, content).map_err(|e| format!("임시 파일 생성 실패: {}", e))?;
            format!("file://{}", temp_file.to_string_lossy())
        } else {
            format_url(path_or_url.unwrap())
        }
    } else if let Some(target) = path_or_url {
        format_url(target)
    } else {
        return Err("열 경로 또는 URL이 지정되지 않았습니다.".to_string());
    };

    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("/usr/bin/open")
            .arg(&target_url)
            .spawn()
            .map_err(|e| format!("브라우저 실행 실패: {}", e))?;
    }

    #[cfg(target_os = "windows")]
    {
        std::process::Command::new("cmd")
            .args(["/c", "start", "", &target_url])
            .spawn()
            .map_err(|e| format!("브라우저 실행 실패: {}", e))?;
    }

    #[cfg(not(any(target_os = "macos", target_os = "windows")))]
    {
        std::process::Command::new("xdg-open")
            .arg(&target_url)
            .spawn()
            .map_err(|e| format!("브라우저 실행 실패: {}", e))?;
    }

    Ok(())
}

fn format_url(target: String) -> String {
    let trimmed = target.trim();
    if trimmed.starts_with("http://") || trimmed.starts_with("https://") || trimmed.starts_with("file://") {
        trimmed.to_string()
    } else {
        let p = PathBuf::from(trimmed);
        let canonical = p.canonicalize().unwrap_or(p);
        let s = canonical.to_string_lossy().to_string();
        #[cfg(target_os = "windows")]
        {
            let clean = s.replace(r"\\?\", "").replace('\\', "/");
            format!("file:///{}", clean)
        }
        #[cfg(not(target_os = "windows"))]
        {
            format!("file://{}", s)
        }
    }
}
