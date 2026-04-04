function stripDiacritics(value: string) {
  return value.normalize('NFKD').replace(/[\u0300-\u036f]/g, '');
}

export function normalizeMovieTitle(value: string) {
  return stripDiacritics(value || '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function loosenMovieTitle(value: string) {
  return normalizeMovieTitle(value)
    .replace(/([aeiou])\1+/g, '$1')
    .replace(/aa/g, 'a')
    .replace(/ee/g, 'e')
    .replace(/ii/g, 'i')
    .replace(/oo/g, 'o')
    .replace(/uu/g, 'u')
    .replace(/bh/g, 'b')
    .replace(/dh/g, 'd')
    .replace(/gh/g, 'g')
    .replace(/kh/g, 'k')
    .replace(/ph/g, 'f')
    .replace(/sh/g, 's')
    .replace(/th/g, 't')
    .replace(/\s+/g, ' ')
    .trim();
}

export function buildMovieSearchAliases(title: string) {
  const normalized = normalizeMovieTitle(title);
  const loose = loosenMovieTitle(title);
  const compact = normalized.replace(/\s+/g, '');
  const looseCompact = loose.replace(/\s+/g, '');

  return Array.from(new Set([normalized, loose, compact, looseCompact].filter(Boolean)));
}
