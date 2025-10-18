import { invoke } from "@tauri-apps/api/core";
import type { PermissionRequest } from "../services/agentService";

interface PermissionDialogProps {
  request: PermissionRequest | null;
  onApprove: (optionId: string) => void;
  onDeny: () => void;
  onAlwaysAllow?: () => void;
}

/**
 * Inline Permission Request Component (Zed-style)
 * Displays permission requests inline with the conversation flow
 * rather than as a modal overlay
 */
export function PermissionDialog({
  request,
  onApprove,
  onDeny,
  onAlwaysAllow,
}: PermissionDialogProps) {
  if (!request) return null;

  const handleAlwaysAllow = async () => {
    // Load current settings
    const settings = await invoke<any>("load_settings");

    // Update to always allow tool actions
    settings.always_allow_tool_actions = true;

    // Save settings
    await invoke("save_settings", { settings });

    // Approve this request
    const allowOption = request.options.find(
      (opt) => opt.option_id === "allow" || opt.option_id === "allow_once",
    );
    if (allowOption) {
      onApprove(allowOption.option_id);
    }

    // Notify parent if callback provided
    if (onAlwaysAllow) {
      onAlwaysAllow();
    }
  };

  // Helper to format input values safely
  const formatInputValue = (input: any): string => {
    if (!input || typeof input !== "object") return "";

    const entries = Object.entries(input);
    if (entries.length === 0) return "";

    // Extract the most relevant info
    const mainEntry = entries[0];
    const [, value] = mainEntry;

    if (typeof value === "string") {
      return value.length > 100 ? value.slice(0, 100) + "..." : value;
    }
    if (typeof value === "object" && value !== null && "content" in value) {
      const content = String(value.content);
      return content.length > 100 ? content.slice(0, 100) + "..." : content;
    }

    return JSON.stringify(value).slice(0, 100);
  };

  const inputPreview = formatInputValue(request.raw_input);

  return (
    <div className="my-3 border-2 border-amber-400 dark:border-amber-600 rounded-lg bg-amber-50 dark:bg-amber-900/20 overflow-hidden">
      {/* Header with icon */}
      <div className="flex items-start space-x-3 p-4 pb-3">
        <div className="flex-shrink-0 w-6 h-6 bg-amber-500 rounded-full flex items-center justify-center">
          <svg
            className="w-4 h-4 text-white"
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
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="text-sm font-semibold text-gray-900 dark:text-white">
            Permission Required
          </h4>
          <p className="text-sm text-gray-700 dark:text-gray-300 mt-0.5">
            {request.title || "Claude needs approval to continue"}
          </p>
          {inputPreview && (
            <p className="text-xs text-gray-600 dark:text-gray-400 mt-1 font-mono">
              {inputPreview}
            </p>
          )}
        </div>
      </div>

      {/* Action buttons - inline, compact style */}
      <div className="px-4 pb-4">
        <div className="flex flex-wrap gap-2">
          {/* Always Allow - Global setting that persists */}
          <button
            onClick={handleAlwaysAllow}
            className="inline-flex items-center px-3 py-1.5 text-sm font-medium rounded-md
                     bg-green-600 hover:bg-green-700 text-white
                     transition-colors duration-150 ease-in-out
                     focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2"
            title="Always allow all tool operations (can be changed in Settings) • Press A"
          >
            <svg
              className="w-4 h-4 mr-1.5"
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
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12l2 2 4-4"
              />
            </svg>
            Always Allow
            <kbd className="ml-2 px-1.5 py-0.5 text-xs bg-green-700 rounded">
              A
            </kbd>
          </button>

          {/* Permission-specific options */}
          {request.options.map((option, idx) => (
            <button
              key={option.option_id}
              onClick={() => onApprove(option.option_id)}
              className="inline-flex items-center px-3 py-1.5 text-sm font-medium rounded-md
                       bg-blue-600 hover:bg-blue-700 text-white
                       transition-colors duration-150 ease-in-out
                       focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
              title={idx === 0 ? "Press Y or Enter" : undefined}
            >
              {option.name}
              {idx === 0 && (
                <kbd className="ml-2 px-1.5 py-0.5 text-xs bg-blue-700 rounded">
                  Y
                </kbd>
              )}
            </button>
          ))}

          {/* Deny */}
          <button
            onClick={onDeny}
            className="inline-flex items-center px-3 py-1.5 text-sm font-medium rounded-md
                     bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600
                     text-gray-900 dark:text-gray-100
                     transition-colors duration-150 ease-in-out
                     focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-offset-2"
            title="Press N or Escape"
          >
            Deny
            <kbd className="ml-2 px-1.5 py-0.5 text-xs bg-gray-300 dark:bg-gray-600 rounded">
              N
            </kbd>
          </button>
        </div>

        {/* Keyboard shortcuts hint */}
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
          💡 Keyboard shortcuts:{" "}
          <kbd className="px-1 py-0.5 bg-gray-200 dark:bg-gray-700 rounded text-gray-700 dark:text-gray-300">
            Y
          </kbd>{" "}
          or{" "}
          <kbd className="px-1 py-0.5 bg-gray-200 dark:bg-gray-700 rounded text-gray-700 dark:text-gray-300">
            Enter
          </kbd>{" "}
          to approve,{" "}
          <kbd className="px-1 py-0.5 bg-gray-200 dark:bg-gray-700 rounded text-gray-700 dark:text-gray-300">
            N
          </kbd>{" "}
          or{" "}
          <kbd className="px-1 py-0.5 bg-gray-200 dark:bg-gray-700 rounded text-gray-700 dark:text-gray-300">
            Esc
          </kbd>{" "}
          to deny,{" "}
          <kbd className="px-1 py-0.5 bg-gray-200 dark:bg-gray-700 rounded text-gray-700 dark:text-gray-300">
            A
          </kbd>{" "}
          to always allow
        </p>
      </div>

      {/* Optional: Show additional details in expandable section */}
      {request.raw_input && Object.keys(request.raw_input).length > 0 && (
        <details className="border-t border-amber-300 dark:border-amber-700">
          <summary className="px-4 py-2 text-xs text-gray-600 dark:text-gray-400 cursor-pointer hover:bg-amber-100 dark:hover:bg-amber-900/30">
            Show details
          </summary>
          <div className="px-4 pb-3">
            <pre className="text-xs bg-white dark:bg-gray-900 rounded p-2 overflow-x-auto">
              <code className="text-gray-800 dark:text-gray-200">
                {JSON.stringify(request.raw_input, null, 2)}
              </code>
            </pre>
          </div>
        </details>
      )}
    </div>
  );
}
