import { useChatStore } from "../stores/chatStore";

/**
 * Shows a warning when the conversation is approaching the context window limit
 */
export function ContextWarning() {
  const { getContextInfo, clearMessages } = useChatStore();
  const contextInfo = getContextInfo();

  // Don't show if we're under the warning threshold
  if (!contextInfo.approachingLimit) {
    return null;
  }

  const handleStartFresh = () => {
    if (confirm("Start a fresh conversation? Previous messages will be saved but won't be included in context.")) {
      clearMessages();
    }
  };

  return (
    <div className={`px-6 py-3 border-b ${
      contextInfo.atLimit
        ? 'bg-red-50 dark:bg-red-900/20 border-red-300 dark:border-red-700'
        : 'bg-amber-50 dark:bg-amber-900/20 border-amber-300 dark:border-amber-700'
    }`}>
      <div className="max-w-3xl mx-auto flex items-start gap-3">
        <div className="flex-shrink-0 mt-0.5">
          {contextInfo.atLimit ? (
            <svg className="w-5 h-5 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          ) : (
            <svg className="w-5 h-5 text-amber-600 dark:text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          )}
        </div>

        <div className="flex-1 min-w-0">
          <p className={`text-sm font-medium ${
            contextInfo.atLimit
              ? 'text-red-800 dark:text-red-200'
              : 'text-amber-800 dark:text-amber-200'
          }`}>
            {contextInfo.atLimit ? 'Context Limit Reached' : 'Approaching Context Limit'}
          </p>
          <p className={`text-xs mt-1 ${
            contextInfo.atLimit
              ? 'text-red-700 dark:text-red-300'
              : 'text-amber-700 dark:text-amber-300'
          }`}>
            {contextInfo.atLimit ? (
              <>This conversation has reached the maximum context window (~{contextInfo.tokens.toLocaleString()} tokens).
              Starting fresh is recommended.</>
            ) : (
              <>This conversation is using {contextInfo.percentUsed}% of the context window
              (~{contextInfo.tokens.toLocaleString()} / 200K tokens).
              Consider starting a fresh conversation soon.</>
            )}
          </p>

          {/* Progress bar */}
          <div className="mt-2 w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5">
            <div
              className={`h-1.5 rounded-full transition-all ${
                contextInfo.atLimit
                  ? 'bg-red-600 dark:bg-red-500'
                  : 'bg-amber-500 dark:bg-amber-400'
              }`}
              style={{ width: `${Math.min(contextInfo.percentUsed, 100)}%` }}
            />
          </div>
        </div>

        <button
          onClick={handleStartFresh}
          className={`flex-shrink-0 px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
            contextInfo.atLimit
              ? 'bg-red-600 hover:bg-red-700 text-white'
              : 'bg-amber-600 hover:bg-amber-700 text-white'
          }`}
        >
          Start Fresh
        </button>
      </div>
    </div>
  );
}
