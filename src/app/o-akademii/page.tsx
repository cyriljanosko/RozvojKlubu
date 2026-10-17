import type { Metadata } from "next";
import Link from "next/link";
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

import { YouTubeVideo } from "@/components/content/youtube-video";
import { Button } from "@/components/ui/button";
import { defaultMessages } from "@/i18n/config";

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

/** About the Academy (H7): short texts with icons, static content. */
export default async function AboutPage() {
  const t = await getTranslations("aboutPage");
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-10 px-4 py-10 sm:px-6 sm:py-14">
      <header className="flex max-w-3xl flex-col gap-2">
        <p className="text-muted-foreground text-sm font-medium">{t("eyebrow")}</p>
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">{t("intro.title")}</h1>
        <p className="text-muted-foreground text-lg">{t("intro.text")}</p>
      </header>

      <section aria-labelledby="about-video" className="flex max-w-3xl flex-col gap-3">
        <h2 id="about-video" className="text-xl font-semibold sm:text-2xl">
          {t("video.title")}
        </h2>
        <YouTubeVideo
          videoId={VIDEO_ID}
          title={t("video.title")}
          playLabel={t("video.play")}
          note={t("video.note")}
        />
        <p className="text-muted-foreground text-xs">{t("video.credit")}</p>
      </section>

      {SECTIONS.map(({ key, items }) => (
        <section key={key} aria-labelledby={`about-${key}`} className="flex flex-col gap-4">
          <h2 id={`about-${key}`} className="text-xl font-semibold sm:text-2xl">
            {t(`${key}.title`)}
          </h2>
          <ul
            className={`grid gap-3 sm:grid-cols-2 ${items.length === 4 ? "lg:grid-cols-4" : "lg:grid-cols-3"}`}
          >
            {items.map(([item, Icon]) => (
              <li key={item} className="flex gap-3 rounded-xl border p-4">
                <span className="bg-primary/10 text-primary flex size-10 shrink-0 items-center justify-center rounded-full">
                  <Icon aria-hidden className="size-5" />
                </span>
                <span className="flex flex-col gap-1">
                  <span className="font-semibold">{t(`${key}.items.${item}.title`)}</span>
                  <span className="text-muted-foreground text-sm">
                    {t(`${key}.items.${item}.text`)}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </section>
      ))}

      <section
        aria-labelledby="about-cta"
        className="bg-muted/50 flex flex-col gap-3 rounded-2xl p-5 sm:p-6"
      >
        <h2 id="about-cta" className="text-xl font-semibold">
          {t("cta.title")}
        </h2>
        <p className="text-muted-foreground">{t("cta.text")}</p>
        <div className="flex flex-wrap gap-2">
          <Button asChild>
            <Link href="/#hub-role">{t("cta.roles")}</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/kompas">{t("cta.kompas")}</Link>
          </Button>
        </div>
      </section>
    </main>
  );
}
