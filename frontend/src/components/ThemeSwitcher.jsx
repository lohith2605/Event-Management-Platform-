import { useTheme } from '../context/useTheme';
import { Palette, Check, Sun, Moon } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';

export default function ThemeSwitcher({ isMobile = false }) {
  const { theme, setTheme, isDark, toggleDarkMode } = useTheme();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const containerRef = useRef(null);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event) {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const isModern = theme === 'modern-light' || theme === 'modern-dark';

  const getThemeTitle = () => {
    if (theme === 'terracotta') return 'Theme: Warm Terracotta (Default)';
    if (theme === 'champagne') return 'Theme: Champagne Gold';
    if (theme === 'modern-dark') return 'Theme: Modern Studio (Dark)';
    return 'Theme: Modern Studio (Light)';
  };

  if (isMobile) {
    return (
      <div className="py-2 space-y-2" role="group" aria-label="Theme selection">
        <span className="text-xs font-bold uppercase tracking-wider text-[var(--color-secondary-text)] flex items-center gap-1.5 px-1">
          <Palette className="w-3.5 h-3.5 text-[var(--color-golden-accent)]" />
          <span>Visual Theme</span>
        </span>
        <div className="grid grid-cols-2 gap-2">
          {/* 1. Terracotta */}
          <button
            type="button"
            onClick={() => setTheme('terracotta')}
            className={`py-2 px-2.5 rounded-xl text-xs font-bold flex items-center justify-between border transition-all cursor-pointer ${
              theme === 'terracotta'
                ? 'border-[var(--color-primary-action)] bg-[var(--color-primary-bg)] shadow-xs text-[var(--color-main-text)]'
                : 'border-[var(--color-borders)] bg-[var(--color-secondary-bg)]/50 text-[var(--color-secondary-text)] hover:text-[var(--color-main-text)]'
            }`}
          >
            <div className="flex items-center gap-1.5 truncate">
              <span className="w-3 h-3 rounded-full border border-black/10 shrink-0 bg-[#D96342]" />
              <span className="truncate">Terracotta</span>
            </div>
            {theme === 'terracotta' && <Check className="w-3.5 h-3.5 text-[var(--color-primary-action)] shrink-0" />}
          </button>

          {/* 2. Champagne */}
          <button
            type="button"
            onClick={() => setTheme('champagne')}
            className={`py-2 px-2.5 rounded-xl text-xs font-bold flex items-center justify-between border transition-all cursor-pointer ${
              theme === 'champagne'
                ? 'border-[var(--color-primary-action)] bg-[var(--color-primary-bg)] shadow-xs text-[var(--color-main-text)]'
                : 'border-[var(--color-borders)] bg-[var(--color-secondary-bg)]/50 text-[var(--color-secondary-text)] hover:text-[var(--color-main-text)]'
            }`}
          >
            <div className="flex items-center gap-1.5 truncate">
              <span className="w-3 h-3 rounded-full border border-black/10 shrink-0 bg-[#C99A3D]" />
              <span className="truncate">Champagne</span>
            </div>
            {theme === 'champagne' && <Check className="w-3.5 h-3.5 text-[var(--color-primary-action)] shrink-0" />}
          </button>
        </div>

        {/* 3. Modern Studio (Light / Dark) */}
        <div className="p-2 rounded-xl border border-[var(--color-borders)] bg-[var(--color-secondary-bg)]/50 space-y-1.5">
          <div className="flex items-center justify-between px-1 text-xs font-bold text-[var(--color-main-text)]">
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full border border-black/20 overflow-hidden flex shrink-0">
                <span className="w-1/2 h-full bg-[#FFFFFF]" />
                <span className="w-1/2 h-full bg-[#0B0F19]" />
              </span>
              <span>Modern Studio</span>
            </span>
            {isModern && (
              <span className="text-[10px] text-[var(--color-primary-action)] font-extrabold uppercase">
                Active
              </span>
            )}
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            <button
              type="button"
              onClick={() => setTheme('modern-light')}
              className={`py-1.5 px-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 border transition-all cursor-pointer ${
                theme === 'modern-light'
                  ? 'border-[var(--color-primary-action)] bg-[var(--color-card-bg)] text-[var(--color-primary-action)] shadow-xs'
                  : 'border-transparent text-[var(--color-secondary-text)] hover:text-[var(--color-main-text)]'
              }`}
            >
              <Sun className="w-3.5 h-3.5 text-amber-500" />
              <span>Light</span>
            </button>
            <button
              type="button"
              onClick={() => setTheme('modern-dark')}
              className={`py-1.5 px-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 border transition-all cursor-pointer ${
                theme === 'modern-dark'
                  ? 'border-[var(--color-primary-action)] bg-[var(--color-card-bg)] text-[var(--color-primary-action)] shadow-xs'
                  : 'border-transparent text-[var(--color-secondary-text)] hover:text-[var(--color-main-text)]'
              }`}
            >
              <Moon className="w-3.5 h-3.5 text-indigo-400" />
              <span>Dark</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative inline-flex items-center gap-1.5" ref={containerRef}>
      {/* Quick 1-click toggle for Light/Dark mode when in Modern Studio */}
      {isModern && (
        <button
          type="button"
          onClick={toggleDarkMode}
          className="p-2 rounded-xl border border-[var(--color-borders)] bg-[var(--color-primary-bg)] hover:bg-[var(--color-secondary-bg)] text-[var(--color-main-text)] transition-colors shadow-xs cursor-pointer focus-visible:outline-2 focus-visible:outline-[var(--color-primary-action)]"
          title={isDark ? 'Switch to Modern Light Mode' : 'Switch to Modern Dark Mode'}
          aria-label={isDark ? 'Switch to Modern Light Mode' : 'Switch to Modern Dark Mode'}
        >
          {isDark ? (
            <Sun className="w-3.5 h-3.5 text-[var(--color-golden-accent)]" />
          ) : (
            <Moon className="w-3.5 h-3.5 text-[var(--color-primary-action)]" />
          )}
        </button>
      )}

      {/* Main Theme Menu Trigger */}
      <button
        type="button"
        onClick={() => setDropdownOpen(!dropdownOpen)}
        className="inline-flex items-center justify-center p-2 rounded-xl border border-[var(--color-borders)] bg-[var(--color-primary-bg)] hover:bg-[var(--color-secondary-bg)] text-[var(--color-secondary-text)] hover:text-[var(--color-main-text)] transition-colors shadow-xs cursor-pointer focus-visible:outline-2 focus-visible:outline-[var(--color-primary-action)]"
        aria-label={`${getThemeTitle()}. Click to choose theme`}
        aria-expanded={dropdownOpen}
        aria-haspopup="listbox"
        title={getThemeTitle()}
      >
        <Palette className="w-4 h-4 opacity-85" />
      </button>

      {dropdownOpen && (
        <div
          className="absolute right-0 mt-2 top-full w-64 rounded-2xl border border-[var(--color-borders)] bg-[var(--color-primary-bg)] shadow-xl p-2 z-50 animate-fade-in text-[var(--color-main-text)]"
          role="listbox"
          aria-label="Visual Theme Options"
        >
          <div className="px-3 py-1.5 text-[10px] uppercase font-extrabold tracking-wider text-[var(--color-secondary-text)] border-b border-[var(--color-borders)]/60 mb-1.5 flex items-center justify-between">
            <span>Theme Palette</span>
            <span className="text-[9px] font-semibold lowercase opacity-70">3 choices</span>
          </div>

          {/* 1. Warm Terracotta */}
          <button
            type="button"
            role="option"
            aria-selected={theme === 'terracotta'}
            onClick={() => {
              setTheme('terracotta');
              setDropdownOpen(false);
            }}
            className={`w-full text-left px-3 py-2 rounded-xl text-xs flex items-center justify-between transition-colors cursor-pointer mb-1 ${
              theme === 'terracotta'
                ? 'bg-[var(--color-secondary-bg)] font-bold text-[var(--color-main-text)]'
                : 'hover:bg-[var(--color-secondary-bg)]/60 text-[var(--color-secondary-text)] hover:text-[var(--color-main-text)] font-medium'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <span
                className="w-3.5 h-3.5 rounded-full border border-black/20 shadow-xs shrink-0 bg-[#D96342]"
              />
              <div>
                <div className="leading-snug">
                  Warm Terracotta <span className="text-[10px] font-bold text-[var(--color-primary-action)]">(Default)</span>
                </div>
                <div className="text-[10px] text-[var(--color-secondary-text)] font-normal opacity-80">
                  Warm ivory & coral terracotta
                </div>
              </div>
            </div>
            {theme === 'terracotta' && (
              <Check className="w-4 h-4 text-[var(--color-primary-action)] shrink-0 ml-2" />
            )}
          </button>

          {/* 2. Champagne Gold */}
          <button
            type="button"
            role="option"
            aria-selected={theme === 'champagne'}
            onClick={() => {
              setTheme('champagne');
              setDropdownOpen(false);
            }}
            className={`w-full text-left px-3 py-2 rounded-xl text-xs flex items-center justify-between transition-colors cursor-pointer mb-1 ${
              theme === 'champagne'
                ? 'bg-[var(--color-secondary-bg)] font-bold text-[var(--color-main-text)]'
                : 'hover:bg-[var(--color-secondary-bg)]/60 text-[var(--color-secondary-text)] hover:text-[var(--color-main-text)] font-medium'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <span
                className="w-3.5 h-3.5 rounded-full border border-black/20 shadow-xs shrink-0 bg-[#C99A3D]"
              />
              <div>
                <div className="leading-snug">Champagne Gold</div>
                <div className="text-[10px] text-[var(--color-secondary-text)] font-normal opacity-80">
                  Warm sand, rich gold & espresso
                </div>
              </div>
            </div>
            {theme === 'champagne' && (
              <Check className="w-4 h-4 text-[var(--color-primary-action)] shrink-0 ml-2" />
            )}
          </button>

          {/* 3. Modern Studio (Light / Dark Mode Pair) */}
          <div
            className={`w-full px-3 py-2 rounded-xl text-xs transition-colors border ${
              isModern
                ? 'bg-[var(--color-secondary-bg)]/80 border-[var(--color-primary-action)]/50'
                : 'border-transparent hover:bg-[var(--color-secondary-bg)]/60'
            }`}
          >
            <div
              className="flex items-center justify-between mb-1.5 cursor-pointer"
              onClick={() => {
                if (!isModern) setTheme('modern-light');
              }}
            >
              <div className="flex items-center gap-2.5">
                <div className="w-3.5 h-3.5 rounded-full border border-black/20 overflow-hidden flex shrink-0 shadow-xs">
                  <span className="w-1/2 h-full bg-[#FFFFFF]" />
                  <span className="w-1/2 h-full bg-[#0B0F19]" />
                </div>
                <div>
                  <div className="leading-snug font-bold text-[var(--color-main-text)]">
                    Modern Studio
                  </div>
                  <div className="text-[10px] text-[var(--color-secondary-text)] font-normal opacity-80">
                    Clean light & charcoal dark
                  </div>
                </div>
              </div>
              {isModern && (
                <Check className="w-4 h-4 text-[var(--color-primary-action)] shrink-0 ml-2" />
              )}
            </div>

            {/* Segmented Light / Dark Toggle Buttons */}
            <div className="grid grid-cols-2 gap-1.5 mt-2 pt-2 border-t border-[var(--color-borders)]/50">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setTheme('modern-light');
                  setDropdownOpen(false);
                }}
                className={`py-1 px-2 rounded-lg text-[11px] font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                  theme === 'modern-light'
                    ? 'bg-[var(--color-card-bg)] text-[var(--color-primary-action)] shadow-xs border border-[var(--color-primary-action)]/40'
                    : 'text-[var(--color-secondary-text)] hover:text-[var(--color-main-text)] hover:bg-[var(--color-card-bg)]/50 border border-transparent'
                }`}
                title="Select Modern Light Mode"
              >
                <Sun className="w-3 h-3 text-amber-500" />
                <span>Light</span>
              </button>

              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setTheme('modern-dark');
                  setDropdownOpen(false);
                }}
                className={`py-1 px-2 rounded-lg text-[11px] font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                  theme === 'modern-dark'
                    ? 'bg-[var(--color-card-bg)] text-[var(--color-primary-action)] shadow-xs border border-[var(--color-primary-action)]/40'
                    : 'text-[var(--color-secondary-text)] hover:text-[var(--color-main-text)] hover:bg-[var(--color-card-bg)]/50 border border-transparent'
                }`}
                title="Select Modern Dark Mode"
              >
                <Moon className="w-3 h-3 text-indigo-400" />
                <span>Dark</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
