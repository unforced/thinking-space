import { useState } from "react";
import { agentService } from "../services/agentService";

/**
 * Test panel for debugging permission request flow
 * This component helps test the permission system without needing to trigger actual AI responses
 */
export function PermissionTestPanel() {
  const [visible, setVisible] = useState(false);

  const triggerTestPermission = () => {
    // Simulate a permission request
    const testRequest = {
      request_id: `test-${Date.now()}`,
      session_id: "test-session",
      tool_call_id: "test-tool-call",
      title: "Test Write Operation",
      kind: "Write",
      raw_input: {
        file_path: "/test/path/file.txt",
        content: "Test content",
      },
      options: [
        {
          option_id: "allow_once",
          name: "Allow Once",
          kind: "allow",
        },
        {
          option_id: "deny",
          name: "Deny",
          kind: "deny",
        },
      ],
    };

    console.log("[PermissionTestPanel] Triggering test permission:", testRequest);

    // Directly call the callback that would normally be triggered by the event
    if (agentService.onPermissionRequest) {
      agentService.onPermissionRequest(testRequest);
    } else {
      console.error("[PermissionTestPanel] onPermissionRequest callback not set!");
    }
  };

  if (!visible) {
    return (
      <button
        onClick={() => setVisible(true)}
        className="fixed bottom-4 right-4 bg-purple-600 hover:bg-purple-700 text-white px-3 py-2 rounded-lg text-sm shadow-lg z-50"
      >
        🧪 Debug
      </button>
    );
  }

  return (
    <div className="fixed bottom-4 right-4 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg shadow-xl p-4 z-50 w-80">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-gray-900 dark:text-white">
          Permission Test Panel
        </h3>
        <button
          onClick={() => setVisible(false)}
          className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
        >
          ✕
        </button>
      </div>

      <div className="space-y-2">
        <button
          onClick={triggerTestPermission}
          className="w-full bg-purple-600 hover:bg-purple-700 text-white px-3 py-2 rounded text-sm"
        >
          Trigger Test Permission
        </button>

        <div className="text-xs text-gray-600 dark:text-gray-400">
          <p>This will simulate a Write permission request without actually calling the AI.</p>
          <p className="mt-1">Check the console for detailed logs.</p>
        </div>

        <div className="pt-2 border-t border-gray-200 dark:border-gray-700">
          <p className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
            Service State:
          </p>
          <div className="text-xs text-gray-600 dark:text-gray-400 space-y-1">
            <p>
              Callback set:{" "}
              {agentService.onPermissionRequest ? "✅ Yes" : "❌ No"}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
