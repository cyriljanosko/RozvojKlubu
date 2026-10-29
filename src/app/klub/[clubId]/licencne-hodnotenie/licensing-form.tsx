"use client";

import { useMemo, useState, useTransition } from "react";
import { useTranslations } from "next-intl";

import {
  Accordion,
  AccordionItem,
  Button,
  Card,
  Checkbox,
  Input,
  LicensingBandPill,
  Modal,
} from "@/components/sfz";
import type { ClubSeasonDoc, Gender, LicensingInputs } from "@/server/db/types";
import {
  ACTIVITY_ITEMS,
  ACTIVITY_RECORDS,
  BAND_MINIMUMS,
  COOPERATION_ITEMS,
  COOPERATION_RECORDS,
  INFRASTRUCTURE_ITEMS,
  LICENSING_BANDS,
  type ScoredItem,
} from "@/server/services/licensing-rules";
import {
  scoreLicensing,
  seatCoefficient,
  type AreaKey,
  type LicensingAreaResult,
  type LicensingResult,
} from "@/server/services/licensing-scoring";

import { closeLicensingAction, saveLicensingAction } from "./actions";

export interface LicensingFormProps {
  clubId: string;
  season: string;
  editable: boolean;
  version: number;
  inputs: LicensingInputs;
  /** result from the server; used as is when the season is closed */
  result: LicensingResult;
  sportnet: Pick<ClubSeasonDoc, "teams" | "players" | "coaches"> | null;
}

const FIELD =
  "rounded-(--radius-sm) border border-(--border) bg-(--surface) px-2 py-1.5 text-(--ink) tabular-nums disabled:text-(--disabled-ink)";
const TH = "footnote py-1.5 font-semibold text-(--ink-muted)";
const ROW = "border-t border-(--hairline)";

const num = (n: number) => n.toLocaleString("sk", { maximumFractionDigits: 1 });

/** Stable form of the inputs for dirty checks (no zero / false values, sorted keys). */
function normalize(i: LicensingInputs): string {
  const clean = (r: Record<string, number | boolean>) =>
    Object.fromEntries(
      Object.entries(r)
        .filter(([, v]) => v !== 0 && v !== false)
        .sort(([a], [b]) => a.localeCompare(b)),
    );
  return JSON.stringify({
    population: i.population,
    infrastructure: clean(i.infrastructure),
    activities: clean(i.activities),
    cooperation: clean(i.cooperation),
    coachGender: Object.fromEntries(
      Object.entries(i.coachGender).sort(([a], [b]) => a.localeCompare(b)),
    ),
  });
}

