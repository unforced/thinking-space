import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { SpaceList } from "./components/SpaceList";
import { CreateSpaceModal } from "./components/CreateSpaceModal";
import { ChatArea } from "./components/ChatArea";
import { ClaudeMdEditor } from "./components/ClaudeMdEditor";
import { SettingsPanel } from "./components/SettingsPanel";
import { ArtifactViewer } from "./components/ArtifactViewer";
import { useSettingsStore } from "./stores/settingsStore";
import { useSpacesStore } from "./stores/spacesStore";

function App() {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showClaudeMdEditor, setShowClaudeMdEditor] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showArtifacts, setShowArtifacts] = useState(false);
  const { loadSettings } = useSettingsStore();
  const { currentSpace } = useSpacesStore();

  useEffect(() => {
    loadSettings();

    // Start the agent sidecar
    invoke("agent_start_sidecar")
      .then(() => console.log("Agent sidecar started"))
      .catch((error) => console.error("Failed to start agent sidecar:", error));
  }, [loadSettings]);

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-gray-900">
      {/* Sidebar */}
      <div className="w-64 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <h1 className="text-xl font-semibold text-gray-900 dark:text-white">
            Thinking Space
          </h1>
        </div>

        {/* Spaces List */}
        <div className="flex-1 overflow-y-auto p-4">
          <div className="space-y-2">
            <h2 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">
              Spaces
            </h2>
            <SpaceList />
          </div>
        </div>

        {/* New Space Button */}
        <div className="p-4 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={() => setShowCreateModal(true)}
            className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors"
          >
            + New Space
          </button>
        </div>

        {/* Edit CLAUDE.md */}
        {currentSpace && (
          <div className="p-4 border-t border-gray-200 dark:border-gray-700 space-y-2">
            <button
              onClick={() => setShowClaudeMdEditor(true)}
              className="w-full px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg text-sm transition-colors"
            >
              📝 Edit CLAUDE.md
            </button>
            <button
              onClick={() => setShowArtifacts(true)}
              className="w-full px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg text-sm transition-colors"
            >
              📁 View Files
            </button>
          </div>
        )}

        {/* Settings */}
        <div className="p-4 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={() => setShowSettings(true)}
            className="w-full px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg text-sm transition-colors"
          >
            ⚙️ Settings
          </button>
        </div>
      </div>

      {/* Main Area */}
      <ChatArea />

      {/* Modals */}
      <CreateSpaceModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
      />
      <ClaudeMdEditor
        isOpen={showClaudeMdEditor}
        onClose={() => setShowClaudeMdEditor(false)}
      />
      <SettingsPanel
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
      />
      {currentSpace && (
        <ArtifactViewer
          isOpen={showArtifacts}
          onClose={() => setShowArtifacts(false)}
          spaceId={currentSpace.id}
          spacePath={currentSpace.path}
        />
      )}
    </div>
  );
}

export default App;
