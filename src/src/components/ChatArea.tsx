import { useState, useRef, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import { useChatStore } from "../stores/chatStore";
import { useSpacesStore } from "../stores/spacesStore";
import { FileAttachment } from "./FileAttachment";
import type { AttachedFile } from "./FileAttachment";
import { PermissionDialog } from "./PermissionDialog";
import { ToolCallDisplay } from "./ToolCallDisplay";
import { TokenUsageDisplay } from "./TokenUsageDisplay";
import { CommandPalette } from "./CommandPalette";
import { PermissionTestPanel } from "./PermissionTestPanel";
import { ContextWarning } from "./ContextWarning";
import {
  agentService,
  type PermissionRequest,
  type ToolCall,
} from "../services/agentService";
import "highlight.js/styles/github-dark.css";

export function ChatArea() {
  const [input, setInput] = useState("");
  const [attachedFiles, setAttachedFiles] = useState<AttachedFile[]>([]);
  const { messages, streaming, sendMessage, currentStreamingMessage, error } =
    useChatStore();
  const { currentSpace } = useSpacesStore();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Permission and tool call state
  const [permissionQueue, setPermissionQueue] = useState<PermissionRequest[]>(
    [],
  );
  const [toolCalls, setToolCalls] = useState<Map<string, ToolCall>>(new Map());

  // Slash command palette state
  const [showCommandPalette, setShowCommandPalette] = useState(false);
  const [cursorPosition, setCursorPosition] = useState(0);

  // Current permission is the first in queue
  const permissionRequest = permissionQueue[0] || null;

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, currentStreamingMessage]);

  // Set up agent service callbacks
  useEffect(() => {
    agentService.onPermissionRequest = (request) => {
      console.log("[ChatArea] Permission request received:", request);
      console.log(
        "[ChatArea] Current permission queue length:",
        permissionQueue.length,
      );
      console.log("[ChatArea] Streaming state:", streaming);
      console.log(
        "[ChatArea] Current streaming message:",
        currentStreamingMessage,
      );
      // Add to queue instead of replacing
      setPermissionQueue((prev) => {
        console.log(
          "[ChatArea] Adding to queue, new length will be:",
          prev.length + 1,
        );
        return [...prev, request];
      });
    };

    agentService.onToolCall = (toolCall) => {
      console.log("[ChatArea] Tool call:", toolCall.title);
      setToolCalls((prev) => new Map(prev).set(toolCall.toolCallId, toolCall));
    };

    agentService.onToolCallUpdate = (toolCall) => {
      console.log("[ChatArea] Tool call update:", toolCall.toolCallId);
      setToolCalls((prev) => new Map(prev).set(toolCall.toolCallId, toolCall));
    };

    // Cleanup
    return () => {
      agentService.onPermissionRequest = undefined;
      agentService.onToolCall = undefined;
      agentService.onToolCallUpdate = undefined;
    };
  }, []);

  // Keyboard shortcuts for permission requests
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Only handle keyboard shortcuts when there's a permission request
      if (!permissionRequest) return;

      // Don't trigger if user is typing in an input/textarea
      const target = e.target as HTMLElement;
      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable
      ) {
        return;
      }

      // 'y' or Enter - Approve (find first allow option)
      if (e.key === "y" || e.key === "Y" || e.key === "Enter") {
        e.preventDefault();
        const allowOption = permissionRequest.options.find(
          (opt) =>
            opt.option_id === "allow_once" ||
            opt.option_id === "allow" ||
            opt.option_id === "allow_always" ||
            opt.name.toLowerCase().includes("allow"),
        );
        if (allowOption) {
          handlePermissionApprove(allowOption.option_id);
        }
      }

      // 'n' or Escape - Deny
      if (e.key === "n" || e.key === "N" || e.key === "Escape") {
        e.preventDefault();
        handlePermissionDeny();
      }

      // 'a' - Always Allow (if implemented)
      if (e.key === "a" || e.key === "A") {
        e.preventDefault();
        // Trigger the "Always Allow" flow
        const allowOption = permissionRequest.options.find(
          (opt) => opt.option_id === "allow_once" || opt.option_id === "allow",
        );
        if (allowOption) {
          handlePermissionApprove(allowOption.option_id);
          handleAlwaysAllow();
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [permissionRequest]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log(
      "[ChatArea] handleSubmit called, streaming:",
      streaming,
      "input:",
      input.trim().substring(0, 50),
    );

    if (!input.trim() || streaming || !currentSpace) {
      console.log(
        "[ChatArea] Blocking submit - input empty:",
        !input.trim(),
        "streaming:",
        streaming,
        "no space:",
        !currentSpace,
      );
      return;
    }

    // Clear previous tool calls and permission requests for new message
    console.log("[ChatArea] Clearing previous tool calls and permissions");
    setToolCalls(new Map());
    setPermissionQueue([]);

    // Pass file paths to sendMessage
    const filePaths =
      attachedFiles.length > 0 ? attachedFiles.map((f) => f.path) : undefined;

    console.log("[ChatArea] Calling sendMessage");
    await sendMessage(input.trim(), filePaths);
    console.log("[ChatArea] sendMessage completed");
    setInput("");
    setAttachedFiles([]); // Clear attachments after sending
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value;
    const newCursorPos = e.target.selectionStart;

    setInput(newValue);
    setCursorPosition(newCursorPos);

    // Show command palette if "/" is typed at start or after space
    const beforeCursor = newValue.substring(0, newCursorPos);
    const lastSlashIndex = beforeCursor.lastIndexOf("/");

    // Show palette if there's a "/" and it's either at the start or after whitespace
    if (lastSlashIndex !== -1) {
      const charBeforeSlash =
        lastSlashIndex > 0 ? beforeCursor[lastSlashIndex - 1] : " ";
      const shouldShow =
        charBeforeSlash === " " ||
        charBeforeSlash === "\n" ||
        lastSlashIndex === 0;
      setShowCommandPalette(shouldShow);
    } else {
      setShowCommandPalette(false);
    }
  };

  const handleCommandSelect = (expandedText: string) => {
    // Find the "/" that triggered the palette
    const beforeCursor = input.substring(0, cursorPosition);
    const lastSlashIndex = beforeCursor.lastIndexOf("/");

    if (lastSlashIndex !== -1) {
      // Replace from "/" to cursor position with the expanded command
      const before = input.substring(0, lastSlashIndex);
      const after = input.substring(cursorPosition);
      const newInput = before + expandedText + after;

      setInput(newInput);
      setShowCommandPalette(false);

      // Focus back to textarea
      setTimeout(() => {
        textareaRef.current?.focus();
      }, 0);
    }
  };

  const handleFilesAdded = (newFiles: AttachedFile[]) => {
    setAttachedFiles((prev) => [...prev, ...newFiles]);
  };

  const handleFileRemoved = (index: number) => {
    setAttachedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handlePermissionApprove = async (optionId: string) => {
    if (permissionRequest) {
      await agentService.respondToPermission(
        permissionRequest.request_id,
        optionId,
        false,
      );
      // Remove the processed request from the queue
      setPermissionQueue((prev) => prev.slice(1));
    }
  };

  const handlePermissionDeny = async () => {
    if (permissionRequest) {
      await agentService.respondToPermission(
        permissionRequest.request_id,
        null,
        true,
      );
      // Remove the processed request from the queue
      setPermissionQueue((prev) => prev.slice(1));
    }
  };

  const handleAlwaysAllow = () => {
    // Reload settings in agentService so future requests use new setting
    agentService.loadSettings();
    console.log("[ChatArea] Always allow enabled, settings reloaded");
  };

  if (!currentSpace) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center max-w-md px-4">
          <div className="text-6xl mb-4">✨</div>
          <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-2">
            Welcome to Thinking Space
          </h2>
          <p className="text-gray-600 dark:text-gray-400">
            Select a Space from the sidebar or create a new one to start
            thinking with Claude.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col relative">
      {/* Permission Test Panel - for debugging (remove in production) */}
      <PermissionTestPanel />

      {/* Token Usage Display */}
      <TokenUsageDisplay />

      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
          {currentSpace.name}
        </h2>
      </div>

      {/* Context Warning */}
      <ContextWarning />

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-6">
        {messages.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center max-w-md">
              <div className="text-4xl mb-3">💭</div>
              <p className="text-gray-600 dark:text-gray-400">
                Start a conversation with Claude in this Space
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-6 max-w-3xl mx-auto">
            {/* Error message */}
            {error && (
              <div className="bg-red-100 dark:bg-red-900/30 border border-red-400 dark:border-red-700 rounded-lg px-4 py-3 text-red-800 dark:text-red-200">
                <strong>Error:</strong> {error}
              </div>
            )}

            {/* Message history */}
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[80%] rounded-lg px-4 py-3 ${
                    message.role === "user"
                      ? "bg-blue-600 text-white"
                      : "bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white"
                  }`}
                >
                  <div
                    className={`prose ${message.role === "user" ? "prose-invert" : "dark:prose-invert"} max-w-none prose-pre:bg-gray-900 prose-pre:text-gray-100`}
                  >
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm]}
                      rehypePlugins={[rehypeHighlight]}
                    >
                      {message.content}
                    </ReactMarkdown>
                  </div>
                  {message.metadata?.files && (
                    <div className="mt-2 text-xs opacity-75">
                      📎 {message.metadata.files.length} file(s) attached
                    </div>
                  )}
                </div>
              </div>
            ))}

            {/* Debug info (temporary - remove in production) */}
            {streaming && (
              <div className="bg-yellow-100 dark:bg-yellow-900/30 border border-yellow-400 rounded p-2 text-xs mb-4">
                <strong>Debug:</strong> streaming={String(streaming)} |
                hasMessage={String(!!currentStreamingMessage)} | toolCalls=
                {toolCalls.size} | permissionRequest=
                {permissionRequest ? "YES" : "NO"} | queueLength=
                {permissionQueue.length}
              </div>
            )}

            {/* Streaming message - show if we have content OR tool calls OR permission requests */}
            {streaming &&
              (currentStreamingMessage ||
                toolCalls.size > 0 ||
                permissionRequest) && (
                <div className="flex justify-start">
                  <div className="bg-gray-100 dark:bg-gray-800 rounded-lg px-4 py-3 max-w-[80%]">
                    {/* Tool calls */}
                    {toolCalls.size > 0 && (
                      <div className="mb-3">
                        {Array.from(toolCalls.values()).map((tc) => (
                          <ToolCallDisplay key={tc.toolCallId} toolCall={tc} />
                        ))}
                      </div>
                    )}

                    {/* Permission request - inline with message */}
                    {permissionRequest && (
                      <PermissionDialog
                        request={permissionRequest}
                        onApprove={handlePermissionApprove}
                        onDeny={handlePermissionDeny}
                        onAlwaysAllow={handleAlwaysAllow}
                        queueLength={permissionQueue.length}
                      />
                    )}

                    {/* Message content */}
                    {currentStreamingMessage && (
                      <div className="prose dark:prose-invert max-w-none prose-pre:bg-gray-900 prose-pre:text-gray-100 text-gray-900 dark:text-white">
                        <ReactMarkdown
                          remarkPlugins={[remarkGfm]}
                          rehypePlugins={[rehypeHighlight]}
                        >
                          {currentStreamingMessage}
                        </ReactMarkdown>
                      </div>
                    )}

                    {/* Streaming indicator */}
                    {streaming && (
                      <div className="flex items-center gap-1 mt-2">
                        <div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-pulse"></div>
                        <div
                          className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-pulse"
                          style={{ animationDelay: "75ms" }}
                        ></div>
                        <div
                          className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-pulse"
                          style={{ animationDelay: "150ms" }}
                        ></div>
                      </div>
                    )}
                  </div>
                </div>
              )}

            {/* Loading indicator */}
            {streaming && !currentStreamingMessage && (
              <div className="flex justify-start">
                <div className="bg-gray-100 dark:bg-gray-800 rounded-lg px-4 py-3">
                  <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-pulse"></div>
                    <div
                      className="w-2 h-2 bg-gray-400 rounded-full animate-pulse"
                      style={{ animationDelay: "75ms" }}
                    ></div>
                    <div
                      className="w-2 h-2 bg-gray-400 rounded-full animate-pulse"
                      style={{ animationDelay: "150ms" }}
                    ></div>
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Input */}
      <div className="p-6 border-t border-gray-200 dark:border-gray-700">
        <form onSubmit={handleSubmit} className="max-w-3xl mx-auto space-y-3">
          {/* File Attachment Area */}
          <FileAttachment
            files={attachedFiles}
            onFilesAdded={handleFilesAdded}
            onFileRemoved={handleFileRemoved}
            disabled={streaming}
          />

          {/* Message Input */}
          <div className="flex gap-2 relative">
            {/* Command Palette */}
            {currentSpace && (
              <CommandPalette
                spacePath={currentSpace.path}
                visible={showCommandPalette}
                inputValue={input}
                onCommandSelect={handleCommandSelect}
                onClose={() => setShowCommandPalette(false)}
                cursorPosition={cursorPosition}
              />
            )}

            <textarea
              ref={textareaRef}
              value={input}
              onChange={handleInputChange}
              onKeyDown={(e) => {
                // Don't submit if command palette is open
                if (e.key === "Enter" && !e.shiftKey && !showCommandPalette) {
                  e.preventDefault();
                  handleSubmit(e);
                }
              }}
              onSelect={(e) => {
                // Track cursor position for command palette
                const target = e.target as HTMLTextAreaElement;
                setCursorPosition(target.selectionStart);
              }}
              placeholder="Type a message... (Shift+Enter for new line, / for commands)"
              className="flex-1 px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg
                       bg-white dark:bg-gray-800 text-gray-900 dark:text-white
                       focus:ring-2 focus:ring-blue-500 focus:border-transparent
                       resize-none"
              rows={3}
              disabled={streaming}
            />
            <button
              type="submit"
              disabled={!input.trim() || streaming}
              className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg
                       transition-colors disabled:opacity-50 disabled:cursor-not-allowed
                       self-end"
            >
              {streaming ? "Sending..." : "Send"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
