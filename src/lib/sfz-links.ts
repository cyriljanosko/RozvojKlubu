import data from "../../content/odkazy-sfz.json";

/**
 * Links to the SFZ website (decision 22. 10. 2026): where area texts mention a course, a licence or
 * continuing education, the first mention in each section links to the page on futbalsfz.sk; the
 * coach education hub of area 3 uses the same list. Content lives in `content/odkazy-sfz.json`
 * (changed by a PR). A link applies to its own `areas`, otherwise to the file's default `areas`
 * (area 3); SFZ regulations (Predpisy SFZ) apply to area 1 (decision 30. 10. 2026).
 */
export interface SfzLink {
  id: string;
  areas?: number[];
  terms: string[];
  url: string;
  label: string;
}

export const SFZ_LINKS: SfzLink[] = data.links;
export const SFZ_LINK_AREAS: number[] = data.areas;
export const SFZ_HUB: { key: string; links: SfzLink[] }[] = data.hub.map((g) => ({
  key: g.key,
  links: g.links
    .map((id) => SFZ_LINKS.find((l) => l.id === id))
    .filter((l): l is SfzLink => l !== undefined),
}));

/** Pure: links that apply to an area's texts (a link's own areas, else the default areas). */
export const sfzLinksFor = (area: number) =>
  SFZ_LINKS.filter((l) => (l.areas ?? SFZ_LINK_AREAS).includes(area));

export type Segment = { text: string; link?: SfzLink };

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * Pure: splits a text at the first mention of each link not yet `used` (longest term first, whole
 * words only); marks the links it used in `used`, so that a section links every page once.
 */
export function linkSegments(
  text: string,
  links: readonly SfzLink[],
  used: Set<string>,
): Segment[] {
  const terms = links
    .filter((l) => !used.has(l.id))
    .flatMap((l) => l.terms.map((term) => ({ term, link: l })))
    .sort((a, b) => b.term.length - a.term.length);
  if (terms.length === 0 || !text) return [{ text }];
  const pattern = new RegExp(
    `(?<![\\p{L}\\p{N}])(${terms.map((t) => escape(t.term)).join("|")})(?![\\p{L}\\p{N}])`,
    "gu",
  );
  const segments: Segment[] = [];
  let last = 0;
  for (const match of text.matchAll(pattern)) {
    const found = terms.find((t) => t.term === match[1]);
    if (!found || used.has(found.link.id)) continue;
    used.add(found.link.id);
    if (match.index > last) segments.push({ text: text.slice(last, match.index) });
    segments.push({ text: match[1], link: found.link });
    last = match.index + match[1].length;
  }
  if (last < text.length) segments.push({ text: text.slice(last) });
  return segments.length > 0 ? segments : [{ text }];
}

interface MdNode {
  type: string;
  value?: string;
  url?: string;
  children?: MdNode[];
}

/** Nodes whose text is never linked: code, existing links and headings. */
const SKIP = new Set(["code", "inlineCode", "link", "linkReference", "heading", "html"]);

/** Pure: replaces the first mention of each link in a Markdown tree (one section) by a link node. */
export function linkTree(tree: MdNode, links: readonly SfzLink[], used = new Set<string>()): void {
  if (!tree.children) return;
  tree.children = tree.children.flatMap((node) => {
    if (SKIP.has(node.type)) return [node];
    if (node.type === "text" && node.value) {
      return linkSegments(node.value, links, used).map((s) =>
        s.link
          ? { type: "link", url: s.link.url, children: [{ type: "text", value: s.text }] }
          : { type: "text", value: s.text },
      );
    }
    linkTree(node, links, used);
    return [node];
  });
}

/** remark plugin over `linkTree`; no plugin work when the area has no links. */
export function remarkSfzLinks(options: { links: readonly SfzLink[] }) {
  return (tree: MdNode) => {
    if (options.links.length > 0) linkTree(tree, options.links);
  };
}
