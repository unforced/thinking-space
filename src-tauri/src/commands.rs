use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;

/// Get the commands directory for a space
fn get_commands_directory(space_path: &str) -> String {
    PathBuf::from(space_path)
        .join(".claude")
        .join("commands")
        .to_string_lossy()
        .to_string()
}

/// Represents a slash command loaded from a markdown file
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SlashCommand {
    /// Command name (derived from filename without .md extension)
    pub name: String,
    /// Full path to the command file
    pub path: String,
    /// Command description (first line of the markdown file)
    pub description: String,
    /// Full markdown content/template
    pub template: String,
    /// Whether this command expects arguments
    pub accepts_arguments: bool,
}

/// Load all slash commands from a directory
pub fn load_commands_from_directory(dir_path: &str) -> Result<Vec<SlashCommand>, String> {
    let path = PathBuf::from(dir_path);

    // Create directory if it doesn't exist
    if !path.exists() {
        fs::create_dir_all(&path)
            .map_err(|e| format!("Failed to create commands directory: {}", e))?;

        // Create sample command files to get users started

        // 1. Explain command
        let explain_path = path.join("explain.md");
        let explain_content = r#"# Explain

Explain $ARGUMENTS in simple terms, using analogies and examples where helpful. Break down complex concepts into easy-to-understand pieces."#;
        fs::write(&explain_path, explain_content)
            .map_err(|e| format!("Failed to create explain command: {}", e))?;

        // 2. Summarize command
        let summarize_path = path.join("summarize.md");
        let summarize_content = r#"# Summarize

Provide a concise summary of $ARGUMENTS in 3-5 bullet points, highlighting the most important information."#;
        fs::write(&summarize_path, summarize_content)
            .map_err(|e| format!("Failed to create summarize command: {}", e))?;

        // 3. Brainstorm command
        let brainstorm_path = path.join("brainstorm.md");
        let brainstorm_content = r#"# Brainstorm

Generate 10 creative ideas for $ARGUMENTS. Think outside the box and include both conventional and unconventional approaches."#;
        fs::write(&brainstorm_path, brainstorm_content)
            .map_err(|e| format!("Failed to create brainstorm command: {}", e))?;

        // 4. Example command showing how to create your own
        let sample_path = path.join("example.md");
        let sample_content = r#"# Example Command

This is a sample slash command showing how they work.

## How to use:
Type `/example your topic here` and this template will be sent to Claude with "your topic here" replacing $ARGUMENTS.

## Creating your own:
1. Create a new .md file in the .claude/commands/ directory
2. Use $ARGUMENTS where you want user input to be inserted
3. The command name will be the filename (without .md)

Feel free to edit or delete this file!"#;

        fs::write(&sample_path, sample_content)
            .map_err(|e| format!("Failed to create sample command: {}", e))?;
    }

    let mut commands = Vec::new();

    // Read all .md files in the directory
    let entries =
        fs::read_dir(&path).map_err(|e| format!("Failed to read commands directory: {}", e))?;

    for entry in entries {
        let entry = entry.map_err(|e| format!("Failed to read directory entry: {}", e))?;
        let path = entry.path();

        // Only process .md files
        if path.extension().and_then(|s| s.to_str()) != Some("md") {
            continue;
        }

        // Read file content
        let content = fs::read_to_string(&path)
            .map_err(|e| format!("Failed to read command file {:?}: {}", path, e))?;

        if content.trim().is_empty() {
            continue;
        }

        // Extract command name from filename
        let name = path
            .file_stem()
            .and_then(|s| s.to_str())
            .ok_or_else(|| format!("Invalid command filename: {:?}", path))?
            .to_string();

        // Extract description (first non-empty line that's not a heading marker)
        let description = content
            .lines()
            .map(|line| line.trim())
            .filter(|line| !line.is_empty() && !line.starts_with('#'))
            .next()
            .unwrap_or("No description")
            .to_string();

        // Check if command accepts arguments
        let accepts_arguments = content.contains("$ARGUMENTS");

        commands.push(SlashCommand {
            name,
            path: path.to_string_lossy().to_string(),
            description,
            template: content,
            accepts_arguments,
        });
    }

    // Sort commands alphabetically
    commands.sort_by(|a, b| a.name.cmp(&b.name));

    Ok(commands)
}

/// Load a single command by name
pub fn load_command(dir_path: &str, command_name: &str) -> Result<SlashCommand, String> {
    let path = PathBuf::from(dir_path).join(format!("{}.md", command_name));

    if !path.exists() {
        return Err(format!("Command '{}' not found", command_name));
    }

    let content =
        fs::read_to_string(&path).map_err(|e| format!("Failed to read command file: {}", e))?;

    let description = content
        .lines()
        .map(|line| line.trim())
        .filter(|line| !line.is_empty() && !line.starts_with('#'))
        .next()
        .unwrap_or("No description")
        .to_string();

    let accepts_arguments = content.contains("$ARGUMENTS");

    Ok(SlashCommand {
        name: command_name.to_string(),
        path: path.to_string_lossy().to_string(),
        description,
        template: content,
        accepts_arguments,
    })
}

/// Expand a command template with arguments
pub fn expand_command_template(template: &str, arguments: &str) -> String {
    template.replace("$ARGUMENTS", arguments)
}

