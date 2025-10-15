import { useState, useEffect } from "react";
import { authService } from "../services/authService";
import type { AuthCredentials } from "../services/authService";
import { useSettingsStore } from "../stores/settingsStore";

interface WelcomeScreenProps {
  isOpen: boolean;
  onComplete: () => void;
}

type WelcomeStep = "welcome" | "auth" | "first-space" | "ready";

export function WelcomeScreen({ isOpen, onComplete }: WelcomeScreenProps) {
  const [step, setStep] = useState<WelcomeStep>("welcome");
  const [authStatus, setAuthStatus] = useState<AuthCredentials | null>(null);
  const [checkingAuth, setCheckingAuth] = useState(false);
  const [apiKey, setApiKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [saving, setSaving] = useState(false);
  const { setApiKey: saveApiKey } = useSettingsStore();

  useEffect(() => {
    if (isOpen && step === "auth") {
      checkAuth();
    }
  }, [isOpen, step]);

  const checkAuth = async () => {
    setCheckingAuth(true);
    try {
      const creds = await authService.getCredentials();
      setAuthStatus(creds);
    } catch (error) {
      console.error("Failed to check auth:", error);
      setAuthStatus(null);
    } finally {
      setCheckingAuth(false);
    }
  };

  const handleSaveApiKey = async () => {
    if (!apiKey.trim()) return;

    setSaving(true);
    try {
      await saveApiKey(apiKey);
      await checkAuth(); // Refresh auth status
      setStep("first-space");
    } catch (error) {
      console.error("Failed to save API key:", error);
      alert("Failed to save API key. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleOpenClaudeCodeDocs = async () => {
    await authService.openClaudeCodeLoginInstructions();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-gradient-to-br from-blue-50 to-purple-50 dark:from-gray-900 dark:to-gray-800 z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-2xl w-full overflow-hidden">
        {/* Welcome Step */}
        {step === "welcome" && (
          <div className="p-12 text-center">
            <div className="mb-8">
              <div className="inline-flex items-center justify-center w-24 h-24 bg-gradient-to-br from-blue-500 to-purple-600 rounded-3xl mb-6">
                <svg
                  className="w-12 h-12 text-white"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
                  />
                </svg>
              </div>
              <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">
                Welcome to Thinking Space
              </h1>
              <p className="text-lg text-gray-600 dark:text-gray-300 max-w-md mx-auto">
                Your intelligent workspace for focused conversations with
                Claude. Organize your work into dedicated Spaces, each with its
                own context and history.
              </p>
            </div>

            <div className="space-y-4 mb-8 text-left max-w-md mx-auto">
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 w-6 h-6 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center text-blue-600 dark:text-blue-400 text-sm font-semibold">
                  1
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900 dark:text-white">
                    Organize by Project
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Create separate Spaces for each project or topic
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 w-6 h-6 bg-purple-100 dark:bg-purple-900/30 rounded-full flex items-center justify-center text-purple-600 dark:text-purple-400 text-sm font-semibold">
                  2
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900 dark:text-white">
                    Persistent Context
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Each Space has its own CLAUDE.md for shared context
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 w-6 h-6 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center text-green-600 dark:text-green-400 text-sm font-semibold">
                  3
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900 dark:text-white">
                    Full History
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Conversations are saved and ready when you return
                  </p>
                </div>
              </div>
            </div>

            <button
              onClick={() => setStep("auth")}
              className="px-8 py-3 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white rounded-lg font-semibold text-lg transition-all transform hover:scale-105 shadow-lg"
            >
              Get Started →
            </button>
          </div>
        )}

        {/* Authentication Step */}
        {step === "auth" && (
          <div className="p-10">
            <div className="mb-8">
              <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
                Set Up Authentication
              </h2>
              <p className="text-gray-600 dark:text-gray-400">
                Choose how you'd like to authenticate with Claude
              </p>
            </div>

            {/* Auth Status Check */}
            {checkingAuth ? (
              <div className="py-8 text-center">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                <p className="mt-4 text-gray-600 dark:text-gray-400">
                  Checking authentication...
                </p>
              </div>
            ) : authStatus ? (
              <div
                className={`p-6 rounded-xl mb-6 ${
                  authStatus.type === "oauth"
                    ? "bg-green-50 dark:bg-green-900/20 border-2 border-green-200 dark:border-green-800"
                    : "bg-blue-50 dark:bg-blue-900/20 border-2 border-blue-200 dark:border-blue-800"
                }`}
              >
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0">
                    <svg
                      className={`w-8 h-8 ${
                        authStatus.type === "oauth"
                          ? "text-green-600 dark:text-green-400"
                          : "text-blue-600 dark:text-blue-400"
                      }`}
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
                  </div>
                  <div className="flex-1">
                    <h3
                      className={`text-lg font-semibold mb-1 ${
                        authStatus.type === "oauth"
                          ? "text-green-900 dark:text-green-100"
                          : "text-blue-900 dark:text-blue-100"
                      }`}
                    >
                      {authStatus.type === "oauth"
                        ? "✓ Claude Subscription Connected"
                        : "✓ API Key Configured"}
                    </h3>
                    <p
                      className={`text-sm ${
                        authStatus.type === "oauth"
                          ? "text-green-700 dark:text-green-300"
                          : "text-blue-700 dark:text-blue-300"
                      }`}
                    >
                      {authStatus.type === "oauth"
                        ? "You're using your Claude Pro/Max subscription"
                        : "You're using an API key"}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setStep("first-space")}
                  className="w-full mt-6 px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white rounded-lg font-semibold transition-all"
                >
                  Continue →
                </button>
              </div>
            ) : (
              <div className="space-y-6">
                {/* Option 1: Claude Subscription */}
                <div className="border-2 border-purple-200 dark:border-purple-800 rounded-xl p-6 bg-purple-50/50 dark:bg-purple-900/10">
                  <div className="flex items-start gap-3 mb-4">
                    <div className="flex-shrink-0">
                      <div className="w-10 h-10 bg-purple-600 rounded-lg flex items-center justify-center">
                        <svg
                          className="w-6 h-6 text-white"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z"
                          />
                        </svg>
                      </div>
                    </div>
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">
                        Option 1: Claude Subscription
                        <span className="ml-2 px-2 py-0.5 text-xs bg-purple-600 text-white rounded-full">
                          Recommended
                        </span>
                      </h3>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        Use your Claude Pro or Claude Max subscription
                      </p>
                    </div>
                  </div>

                  <div className="bg-white dark:bg-gray-800 rounded-lg p-4 mb-4 text-sm text-gray-700 dark:text-gray-300 space-y-2">
                    <p className="font-medium">Quick Setup:</p>
                    <ol className="list-decimal list-inside space-y-1.5 ml-2">
                      <li>
                        Install Claude Code:{" "}
                        <code className="bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded text-xs">
                          npm install -g @anthropic-ai/claude-code
                        </code>
                      </li>
                      <li>
                        Run:{" "}
                        <code className="bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded text-xs">
                          claude login
                        </code>
                      </li>
                      <li>Complete browser authentication</li>
                      <li>
                        Click "Check Again" below or restart Thinking Space
                      </li>
                    </ol>
                  </div>

                  <div className="flex gap-3">
                    <button
                      onClick={checkAuth}
                      className="flex-1 px-4 py-2 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 text-purple-600 dark:text-purple-400 border-2 border-purple-600 dark:border-purple-400 rounded-lg font-medium transition-colors"
                    >
                      Check Again
                    </button>
                    <button
                      onClick={handleOpenClaudeCodeDocs}
                      className="flex-1 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-medium transition-colors"
                    >
                      View Setup Instructions
                    </button>
                  </div>
                </div>

                {/* Option 2: API Key */}
                <div className="border-2 border-gray-200 dark:border-gray-700 rounded-xl p-6">
                  <div className="flex items-start gap-3 mb-4">
                    <div className="flex-shrink-0">
                      <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center">
                        <svg
                          className="w-6 h-6 text-white"
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
                      </div>
                    </div>
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">
                        Option 2: API Key
                      </h3>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        Use a pay-as-you-go API key from Anthropic
                      </p>
                    </div>
                  </div>

                  <div className="relative mb-4">
                    <input
                      type={showKey ? "text" : "password"}
                      value={apiKey}
                      onChange={(e) => setApiKey(e.target.value)}
                      placeholder="sk-ant-..."
                      className="w-full px-4 py-3 pr-20 border-2 border-gray-300 dark:border-gray-600 rounded-lg
                               bg-white dark:bg-gray-700 text-gray-900 dark:text-white
                               focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm"
                    />
                    <button
                      type="button"
                      onClick={() => setShowKey(!showKey)}
                      className="absolute right-3 top-3 px-3 py-1 text-xs text-gray-600 dark:text-gray-400
                               hover:text-gray-800 dark:hover:text-gray-200"
                    >
                      {showKey ? "Hide" : "Show"}
                    </button>
                  </div>

                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
                    Get your API key from{" "}
                    <a
                      href="https://console.anthropic.com/"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 dark:text-blue-400 hover:underline"
                    >
                      console.anthropic.com
                    </a>
                  </p>

                  <button
                    onClick={handleSaveApiKey}
                    disabled={!apiKey.trim() || saving}
                    className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium
                             transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {saving ? "Saving..." : "Save API Key & Continue"}
                  </button>
                </div>
              </div>
            )}

            <div className="mt-6 text-center">
              <button
                onClick={() => setStep("welcome")}
                className="text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200"
              >
                ← Back
              </button>
            </div>
          </div>
        )}

        {/* First Space Step */}
        {step === "first-space" && (
          <div className="p-10 text-center">
            <div className="mb-8">
              <div className="inline-flex items-center justify-center w-20 h-20 bg-blue-100 dark:bg-blue-900/30 rounded-2xl mb-6">
                <svg
                  className="w-10 h-10 text-blue-600 dark:text-blue-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
                  />
                </svg>
              </div>
              <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
                Create Your First Space
              </h2>
              <p className="text-gray-600 dark:text-gray-400 max-w-md mx-auto">
                Spaces help you organize conversations by project or topic. You
                can create as many as you need!
              </p>
            </div>

            <div className="bg-gray-50 dark:bg-gray-900 rounded-xl p-6 mb-8 max-w-md mx-auto">
              <h3 className="font-semibold text-gray-900 dark:text-white mb-3">
                What's in a Space?
              </h3>
              <ul className="text-left space-y-2 text-sm text-gray-600 dark:text-gray-400">
                <li className="flex items-center gap-2">
                  <svg
                    className="w-5 h-5 text-green-600 dark:text-green-400 flex-shrink-0"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                  <span>Dedicated conversation history</span>
                </li>
                <li className="flex items-center gap-2">
                  <svg
                    className="w-5 h-5 text-green-600 dark:text-green-400 flex-shrink-0"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                  <span>CLAUDE.md file for persistent context</span>
                </li>
                <li className="flex items-center gap-2">
                  <svg
                    className="w-5 h-5 text-green-600 dark:text-green-400 flex-shrink-0"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                  <span>Separate file storage area</span>
                </li>
              </ul>
            </div>

            <button
              onClick={() => setStep("ready")}
              className="px-8 py-3 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white rounded-lg font-semibold text-lg transition-all transform hover:scale-105 shadow-lg"
            >
              Create First Space →
            </button>

            <div className="mt-6">
              <button
                onClick={() => setStep("auth")}
                className="text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200"
              >
                ← Back
              </button>
            </div>
          </div>
        )}

        {/* Ready Step */}
        {step === "ready" && (
          <div className="p-10 text-center">
            <div className="mb-8">
              <div className="inline-flex items-center justify-center w-20 h-20 bg-green-100 dark:bg-green-900/30 rounded-2xl mb-6">
                <svg
                  className="w-10 h-10 text-green-600 dark:text-green-400"
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
              </div>
              <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
                You're All Set!
              </h2>
              <p className="text-gray-600 dark:text-gray-400 max-w-md mx-auto">
                Thinking Space is ready to use. Start a conversation with Claude
                in your new Space.
              </p>
            </div>

            <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-6 mb-8 max-w-md mx-auto">
              <h3 className="font-semibold text-gray-900 dark:text-white mb-3">
                Quick Tips:
              </h3>
              <ul className="text-left space-y-2 text-sm text-gray-600 dark:text-gray-400">
                <li>• Click "+ New Space" to create more Spaces</li>
                <li>
                  • Edit CLAUDE.md to add context that persists across
                  conversations
                </li>
                <li>• Attach files by dragging them into the chat</li>
                <li>
                  • Access settings anytime by clicking the ⚙️ button in the
                  sidebar
                </li>
              </ul>
            </div>

            <button
              onClick={onComplete}
              className="px-8 py-3 bg-gradient-to-r from-green-600 to-blue-600 hover:from-green-700 hover:to-blue-700 text-white rounded-lg font-semibold text-lg transition-all transform hover:scale-105 shadow-lg"
            >
              Start Using Thinking Space
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
