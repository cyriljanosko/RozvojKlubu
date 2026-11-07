import { getFormatter, getTranslations } from "next-intl/server";

import { Badge, Card, EmptyState } from "@/components/sfz";
import type { SyncRunView } from "@/server/services/sync-runs.service";

import { durationParts } from "./format";

const COUNTS = ["created", "updated", "skipped", "checked", "failed"] as const;

const TH =
  "footnote px-3 py-2 first:pl-6 last:pr-6 text-left font-semibold whitespace-nowrap text-(--ink-muted)";
const TD = "subheadline px-3 py-2 first:pl-6 align-top whitespace-nowrap";

/** Last writing runs of the club sync (G5 Sportnet): a table from 768 px, cards below it. */
export async function SyncRuns({ runs }: { runs: SyncRunView[] }) {
  const [t, format] = await Promise.all([getTranslations("adminSportnet"), getFormatter()]);

  if (runs.length === 0) {
    return (
      <Card title={t("runs.title")}>
        <EmptyState icon="inbox" title={t("runs.emptyTitle")} description={t("runs.emptyText")} />
      </Card>
    );
  }

  const started = (run: SyncRunView) =>
    format.dateTime(new Date(run.startedAt), { dateStyle: "medium", timeStyle: "short" });
  const trigger = (run: SyncRunView) => t(run.trigger === "cron" ? "runs.cron" : "runs.manual");
  const duration = (run: SyncRunView) => t("duration", durationParts(run.durationMs));
  const count = (run: SyncRunView, key: (typeof COUNTS)[number]) =>
    run.result?.[key] !== undefined ? format.number(run.result[key]) : "–";
  const status = (run: SyncRunView) =>
    run.ok ? (
      <Badge tone="success" dot>
        {t("runs.ok")}
      </Badge>
    ) : (
      <Badge tone="danger" dot>
        {t("runs.failedRun")}
      </Badge>
    );

  return (
    <section className="flex flex-col gap-3">
      {/* Desktop: table with horizontal scroll */}
      <div className="hidden md:block">
        <Card title={t("runs.title")} flush>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <caption className="footnote px-6 pb-2 text-left text-(--ink-muted)">
                {t("runs.caption")}
              </caption>
              <thead>
                <tr className="border-b border-(--hairline)">
                  <th scope="col" className={TH}>
                    {t("runs.startedAt")}
                  </th>
                  <th scope="col" className={TH}>
                    {t("runs.trigger")}
                  </th>
                  <th scope="col" className={`${TH} text-right`}>
                    {t("runs.duration")}
                  </th>
                  <th scope="col" className={TH}>
                    {t("runs.result")}
                  </th>
                  {COUNTS.map((key) => (
                    <th key={key} scope="col" className={`${TH} text-right`}>
                      {t(`runs.${key}`)}
                    </th>
                  ))}
                  <th scope="col" className={TH}>
                    {t("runs.error")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {runs.map((run) => (
                  <tr key={run.startedAt} className="border-b border-(--hairline) last:border-b-0">
                    <td className={TD}>{started(run)}</td>
                    <td className={TD}>{trigger(run)}</td>
                    <td className={`${TD} text-right tabular-nums`}>{duration(run)}</td>
                    <td className={TD}>{status(run)}</td>
                    {COUNTS.map((key) => (
                      <td key={key} className={`${TD} text-right tabular-nums`}>
                        {count(run, key)}
                      </td>
                    ))}
                    <td className="footnote max-w-72 px-3 py-2 pr-6 align-top text-(--ink-muted)">
                      {run.error ?? t("runs.noError")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      {/* Phone: cards, without the skipped count */}
      <div className="flex flex-col gap-2 md:hidden">
        <h2 className="title-3">{t("runs.title")}</h2>
        <ul className="flex flex-col gap-2">
          {runs.map((run) => (
            <li
              key={run.startedAt}
              className="flex flex-col gap-1 rounded-(--radius-md) bg-(--surface-raised) p-3"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="headline">{started(run)}</span>
                {status(run)}
              </div>
              <span className="footnote text-(--ink-muted)">
                {trigger(run)} · {duration(run)}
              </span>
              {run.ok && run.result ? (
                <span className="subheadline">
                  {t("runs.countsShort", {
                    created: run.result.created ?? 0,
                    updated: run.result.updated ?? 0,
                    checked: run.result.checked ?? 0,
                    failed: run.result.failed ?? 0,
                  })}
                </span>
              ) : (
                <>
                  <span className="subheadline">{t("runs.nothingWritten")}</span>
                  {run.error && <span className="footnote text-(--danger-ink)">{run.error}</span>}
                </>
              )}
            </li>
          ))}
        </ul>
      </div>

      <p className="footnote text-(--ink-muted)">{t("runs.note")}</p>
    </section>
  );
}
