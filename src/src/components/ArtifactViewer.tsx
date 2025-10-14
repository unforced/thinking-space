import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";

interface SpaceFile {
  name: string;
  path: string;
  size: number;
  modified: number;
  isDirectory: boolean;
}

interface ArtifactViewerProps {
  isOpen: boolean;
  onClose: () => void;
  spaceId: string;
  spacePath: string;
}

export function ArtifactViewer({
  isOpen,
  onClose,
  spaceId,
  spacePath,
}: ArtifactViewerProps) {
  const [files, setFiles] = useState<SpaceFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && spaceId) {
      loadFiles();
    }
  }, [isOpen, spaceId]);

  const loadFiles = async () => {
    setLoading(true);
    setError(null);
    try {
      const spaceFiles = await invoke<SpaceFile[]>("list_space_files", {
        spaceId,
      });
      setFiles(spaceFiles);
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const formatDate = (timestamp: number): string => {
    return new Date(timestamp).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const openFile = async (filePath: string) => {
    try {
      await invoke("open_file", { path: filePath });
    } catch (err) {
      console.error("Failed to open file:", err);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-3xl max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
              Space Files
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              {spacePath}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 text-2xl"
          >
            ×
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading && (
            <div className="text-center py-8 text-gray-500 dark:text-gray-400">
              Loading files...
            </div>
          )}

          {error && (
            <div className="bg-red-100 dark:bg-red-900/30 border border-red-400 dark:border-red-700 rounded-lg px-4 py-3 text-red-800 dark:text-red-200">
              <strong>Error:</strong> {error}
            </div>
          )}

          {!loading && !error && files.length === 0 && (
            <div className="text-center py-12">
              <div className="text-6xl mb-4">📁</div>
              <p className="text-gray-600 dark:text-gray-400">
                No files in this Space yet
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-500 mt-2">
                Files created by Claude or attached to messages will appear here
              </p>
            </div>
          )}

          {!loading && !error && files.length > 0 && (
            <div className="space-y-1">
              {files.map((file, index) => (
                <button
                  key={index}
                  onClick={() => !file.isDirectory && openFile(file.path)}
                  className={`
                    w-full flex items-center justify-between gap-4 px-4 py-3 rounded-lg
                    transition-colors text-left
                    ${
                      file.isDirectory
                        ? "bg-blue-50 dark:bg-blue-900/20 cursor-default"
                        : "hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer"
                    }
                  `}
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <span className="text-2xl flex-shrink-0">
                      {file.isDirectory ? "📁" : getFileIcon(file.name)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-gray-900 dark:text-white truncate">
                        {file.name}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {!file.isDirectory && formatFileSize(file.size)} •{" "}
                        {formatDate(file.modified)}
                      </p>
                    </div>
                  </div>
                  {!file.isDirectory && (
                    <div className="flex-shrink-0 text-blue-600 dark:text-blue-400">
                      →
                    </div>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex justify-between items-center">
          <div className="text-sm text-gray-500 dark:text-gray-400">
            {files.length} {files.length === 1 ? "item" : "items"}
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

function getFileIcon(filename: string): string {
  const ext = filename.split(".").pop()?.toLowerCase();

  switch (ext) {
    case "md":
    case "txt":
      return "📝";
    case "js":
    case "ts":
    case "jsx":
    case "tsx":
      return "⚡";
    case "py":
      return "🐍";
    case "json":
      return "📋";
    case "html":
    case "css":
      return "🎨";
    case "png":
    case "jpg":
    case "jpeg":
    case "gif":
    case "svg":
      return "🖼️";
    case "pdf":
      return "📄";
    default:
      return "📄";
  }
}
