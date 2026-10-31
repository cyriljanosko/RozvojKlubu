import { z } from "zod";

import { ApiError } from "@/server/api/errors";
import {
  NEWS_KINDS,
  NEWS_STATUSES,
  type NewsKind,
  type NewsPostDoc,
  type NewsSectionKey,
  type NewsStatus,
} from "@/server/db/types";
import { clubRolesFor, isAdmin, requireAdmin } from "@/server/services/club-access";
import type { ClubDeps } from "@/server/services/clubs.service";
import type { ContentStore } from "@/server/services/content.service";
import { normalize } from "@/server/services/search.service";
import { currentSeason } from "@/server/services/season";
import { requireUser, type CurrentUser } from "@/server/services/users.service";

/**
 * Novinky (ADR 0023): stories and tips proposed by club management and approved by SFZ, and
 * academy news written by SFZ. Published posts are public content; unpublished club posts are club
 * data – every query outside the published ones names the clubs explicitly (ADR 0003).
 * - club management writes, submits and confirms SFZ edits of its club's posts;
 * - the club's mentor reads them; coaches have no access;
 * - admin_sfz writes academy news, edits, returns, publishes, pins, hides and shares club posts.
 * Photos and documents arrive with the file storage (ADR 0022) – the fields stay empty for now.
 */
export type StoredNews = Omit<NewsPostDoc, "_id"> & { id: string };

/** Which posts a query may touch: explicit club ids and/or academy posts (clubId null). */
export interface NewsScope {
  clubIds: readonly string[];
  academy: boolean;
}

export interface PublishedQuery {
  kind?: NewsKind;
  area?: number;
  /** only posts published strictly before this moment (paging) */
  before?: Date;
  limit: number;
  excludeIds?: readonly string[];
}

export interface NewsStore {
  insertPost: (doc: Omit<NewsPostDoc, "_id">) => Promise<StoredNews>;
  findPost: (scope: NewsScope, id: string) => Promise<StoredNews | null>;
  listPosts: (scope: NewsScope, status?: NewsStatus) => Promise<StoredNews[]>;
  /** Atomic update guarded by `expectedVersion` (increments it); null on a conflict. */
  updatePost: (
    scope: NewsScope,
    id: string,
    expectedVersion: number,
    changes: Partial<
      Omit<NewsPostDoc, "_id" | "kind" | "clubId" | "version" | "createdAt" | "createdBy">
    >,
  ) => Promise<StoredNews | null>;
  // published posts are public content (no tenant filter)
  findPublishedBySlug: (slug: string) => Promise<StoredNews | null>;
  listPublished: (query: PublishedQuery) => Promise<StoredNews[]>;
  findPinned: () => Promise<StoredNews | null>;
  /** unpins every published post (one pinned post at a time) */
  clearPinned: () => Promise<void>;
  slugExists: (slug: string) => Promise<boolean>;
  incrementViews: (id: string) => Promise<void>;
}

export interface NewsDeps extends ClubDeps {
  news: NewsStore;
  revisions: Pick<ContentStore, "addRevision">;
}

// ---- input ----

const CLUB_SECTION_KEYS = ["start", "done", "result", "advice"] as const;

const sectionSchema = z.object({
  key: z.enum(["start", "done", "result", "advice", "body"]),
  text: z.string().trim().max(20_000),
});

const contentShape = {
  title: z.string().trim().max(140),
  areas: z
    .array(z.number().int().min(1).max(11))
    .max(3)
    .refine((a) => new Set(a).size === a.length, "Duplicate area"),
  sections: z.array(sectionSchema).max(5),
};

