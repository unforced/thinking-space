import { useState } from "react";

function App() {
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
            {/* Placeholder for spaces */}
            <div className="text-sm text-gray-500 dark:text-gray-400">
              No spaces yet
            </div>
          </div>
        </div>

        {/* New Space Button */}
        <div className="p-4 border-t border-gray-200 dark:border-gray-700">
          <button className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors">
            + New Space
          </button>
        </div>

        {/* Settings */}
        <div className="p-4 border-t border-gray-200 dark:border-gray-700">
          <button className="w-full px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg text-sm transition-colors">
            ⚙️ Settings
          </button>
        </div>
      </div>

      {/* Main Area */}
      <div className="flex-1 flex flex-col">
        {/* Welcome Screen */}
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center max-w-md px-4">
            <div className="text-6xl mb-4">✨</div>
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-2">
              Welcome to Thinking Space
            </h2>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              A place to think with Claude. Create your first Space to get
              started.
            </p>
            <button className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors">
              Create Your First Space
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
