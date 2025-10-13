/**
 * Authentication Service
 *
 * Handles authentication with Claude via:
 * 1. Claude subscription OAuth (via existing Claude Code credentials)
 * 2. API key fallback
 *
 * Priority: Use subscription credentials if available, otherwise API key
 */

import { invoke } from '@tauri-apps/api/core'

export interface AuthCredentials {
  type: 'oauth' | 'api-key'
  token: string
  expiresAt?: number
  refreshToken?: string
}

export interface OAuthCredentials {
  accessToken: string
  refreshToken: string
  expiresAt: number
  scopes: string[]
}

export class AuthService {
  private credentials: AuthCredentials | null = null
  private credentialsLoadedAt: number = 0
  private readonly CACHE_DURATION_MS = 60000 // 1 minute cache

  /**
   * Get current authentication credentials
   * Tries in order:
   * 1. Cached credentials (if fresh)
   * 2. Claude Code OAuth credentials
   * 3. Stored API key
   */
  async getCredentials(): Promise<AuthCredentials | null> {
    // Return cached credentials if still fresh
    const now = Date.now()
    if (this.credentials && now - this.credentialsLoadedAt < this.CACHE_DURATION_MS) {
      // Check if OAuth token is still valid
      if (this.credentials.type === 'oauth' && this.credentials.expiresAt) {
        if (now < this.credentials.expiresAt) {
          return this.credentials
        }
        // Token expired, try to refresh
        const refreshed = await this.refreshOAuthToken(this.credentials.refreshToken!)
        if (refreshed) {
          return this.credentials
        }
      } else {
        return this.credentials
      }
    }

    // Try to load OAuth credentials from Claude Code
    const oauthCreds = await this.loadClaudeCodeCredentials()
    if (oauthCreds) {
      this.credentials = {
        type: 'oauth',
        token: oauthCreds.accessToken,
        expiresAt: oauthCreds.expiresAt,
        refreshToken: oauthCreds.refreshToken
      }
      this.credentialsLoadedAt = now
      return this.credentials
    }

    // Fall back to API key from settings
    const apiKey = await this.loadApiKey()
    if (apiKey) {
      this.credentials = {
        type: 'api-key',
        token: apiKey
      }
      this.credentialsLoadedAt = now
      return this.credentials
    }

    return null
  }

  /**
   * Load OAuth credentials from Claude Code
   * Checks:
   * 1. macOS Keychain (via Tauri command)
   * 2. ~/.claude/.credentials.json file
   */
  private async loadClaudeCodeCredentials(): Promise<OAuthCredentials | null> {
    try {
      // Try loading from system (Keychain on macOS, etc.)
      const keychainCreds = await invoke<OAuthCredentials | null>('load_claude_credentials')
      if (keychainCreds) {
        return keychainCreds
      }
    } catch (error) {
      console.log('Could not load credentials from keychain:', error)
    }

    try {
      // Try loading from credentials file
      const fileCreds = await invoke<OAuthCredentials | null>('load_claude_credentials_file')
      if (fileCreds) {
        return fileCreds
      }
    } catch (error) {
      console.log('Could not load credentials from file:', error)
    }

    return null
  }

  /**
   * Load API key from settings
   */
  private async loadApiKey(): Promise<string | null> {
    try {
      const apiKey = await invoke<string | null>('load_api_key')
      return apiKey
    } catch (error) {
      console.error('Failed to load API key:', error)
      return null
    }
  }

  /**
   * Refresh OAuth token if expired
   */
  private async refreshOAuthToken(refreshToken: string): Promise<boolean> {
    try {
      const newCreds = await invoke<OAuthCredentials>('refresh_oauth_token', { refreshToken })
      if (newCreds) {
        this.credentials = {
          type: 'oauth',
          token: newCreds.accessToken,
          expiresAt: newCreds.expiresAt,
          refreshToken: newCreds.refreshToken
        }
        this.credentialsLoadedAt = Date.now()
        return true
      }
    } catch (error) {
      console.error('Failed to refresh OAuth token:', error)
    }
    return false
  }

  /**
   * Save API key to settings
   */
  async saveApiKey(apiKey: string): Promise<void> {
    await invoke('save_api_key', { apiKey })

    // Update cached credentials
    this.credentials = {
      type: 'api-key',
      token: apiKey
    }
    this.credentialsLoadedAt = Date.now()
  }

  /**
   * Clear cached credentials (force reload)
   */
  clearCache(): void {
    this.credentials = null
    this.credentialsLoadedAt = 0
  }

  /**
   * Check if user has Claude Code authenticated
   */
  async hasClaudeCodeAuth(): Promise<boolean> {
    const creds = await this.loadClaudeCodeCredentials()
    return creds !== null
  }

  /**
   * Open Claude Code login instructions
   */
  async openClaudeCodeLoginInstructions(): Promise<void> {
    // Open external link or show instructions
    await invoke('open_external_url', {
      url: 'https://docs.claude.com/en/docs/claude-code/getting-started'
    })
  }
}

// Singleton instance
export const authService = new AuthService()
