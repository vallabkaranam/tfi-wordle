'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { X, HelpCircle } from 'lucide-react';
import { Language } from './LanguageToggle';

interface HowToPlayProps {
  isOpen: boolean;
  onClose: () => void;
  language?: Language;
}

/** Per-language copy for the instructions modal */
const LANG_INFO: Record<Language, {
  industry: string;
  exampleMovie: string;
  exampleHero: string;
  exampleHeroine: string;
  exampleDirector: string;
  exampleMusic: string;
  exampleProducer: string;
  exampleYear: string;
  heroMatch: boolean;
  heroineMatch: boolean;
  directorMatch: boolean;
  musicMatch: boolean;
  producerMatch: boolean;
  yearMatch: 'correct' | 'higher' | 'lower';
  summary: string;
}> = {
  te: {
    industry: 'Telugu',
    exampleMovie: 'Baahubali: The Beginning',
    exampleHero: 'Prabhas',
    exampleHeroine: 'Anushka',
    exampleDirector: 'Rajamouli',
    exampleMusic: 'M.M. Keeravani',
    exampleProducer: 'Shobu Yarlagadda',
    exampleYear: '2015',
    heroMatch: true,
    heroineMatch: false,
    directorMatch: false,
    musicMatch: true,
    producerMatch: false,
    yearMatch: 'higher',
    summary: 'Hero and Music matched, and the target is newer than 2015.',
  },
  hi: {
    industry: 'Hindi',
    exampleMovie: 'Dangal',
    exampleHero: 'Aamir Khan',
    exampleHeroine: 'Fatima Sana Shaikh',
    exampleDirector: 'Nitesh Tiwari',
    exampleMusic: 'Pritam',
    exampleProducer: 'Aamir Khan Productions',
    exampleYear: '2016',
    heroMatch: true,
    heroineMatch: false,
    directorMatch: false,
    musicMatch: false,
    producerMatch: true,
    yearMatch: 'lower',
    summary: 'Hero and Producer matched, and the target is older than 2016.',
  },
  ta: {
    industry: 'Tamil',
    exampleMovie: 'Vikram',
    exampleHero: 'Kamal Haasan',
    exampleHeroine: 'Narain',
    exampleDirector: 'Lokesh Kanagaraj',
    exampleMusic: 'Anirudh',
    exampleProducer: 'Raaj Kamal Films',
    exampleYear: '2022',
    heroMatch: false,
    heroineMatch: false,
    directorMatch: false,
    musicMatch: true,
    producerMatch: true,
    yearMatch: 'correct',
    summary: 'Music, Producer, and Year matched — 3 columns left!',
  },
};

/**
 * HowToPlay Modal — dynamic per selected language.
 * Explains the 5-column Wordle mechanic with a worked example
 * specific to the currently active industry (Tollywood / Bollywood / Kollywood).
 */
export default function HowToPlay({ isOpen, onClose, language = 'te' }: HowToPlayProps) {
  const info = LANG_INFO[language];

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.9, y: 20 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.9, y: 20 }}
            transition={{ type: 'spring', stiffness: 300, damping: 25 }}
            className="bg-cinema-light border border-white/10 rounded-2xl p-7 max-w-md w-full shadow-2xl overflow-y-auto max-h-[90vh]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-2">
                <HelpCircle className="h-5 w-5 text-gold" />
                <h2 className="text-xl font-bold text-white uppercase tracking-wide">How to Play</h2>
              </div>
              <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors" aria-label="Close">
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Rules */}
            <div className="space-y-3 mb-6">
              <p className="text-gray-300 text-sm leading-relaxed">
                Guess the <span className="text-gold font-bold">secret movie</span> in 6 tries or fewer!
              </p>
              <ol className="list-decimal list-inside space-y-2 text-sm text-gray-300 pl-1">
                <li>Search for any movie in the input.</li>
                <li>Each guess reveals how six key columns compare to the target.</li>
                <li>
                  <span className="inline-block w-4 h-4 bg-wordle-green rounded-sm mr-1 align-middle" />
                  <strong className="text-white">Green</strong> = exact match for that role.
                </li>
                <li>
                  <span className="inline-block w-4 h-4 bg-wordle-yellow rounded-sm mr-1 align-middle" />
                  <strong className="text-white">Yellow</strong> on Year = use the arrow. <strong className="text-white">↑</strong> means the target is newer, <strong className="text-white">↓</strong> means it is older.
                </li>
                <li>
                  <span className="inline-block w-4 h-4 bg-wordle-gray rounded-sm mr-1 align-middle" />
                  <strong className="text-white">Gray</strong> = wrong person or missing year hint.
                </li>
                <li>Match all six columns to win 🍿</li>
              </ol>
              <p className="text-xs text-gray-500">A new puzzle drops every day at midnight.</p>
            </div>

            <div className="border-t border-white/10 mb-5" />

            {/* Visual example — language-specific */}
            <h3 className="text-xs uppercase text-gray-500 font-bold tracking-widest mb-2">Example Guess</h3>
            <p className="text-xs text-gray-400 mb-3">
              If you guessed <span className="text-gold font-semibold">{info.exampleMovie}</span>:
            </p>

            <div className="grid grid-cols-6 gap-1 text-center text-[9px] uppercase text-gray-400 mb-1 font-bold tracking-wider">
              <div>Hero</div><div>Heroine</div><div>Director</div><div>Music</div><div>Producer</div><div>Year</div>
            </div>
            <div className="grid grid-cols-6 gap-1">
              <ExampleCell match={info.heroMatch}     name={info.exampleHero}      />
              <ExampleCell match={info.heroineMatch}  name={info.exampleHeroine}   />
              <ExampleCell match={info.directorMatch} name={info.exampleDirector}  />
              <ExampleCell match={info.musicMatch}    name={info.exampleMusic}     />
              <ExampleCell match={info.producerMatch} name={info.exampleProducer}  />
              <ExampleCell match={info.yearMatch === 'correct'} name={info.exampleYear} indicator={info.yearMatch === 'higher' ? '↑' : info.yearMatch === 'lower' ? '↓' : undefined} />
            </div>
            <p className="text-xs text-gray-500 mt-3 text-center">{info.summary}</p>

            <button
              onClick={onClose}
              className="w-full mt-6 py-3 bg-gold text-black font-bold rounded-xl hover:bg-yellow-400 transition-colors text-sm"
            >
              Let&apos;s Play! 🎬
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function ExampleCell({ match, name, indicator }: { match: boolean; name: string; indicator?: string }) {
  return (
    <div
      className={`rounded-lg p-2 text-center flex flex-col items-center justify-center min-h-[60px] ${
        match ? 'bg-wordle-green' : indicator ? 'bg-wordle-yellow' : 'bg-wordle-gray'
      }`}
    >
      <span className="text-white font-bold text-[9px] leading-tight line-clamp-2">{name}</span>
      <span className="text-white/70 text-[8px] mt-1">{indicator || (match ? '✓' : '✗')}</span>
    </div>
  );
}