export const clubNewsCreateSchema = z.object({
  kind: z.enum(["story", "tip"]),
  ...contentShape,
});
export const academyNewsCreateSchema = z.object(contentShape);
export const newsUpdateSchema = z.object({
  ...contentShape,
  expectedVersion: z.number().int().min(1),
});
const versionSchema = z.object({ expectedVersion: z.number().int().min(1) });
export const newsSubmitSchema = versionSchema.extend({
  consents: z.object({
    publication: z.literal(true),
    photoPeople: z.boolean(),
    external: z.boolean(),
  }),
});
export const newsReturnSchema = versionSchema.extend({ note: z.string().trim().min(3).max(2000) });
export const newsPinSchema = versionSchema.extend({ pinned: z.boolean() });
export const newsExternalUrlSchema = versionSchema.extend({
  url: z
    .string()
    .trim()
    .url()
    .refine((u) => {
      const { protocol, hostname } = new URL(u);
      return protocol === "https:" && /(^|\.)futbalsfz\.sk$/.test(hostname);
    }, "Only articles on futbalsfz.sk")
    .nullable(),
});
export const publishedQuerySchema = z.object({
  kind: z.enum(NEWS_KINDS).optional(),
  area: z.coerce.number().int().min(1).max(11).optional(),
  before: z.coerce.date().optional(),
  limit: z.coerce.number().int().min(1).max(50).default(12),
});
export const adminListQuerySchema = z.object({ status: z.enum(NEWS_STATUSES).optional() });

// ---- pure helpers ----

/** Pure: sections allowed for the kind, in their fixed order, without empty duplicates. */
export function cleanSections(
  kind: NewsKind,
  sections: readonly { key: NewsSectionKey; text: string }[],
): { key: NewsSectionKey; text: string }[] {
  const keys: readonly NewsSectionKey[] = kind === "academy" ? ["body"] : CLUB_SECTION_KEYS;
  return keys.map((key) => ({ key, text: sections.find((s) => s.key === key)?.text ?? "" }));
}

/** Pure: what is missing before the post can be submitted or published (empty = complete). */
export function missingParts(post: Pick<StoredNews, "kind" | "title" | "sections">): string[] {
  const missing: string[] = [];
  if (post.title.trim().length < 5) missing.push("title");
  for (const s of cleanSections(post.kind, post.sections)) {
    if (!s.text.trim()) missing.push(s.key);
  }
  return missing;
}

/** Pure: the first sentence of the first part, at most 200 characters. */
export function excerptOf(post: Pick<StoredNews, "kind" | "sections">): string {
  const text = (cleanSections(post.kind, post.sections)[0]?.text ?? "").replace(/\s+/g, " ").trim();
  const sentence = text.match(/^.+?[.!?](?=\s|$)/)?.[0] ?? text;
  return sentence.length > 200 ? `${sentence.slice(0, 199).trimEnd()}…` : sentence;
}

/** Pure: URL slug from the title – lower case, no diacritics, at most 80 characters. */
export function slugify(title: string): string {
  const slug = normalize(title).replace(/ /g, "-").slice(0, 80).replace(/-+$/, "");
  return slug || "novinka";
}

/** Pure: SFZ changed the club's text after the club last submitted it. */
export const awaitsClubConfirmation = (p: Pick<StoredNews, "sfzEditedAt" | "submittedAt">) =>
  p.sfzEditedAt !== null && (p.submittedAt === null || p.sfzEditedAt > p.submittedAt);

// ---- views (API boundary: string ids, ISO dates, no user ids) ----

export interface NewsListItem {
  id: string;
  slug: string;
  kind: NewsKind;
  title: string;
  excerpt: string;
  areas: number[];
  club: { clubId: string; name: string } | null;
  publishedAt: string;
  pinned: boolean;
  externalUrl: string | null;
}

export interface NewsDetail extends NewsListItem {
  sections: { key: NewsSectionKey; text: string }[];
  /** SFZ edited a club post (shown as "Pripravil klub, upravila redakcia SFZ") */
  editedBySfz: boolean;
  related: NewsListItem[];
}

export interface NewsPage {
  pinned: NewsListItem | null;
  items: NewsListItem[];
  /** pass as `before` for the next page; null = no more */
  nextBefore: string | null;
}

export interface ClubNewsItem {
  id: string;
  kind: NewsKind;
  title: string;
  status: NewsStatus;
  areas: number[];
  sections: { key: NewsSectionKey; text: string }[];
  reviewNote: string | null;
  /** SFZ edited the text – the club confirms it by submitting again */
  awaitsConfirmation: boolean;
  consents: { publication: boolean; photoPeople: boolean; external: boolean };
  slug: string | null;
  submittedAt: string | null;
  publishedAt: string | null;
  updatedAt: string;
  version: number;
}

