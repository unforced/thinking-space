use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct OAuthCredentials {
    #[serde(rename = "accessToken")]
    pub access_token: String,
    #[serde(rename = "refreshToken")]
    pub refresh_token: String,
    #[serde(rename = "expiresAt")]
    pub expires_at: i64,
    pub scopes: Vec<String>,
}

/// Get the path to Claude Code credentials file
fn get_claude_credentials_path() -> PathBuf {
    let home = dirs::home_dir().expect("Could not find home directory");
    home.join(".claude").join(".credentials.json")
}

/// Get the path to Thinking Space config directory
fn get_config_dir() -> PathBuf {
    let home = dirs::home_dir().expect("Could not find home directory");
    home.join(".thinking-space")
}

/// Load OAuth credentials from Claude Code credentials file
#[tauri::command]
pub fn load_claude_credentials_file() -> Result<Option<OAuthCredentials>, String> {
    let creds_path = get_claude_credentials_path();

    if !creds_path.exists() {
        return Ok(None);
    }

    let content = fs::read_to_string(&creds_path)
        .map_err(|e| format!("Failed to read credentials file: {}", e))?;

    let creds: OAuthCredentials = serde_json::from_str(&content)
        .map_err(|e| format!("Failed to parse credentials: {}", e))?;

    Ok(Some(creds))
}

/// Load OAuth credentials from system keychain (macOS/Linux/Windows)
#[tauri::command]
pub fn load_claude_credentials() -> Result<Option<OAuthCredentials>, String> {
    #[cfg(target_os = "macos")]
    {
        use security_framework::passwords::*;

        // Try to get credentials from macOS Keychain
        // Claude Code stores under service "ClaudeCode" and account "oauth"
        match get_generic_password("ClaudeCode", "oauth") {
            Ok(password) => {
                let creds_str = String::from_utf8(password.to_vec())
                    .map_err(|e| format!("Invalid UTF-8 in keychain: {}", e))?;

                let creds: OAuthCredentials = serde_json::from_str(&creds_str)
                    .map_err(|e| format!("Failed to parse keychain credentials: {}", e))?;

                Ok(Some(creds))
            }
            Err(_) => {
                // Not found in keychain, try file
                load_claude_credentials_file()
            }
        }
    }

    #[cfg(not(target_os = "macos"))]
    {
        // On Linux/Windows, fall back to file-based credentials
        load_claude_credentials_file()
    }
}

/// Load API key from Thinking Space settings
#[tauri::command]
pub fn load_api_key() -> Result<Option<String>, String> {
    let config_path = get_config_dir().join("config.json");

    if !config_path.exists() {
        return Ok(None);
    }

    let content =
        fs::read_to_string(&config_path).map_err(|e| format!("Failed to read config: {}", e))?;

    let config: serde_json::Value =
        serde_json::from_str(&content).map_err(|e| format!("Failed to parse config: {}", e))?;

    Ok(config
        .get("apiKey")
        .and_then(|v| v.as_str())
        .map(|s| s.to_string()))
}

/// Save API key to Thinking Space settings
#[tauri::command]
pub fn save_api_key(api_key: String) -> Result<(), String> {
    let config_dir = get_config_dir();
    fs::create_dir_all(&config_dir)
        .map_err(|e| format!("Failed to create config directory: {}", e))?;

    let config_path = config_dir.join("config.json");

    // Load existing config or create new one
    let mut config: serde_json::Value = if config_path.exists() {
        let content = fs::read_to_string(&config_path)
            .map_err(|e| format!("Failed to read config: {}", e))?;
        serde_json::from_str(&content).map_err(|e| format!("Failed to parse config: {}", e))?
    } else {
        serde_json::json!({})
    };

    // Update API key
    if let Some(obj) = config.as_object_mut() {
        obj.insert("apiKey".to_string(), serde_json::Value::String(api_key));
    }

    // Save back to file
    let content = serde_json::to_string_pretty(&config)
        .map_err(|e| format!("Failed to serialize config: {}", e))?;

    fs::write(&config_path, content).map_err(|e| format!("Failed to write config: {}", e))?;

    Ok(())
}

/// Refresh OAuth token (placeholder - actual implementation would call Anthropic API)
#[tauri::command]
pub fn refresh_oauth_token(_refresh_token: String) -> Result<OAuthCredentials, String> {
    // This would need to call Anthropic's OAuth refresh endpoint
    // For now, return an error as this requires Anthropic API access
    Err("Token refresh not yet implemented - please re-authenticate with Claude Code".to_string())
}

/// Open external URL in default browser
#[tauri::command]
pub fn open_external_url(url: String) -> Result<(), String> {
    opener::open(url).map_err(|e| format!("Failed to open URL: {}", e))
}
