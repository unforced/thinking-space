import { useState, useEffect, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";

export interface SlashCommand {
  name: string;
  path: string;
  description: string;
  template: string;
  accepts_arguments: boolean;
}

interface CommandPaletteProps {
  spacePath: string;
  visible: boolean;
  inputValue: string;
  onCommandSelect: (expandedText: string) => void;
  onClose: () => void;
  cursorPosition: number;
}

/**
 * Command Palette - Shows available slash commands when user types "/"
 */
export function CommandPalette({
  spacePath,
  visible,
  inputValue,
  onCommandSelect,
  onClose,
  cursorPosition,
}: CommandPaletteProps) {
  const [commands, setCommands] = useState<SlashCommand[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const paletteRef = useRef<HTMLDivElement>(null);

  // Extract the command being typed (text after "/" until space or end)
  const getCommandQuery = (): { command: string; args: string } => {
    const beforeCursor = inputValue.substring(0, cursorPosition);
    const slashIndex = beforeCursor.lastIndexOf("/");

    if (slashIndex === -1) {
      return { command: "", args: "" };
    }

    const afterSlash = beforeCursor.substring(slashIndex + 1);
    const spaceIndex = afterSlash.indexOf(" ");

    if (spaceIndex === -1) {
      // Still typing command name
      return { command: afterSlash, args: "" };
    } else {
      // Typing arguments
      const commandName = afterSlash.substring(0, spaceIndex);
      const args = afterSlash.substring(spaceIndex + 1);
      return { command: commandName, args };
    }
  };

  const { command: query, args } = getCommandQuery();

  // Load commands from backend
  useEffect(() => {
    if (!visible || !spacePath) return;

    setLoading(true);
    invoke<SlashCommand[]>("list_slash_commands", { spacePath })
      .then((cmds) => {
        setCommands(cmds);
        setSelectedIndex(0);
      })
      .catch((error) => {
        console.error("[CommandPalette] Failed to load commands:", error);
        setCommands([]);
      })
      .finally(() => setLoading(false));
  }, [visible, spacePath]);

  // Filter commands based on query
  const filteredCommands = commands.filter((cmd) =>
    cmd.name.toLowerCase().includes(query.toLowerCase())
  );

  // Handle keyboard navigation
  useEffect(() => {
    if (!visible) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((prev) =>
          prev < filteredCommands.length - 1 ? prev + 1 : prev
        );
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((prev) => (prev > 0 ? prev - 1 : 0));
      } else if (e.key === "Enter" && filteredCommands.length > 0) {
        e.preventDefault();
        handleCommandSelect(filteredCommands[selectedIndex]);
      } else if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [visible, filteredCommands, selectedIndex]);

  // Reset selected index when filtered commands change
  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  const handleCommandSelect = async (command: SlashCommand) => {
    try {
      // If command accepts arguments and we have args, expand the template
      let expandedText = command.template;

      if (command.accepts_arguments && args) {
        expandedText = await invoke<string>("expand_slash_command", {
          template: command.template,
          arguments: args,
        });
      }

      // Remove markdown heading from the template (first line if it starts with #)
      const lines = expandedText.split("\n");
      if (lines[0].trim().startsWith("#")) {
        lines.shift(); // Remove heading
      }

      // Remove empty leading lines and trim
      const cleanedText = lines
        .filter((line, idx) => idx > 0 || line.trim() !== "")
        .join("\n")
        .trim();

      onCommandSelect(cleanedText);
    } catch (error) {
      console.error("[CommandPalette] Failed to expand command:", error);
    }
  };

  if (!visible || filteredCommands.length === 0) {
    return null;
  }

  return (
    <div
      ref={paletteRef}
      className="absolute bottom-full left-0 mb-2 w-96 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg shadow-lg overflow-hidden z-50"
    >
      {/* Header */}
      <div className="px-3 py-2 bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-gray-600 dark:text-gray-400">
            SLASH COMMANDS
          </span>
          <span className="text-xs text-gray-500 dark:text-gray-500">
            {filteredCommands.length} command
            {filteredCommands.length !== 1 ? "s" : ""}
          </span>
        </div>
        {query && (
          <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            Searching for: <span className="font-mono">/{query}</span>
          </div>
        )}
      </div>

      {/* Command List */}
      <div className="max-h-64 overflow-y-auto">
        {loading ? (
          <div className="px-3 py-4 text-center text-sm text-gray-500 dark:text-gray-400">
            Loading commands...
          </div>
        ) : (
          filteredCommands.map((command, index) => (
            <button
              key={command.name}
              onClick={() => handleCommandSelect(command)}
              className={`w-full px-3 py-2 text-left transition-colors ${
                index === selectedIndex
                  ? "bg-blue-50 dark:bg-blue-900/30 border-l-2 border-blue-500"
                  : "hover:bg-gray-50 dark:hover:bg-gray-700"
              }`}
            >
              <div className="flex items-start gap-2">
                <span className="text-blue-600 dark:text-blue-400 font-mono text-sm mt-0.5">
                  /
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-gray-900 dark:text-white">
                      {command.name}
                    </span>
                    {command.accepts_arguments && (
                      <span className="text-xs px-1.5 py-0.5 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 rounded">
                        args
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-600 dark:text-gray-400 mt-0.5 line-clamp-2">
                    {command.description}
                  </p>
                </div>
              </div>
            </button>
          ))
        )}
      </div>

      {/* Footer with keyboard hints */}
      <div className="px-3 py-2 bg-gray-50 dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400">
          <span>
            <kbd className="px-1.5 py-0.5 bg-gray-200 dark:bg-gray-700 rounded">
              ↑↓
            </kbd>{" "}
            navigate
          </span>
          <span>
            <kbd className="px-1.5 py-0.5 bg-gray-200 dark:bg-gray-700 rounded">
              Enter
            </kbd>{" "}
            select
          </span>
          <span>
            <kbd className="px-1.5 py-0.5 bg-gray-200 dark:bg-gray-700 rounded">
              Esc
            </kbd>{" "}
            close
          </span>
        </div>
      </div>
    </div>
  );
}
