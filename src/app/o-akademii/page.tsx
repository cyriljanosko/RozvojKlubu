import type { Metadata } from "next";
// eslint-disable-next-line no-restricted-imports -- section icons until the design system has them (Cyril 30. 10. 2026)
import {
  GraduationCap,
  Handshake,
  HeartHandshake,
  HeartPulse,
  Landmark,
  Layers,
  Medal,
  School,
  Sprout,
  Target,
  Trophy,
  Users,
  type LucideIcon,
} from "lucide-react";
import { getTranslations } from "next-intl/server";

import { connection } from "next/server";
import { Suspense } from "react";

import { Formation, LINE_COLOR } from "@/components/about/formation";
import { YouTubeVideo } from "@/components/content/youtube-video";
import { Card, LinkButton } from "@/components/sfz";
import { defaultMessages } from "@/i18n/config";
import { mongoContentStore } from "@/server/db/content.store";
import { listAreas } from "@/server/services/content.service";

export const metadata: Metadata = { title: defaultMessages.aboutPage.title };

/** "Akadémia za 8 minút" on YouTube (uploaded by Cyril, 17. 10. 2026). */
const VIDEO_ID = "hkSBUbxYWFA";

type Section = "levels" | "village" | "benefits" | "meaning";

/** Icons per section item; texts live in messages (aboutPage.<section>.items.<key>). */
const SECTIONS: { key: Section; items: [string, LucideIcon][] }[] = [
  {
    key: "levels",
    items: [
      ["size", Layers],
      ["area", Target],
      ["way", Handshake],
    ],
  },
  {
    key: "village",
    items: [
      ["kids", Sprout],
      ["generations", Users],
      ["identity", Trophy],
    ],
  },
  {
    key: "benefits",
    items: [
      ["municipality", Landmark],
      ["school", School],
      ["families", HeartHandshake],
      ["youth", GraduationCap],
    ],
  },
  {
    key: "meaning",
    items: [
      ["community", Users],
      ["health", HeartPulse],
      ["upbringing", Medal],
    ],
  },
];

const LINES = ["goalkeeper", "defense", "midfield", "attack"] as const;

/** The eleven with area descriptions from the managed content (read per request). */
async function Eleven() {
  await connection();
  return <Formation areas={await listAreas(mongoContentStore, null)} />;
}

/** About the Academy (H7): short texts with icons; the eleven reads the areas. */
export default async function AboutPage() {
  const t = await getTranslations("aboutPage");
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-8 px-4 py-6 sm:px-6 sm:py-10">
      <header className="flex max-w-3xl flex-col gap-2">
        <p className="subheadline text-(--ink-muted)">{t("eyebrow")}</p>
        <h1 className="large-title">{t("intro.title")}</h1>
        <p className="body text-(--ink-muted)">{t("intro.text")}</p>
      </header>

      <section aria-labelledby="about-video" className="flex max-w-3xl flex-col gap-2">
        <h2 id="about-video" className="title-3">
          {t("video.title")}
        </h2>
        <YouTubeVideo
          videoId={VIDEO_ID}
          title={t("video.title")}
          playLabel={t("video.play")}
          note={t("video.note")}
        />
      </section>

      <section aria-labelledby="about-eleven" className="flex flex-col gap-4">
        <div className="flex max-w-3xl flex-col gap-2">
          <h2 id="about-eleven" className="title-3">
            {t("eleven.title")}
          </h2>
          <p className="callout text-(--ink-muted)">{t("eleven.text")}</p>
        </div>
        <div className="mx-auto w-full max-w-3xl">
          <Suspense fallback={<div className="aspect-[680/470] w-full" aria-hidden />}>
            <Eleven />
          </Suspense>
        </div>
        <dl className="grid max-w-3xl overflow-hidden rounded-(--radius-md) bg-(--surface-raised) sm:grid-cols-2">
          {LINES.map((line) => (
            <div
              key={line}
              className="flex gap-3 border-t border-(--hairline) px-4 py-3 first:border-t-0 sm:[&:nth-child(2)]:border-t-0"
            >
              <span
                aria-hidden
                className={`mt-1 size-3.5 shrink-0 rounded-[4px] shadow-[inset_0_0_0_1px_var(--border-strong)] ${LINE_COLOR[line]}`}
              />
              <div className="flex flex-col gap-0.5">
                <dt className="headline">{t(`eleven.lines.${line}.title`)}</dt>
                <dd className="footnote text-(--ink-muted)">{t(`eleven.lines.${line}.areas`)}</dd>
                <dd className="footnote">{t(`eleven.lines.${line}.text`)}</dd>
              </div>
            </div>
          ))}
        </dl>
      </section>

      {SECTIONS.map(({ key, items }) => (
        <section key={key} aria-labelledby={`about-${key}`} className="flex flex-col gap-2">
          <h2 id={`about-${key}`} className="title-3">
            {t(`${key}.title`)}
          </h2>
          <ul
            className={`grid overflow-hidden rounded-(--radius-md) bg-(--surface-raised) sm:grid-cols-2 ${items.length === 4 ? "lg:grid-cols-4" : "lg:grid-cols-3"}`}
          >
            {items.map(([item, Icon]) => (
              <li
                key={item}
                className="flex gap-3 border-t border-(--hairline) px-4 py-3 first:border-t-0 sm:border-t-0"
              >
                <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-(--brand-blue-tint) text-(--brand-blue-ink)">
                  <Icon aria-hidden className="size-5" />
                </span>
                <span className="flex flex-col gap-0.5">
                  <span className="headline">{t(`${key}.items.${item}.title`)}</span>
                  <span className="footnote text-(--ink-muted)">
                    {t(`${key}.items.${item}.text`)}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </section>
      ))}

      <Card variant="highlight" title={t("cta.title")}>
        <div className="flex flex-col gap-3">
          <p className="callout">{t("cta.text")}</p>
          <div className="flex flex-col gap-2 sm:flex-row">
            <LinkButton href="/#hub-role">{t("cta.roles")}</LinkButton>
            <LinkButton href="/kompas" variant="secondary">
              {t("cta.kompas")}
            </LinkButton>
          </div>
        </div>
      </Card>

      <p className="footnote text-(--ink-muted)">{t("video.credit")}</p>
    </main>
  );
}