export interface ClubNewsList {
  clubId: string;
  /** club management may write and submit */
  canEdit: boolean;
  items: ClubNewsItem[];
}

export interface AdminNewsItem extends ClubNewsItem {
  club: { clubId: string; name: string } | null;
  pinned: boolean;
  externalUrl: string | null;
  commsSharedAt: string | null;
  views: number;
  missing: string[];
}

const iso = (d: Date | null) => (d ? d.toISOString() : null);

type ClubNames = Map<string, string>;

async function clubNames(deps: NewsDeps, posts: readonly StoredNews[]): Promise<ClubNames> {
  const ids = [...new Set(posts.map((p) => p.clubId).filter((id): id is string => id !== null))];
  if (ids.length === 0) return new Map();
  return new Map((await deps.clubs.listClubs(ids)).map((c) => [c.clubId, c.name]));
}

const clubOf = (p: StoredNews, names: ClubNames) =>
  p.clubId ? { clubId: p.clubId, name: names.get(p.clubId) ?? p.clubId } : null;

function listItem(p: StoredNews, names: ClubNames): NewsListItem {
  return {
    id: p.id,
    slug: p.slug ?? p.id,
    kind: p.kind,
    title: p.title,
    excerpt: excerptOf(p),
    areas: p.areas,
    club: clubOf(p, names),
    publishedAt: iso(p.publishedAt) ?? "",
    pinned: p.pinned,
    externalUrl: p.externalUrl,
  };
}

function clubItem(p: StoredNews): ClubNewsItem {
  return {
    id: p.id,
    kind: p.kind,
    title: p.title,
    status: p.status,
    areas: p.areas,
    sections: cleanSections(p.kind, p.sections),
    reviewNote: p.reviewNote,
    awaitsConfirmation: awaitsClubConfirmation(p),
    consents: {
      publication: p.consents.publication !== null,
      photoPeople: p.consents.photoPeople !== null,
      external: p.consents.external !== null,
    },
    slug: p.slug,
    submittedAt: iso(p.submittedAt),
    publishedAt: iso(p.publishedAt),
    updatedAt: p.updatedAt.toISOString(),
    version: p.version,
  };
}

function adminItem(p: StoredNews, names: ClubNames): AdminNewsItem {
  return {
    ...clubItem(p),
    club: clubOf(p, names),
    pinned: p.pinned,
    externalUrl: p.externalUrl,
    commsSharedAt: iso(p.commsSharedAt),
    views: p.views,
    missing: missingParts(p),
  };
}

// ---- public ----

/** Published posts, newest first; the pinned post comes separately on the first page. */
export async function listPublishedNews(deps: NewsDeps, input: unknown): Promise<NewsPage> {
  const q = publishedQuerySchema.parse(input ?? {});
  const pinnedDoc = q.before ? null : await deps.news.findPinned();
  const pinned =
    pinnedDoc &&
    (!q.kind || pinnedDoc.kind === q.kind) &&
    (!q.area || pinnedDoc.areas.includes(q.area))
      ? pinnedDoc
      : null;
  const posts = await deps.news.listPublished({
    kind: q.kind,
    area: q.area,
    before: q.before,
    limit: q.limit + 1,
    excludeIds: pinned ? [pinned.id] : [],
  });
  const page = posts.slice(0, q.limit);
  const names = await clubNames(deps, pinned ? [pinned, ...page] : page);
  return {
    pinned: pinned ? listItem(pinned, names) : null,
    items: page.map((p) => listItem(p, names)),
    nextBefore: posts.length > q.limit ? iso(page[page.length - 1].publishedAt) : null,
  };
}

