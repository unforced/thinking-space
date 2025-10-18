import { useState, useEffect } from "react";
import { agentService } from "../services/agentService";

export function TokenUsageDisplay() {
  const [usage, setUsage] = useState({
    inputChars: 0,
    outputChars: 0,
    estimatedInputTokens: 0,
    estimatedOutputTokens: 0,
  });
  const [isExpanded, setIsExpanded] = useState(false);

  useEffect(() => {
    // Update usage every 2 seconds
    const interval = setInterval(() => {
      const currentUsage = agentService.getTokenUsage();
      setUsage(currentUsage);
    }, 2000);

    return () => clearInterval(interval);
  }, []);

  const totalEstimatedTokens = usage.estimatedInputTokens + usage.estimatedOutputTokens;

  // Don't show if no usage yet
  if (totalEstimatedTokens === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-10">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center gap-2 px-3 py-2 bg-gray-100 dark:bg-gray-800
                 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg shadow-lg
                 border border-gray-300 dark:border-gray-600 transition-colors"
        title="Token usage (approximate)"
      >
        <svg
          className="w-4 h-4 text-gray-600 dark:text-gray-400"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
          />
        </svg>
        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
          ~{totalEstimatedTokens.toLocaleString()} tokens
        </span>
        <svg
          className={`w-3 h-3 text-gray-500 transition-transform ${
            isExpanded ? "rotate-180" : ""
          }`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </button>

      {isExpanded && (
        <div className="mt-2 p-3 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-300 dark:border-gray-600">
          <h4 className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2">
            Session Usage (Estimated)
          </h4>
          <div className="space-y-1 text-xs text-gray-600 dark:text-gray-400">
            <div className="flex justify-between gap-4">
              <span>Input:</span>
              <span className="font-mono">
                ~{usage.estimatedInputTokens.toLocaleString()} tokens
              </span>
            </div>
            <div className="flex justify-between gap-4">
              <span>Output:</span>
              <span className="font-mono">
                ~{usage.estimatedOutputTokens.toLocaleString()} tokens
              </span>
            </div>
            <div className="pt-1 mt-1 border-t border-gray-200 dark:border-gray-700 flex justify-between gap-4 font-semibold">
              <span>Total:</span>
              <span className="font-mono">
                ~{totalEstimatedTokens.toLocaleString()} tokens
              </span>
            </div>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-500 mt-2 pt-2 border-t border-gray-200 dark:border-gray-700">
            ℹ️ Rough estimate: 1 token ≈ 4 characters
          </p>
        </div>
      )}
    </div>
  );
}
