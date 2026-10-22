import Markdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";

import { remarkSfzLinks, type SfzLink } from "@/lib/sfz-links";

/** Renders managed Markdown content (GFM: tables, lists). No raw HTML – it is not enabled. */
const components: Components = {
  h3: (props) => <h3 className="mt-6 text-base font-semibold" {...props} />,
  h4: (props) => <h4 className="mt-5 text-sm font-semibold" {...props} />,
  h5: (props) => <h5 className="mt-4 text-sm font-semibold" {...props} />,
  p: (props) => <p className="mt-3 leading-relaxed" {...props} />,
  ul: (props) => <ul className="mt-3 list-disc space-y-1.5 pl-5" {...props} />,
  ol: (props) => <ol className="mt-3 list-decimal space-y-2 pl-5" {...props} />,
  blockquote: (props) => (
    <blockquote
      className="bg-muted/50 mt-4 rounded-md border-l-4 px-4 py-1 [&>p]:mt-2 [&>p:last-child]:mb-2"
      {...props}
    />
  ),
  table: (props) => (
    <div className="mt-4 overflow-x-auto rounded-md border">
      <table className="w-full min-w-[32rem] border-collapse text-left text-xs" {...props} />
    </div>
  ),
  th: (props) => <th className="bg-muted/50 border-b px-2 py-1.5 font-semibold" {...props} />,
  td: (props) => <td className="border-b px-2 py-1.5 align-top" {...props} />,
  pre: (props) => (
    <pre
      className="bg-muted/50 mt-3 overflow-x-auto rounded-md p-3 text-xs whitespace-pre-wrap"
      {...props}
    />
  ),
  a: ({ href, children, ...props }) => (
    <a
      href={href}
      className="underline underline-offset-4"
      target="_blank"
      rel="noopener noreferrer"
      {...props}
    >
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
    <div className="text-sm break-words">
      <Markdown remarkPlugins={[remarkGfm, [remarkSfzLinks, { links }]]} components={components}>
        {children}
      </Markdown>
    </div>
  );
}
