"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { runNewsAction, type NewsActionResult } from "@/components/news/news-action";
import type { NewsContent } from "@/components/news/news-fields";
import { getCurrentUser } from "@/server/auth/session";
import { newsDeps } from "@/server/clubs/deps";
import { createClubNews, submitClubNews, updateClubNews } from "@/server/services/news.service";

/** Thin Server Actions over the news service for club proposals (ADR 0023). */
const user = async () => getCurrentUser(await headers());

/** Starts an empty draft and opens it. */
export async function createClubNewsAction(clubId: string, kind: "story" | "tip"): Promise<void> {
  const post = await createClubNews(newsDeps, await user(), clubId, {
    kind,
    title: "",
    areas: [],
    sections: [],
  });
  redirect(`/klub/${encodeURIComponent(clubId)}/novinky/${post.id}`);
}

export async function saveClubNewsAction(
  clubId: string,
  newsId: string,
  content: NewsContent,
  expectedVersion: number,
): Promise<NewsActionResult> {
  return runNewsAction(async () =>
    updateClubNews(newsDeps, await user(), clubId, newsId, { ...content, expectedVersion }),
  );
}

export async function submitClubNewsAction(
  clubId: string,
  newsId: string,
  expectedVersion: number,
  consents: { photoPeople: boolean; external: boolean },
): Promise<NewsActionResult> {
  return runNewsAction(async () =>
    submitClubNews(newsDeps, await user(), clubId, newsId, {
      expectedVersion,
      consents: { publication: true, ...consents },
    }),
  );
}
