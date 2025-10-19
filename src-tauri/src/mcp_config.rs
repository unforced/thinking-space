// MCP Server Configuration
// Simple file-based configuration for MCP servers

use agent_client_protocol_schema::{EnvVariable, McpServer};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::{Path, PathBuf};

/// Configuration file format for MCP servers
/// Stored as .mcp.json in the Space directory
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct McpConfig {
    pub mcp_servers: HashMap<String, McpServerConfig>,
}

/// Individual MCP server configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct McpServerConfig {
    pub command: String,
    #[serde(default)]
    pub args: Vec<String>,
    #[serde(default)]
    pub env: HashMap<String, String>,
}

impl McpConfig {
    /// Load MCP configuration from a .mcp.json file
    pub fn load_from_file(path: &Path) -> Result<Self, String> {
        let contents = std::fs::read_to_string(path)
            .map_err(|e| format!("Failed to read MCP config: {}", e))?;

        serde_json::from_str(&contents).map_err(|e| format!("Failed to parse MCP config: {}", e))
    }

    /// Load MCP configuration from a Space directory
    /// Looks for .mcp.json in the space path
    pub fn load_from_space(space_path: &Path) -> Result<Self, String> {
        let config_path = space_path.join(".mcp.json");

        if !config_path.exists() {
            // No config file = no MCP servers (this is fine)
            return Ok(McpConfig {
                mcp_servers: HashMap::new(),
            });
        }

        Self::load_from_file(&config_path)
    }

    /// Convert to ACP library's McpServer format
    pub fn to_acp_servers(&self) -> Vec<McpServer> {
        self.mcp_servers
            .iter()
            .map(|(name, config)| McpServer::Stdio {
                name: name.clone(),
                command: PathBuf::from(&config.command),
                args: config.args.clone(),
                env: config
                    .env
                    .iter()
                    .map(|(k, v)| EnvVariable {
                        name: k.clone(),
                        value: v.clone(),
                        meta: None,
                    })
                    .collect(),
            })
            .collect()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_mcp_config() {
        let json = r#"
        {
            "mcpServers": {
                "filesystem": {
                    "command": "npx",
                    "args": ["-y", "@modelcontextprotocol/server-filesystem", "/tmp"],
                    "env": {}
                },
                "github": {
                    "command": "npx",
                    "args": ["-y", "@modelcontextprotocol/server-github"],
                    "env": {
                        "GITHUB_TOKEN": "test-token"
                    }
                }
            }
        }
        "#;

        let config: McpConfig = serde_json::from_str(json).unwrap();
        assert_eq!(config.mcp_servers.len(), 2);

        let filesystem = config.mcp_servers.get("filesystem").unwrap();
        assert_eq!(filesystem.command, "npx");
        assert_eq!(filesystem.args.len(), 3);

        let github = config.mcp_servers.get("github").unwrap();
        assert_eq!(github.env.get("GITHUB_TOKEN").unwrap(), "test-token");
    }

    #[test]
    fn test_to_acp_servers() {
        let config = McpConfig {
            mcp_servers: [(
                "test".to_string(),
                McpServerConfig {
                    command: "echo".to_string(),
                    args: vec!["hello".to_string()],
                    env: [("KEY".to_string(), "value".to_string())]
                        .into_iter()
                        .collect(),
                },
            )]
            .into_iter()
            .collect(),
        };

        let acp_servers = config.to_acp_servers();
        assert_eq!(acp_servers.len(), 1);

        if let McpServer::Stdio {
            name,
            command,
            args,
            env,
        } = &acp_servers[0]
        {
            assert_eq!(name, "test");
            assert_eq!(command, &PathBuf::from("echo"));
            assert_eq!(args, &vec!["hello"]);
            assert_eq!(env.len(), 1);
            assert_eq!(env[0].name, "KEY");
            assert_eq!(env[0].value, "value");
        } else {
            panic!("Expected Stdio variant");
        }
    }

    #[test]
    fn test_load_missing_config() {
        // Loading from a non-existent directory should return empty config
        let config = McpConfig::load_from_space(Path::new("/nonexistent/path")).unwrap();
        assert_eq!(config.mcp_servers.len(), 0);
    }
}
