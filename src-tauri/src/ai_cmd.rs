use tauri::{AppHandle, Manager, PhysicalPosition, PhysicalSize, Url, WebviewUrl, WebviewWindowBuilder, WindowEvent};

fn get_service_info(service: &str) -> (&'static str, &'static str) {
    match service.to_lowercase().as_str() {
        "gemini" => ("Google Gemini", "https://gemini.google.com/app"),
        "chatgpt" | "codex" => ("ChatGPT (Codex)", "https://chatgpt.com"),
        "claude" => ("Anthropic Claude", "https://claude.ai/new"),
        _ => ("Google Gemini", "https://gemini.google.com/app"),
    }
}

fn compute_snap_position_and_size(app: &AppHandle) -> Result<(PhysicalPosition<i32>, PhysicalSize<u32>), String> {
    let main = app.get_webview_window("main").ok_or("Main window not found")?;
    let main_pos = main.outer_position().map_err(|e| e.to_string())?;
    let main_size = main.outer_size().map_err(|e| e.to_string())?;

    let target_w = 520u32;
    let target_h = main_size.height;
    let mut target_x = main_pos.x + main_size.width as i32;
    let target_y = main_pos.y;

    if let Ok(Some(mon)) = main.current_monitor() {
        let mon_pos = mon.position();
        let mon_size = mon.size();
        let mon_right = mon_pos.x + mon_size.width as i32;
        let mon_left = mon_pos.x;

        if target_x + target_w as i32 > mon_right {
            let left_x = main_pos.x - target_w as i32;
            if left_x >= mon_left {
                target_x = left_x;
            } else {
                target_x = (mon_right - target_w as i32).max(mon_left);
            }
        }
    }

    Ok((PhysicalPosition::new(target_x, target_y), PhysicalSize::new(target_w, target_h)))
}

#[tauri::command]
pub async fn open_ai_assistant(app: AppHandle, service: String, snap: Option<bool>) -> Result<(), String> {
    let (name, url_str) = get_service_info(&service);
    let url = Url::parse(url_str).map_err(|e| e.to_string())?;
    let win_title = format!("Geditor AI 도우미 - {}", name);

    if let Some(window) = app.get_webview_window("ai-assistant") {
        let _ = window.set_title(&win_title);
        window.show().map_err(|e| e.to_string())?;
        window.set_focus().map_err(|e| e.to_string())?;
        let _ = window.navigate(url);

        if snap.unwrap_or(false) {
            let _ = snap_ai_assistant(app).await;
        }
    } else {
        let (pos, size) = compute_snap_position_and_size(&app).unwrap_or_else(|_| {
            (PhysicalPosition::new(100, 100), PhysicalSize::new(520, 850))
        });

        let builder = WebviewWindowBuilder::new(
            &app,
            "ai-assistant",
            WebviewUrl::External(url),
        )
        .title(&win_title)
        .position(pos.x as f64, pos.y as f64)
        .inner_size(size.width as f64, size.height as f64)
        .min_inner_size(380.0, 450.0);

        let window = builder.build().map_err(|e| e.to_string())?;

        // Intercept close to hide window instead of destroying, keeping session & tab alive
        let win_clone = window.clone();
        window.on_window_event(move |event| {
            if let WindowEvent::CloseRequested { api, .. } = event {
                api.prevent_close();
                let _ = win_clone.hide();
            }
        });
    }

    Ok(())
}

#[tauri::command]
pub async fn toggle_ai_assistant(app: AppHandle, service: Option<String>) -> Result<bool, String> {
    if let Some(window) = app.get_webview_window("ai-assistant") {
        let is_visible = window.is_visible().unwrap_or(false);
        if is_visible {
            window.hide().map_err(|e| e.to_string())?;
            return Ok(false);
        }
    }

    let svc = service.unwrap_or_else(|| "gemini".to_string());
    open_ai_assistant(app, svc, Some(false)).await?;
    Ok(true)
}

#[tauri::command]
pub async fn snap_ai_assistant(app: AppHandle) -> Result<(), String> {
    let ai_win = app.get_webview_window("ai-assistant").ok_or("AI Assistant window not found")?;
    let (pos, size) = compute_snap_position_and_size(&app)?;

    ai_win.set_size(size).map_err(|e| e.to_string())?;
    ai_win.set_position(pos).map_err(|e| e.to_string())?;
    ai_win.show().map_err(|e| e.to_string())?;
    ai_win.set_focus().map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
pub async fn set_ai_assistant_always_on_top(app: AppHandle, always_on_top: bool) -> Result<(), String> {
    if let Some(ai_win) = app.get_webview_window("ai-assistant") {
        ai_win.set_always_on_top(always_on_top).map_err(|e| e.to_string())?;
    }
    Ok(())
}