/** A published post by its slug with up to three related posts (sharing an area, else newest). */
export async function getPublishedNews(
  deps: NewsDeps,
  slug: string,
  options: { countView?: boolean } = {},
): Promise<NewsDetail> {
  const post = await deps.news.findPublishedBySlug(slug);
  if (!post) throw new ApiError("NOT_FOUND", "News post not found");
  if (options.countView) await deps.news.incrementViews(post.id);
  const related: StoredNews[] = [];
  for (const area of post.areas) {
    if (related.length >= 3) break;
    const more = await deps.news.listPublished({
      area,
      limit: 3 - related.length,
      excludeIds: [post.id, ...related.map((r) => r.id)],
    });
    related.push(...more);
  }
  if (related.length < 3) {
    related.push(
      ...(await deps.news.listPublished({
        limit: 3 - related.length,
        excludeIds: [post.id, ...related.map((r) => r.id)],
      })),
    );
  }
  const names = await clubNames(deps, [post, ...related]);
  return {
    ...listItem(post, names),
    sections: cleanSections(post.kind, post.sections),
    editedBySfz: post.clubId !== null && post.sfzEditedAt !== null,
    related: related.map((r) => listItem(r, names)),
  };
}

// ---- club ----

type ClubAccess = "write" | "read";

async function clubAccess(deps: NewsDeps, user: CurrentUser, clubId: string): Promise<ClubAccess> {
  const season = currentSeason(deps.now?.() ?? new Date());
  const roles = clubRolesFor(await deps.memberships.listByUser(user.id), clubId, season);
  if (roles.includes("management")) return "write";
  if (isAdmin(user) || roles.includes("mentor")) return "read";
  throw new ApiError("FORBIDDEN", "No access to this club's news");
}

async function requireClub(deps: NewsDeps, clubId: string) {
  if (!(await deps.clubs.findClub(clubId))) throw new ApiError("NOT_FOUND", "Club not found");
}

async function requireWrite(deps: NewsDeps, actor: CurrentUser | null, clubId: string) {
  const user = requireUser(actor);
  if ((await clubAccess(deps, user, clubId)) !== "write") {
    throw new ApiError("FORBIDDEN", "Only club management can propose news");
  }
  await requireClub(deps, clubId);
  return user;
}

const clubScope = (clubId: string): NewsScope => ({ clubIds: [clubId], academy: false });

async function findOrThrow(deps: NewsDeps, scope: NewsScope, id: string) {
  const post = await deps.news.findPost(scope, id);
  if (!post) throw new ApiError("NOT_FOUND", "News post not found");
  return post;
}

function savedOrConflict(post: StoredNews | null): StoredNews {
  if (!post) throw new ApiError("CONFLICT", "The post was changed by someone else");
  return post;
}

/** Records a text change of a post that left the club's draft (ADR 0023: revisions). */
async function recordRevision(
  deps: NewsDeps,
  before: StoredNews,
  after: StoredNews,
  userId: string,
  now: Date,
) {
  if (before.clubId !== null && before.submittedAt === null) return;
  const text = (p: StoredNews) => ({ title: p.title, areas: p.areas, sections: p.sections });
  await deps.revisions.addRevision({
    entity: "news_post",
    entityId: after.id,
    version: after.version,
    before: text(before),
    after: text(after),
    changedBy: userId,
    changedAt: now,
  });
}

export async function listClubNews(
  deps: NewsDeps,
  actor: CurrentUser | null,
  clubId: string,
): Promise<ClubNewsList> {
  const user = requireUser(actor);
  const access = await clubAccess(deps, user, clubId);
  await requireClub(deps, clubId);
  const posts = await deps.news.listPosts(clubScope(clubId));
  return {
    clubId,
    canEdit: access === "write",
    items: posts.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime()).map(clubItem),
  };
}

export async function getClubNews(
  deps: NewsDeps,
  actor: CurrentUser | null,
  clubId: string,
  id: string,
): Promise<ClubNewsItem> {
  const user = requireUser(actor);
  await clubAccess(deps, user, clubId);
  return clubItem(await findOrThrow(deps, clubScope(clubId), id));
}

function emptyPost(
  kind: NewsKind,
  clubId: string | null,
  content: z.infer<typeof academyNewsCreateSchema>,
  userId: string,
  now: Date,
): Omit<NewsPostDoc, "_id"> {
  return {
    kind,
    clubId,
    title: content.title,
    slug: null,
    areas: content.areas,
    sections: cleanSections(kind, content.sections),
    photos: [],
    documents: [],
    consents: { publication: null, photoPeople: null, external: null },
    status: "draft",
    reviewNote: null,
    sfzEditedAt: null,
    pinned: false,
    externalUrl: null,
    commsSharedAt: null,
    commsSharedBy: null,
    views: 0,
    submittedAt: null,
    submittedBy: null,
    publishedAt: null,
    publishedBy: null,
    version: 1,
    createdAt: now,
    createdBy: userId,
    updatedAt: now,
    updatedBy: userId,
  };
}

