"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";

import { NewsFields, type NewsContent } from "@/components/news/news-fields";
import { Alert, Button, Card, Input, Textarea, Toggle } from "@/components/sfz";
import type { NewsActionResult } from "@/components/news/news-action";
import type { NewsKind, NewsStatus } from "@/server/db/types";

import {
  commsNewsAction,
  externalUrlNewsAction,
  hideNewsAction,
  pinNewsAction,
  publishNewsAction,
  returnNewsAction,
  saveAdminNewsAction,
} from "../actions";

export interface ReviewPost {
  id: string;
  kind: NewsKind;
  status: NewsStatus;
  club: boolean;
  version: number;
  content: NewsContent;
  pinned: boolean;
  externalUrl: string | null;
  consentExternal: boolean;
  commsShared: string | null;
  /** plain text package for SFZ communication */
  commsPackage: string;
}

/**
 * Review of one post by admin_sfz (design ZK "Administrácia – Novinky"): edit the text, return
 * with a note, publish, pin, hand over to SFZ communication and link the futbalsfz.sk article.
 */
export function NewsReview({
  post,
  areas,
}: {
  post: ReviewPost;
  areas: { number: number; name: string }[];
}) {
  const t = useTranslations("adminNews");
  const tE = useTranslations("newsEditor");
  const router = useRouter();
  const [content, setContent] = useState(post.content);
  const [note, setNote] = useState("");
  const [url, setUrl] = useState(post.externalUrl ?? "");
  const [message, setMessage] = useState<{ tone: "danger" | "success"; text: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [pending, startTransition] = useTransition();
  const textEditable = post.club ? post.status === "submitted" : post.status !== "hidden";
  const dirty = JSON.stringify(content) !== JSON.stringify(post.content);

  const run = (action: (version: number) => Promise<NewsActionResult>, ok?: string) =>
    startTransition(async () => {
      setMessage(null);
      let version = post.version;
      if (dirty && textEditable) {
        const saved = await saveAdminNewsAction(post.id, content, version);
        if (saved.status === "error") {
          setMessage({ tone: "danger", text: tE(`errors.${saved.code}`) });
          return;
        }
        version = saved.version;
      }
      const res = await action(version);
      if (res.status === "error") {
        setMessage({ tone: "danger", text: tE(`errors.${res.code}`) });
        return;
      }
      if (ok) setMessage({ tone: "success", text: ok });
      router.refresh();
    });

  const canPublish = post.club
    ? post.status === "submitted" || post.status === "hidden"
    : post.status !== "published";

  return (
    <div className="flex flex-col gap-6">
      <Card title={t("text")}>
        <div className="flex flex-col gap-4">
          {post.club && post.status === "submitted" && (
            <p className="footnote text-(--ink-muted)">{t("textClubHint")}</p>
          )}
          <NewsFields
            kind={post.kind}
            value={content}
            onChange={setContent}
            areas={areas}
            disabled={!textEditable || pending}
          />
          {textEditable && (
            <Button
              variant="secondary"
              disabled={!dirty || pending}
              onClick={() => run(async (v) => ({ status: "ok", version: v }), tE("saved"))}
            >
              {tE("save")}
            </Button>
          )}
        </div>
      </Card>

      {message && (
        <Alert tone={message.tone} role="status">
          {message.text}
        </Alert>
      )}

      <Card title={t("decision")}>
        <div className="flex flex-col gap-4">
          {post.club && post.status === "submitted" && (
            <>
              <Textarea
                label={t("note")}
                hint={t("noteHint")}
                value={note}
                rows={3}
                maxLength={2000}
                onChange={(e) => setNote(e.target.value)}
              />
              <Button
                variant="secondary"
                disabled={pending || note.trim().length < 3}
                onClick={() => run((v) => returnNewsAction(post.id, v, note))}
              >
                {t("returnToClub")}
              </Button>
            </>
          )}
          {canPublish && (
            <Button loading={pending} onClick={() => run((v) => publishNewsAction(post.id, v))}>
              {post.status === "hidden" ? t("republish") : t("publish")}
            </Button>
          )}
          {post.status === "published" && (
            <>
              <Toggle
                label={t("pin")}
                description={t("pinHint")}
                checked={post.pinned}
                disabled={pending}
                onChange={(e) => run((v) => pinNewsAction(post.id, v, e.target.checked))}
              />
              <Button
                variant="danger"
                disabled={pending}
                onClick={() => run((v) => hideNewsAction(post.id, v))}
              >
                {t("hide")}
              </Button>
            </>
          )}
        </div>
      </Card>

      {post.status === "published" && (
        <Card title={t("comms")}>
          <div className="flex flex-col gap-4">
            {post.club && !post.consentExternal ? (
              <p className="subheadline text-(--ink-muted)">{t("commsNoConsent")}</p>
            ) : (
              <>
                <p className="subheadline text-(--ink-muted)">{t("commsText")}</p>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Button
                    variant="secondary"
                    icon={copied ? "check" : undefined}
                    onClick={async () => {
                      try {
                        await navigator.clipboard.writeText(post.commsPackage);
                        setCopied(true);
                      } catch {
                        setCopied(false);
                      }
                    }}
                  >
                    {copied ? t("copied") : t("copyPackage")}
                  </Button>
                  {post.commsShared ? (
                    <p className="subheadline self-center">{post.commsShared}</p>
                  ) : (
                    <Button
                      variant="tertiary"
                      disabled={pending}
                      onClick={() => run((v) => commsNewsAction(post.id, v))}
                    >
                      {t("commsMark")}
                    </Button>
                  )}
                </div>
              </>
            )}
            <form
              className="flex flex-col gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                run((v) => externalUrlNewsAction(post.id, v, url.trim() || null), tE("saved"));
              }}
            >
              <Input
                label={t("externalUrl")}
                hint={t("externalUrlHint")}
                type="url"
                inputMode="url"
                placeholder="https://www.futbalsfz.sk/…"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
              />
              <Button
                type="submit"
                variant="secondary"
                disabled={pending || url.trim() === (post.externalUrl ?? "")}
              >
                {t("saveUrl")}
              </Button>
            </form>
          </div>
        </Card>
      )}
    </div>
  );
}
