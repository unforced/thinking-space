use dirs::home_dir;
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Settings {
    pub api_key: Option<String>,
    pub theme: String, // "light" | "dark" | "system"
}

impl Default for Settings {
    fn default() -> Self {
        Self {
            api_key: None,
            theme: "system".to_string(),
        }
    }
}

fn get_settings_path() -> Result<PathBuf, String> {
    let home = home_dir().ok_or("Could not determine home directory")?;
    let settings_dir = home.join(".thinking-space");

    // Create directory if it doesn't exist
    if !settings_dir.exists() {
        fs::create_dir_all(&settings_dir)
            .map_err(|e| format!("Failed to create settings directory: {}", e))?;
    }

    Ok(settings_dir.join("settings.json"))
}

#[tauri::command]
pub fn load_settings() -> Result<Settings, String> {
    let settings_path = get_settings_path()?;

    if !settings_path.exists() {
        // Return default settings if file doesn't exist
        return Ok(Settings::default());
    }

    let contents = fs::read_to_string(&settings_path)
        .map_err(|e| format!("Failed to read settings file: {}", e))?;

    let settings: Settings = serde_json::from_str(&contents)
        .map_err(|e| format!("Failed to parse settings file: {}", e))?;

    Ok(settings)
}

#[tauri::command]
pub fn save_settings(settings: Settings) -> Result<(), String> {
    let settings_path = get_settings_path()?;

    let json = serde_json::to_string_pretty(&settings)
        .map_err(|e| format!("Failed to serialize settings: {}", e))?;

    fs::write(&settings_path, json).map_err(|e| format!("Failed to write settings file: {}", e))?;

    Ok(())
}

#[tauri::command]
pub fn get_data_location() -> Result<String, String> {
    let home = home_dir().ok_or("Could not determine home directory")?;
    let data_path = home.join(".thinking-space");

    Ok(data_path.to_string_lossy().to_string())
}

#[tauri::command]
pub fn open_data_folder() -> Result<(), String> {
    let home = home_dir().ok_or("Could not determine home directory")?;
    let data_path = home.join(".thinking-space");

    // Create directory if it doesn't exist
    if !data_path.exists() {
        fs::create_dir_all(&data_path)
            .map_err(|e| format!("Failed to create data directory: {}", e))?;
    }

    // Open in system file manager
    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open")
            .arg(&data_path)
            .spawn()
            .map_err(|e| format!("Failed to open folder: {}", e))?;
    }

    #[cfg(target_os = "windows")]
    {
        std::process::Command::new("explorer")
            .arg(&data_path)
            .spawn()
            .map_err(|e| format!("Failed to open folder: {}", e))?;
    }

    #[cfg(target_os = "linux")]
    {
        std::process::Command::new("xdg-open")
            .arg(&data_path)
            .spawn()
            .map_err(|e| format!("Failed to open folder: {}", e))?;
    }

    Ok(())
}
