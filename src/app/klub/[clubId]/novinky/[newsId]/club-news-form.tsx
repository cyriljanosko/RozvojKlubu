"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";

import { NewsFields, type NewsContent } from "@/components/news/news-fields";
import { Alert, Button, Card, Checkbox } from "@/components/sfz";
import type { NewsKind } from "@/server/db/types";

import { saveClubNewsAction, submitClubNewsAction } from "../actions";

/**
 * The club's proposal form (design ZK "Navrhnúť príbeh"): text, consents, save as draft or send
 * to SFZ. Sending saves the text first, then submits the saved version.
 */
export function ClubNewsForm({
  clubId,
  newsId,
  kind,
  initial,
  version,
  consents,
  areas,
}: {
  clubId: string;
  newsId: string;
  kind: NewsKind;
  initial: NewsContent;
  version: number;
  consents: { photoPeople: boolean; external: boolean };
  areas: { number: number; name: string }[];
}) {
  const t = useTranslations("clubNews");
  const tE = useTranslations("newsEditor");
  const router = useRouter();
  const [content, setContent] = useState(initial);
  const [current, setCurrent] = useState(version);
  const [publication, setPublication] = useState(false);
  const [external, setExternal] = useState(consents.external);
  const [message, setMessage] = useState<{ tone: "danger" | "success"; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  const save = async () => {
    const res = await saveClubNewsAction(clubId, newsId, content, current);
    if (res.status === "error") {
      setMessage({ tone: "danger", text: tE(`errors.${res.code}`) });
      return null;
    }
    setCurrent(res.version);
    return res.version;
  };

  return (
    <form
      className="flex flex-col gap-6"
      onSubmit={(e) => {
        e.preventDefault();
        startTransition(async () => {
          setMessage(null);
          const saved = await save();
          if (saved === null) return;
          const res = await submitClubNewsAction(clubId, newsId, saved, {
            photoPeople: false,
            external,
          });
          if (res.status === "error") {
            setMessage({ tone: "danger", text: tE(`errors.${res.code}`) });
            return;
          }
          router.refresh();
        });
      }}
    >
      <NewsFields kind={kind} value={content} onChange={setContent} areas={areas} />
      <p className="footnote text-(--ink-muted)">{tE("photosLater")}</p>

      <Card title={t("consentsTitle")}>
        <div className="flex flex-col gap-3">
          <Checkbox
            label={t("consentPublication")}
            checked={publication}
            required
            onChange={(e) => setPublication(e.target.checked)}
          />
          <Checkbox
            label={t("consentExternal")}
            description={t("consentExternalHint")}
            checked={external}
            onChange={(e) => setExternal(e.target.checked)}
          />
        </div>
      </Card>

      <Alert tone="info">{t("submitInfo")}</Alert>
      {message && (
        <Alert tone={message.tone} role="status">
          {message.text}
        </Alert>
      )}

      <div className="flex flex-col gap-2 sm:flex-row-reverse sm:justify-start">
        <Button type="submit" loading={pending} disabled={!publication}>
          {t("submit")}
        </Button>
        <Button
          type="button"
          variant="secondary"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              setMessage(null);
              if ((await save()) !== null) {
                setMessage({ tone: "success", text: tE("saved") });
                router.refresh();
              }
            })
          }
        >
          {tE("save")}
        </Button>
      </div>
    </form>
  );
}