/** Club management starts a story or a tip (draft). */
export async function createClubNews(
  deps: NewsDeps,
  actor: CurrentUser | null,
  clubId: string,
  input: unknown,
): Promise<ClubNewsItem> {
  const user = await requireWrite(deps, actor, clubId);
  const { kind, ...content } = clubNewsCreateSchema.parse(input);
  const now = deps.now?.() ?? new Date();
  return clubItem(await deps.news.insertPost(emptyPost(kind, clubId, content, user.id, now)));
}

/** Club management edits its draft or a returned post. */
export async function updateClubNews(
  deps: NewsDeps,
  actor: CurrentUser | null,
  clubId: string,
  id: string,
  input: unknown,
): Promise<ClubNewsItem> {
  const user = await requireWrite(deps, actor, clubId);
  const { expectedVersion, ...content } = newsUpdateSchema.parse(input);
  const scope = clubScope(clubId);
  const post = await findOrThrow(deps, scope, id);
  if (post.status !== "draft" && post.status !== "returned") {
    throw new ApiError("CONFLICT", "Only a draft or a returned post can be edited by the club");
  }
  const now = deps.now?.() ?? new Date();
  const saved = savedOrConflict(
    await deps.news.updatePost(scope, id, expectedVersion, {
      title: content.title,
      areas: content.areas,
      sections: cleanSections(post.kind, content.sections),
      updatedAt: now,
      updatedBy: user.id,
    }),
  );
  await recordRevision(deps, post, saved, user.id, now);
  return clubItem(saved);
}

/** Club management sends the post to SFZ – also how it confirms SFZ edits of a returned post. */
export async function submitClubNews(
  deps: NewsDeps,
  actor: CurrentUser | null,
  clubId: string,
  id: string,
  input: unknown,
): Promise<ClubNewsItem> {
  const user = await requireWrite(deps, actor, clubId);
  const { expectedVersion, consents } = newsSubmitSchema.parse(input);
  const scope = clubScope(clubId);
  const post = await findOrThrow(deps, scope, id);
  if (post.status !== "draft" && post.status !== "returned") {
    throw new ApiError("CONFLICT", "Only a draft or a returned post can be submitted");
  }
  const missing = missingParts(post);
  if (missing.length > 0)
    throw new ApiError("BAD_REQUEST", "The post is not complete", { missing });
  if (post.photos.length > 0 && !consents.photoPeople) {
    throw new ApiError("BAD_REQUEST", "Consent of the people in the photos is required");
  }
  const now = deps.now?.() ?? new Date();
  const consent = (given: boolean) => (given ? { at: now, by: user.id } : null);
  return clubItem(
    savedOrConflict(
      await deps.news.updatePost(scope, id, expectedVersion, {
        status: "submitted",
        reviewNote: null,
        consents: {
          publication: consent(true),
          photoPeople: consent(consents.photoPeople),
          external: consent(consents.external),
        },
        submittedAt: now,
        submittedBy: user.id,
        updatedAt: now,
        updatedBy: user.id,
      }),
    ),
  );
}

// ---- admin_sfz ----

/** Every club (explicit list, ADR 0003) and academy posts. */
async function adminScope(deps: NewsDeps): Promise<NewsScope> {
  return { clubIds: (await deps.clubs.listClubs("all")).map((c) => c.clubId), academy: true };
}

export async function listAdminNews(
  deps: NewsDeps,
  actor: CurrentUser | null,
  input: unknown,
): Promise<AdminNewsItem[]> {
  const user = requireUser(actor);
  requireAdmin(user);
  const { status } = adminListQuerySchema.parse(input ?? {});
  const posts = (await deps.news.listPosts(await adminScope(deps), status))
    // drafts of clubs are theirs until submitted
    .filter((p) => p.clubId === null || p.status !== "draft")
    .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
  const names = await clubNames(deps, posts);
  return posts.map((p) => adminItem(p, names));
}

