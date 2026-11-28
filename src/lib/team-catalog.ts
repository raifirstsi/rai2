// The community templates catalog (/api/team-library/catalog). Its names and
// summaries come in English; the built-in teams show in the app's language.
import { activeLocale, tFromServer } from "./i18n";
import { localizeTeamDescription, localizeTeamName } from "../../shared/team-templates-localization";

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
  const baseName = id ? (tFromServer(`templates.catalog.${id}.name`, entry.name) ?? entry.name) : entry.name;
  const baseSummary = id ? (tFromServer(`templates.catalog.${id}.summary`, entry.summary) ?? entry.summary) : entry.summary;
  const name = localizeTeamName(baseName, activeLocale());
  const summary = localizeTeamDescription(entry.slug || entry.name, baseSummary, activeLocale());
  const outcome = entry.outcome
    ? (id ? tFromServer(`templates.catalog.${id}.outcome`, entry.outcome) : entry.outcome)
    : undefined;
  return { ...entry, name, summary, outcome };
}

/** Search matches a team by its localized name and summary as well as its English ones, its category, skills and apps. */
export function catalogMatches(entry: TeamCatalogEntry, search: string): boolean {
  const copy = catalogCopy(entry);
  return `${copy.name} ${copy.summary} ${entry.name} ${entry.summary} ${entry.category} ${entry.skills.join(" ")} ${entry.requires.apps.join(" ")}`
    .toLowerCase()
    .includes(search);
}
