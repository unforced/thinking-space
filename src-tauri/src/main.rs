// Prevents additional console window on Windows in release
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod spaces;

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .invoke_handler(tauri::generate_handler![
            spaces::list_spaces,
            spaces::create_space,
            spaces::delete_space,
            spaces::update_last_accessed,
            spaces::read_claude_md,
            spaces::write_claude_md,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
