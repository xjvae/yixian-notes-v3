// 主题设置管理 Hook — 主题包、暗色模式、字号、工作区主题色同步
import { useState, useEffect } from "react";
import { THEME_PACKS } from "@/lib/themes";
import { MOCK_INITIAL_SETTINGS, type ISettings } from "@/data/notes";
import { SETTINGS_STORAGE_KEY, NOTIF_SETTINGS_STORAGE_KEY, PRIVACY_STORAGE_KEY } from "./useWorkspaceStorage";
import { loadJSON, saveJSON } from "./useLocalStorage";

export function useThemeSettings(activeWorkspaceId: string) {
  const [settings, setSettings] = useState<ISettings>(() => {
    const loaded = loadJSON(SETTINGS_STORAGE_KEY, MOCK_INITIAL_SETTINGS);
    const merged = { ...MOCK_INITIAL_SETTINGS, ...loaded };
    if (!merged.themePack || typeof merged.themePack !== "string") {
      merged.themePack = "bamboo";
    }
    return merged;
  });

  const [privacy, setPrivacy] = useState(() =>
    loadJSON(PRIVACY_STORAGE_KEY, { vaultEnabled: false, autoLockMinutes: 5 }),
  );

  const [notificationSettings, setNotificationSettings] = useState(() =>
    loadJSON(NOTIF_SETTINGS_STORAGE_KEY, {
      dndEnabled: false,
      dndStart: "22:00",
      dndEnd: "08:00",
    }),
  );

  // 持久化
  useEffect(() => saveJSON(SETTINGS_STORAGE_KEY, settings), [settings]);
  useEffect(() => saveJSON(PRIVACY_STORAGE_KEY, privacy), [privacy]);
  useEffect(() => saveJSON(NOTIF_SETTINGS_STORAGE_KEY, notificationSettings), [notificationSettings]);

  // 主题管理（响应 theme 和 themePack 变化）
  useEffect(() => {
    const applyTheme = () => {
      let isDark = false;
      if (settings.theme === "dark") {
        isDark = true;
      } else if (settings.theme === "system") {
        isDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      }
      document.documentElement.setAttribute("data-theme", isDark ? "dark" : "light");

      const themeId = settings.themePack || "bamboo";
      const theme = THEME_PACKS.find((t) => t.id === themeId) ?? THEME_PACKS[0];
      const root = document.documentElement;
      const vars = isDark && theme.darkVars ? theme.darkVars : theme.vars;
      Object.entries(vars).forEach(([key, value]) => {
        root.style.setProperty(key, value);
      });
      root.setAttribute("data-theme-pack", theme.id);
    };

    applyTheme();

    let mediaQuery: MediaQueryList | null = null;
    let listener: ((e: MediaQueryListEvent) => void) | null = null;

    if (settings.theme === "system") {
      mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
      listener = () => applyTheme();
      mediaQuery.addEventListener("change", listener);
    }

    return () => {
      if (mediaQuery && listener) {
        mediaQuery.removeEventListener("change", listener);
      }
    };
  }, [settings]);

  // 同步工作区主题包到 settings
  useEffect(() => {
    // 由 LayoutManager 传入的 workspaceThemePack 触发同步
  }, [activeWorkspaceId]);

  return {
    settings,
    setSettings,
    privacy,
    setPrivacy,
    notificationSettings,
    setNotificationSettings,
  };
}
