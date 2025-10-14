import { useState, useRef, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import { useChatStore } from "../stores/chatStore";
import { useSpacesStore } from "../stores/spacesStore";
import { FileAttachment } from "./FileAttachment";
import type { AttachedFile } from "./FileAttachment";
import "highlight.js/styles/github-dark.css";

export function ChatArea() {
  const [input, setInput] = useState("");
  const [attachedFiles, setAttachedFiles] = useState<AttachedFile[]>([]);
  const { messages, streaming, sendMessage, currentStreamingMessage, error } =
    useChatStore();
  const { currentSpace } = useSpacesStore();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, currentStreamingMessage]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || streaming || !currentSpace) return;

    // TODO: Pass attachedFiles to sendMessage when implementing file operations
    await sendMessage(input.trim());
    setInput("");
    setAttachedFiles([]); // Clear attachments after sending
  };

  const handleFilesAdded = (newFiles: AttachedFile[]) => {
    setAttachedFiles((prev) => [...prev, ...newFiles]);
  };

  const handleFileRemoved = (index: number) => {
    setAttachedFiles((prev) => prev.filter((_, i) => i !== index));
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
    <div className="flex-1 flex flex-col">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
          {currentSpace.name}
        </h2>
      </div>

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

            {/* Streaming message */}
            {streaming && currentStreamingMessage && (
              <div className="flex justify-start">
                <div className="bg-gray-100 dark:bg-gray-800 rounded-lg px-4 py-3 max-w-[80%]">
                  <div className="prose dark:prose-invert max-w-none prose-pre:bg-gray-900 prose-pre:text-gray-100 text-gray-900 dark:text-white">
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm]}
                      rehypePlugins={[rehypeHighlight]}
                    >
                      {currentStreamingMessage}
                    </ReactMarkdown>
                  </div>
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
          <div className="flex gap-2">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSubmit(e);
                }
              }}
              placeholder="Type a message... (Shift+Enter for new line)"
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