async function adminFind(deps: NewsDeps, actor: CurrentUser | null, id: string) {
  const user = requireUser(actor);
  requireAdmin(user);
  const scope = await adminScope(deps);
  const post = await findOrThrow(deps, scope, id);
  if (post.clubId !== null && post.status === "draft") {
    throw new ApiError("NOT_FOUND", "News post not found");
  }
  return { user, scope, post, now: deps.now?.() ?? new Date() };
}

async function adminView(deps: NewsDeps, post: StoredNews): Promise<AdminNewsItem> {
  return adminItem(post, await clubNames(deps, [post]));
}

export async function getAdminNews(
  deps: NewsDeps,
  actor: CurrentUser | null,
  id: string,
): Promise<AdminNewsItem> {
  const { post } = await adminFind(deps, actor, id);
  return adminView(deps, post);
}

/** admin_sfz starts a novinka Akadémie (draft). */
export async function createAcademyNews(
  deps: NewsDeps,
  actor: CurrentUser | null,
  input: unknown,
): Promise<AdminNewsItem> {
  const user = requireUser(actor);
  requireAdmin(user);
  const content = academyNewsCreateSchema.parse(input);
  const now = deps.now?.() ?? new Date();
  return adminView(
    deps,
    await deps.news.insertPost(emptyPost("academy", null, content, user.id, now)),
  );
}

/**
 * admin_sfz edits the text. An academy post any time; a club post only while it waits for review –
 * then the club has to confirm the edited text (submit again) before it can be published.
 */
export async function updateAdminNews(
  deps: NewsDeps,
  actor: CurrentUser | null,
  id: string,
  input: unknown,
): Promise<AdminNewsItem> {
  const { user, scope, post, now } = await adminFind(deps, actor, id);
  const { expectedVersion, ...content } = newsUpdateSchema.parse(input);
  if (post.clubId !== null && post.status !== "submitted") {
    throw new ApiError(
      "CONFLICT",
      "A club post can be edited by SFZ only while it waits for review",
    );
  }
  const saved = savedOrConflict(
    await deps.news.updatePost(scope, id, expectedVersion, {
      title: content.title,
      areas: content.areas,
      sections: cleanSections(post.kind, content.sections),
      ...(post.clubId !== null ? { sfzEditedAt: now } : {}),
      updatedAt: now,
      updatedBy: user.id,
    }),
  );
  await recordRevision(deps, post, saved, user.id, now);
  return adminView(deps, saved);
}

/** Returns a submitted club post to the club with a note (required). */
export async function returnNewsToClub(
  deps: NewsDeps,
  actor: CurrentUser | null,
  id: string,
  input: unknown,
): Promise<AdminNewsItem> {
  const { user, scope, post, now } = await adminFind(deps, actor, id);
  const { expectedVersion, note } = newsReturnSchema.parse(input);
  if (post.clubId === null || post.status !== "submitted") {
    throw new ApiError("CONFLICT", "Only a submitted club post can be returned");
  }
  return adminView(
    deps,
    savedOrConflict(
      await deps.news.updatePost(scope, id, expectedVersion, {
        status: "returned",
        reviewNote: note,
        updatedAt: now,
        updatedBy: user.id,
      }),
    ),
  );
}

async function uniqueSlug(deps: NewsDeps, title: string): Promise<string> {
  const base = slugify(title);
  for (let n = 1; ; n++) {
    const slug = n === 1 ? base : `${base}-${n}`;
    if (!(await deps.news.slugExists(slug))) return slug;
  }
}

