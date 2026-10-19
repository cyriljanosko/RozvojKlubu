import type { ClubDeps } from "@/server/services/clubs.service";
import { listPublicClubs } from "@/server/services/clubs.service";
import type { ContentStore } from "@/server/services/content.service";
import { mentorPracticeRoles, seesMentor } from "@/server/services/hub.service";
import type { SectionStore } from "@/server/services/methodology.service";
import type { PracticeContent } from "@/server/services/practice.schema";
import { getPractice, type PracticeStore } from "@/server/services/practice.service";
import { getRoleCatalog, type RoleCatalogStore } from "@/server/services/role-catalog.service";
import { currentSeason } from "@/server/services/season";
import type { CurrentUser } from "@/server/services/users.service";

/**
 * Search over the public content (H6, decision 17. 10. 2026): areas, Metodika, Prax with its
 * templates and clubs (Vizitka); Kompas questions are left out. Slovak without diacritics and
 * with a rough stem for inflection. The content is small (hundreds of texts), so it is searched
 * in memory on the server; Atlas Search can come later if it grows.
 */
export interface SearchDeps extends Pick<ClubDeps, "clubs" | "memberships" | "now"> {
  content: Pick<ContentStore, "listAreas">;
  sections: Pick<SectionStore, "listSections">;
  practice: Pick<PracticeStore, "findPractice" | "listPracticeAreas">;
  roleCatalog: Pick<RoleCatalogStore, "findCatalog">;
}

export type SearchKind = "area" | "section" | "practice" | "template" | "club";

export interface SearchHit {
  kind: SearchKind;
  title: string;
  /** area number and name for content inside an area */
  area: { number: number; name: string } | null;
  snippet: string;
  href: string;
  score: number;
}

export interface SearchDoc {
  kind: SearchKind;
  title: string;
  body: string;
  area: { number: number; name: string } | null;
  href: string;
}

