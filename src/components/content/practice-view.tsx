import Link from "next/link";
import type { ReactNode } from "react";
import { getTranslations } from "next-intl/server";

import {
  OptionPick,
  PathOverview,
  ProgressProvider,
  RoleProgressBar,
  StepDone,
  TaskCheck,
  type ProgressStep,
} from "@/components/content/practice-progress";
import { LinkedText } from "@/components/content/linked-text";
import { PinButton } from "@/components/favorites/pin-button";
import {
  Accordion,
  AccordionItem,
  Alert,
  Badge,
  Card,
  LinkButton,
  LinkChip,
} from "@/components/sfz";
import type { SfzLink } from "@/lib/sfz-links";
import type { PracticeContent } from "@/server/services/practice.schema";

type Role = PracticeContent["roles"][number];
type Step = Role["steps"][number];
type Option = Step["options"][number];

/** Club progress shown in the Practice (F6d); absent for visitors without a club role. */
export interface PracticeProgressProps {
  clubId: string;
  clubName: string;
  area: number;
  editable: boolean;
  version: number;
  tasks: string[];
  steps: ProgressStep[];
}

/** Practice of one role; with `progress` the club ticks tasks, picks options and marks steps done (F6d). */
export async function PracticeView({
  practice,
  roleId,
  hrefForRole,
  progress,
  signedIn,
  openKey = null,
  pins = null,
  links = [],
}: {
  practice: PracticeContent;
  roleId: string;
  hrefForRole: (id: string) => string;
  progress?: PracticeProgressProps | null;
  signedIn: boolean;
  /** template to open, e.g. "tpl-prehlad" (search hit, H6) */
  openKey?: string | null;
  /** signed-in users: pinned paths and the Prax link base (MD-c) */
  pins?: { hrefs: string[]; base: string; area: number } | null;
  /** SFZ pages linked at their first mention in each step (area 3, 22. 10. 2026) */
  links?: readonly SfzLink[];
}) {
  const t = await getTranslations("practice");
  const tFav = await getTranslations("favorites.labels");
  const pinned = new Set(pins?.hrefs ?? []);
  const role = practice.roles.find((r) => r.id === roleId) ?? practice.roles[0];
  const templates = new Map(practice.templates.map((tpl) => [tpl.key, tpl]));
  const modules = new Map(practice.mentorModules.map((m) => [m.key, m]));
  const tag = (value?: string) =>
    value && value !== "all" ? <Badge tone="neutral">{t(`tags.${value}`)}</Badge> : null;
  const tplTitle = (key?: string) => (key ? (templates.get(key)?.title ?? key) : null);
  // one set per step: an SFZ page is linked once in a step (why, options, branch B)
  const scopes = new Map<string, Set<string>>();
  const scope = (id: string) => {
    if (!scopes.has(id)) scopes.set(id, new Set());
    return scopes.get(id)!;
  };
  const linked = (text: string, scopeId: string) => (
    <LinkedText text={text} links={links} used={scope(scopeId)} />
  );
  const pin = (kind: "practice" | "pattern", href: string, label: string) =>
    pins ? <PinButton kind={kind} href={href} label={label} pinned={pinned.has(href)} /> : null;

  const OptionCard = ({ o, pick, at }: { o: Option; pick?: ReactNode; at: string }) => (
    <li className="flex flex-col gap-1.5 rounded-(--radius-sm) bg-(--surface) p-3">
      <span className="headline flex flex-wrap items-center gap-2">
        {o.name} {tag(o.tag)}
      </span>
      <span className="callout">{linked(o.what, at)}</span>
      <span className="footnote text-(--ink-muted)">
        {t("byWhom")}: {o.who} · {t("time")}: {o.time}
      </span>
      <span className="footnote">
        <span className="text-(--ink-muted)">{t("result")}: </span>
        {linked(o.result, at)}
      </span>
      {o.template && (
        <span className="footnote">
          <span className="text-(--ink-muted)">{t("template")}: </span>
          {tplTitle(o.template)}
        </span>
      )}
      {o.copyText && (
        <pre className="footnote mt-1 rounded-(--radius-sm) bg-(--surface-raised) p-2 whitespace-pre-wrap">
          {o.copyText}
        </pre>
      )}
      {pick}
    </li>
  );

  const library = role.library.map((key) => templates.get(key)).filter((tpl) => tpl !== undefined);

  const body = (
    <div className="flex flex-col gap-6">
      <nav aria-label={t("chooseRole")} className="flex flex-col gap-2">
        <h2 className="footnote text-(--ink-muted)">{t("chooseRole")}</h2>
        <div className="flex [scrollbar-width:none] gap-2 overflow-x-auto pb-1">
          {practice.roles.map((r) => (
            <LinkChip key={r.id} href={hrefForRole(r.id)} selected={r.id === role.id}>
              {r.label}
            </LinkChip>
          ))}
        </div>
      </nav>

      {progress ? (
        <RoleProgressBar
          clubName={progress.clubName}
          taskIds={role.firstStep.tasks.map((x) => x.id)}
          stepIds={role.steps.map((x) => x.id)}
        />
      ) : signedIn ? (
        <Alert tone="info">{t("progress.noClub")}</Alert>
      ) : (
        <Alert
          tone="info"
          title={t("progress.signInTitle")}
          action={
            <LinkButton href="/prihlasenie" variant="secondary" size="sm">
              {t("progress.signInLink")}
            </LinkButton>
          }
        >
          {t("progress.signIn")}
        </Alert>
      )}

      <Card title={role.label}>
        <div className="flex flex-col gap-3">
          {role.description && <p className="callout">{role.description}</p>}
          <dl className="grid gap-3 sm:grid-cols-3">
            {role.who && <Def label={t("who")}>{role.who}</Def>}
            {role.does && <Def label={t("does")}>{role.does}</Def>}
            {role.gain && <Def label={t("gain")}>{role.gain}</Def>}
          </dl>
          <div className="grid gap-4 sm:grid-cols-2">
            <List title={t("responsibilities")} items={role.responsibilities} />
            <List title={t("notThis")} items={role.notThis} />
          </div>
          <p className="footnote text-(--ink-muted)">
            {t("time")}: {role.time} · {t("withWhom")}: {role.withWhom}
          </p>
        </div>
      </Card>

      <Card id="first-step" title={t("firstStep")} variant="highlight" className="scroll-mt-6">
        <div className="flex flex-col gap-3">
          <p className="headline">{role.firstStep.title}</p>
          <p className="footnote text-(--ink-muted)">
            {t("byWhom")}: {role.firstStep.who} · {t("time")}: {role.firstStep.time} · {t("result")}
            : {linked(role.firstStep.result, "first")}
          </p>
          {progress ? (
            <div className="flex flex-col">
              {role.firstStep.tasks.map((task) => (
                <TaskCheck
                  key={task.id}
                  taskId={task.id}
                  label={task.title}
                  description={task.note}
                />
              ))}
            </div>
          ) : (
            <ol className="callout list-decimal space-y-1.5 pl-5">
              {role.firstStep.tasks.map((task) => (
                <li key={task.id}>
                  {task.title}
                  {task.note && <span className="text-(--ink-muted)"> – {task.note}</span>}
                </li>
              ))}
            </ol>
          )}
          <div className="rounded-(--radius-sm) bg-(--surface) p-3">
            <p className="subheadline font-semibold">{role.firstStep.aside.title}</p>
            <pre className="callout mt-2 font-(family-name:--font-sans) whitespace-pre-wrap">
              {linked(role.firstStep.aside.text, "first")}
            </pre>
            <p className="footnote mt-2 text-(--ink-muted)">{role.firstStep.aside.note}</p>
          </div>
          {role.firstStep.template && (
            <p className="footnote">
              <span className="text-(--ink-muted)">{t("template")}: </span>
              {tplTitle(role.firstStep.template)}
            </p>
          )}
        </div>
      </Card>

      <Card title={`${t("path")}: ${role.pathTitle}`}>
        <div className="flex flex-col gap-3">
          <p className="subheadline text-(--ink-muted)">{role.pathSubtitle}</p>
          <PathOverview
            steps={role.steps.map((step) => ({
              id: step.id,
              label: step.label,
              title: step.title,
            }))}
          />
        </div>
      </Card>

      <ol className="flex flex-col gap-4">
        {role.steps.map((step, index) => (
          <li key={step.id} id={`step-${step.id}`} className="scroll-mt-6">
            <Card
              title={step.title}
              action={pin(
                "practice",
                `${pins?.base}&role=${role.id}#step-${step.id}`,
                tFav("practice", { area: pins?.area ?? 0, title: step.title }),
              )}
            >
              <div className="flex flex-col gap-3">
                <p className="footnote text-(--ink-muted)">
                  {t("stepOf", { n: index + 1, total: role.steps.length })} · {step.label}
                </p>
                <p className="callout">
                  <span className="text-(--ink-muted)">{t("why")}: </span>
                  {linked(step.why, step.id)}
                </p>
                <ul className="grid gap-2 lg:grid-cols-3" aria-label={t("options")}>
                  {step.options.map((o, i) => (
                    <OptionCard
                      key={o.name}
                      o={o}
                      at={step.id}
                      pick={progress ? <OptionPick stepId={step.id} option={i} /> : undefined}
                    />
                  ))}
                </ul>
                {step.branchB && (
                  <Accordion>
                    <AccordionItem title={`${t("branchB")}: ${step.branchB.title}`}>
                      <p className="callout">{linked(step.branchB.why, step.id)}</p>
                      <ul className="mt-2 grid gap-2 lg:grid-cols-3">
                        {step.branchB.options.map((o) => (
                          <OptionCard key={o.name} o={o} at={step.id} />
                        ))}
                      </ul>
                    </AccordionItem>
                  </Accordion>
                )}
                {step.mentor && (
                  <div className="rounded-(--radius-sm) border border-dashed border-(--hairline) p-3">
                    <p className="label text-(--brand-blue-ink) uppercase">{t("mentor")}</p>
                    <p className="subheadline mt-1 font-semibold">{step.mentor.title}</p>
                    <ul className="callout mt-1 list-disc pl-5">
                      {step.mentor.practice.map((line) => (
                        <li key={line}>{line}</li>
                      ))}
                    </ul>
                    {step.mentor.modules.map((key) => {
                      const m = modules.get(key);
                      return m ? (
                        <p key={key} className="footnote mt-2 text-(--ink-muted)">
                          {m.title} · {m.meta.join(" · ")}
                        </p>
                      ) : null;
                    })}
                  </div>
                )}
                {progress && <StepDone stepId={step.id} />}
              </div>
            </Card>
          </li>
        ))}
      </ol>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card title={t("backlog")}>
          <ul className="callout flex flex-col gap-1.5">
            {role.backlog.map((b) => (
              <li key={b.text} className="flex flex-wrap items-center gap-2">
                {b.text} {tag(b.tag)}
              </li>
            ))}
          </ul>
        </Card>
        <Card title={t("indicators")}>
          <ul className="callout list-disc space-y-1.5 pl-5">
            {role.indicators.map((i) => (
              <li key={i}>{i}</li>
            ))}
          </ul>
          {role.mentorNumbers && (
            <>
              <h4 className="subheadline mt-3 font-semibold">{t("mentorNumbers")}</h4>
              <ul className="footnote mt-1 list-disc pl-5">
                {role.mentorNumbers.map((n) => (
                  <li key={n.key}>
                    {n.label}
                    {n.lowerIsBetter && ` (${t("lowerIsBetter")})`}
                  </li>
                ))}
              </ul>
            </>
          )}
        </Card>
      </div>

      {role.next.length > 0 && (
        <Card title={t("next")}>
          <ul className="callout flex flex-col gap-2">
            {role.next.map((n) => (
              <li key={`${n.area}-${n.title}`}>
                <Link href={`/oblasti/${n.area}`} className="font-semibold">
                  {n.area}. {n.title}
                </Link>
                <span className="text-(--ink-muted)"> – {n.why}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {library.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="label text-(--ink-muted) uppercase">{t("library")}</h2>
          <Accordion>
            {library.map((tpl) => {
              const href = `${pins?.base}&role=${role.id}&open=tpl-${tpl.key}#tpl-${tpl.key}`;
              return (
                <AccordionItem
                  key={tpl.key}
                  id={`tpl-${tpl.key}`}
                  defaultOpen={openKey === `tpl-${tpl.key}`}
                  subtitle={tpl.description}
                  title={
                    <span className="flex items-center gap-1">
                      <span className="min-w-0 flex-1 break-words">{tpl.title}</span>
                      {pin("pattern", href, tFav("pattern", { title: tpl.title }))}
                    </span>
                  }
                >
                  {tpl.text ? (
                    <pre className="footnote rounded-(--radius-sm) bg-(--surface) p-3 whitespace-pre-wrap">
                      {tpl.text}
                    </pre>
                  ) : (
                    <p className="footnote">{t("inMethodology")}</p>
                  )}
                </AccordionItem>
              );
            })}
          </Accordion>
        </section>
      )}
    </div>
  );

  return progress ? (
    <ProgressProvider
      key={`${progress.clubId}-${progress.version}`}
      clubId={progress.clubId}
      area={progress.area}
      editable={progress.editable}
      version={progress.version}
      initial={{ tasks: progress.tasks, steps: progress.steps }}
    >
      {body}
    </ProgressProvider>
  ) : (
    body
  );
}

function Def({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="footnote text-(--ink-muted)">{label}</dt>
      <dd className="callout">{children}</dd>
    </div>
  );
}

function List({ title, items }: { title: string; items: string[] }) {
  return (
    <div>
      <h4 className="subheadline font-semibold">{title}</h4>
      <ul className="callout mt-1 list-disc space-y-1 pl-5">
        {items.map((i) => (
          <li key={i}>{i}</li>
        ))}
      </ul>
    </div>
  );
}
