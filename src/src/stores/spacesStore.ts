import { create } from "zustand";
import { invoke } from '@tauri-apps/api/core'

export interface Space {
  id: string
  name: string
  path: string
  claude_md_path: string
  created_at: number
  last_accessed_at: number
  template?: string
}

// Frontend-facing interface with camelCase
export interface SpaceUI {
  id: string;
  name: string;
  path: string;
  claudeMdPath: string;
  createdAt: number;
  lastAccessedAt: number;
  template?: string;
}

function toSpaceUI(space: Space): SpaceUI {
  return {
    id: space.id,
    name: space.name,
    path: space.path,
    claudeMdPath: space.claude_md_path,
    createdAt: space.created_at,
    lastAccessedAt: space.last_accessed_at,
    template: space.template
  }
}

interface SpacesState {
  spaces: SpaceUI[];
  currentSpace: SpaceUI | null;
  loading: boolean;
  error: string | null;

  // Actions
  loadSpaces: () => Promise<void>;
  createSpace: (name: string, template: string) => Promise<void>;
  selectSpace: (id: string) => void;
  deleteSpace: (id: string) => Promise<void>;
  updateLastAccessed: (id: string) => Promise<void>;
}

export const useSpacesStore = create<SpacesState>((set, get) => ({
  spaces: [],
  currentSpace: null,
  loading: false,
  error: null,

  loadSpaces: async () => {
    set({ loading: true, error: null });
    try {
      const spaces = await invoke<Space[]>('list_spaces')
      set({ spaces: spaces.map(toSpaceUI), loading: false });
    } catch (error) {
      console.error('Failed to load spaces:', error)
      set({ error: String(error), loading: false });
    }
  },

  createSpace: async (name: string, template: string) => {
    set({ loading: true, error: null });
    try {
      const space = await invoke<Space>('create_space', {
        request: { name, template }
      })

      const spaceUI = toSpaceUI(space)
      set((state) => ({
        spaces: [...state.spaces, spaceUI],
        currentSpace: spaceUI,
        loading: false,
      }));
    } catch (error) {
      console.error('Failed to create space:', error)
      set({ error: String(error), loading: false });
    }
  },

  selectSpace: (id: string) => {
    const space = get().spaces.find((s) => s.id === id);
    if (space) {
      set({ currentSpace: space });
      get().updateLastAccessed(id);
    }
  },

  deleteSpace: async (id: string) => {
    set({ loading: true, error: null });
    try {
      awaitawait invoke("delete_space",invoke('delete_space', {{ idid })});
      set((state) => ({
        spaces: state.spaces.filter((s) => s.id !== id),
        currentSpace: state.currentSpace?.id === id ? null : state.currentSpace,
        loading: false,
      }));
    } catch (error) {
      console.error('Failed to delete space:', error)
      set({ error: String(error), loading: false });
    }
  },

  updateLastAccessed: async (id: string) => {
    try {
      awaitawait invoke("update_last_accessed",invoke('update_last_accessed', {{ idid })});
      set((state) => ({
        spaces: state.spaces.map((s) =>
          s.id === id ? { ...s, lastAccessedAt: Date.now() } : s,
        ),
      }));
    } catch (error) {
      console.error("Failed to update last accessed:", error);
    }
  },
}));
