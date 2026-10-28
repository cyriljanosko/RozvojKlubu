import Markdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";

import { remarkSfzLinks, type SfzLink } from "@/lib/sfz-links";

/** Renders managed Markdown content (GFM: tables, lists). No raw HTML – it is not enabled. */
const components: Components = {
  h3: (props) => <h3 className="headline mt-6" {...props} />,
  h4: (props) => <h4 className="subheadline mt-5 font-semibold" {...props} />,
  h5: (props) => <h5 className="subheadline mt-4 font-semibold" {...props} />,
  p: (props) => <p className="mt-3" {...props} />,
  ul: (props) => <ul className="mt-3 list-disc space-y-1.5 pl-5" {...props} />,
  ol: (props) => <ol className="mt-3 list-decimal space-y-2 pl-5" {...props} />,
  blockquote: (props) => (
    <blockquote
      className="mt-4 rounded-(--radius-sm) border-l-4 border-(--brand-blue) bg-(--brand-blue-tint) px-4 py-1 [&>p]:mt-2 [&>p:last-child]:mb-2"
      {...props}
    />
  ),
  table: (props) => (
    <div className="mt-4 overflow-x-auto rounded-(--radius-sm) bg-(--surface)">
      <table className="footnote w-full min-w-[32rem] border-collapse text-left" {...props} />
    </div>
  ),
  th: (props) => <th className="border-b border-(--hairline) px-3 py-2 font-semibold" {...props} />,
  td: (props) => <td className="border-b border-(--hairline) px-3 py-2 align-top" {...props} />,
  pre: (props) => (
    <pre
      className="footnote mt-3 overflow-x-auto rounded-(--radius-sm) bg-(--surface) p-3 whitespace-pre-wrap"
      {...props}
    />
  ),
  a: ({ href, children, ...props }) => (
    <a href={href} target="_blank" rel="noopener noreferrer" {...props}>
      {children}
      {/* links out of the Academy (SFZ web) are marked */}
      {href?.startsWith("http") && <span aria-hidden> ↗</span>}
    </a>
  ),
};

export function MarkdownContent({
  children,
  links = [],
}: {
  children: string;
  /** SFZ pages to link at their first mention in this text (area 3 for now) */
  links?: readonly SfzLink[];
}) {
  return (
    <div className="callout break-words">
      <Markdown remarkPlugins={[remarkGfm, [remarkSfzLinks, { links }]]} components={components}>
        {children}
      </Markdown>
    </div>
  );
}
