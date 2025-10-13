import { useState, useEffect } from "react";
import { useSettingsStore } from "../stores/settingsStore";
import { authService } from "../services/authService";
import type { AuthCredentials } from "../services/authService";

interface SettingsPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SettingsPanel({ isOpen, onClose }: SettingsPanelProps) {
  const { apiKey, theme, setApiKey, setTheme, dataLocation } =
    useSettingsStore();
  const [localApiKey, setLocalApiKey] = useState(apiKey);
  const [showKey, setShowKey] = useState(false);
  const [saving, setSaving] = useState(false);
  const [authStatus, setAuthStatus] = useState<AuthCredentials | null>(null);
  const [loadingAuth, setLoadingAuth] = useState(true);

  // Load authentication status
  useEffect(() => {
    if (isOpen) {
      loadAuthStatus();
    }
  }, [isOpen]);

  useEffect(() => {
    setLocalApiKey(apiKey);
  }, [apiKey]);

  const loadAuthStatus = async () => {
    setLoadingAuth(true);
    try {
      const creds = await authService.getCredentials();
      setAuthStatus(creds);
    } catch (error) {
      console.error("Failed to load auth status:", error);
      setAuthStatus(null);
    } finally {
      setLoadingAuth(false);
    }
  };

  if (!isOpen) return null;

  const handleSave = async () => {
    setSaving(true);
    try {
      await setApiKey(localApiKey);
      await loadAuthStatus(); // Refresh auth status
      onClose();
    } catch (error) {
      console.error("Failed to save settings:", error);
    } finally {
      setSaving(false);
    }
  };

  const handleOpenClaudeCodeDocs = async () => {
    await authService.openClaudeCodeLoginInstructions();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-white">
              Settings
            </h2>
            <button
              onClick={onClose}
              className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            >
              <svg
                className="w-6 h-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>

          {/* Content */}
          <div className="space-y-6">
            {/* Authentication Status */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Authentication Status
              </label>
              {loadingAuth ? (
                <div className="px-4 py-3 bg-gray-50 dark:bg-gray-900 rounded-lg">
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Checking authentication...
                  </p>
                </div>
              ) : authStatus ? (
                <div
                  className={`px-4 py-3 rounded-lg ${
                    authStatus.type === "oauth"
                      ? "bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800"
                      : "bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 mt-0.5">
                      {authStatus.type === "oauth" ? (
                        <svg
                          className="w-5 h-5 text-green-600 dark:text-green-400"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                          />
                        </svg>
                      ) : (
                        <svg
                          className="w-5 h-5 text-blue-600 dark:text-blue-400"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z"
                          />
                        </svg>
                      )}
                    </div>
                    <div className="flex-1">
                      <p
                        className={`text-sm font-medium ${
                          authStatus.type === "oauth"
                            ? "text-green-800 dark:text-green-200"
                            : "text-blue-800 dark:text-blue-200"
                        }`}
                      >
                        {authStatus.type === "oauth"
                          ? "✓ Using Claude Subscription (Recommended)"
                          : "✓ Using API Key"}
                      </p>
                      <p
                        className={`text-xs mt-1 ${
                          authStatus.type === "oauth"
                            ? "text-green-700 dark:text-green-300"
                            : "text-blue-700 dark:text-blue-300"
                        }`}
                      >
                        {authStatus.type === "oauth"
                          ? "Authenticated via Claude Code - usage counts against your Claude Pro/Max subscription"
                          : "Using API key - usage billed separately via Anthropic API"}
                      </p>
                      {authStatus.type === "oauth" && authStatus.expiresAt && (
                        <p className="text-xs mt-1 text-green-600 dark:text-green-400">
                          Token expires:{" "}
                          {new Date(authStatus.expiresAt).toLocaleString()}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="px-4 py-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                  <div className="flex items-start gap-3">
                    <svg
                      className="w-5 h-5 text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                      />
                    </svg>
                    <div>
                      <p className="text-sm font-medium text-yellow-800 dark:text-yellow-200">
                        No authentication configured
                      </p>
                      <p className="text-xs mt-1 text-yellow-700 dark:text-yellow-300">
                        Please authenticate to use Thinking Space
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Claude Code Authentication (Recommended) */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Option 1: Claude Subscription (Recommended)
              </label>
              <div className="px-4 py-3 bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg">
                <p className="text-sm text-gray-700 dark:text-gray-300 mb-3">
                  If you have <strong>Claude Pro</strong> or{" "}
                  <strong>Claude Max</strong>, use your subscription instead of
                  paying for API credits.
                </p>
                <div className="text-xs text-gray-600 dark:text-gray-400 mb-3 space-y-1">
                  <p>
                    <strong>Steps:</strong>
                  </p>
                  <ol className="list-decimal list-inside space-y-1 ml-2">
                    <li>
                      Install Claude Code CLI:{" "}
                      <code className="bg-gray-200 dark:bg-gray-700 px-1 py-0.5 rounded">
                        npm install -g @anthropic-ai/claude-code
                      </code>
                    </li>
                    <li>
                      Run:{" "}
                      <code className="bg-gray-200 dark:bg-gray-700 px-1 py-0.5 rounded">
                        claude login
                      </code>
                    </li>
                    <li>Follow the browser authentication flow</li>
                    <li>
                      Restart Thinking Space - it will automatically detect your
                      credentials
                    </li>
                  </ol>
                </div>
                <button
                  onClick={handleOpenClaudeCodeDocs}
                  className="w-full px-3 py-2 bg-purple-600 hover:bg-purple-700 text-white text-sm rounded-lg transition-colors"
                >
                  View Setup Instructions
                </button>
              </div>
            </div>

            {/* API Key (Fallback) */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Option 2: API Key (Alternative)
              </label>
              <div className="relative">
                <input
                  type={showKey ? "text" : "password"}
                  value={localApiKey}
                  onChange={(e) => setLocalApiKey(e.target.value)}
                  placeholder="sk-ant-..."
                  className="w-full px-3 py-2 pr-24 border border-gray-300 dark:border-gray-600 rounded-lg
                           bg-white dark:bg-gray-700 text-gray-900 dark:text-white
                           focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm"
                />
                <button
                  type="button"
                  onClick={() => setShowKey(!showKey)}
                  className="absolute right-2 top-2 px-3 py-1 text-xs text-gray-600 dark:text-gray-400
                           hover:text-gray-800 dark:hover:text-gray-200"
                >
                  {showKey ? "Hide" : "Show"}
                </button>
              </div>
              <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                Get your API key from{" "}
                <a
                  href="https://console.anthropic.com/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 dark:text-blue-400 hover:underline"
                >
                  console.anthropic.com
                </a>{" "}
                (pay-per-use pricing)
              </p>
            </div>

            {/* Theme */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Theme
              </label>
              <select
                value={theme}
                onChange={(e) =>
                  setTheme(e.target.value as "light" | "dark" | "system")
                }
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg
                         bg-white dark:bg-gray-700 text-gray-900 dark:text-white
                         focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="system">System</option>
                <option value="light">Light</option>
                <option value="dark">Dark</option>
              </select>
            </div>

            {/* Data Location */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Data Location
              </label>
              <div
                className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg
                           bg-gray-50 dark:bg-gray-900 text-gray-700 dark:text-gray-300 font-mono text-sm"
              >
                {dataLocation}
              </div>
              <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                All your Spaces are stored here
              </p>
            </div>
          </div>

          {/* Footer */}
          <div className="flex gap-3 mt-8 pt-6 border-t border-gray-200 dark:border-gray-700">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2 text-gray-700 dark:text-gray-300
                       hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              disabled={saving}
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg
                       transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
