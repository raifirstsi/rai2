const ALIASES: Record<string, string> = { pt: "pt-br", "zh-hant": "zh-tw", "zh-hk": "zh-tw", "zh-mo": "zh-tw" };

/** The entry for the language set in Settings, else for its parent ("pt-br" → "pt"), else English. */
export function byLanguage<T>(table: { en: T } & Partial<Record<string, T>>, language: string | undefined): T {
  let candidate = language?.trim().toLowerCase() || "en";
  while (candidate) {
    const entry = table[ALIASES[candidate] ?? candidate];
    if (entry !== undefined) return entry;
    const separator = candidate.lastIndexOf("-");
    if (separator < 0) break;
    candidate = candidate.slice(0, separator);
  }
  return table.en;
}

/** The locale dates and times are formatted in: the language set in Settings, else US English. */
export function intlLocale(language: string | undefined): string {
  try {
    return Intl.getCanonicalLocales(language?.trim() || "en-US")[0] ?? "en-US";
  } catch {
    return "en-US";
  }
}

const LANGUAGE_NAMES: Record<string, string> = {
  vi: "Vietnamese (Tiếng Việt)",
  en: "English",
  de: "German (Deutsch)",
  es: "Spanish (Español)",
  fr: "French (Français)",
  hi: "Hindi (हिन्दी)",
  ja: "Japanese (日本語)",
  ko: "Korean (한국어)",
  zh: "Chinese (简体中文)",
  "zh-tw": "Traditional Chinese (繁體中文)",
  ru: "Russian (Русский)",
  pt: "Portuguese (Português)",
  "pt-br": "Portuguese (Português)",
  it: "Italian (Italiano)",
  pl: "Polish (Polski)",
  tr: "Turkish (Türkçe)",
  uk: "Ukrainian (Українська)",
};

/** Human-readable language name for prompt instructions (e.g. "Vietnamese (Tiếng Việt)"). */
export function languageName(language?: string): string {
  if (!language) return "English";
  const code = language.trim().toLowerCase();
  return LANGUAGE_NAMES[code] ?? LANGUAGE_NAMES[code.split("-")[0]] ?? code;
}
