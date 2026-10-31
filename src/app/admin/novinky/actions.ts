"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { runNewsAction, type NewsActionResult } from "@/components/news/news-action";
import type { NewsContent } from "@/components/news/news-fields";
import { getCurrentUser } from "@/server/auth/session";
import { newsDeps } from "@/server/clubs/deps";
import {
  createAcademyNews,
  hideNews,
  markNewsSharedWithComms,
  publishNews,
  returnNewsToClub,
  setNewsExternalUrl,
  setNewsPinned,
  updateAdminNews,
} from "@/server/services/news.service";

/** Thin Server Actions over the news service for admin_sfz (ADR 0023). */
const user = async () => getCurrentUser(await headers());

/** Starts an empty novinka Akadémie and opens it. */
export async function createAcademyNewsAction(): Promise<void> {
  const post = await createAcademyNews(newsDeps, await user(), {
    title: "",
    areas: [],
    sections: [],
  });
  redirect(`/admin/novinky/${post.id}`);
}

export async function saveAdminNewsAction(
  newsId: string,
  content: NewsContent,
  expectedVersion: number,
): Promise<NewsActionResult> {
  return runNewsAction(async () =>
    updateAdminNews(newsDeps, await user(), newsId, { ...content, expectedVersion }),
  );
}

export async function returnNewsAction(
  newsId: string,
  expectedVersion: number,
  note: string,
): Promise<NewsActionResult> {
  return runNewsAction(async () =>
    returnNewsToClub(newsDeps, await user(), newsId, { expectedVersion, note }),
  );
}

export async function publishNewsAction(
  newsId: string,
  expectedVersion: number,
): Promise<NewsActionResult> {
  return runNewsAction(async () =>
    publishNews(newsDeps, await user(), newsId, { expectedVersion }),
  );
}

export async function hideNewsAction(
  newsId: string,
  expectedVersion: number,
): Promise<NewsActionResult> {
  return runNewsAction(async () => hideNews(newsDeps, await user(), newsId, { expectedVersion }));
}

export async function pinNewsAction(
  newsId: string,
  expectedVersion: number,
  pinned: boolean,
): Promise<NewsActionResult> {
  return runNewsAction(async () =>
    setNewsPinned(newsDeps, await user(), newsId, { expectedVersion, pinned }),
  );
}

export async function commsNewsAction(
  newsId: string,
  expectedVersion: number,
): Promise<NewsActionResult> {
  return runNewsAction(async () =>
    markNewsSharedWithComms(newsDeps, await user(), newsId, { expectedVersion }),
  );
}

export async function externalUrlNewsAction(
  newsId: string,
  expectedVersion: number,
  url: string | null,
): Promise<NewsActionResult> {
  return runNewsAction(async () =>
    setNewsExternalUrl(newsDeps, await user(), newsId, { expectedVersion, url }),
  );
}
