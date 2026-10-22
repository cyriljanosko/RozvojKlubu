import Link from "next/link";
import type { ReactNode } from "react";
import { getTranslations } from "next-intl/server";

import {
  OptionPick,
  ProgressProvider,
  RoleProgressBar,
  StepDone,
  TaskCheck,
  type ProgressStep,
} from "@/components/content/practice-progress";
import { LinkedText } from "@/components/content/linked-text";
import { PinButton } from "@/components/favorites/pin-button";
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
    value && value !== "all" ? (
      <span className="bg-muted rounded px-1.5 py-0.5 text-[11px]">{t(`tags.${value}`)}</span>
    ) : null;
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

  const OptionCard = ({ o, pick, at }: { o: Option; pick?: ReactNode; at: string }) => (
    <li className="flex flex-col gap-1.5 rounded-lg border p-3 text-sm">
      <span className="flex flex-wrap items-center gap-2 font-semibold">
        {o.name} {tag(o.tag)}
      </span>
      <span>{linked(o.what, at)}</span>
      <span className="text-muted-foreground text-xs">
        {t("byWhom")}: {o.who} · {t("time")}: {o.time}
      </span>
      <span className="text-xs">
        <span className="text-muted-foreground">{t("result")}: </span>
        {linked(o.result, at)}
      </span>
      {o.template && (
        <span className="text-xs">
          <span className="text-muted-foreground">{t("template")}: </span>
          {tplTitle(o.template)}
        </span>
      )}
      {o.copyText && (
        <pre className="bg-muted/50 mt-1 rounded-md p-2 text-xs whitespace-pre-wrap">
          {o.copyText}
        </pre>
      )}
      {pick}
    </li>
  );

  const body = (
    <div className="flex flex-col gap-6">
      <nav aria-label={t("chooseRole")} className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold">{t("chooseRole")}</h2>
        <div className="flex flex-wrap gap-2">
          {practice.roles.map((r) => (
            <Link
              key={r.id}
              href={hrefForRole(r.id)}
              aria-current={r.id === role.id ? "page" : undefined}
              className="aria-[current=page]:bg-primary aria-[current=page]:text-primary-foreground rounded-md border px-3 py-1.5 text-sm"
            >
              {r.label}
            </Link>
          ))}
        </div>
      </nav>

      {progress ? (
        <RoleProgressBar
          clubName={progress.clubName}
          taskIds={role.firstStep.tasks.map((x) => x.id)}
          stepIds={role.steps.map((x) => x.id)}
        />
      ) : (
        <p className="text-muted-foreground rounded-xl border border-dashed p-3 text-sm">
          {signedIn ? (
            t("progress.noClub")
          ) : (
            <>
              {t("progress.signIn")}{" "}
              <Link href="/prihlasenie" className="font-medium underline underline-offset-4">
                {t("progress.signInLink")}
              </Link>
            </>
          )}
        </p>
      )}

      <section className="flex flex-col gap-3 rounded-xl border p-4 sm:p-6">
        <h2 className="text-lg font-semibold break-words">{role.label}</h2>
        {role.description && <p className="text-sm">{role.description}</p>}
        <dl className="grid gap-3 text-sm sm:grid-cols-3">
          {role.who && <Def label={t("who")}>{role.who}</Def>}
          {role.does && <Def label={t("does")}>{role.does}</Def>}
          {role.gain && <Def label={t("gain")}>{role.gain}</Def>}
        </dl>
        <div className="grid gap-4 text-sm sm:grid-cols-2">
          <List title={t("responsibilities")} items={role.responsibilities} />
          <List title={t("notThis")} items={role.notThis} />
        </div>
        <p className="text-muted-foreground text-xs">
          {t("time")}: {role.time} · {t("withWhom")}: {role.withWhom}
        </p>
      </section>

      <section
        id="first-step"
        className="flex scroll-mt-6 flex-col gap-3 rounded-xl border p-4 sm:p-6"
      >
        <h2 className="text-lg font-semibold">{t("firstStep")}</h2>
        <p className="font-medium">{role.firstStep.title}</p>
        <p className="text-muted-foreground text-xs">
          {t("byWhom")}: {role.firstStep.who} · {t("time")}: {role.firstStep.time} · {t("result")}:{" "}
          {linked(role.firstStep.result, "first")}
        </p>
        {progress ? (
          <ul className="space-y-1.5 text-sm">
            {role.firstStep.tasks.map((task) => (
              <li key={task.id}>
                <label className="flex items-start gap-2">
                  <TaskCheck taskId={task.id} label={task.title} />
                  <span>
                    {task.title}
                    {task.note && <span className="text-muted-foreground"> – {task.note}</span>}
                  </span>
                </label>
              </li>
            ))}
          </ul>
        ) : (
          <ol className="list-decimal space-y-1.5 pl-5 text-sm">
            {role.firstStep.tasks.map((task) => (
              <li key={task.id}>
                {task.title}
                {task.note && <span className="text-muted-foreground"> – {task.note}</span>}
              </li>
            ))}
          </ol>
        )}
        <div className="bg-muted/50 rounded-md p-3 text-sm">
          <p className="font-semibold">{role.firstStep.aside.title}</p>
          <pre className="mt-2 font-sans text-sm whitespace-pre-wrap">
            {linked(role.firstStep.aside.text, "first")}
          </pre>
          <p className="text-muted-foreground mt-2 text-xs">{role.firstStep.aside.note}</p>
        </div>
        {role.firstStep.template && (
          <p className="text-xs">
            <span className="text-muted-foreground">{t("template")}: </span>
            {tplTitle(role.firstStep.template)}
          </p>
        )}
      </section>

      <section className="flex flex-col gap-4">
        <header>
          <h2 className="text-lg font-semibold">
            {t("path")}: {role.pathTitle}
          </h2>
          <p className="text-muted-foreground text-sm">{role.pathSubtitle}</p>
        </header>
        <ol className="flex flex-col gap-4">
          {role.steps.map((step) => (
            <li
              key={step.id}
              id={`step-${step.id}`}
              className="flex scroll-mt-6 flex-col gap-3 rounded-xl border p-4 sm:p-6"
            >
              <p className="text-muted-foreground text-xs">{step.label}</p>
              <div className="flex items-start gap-1">
                <h3 className="font-semibold break-words">{step.title}</h3>
                {pins && (
                  <PinButton
                    kind="practice"
                    href={`${pins.base}&role=${role.id}#step-${step.id}`}
                    label={tFav("practice", { area: pins.area, title: step.title })}
                    pinned={pinned.has(`${pins.base}&role=${role.id}#step-${step.id}`)}
                    className="-mt-1.5"
                  />
                )}
              </div>
              <p className="text-sm">
                <span className="text-muted-foreground">{t("why")}: </span>
                {linked(step.why, step.id)}
              </p>
              <ul className="grid gap-2 lg:grid-cols-3">
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
                <details className="rounded-lg border p-3">
                  <summary className="cursor-pointer text-sm font-semibold">
                    {t("branchB")}: {step.branchB.title}
                  </summary>
                  <p className="mt-2 text-sm">{linked(step.branchB.why, step.id)}</p>
                  <ul className="mt-2 grid gap-2 lg:grid-cols-3">
                    {step.branchB.options.map((o) => (
                      <OptionCard key={o.name} o={o} at={step.id} />
                    ))}
                  </ul>
                </details>
              )}
              {step.mentor && (
                <div className="rounded-lg border border-dashed p-3 text-sm">
                  <p className="text-xs font-semibold">{t("mentor")}</p>
                  <p className="mt-1 font-medium">{step.mentor.title}</p>
                  <ul className="mt-1 list-disc pl-5">
                    {step.mentor.practice.map((line) => (
                      <li key={line}>{line}</li>
                    ))}
                  </ul>
                  {step.mentor.modules.map((key) => {
                    const m = modules.get(key);
                    return m ? (
                      <p key={key} className="text-muted-foreground mt-2 text-xs">
                        {m.title} · {m.meta.join(" · ")}
                      </p>
                    ) : null;
                  })}
                </div>
              )}
              {progress && <StepDone stepId={step.id} />}
            </li>
          ))}
        </ol>
      </section>

      <div className="grid gap-4 sm:grid-cols-2">
        <section className="rounded-xl border p-4 text-sm">
          <h2 className="font-semibold">{t("backlog")}</h2>
          <ul className="mt-2 flex flex-col gap-1.5">
            {role.backlog.map((b) => (
              <li key={b.text} className="flex flex-wrap items-center gap-2">
                {b.text} {tag(b.tag)}
              </li>
            ))}
          </ul>
        </section>
        <section className="rounded-xl border p-4 text-sm">
          <h2 className="font-semibold">{t("indicators")}</h2>
          <ul className="mt-2 list-disc space-y-1.5 pl-5">
            {role.indicators.map((i) => (
              <li key={i}>{i}</li>
            ))}
          </ul>
          {role.mentorNumbers && (
            <>
              <h3 className="mt-3 text-xs font-semibold">{t("mentorNumbers")}</h3>
              <ul className="mt-1 list-disc pl-5 text-xs">
                {role.mentorNumbers.map((n) => (
                  <li key={n.key}>
                    {n.label}
                    {n.lowerIsBetter && ` (${t("lowerIsBetter")})`}
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>
      </div>

      {role.next.length > 0 && (
        <section className="rounded-xl border p-4 text-sm">
          <h2 className="font-semibold">{t("next")}</h2>
          <ul className="mt-2 flex flex-col gap-2">
            {role.next.map((n) => (
              <li key={`${n.area}-${n.title}`}>
                <Link
                  href={`/oblasti/${n.area}`}
                  className="font-medium underline underline-offset-4"
                >
                  {n.area}. {n.title}
                </Link>
                <span className="text-muted-foreground"> – {n.why}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="rounded-xl border p-4 text-sm">
        <h2 className="font-semibold">{t("library")}</h2>
        <ul className="mt-2 flex flex-col gap-2">
          {role.library
            .map((key) => templates.get(key))
            .filter((tpl) => tpl !== undefined)
            .map((tpl) => (
              <li key={tpl.key}>
                <details
                  id={`tpl-${tpl.key}`}
                  open={openKey === `tpl-${tpl.key}`}
                  className="scroll-mt-6 rounded-lg border p-3"
                >
                  <summary className="cursor-pointer font-medium">
                    {tpl.title}
                    {pins && (
                      <PinButton
                        kind="pattern"
                        href={`${pins.base}&role=${role.id}&open=tpl-${tpl.key}#tpl-${tpl.key}`}
                        label={tFav("pattern", { title: tpl.title })}
                        pinned={pinned.has(
                          `${pins.base}&role=${role.id}&open=tpl-${tpl.key}#tpl-${tpl.key}`,
                        )}
                        className="ml-1 align-middle"
                      />
                    )}
                  </summary>
                  <p className="text-muted-foreground mt-1 text-xs">{tpl.description}</p>
                  {tpl.text ? (
                    <pre className="bg-muted/50 mt-2 rounded-md p-2 text-xs whitespace-pre-wrap">
                      {tpl.text}
                    </pre>
                  ) : (
                    <p className="mt-2 text-xs">{t("inMethodology")}</p>
                  )}
                </details>
              </li>
            ))}
        </ul>
      </section>
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
      <dt className="text-muted-foreground text-xs">{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}

function List({ title, items }: { title: string; items: string[] }) {
  return (
    <div>
      <h3 className="text-xs font-semibold">{title}</h3>
      <ul className="mt-1 list-disc space-y-1 pl-5">
        {items.map((i) => (
          <li key={i}>{i}</li>
        ))}
      </ul>
    </div>
  );
}
