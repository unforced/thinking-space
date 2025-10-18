import { useState, useEffect } from "react";
import type { ToolCall } from "../services/agentService";

interface ToolCallDisplayProps {
  toolCall: ToolCall;
}

export function ToolCallDisplay({ toolCall }: ToolCallDisplayProps) {
  // Auto-expand running tool calls, collapse completed ones
  const [isExpanded, setIsExpanded] = useState(toolCall.status === "Running");

  // Auto-expand when status changes to Running
  useEffect(() => {
    if (toolCall.status === "Running") {
      setIsExpanded(true);
    }
  }, [toolCall.status]);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "Running":
        return (
          <div className="animate-spin rounded-full h-4 w-4 border-2 border-blue-500 border-t-transparent"></div>
        );
      case "Success":
        return <span className="text-green-500">✓</span>;
      case "Failed":
        return <span className="text-red-500">✗</span>;
      default:
        return <span className="text-gray-400">○</span>;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "Running":
        return "bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800";
      case "Success":
        return "bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800";
      case "Failed":
        return "bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800";
      default:
        return "bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700";
    }
  };

  const formatToolInput = (input: any) => {
    if (!input || typeof input !== "object") return null;

    // Show key details in a friendly way
    const entries = Object.entries(input);
    if (entries.length === 0) return null;

    const formatValue = (value: any): string => {
      if (value === null || value === undefined) {
        return String(value);
      }
      if (typeof value === "string") {
        return value.length > 50 ? value.slice(0, 50) + "..." : value;
      }
      if (typeof value === "object") {
        // Handle objects with content/type structure (common in tool inputs)
        if ("content" in value && typeof value.content === "string") {
          return value.content.length > 50
            ? value.content.slice(0, 50) + "..."
            : value.content;
        }
        // Fallback to JSON stringify
        const json = JSON.stringify(value);
        return json.length > 50 ? json.slice(0, 50) + "..." : json;
      }
      return String(value);
    };

    return (
      <div className="space-y-1">
        {entries.slice(0, 3).map(([key, value]) => (
          <div key={key} className="text-xs">
            <span className="text-gray-500 dark:text-gray-400">{key}:</span>{" "}
            <span className="text-gray-700 dark:text-gray-300 font-mono">
              {formatValue(value)}
            </span>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div
      className={`rounded-lg border mb-2 ${getStatusColor(toolCall.status)}`}
    >
      {/* Header - Clickable */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-start justify-between p-3 text-left hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
      >
        <div className="flex items-center space-x-2 flex-1">
          <div className="flex-shrink-0">{getStatusIcon(toolCall.status)}</div>
          <div className="flex-1 min-w-0">
            <h4 className="text-sm font-medium text-gray-900 dark:text-white truncate">
              {toolCall.title}
            </h4>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {toolCall.kind}
            </p>
          </div>
        </div>
        {/* Expand/Collapse Indicator */}
        <div className="flex-shrink-0 ml-2">
          <svg
            className={`w-4 h-4 text-gray-500 dark:text-gray-400 transition-transform ${
              isExpanded ? "transform rotate-180" : ""
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
        </div>
      </button>

      {/* Collapsible Content */}
      {isExpanded && (
        <div className="px-3 pb-3">
          {/* Tool Input */}
          {toolCall.rawInput && (
            <div className="mb-2">{formatToolInput(toolCall.rawInput)}</div>
          )}

          {/* Locations */}
          {toolCall.locations && toolCall.locations.length > 0 && (
            <div className="space-y-1 mb-2">
              {toolCall.locations.map((loc, idx) => (
                <div
                  key={idx}
                  className="flex items-center space-x-1 text-xs text-gray-600 dark:text-gray-400"
                >
                  <span>📄</span>
                  <span className="font-mono truncate">
                    {loc.path}
                    {loc.line && `:${loc.line}`}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Tool Output/Content */}
          {toolCall.content && (
            <div className="mt-2 pt-2 border-t border-gray-200 dark:border-gray-700">
              <details className="text-xs">
                <summary className="cursor-pointer text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200">
                  Show output
                </summary>
                <pre className="mt-2 p-2 bg-white dark:bg-gray-900 rounded text-gray-800 dark:text-gray-200 overflow-x-auto">
                  {typeof toolCall.content === "string"
                    ? toolCall.content
                    : JSON.stringify(toolCall.content, null, 2)}
                </pre>
              </details>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
