/** A piece of a news paragraph: plain text or a link. */
export type TextPart = { text: string } | { text: string; href: string };

// [label](https://…) or a bare http(s) address; trailing punctuation is not part of a bare address
const LINK = /\[([^\]\n]+)\]\((https?:\/\/[^\s)]+)\)|(https?:\/\/[^\s<]+[^\s<.,;:!?)"'»“])/g;

/** Pure: splits a line of a post into text and links (only http and https addresses). */
export function splitLinks(line: string): TextPart[] {
  const parts: TextPart[] = [];
  let last = 0;
  for (const m of line.matchAll(LINK)) {
    const at = m.index ?? 0;
    if (at > last) parts.push({ text: line.slice(last, at) });
    parts.push(m[1] ? { text: m[1], href: m[2] } : { text: m[3], href: m[3] });
    last = at + m[0].length;
  }
  if (last < line.length) parts.push({ text: line.slice(last) });
  return parts;
}
