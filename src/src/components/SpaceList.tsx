import { useEffect } from "react";
import { useSpacesStore } from "../stores/spacesStore";
import { useChatStore } from "../stores/chatStore";

export function SpaceList() {
  const { spaces, currentSpace, loadSpaces, selectSpace, loading } =
    useSpacesStore();
  const { loadMessagesForSpace } = useChatStore();

  useEffect(() => {
    loadSpaces();
  }, [loadSpaces]);

  if (loading) {
    return (
      <div className="p-4 text-sm text-gray-500 dark:text-gray-400">
        Loading spaces...
      </div>
    );
  }

  if (spaces.length === 0) {
    return (
      <div className="p-4 text-sm text-gray-500 dark:text-gray-400">
        No spaces yet. Create one to get started!
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {spaces.map((space) => (
        <button
          key={space.id}
          onClick={() => {
            selectSpace(space.id);
            loadMessagesForSpace(space.id);
          }}
          className={`
            w-full text-left px-3 py-2 rounded-lg text-sm transition-colors
            ${
              currentSpace?.id === space.id
                ? "bg-blue-100 dark:bg-blue-900/30 text-blue-900 dark:text-blue-100"
                : "text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
            }
          `}
        >
          <div className="font-medium truncate">{space.name}</div>
          <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
            {new Date(space.lastAccessedAt).toLocaleDateString()}
          </div>
        </button>
      ))}
    </div>
  );
}
