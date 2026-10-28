import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { getTranslations } from "next-intl/server";
import { Suspense, type ReactNode } from "react";

import type { Line } from "@/components/about/formation";
import { toLinks } from "@/components/app-frame/nav-data";
import {
  Accordion,
  AccordionItem,
  Alert,
  AreaNumber,
  Button,
  Card,
  Checkbox,
  Input,
  KompasBandBadge,
  LicensingBandPill,
  LinkButton,
  LinkTabs,
  ProgressBar,
  Select,
  Toggle,
} from "@/components/sfz";
import { clubMenu } from "@/lib/navigation";
import { getEnv } from "@/server/env";
import { BANDS } from "@/server/services/kompas-scoring";
import { LICENSING_BANDS } from "@/server/services/licensing-rules";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("showcase");
  return { title: t("title"), robots: { index: false } };
}

const LINES: { line: Line; area: number }[] = [
  { line: "goalkeeper", area: 1 },
  { line: "defense", area: 8 },
  { line: "midfield", area: 3 },
  { line: "attack", area: 5 },
];

/**
 * Showcase of the SFZ layer for Playwright screenshots (R3.4). Needs no database, so the
 * screenshots are stable in CI; returns 404 unless ENABLE_DEV_PAGES=1 (never in production).
 */
export default function ShowcasePage() {
  return (
    <main className="mx-auto flex w-full max-w-4xl flex-col gap-8 px-4 py-6 sm:py-10">
      <Suspense fallback={null}>
        <Showcase />
      </Suspense>
    </main>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="title-3">{title}</h2>
      {children}
    </section>
  );
}

async function Showcase() {
  await connection();
  if (getEnv().ENABLE_DEV_PAGES !== "1") notFound();

  const [t, tKompas, tLicensing, tAbout, submenu] = await Promise.all([
    getTranslations("showcase"),
    getTranslations("kompas.bands"),
    getTranslations("licensing.bands"),
    getTranslations("aboutPage.eleven.lines"),
    toLinks(clubMenu("ukazka", ["management"], false)),
  ]);

  return (
    <>
      <header className="flex flex-col gap-2">
        <h1 className="large-title">{t("title")}</h1>
        <p className="body text-(--ink-muted)">{t("intro")}</p>
      </header>

      <Section title={t("submenu")}>
        <LinkTabs items={submenu} navLabel={t("submenu")} />
      </Section>

      <Section title={t("buttons")}>
        <div className="flex flex-wrap gap-2">
          <Button variant="primary" icon="check">
            {t("primary")}
          </Button>
          <Button variant="secondary">{t("secondary")}</Button>
          <Button variant="tertiary">{t("tertiary")}</Button>
          <LinkButton href="/kompas" variant="secondary" icon="check-circle">
            {t("link")}
          </LinkButton>
        </div>
      </Section>

      <Section title={t("kompasBands")}>
        <div className="flex flex-wrap gap-2">
          {BANDS.map((band) => (
            <KompasBandBadge key={band.key} band={band.key}>
              {tKompas(band.key)}
            </KompasBandBadge>
          ))}
        </div>
      </Section>

      <Section title={t("licensingBands")}>
        <div className="flex flex-wrap gap-2">
          {(["none", ...LICENSING_BANDS] as const).map((band) => (
            <LicensingBandPill key={band} band={band}>
              {tLicensing(band)}
            </LicensingBandPill>
          ))}
        </div>
      </Section>

      <Section title={t("lines")}>
        <div className="flex flex-wrap gap-4">
          {LINES.map(({ line, area }) => (
            <span key={line} className="flex items-center gap-2">
              <AreaNumber number={area} line={line} />
              <span className="subheadline">{tAbout(`${line}.title`)}</span>
            </span>
          ))}
        </div>
      </Section>

      <Section title={t("progress")}>
        <ProgressBar value={73} label={t("progressLabel")} valueText={t("progressValue")} />
        <ProgressBar value={43} label={t("progressLabel")} tone="success" />
      </Section>

      <Section title={t("accordion")}>
        <Accordion>
          <AccordionItem title={t("accordionOpen")} defaultOpen>
            <p className="callout">{t("accordionText")}</p>
          </AccordionItem>
          <AccordionItem title={t("accordionClosed")}>
            <p className="callout">{t("accordionText")}</p>
          </AccordionItem>
        </Accordion>
      </Section>

      <Section title={t("alerts")}>
        <Alert tone="info">{t("alertInfo")}</Alert>
        <Alert tone="warning">{t("alertWarning")}</Alert>
      </Section>

      <Section title={t("card")}>
        <Card title={t("card")} variant="highlight">
          <p className="callout">{t("cardText")}</p>
        </Card>
      </Section>

      <Section title={t("form")}>
        <div className="flex max-w-md flex-col gap-4">
          <Input label={t("inputLabel")} defaultValue={t("inputValue")} />
          <Select
            label={t("selectLabel")}
            defaultValue="3"
            options={[
              { value: "1", label: t("optionLeadership") },
              { value: "3", label: t("optionCoaches") },
            ]}
          />
          <Checkbox label={t("checkboxLabel")} defaultChecked />
          <Toggle label={t("toggleLabel")} defaultChecked />
        </div>
      </Section>
    </>
  );
}
