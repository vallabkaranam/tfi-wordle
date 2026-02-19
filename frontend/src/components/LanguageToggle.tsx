'use client';

/**
 * LanguageToggle — Industry Switcher
 *
 * Lets users switch between three Indian film industry pools:
 *  - 🟡 Telugu (TFI)   — gold theme
 *  - 🟠 Hindi (Bollywood) — saffron theme
 *  - 🔴 Tamil (Kollywood) — red theme
 *
 * Emits the new language code onChange so the parent can reset game state
 * and re-fetch movies from the correct language pool.
 */

export type Language = 'te' | 'hi' | 'ta';

interface LanguageOption {
  code: Language;
  /** Short label shown in the toggle */
  label: string;
  /** Longer name shown on hover/tooltip */
  name: string;
  /** Tailwind text colour when active */
  activeText: string;
  /** Tailwind background when active */
  activeBg: string;
  /** Tailwind ring colour for active border */
  activeRing: string;
}

const LANGUAGES: LanguageOption[] = [
  {
    code: 'te',
    label: '🎬 Telugu',
    name: 'Tollywood',
    activeText: 'text-yellow-300',
    activeBg: 'bg-yellow-500/20',
    activeRing: 'ring-yellow-500/60',
  },
  {
    code: 'hi',
    label: '🎥 Hindi',
    name: 'Bollywood',
    activeText: 'text-orange-300',
    activeBg: 'bg-orange-500/20',
    activeRing: 'ring-orange-500/60',
  },
  {
    code: 'ta',
    label: '🎞️ Tamil',
    name: 'Kollywood',
    activeText: 'text-red-300',
    activeBg: 'bg-red-500/20',
    activeRing: 'ring-red-500/60',
  },
];

interface LanguageToggleProps {
  /** Currently selected language code */
  value: Language;
  /** Called when the user clicks a different language */
  onChange: (lang: Language) => void;
}

export default function LanguageToggle({ value, onChange }: LanguageToggleProps) {
  return (
    <div className="flex items-center justify-center gap-1 p-1 bg-black/30 rounded-xl border border-white/5">
      {LANGUAGES.map((lang) => {
        const isActive = lang.code === value;
        return (
          <button
            key={lang.code}
            onClick={() => onChange(lang.code)}
            title={lang.name}
            className={`
              px-3 py-1.5 rounded-lg text-xs font-bold transition-all duration-200 whitespace-nowrap
              ${isActive
                ? `${lang.activeBg} ${lang.activeText} ring-1 ${lang.activeRing} shadow-sm`
                : 'text-gray-500 hover:text-gray-300 hover:bg-white/5'
              }
            `}
          >
            {lang.label}
          </button>
        );
      })}
    </div>
  );
}
