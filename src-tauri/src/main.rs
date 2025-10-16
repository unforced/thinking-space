// Prevents additional console window on Windows in release
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod acp_v2;
mod auth;
mod conversations;
mod settings;
mod spaces;

use acp_v2::AcpManager;
use std::sync::Arc;

fn main() {
    let acp_manager = Arc::new(AcpManager::new());
    let acp_manager_clone = acp_manager.clone();

    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .setup(move |app| {
            // Set app handle for event emission
            acp_manager_clone.set_app_handle(app.handle().clone());

            Ok(())
        })
        .manage(acp_manager)
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
            // ACP (Agent Client Protocol) commands
            acp_v2::manager::agent_v2_send_message,
            acp_v2::manager::agent_v2_start,
            acp_v2::manager::agent_v2_stop,
            acp_v2::manager::agent_v2_send_permission_response,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
