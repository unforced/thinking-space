use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};
use std::path::PathBuf;

/// A single message in a conversation
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Message {
    pub id: String,
    pub role: String, // "user" or "assistant"
    pub content: String,
    pub timestamp: i64,
    #[serde(default)]
    pub metadata: serde_json::Value,
}

/// A complete conversation for a Space
#[derive(Debug, Serialize, Deserialize)]
struct Conversation {
    version: String,
    space_id: String,
    messages: Vec<Message>,
}

impl Conversation {
    const VERSION: &'static str = "0.1.0";

    fn new(space_id: String, messages: Vec<Message>) -> Self {
        Self {
            version: Self::VERSION.to_string(),
            space_id,
            messages,
        }
    }
}

/// Get the path to the conversations database
fn get_db_path() -> Result<PathBuf, String> {
    let home = dirs::home_dir().ok_or("Could not find home directory")?;
    let thinking_space_dir = home.join(".thinking-space");

    // Create directory if it doesn't exist
    std::fs::create_dir_all(&thinking_space_dir)
        .map_err(|e| format!("Failed to create .thinking-space directory: {}", e))?;

    Ok(thinking_space_dir.join("conversations.db"))
}

/// Initialize the database with the conversations table
fn init_database(conn: &Connection) -> Result<(), String> {
    conn.execute(
        "CREATE TABLE IF NOT EXISTS conversations (
            space_id TEXT PRIMARY KEY,
            space_name TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            message_count INTEGER NOT NULL DEFAULT 0,
            data BLOB NOT NULL
        ) STRICT",
        [],
    )
    .map_err(|e| format!("Failed to create conversations table: {}", e))?;

    Ok(())
}

/// Get a connection to the database
fn get_connection() -> Result<Connection, String> {
    let db_path = get_db_path()?;
    let conn = Connection::open(&db_path).map_err(|e| format!("Failed to open database: {}", e))?;

    init_database(&conn)?;

    Ok(conn)
}

/// Save a conversation to the database
#[tauri::command]
pub fn save_conversation(
    space_id: String,
    space_name: String,
    messages: Vec<Message>,
) -> Result<(), String> {
    let conn = get_connection()?;

    // Create conversation structure
    let conversation = Conversation::new(space_id.clone(), messages.clone());

    // Serialize to JSON
    let data = serde_json::to_vec(&conversation)
        .map_err(|e| format!("Failed to serialize conversation: {}", e))?;

    // Get current timestamp
    let now = chrono::Utc::now().to_rfc3339();

    // Upsert (insert or replace)
    conn.execute(
        "INSERT OR REPLACE INTO conversations (space_id, space_name, updated_at, message_count, data)
         VALUES (?1, ?2, ?3, ?4, ?5)",
        params![
            space_id,
            space_name,
            now,
            messages.len() as i64,
            data,
        ],
    )
    .map_err(|e| format!("Failed to save conversation: {}", e))?;

    Ok(())
}

/// Load a conversation from the database
#[tauri::command]
pub fn load_conversation(space_id: String) -> Result<Vec<Message>, String> {
    let conn = get_connection()?;

    // Query for the conversation
    let mut stmt = conn
        .prepare("SELECT data FROM conversations WHERE space_id = ?1")
        .map_err(|e| format!("Failed to prepare query: {}", e))?;

    let result = stmt.query_row(params![space_id], |row| {
        let data: Vec<u8> = row.get(0)?;
        Ok(data)
    });

    match result {
        Ok(data) => {
            // Deserialize the conversation
            let conversation: Conversation = serde_json::from_slice(&data)
                .map_err(|e| format!("Failed to deserialize conversation: {}", e))?;

            Ok(conversation.messages)
        }
        Err(rusqlite::Error::QueryReturnedNoRows) => {
            // No conversation yet, return empty
            Ok(Vec::new())
        }
        Err(e) => Err(format!("Failed to load conversation: {}", e)),
    }
}

/// Delete a conversation from the database
#[tauri::command]
pub fn delete_conversation(space_id: String) -> Result<(), String> {
    let conn = get_connection()?;

    conn.execute(
        "DELETE FROM conversations WHERE space_id = ?1",
        params![space_id],
    )
    .map_err(|e| format!("Failed to delete conversation: {}", e))?;

    Ok(())
}

/// Get metadata about all conversations (for future use)
#[tauri::command]
pub fn list_conversations() -> Result<Vec<ConversationMetadata>, String> {
    let conn = get_connection()?;

    let mut stmt = conn
        .prepare("SELECT space_id, space_name, updated_at, message_count FROM conversations ORDER BY updated_at DESC")
        .map_err(|e| format!("Failed to prepare query: {}", e))?;

    let rows = stmt
        .query_map([], |row| {
            Ok(ConversationMetadata {
                space_id: row.get(0)?,
                space_name: row.get(1)?,
                updated_at: row.get(2)?,
                message_count: row.get(3)?,
            })
        })
        .map_err(|e| format!("Failed to query conversations: {}", e))?;

    let mut conversations = Vec::new();
    for conversation in rows {
        conversations.push(conversation.map_err(|e| format!("Failed to read row: {}", e))?);
    }

    Ok(conversations)
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ConversationMetadata {
    pub space_id: String,
    pub space_name: String,
    pub updated_at: String,
    pub message_count: i64,
}
