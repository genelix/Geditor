use tauri::{
    AppHandle, Manager, PhysicalPosition, PhysicalSize, LogicalPosition, LogicalSize,
    Url, WebviewUrl, WebviewWindowBuilder, WindowEvent,
};
use tauri::webview::WebviewBuilder;

fn resolve_service_url(service: &str, custom_url: Option<String>) -> Result<(String, Url), String> {
    if let Some(ref custom) = custom_url {
        let trimmed = custom.trim();
        if !trimmed.is_empty() {
            if let Ok(u) = Url::parse(trimmed) {
                return Ok(("사내 엔터프라이즈 AI".to_string(), u));
            }
        }
    }

    let (name, default_url) = match service.to_lowercase().as_str() {
        "gemini" => ("Google Gemini", "https://gemini.google.com/app"),
        "chatgpt" | "codex" => ("ChatGPT (Codex)", "https://chatgpt.com"),
        "claude" => ("Anthropic Claude", "https://claude.ai/new"),
        "enterprise" => ("사내 AI", "https://gemini.google.com/app"),
        _ => ("Google Gemini", "https://gemini.google.com/app"),
    };

    let url = Url::parse(default_url).map_err(|e| e.to_string())?;
    Ok((name.to_string(), url))
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

/// Show or create AI Side Panel as child webview on main window
#[tauri::command]
pub async fn show_ai_panel(
    app: AppHandle,
    service: Option<String>,
    custom_url: Option<String>,
    x: f64,
    y: f64,
    width: f64,
    height: f64,
) -> Result<(), String> {
    let main_win = app.get_window("main").ok_or("Main window not found")?;

    let svc = service.unwrap_or_else(|| "gemini".to_string());
    let (_name, target_url) = resolve_service_url(&svc, custom_url)?;

    let pos = LogicalPosition::new(x, y);
    let size = LogicalSize::new(width.max(20.0), height.max(20.0));

    if let Some(webview) = app.get_webview("ai-panel") {
        let _ = webview.set_position(pos);
        let _ = webview.set_size(size);
        let _ = webview.show();

        if let Ok(curr) = webview.url() {
            let curr_str = curr.as_str();
            let target_str = target_url.as_str();
            if curr_str != target_str && !curr_str.starts_with(target_str) && !target_str.starts_with(curr_str) {
                let _ = webview.navigate(target_url);
            }
        }
    } else {
        let builder = WebviewBuilder::new(
            "ai-panel",
            WebviewUrl::External(target_url),
        );
        main_win.add_child(builder, pos, size).map_err(|e| e.to_string())?;
    }

    Ok(())
}

/// Hide AI Side Panel
#[tauri::command]
pub async fn hide_ai_panel(app: AppHandle) -> Result<(), String> {
    if let Some(webview) = app.get_webview("ai-panel") {
        let _ = webview.hide();
    }
    Ok(())
}

/// Update AI Side Panel position and size
#[tauri::command]
pub async fn update_ai_panel_bounds(
    app: AppHandle,
    x: f64,
    y: f64,
    width: f64,
    height: f64,
) -> Result<(), String> {
    if let Some(webview) = app.get_webview("ai-panel") {
        let _ = webview.set_position(LogicalPosition::new(x, y));
        let _ = webview.set_size(LogicalSize::new(width.max(20.0), height.max(20.0)));
    }
    Ok(())
}

/// Get currently selected text or code from AI webview (Panel or Floating Window)
#[tauri::command]
pub async fn get_ai_selected_text(app: AppHandle) -> Result<String, String> {
    // 1. Try ai-panel first, then ai-assistant window
    let webview = if let Some(panel) = app.get_webview("ai-panel") {
        panel
    } else if let Some(ai_win) = app.get_webview_window("ai-assistant") {
        ai_win.as_ref().clone()
    } else {
        return Err("AI 도우미가 열려있지 않습니다.".to_string());
    };

    let (tx, rx) = tokio::sync::oneshot::channel();
    let tx_arc = std::sync::Arc::new(std::sync::Mutex::new(Some(tx)));
    let tx_clone = tx_arc.clone();

    let script = r#"
        (function() {
            try {
                // 1. Check window selection
                const sel = window.getSelection();
                if (sel && sel.rangeCount > 0) {
                    const text = sel.toString();
                    if (text && text.trim().length > 0) {
                        return text;
                    }
                }

                // 2. Check active input / textarea selection
                const act = document.activeElement;
                if (act && (act.tagName === 'TEXTAREA' || act.tagName === 'INPUT')) {
                    const s = act.value.substring(act.selectionStart, act.selectionEnd);
                    if (s && s.trim().length > 0) return s;
                }

                // 3. Fallback: check if any code block exists
                const codes = document.querySelectorAll('pre code, .markdown pre code, pre');
                if (codes.length > 0) {
                    const lastCode = codes[codes.length - 1];
                    const ct = lastCode.innerText || lastCode.textContent || "";
                    if (ct && ct.trim().length > 0) return ct;
                }

                return "";
            } catch (e) {
                return "";
            }
        })()
    "#;

    webview.eval_with_callback(script, move |result| {
        if let Ok(mut lock) = tx_clone.lock() {
            if let Some(sender) = lock.take() {
                let _ = sender.send(result);
            }
        }
    }).map_err(|e| e.to_string())?;

    let res = match tokio::time::timeout(tokio::time::Duration::from_millis(2000), rx).await {
        Ok(Ok(s)) => s,
        _ => "".to_string(),
    };

    let cleaned: String = serde_json::from_str(&res).unwrap_or(res);
    Ok(cleaned)
}

/// Reload AI webview
#[tauri::command]
pub async fn reload_ai_panel(app: AppHandle) -> Result<(), String> {
    if let Some(panel) = app.get_webview("ai-panel") {
        let _ = panel.reload();
    } else if let Some(ai_win) = app.get_webview_window("ai-assistant") {
        let _ = ai_win.reload();
    }
    Ok(())
}

/// Navigate AI webview to a specific URL
#[tauri::command]
pub async fn navigate_ai_panel(app: AppHandle, url: String) -> Result<(), String> {
    let parsed_url = Url::parse(&url).map_err(|e| e.to_string())?;
    if let Some(panel) = app.get_webview("ai-panel") {
        let _ = panel.navigate(parsed_url);
    } else if let Some(ai_win) = app.get_webview_window("ai-assistant") {
        let _ = ai_win.navigate(parsed_url);
    }
    Ok(())
}

/// Standalone Window Support
#[tauri::command]
pub async fn open_ai_assistant(
    app: AppHandle,
    service: String,
    custom_url: Option<String>,
    snap: Option<bool>,
) -> Result<(), String> {
    let (name, url) = resolve_service_url(&service, custom_url)?;
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
pub async fn toggle_ai_assistant(
    app: AppHandle,
    service: Option<String>,
    custom_url: Option<String>,
) -> Result<bool, String> {
    if let Some(window) = app.get_webview_window("ai-assistant") {
        let is_visible = window.is_visible().unwrap_or(false);
        if is_visible {
            window.hide().map_err(|e| e.to_string())?;
            return Ok(false);
        }
    }

    let svc = service.unwrap_or_else(|| "gemini".to_string());
    open_ai_assistant(app, svc, custom_url, Some(false)).await?;
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

#[tauri::command]
pub async fn ask_ai_with_prompt(
    app: AppHandle,
    prompt: String,
    _service: Option<String>,
) -> Result<(), String> {
    // 1. Write prompt to native clipboard
    let _ = crate::clipboard_cmd::write_clipboard_text(prompt.clone());

    // 2. Prepare injection script
    let encoded_prompt = serde_json::to_string(&prompt).unwrap_or_else(|_| format!("\"{}\"", prompt));
    let script = format!(
        r#"
        (function() {{
            const text = {};
            let attempts = 0;
            const maxAttempts = 30;

            function tryInject() {{
                attempts++;
                const selectors = [
                    '#prompt-textarea',
                    'rich-textarea div[contenteditable="true"]',
                    'rich-textarea .ql-editor',
                    'div.ProseMirror[contenteditable="true"]',
                    'fieldset div[contenteditable="true"]',
                    'div[contenteditable="true"][role="textbox"]',
                    'div[contenteditable="true"]',
                    'textarea:not([disabled])',
                    'input[type="text"]:not([disabled])'
                ];

                let target = null;
                for (const sel of selectors) {{
                    const el = document.querySelector(sel);
                    if (el && (el.offsetParent !== null || el.offsetHeight > 0 || window.getComputedStyle(el).display !== 'none')) {{
                        target = el;
                        break;
                    }}
                }}

                if (target) {{
                    target.focus();
                    let inserted = false;
                    try {{
                        if (target.isContentEditable) {{
                            document.execCommand('selectAll', false, null);
                            inserted = document.execCommand('insertText', false, text);
                        }} else if (target.tagName === 'TEXTAREA' || target.tagName === 'INPUT') {{
                            target.select();
                            inserted = document.execCommand('insertText', false, text);
                            if (!inserted) {{
                                const setter = Object.getOwnPropertyDescriptor(
                                    target.tagName === 'TEXTAREA'
                                        ? window.HTMLTextAreaElement.prototype
                                        : window.HTMLInputElement.prototype,
                                    'value'
                                )?.set;
                                if (setter) {{
                                    setter.call(target, text);
                                }} else {{
                                    target.value = text;
                                }}
                            }}
                        }}
                    }} catch (e) {{
                        console.error('Text insertion failed:', e);
                    }}

                    target.dispatchEvent(new Event('input', {{ bubbles: true }}));
                    target.dispatchEvent(new Event('change', {{ bubbles: true }}));
                    return true;
                }}

                if (attempts < maxAttempts) {{
                    setTimeout(tryInject, 250);
                }}
                return false;
            }}

            tryInject();
        }})();
        "#,
        encoded_prompt
    );

    // 3. Inject into ai-panel if it exists
    if let Some(panel) = app.get_webview("ai-panel") {
        let _ = panel.set_focus();
        let _ = panel.eval(&script);
        let panel_clone = panel.clone();
        let script_clone = script.clone();
        tokio::spawn(async move {
            for delay in [500, 1200, 2500] {
                tokio::time::sleep(tokio::time::Duration::from_millis(delay)).await;
                let _ = panel_clone.eval(&script_clone);
            }
        });
    }

    // Also inject into ai-assistant window if it exists
    if let Some(ai_win) = app.get_webview_window("ai-assistant") {
        let _ = ai_win.show();
        let _ = ai_win.set_focus();
        let _ = ai_win.eval(&script);
        let win_clone = ai_win.clone();
        let script_clone = script.clone();
        tokio::spawn(async move {
            for delay in [500, 1200, 2500] {
                tokio::time::sleep(tokio::time::Duration::from_millis(delay)).await;
                let _ = win_clone.eval(&script_clone);
            }
        });
    }

    Ok(())
}