export function LicensingForm(props: LicensingFormProps) {
  const t = useTranslations("licensing");
  const [inputs, setInputs] = useState(props.inputs);
  const [saved, setSaved] = useState(() => normalize(props.inputs));
  const [version, setVersion] = useState(props.version);
  const [message, setMessage] = useState<"saved" | "conflict" | "error" | null>(null);
  const [closeOpen, setCloseOpen] = useState(false);
  const [closeMessage, setCloseMessage] = useState<"saveFirst" | "conflict" | "error" | null>(null);
  const [pending, startTransition] = useTransition();

  // open season: score live from the Sportnet data; closed season: the frozen result
  const result = useMemo(
    () => (props.sportnet ? scoreLicensing(props.sportnet, inputs) : props.result),
    [props.sportnet, props.result, inputs],
  );
  const dirty = normalize(inputs) !== saved;
  const disabled = !props.editable || pending;

  const setValue = (
    group: "infrastructure" | "activities" | "cooperation",
    key: string,
    value: number | boolean | null,
  ) =>
    setInputs((prev) => {
      const next = { ...prev[group] } as Record<string, number | boolean>;
      if (value === null || value === 0 || value === false) delete next[key];
      else next[key] = value;
      return { ...prev, [group]: next };
    });

  const save = () =>
    startTransition(async () => {
      const res = await saveLicensingAction(props.clubId, props.season, inputs, version);
      if (res.status === "ok") {
        setVersion(res.version);
        setSaved(normalize(inputs));
        setMessage("saved");
      } else setMessage(res.code === "CONFLICT" ? "conflict" : "error");
    });

  const close = () =>
    startTransition(async () => {
      const res = await closeLicensingAction(props.clubId, props.season, version);
      setCloseOpen(false);
      if (res.status === "error") setCloseMessage(res.code === "CONFLICT" ? "conflict" : "error");
    });

  const area = (key: AreaKey) => result.areas.find((a) => a.key === key)!;
  const coefficient = seatCoefficient(inputs.population);

  return (
    <div className="flex flex-col gap-6">
      <Card title={t("seatTitle")}>
        <div className="flex flex-wrap items-end gap-3">
          <div className="w-40">
            <Input
              label={t("population")}
              type="number"
              inputMode="numeric"
              min={0}
              placeholder={t("populationPlaceholder")}
              value={inputs.population ?? ""}
              disabled={disabled}
              onChange={(e) =>
                setInputs((prev) => ({
                  ...prev,
                  population:
                    e.target.value === "" ? null : Math.max(0, Math.floor(Number(e.target.value))),
                }))
              }
            />
          </div>
          <span className="subheadline pb-3 text-(--ink-muted)">
            {coefficient === null
              ? t("coefficientMissing")
              : t("coefficient", { value: num(coefficient) })}
          </span>
        </div>
      </Card>

      <section aria-labelledby="overview" className="flex flex-col gap-2">
        <h2 id="overview" className="title-3">
          {t("overview")}
        </h2>
        <ul className="overflow-hidden rounded-(--radius-md) bg-(--surface-raised)">
          {result.areas.map((a) => (
            <li key={a.key} className="border-t border-(--hairline) first:border-t-0">
              <a
                href={`#area-${a.key}`}
                className="flex min-h-14 items-center gap-3 px-4 py-2 text-(--ink) no-underline"
              >
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="subheadline font-semibold break-words">
                    {a.area}. {t(`areas.${a.key}`)}
                  </span>
                  <span className="footnote text-(--ink-muted)">
                    {a.source === "sportnet" ? t("sourceSportnet") : t("sourceClub")}
                  </span>
                </span>
                <span className="subheadline text-(--ink-muted) tabular-nums">
                  {t("points", { points: num(a.points) })}
                </span>
                <BandChip area={a} />
              </a>
            </li>
          ))}
        </ul>
        <p className="footnote text-(--ink-muted)">{t("overallPending")}</p>
      </section>

      <Accordion>
        <AreaCard area={area("teams")}>
          <div className="overflow-x-auto">
            <table className="subheadline w-full">
              <thead>
                <tr className="text-left">
                  <th className={`${TH} pr-2`}>{t("col.category")}</th>
                  <th className={`${TH} px-1 text-right`}>ObFZ</th>
                  <th className={`${TH} px-1 text-right`}>RFZ</th>
                  <th className={`${TH} px-1 text-right`}>SFZ</th>
                  <th className={`${TH} pl-2 text-right`}>{t("col.points")}</th>
                </tr>
              </thead>
              <tbody>
                {result.teams.rows
                  .filter((r) => r.levels.ObFZ + r.levels.RFZ + r.levels.SFZ > 0)
                  .map((r) => (
                    <tr key={`${r.bucket}-${r.gender}`} className={ROW}>
                      <td className="py-1.5 pr-2">
                        {t(`buckets.${r.bucket}`)} · {t(`genderRow.${r.gender}`)}
                      </td>
                      <td className="px-1 text-right tabular-nums">{r.levels.ObFZ}</td>
                      <td className="px-1 text-right tabular-nums">{r.levels.RFZ}</td>
                      <td className="px-1 text-right tabular-nums">{r.levels.SFZ}</td>
                      <td className="pl-2 text-right tabular-nums">{num(r.points)}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
          <Note>
            {t("subtotalCoef", {
              subtotal: num(result.teams.subtotal),
              coef: num(result.coefficient),
              points: num(area("teams").points),
            })}
          </Note>
          {result.teams.teamsWithoutCompetition > 0 && (
            <p className="footnote text-(--ink-muted)">
              {t("teamsWithoutCompetition", { count: result.teams.teamsWithoutCompetition })}
            </p>
          )}
        </AreaCard>

        <AreaCard area={area("players")}>
          <div className="overflow-x-auto">
            <table className="subheadline w-full">
              <thead>
                <tr className="text-left">
                  <th className={`${TH} pr-2`}>{t("col.category")}</th>
                  <th className={`${TH} px-1 text-right`}>{t("col.men")}</th>
                  <th className={`${TH} px-1 text-right`}>{t("col.women")}</th>
                  <th className={`${TH} pl-2 text-right`}>{t("col.points")}</th>
                </tr>
              </thead>
              <tbody>
                {result.players.rows.map((r) => (
                  <tr key={r.ageGroup} className={ROW}>
                    <td className="py-1.5 pr-2">
                      {r.ageGroup === "ADULTS" ? t("ageAdults") : r.ageGroup}
                    </td>
                    <td className="px-1 text-right tabular-nums">{r.men}</td>
                    <td className="px-1 text-right tabular-nums">{r.women}</td>
                    <td className="pl-2 text-right tabular-nums">{num(r.points)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Note>
            {t("subtotalCoef", {
              subtotal: num(result.players.subtotal),
              coef: num(result.coefficient),
              points: num(area("players").points),
            })}
          </Note>
        </AreaCard>

        <AreaCard area={area("coaches")}>
          <Note>{t("genderNote")}</Note>
          {result.coaches.rows.length === 0 ? (
            <p className="callout text-(--ink-muted)">{t("noCoaches")}</p>
          ) : (
            <ul>
              {result.coaches.rows.map((c) => (
                <li
                  key={c.name}
                  className="flex flex-wrap items-start gap-x-3 gap-y-1 border-t border-(--hairline) py-2 first:border-t-0"
                >
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="subheadline font-semibold break-words">{c.name}</span>
                    <span className="footnote break-words text-(--ink-muted)">
                      {c.teams.join(", ")}
                    </span>
                    <span className="footnote">
                      {c.bestLicence ?? <span className="text-(--warning)">{t("noLicence")}</span>}
                      {c.otherLicences.length > 0 && ` · ${c.otherLicences.join(", ")}`}
                    </span>
                    {c.expiredLicences.length > 0 && (
                      <span className="footnote text-(--ink-muted)">
                        {t("expired", { list: c.expiredLicences.join(", ") })}
                      </span>
                    )}
                  </span>
                  <label className="footnote flex items-center gap-1">
                    <span className="sr-only">{t("col.gender")}</span>
                    <select
                      className={FIELD}
                      value={c.gender}
                      disabled={disabled}
                      onChange={(e) =>
                        setInputs((prev) => ({
                          ...prev,
                          coachGender: { ...prev.coachGender, [c.name]: e.target.value as Gender },
                        }))
                      }
                    >
                      <option value="M">{t("gender.M")}</option>
                      <option value="F">{t("gender.F")}</option>
                    </select>
                    {c.genderGuessed && (
                      <span className="text-(--ink-muted)">{t("genderGuessed")}</span>
                    )}
                  </label>
                  <span className="subheadline w-14 text-right tabular-nums">
                    {t("points", { points: num(c.points) })}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </AreaCard>

        <AreaCard area={area("infrastructure")}>
          <ul>
            {INFRASTRUCTURE_ITEMS.map(([key, pts]) => {
              const value = inputs.infrastructure[key] ?? 0;
              return (
                <li
                  key={key}
                  className="subheadline flex items-center gap-2 border-t border-(--hairline) py-2 first:border-t-0"
                >
                  <label htmlFor={`infra-${key}`} className="min-w-0 flex-1 break-words">
                    {t(`infrastructure.${key}`)}
                    <span className="text-(--ink-muted)">
                      {" "}
                      · {pts} {t("col.perItem")}
                    </span>
                  </label>
                  <NumberInput
                    id={`infra-${key}`}
                    value={value}
                    disabled={disabled}
                    onChange={(v) => setValue("infrastructure", key, v)}
                  />
                  <span className="w-14 text-right tabular-nums">{num(value * pts)}</span>
                </li>
              );
            })}
          </ul>
        </AreaCard>

        <AreaCard area={area("activities")} provisional>
          <ScoredList
            group="activities"
            items={ACTIVITY_ITEMS}
            values={inputs.activities}
            disabled={disabled}
            onChange={setValue}
          />
          <RecordList
            group="activities"
            keys={ACTIVITY_RECORDS}
            kind="count"
            values={inputs.activities}
            disabled={disabled}
            onChange={setValue}
          />
        </AreaCard>

        <AreaCard area={area("cooperation")} provisional>
          <ScoredList
            group="cooperation"
            items={COOPERATION_ITEMS}
            values={inputs.cooperation}
            disabled={disabled}
            onChange={setValue}
          />
          <RecordList
            group="cooperation"
            keys={COOPERATION_RECORDS}
            kind="toggle"
            values={inputs.cooperation}
            disabled={disabled}
            onChange={setValue}
          />
        </AreaCard>
      </Accordion>

      {props.editable && (
        <div className="flex flex-col gap-2">
          <Button
            variant="secondary"
            icon="check-circle"
            disabled={pending}
            className="self-start"
            onClick={() => (dirty ? setCloseMessage("saveFirst") : setCloseOpen(true))}
          >
            {t("close.button")}
          </Button>
          <span role="status" className="footnote">
            {closeMessage && t(`close.${closeMessage}`)}
          </span>
          <Modal
            open={closeOpen}
            onClose={() => setCloseOpen(false)}
            title={t("close.button")}
            size="sm"
            footer={
              <>
                <Button block loading={pending} onClick={close}>
                  {t("close.yes")}
                </Button>
                <Button variant="tertiary" block onClick={() => setCloseOpen(false)}>
                  {t("close.no")}
                </Button>
              </>
            }
          >
            <p className="callout">{t("close.confirm", { season: props.season })}</p>
          </Modal>
        </div>
      )}

      {props.editable && (
        // save bar above the tab bar (mobile) or the bottom edge (desktop), as in the Kompas
        <div className="sticky bottom-[calc(var(--tabbar-height)+env(safe-area-inset-bottom,0px))] z-10 flex flex-wrap items-center gap-3 rounded-(--radius-md) border border-(--hairline) bg-(--surface) px-4 py-3 md:bottom-4">
          <span className="footnote min-w-0 flex-1" role="status">
            {dirty && message !== "conflict" && t("unsaved")}
            {!dirty && message === "saved" && t("saved", { version })}
            {message === "conflict" && <span className="text-(--danger)">{t("conflict")}</span>}
            {message === "error" && <span className="text-(--danger)">{t("error")}</span>}
          </span>
          <Button icon="check" onClick={save} disabled={pending || !dirty} loading={pending}>
            {t("save")}
          </Button>
        </div>
      )}
    </div>
  );
}

function Note({ children }: { children: React.ReactNode }) {
  return <p className="footnote rounded-(--radius-sm) bg-(--surface) p-2">{children}</p>;
}

function BandChip({ area }: { area: LicensingAreaResult }) {
  const t = useTranslations("licensing.bands");
  const label =
    area.status === "empty"
      ? t("empty")
      : area.status === "unbanded"
        ? t("unbanded")
        : area.band
          ? t(area.band)
          : t("none");
  return <LicensingBandPill band={area.band ?? "none"}>{label}</LicensingBandPill>;
}

function AreaCard({
  area,
  provisional,
  children,
}: {
  area: LicensingAreaResult;
  provisional?: boolean;
  children: React.ReactNode;
}) {
  const t = useTranslations("licensing");
  const tBands = useTranslations("licensing.bands");
  const minimums = area.key === "cooperation" ? null : BAND_MINIMUMS[area.key];
  return (
    <AccordionItem
      id={`area-${area.key}`}
      subtitle={`${t("area", { number: area.area })} · ${
        area.source === "sportnet" ? t("sourceSportnet") : t("sourceClub")
      }${provisional ? ` · ${t("provisional")}` : ""}`}
      title={
        <span className="flex items-center gap-2">
          <span className="min-w-0 flex-1 break-words">{t(`areas.${area.key}`)}</span>
          <span className="subheadline font-normal text-(--ink-muted) tabular-nums">
            {t("points", { points: num(area.points) })}
          </span>
          <BandChip area={area} />
        </span>
      }
    >
      <div className="flex scroll-mt-40 flex-col gap-3">
        {minimums && (
          <p className="footnote text-(--ink-muted)">
            {t("thresholds", {
              list: minimums.map((min, i) => `${tBands(LICENSING_BANDS[i])} ${min}+`).join(" · "),
            })}
          </p>
        )}
        {children}
        <p className="footnote text-(--ink-muted)">{t(`formula.${area.key}`)}</p>
      </div>
    </AccordionItem>
  );
}

function NumberInput({
  id,
  value,
  disabled,
  onChange,
}: {
  id: string;
  value: number;
  disabled: boolean;
  onChange: (value: number | null) => void;
}) {
  return (
    <input
      id={id}
      type="number"
      inputMode="numeric"
      min={0}
      max={9999}
      placeholder="–"
      className={`${FIELD} w-16 text-right`}
      value={value === 0 ? "" : value}
      disabled={disabled}
      onChange={(e) =>
        onChange(
          e.target.value === ""
            ? null
            : Math.min(9999, Math.max(0, Math.floor(Number(e.target.value)))),
        )
      }
    />
  );
}

type Group = "activities" | "cooperation";
type SetValue = (group: Group, key: string, value: number | boolean | null) => void;

function ScoredList({
  group,
  items,
  values,
  disabled,
  onChange,
}: {
  group: Group;
  items: readonly ScoredItem[];
  values: Record<string, number | boolean>;
  disabled: boolean;
  onChange: SetValue;
}) {
  const t = useTranslations("licensing");
  const pointsOf = (item: ScoredItem, v: number | boolean | undefined) => {
    if (v === undefined || v === false) return 0;
    if (item.type === "toggle") return item.points;
    if (item.type === "count") return Number(v) * item.points;
    return item.tiers[Math.min(2, Number(v))];
  };
  return (
    <ul>
      {items.map((item) => {
        const v = values[item.key];
        const id = `${group}-${item.key}`;
        return (
          <li
            key={item.key}
            className="subheadline flex items-center gap-2 border-t border-(--hairline) py-2 first:border-t-0"
          >
            <label htmlFor={id} className="min-w-0 flex-1 break-words">
              {t(`${group}.${item.key}`)}
            </label>
            {item.type === "count" ? (
              <NumberInput
                id={id}
                value={typeof v === "number" ? v : 0}
                disabled={disabled}
                onChange={(n) => onChange(group, item.key, n)}
              />
            ) : (
              <select
                id={id}
                className={FIELD}
                disabled={disabled}
                value={
                  item.type === "toggle"
                    ? v === true
                      ? "1"
                      : "0"
                    : String(Math.min(2, Number(v ?? 0)))
                }
                onChange={(e) =>
                  onChange(
                    group,
                    item.key,
                    item.type === "toggle" ? e.target.value === "1" : Number(e.target.value),
                  )
                }
              >
                {item.type === "toggle" ? (
                  <>
                    <option value="0">{t("no")}</option>
                    <option value="1">{t("yes")}</option>
                  </>
                ) : (
                  ([0, 1, 2] as const).map((n) => (
                    <option key={n} value={n}>
                      {t(`tier.${n}`)}
                    </option>
                  ))
                )}
              </select>
            )}
            <span className="w-14 text-right tabular-nums">{num(pointsOf(item, v))}</span>
          </li>
        );
      })}
    </ul>
  );
}

function RecordList({
  group,
  keys,
  kind,
  values,
  disabled,
  onChange,
}: {
  group: Group;
  keys: readonly string[];
  kind: "count" | "toggle";
  values: Record<string, number | boolean>;
  disabled: boolean;
  onChange: SetValue;
}) {
  const t = useTranslations("licensing");
  return (
    <fieldset className="flex flex-col gap-1">
      <legend className="label mb-1 text-(--ink-muted) uppercase">{t("records")}</legend>
      <div className="grid gap-1 sm:grid-cols-2">
        {keys.map((key) => {
          const id = `${group}-${key}`;
          return kind === "toggle" ? (
            <Checkbox
              key={key}
              id={id}
              label={t(`${group}.${key}`)}
              checked={values[key] === true}
              disabled={disabled}
              onChange={(e) => onChange(group, key, e.target.checked)}
            />
          ) : (
            <span key={key} className="subheadline flex items-center justify-between gap-2 py-1">
              <label htmlFor={id}>{t(`${group}.${key}`)}</label>
              <NumberInput
                id={id}
                value={typeof values[key] === "number" ? (values[key] as number) : 0}
                disabled={disabled}
                onChange={(n) => onChange(group, key, n)}
              />
            </span>
          );
        })}
      </div>
    </fieldset>
  );
}
