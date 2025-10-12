import { create } from 'zustand'

interface SettingsState {
  apiKey: string
  theme: 'light' | 'dark' | 'system'
  dataLocation: string

  // Actions
  setApiKey: (key: string) => Promise<void>
  setTheme: (theme: 'light' | 'dark' | 'system') => void
  loadSettings: () => Promise<void>
}

export const useSettingsStore = create<SettingsState>((set) => ({
  apiKey: '',
  theme: 'system',
  dataLocation: '~/.thinking-space',

  setApiKey: async (key: string) => {
    try {
      // TODO: Call Tauri command to store securely
      set({ apiKey: key })
    } catch (error) {
      console.error('Failed to save API key:', error)
    }
  },

  setTheme: (theme: 'light' | 'dark' | 'system') => {
    set({ theme })
    // Apply theme
    if (theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
  },

  loadSettings: async () => {
    try {
      // TODO: Call Tauri command to load settings
      // For now, just detect system theme
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
      if (prefersDark) {
        document.documentElement.classList.add('dark')
      }
    } catch (error) {
      console.error('Failed to load settings:', error)
    }
  }
}))