/** Publishes a submitted club post (with the club's consent and confirmed text) or an academy post. */
export async function publishNews(
  deps: NewsDeps,
  actor: CurrentUser | null,
  id: string,
  input: unknown,
): Promise<AdminNewsItem> {
  const { user, scope, post, now } = await adminFind(deps, actor, id);
  const { expectedVersion } = versionSchema.parse(input);
  const allowed: NewsStatus[] =
    post.clubId === null ? ["draft", "hidden"] : ["submitted", "hidden"];
  if (!allowed.includes(post.status)) {
    throw new ApiError("CONFLICT", `A ${post.status} post cannot be published`);
  }
  if (post.clubId !== null) {
    if (!post.consents.publication) {
      throw new ApiError("CONFLICT", "The club has not consented to publication");
    }
    if (awaitsClubConfirmation(post)) {
      throw new ApiError("CONFLICT", "The club must confirm the text edited by SFZ");
    }
  }
  const missing = missingParts(post);
  if (missing.length > 0)
    throw new ApiError("BAD_REQUEST", "The post is not complete", { missing });
  return adminView(
    deps,
    savedOrConflict(
      await deps.news.updatePost(scope, id, expectedVersion, {
        status: "published",
        reviewNote: null,
        slug: post.slug ?? (await uniqueSlug(deps, post.title)),
        publishedAt: post.publishedAt ?? now,
        publishedBy: post.publishedBy ?? user.id,
        updatedAt: now,
        updatedBy: user.id,
      }),
    ),
  );
}

/** Takes a published post down (e.g. the club withdrew its consent); it can be published again. */
export async function hideNews(
  deps: NewsDeps,
  actor: CurrentUser | null,
  id: string,
  input: unknown,
): Promise<AdminNewsItem> {
  const { user, scope, post, now } = await adminFind(deps, actor, id);
  const { expectedVersion } = versionSchema.parse(input);
  if (post.status !== "published")
    throw new ApiError("CONFLICT", "Only a published post can be hidden");
  return adminView(
    deps,
    savedOrConflict(
      await deps.news.updatePost(scope, id, expectedVersion, {
        status: "hidden",
        pinned: false,
        updatedAt: now,
        updatedBy: user.id,
      }),
    ),
  );
}

/** Pins a published post to the top of Novinky and the Academy home (one at a time). */
export async function setNewsPinned(
  deps: NewsDeps,
  actor: CurrentUser | null,
  id: string,
  input: unknown,
): Promise<AdminNewsItem> {
  const { user, scope, post, now } = await adminFind(deps, actor, id);
  const { expectedVersion, pinned } = newsPinSchema.parse(input);
  if (pinned && post.status !== "published") {
    throw new ApiError("CONFLICT", "Only a published post can be pinned");
  }
  if (pinned) await deps.news.clearPinned();
  return adminView(
    deps,
    savedOrConflict(
      await deps.news.updatePost(scope, id, expectedVersion, {
        pinned,
        updatedAt: now,
        updatedBy: user.id,
      }),
    ),
  );
}

/** Records that the package went to SFZ communication – a club post only with the club's consent. */
export async function markNewsSharedWithComms(
  deps: NewsDeps,
  actor: CurrentUser | null,
  id: string,
  input: unknown,
): Promise<AdminNewsItem> {
  const { user, scope, post, now } = await adminFind(deps, actor, id);
  const { expectedVersion } = versionSchema.parse(input);
  if (post.status !== "published")
    throw new ApiError("CONFLICT", "Only a published post can be shared");
  if (post.clubId !== null && !post.consents.external) {
    throw new ApiError("CONFLICT", "The club has not consented to sharing outside the Academy");
  }
  return adminView(
    deps,
    savedOrConflict(
      await deps.news.updatePost(scope, id, expectedVersion, {
        commsSharedAt: now,
        commsSharedBy: user.id,
        updatedAt: now,
        updatedBy: user.id,
      }),
    ),
  );
}

/** Stores (or clears) the link to the article on futbalsfz.sk. */
export async function setNewsExternalUrl(
  deps: NewsDeps,
  actor: CurrentUser | null,
  id: string,
  input: unknown,
): Promise<AdminNewsItem> {
  const { user, scope, now } = await adminFind(deps, actor, id);
  const { expectedVersion, url } = newsExternalUrlSchema.parse(input);
  return adminView(
    deps,
    savedOrConflict(
      await deps.news.updatePost(scope, id, expectedVersion, {
        externalUrl: url,
        updatedAt: now,
        updatedBy: user.id,
      }),
    ),
  );
}
