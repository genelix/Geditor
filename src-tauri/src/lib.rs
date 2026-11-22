mod fs_cmd;
mod pty_cmd;
mod search_cmd;

use pty_cmd::PtyState;
use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use tauri::{
    menu::{Menu, MenuItem, PredefinedMenuItem, Submenu},
    Emitter,
};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let pty_state: PtyState = Arc::new(Mutex::new(HashMap::new()));

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .manage(pty_state)
        .setup(|app| {
            // 1. Geditor App Menu (macOS specific)
            let app_menu = Submenu::with_items(
                app,
                "Geditor",
                true,
                &[
                    &PredefinedMenuItem::about(app, Some("Geditor 정보"), None)?,
                    &PredefinedMenuItem::separator(app)?,
                    &MenuItem::with_id(app, "open_settings", "환경설정...", true, Some("CmdOrCtrl+,"))?,
                    &PredefinedMenuItem::separator(app)?,
                    &PredefinedMenuItem::services(app, Some("서비스"))?,
                    &PredefinedMenuItem::separator(app)?,
                    &PredefinedMenuItem::hide(app, Some("Geditor 가리기"))?,
                    &PredefinedMenuItem::hide_others(app, Some("기타 가리기"))?,
                    &PredefinedMenuItem::show_all(app, Some("모두 보기"))?,
                    &PredefinedMenuItem::separator(app)?,
                    &PredefinedMenuItem::quit(app, Some("Geditor 종료"))?,
                ],
            )?;

            // 2. 파일 (File)
            let file_menu = Submenu::with_items(
                app,
                "파일",
                true,
                &[
                    &MenuItem::with_id(app, "new_file", "새 파일", true, Some("CmdOrCtrl+N"))?,
                    &MenuItem::with_id(app, "open_file", "파일 열기...", true, Some("CmdOrCtrl+O"))?,
                    &MenuItem::with_id(app, "save_file", "저장", true, Some("CmdOrCtrl+S"))?,
                    &MenuItem::with_id(app, "save_as_file", "다른 이름으로 저장...", true, Some("CmdOrCtrl+Shift+S"))?,
                    &PredefinedMenuItem::separator(app)?,
                    &MenuItem::with_id(app, "close_tab", "탭 / 패널 닫기", true, Some("CmdOrCtrl+W"))?,
                ],
            )?;

            // 3. 편집 (Edit)
            let edit_menu = Submenu::with_items(
                app,
                "편집",
                true,
                &[
                    &PredefinedMenuItem::undo(app, Some("실행 취소"))?,
                    &PredefinedMenuItem::redo(app, Some("다시 실행"))?,
                    &PredefinedMenuItem::separator(app)?,
                    &PredefinedMenuItem::cut(app, Some("잘라내기"))?,
                    &PredefinedMenuItem::copy(app, Some("복사"))?,
                    &PredefinedMenuItem::paste(app, Some("붙여넣기"))?,
                    &PredefinedMenuItem::select_all(app, Some("모두 선택"))?,
                ],
            )?;

            // 4. 보기 (View)
            let view_menu = Submenu::with_items(
                app,
                "보기",
                true,
                &[
                    &MenuItem::with_id(app, "toggle_sidebar", "탐색기 표시 / 숨기기", true, Some("CmdOrCtrl+B"))?,
                    &MenuItem::with_id(app, "split_right", "화면 우측 분할", true, Some("CmdOrCtrl+\\"))?,
                    &MenuItem::with_id(app, "open_terminal", "내장 터미널 열기", true, Some("CmdOrCtrl+T"))?,
                ],
            )?;

            // 5. 설정 (Preferences / Options)
            let settings_menu = Submenu::with_items(
                app,
                "설정",
                true,
                &[
                    &MenuItem::with_id(app, "open_settings", "환경설정 열기...", true, Some("CmdOrCtrl+,"))?,
                    &PredefinedMenuItem::separator(app)?,
                    &MenuItem::with_id(app, "theme_dark", "다크 테마 (VS Dark)", true, None::<&str>)?,
                    &MenuItem::with_id(app, "theme_light", "라이트 테마 (VS Light)", true, None::<&str>)?,
                    &MenuItem::with_id(app, "theme_hc", "고대비 블랙 테마", true, None::<&str>)?,
                ],
            )?;

            // 6. 창 (Window)
            let window_menu = Submenu::with_items(
                app,
                "창",
                true,
                &[
                    &PredefinedMenuItem::minimize(app, Some("최소화"))?,
                    &PredefinedMenuItem::separator(app)?,
                    &MenuItem::with_id(app, "toggle_maximize", "확대/축소", true, None::<&str>)?,
                ],
            )?;

            // 7. 도움말 (Help)
            let help_menu = Submenu::with_items(
                app,
                "도움말",
                true,
                &[
                    &MenuItem::with_id(app, "help_shortcuts", "Geditor 단축키 및 정보", true, None::<&str>)?,
                ],
            )?;

            let menu = Menu::with_items(
                app,
                &[
                    &app_menu,
                    &file_menu,
                    &edit_menu,
                    &view_menu,
                    &settings_menu,
                    &window_menu,
                    &help_menu,
                ],
            )?;

            app.set_menu(menu)?;

            app.on_menu_event(|app_handle, event| {
                let id_str = event.id().as_ref();
                let _ = app_handle.emit("menu_event", id_str);
            });

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            fs_cmd::read_file_content,
            fs_cmd::write_file_content,
            fs_cmd::list_directory,
            fs_cmd::create_file_entry,
            fs_cmd::create_dir_entry,
            fs_cmd::delete_entry,
            fs_cmd::rename_entry,
            fs_cmd::get_default_workspace,
            fs_cmd::inspect_path,
            fs_cmd::save_file_dialog,
            fs_cmd::open_file_dialog,
            fs_cmd::open_folder_dialog,
            search_cmd::search_in_files,
            pty_cmd::terminal_spawn,
            pty_cmd::terminal_write,
            pty_cmd::terminal_resize,
            pty_cmd::terminal_close,
        ])
        .run(tauri::generate_context!())
        .expect("error while running geditor application");
}
