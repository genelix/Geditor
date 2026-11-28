use portable_pty::{native_pty_system, CommandBuilder, MasterPty, PtySize};
use std::collections::HashMap;
use std::io::{Read, Write};
use std::sync::{Arc, Mutex};
use tauri::{AppHandle, Emitter, State};

pub struct PtySession {
    pub writer: Box<dyn Write + Send>,
    pub master: Box<dyn MasterPty + Send>,
}

pub type PtyState = Arc<Mutex<HashMap<String, PtySession>>>;

#[tauri::command]
pub fn terminal_spawn(
    app: AppHandle,
    state: State<'_, PtyState>,
    id: String,
    cols: u16,
    rows: u16,
    cwd: Option<String>,
) -> Result<(), String> {
    let pty_system = native_pty_system();
    let pair = pty_system
        .openpty(PtySize {
            rows,
            cols,
            pixel_width: 0,
            pixel_height: 0,
        })
        .map_err(|e| format!("Failed to open pty: {}", e))?;

    // Auto-detect shell: Windows (PowerShell / cmd.exe), macOS/Linux (zsh / bash)
    let shell = if cfg!(target_os = "windows") {
        std::env::var("COMSPEC").unwrap_or_else(|_| "powershell.exe".to_string())
    } else {
        std::env::var("SHELL").unwrap_or_else(|_| "/bin/zsh".to_string())
    };
    let mut cmd = CommandBuilder::new(&shell);
    cmd.env("TERM", "xterm-256color");

    if let Some(ref dir) = cwd {
        if !dir.is_empty() {
            cmd.cwd(dir);
        }
    }

    let _child = pair
        .slave
        .spawn_command(cmd)
        .map_err(|e| format!("Failed to spawn shell: {}", e))?;

    let mut reader = pair
        .master
        .try_clone_reader()
        .map_err(|e| format!("Failed to clone pty reader: {}", e))?;

    let writer = pair
        .master
        .take_writer()
        .map_err(|e| format!("Failed to take pty writer: {}", e))?;

    let id_clone = id.clone();
    let app_handle = app.clone();

    std::thread::spawn(move || {
        let mut buf = [0u8; 4096];
        loop {
            match reader.read(&mut buf) {
                Ok(0) => break,
                Ok(n) => {
                    let text = String::from_utf8_lossy(&buf[..n]).to_string();
                    let event_name = format!("terminal-output-{}", id_clone);
                    if app_handle.emit(&event_name, text).is_err() {
                        break;
                    }
                }
                Err(_) => break,
            }
        }
    });

    let mut map = state.lock().map_err(|e| e.to_string())?;
    map.insert(
        id,
        PtySession {
            writer,
            master: pair.master,
        },
    );

    Ok(())
}

#[tauri::command]
pub fn terminal_write(
    state: State<'_, PtyState>,
    id: String,
    data: String,
) -> Result<(), String> {
    let mut map = state.lock().map_err(|e| e.to_string())?;
    if let Some(session) = map.get_mut(&id) {
        session
            .writer
            .write_all(data.as_bytes())
            .map_err(|e| e.to_string())?;
        session.writer.flush().map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
pub fn terminal_resize(
    state: State<'_, PtyState>,
    id: String,
    cols: u16,
    rows: u16,
) -> Result<(), String> {
    let mut map = state.lock().map_err(|e| e.to_string())?;
    if let Some(session) = map.get_mut(&id) {
        let _ = session.master.resize(PtySize {
            rows,
            cols,
            pixel_width: 0,
            pixel_height: 0,
        });
    }
    Ok(())
}

#[tauri::command]
pub fn terminal_close(state: State<'_, PtyState>, id: String) -> Result<(), String> {
    let mut map = state.lock().map_err(|e| e.to_string())?;
    map.remove(&id);
    Ok(())
}
