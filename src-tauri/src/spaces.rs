use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use std::time::SystemTime;
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Space {
    pub id: String,
    pub name: String,
    pub path: String,
    pub claude_md_path: String,
    pub created_at: i64,
    pub last_accessed_at: i64,
    pub template: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct CreateSpaceRequest {
    pub name: String,
    pub template: String,
}

pub fn get_spaces_dir() -> Result<PathBuf, String> {
    let home = dirs::home_dir().ok_or("Could not find home directory")?;
    let spaces_dir = home.join(".thinking-space").join("spaces");

    if !spaces_dir.exists() {
        fs::create_dir_all(&spaces_dir)
            .map_err(|e| format!("Failed to create spaces directory: {}", e))?;
    }

    Ok(spaces_dir)
}

pub fn get_template_content(template: &str) -> String {
    match template {
        "quick-start" => r#"# {name}

## Purpose
This is a workspace for [brief description].

## Context
[Any relevant context Claude should know]

## Guidelines
- [Any specific instructions for Claude]
"#
        .to_string(),
        "custom" => r#"# {name}

[Write your own instructions for Claude]
"#
        .to_string(),
        _ => get_template_content("quick-start"),
    }
}

#[tauri::command]
pub fn list_spaces() -> Result<Vec<Space>, String> {
    let spaces_dir = get_spaces_dir()?;
    let mut spaces = Vec::new();

    if let Ok(entries) = fs::read_dir(spaces_dir) {
        for entry in entries.flatten() {
            if entry.path().is_dir() {
                let metadata_path = entry.path().join(".space-metadata.json");
                if let Ok(contents) = fs::read_to_string(&metadata_path) {
                    if let Ok(mut space) = serde_json::from_str::<Space>(&contents) {
                        // Migration: Fix old timestamps in seconds (< year 2100 in milliseconds)
                        // Any timestamp less than 100000000000 is in seconds, not milliseconds
                        let threshold = 100_000_000_000i64; // Jan 1, 2001 in milliseconds

                        let mut needs_update = false;

                        if space.created_at < threshold {
                            space.created_at = space.created_at * 1000;
                            needs_update = true;
                        }

                        if space.last_accessed_at < threshold {
                            space.last_accessed_at = space.last_accessed_at * 1000;
                            needs_update = true;
                        }

                        // Save the migrated metadata
                        if needs_update {
                            if let Ok(metadata_json) = serde_json::to_string_pretty(&space) {
                                let _ = fs::write(&metadata_path, metadata_json);
                            }
                        }

                        spaces.push(space);
                    }
                }
            }
        }
    }

    // Sort by last accessed (most recent first)
    spaces.sort_by(|a, b| b.last_accessed_at.cmp(&a.last_accessed_at));

    Ok(spaces)
}

#[tauri::command]
pub fn create_space(request: CreateSpaceRequest) -> Result<Space, String> {
    let spaces_dir = get_spaces_dir()?;
    let id = Uuid::new_v4().to_string();
    let space_dir = spaces_dir.join(&id);

    // Create space directory
    fs::create_dir_all(&space_dir)
        .map_err(|e| format!("Failed to create space directory: {}", e))?;

    // Create CLAUDE.md from template
    let template_content = get_template_content(&request.template);
    let claude_md_content = template_content.replace("{name}", &request.name);
    let claude_md_path = space_dir.join("CLAUDE.md");

    fs::write(&claude_md_path, claude_md_content)
        .map_err(|e| format!("Failed to create CLAUDE.md: {}", e))?;

    // Create space metadata
    // Use timestamp_millis() to match JavaScript Date expectations
    let now = chrono::Utc::now().timestamp_millis();
    let space = Space {
        id: id.clone(),
        name: request.name,
        path: space_dir.to_string_lossy().to_string(),
        claude_md_path: claude_md_path.to_string_lossy().to_string(),
        created_at: now,
        last_accessed_at: now,
        template: Some(request.template),
    };

    // Save metadata
    let metadata_path = space_dir.join(".space-metadata.json");
    let metadata_json = serde_json::to_string_pretty(&space)
        .map_err(|e| format!("Failed to serialize metadata: {}", e))?;

    fs::write(metadata_path, metadata_json)
        .map_err(|e| format!("Failed to write metadata: {}", e))?;

    Ok(space)
}

#[tauri::command]
pub fn delete_space(id: String) -> Result<(), String> {
    let spaces_dir = get_spaces_dir()?;
    let space_dir = spaces_dir.join(&id);

    if space_dir.exists() {
        fs::remove_dir_all(space_dir).map_err(|e| format!("Failed to delete space: {}", e))?;
    }

    // Also delete the conversation for this space
    // Note: We don't fail if conversation deletion fails, since the space is already deleted
    let _ = crate::conversations::delete_conversation(id);

    Ok(())
}

#[tauri::command]
pub fn update_last_accessed(id: String) -> Result<(), String> {
    let spaces_dir = get_spaces_dir()?;
    let metadata_path = spaces_dir.join(&id).join(".space-metadata.json");

    if let Ok(contents) = fs::read_to_string(&metadata_path) {
        if let Ok(mut space) = serde_json::from_str::<Space>(&contents) {
            // Use timestamp_millis() to match JavaScript Date expectations
            space.last_accessed_at = chrono::Utc::now().timestamp_millis();

            let metadata_json = serde_json::to_string_pretty(&space)
                .map_err(|e| format!("Failed to serialize metadata: {}", e))?;

            fs::write(metadata_path, metadata_json)
                .map_err(|e| format!("Failed to write metadata: {}", e))?;
        }
    }

    Ok(())
}

#[tauri::command]
pub fn read_claude_md(space_id: String) -> Result<String, String> {
    let spaces_dir = get_spaces_dir()?;
    let claude_md_path = spaces_dir.join(&space_id).join("CLAUDE.md");

    fs::read_to_string(claude_md_path).map_err(|e| format!("Failed to read CLAUDE.md: {}", e))
}

#[tauri::command]
pub fn write_claude_md(space_id: String, content: String) -> Result<(), String> {
    let spaces_dir = get_spaces_dir()?;
    let claude_md_path = spaces_dir.join(&space_id).join("CLAUDE.md");

    fs::write(claude_md_path, content).map_err(|e| format!("Failed to write CLAUDE.md: {}", e))
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SpaceFile {
    pub name: String,
    pub path: String,
    pub size: u64,
    pub modified: i64,
    pub is_directory: bool,
}

#[tauri::command]
pub fn list_space_files(space_id: String) -> Result<Vec<SpaceFile>, String> {
    let spaces_dir = get_spaces_dir()?;
    let space_dir = spaces_dir.join(&space_id);

    if !space_dir.exists() {
        return Err("Space directory not found".to_string());
    }

    let mut files = Vec::new();

    if let Ok(entries) = fs::read_dir(&space_dir) {
        for entry in entries.flatten() {
            let path = entry.path();

            // Skip hidden files and metadata
            let file_name = entry.file_name().to_string_lossy().to_string();
            if file_name.starts_with('.') {
                continue;
            }

            if let Ok(metadata) = entry.metadata() {
                let modified = metadata
                    .modified()
                    .ok()
                    .and_then(|time| {
                        time.duration_since(SystemTime::UNIX_EPOCH)
                            .ok()
                            .map(|d| d.as_millis() as i64)
                    })
                    .unwrap_or(0);

                files.push(SpaceFile {
                    name: file_name,
                    path: path.to_string_lossy().to_string(),
                    size: metadata.len(),
                    modified,
                    is_directory: metadata.is_dir(),
                });
            }
        }
    }

    // Sort by name
    files.sort_by(|a, b| a.name.cmp(&b.name));

    Ok(files)
}

#[tauri::command]
pub fn open_file(path: String) -> Result<(), String> {
    opener::open(&path).map_err(|e| format!("Failed to open file: {}", e))
}

#[tauri::command]
pub fn read_file_content(path: String) -> Result<String, String> {
    // Security: Validate path to prevent path traversal attacks
    let path_buf = PathBuf::from(&path);

    // Canonicalize to resolve symlinks and relative paths
    let canonical = path_buf
        .canonicalize()
        .map_err(|e| format!("Invalid path: {}", e))?;

    // Only allow reads from user's home directory
    let home_dir = dirs::home_dir().ok_or("Cannot determine home directory")?;

    if !canonical.starts_with(&home_dir) {
        return Err("Access denied: path outside allowed directory".to_string());
    }

    // Additional check: Don't allow reading sensitive files
    let file_name = canonical.file_name().and_then(|n| n.to_str()).unwrap_or("");

    // Block common sensitive files
    let blocked_files = [
        ".env",
        ".aws",
        ".ssh",
        "id_rsa",
        "id_ed25519",
        "credentials",
        "config",
        ".netrc",
        ".git-credentials",
    ];

    if blocked_files
        .iter()
        .any(|&blocked| file_name.contains(blocked))
    {
        return Err("Access denied: cannot read sensitive files".to_string());
    }

    fs::read_to_string(&canonical).map_err(|e| format!("Failed to read file: {}", e))
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Write;
    use tempfile::NamedTempFile;

    #[test]
    fn test_path_traversal_prevention() {
        // Test various path traversal attack vectors
        let attacks = vec![
            "../../../etc/passwd",
            "..\\..\\..\\Windows\\System32",
            "/etc/shadow",
            "/root/.ssh/id_rsa",
        ];

        for attack in attacks {
            let result = read_file_content(attack.to_string());
            assert!(result.is_err(), "Failed to block path traversal: {}", attack);
            assert!(
                result.as_ref().unwrap_err().contains("Invalid path")
                    || result.as_ref().unwrap_err().contains("Access denied"),
                "Expected security error for: {}",
                attack
            );
        }
    }

    #[test]
    fn test_sensitive_file_blocking() {
        // Create a temp file with a blocked name
        let temp_dir = tempfile::tempdir().unwrap();
        let sensitive_path = temp_dir.path().join("id_rsa");
        std::fs::write(&sensitive_path, "sensitive data").unwrap();

        let result = read_file_content(sensitive_path.to_string_lossy().to_string());

        assert!(result.is_err());
        assert!(result.unwrap_err().contains("sensitive files"));
    }

    #[test]
    fn test_allowed_file_read() {
        // Create a temp file in a safe location
        let mut temp_file = NamedTempFile::new().unwrap();
        let test_content = "test content";
        temp_file.write_all(test_content.as_bytes()).unwrap();
        temp_file.flush().unwrap();

        let result = read_file_content(temp_file.path().to_string_lossy().to_string());

        assert!(result.is_ok(), "Should allow reading safe file");
        assert_eq!(result.unwrap(), test_content);
    }

    #[test]
    fn test_get_spaces_dir_creates_directory() {
        let result = get_spaces_dir();
        assert!(result.is_ok());

        let spaces_dir = result.unwrap();
        assert!(spaces_dir.exists());
        assert!(spaces_dir.ends_with(".thinking-space/spaces"));
    }

    #[test]
    fn test_get_template_content_quick_start() {
        let template = get_template_content("quick-start");
        assert!(template.contains("# {name}"));
        assert!(template.contains("## Purpose"));
        assert!(template.contains("## Context"));
        assert!(template.contains("## Guidelines"));
    }

    #[test]
    fn test_get_template_content_custom() {
        let template = get_template_content("custom");
        assert!(template.contains("# {name}"));
        assert!(template.contains("[Write your own instructions for Claude]"));
    }

    #[test]
    fn test_get_template_content_invalid_defaults_to_quick_start() {
        let template = get_template_content("invalid-template-name");
        assert_eq!(template, get_template_content("quick-start"));
    }
}
