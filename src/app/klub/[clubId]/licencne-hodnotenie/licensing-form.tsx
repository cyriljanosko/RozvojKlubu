"use client";

import { useMemo, useState, useTransition } from "react";
import { Lock, Save } from "lucide-react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
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

const BAND_CLASS: Record<string, string> = {
  grassroots: "bg-green-700 text-white",
  bronze: "bg-orange-800 text-white",
  silver: "bg-zinc-500 text-white",
  gold: "bg-amber-600 text-white",
};

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
  const [closeStep, setCloseStep] = useState<"idle" | "confirm">("idle");
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
      setCloseStep("idle");
      if (res.status === "error") setCloseMessage(res.code === "CONFLICT" ? "conflict" : "error");
    });

  const area = (key: AreaKey) => result.areas.find((a) => a.key === key)!;
  const coefficient = seatCoefficient(inputs.population);

  return (
    <div className="flex flex-col gap-4">
      <section className="bg-primary text-primary-foreground sticky top-0 z-10 flex flex-col gap-3 rounded-xl p-4">
        <div className="flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1 text-sm">
            <span className="opacity-90">{t("population")}</span>
            <input
              type="number"
              inputMode="numeric"
              min={0}
              className="bg-background text-foreground w-32 rounded-md px-2 py-1 tabular-nums"
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
          </label>
          <span className="pb-1 text-sm opacity-90">
            {coefficient === null
              ? t("coefficientMissing")
              : t("coefficient", { value: num(coefficient) })}
          </span>
        </div>
        {props.editable && (
          <div className="flex flex-wrap items-center gap-3">
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={save}
              disabled={pending || !dirty}
            >
              <Save aria-hidden />
              {t("save")}
            </Button>
            <span role="status" className="text-xs">
              {dirty && message !== "conflict" && t("unsaved")}
              {!dirty && message === "saved" && t("saved", { version })}
              {message === "conflict" && t("conflict")}
              {message === "error" && t("error")}
            </span>
          </div>
        )}
      </section>

      <section aria-labelledby="overview" className="flex flex-col gap-2">
        <h2
          id="overview"
          className="text-muted-foreground text-xs font-semibold tracking-wide uppercase"
        >
          {t("overview")}
        </h2>
        <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {result.areas.map((a) => (
            <li key={a.key}>
              <a
                href={`#area-${a.key}`}
                className="hover:bg-muted/50 flex h-full flex-col gap-1 rounded-lg border p-3"
              >
                <span className="text-muted-foreground text-xs">
                  {t("area", { number: a.area })} ·{" "}
                  {a.source === "sportnet" ? t("sourceSportnet") : t("sourceClub")}
                </span>
                <span className="text-sm font-semibold">{t(`areas.${a.key}`)}</span>
                <span className="mt-auto flex flex-wrap items-center justify-between gap-2">
                  <span className="text-sm tabular-nums">
                    {t("points", { points: num(a.points) })}
                  </span>
                  <BandChip area={a} />
                </span>
              </a>
            </li>
          ))}
        </ul>
        <p className="text-muted-foreground text-sm">{t("overallPending")}</p>
      </section>

      <AreaCard area={area("teams")}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-muted-foreground text-left text-xs">
                <th className="py-1 pr-2 font-medium">{t("col.category")}</th>
                <th className="px-1 text-right font-medium">ObFZ</th>
                <th className="px-1 text-right font-medium">RFZ</th>
                <th className="px-1 text-right font-medium">SFZ</th>
                <th className="pl-2 text-right font-medium">{t("col.points")}</th>
              </tr>
            </thead>
            <tbody>
              {result.teams.rows
                .filter((r) => r.levels.ObFZ + r.levels.RFZ + r.levels.SFZ > 0)
                .map((r) => (
                  <tr key={`${r.bucket}-${r.gender}`} className="border-t">
                    <td className="py-1 pr-2">
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
        <p className="bg-muted/60 rounded-md p-2 text-sm">
          {t("subtotalCoef", {
            subtotal: num(result.teams.subtotal),
            coef: num(result.coefficient),
            points: num(area("teams").points),
          })}
        </p>
        {result.teams.teamsWithoutCompetition > 0 && (
          <p className="text-muted-foreground text-xs">
            {t("teamsWithoutCompetition", { count: result.teams.teamsWithoutCompetition })}
          </p>
        )}
      </AreaCard>

      <AreaCard area={area("players")}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-muted-foreground text-left text-xs">
                <th className="py-1 pr-2 font-medium">{t("col.category")}</th>
                <th className="px-1 text-right font-medium">{t("col.men")}</th>
                <th className="px-1 text-right font-medium">{t("col.women")}</th>
                <th className="pl-2 text-right font-medium">{t("col.points")}</th>
              </tr>
            </thead>
            <tbody>
              {result.players.rows.map((r) => (
                <tr key={r.ageGroup} className="border-t">
                  <td className="py-1 pr-2">
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
        <p className="bg-muted/60 rounded-md p-2 text-sm">
          {t("subtotalCoef", {
            subtotal: num(result.players.subtotal),
            coef: num(result.coefficient),
            points: num(area("players").points),
          })}
        </p>
      </AreaCard>

      <AreaCard area={area("coaches")}>
        <p className="bg-muted/60 rounded-md p-2 text-sm">{t("genderNote")}</p>
        {result.coaches.rows.length === 0 ? (
          <p className="text-muted-foreground text-sm">{t("noCoaches")}</p>
        ) : (
          <ul className="divide-y rounded-md border">
            {result.coaches.rows.map((c) => (
              <li key={c.name} className="flex flex-wrap items-start gap-x-3 gap-y-1 p-2 text-sm">
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="font-medium break-words">{c.name}</span>
                  <span className="text-muted-foreground text-xs break-words">
                    {c.teams.join(", ")}
                  </span>
                  <span className="text-xs">
                    {c.bestLicence ?? <span className="text-amber-700">{t("noLicence")}</span>}
                    {c.otherLicences.length > 0 && ` · ${c.otherLicences.join(", ")}`}
                  </span>
                  {c.expiredLicences.length > 0 && (
                    <span className="text-muted-foreground text-xs">
                      {t("expired", { list: c.expiredLicences.join(", ") })}
                    </span>
                  )}
                </span>
                <label className="flex items-center gap-1 text-xs">
                  <span className="sr-only">{t("col.gender")}</span>
                  <select
                    className="rounded-md border px-1 py-0.5"
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
                    <span className="text-muted-foreground">{t("genderGuessed")}</span>
                  )}
                </label>
                <span className="w-14 text-right tabular-nums">
                  {t("points", { points: num(c.points) })}
                </span>
              </li>
            ))}
          </ul>
        )}
      </AreaCard>

      <AreaCard area={area("infrastructure")}>
        <ul className="divide-y rounded-md border">
          {INFRASTRUCTURE_ITEMS.map(([key, pts]) => {
            const value = inputs.infrastructure[key] ?? 0;
            return (
              <li key={key} className="flex items-center gap-2 p-2 text-sm">
                <label htmlFor={`infra-${key}`} className="min-w-0 flex-1 break-words">
                  {t(`infrastructure.${key}`)}
                  <span className="text-muted-foreground">
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

      {props.editable && (
        <section className="flex flex-col gap-2 rounded-xl border p-4">
          {closeStep === "idle" ? (
            <Button
              type="button"
              variant="outline"
              className="self-start"
              disabled={pending}
              onClick={() => (dirty ? setCloseMessage("saveFirst") : setCloseStep("confirm"))}
            >
              <Lock aria-hidden />
              {t("close.button")}
            </Button>
          ) : (
            <div className="flex flex-col gap-2 text-sm">
              <p>{t("close.confirm", { season: props.season })}</p>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  onClick={close}
                  disabled={pending}
                >
                  {t("close.yes")}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setCloseStep("idle")}
                >
                  {t("close.no")}
                </Button>
              </div>
            </div>
          )}
          <span role="status" className="text-xs">
            {closeMessage && t(`close.${closeMessage}`)}
          </span>
        </section>
      )}
    </div>
  );
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
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-xs font-medium ${area.band ? BAND_CLASS[area.band] : "bg-muted text-muted-foreground"}`}
    >
      {label}
    </span>
  );
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
    <details id={`area-${area.key}`} className="scroll-mt-40 rounded-xl border">
      <summary className="flex cursor-pointer flex-wrap items-center gap-x-3 gap-y-1 p-3">
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="text-muted-foreground text-xs">
            {t("area", { number: area.area })} ·{" "}
            {area.source === "sportnet" ? t("sourceSportnet") : t("sourceClub")}
            {provisional && ` · ${t("provisional")}`}
          </span>
          <span className="font-medium break-words">{t(`areas.${area.key}`)}</span>
        </span>
        <span className="text-sm tabular-nums">{t("points", { points: num(area.points) })}</span>
        <BandChip area={area} />
      </summary>
      <div className="flex flex-col gap-3 border-t p-3">
        {minimums && (
          <p className="text-muted-foreground text-xs">
            {t("thresholds", {
              list: minimums.map((min, i) => `${tBands(LICENSING_BANDS[i])} ${min}+`).join(" · "),
            })}
          </p>
        )}
        {children}
        <p className="text-muted-foreground text-xs">{t(`formula.${area.key}`)}</p>
      </div>
    </details>
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
      className="w-16 rounded-md border px-2 py-1 text-right tabular-nums"
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
    <ul className="divide-y rounded-md border">
      {items.map((item) => {
        const v = values[item.key];
        const id = `${group}-${item.key}`;
        return (
          <li key={item.key} className="flex items-center gap-2 p-2 text-sm">
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
                className="rounded-md border px-1 py-1"
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
      <legend className="mb-1 text-sm font-semibold">{t("records")}</legend>
      <div className="grid gap-1 sm:grid-cols-2">
        {keys.map((key) => {
          const id = `${group}-${key}`;
          return kind === "toggle" ? (
            <label key={key} className="flex items-start gap-2 rounded-md p-1 text-sm">
              <input
                id={id}
                type="checkbox"
                className="mt-0.5 size-4 shrink-0"
                checked={values[key] === true}
                disabled={disabled}
                onChange={(e) => onChange(group, key, e.target.checked)}
              />
              <span>{t(`${group}.${key}`)}</span>
            </label>
          ) : (
            <span key={key} className="flex items-center justify-between gap-2 p-1 text-sm">
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
