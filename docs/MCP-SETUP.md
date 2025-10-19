# MCP Server Configuration

Model Context Protocol (MCP) servers provide additional tools and capabilities to Claude.

## Quick Start

1. **Create `.mcp.json` in your Space directory**

```json
{
  "mcpServers": {
    "filesystem": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem", "/path/to/allowed"],
      "env": {}
    }
  }
}
```

2. **Start a conversation in that Space**

That's it! Claude will automatically connect to the MCP servers when creating a session.

## Configuration Format

Each MCP server is configured with:
- `command`: Path to executable (can be `npx`, `node`, or a full path)
- `args`: Command-line arguments
- `env`: Environment variables (API keys, tokens, etc.)

## Example Configurations

### Filesystem Access

Allow Claude to read/write files in a specific directory:

```json
{
  "mcpServers": {
    "filesystem": {
      "command": "npx",
      "args": [
        "-y",
        "@modelcontextprotocol/server-filesystem",
        "/Users/yourusername/projects"
      ],
      "env": {}
    }
  }
}
```

### GitHub Integration

Connect to GitHub (requires personal access token):

```json
{
  "mcpServers": {
    "github": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-github"],
      "env": {
        "GITHUB_TOKEN": "ghp_your_token_here"
      }
    }
  }
}
```

### Web Search

Use Brave Search API:

```json
{
  "mcpServers": {
    "brave-search": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-brave-search"],
      "env": {
        "BRAVE_API_KEY": "your-api-key"
      }
    }
  }
}
```

### Database Access

Connect to PostgreSQL:

```json
{
  "mcpServers": {
    "postgres": {
      "command": "npx",
      "args": [
        "-y",
        "@modelcontextprotocol/server-postgres",
        "postgresql://user:password@localhost/dbname"
      ],
      "env": {}
    }
  }
}
```

### Multiple Servers

You can configure multiple MCP servers in one Space:

```json
{
  "mcpServers": {
    "filesystem": { ... },
    "github": { ... },
    "postgres": { ... }
  }
}
```

## Per-Space Configuration

- Each Space can have its own `.mcp.json` file
- Configuration is loaded when creating a new session
- No configuration = no MCP servers (works fine!)

## Available MCP Servers

Official Anthropic servers:
- `@modelcontextprotocol/server-filesystem` - File operations
- `@modelcontextprotocol/server-github` - GitHub API
- `@modelcontextprotocol/server-postgres` - PostgreSQL database
- `@modelcontextprotocol/server-brave-search` - Web search
- `@modelcontextprotocol/server-google-maps` - Google Maps
- `@modelcontextprotocol/server-slack` - Slack integration

Find more at: https://github.com/modelcontextprotocol/servers

## Security Notes

⚠️ **Important:**
- MCP servers run with full access to the tools they provide
- Only use trusted MCP servers
- Be careful with filesystem paths and database credentials
- API keys in `.mcp.json` are stored in plain text - don't commit them to git!

## Troubleshooting

**MCP servers not loading?**
- Check the logs for "[ACP V2] Loaded X MCP server(s)"
- Verify your `.mcp.json` syntax is valid JSON
- Make sure `npx` is available in your PATH
- Check that environment variables are set correctly

**Connection errors?**
- Verify API keys and tokens are valid
- Check network connectivity for remote services
- Look for error messages in the console

## Example: Setting Up GitHub MCP

1. **Get a GitHub Personal Access Token:**
   - Go to https://github.com/settings/tokens
   - Generate new token (classic)
   - Select scopes: `repo`, `read:user`

2. **Create `.mcp.json` in your Space:**
   ```json
   {
     "mcpServers": {
       "github": {
         "command": "npx",
         "args": ["-y", "@modelcontextprotocol/server-github"],
         "env": {
           "GITHUB_TOKEN": "ghp_your_token_here"
         }
       }
     }
   }
   ```

3. **Start a conversation and ask:**
   > "Can you show me my recent GitHub repositories?"

Claude will use the GitHub MCP server to fetch the information!

## Next Steps

- See `.mcp.json.example` in the project root for more examples
- Explore available MCP servers: https://github.com/modelcontextprotocol/servers
- Build your own MCP server: https://modelcontextprotocol.io/docs
