import { useCallback } from 'react';
import { THEME_PACKS } from '@/lib/themes';

const STORAGE_KEY = '__app_yixian_theme_pack';

function getMode(): 'light' | 'dark' {
  if (typeof document === 'undefined') return 'light';
  return document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
}

export function useThemePack() {
  const applyTheme = useCallback((themeId: string, forcedMode?: 'light' | 'dark') => {
    const theme = THEME_PACKS.find((t) => t.id === themeId) ?? THEME_PACKS[0];
    const root = document.documentElement;
    const useDark = forcedMode ?? getMode();
    const vars = useDark === 'dark' && theme.darkVars ? theme.darkVars : theme.vars;

    // 应用所有 CSS 变量
    Object.entries(vars).forEach(([key, value]) => {
      root.style.setProperty(key, value);
    });

    // 记录到 data-theme-pack
    root.setAttribute('data-theme-pack', theme.id);

    try {
      localStorage.setItem(STORAGE_KEY, theme.id);
    } catch {
      /* ignore */
    }
  }, []);

  const getCurrentTheme = useCallback((): string => {
    return document.documentElement.getAttribute('data-theme-pack') ?? 'bamboo';
  }, []);

  return { applyTheme, getCurrentTheme };
}
