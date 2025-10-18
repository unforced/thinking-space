import { render, RenderOptions } from '@testing-library/react'
import { ReactElement } from 'react'

// Re-export everything from React Testing Library
export * from '@testing-library/react'
export { default as userEvent } from '@testing-library/user-event'

// Custom render function that can be extended with providers
export function renderWithProviders(
  ui: ReactElement,
  options?: Omit<RenderOptions, 'wrapper'>
) {
  return render(ui, { ...options })
}

// Helper to create mock Tauri invoke responses
export function mockTauriInvoke(responses: Record<string, any>) {
  const { invoke } = require('@tauri-apps/api/core')
  invoke.mockImplementation((cmd: string, args?: any) => {
    if (responses[cmd]) {
      return Promise.resolve(responses[cmd])
    }
    return Promise.reject(new Error(`No mock response for command: ${cmd}`))
  })
}

// Helper to create mock Tauri event listeners
export function mockTauriListen(events: Record<string, any[]>) {
  const { listen } = require('@tauri-apps/api/event')
  listen.mockImplementation((event: string, handler: Function) => {
    const eventData = events[event]
    if (eventData) {
      eventData.forEach(data => handler({ payload: data }))
    }
    return Promise.resolve(() => {}) // Return unlisten function
  })
}

// Helper to wait for async updates
export const waitFor = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

// Helper to create temporary test directory path
export function getTestTempDir(testName: string): string {
  return `/tmp/thinking-space-tests/${testName}-${Date.now()}`
}