/** Pure: lower case without diacritics, Markdown and punctuation as spaces. */
export function normalize(text: string): string {
  return text
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Pure: a rough Slovak stem – drops up to two ending letters of longer words ("trénerov" → "trener"). */
export function stem(word: string): string {
  return word.length > 5 ? word.slice(0, Math.max(4, word.length - 2)) : word;
}

/** Pure: query terms (normalized, stemmed, at least 2 letters, at most 8). */
export function queryTerms(query: string): string[] {
  return [...new Set(normalize(query).split(" "))]
    .filter((w) => w.length >= 2)
    .slice(0, 8)
    .map(stem);
}

const words = (text: string) => normalize(text).split(" ");

const hits = (text: string[], term: string) => text.filter((w) => w.startsWith(term)).length;

/** Pure: score of a document; 0 when a term is missing (all terms must match). */
export function scoreDoc(doc: Pick<SearchDoc, "title" | "body">, terms: string[]): number {
  if (terms.length === 0) return 0;
  const title = words(doc.title);
  const body = words(doc.body);
  let score = 0;
  for (const term of terms) {
    const t = hits(title, term);
    const b = hits(body, term);
    if (t + b === 0) return 0;
    score += t * 5 + Math.min(b, 5);
  }
  return score;
}

/** Pure: a short excerpt of the plain text around the first matching word. */
export function snippet(body: string, terms: string[], size = 160): string {
  const plain = body
    .replace(/[#>*_`|[\]()-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const tokens = plain.split(" ");
  const index = tokens.findIndex((w) => terms.some((t) => normalize(w).startsWith(t)));
  const start = Math.max(0, index - 8);
  let out = "";
  for (let i = start; i < tokens.length && out.length < size; i++) out += `${tokens[i]} `;
  out = out.trim();
  return `${start > 0 ? "… " : ""}${out}${out.length < plain.length - start ? " …" : ""}`;
}

/** Pure: documents of one area's Prax (steps, first step, templates), mentor parts optional. */
export function practiceDocs(
  area: { number: number; name: string },
  content: PracticeContent,
  hiddenRoles: readonly string[],
): SearchDoc[] {
  const base = `/oblasti/${area.number}?tab=prax`;
  const roles = content.roles.filter((r) => !hiddenRoles.includes(r.id));
  const docs: SearchDoc[] = [];
  for (const r of roles) {
    docs.push({
      kind: "practice",
      title: `${r.firstStep.title} (${r.label})`,
      body: [r.does, r.firstStep.result, ...r.firstStep.tasks.map((t) => t.title)].join(" "),
      area,
      href: `${base}&role=${r.id}#first-step`,
    });
    for (const s of r.steps) {
      docs.push({
        kind: "practice",
        title: `${s.title} (${r.label})`,
        body: [s.why, ...s.options.flatMap((o) => [o.name, o.what, o.result])].join(" "),
        area,
        href: `${base}&role=${r.id}#step-${s.id}`,
      });
    }
  }
  for (const tpl of content.templates) {
    const owner = roles.find((r) => r.library.includes(tpl.key));
    if (!owner) continue;
    docs.push({
      kind: "template",
      title: tpl.title,
      body: `${tpl.description} ${tpl.text ?? ""}`,
      area,
      href: `${base}&role=${owner.id}&open=tpl-${tpl.key}#tpl-${tpl.key}`,
    });
  }
  return docs;
}

/** Pure: ranks documents, drops non-matching ones; falls back to any-term match when none match all. */
export function rank(docs: readonly SearchDoc[], query: string, limit = 30): SearchHit[] {
  const terms = queryTerms(query);
  if (terms.length === 0) return [];
  // an area whose name matches is the best entry point, so it outranks its own sections
  const weight = (doc: SearchDoc) => (doc.kind === "area" ? 3 : 1);
  const score = (doc: SearchDoc) => scoreDoc(doc, terms) * weight(doc);
  let scored = docs.map((d) => ({ d, s: score(d) })).filter((x) => x.s > 0);
  if (scored.length === 0 && terms.length > 1) {
    scored = docs
      .map((d) => ({ d, s: Math.max(...terms.map((t) => scoreDoc(d, [t]))) * weight(d) }))
      .filter((x) => x.s > 0);
  }
  return scored
    .sort((a, b) => b.s - a.s || a.d.title.localeCompare(b.d.title, "sk"))
    .slice(0, limit)
    .map(({ d, s }) => ({
      kind: d.kind,
      title: d.title,
      area: d.area,
      snippet: d.kind === "club" ? d.body : snippet(d.body, terms),
      href: d.href,
      score: s,
    }));
}

export async function search(
  deps: SearchDeps,
  actor: CurrentUser | null,
  query: string,
): Promise<{ query: string; hits: SearchHit[] }> {
  const q = query.trim().slice(0, 100);
  if (queryTerms(q).length === 0) return { query: q, hits: [] };
  const season = currentSeason(deps.now?.() ?? new Date());
  const memberships = actor ? await deps.memberships.listByUser(actor.id) : [];
  const mentorOk = seesMentor(actor, memberships, season);
  const [areas, catalog, practiceAreas, clubs] = await Promise.all([
    deps.content.listAreas(),
    getRoleCatalog(deps.roleCatalog, actor),
    deps.practice.listPracticeAreas(),
    listPublicClubs(deps),
  ]);
  const docs: SearchDoc[] = [];
  for (const a of areas.sort((x, y) => x.number - y.number)) {
    const area = { number: a.number, name: a.name };
    docs.push({
      kind: "area",
      title: a.name,
      body: `${a.shortName} ${a.description}`,
      area: null,
      href: `/oblasti/${a.number}`,
    });
    for (const s of await deps.sections.listSections(a.number, "methodology")) {
      docs.push({
        kind: "section",
        title: s.title,
        body: s.body,
        area,
        href: `/oblasti/${a.number}?open=${encodeURIComponent(s.key)}#${s.key}`,
      });
    }
    if (practiceAreas.includes(a.number)) {
      const practice = await getPractice(deps.practice, actor, a.number);
      if (practice) {
        const hidden = catalog && !mentorOk ? mentorPracticeRoles(catalog.content, a.number) : [];
        docs.push(...practiceDocs(area, practice.content, hidden));
      }
    }
  }
  for (const c of clubs) {
    docs.push({
      kind: "club",
      title: c.name,
      body: [c.union, c.region].filter(Boolean).join(" · "),
      area: null,
      href: `/vizitka/${encodeURIComponent(c.clubId)}`,
    });
  }
  return { query: q, hits: rank(docs, q) };
}
