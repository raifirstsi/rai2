// The community templates catalog (/api/team-library/catalog). Its names and
// summaries come in English; the built-in teams show in the app's language.
import { activeLocale, t } from "./i18n";
import { localizeTeamDescription, localizeTeamName } from "../../shared/team-templates-localization";
import type { LocaleKey } from "@/locales";

export interface TeamCatalogEntry {
  slug: string;
  name: string;
  summary: string;
  category: string;
  outcome?: string;
  setupMinutes?: number;
  featured?: boolean;
  package?: string;
  manifest: string;
  readme: string;
  members: number;
  skills: string[];
  requires: { apps: string[] };
}

export interface TeamCatalog {
  repositoryUrl: string;
  teams: TeamCatalogEntry[];
}

const CATALOG_COPY: Record<string, string> = {
  "seo growth team": "seoGrowth",
  "engineering team": "engineering",
  "100x marketing team": "marketing100x",
  "reddit lead miner": "redditLeadMiner",
  "competitor watch": "competitorWatch",
  "inbox follow-up": "inboxFollowup",
};

export function catalogCopy(entry: TeamCatalogEntry): TeamCatalogEntry {
  const id = CATALOG_COPY[entry.name.trim().toLowerCase()];
  const baseName = id ? t(`templates.catalog.${id}.name` as LocaleKey) : entry.name;
  const baseSummary = id ? t(`templates.catalog.${id}.summary` as LocaleKey) : entry.summary;
  const name = localizeTeamName(baseName, activeLocale());
  const summary = localizeTeamDescription(entry.slug || entry.name, baseSummary, activeLocale());
  return { ...entry, name, summary, outcome: entry.outcome ? t(`templates.catalog.${id}.outcome` as LocaleKey) : undefined };
}

/** Search matches a team by its localized name and summary as well as its English ones, its category, skills and apps. */
export function catalogMatches(entry: TeamCatalogEntry, search: string): boolean {
  const copy = catalogCopy(entry);
  return `${copy.name} ${copy.summary} ${entry.name} ${entry.summary} ${entry.category} ${entry.skills.join(" ")} ${entry.requires.apps.join(" ")}`
    .toLowerCase()
    .includes(search);
}
