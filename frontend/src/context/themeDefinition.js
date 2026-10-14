import { createContext } from 'react';

export const ThemeContext = createContext({
  theme: 'terracotta',
  setTheme: () => {},
  toggleTheme: () => {},
  isDark: false,
  toggleDarkMode: () => {},
});
