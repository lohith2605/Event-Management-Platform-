import { Link } from 'react-router-dom';
import { BRAND } from '../config/brand';

/**
 * BrandSymbol: The distinctive UTSAV brand symbol combining:
 * 1. Stylized letter "U" monogram
 * 2. Subtle event pass / ticket notch motif (admission entry punch)
 * 3. Restrained radiant 4-point warm gold Celebration Spark in the focal heart
 */
export function BrandSymbol({
  size = 40,
  className = '',
  monochrome = false,
  badge = true,
}) {
  if (badge) {
    return (
      <div
        className={`rounded-xl bg-gradient-to-br from-[#4338ca] via-purple-700 to-[#7c3aed] text-white flex items-center justify-center shadow-md shadow-purple-500/20 group-hover:scale-105 group-hover:shadow-purple-500/30 transition-all shrink-0 ${className}`}
        style={{ width: size, height: size }}
      >
        <svg
          viewBox="0 0 48 48"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="w-3/5 h-3/5 drop-shadow-xs"
          aria-hidden="true"
        >
          {/* Ticket-U Monogram */}
          <path
            d="M 10 11.5
               C 10 9.57 11.57 8 13.5 8
               L 17 8
               C 17.55 8 18 8.45 18 9
               L 18 24
               C 18 27.31 20.69 30 24 30
               C 27.31 30 30 27.31 30 24
               L 30 9
               C 30 8.45 30.45 8 31 8
               L 34.5 8
               L 38 11.5
               L 38 25
               C 38 32.73 31.73 39 24 39
               C 16.27 39 10 32.73 10 25
               L 10 24
               A 2.5 2.5 0 0 1 10 19
               L 10 11.5 Z"
            fill="currentColor"
          />
          {/* Subtle ticket notch punch accent */}
          <path
            d="M 12.5 21.5 L 14 21.5"
            stroke="currentColor"
            strokeWidth="1.2"
            strokeLinecap="round"
            opacity="0.6"
          />
          {/* Celebration Spark in Warm Gold */}
          <path
            d="M 24 11
               Q 24 18 29.5 18
               Q 24 18 24 25
               Q 24 18 18.5 18
               Q 24 18 24 11 Z"
            fill={monochrome ? 'currentColor' : '#fbbf24'}
          />
          {/* Center core point */}
          <circle cx="24" cy="18" r="1.3" fill="#ffffff" />
        </svg>
      </div>
    );
  }

  // Standalone vector symbol without background tile
  return (
    <svg
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`shrink-0 ${className}`}
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="utsavU_vector" x1="10" y1="8" x2="38" y2="40" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#4f46e5" />
          <stop offset="55%" stopColor="#7c3aed" />
          <stop offset="100%" stopColor="#9333ea" />
        </linearGradient>
        <linearGradient id="utsavGold_vector" x1="24" y1="10" x2="24" y2="26" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#fde047" />
          <stop offset="50%" stopColor="#fbbf24" />
          <stop offset="100%" stopColor="#d97706" />
        </linearGradient>
      </defs>

      <path
        d="M 10 11.5
           C 10 9.57 11.57 8 13.5 8
           L 17 8
           C 17.55 8 18 8.45 18 9
           L 18 24
           C 18 27.31 20.69 30 24 30
           C 27.31 30 30 27.31 30 24
           L 30 9
           C 30 8.45 30.45 8 31 8
           L 34.5 8
           L 38 11.5
           L 38 25
           C 38 32.73 31.73 39 24 39
           C 16.27 39 10 32.73 10 25
           L 10 24
           A 2.5 2.5 0 0 1 10 19
           L 10 11.5 Z"
        fill={monochrome ? 'currentColor' : 'url(#utsavU_vector)'}
      />
      <path
        d="M 12.5 21.5 L 14 21.5"
        stroke="#ffffff"
        strokeWidth="1.2"
        strokeLinecap="round"
        opacity="0.6"
      />
      <path
        d="M 24 11
           Q 24 18 29.5 18
           Q 24 18 24 25
           Q 24 18 18.5 18
           Q 24 18 24 11 Z"
        fill={monochrome ? 'currentColor' : 'url(#utsavGold_vector)'}
      />
      <circle cx="24" cy="18" r="1.3" fill="#ffffff" />
    </svg>
  );
}

/**
 * BrandLogo: Comprehensive brand logo component supporting:
 * - variant: 'primary' (with tagline), 'compact' (wordmark only), 'mark' (symbol only)
 * - size: 'sm', 'md', 'lg', 'xl'
 * - theme: 'auto', 'dark', 'light', 'monochrome'
 * - withBadge: boolean
 * - to: URL path string for clickable link, or null/false for static display
 */
export default function BrandLogo({
  variant = 'primary',
  size = 'md',
  theme = 'auto',
  withBadge = true,
  to = null,
  onClick = null,
  className = '',
  ariaLabel = null,
}) {
  let symbolPixelSize = 40;
  let textSizeClass = 'text-2xl';
  let taglineSizeClass = 'text-[10px] sm:text-[11px]';

  if (size === 'sm') {
    symbolPixelSize = 32;
    textSizeClass = 'text-lg sm:text-xl';
    taglineSizeClass = 'text-[9px]';
  } else if (size === 'lg') {
    symbolPixelSize = 48;
    textSizeClass = 'text-3xl';
    taglineSizeClass = 'text-xs sm:text-sm';
  } else if (size === 'xl') {
    symbolPixelSize = 64;
    textSizeClass = 'text-4xl';
    taglineSizeClass = 'text-sm sm:text-base';
  }

  let textColorClass = 'text-[var(--color-main-text)]';
  let taglineColorClass = 'text-[var(--color-secondary-text)]';

  if (theme === 'dark') {
    textColorClass = 'text-white';
    taglineColorClass = 'text-white/75';
  } else if (theme === 'light') {
    textColorClass = 'text-slate-900';
    taglineColorClass = 'text-slate-500';
  } else if (theme === 'monochrome') {
    textColorClass = 'text-current';
    taglineColorClass = 'text-current opacity-70';
  }

  const content = (
    <div className={`flex items-center gap-3 group focus-visible:outline-none shrink-0 ${className}`}>
      <BrandSymbol
        size={symbolPixelSize}
        badge={withBadge}
        monochrome={theme === 'monochrome'}
      />

      {variant !== 'mark' && (
        <div className="flex flex-col justify-center select-none">
          <span
            className={`font-extrabold tracking-tight font-serif leading-tight ${textSizeClass} ${textColorClass}`}
          >
            {BRAND.name}
          </span>
          {variant === 'primary' && (
            <span
              className={`font-medium tracking-wide leading-tight font-sans ${taglineSizeClass} ${taglineColorClass}`}
            >
              {BRAND.tagline}
            </span>
          )}
        </div>
      )}
    </div>
  );

  const finalAriaLabel = ariaLabel || `${BRAND.name} — ${BRAND.tagline}`;

  if (to) {
    return (
      <Link to={to} onClick={onClick} className="inline-flex shrink-0 focus-visible:outline-none" aria-label={finalAriaLabel}>
        {content}
      </Link>
    );
  }

  return content;
}
