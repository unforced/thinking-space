import { create } from "zustand";
import { invoke } from "@tauri-apps/api/core";

interface Settings {
  api_key: string | null;
  theme: string;
  has_completed_onboarding: boolean;
}

interface SettingsState {
  apiKey: string;
  theme: "light" | "dark" | "system";
  dataLocation: string;
  hasCompletedOnboarding: boolean;

  // Actions
  setApiKey: (key: string) => Promise<void>;
  setTheme: (theme: "light" | "dark" | "system") => Promise<void>;
  loadSettings: () => Promise<void>;
  openDataFolder: () => Promise<void>;
  completeOnboarding: () => Promise<void>;
}

function applyTheme(theme: "light" | "dark" | "system") {
  if (
    theme === "dark" ||
    (theme === "system" &&
      window.matchMedia("(prefers-color-scheme: dark)").matches)
  ) {
    document.documentElement.classList.add("dark");
  } else {
    document.documentElement.classList.remove("dark");
  }
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  apiKey: "",
  theme: "system",
  dataLocation: "~/.thinking-space",
  hasCompletedOnboarding: false,

  setApiKey: async (key: string) => {
    try {
      const currentSettings = await invoke<Settings>("load_settings");
      const newSettings = {
        ...currentSettings,
        api_key: key || null,
      };
      await invoke("save_settings", { settings: newSettings });
      set({ apiKey: key });
    } catch (error) {
      console.error("Failed to save API key:", error);
      throw error;
    }
  },

  setTheme: async (theme: "light" | "dark" | "system") => {
    try {
      const currentSettings = await invoke<Settings>("load_settings");
      const newSettings = {
        ...currentSettings,
        theme,
      };
      await invoke("save_settings", { settings: newSettings });
      set({ theme });
      applyTheme(theme);
    } catch (error) {
      console.error("Failed to save theme:", error);
      throw error;
    }
  },

  loadSettings: async () => {
    try {
      const settings = await invoke<Settings>("load_settings");
      const dataLocation = await invoke<string>("get_data_location");

      const theme = (settings.theme || "system") as "light" | "dark" | "system";
      const apiKey = settings.api_key || "";
      const hasCompletedOnboarding = settings.has_completed_onboarding || false;

      set({
        apiKey,
        theme,
        dataLocation,
        hasCompletedOnboarding,
      });

      // Apply theme
      applyTheme(theme);

      // Listen for system theme changes if theme is 'system'
      if (theme === "system") {
        const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
        const listener = () => applyTheme("system");
        mediaQuery.addEventListener("change", listener);
      }
    } catch (error) {
      console.error("Failed to load settings:", error);
      // Set defaults on error
      set({
        apiKey: "",
        theme: "system",
        dataLocation: "~/.thinking-space",
      });
      applyTheme("system");
    }
  },

  openDataFolder: async () => {
    try {
      await invoke("open_data_folder");
    } catch (error) {
      console.error("Failed to open data folder:", error);
      throw error;
    }
  },

  completeOnboarding: async () => {
    try {
      const currentSettings = await invoke<Settings>("load_settings");
      const newSettings = {
        ...currentSettings,
        has_completed_onboarding: true,
      };
      await invoke("save_settings", { settings: newSettings });
      set({ hasCompletedOnboarding: true });
    } catch (error) {
      console.error("Failed to save onboarding status:", error);
      throw error;
    }
  },
}));
