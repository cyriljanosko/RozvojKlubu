import { describe, expect, it } from "vitest";

import { SFZ_HUB, SFZ_LINKS, linkSegments, linkTree, sfzLinksFor } from "./sfz-links";

const link = (id: string) => SFZ_LINKS.find((l) => l.id === id)!;

describe("SFZ links", () => {
  it("applies coach links to area 3, regulations to area 1 and every hub link exists", () => {
    expect(sfzLinksFor(3).length).toBeGreaterThan(10);
    expect(sfzLinksFor(3).some((l) => l.id === "statutes")).toBe(false);
    expect(sfzLinksFor(1).map((l) => l.id)).toContain("statutes");
    expect(sfzLinksFor(1).some((l) => l.id === "uefa-c")).toBe(false);
    expect(sfzLinksFor(5)).toEqual([]);
    expect(SFZ_HUB.flatMap((g) => g.links).every((l) => l.url.startsWith("https://"))).toBe(true);
    expect(SFZ_LINKS.every((l) => l.url.startsWith("https://"))).toBe(true);
  });

  it("links the first mention of each page, longest term first, whole words only", () => {
    const used = new Set<string>();
    const segments = linkSegments(
      "Seminár SFZ Grassroots Leader — kontinuálne vzdelávanie aj SFZ Grassroots Leader; UEFA C, UEFA Grassroots C a znova UEFA C.",
      SFZ_LINKS,
      used,
    );
    const linked = segments.filter((s) => s.link).map((s) => [s.text, s.link!.id]);
    expect(linked).toEqual([
      ["SFZ Grassroots Leader — kontinuálne vzdelávanie", "grassroots-leader-kv"],
      ["SFZ Grassroots Leader", "grassroots-leader"],
      ["UEFA C", "uefa-c"],
    ]);
    expect(segments.map((s) => s.text).join("")).toContain("UEFA Grassroots C a znova UEFA C.");
    // a word that only contains a term is not linked
    expect(linkSegments("ISSFX a XPSka", SFZ_LINKS, new Set()).some((s) => s.link)).toBe(false);
  });

  it("links text in a Markdown tree but never in code, existing links or headings", () => {
    const tree = {
      type: "root",
      children: [
        { type: "heading", children: [{ type: "text", value: "UEFA B" }] },
        {
          type: "paragraph",
          children: [
            { type: "text", value: "Prihláška cez SFZ Ticketing a " },
            { type: "link", url: "x", children: [{ type: "text", value: "ISSF" }] },
            { type: "text", value: " a ISSF konto; UEFA B." },
          ],
        },
        { type: "code", value: "SFZ Ticketing" },
      ],
    };
    linkTree(tree, SFZ_LINKS);
    const paragraph = tree.children[1].children!;
    const urls = paragraph.filter((n) => n.type === "link").map((n) => n.url);
    expect(urls).toEqual([link("ticketing").url, "x", link("issf").url, link("uefa-b").url]);
    expect(tree.children[0].children).toEqual([{ type: "text", value: "UEFA B" }]);
    expect(tree.children[2]).toEqual({ type: "code", value: "SFZ Ticketing" });
  });

  it("links regulations in area 1 texts to their category pages", () => {
    const segments = linkSegments(
      "Dokument musí byť v súlade so stanovami SFZ; pozri aj Smernicu o právno-organizačných zmenách v kluboch.",
      sfzLinksFor(1),
      new Set<string>(),
    );
    const linked = segments.filter((s) => s.link).map((s) => [s.text, s.link!.url]);
    expect(linked).toEqual([
      ["stanovami SFZ", "https://futbalsfz.sk/legislativa-predpisy-sfz-stanovy/"],
      [
        "Smernicu o právno-organizačných zmenách v kluboch",
        "https://futbalsfz.sk/legislativa-predpisy-sfz-smernice/",
      ],
    ]);
  });
});
