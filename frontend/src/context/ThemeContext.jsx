import { useState, useEffect } from 'react';
import { ThemeContext } from './themeDefinition';

export { ThemeContext } from './themeDefinition';
export { useTheme } from './useTheme';

const VALID_THEMES = ['terracotta', 'champagne', 'modern-light', 'modern-dark'];

export function ThemeProvider({ children }) {
  // Always default to 'terracotta' for fresh visits
  const [theme, setThemeState] = useState(() => {
    try {
      const stored = localStorage.getItem('utsav_theme');
      if (stored && VALID_THEMES.includes(stored)) {
        return stored;
      }
    } catch {
      // ignore storage access errors
    }
    return 'terracotta';
  });

  const isDark = theme === 'modern-dark';

  useEffect(() => {
    // Apply data-theme attribute on both html and body elements
    document.documentElement.setAttribute('data-theme', theme);
    if (document.body) {
      document.body.setAttribute('data-theme', theme);
    }

    // Reference repo style: apply 'dark' class on document root for modern-dark
    if (theme === 'modern-dark') {
      document.documentElement.classList.add('dark');
      if (document.body) document.body.classList.add('dark');
      document.documentElement.style.colorScheme = 'dark';
    } else {
      document.documentElement.classList.remove('dark');
      if (document.body) document.body.classList.remove('dark');
      document.documentElement.style.colorScheme = 'light';
    }

    try {
      localStorage.setItem('utsav_theme', theme);
    } catch {
      // ignore storage access errors
    }
  }, [theme]);

  const setTheme = (newTheme) => {
    if (VALID_THEMES.includes(newTheme)) {
      setThemeState(newTheme);
    }
  };

  const toggleDarkMode = () => {
    setThemeState((prev) => (prev === 'modern-dark' ? 'modern-light' : 'modern-dark'));
  };

  const toggleTheme = () => {
    setThemeState((prev) => {
      if (prev === 'terracotta') return 'champagne';
      if (prev === 'champagne') return 'modern-light';
      if (prev === 'modern-light') return 'modern-dark';
      return 'terracotta';
    });
  };

  return (
    <ThemeContext.Provider value={{ theme, setTheme, toggleTheme, isDark, toggleDarkMode }}>
      {children}
    </ThemeContext.Provider>
  );
}
