import React, { useEffect, useState } from 'react';

const SELECTED_THEME = 'SELECTED_THEME';
export type ColorSchemeType = 'light' | 'dark' | 'system';

const getSystemColorMode = (): 'light' | 'dark' => {
  if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  return 'light';
};

// NativeWind v5 web: the class-based `dark:` variant is driven by the <html>
// element class (see @custom-variant in global.css), so apply the resolved
// scheme directly to the document element — same approach as the
// GluestackUIProvider web script. react-native-web's Appearance has no
// setColorScheme, so the native Appearance override path is unavailable here.
const applyColorScheme = (t: ColorSchemeType) => {
  if (typeof document === 'undefined') return;
  const documentElement = document.documentElement;
  const resolved = t === 'system' ? getSystemColorMode() : t;
  documentElement.classList.remove(resolved === 'light' ? 'dark' : 'light');
  documentElement.classList.add(resolved);
  documentElement.style.colorScheme = resolved;
};

export const useSelectedTheme = () => {
  const [theme, setThemeState] = useState<ColorSchemeType | undefined>(undefined);

  useEffect(() => {
    if (typeof localStorage !== 'undefined') {
      const storedTheme = localStorage.getItem(SELECTED_THEME);
      if (storedTheme) {
        setThemeState(storedTheme as ColorSchemeType);
      }
    }
  }, []);

  const setSelectedTheme = React.useCallback((t: ColorSchemeType) => {
    applyColorScheme(t);
    setThemeState(t);
    if (typeof localStorage !== 'undefined') localStorage.setItem(SELECTED_THEME, t);
  }, []);

  const selectedTheme = (theme ?? 'dark') as ColorSchemeType;
  return { selectedTheme, setSelectedTheme } as const;
};

export const loadSelectedTheme = () => {
  try {
    if (typeof document === 'undefined') {
      // Not in a browser environment (e.g. Electron preload / SSR), skip
      return;
    }
    const storedTheme = typeof localStorage !== 'undefined' ? (localStorage.getItem(SELECTED_THEME) as ColorSchemeType | null) : null;
    // Default to dark mode when no custom theme has been chosen
    applyColorScheme(storedTheme ?? 'dark');
  } catch (error) {
    console.error('Failed to load selected theme:', error);
  }
};