/// Create a new command file
pub fn create_command(
    dir_path: &str,
    command_name: &str,
    description: &str,
    template: &str,
) -> Result<SlashCommand, String> {
    let path = PathBuf::from(dir_path);

    // Create directory if it doesn't exist
    if !path.exists() {
        fs::create_dir_all(&path)
            .map_err(|e| format!("Failed to create commands directory: {}", e))?;
    }

    let file_path = path.join(format!("{}.md", command_name));

    // Check if command already exists
    if file_path.exists() {
        return Err(format!("Command '{}' already exists", command_name));
    }

    // Create markdown content
    let content = format!("# {}\n\n{}\n\n{}", command_name, description, template);

    // Write file
    fs::write(&file_path, &content).map_err(|e| format!("Failed to create command file: {}", e))?;

    let accepts_arguments = template.contains("$ARGUMENTS");

    Ok(SlashCommand {
        name: command_name.to_string(),
        path: file_path.to_string_lossy().to_string(),
        description: description.to_string(),
        template: content,
        accepts_arguments,
    })
}

/// Delete a command file
pub fn delete_command(dir_path: &str, command_name: &str) -> Result<(), String> {
    let path = PathBuf::from(dir_path).join(format!("{}.md", command_name));

    if !path.exists() {
        return Err(format!("Command '{}' not found", command_name));
    }

    fs::remove_file(&path).map_err(|e| format!("Failed to delete command: {}", e))
}

// =============================================================================
// Tauri Commands
// =============================================================================

#[tauri::command]
pub fn list_slash_commands(space_path: String) -> Result<Vec<SlashCommand>, String> {
    let commands_dir = get_commands_directory(&space_path);
    load_commands_from_directory(&commands_dir)
}

#[tauri::command]
pub fn load_slash_command(
    space_path: String,
    command_name: String,
) -> Result<SlashCommand, String> {
    let commands_dir = get_commands_directory(&space_path);
    load_command(&commands_dir, &command_name)
}

#[tauri::command]
pub fn expand_slash_command(template: String, arguments: String) -> Result<String, String> {
    Ok(expand_command_template(&template, &arguments))
}

#[tauri::command]
pub fn create_slash_command(
    space_path: String,
    command_name: String,
    description: String,
    template: String,
) -> Result<SlashCommand, String> {
    let commands_dir = get_commands_directory(&space_path);
    create_command(&commands_dir, &command_name, &description, &template)
}

#[tauri::command]
pub fn delete_slash_command(space_path: String, command_name: String) -> Result<(), String> {
    let commands_dir = get_commands_directory(&space_path);
    delete_command(&commands_dir, &command_name)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use tempfile::TempDir;

    #[test]
    fn test_load_commands_creates_directory() {
        let temp_dir = TempDir::new().unwrap();
        let dir_path = temp_dir.path().join("commands");

        let commands = load_commands_from_directory(dir_path.to_str().unwrap()).unwrap();

        // Should create directory and 4 sample files (explain, summarize, brainstorm, example)
        assert!(dir_path.exists());
        assert_eq!(commands.len(), 4);

        let command_names: Vec<&str> = commands.iter().map(|c| c.name.as_str()).collect();
        assert!(command_names.contains(&"brainstorm"));
        assert!(command_names.contains(&"example"));
        assert!(command_names.contains(&"explain"));
        assert!(command_names.contains(&"summarize"));
    }

    #[test]
    fn test_load_command() {
        let temp_dir = TempDir::new().unwrap();
        let dir_path = temp_dir.path();

        // Create a test command
        let content = "# Test Command\n\nThis is a test command with $ARGUMENTS";
        fs::write(dir_path.join("test.md"), content).unwrap();

        let command = load_command(dir_path.to_str().unwrap(), "test").unwrap();

        assert_eq!(command.name, "test");
        assert_eq!(
            command.description,
            "This is a test command with $ARGUMENTS"
        );
        assert!(command.accepts_arguments);
    }

    #[test]
    fn test_expand_command_template() {
        let template = "Write a summary of $ARGUMENTS in 3 sentences.";
        let expanded = expand_command_template(template, "quantum computing");

        assert_eq!(
            expanded,
            "Write a summary of quantum computing in 3 sentences."
        );
    }

    #[test]
    fn test_create_command() {
        let temp_dir = TempDir::new().unwrap();
        let dir_path = temp_dir.path().to_str().unwrap();

        let command = create_command(
            dir_path,
            "review",
            "Review code changes",
            "Please review the following code:\n\n$ARGUMENTS",
        )
        .unwrap();

        assert_eq!(command.name, "review");
        assert!(command.accepts_arguments);

        // Verify file was created
        let file_path = PathBuf::from(dir_path).join("review.md");
        assert!(file_path.exists());
    }

    #[test]
    fn test_delete_command() {
        let temp_dir = TempDir::new().unwrap();
        let dir_path = temp_dir.path();

        // Create a command
        let file_path = dir_path.join("test.md");
        fs::write(&file_path, "# Test").unwrap();

        // Delete it
        delete_command(dir_path.to_str().unwrap(), "test").unwrap();

        assert!(!file_path.exists());
    }

    #[test]
    fn test_delete_nonexistent_command() {
        let temp_dir = TempDir::new().unwrap();
        let result = delete_command(temp_dir.path().to_str().unwrap(), "nonexistent");

        assert!(result.is_err());
    }

    #[test]
    fn test_load_multiple_commands() {
        let temp_dir = TempDir::new().unwrap();
        let dir_path = temp_dir.path();

        // Create multiple commands
        fs::write(dir_path.join("cmd1.md"), "# Cmd1\n\nFirst command").unwrap();
        fs::write(dir_path.join("cmd2.md"), "# Cmd2\n\nSecond command").unwrap();
        fs::write(dir_path.join("cmd3.md"), "# Cmd3\n\nThird command").unwrap();

        let commands = load_commands_from_directory(dir_path.to_str().unwrap()).unwrap();

        assert_eq!(commands.len(), 3);
        // Should be sorted alphabetically
        assert_eq!(commands[0].name, "cmd1");
        assert_eq!(commands[1].name, "cmd2");
        assert_eq!(commands[2].name, "cmd3");
    }
}
