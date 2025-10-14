import { useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";

export interface AttachedFile {
  name: string;
  path: string;
  size: number;
}

interface FileAttachmentProps {
  files: AttachedFile[];
  onFilesAdded: (files: AttachedFile[]) => void;
  onFileRemoved: (index: number) => void;
  disabled?: boolean;
}

export function FileAttachment({
  files,
  onFilesAdded,
  onFileRemoved,
  disabled = false,
}: FileAttachmentProps) {
  const [isDragging, setIsDragging] = useState(false);

  const handleFileSelect = async () => {
    if (disabled) return;

    try {
      // Use Tauri's file dialog to get proper file paths
      const selected = await open({
        multiple: true,
        title: "Select files to attach",
      });

      if (!selected) return;

      // Handle both single file (string) and multiple files (string[])
      const paths = Array.isArray(selected) ? selected : [selected];

      const newFiles: AttachedFile[] = await Promise.all(
        paths.map(async (path) => {
          // Get file name from path
          const name = path.split("/").pop() || path.split("\\").pop() || path;

          // Get file size
          let size = 0;
          try {
            const metadata = await fetch(`asset://localhost/${path}`).then(
              (r) => r.blob(),
            );
            size = metadata.size;
          } catch (error) {
            console.warn(`Could not get size for ${path}:`, error);
            size = 0;
          }

          return {
            name,
            path,
            size,
          };
        }),
      );

      onFilesAdded(newFiles);
    } catch (error) {
      console.error("Failed to select files:", error);
    }
  };

  const handleClick = () => {
    if (!disabled) {
      handleFileSelect();
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    if (!disabled) {
      setIsDragging(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    if (disabled) return;

    // In Tauri, drag and drop files should provide paths in the dataTransfer
    const items = e.dataTransfer.items;
    if (!items) return;

    const newFiles: AttachedFile[] = [];

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.kind === "file") {
        const file = item.getAsFile();
        if (file) {
          // Try to get the path from the file object
          // In Tauri, this might be available via webkitRelativePath or a custom property
          const path = (file as any).path || file.name;

          newFiles.push({
            name: file.name,
            path: path,
            size: file.size,
          });
        }
      }
    }

    if (newFiles.length > 0) {
      onFilesAdded(newFiles);
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="space-y-2">
      {/* Attach Button & Drop Zone */}
      <div
        className={`
          border-2 border-dashed rounded-lg p-3 transition-colors cursor-pointer
          ${
            isDragging
              ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20"
              : "border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500"
          }
          ${disabled ? "opacity-50 cursor-not-allowed" : ""}
        `}
        onClick={handleClick}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
          <span>📎</span>
          <span>
            {isDragging
              ? "Drop files here..."
              : "Click to attach files or drag & drop"}
          </span>
        </div>
      </div>

      {/* Attached Files List */}
      {files.length > 0 && (
        <div className="space-y-1">
          {files.map((file, index) => (
            <div
              key={index}
              className="flex items-center justify-between gap-2 px-3 py-2 bg-gray-100 dark:bg-gray-800 rounded-lg text-sm"
            >
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <span className="text-gray-600 dark:text-gray-400">📄</span>
                <span className="truncate text-gray-900 dark:text-white font-medium">
                  {file.name}
                </span>
                <span className="text-xs text-gray-500 dark:text-gray-400 flex-shrink-0">
                  {formatFileSize(file.size)}
                </span>
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onFileRemoved(index);
                }}
                disabled={disabled}
                className="flex-shrink-0 text-gray-400 hover:text-red-600 dark:hover:text-red-400 transition-colors disabled:opacity-50"
                title="Remove file"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}

      {/* File count summary */}
      {files.length > 0 && (
        <div className="text-xs text-gray-500 dark:text-gray-400">
          {files.length} file{files.length !== 1 ? "s" : ""} attached
        </div>
      )}
    </div>
  );
}
