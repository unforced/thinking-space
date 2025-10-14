// Prevents additional console window on Windows in release
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod auth;
mod conversations;
mod settings;
mod sidecar;
mod spaces;

use sidecar::SidecarManager;
use std::sync::Arc;

fn main() {
    let sidecar = Arc::new(SidecarManager::new());
    let sidecar_clone = sidecar.clone();

    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .setup(move |app| {
            // Set app handle for event emission
            sidecar_clone.set_app_handle(app.handle().clone());

            // Start sidecar process
            sidecar_clone
                .start()
                .expect("Failed to start sidecar process");

            Ok(())
        })
        .manage(sidecar)
        .invoke_handler(tauri::generate_handler![
            spaces::list_spaces,
            spaces::create_space,
            spaces::delete_space,
            spaces::update_last_accessed,
            spaces::read_claude_md,
            spaces::write_claude_md,
            spaces::list_space_files,
            spaces::open_file,
            spaces::read_file_content,
            conversations::save_conversation,
            conversations::load_conversation,
            conversations::delete_conversation,
            conversations::list_conversations,
            settings::load_settings,
            settings::save_settings,
            settings::get_data_location,
            settings::open_data_folder,
            auth::has_claude_code_auth,
            auth::load_claude_credentials,
            auth::load_claude_credentials_file,
            auth::load_api_key,
            auth::save_api_key,
            auth::refresh_oauth_token,
            auth::open_external_url,
            sidecar::agent_send_message,
            sidecar::agent_start_sidecar,
            sidecar::agent_stop_sidecar,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
