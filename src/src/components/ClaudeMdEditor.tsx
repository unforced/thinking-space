import { useState, useEffect } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { useSpacesStore } from '../stores/spacesStore'

interface ClaudeMdEditorProps {
  isOpen: boolean
  onClose: () => void
}

export function ClaudeMdEditor({ isOpen, onClose }: ClaudeMdEditorProps) {
  const { currentSpace } = useSpacesStore()
  const [content, setContent] = useState('')
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (isOpen && currentSpace) {
      loadContent()
    }
  }, [isOpen, currentSpace])

  const loadContent = async () => {
    if (!currentSpace) return

    setLoading(true)
    setError(null)
    try {
      const md = await invoke<string>('read_claude_md', {
        spaceId: currentSpace.id
      })
      setContent(md)
    } catch (err) {
      console.error('Failed to load CLAUDE.md:', err)
      setError(String(err))
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    if (!currentSpace) return

    setSaving(true)
    setError(null)
    try {
      await invoke('write_claude_md', {
        spaceId: currentSpace.id,
        content
      })
      onClose()
    } catch (err) {
      console.error('Failed to save CLAUDE.md:', err)
      setError(String(err))
    } finally {
      setSaving(false)
    }
  }

  if (!isOpen || !currentSpace) return null

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-4xl w-full mx-4 h-[80vh] flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-semibold text-gray-900 dark:text-white">
                Edit CLAUDE.md
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                {currentSpace.name}
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Editor */}
        <div className="flex-1 p-6 overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-gray-500 dark:text-gray-400">Loading...</div>
            </div>
          ) : error ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-red-600 dark:text-red-400">{error}</div>
            </div>
          ) : (
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="w-full h-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg
                       bg-white dark:bg-gray-900 text-gray-900 dark:text-white
                       focus:ring-2 focus:ring-blue-500 focus:border-transparent
                       resize-none font-mono text-sm"
              placeholder="Write instructions for Claude..."
            />
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-200 dark:border-gray-700">
          <div className="flex gap-3 justify-end">
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-700 dark:text-gray-300
                       hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              disabled={saving}
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving || loading}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg
                       transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
