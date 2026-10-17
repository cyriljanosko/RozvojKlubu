import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { beforeAll, describe, expect, it } from "vitest";

import { A, admin, alice, memoryDeps } from "./clubs.fixture";
import {
  memoryContentStore,
  memoryPracticeStore,
  memoryRoleCatalogStore,
  memorySectionStore,
} from "./content.fixture";
import { seedContent } from "./content.service";
import { parseMethodologyFile } from "./methodology-file";
import { seedMethodology } from "./methodology.service";
import { seedPractice } from "./practice.service";
import { seedRoleCatalog } from "./role-catalog.service";
import {
  normalize,
  queryTerms,
  rank,
  scoreDoc,
  search,
  snippet,
  stem,
  type SearchDeps,
} from "./search.service";
import type { CurrentUser } from "./users.service";

const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8");
const mona: CurrentUser = { id: "mona", email: "mona@obfz.sk", name: "Mona", role: "public" };

describe("search – Slovak matching", () => {
  it("ignores diacritics and case, stems longer words", () => {
    expect(normalize("Dotácie a 2 % z DANE!")).toBe("dotacie a 2 z dane");
    expect(stem("trenerov")).toBe("trener");
    expect(stem("dotacia")).toBe("dotac");
    expect(stem("klub")).toBe("klub");
    expect(queryTerms("Licencia trénera")).toEqual(["licenc", "trene"]);
    expect(queryTerms("a")).toEqual([]);
  });

  it("needs every term, prefers the title, falls back to any term", () => {
    const docs = [
      {
        kind: "section" as const,
        title: "Licencie trénerov",
        body: "Kto potrebuje licenciu.",
        area: null,
        href: "/a",
      },
      {
        kind: "section" as const,
        title: "Nábor",
        body: "Tréner hľadá deti.",
        area: null,
        href: "/b",
      },
    ];
    expect(scoreDoc(docs[0], queryTerms("licencia trénera"))).toBeGreaterThan(0);
    expect(scoreDoc(docs[1], queryTerms("licencia trénera"))).toBe(0);
    expect(rank(docs, "trénera").map((h) => h.href)).toEqual(["/a", "/b"]);
    expect(rank(docs, "nábor licencia").length).toBe(2); // no doc has both – any term
    expect(rank(docs, "")).toEqual([]);
  });

  it("cuts a snippet around the first match", () => {
    const text = `${"slovo ".repeat(30)}**dotácia** z obce a ${"ďalej ".repeat(40)}`;
    const s = snippet(text, queryTerms("dotácia"));
    expect(s.startsWith("… ")).toBe(true);
    expect(s).toContain("dotácia z obce");
    expect(s.endsWith(" …")).toBe(true);
  });
});

describe("search – content", () => {
  let deps: SearchDeps;
  beforeAll(async () => {
    const content = memoryContentStore();
    await seedContent(content, admin);
    const sections = memorySectionStore(memoryContentStore());
    const files = readdirSync(join(process.cwd(), "content/metodika"))
      .filter((f) => f.endsWith(".md"))
      .map((f) => parseMethodologyFile(read(`content/metodika/${f}`)));
    await seedMethodology(sections, admin, files);
    const practice = memoryPracticeStore(memoryContentStore());
    await seedPractice(practice, admin, [JSON.parse(read("content/prax/03.json"))]);
    const roleCatalog = memoryRoleCatalogStore(memoryContentStore());
    await seedRoleCatalog(roleCatalog, admin, JSON.parse(read("content/roly.json")));
    const base = memoryDeps();
    base.memberDocs.push({
      id: "m1",
      userId: mona.id,
      clubId: A,
      role: "mentor",
      season: "2026/2027",
      ageGroups: [],
      createdBy: admin.id,
      createdAt: new Date(),
    });
    deps = { ...base, content, sections, practice, roleCatalog };
  });

  it("finds areas, Metodika, Prax and clubs without diacritics", async () => {
    const { hits } = await search(deps, null, "licencia trenera");
    expect(hits.length).toBeGreaterThan(0);
    expect(hits.some((h) => h.kind === "section" && h.area?.number === 3)).toBe(true);
    expect(hits.find((h) => h.kind === "section")?.href).toMatch(/^\/oblasti\/3\?open=/);
    expect((await search(deps, null, "dobrovolnici")).hits[0]).toMatchObject({ kind: "area" });
    expect((await search(deps, null, "TJ Test")).hits[0]).toMatchObject({
      kind: "club",
      href: `/vizitka/${encodeURIComponent(A)}`,
    });
    expect((await search(deps, null, " ")).hits).toEqual([]);
  });

  it("shows the mentor's Prax only to mentors and admin_sfz", async () => {
    const mentorHits = (u: CurrentUser | null) =>
      search(deps, u, "mentor").then((r) => r.hits.filter((h) => h.href.includes("role=m")));
    expect(await mentorHits(null)).toEqual([]);
    expect(await mentorHits(alice)).toEqual([]);
    expect((await mentorHits(mona)).length).toBeGreaterThan(0);
    expect((await mentorHits(admin)).length).toBeGreaterThan(0);
  });
});
