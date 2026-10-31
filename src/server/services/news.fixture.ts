import type { ContentRevisionDoc } from "@/server/db/types";

import type { NewsScope, NewsStore, StoredNews } from "./news.service";

/** In-memory NewsStore with the same scope and version semantics as the Mongo store. */
export function memoryNewsStore(): NewsStore & { posts: StoredNews[] } {
  const posts: StoredNews[] = [];
  let seq = 0;
  const inScope = (scope: NewsScope, p: StoredNews) =>
    p.clubId === null ? scope.academy : scope.clubIds.includes(p.clubId);
  const published = (p: StoredNews) => p.status === "published";
  const newest = (a: StoredNews, b: StoredNews) =>
    (b.publishedAt?.getTime() ?? 0) - (a.publishedAt?.getTime() ?? 0);
  return {
    posts,
    insertPost: async (doc) => {
      const stored = { ...structuredClone(doc), id: `n${++seq}` };
      posts.push(stored);
      return structuredClone(stored);
    },
    findPost: async (scope, id) => {
      const p = posts.find((x) => x.id === id && inScope(scope, x));
      return p ? structuredClone(p) : null;
    },
    listPosts: async (scope, status) =>
      structuredClone(posts.filter((p) => inScope(scope, p) && (!status || p.status === status))),
    updatePost: async (scope, id, expectedVersion, changes) => {
      const p = posts.find((x) => x.id === id && inScope(scope, x));
      if (!p || p.version !== expectedVersion) return null;
      Object.assign(p, structuredClone(changes), { version: p.version + 1 });
      return structuredClone(p);
    },
    findPublishedBySlug: async (slug) => {
      const p = posts.find((x) => published(x) && x.slug === slug);
      return p ? structuredClone(p) : null;
    },
    listPublished: async ({ kind, area, before, limit, excludeIds = [] }) =>
      structuredClone(
        posts
          .filter(
            (p) =>
              published(p) &&
              (!kind || p.kind === kind) &&
              (!area || p.areas.includes(area)) &&
              (!before || (p.publishedAt !== null && p.publishedAt < before)) &&
              !excludeIds.includes(p.id),
          )
          .sort(newest)
          .slice(0, limit),
      ),
    findPinned: async () => {
      const p = posts.find((x) => published(x) && x.pinned);
      return p ? structuredClone(p) : null;
    },
    clearPinned: async () => {
      for (const p of posts) p.pinned = false;
    },
    slugExists: async (slug) => posts.some((p) => p.slug === slug),
    incrementViews: async (id) => {
      const p = posts.find((x) => x.id === id);
      if (p) p.views += 1;
    },
  };
}

export function memoryRevisions(): {
  addRevision: (r: Omit<ContentRevisionDoc, "_id">) => Promise<void>;
  docs: Omit<ContentRevisionDoc, "_id">[];
} {
  const docs: Omit<ContentRevisionDoc, "_id">[] = [];
  return { docs, addRevision: async (r) => void docs.push(structuredClone(r)) };
}
