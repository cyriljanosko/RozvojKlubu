import { linkSegments, type SfzLink } from "@/lib/sfz-links";

/** Plain text with the first mention of each SFZ page linked (Prax fields, decision 22. 10. 2026). */
export function LinkedText({
  text,
  links,
  used,
}: {
  text: string;
  links: readonly SfzLink[];
  /** shared within one step, so that a page is linked once per step */
  used: Set<string>;
}) {
  if (links.length === 0) return <>{text}</>;
  return (
    <>
      {linkSegments(text, links, used).map((s, i) =>
        s.link ? (
          <a
            key={i}
            href={s.link.url}
            target="_blank"
            rel="noopener noreferrer"
            title={s.link.label}
            className="underline underline-offset-4"
          >
            {s.text}
            <span aria-hidden> ↗</span>
          </a>
        ) : (
          <span key={i}>{s.text}</span>
        ),
      )}
    </>
  );
}
