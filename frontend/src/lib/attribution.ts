export type AttributionContext = {
  partner?: string;
  campaign?: string;
  ref?: string;
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_content?: string;
};

const TRACKED_QUERY_PARAMS = [
  'partner',
  'campaign',
  'ref',
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_content',
] as const;

const VALID_LANGS = new Set(['te', 'hi', 'ta']);

function getSearchParams() {
  if (typeof window === 'undefined') {
    return new URLSearchParams();
  }

  return new URLSearchParams(window.location.search);
}

export function readAttributionFromLocation(): AttributionContext {
  const params = getSearchParams();
  const attribution: AttributionContext = {};

  for (const key of TRACKED_QUERY_PARAMS) {
    const value = params.get(key);
    if (value) {
      attribution[key] = value;
    }
  }

  return attribution;
}

export function hasAttributionContext(attribution: AttributionContext) {
  return Object.keys(attribution).length > 0;
}

export function getInitialLanguageFromLocation(defaultLanguage: 'te' | 'hi' | 'ta' = 'te') {
  const candidate = getSearchParams().get('lang');
  return candidate && VALID_LANGS.has(candidate) ? (candidate as 'te' | 'hi' | 'ta') : defaultLanguage;
}

export function getInitialSeedFromLocation() {
  const rawSeed = getSearchParams().get('seed');
  if (!rawSeed) {
    return undefined;
  }

  const parsedSeed = Number.parseInt(rawSeed, 10);
  if (!Number.isFinite(parsedSeed) || parsedSeed < 0) {
    return undefined;
  }

  return parsedSeed;
}
