"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import type {
  MentorAssessment,
  MentorTopicAssessment,
  MentorVisitForm,
  MentorVisitStatus,
} from "@/server/db/types";

import { saveVisitAction, sendVisitAction, withdrawVisitAction } from "./actions";

export interface VisitFormValue {
  date: string;
  form: MentorVisitForm;
  participantIds: string[];
  participants: string;
  /** visits before the mentoring cycle only; new visits use `assessment` (MC) */
  summary: string;
  topics: number[];
  assessment: MentorAssessment;
  prepTask: { text: string; dueDate: string | null };
  findings: { area: number; text: string }[];
  actions: {
    id?: string;
    text: string;
    area: number | null;
    owner: string;
    /** a club member picked as responsible; null = someone else, by name */
    ownerId: string | null;
    /** client only: "someone else" was chosen and the name is typed */
    ownerOther?: boolean;
    dueDate: string | null;
  }[];
}

const FORMS: MentorVisitForm[] = ["onsite", "online", "phone"];
/** fields of a topic block; the overall assessment is one for the whole meeting (22. 10. 2026) */
const BLOCK: ("strengths" | "weaknesses" | "recommendations")[] = [
  "strengths",
  "weaknesses",
  "recommendations",
];
const emptyBlock = (area: number | null): MentorTopicAssessment => ({
  area,
  strengths: "",
  weaknesses: "",
  recommendations: "",
});
const hasText = (b: MentorTopicAssessment | undefined) =>
  Boolean(b && (b.strengths.trim() || b.weaknesses.trim() || b.recommendations.trim()));
const MAX_TOPICS = 3;
const OTHER = "__other";
const field =
  "border-input bg-background focus-visible:ring-ring w-full rounded-md border px-3 py-2 text-sm focus-visible:ring-2 focus-visible:outline-none";

/**
 * The mentor's visit form (MV-b, MC-b): plan a meeting (date, topic, task before it – the club sees
 * it at once) or record one (present, assessment in four fields, findings, agreed steps);
 * draft or planned → sent to the club; edits allowed until withdrawn.
 */
export function VisitForm({
  clubId,
  visitId,
  status,
  version,
  initial,
  members,
  areas,
}: {
  clubId: string;
  visitId: string | null;
  status: MentorVisitStatus | null;
  version: number;
  initial: VisitFormValue;
  members: { userId: string; name: string; roles: string[] }[];
  areas: { number: number; name: string }[];
}) {
  const t = useTranslations("visits.form");
  const tRoles = useTranslations("clubRoles");
  const router = useRouter();
  const [v, setV] = useState(initial);
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<"send" | "withdraw" | null>(null);
  // a new visit is planned ahead or recorded after the meeting; a planned visit gets its record
  const [planning, setPlanning] = useState(false);
  const legacySummary = initial.summary.trim().length > 0;
  // findings per area belong to visits before the assessment per topic (decision 22. 10. 2026)
  const legacyFindings = initial.findings.length > 0;
  // a topic with a written assessment is removed only after a confirmation
  const [removing, setRemoving] = useState<number | null>(null);
  const blockAreas: (number | null)[] =
    v.topics.length > 0 ? [...v.topics].sort((a, b) => a - b) : [null];
  const blockFor = (area: number | null) =>
    v.assessment.topics.find((b) => b.area === area) ?? emptyBlock(area);
  const setBlock = (area: number | null, patch: Partial<MentorTopicAssessment>) =>
    set("assessment", {
      ...v.assessment,
      topics: [
        ...v.assessment.topics.filter((b) => b.area !== area),
        { ...blockFor(area), ...patch },
      ],
    });
  const toggleTopic = (area: number) => {
    if (v.topics.includes(area)) {
      const block = v.assessment.topics.find((b) => b.area === area);
      if (hasText(block) && removing !== area) return setRemoving(area);
      setRemoving(null);
      setV((s) => ({
        ...s,
        topics: s.topics.filter((x) => x !== area),
        assessment: {
          ...s.assessment,
          topics: s.assessment.topics.filter((b) => b.area !== area),
        },
      }));
      return;
    }
    setV((s) => {
      // the first topic takes over what was written in the general block
      const general =
        s.topics.length === 0 ? s.assessment.topics.find((b) => b.area === null) : undefined;
      return {
        ...s,
        topics: [...s.topics, area],
        assessment: {
          ...s.assessment,
          topics: [
            ...s.assessment.topics.filter((b) => b.area !== null),
            ...(general && hasText(general) ? [{ ...general, area }] : []),
          ],
        },
      };
    });
  };

  const set = <K extends keyof VisitFormValue>(key: K, value: VisitFormValue[K]) =>
    setV((s) => ({ ...s, [key]: value }));
  const usedAreas = new Set(v.findings.map((f) => f.area));
  const freeArea = areas.find((a) => !usedAreas.has(a.number));

  const invalid = () => {
    if (!v.date) return t("errors.date");
    if (v.findings.some((f) => !f.text.trim())) return t("errors.finding");
    if (v.actions.some((a) => !a.text.trim() || !a.owner.trim())) return t("errors.action");
    return null;
  };

  const save = (then?: "send") =>
    startTransition(async () => {
      const problem = invalid();
      if (problem) return setMessage(problem);
      setMessage(null);
      const blocks = blockAreas.map(blockFor).filter(hasText);
      const assessment =
        blocks.length > 0 || v.assessment.overall.trim()
          ? { topics: blocks, overall: v.assessment.overall }
          : null;
      const input = {
        ...v,
        assessment: planning ? null : assessment,
        prepTask: v.prepTask.text.trim()
          ? { text: v.prepTask.text, dueDate: v.prepTask.dueDate || null }
          : null,
        planned: !visitId && planning,
        actions: v.actions.map((a) => ({
          id: a.id,
          text: a.text,
          area: a.area,
          owner: a.owner,
          ownerId: a.ownerId,
          dueDate: a.dueDate || null,
        })),
      };
      const saved = await saveVisitAction(clubId, visitId, input, version);
      if (saved.status === "error") return setMessage(t(`errors.${saved.code}`));
      if (then === "send") {
        const sent = await sendVisitAction(clubId, saved.id, saved.version);
        if (sent.status === "error") return setMessage(t(`errors.${sent.code}`));
      }
      setConfirm(null);
      if (!visitId) router.push(`/klub/${encodeURIComponent(clubId)}/navstevy/${saved.id}`);
      else setMessage(then === "send" ? t("sent") : t("saved"));
    });

  const withdraw = () =>
    startTransition(async () => {
      if (!visitId) return;
      const res = await withdrawVisitAction(clubId, visitId, version);
      if (res.status === "error") return setMessage(t(`errors.${res.code}`));
      setConfirm(null);
      setMessage(t("withdrawn"));
    });

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        save();
      }}
      className="flex flex-col gap-5"
    >
      {!visitId && (
        <fieldset className="flex flex-col gap-1 text-sm">
          <legend className="mb-1 font-medium">{t("mode")}</legend>
          <div className="grid grid-cols-2 overflow-hidden rounded-md border">
            {(["plan", "record"] as const).map((m) => (
              <button
                key={m}
                type="button"
                aria-pressed={planning === (m === "plan")}
                onClick={() => setPlanning(m === "plan")}
                className="aria-pressed:bg-primary aria-pressed:text-primary-foreground px-2 py-2 text-sm"
              >
                {t(`modes.${m}`)}
              </button>
            ))}
          </div>
          {planning && <p className="text-muted-foreground text-xs">{t("planHint")}</p>}
        </fieldset>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">{t("date")}</span>
          <input
            type="date"
            required
            value={v.date}
            onChange={(e) => set("date", e.target.value)}
            className={field}
          />
        </label>
        <fieldset className="flex flex-col gap-1 text-sm">
          <legend className="mb-1 font-medium">{t("form")}</legend>
          <div className="grid grid-cols-3 overflow-hidden rounded-md border">
            {FORMS.map((f) => (
              <button
                key={f}
                type="button"
                aria-pressed={v.form === f}
                onClick={() => set("form", f)}
                className="aria-pressed:bg-primary aria-pressed:text-primary-foreground px-2 py-2 text-sm"
              >
                {t(`forms.${f}`)}
              </button>
            ))}
          </div>
        </fieldset>
      </div>

      <fieldset className="flex flex-col gap-2 text-sm">
        <legend className="mb-1 font-medium">
          {t("topics")}{" "}
          <span className="text-muted-foreground font-normal">· {t("topicsHint")}</span>
        </legend>
        <div className="flex flex-wrap gap-1.5">
          {areas.map((a) => {
            const on = v.topics.includes(a.number);
            return (
              <button
                key={a.number}
                type="button"
                aria-pressed={on}
                disabled={!on && v.topics.length >= MAX_TOPICS}
                onClick={() => toggleTopic(a.number)}
                className="aria-pressed:bg-primary aria-pressed:text-primary-foreground rounded-full border px-3 py-1 text-xs disabled:opacity-40"
              >
                {a.number} · {a.name}
              </button>
            );
          })}
        </div>
        {removing !== null && (
          <div className="flex flex-col gap-2 rounded-md border border-amber-500 p-3" role="alert">
            <p>{t("removeTopicConfirm", { area: removing })}</p>
            <div className="flex flex-wrap gap-2">
              <Button type="button" size="sm" onClick={() => toggleTopic(removing)}>
                {t("removeTopic")}
              </Button>
              <Button type="button" size="sm" variant="outline" onClick={() => setRemoving(null)}>
                {t("keepTopic")}
              </Button>
            </div>
          </div>
        )}
      </fieldset>

      <section className="flex flex-col gap-2 rounded-xl border p-4 text-sm">
        <h2 className="font-semibold">
          {t("prepTask")}{" "}
          <span className="text-muted-foreground font-normal">· {t("optional")}</span>
        </h2>
        <textarea
          value={v.prepTask.text}
          onChange={(e) => set("prepTask", { ...v.prepTask, text: e.target.value })}
          placeholder={t("prepTaskPlaceholder")}
          aria-label={t("prepTask")}
          rows={2}
          maxLength={1000}
          className={field}
        />
        <label className="flex items-center gap-2">
          <span className="text-muted-foreground shrink-0">{t("prepDue")}</span>
          <input
            type="date"
            value={v.prepTask.dueDate ?? ""}
            onChange={(e) => set("prepTask", { ...v.prepTask, dueDate: e.target.value || null })}
            className={field}
          />
        </label>
      </section>

      {!planning && (
        <>
          <fieldset className="flex flex-col gap-2 text-sm">
            <legend className="mb-1 font-medium">{t("present")}</legend>
            {members.length > 0 ? (
              <ul className="grid gap-1 sm:grid-cols-2">
                {members.map((m) => (
                  <li key={m.userId}>
                    <label className="hover:bg-muted/50 flex items-start gap-2 rounded-md px-1 py-1">
                      <input
                        type="checkbox"
                        className="accent-primary mt-0.5 size-4"
                        checked={v.participantIds.includes(m.userId)}
                        onChange={(e) =>
                          set(
                            "participantIds",
                            e.target.checked
                              ? [...v.participantIds, m.userId]
                              : v.participantIds.filter((id) => id !== m.userId),
                          )
                        }
                      />
                      <span>
                        {m.name}{" "}
                        <span className="text-muted-foreground text-xs">
                          · {m.roles.map((r) => tRoles(r)).join(", ")}
                        </span>
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-muted-foreground text-xs">{t("noMembers")}</p>
            )}
            <input
              value={v.participants}
              onChange={(e) => set("participants", e.target.value)}
              placeholder={t("othersPlaceholder")}
              maxLength={500}
              aria-label={t("others")}
              className={field}
            />
          </fieldset>

          <section className="flex flex-col gap-4 rounded-xl border p-4">
            <h2 className="text-sm font-semibold">{t("assessment")}</h2>
            {blockAreas.map((area) => {
              const block = blockFor(area);
              return (
                <fieldset key={area ?? "general"} className="flex flex-col gap-2">
                  <legend className="mb-1 text-sm font-semibold">
                    {area === null
                      ? t("generalBlock")
                      : `${area} · ${areas.find((a) => a.number === area)?.name ?? ""}`}
                  </legend>
                  {BLOCK.map((k) => (
                    <label key={k} className="flex flex-col gap-1 text-sm">
                      <span className="font-medium">{t(`assessmentFields.${k}`)}</span>
                      <textarea
                        value={block[k]}
                        onChange={(e) => setBlock(area, { [k]: e.target.value })}
                        placeholder={t(`assessmentPlaceholders.${k}`)}
                        rows={2}
                        maxLength={3000}
                        className={field}
                      />
                    </label>
                  ))}
                </fieldset>
              );
            })}
            <label className="flex flex-col gap-1 border-t pt-3 text-sm">
              <span className="font-semibold">{t("overallTitle")}</span>
              <textarea
                value={v.assessment.overall}
                onChange={(e) => set("assessment", { ...v.assessment, overall: e.target.value })}
                placeholder={t("assessmentPlaceholders.overall")}
                rows={3}
                maxLength={3000}
                className={field}
              />
            </label>
          </section>

          {legacySummary && (
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium">{t("legacySummary")}</span>
              <textarea
                value={v.summary}
                onChange={(e) => set("summary", e.target.value)}
                rows={4}
                maxLength={5000}
                className={field}
              />
            </label>
          )}

          {legacyFindings && (
            <section className="flex flex-col gap-3 rounded-xl border p-4">
              <h2 className="text-sm font-semibold">
                {t("findings")}{" "}
                <span className="text-muted-foreground font-normal">· {t("optional")}</span>
              </h2>
              {v.findings.map((f, i) => (
                <div key={i} className="flex flex-col gap-2">
                  <div className="flex gap-2">
                    <select
                      value={f.area}
                      aria-label={t("area")}
                      onChange={(e) =>
                        set(
                          "findings",
                          v.findings.map((x, j) =>
                            j === i ? { ...x, area: Number(e.target.value) } : x,
                          ),
                        )
                      }
                      className={field}
                    >
                      {areas
                        .filter((a) => a.number === f.area || !usedAreas.has(a.number))
                        .map((a) => (
                          <option key={a.number} value={a.number}>
                            {a.number} · {a.name}
                          </option>
                        ))}
                    </select>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label={t("remove")}
                      onClick={() =>
                        set(
                          "findings",
                          v.findings.filter((_, j) => j !== i),
                        )
                      }
                    >
                      <Trash2 aria-hidden />
                    </Button>
                  </div>
                  <textarea
                    value={f.text}
                    aria-label={t("findingText")}
                    onChange={(e) =>
                      set(
                        "findings",
                        v.findings.map((x, j) => (j === i ? { ...x, text: e.target.value } : x)),
                      )
                    }
                    rows={2}
                    maxLength={2000}
                    className={field}
                  />
                </div>
              ))}
              {freeArea && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="self-start"
                  onClick={() =>
                    set("findings", [...v.findings, { area: freeArea.number, text: "" }])
                  }
                >
                  <Plus aria-hidden /> {t("addFinding")}
                </Button>
              )}
            </section>
          )}

          <section className="flex flex-col gap-3 rounded-xl border p-4">
            <h2 className="text-sm font-semibold">{t("actions")}</h2>
            {v.actions.map((a, i) => {
              const update = (patch: Partial<VisitFormValue["actions"][number]>) =>
                set(
                  "actions",
                  v.actions.map((x, j) => (j === i ? { ...x, ...patch } : x)),
                );
              return (
                <div
                  key={a.id ?? `new-${i}`}
                  className="flex flex-col gap-2 border-t pt-3 first:border-t-0 first:pt-0"
                >
                  <div className="flex gap-2">
                    <input
                      value={a.text}
                      onChange={(e) => update({ text: e.target.value })}
                      placeholder={t("actionText")}
                      aria-label={t("actionText")}
                      maxLength={500}
                      className={field}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label={t("remove")}
                      onClick={() =>
                        set(
                          "actions",
                          v.actions.filter((_, j) => j !== i),
                        )
                      }
                    >
                      <Trash2 aria-hidden />
                    </Button>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <select
                      value={a.area ?? ""}
                      aria-label={t("area")}
                      onChange={(e) =>
                        update({ area: e.target.value ? Number(e.target.value) : null })
                      }
                      className={field}
                    >
                      <option value="">{t("noArea")}</option>
                      {areas.map((x) => (
                        <option key={x.number} value={x.number}>
                          {x.number} · {x.name}
                        </option>
                      ))}
                    </select>
                    <select
                      value={a.ownerId ?? (a.ownerOther || a.owner ? OTHER : "")}
                      aria-label={t("owner")}
                      onChange={(e) => {
                        const m = members.find((x) => x.userId === e.target.value);
                        if (m) update({ ownerId: m.userId, owner: m.name, ownerOther: false });
                        else if (e.target.value === OTHER)
                          update({ ownerId: null, owner: "", ownerOther: true });
                        else update({ ownerId: null, owner: "", ownerOther: false });
                      }}
                      className={field}
                    >
                      <option value="">{t("owner")}</option>
                      {members.map((m) => (
                        <option key={m.userId} value={m.userId}>
                          {m.name}
                        </option>
                      ))}
                      <option value={OTHER}>{t("ownerOther")}</option>
                    </select>
                  </div>
                  {a.ownerId === null && (a.ownerOther || a.owner) && (
                    <input
                      value={a.owner}
                      onChange={(e) => update({ owner: e.target.value })}
                      placeholder={t("ownerName")}
                      aria-label={t("ownerName")}
                      maxLength={120}
                      className={field}
                    />
                  )}
                  <label className="flex items-center gap-2 text-sm">
                    <span className="text-muted-foreground shrink-0">{t("due")}</span>
                    <input
                      type="date"
                      value={a.dueDate ?? ""}
                      onChange={(e) => update({ dueDate: e.target.value || null })}
                      className={field}
                    />
                  </label>
                </div>
              );
            })}
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="self-start"
              onClick={() =>
                set("actions", [
                  ...v.actions,
                  { text: "", area: null, owner: "", ownerId: null, dueDate: null },
                ])
              }
            >
              <Plus aria-hidden /> {t("addAction")}
            </Button>
          </section>
        </>
      )}

      <div className="flex flex-col gap-2">
        {confirm === "send" ? (
          <div className="flex flex-col gap-2 rounded-xl border p-3 text-sm">
            <p>{t("confirmSend")}</p>
            <div className="flex flex-wrap gap-2">
              <Button type="button" disabled={pending} onClick={() => save("send")}>
                {t("yesSend")}
              </Button>
              <Button type="button" variant="outline" onClick={() => setConfirm(null)}>
                {t("no")}
              </Button>
            </div>
          </div>
        ) : confirm === "withdraw" ? (
          <div className="flex flex-col gap-2 rounded-xl border p-3 text-sm">
            <p>{t("confirmWithdraw")}</p>
            <div className="flex flex-wrap gap-2">
              <Button type="button" disabled={pending} onClick={withdraw}>
                {t("yesWithdraw")}
              </Button>
              <Button type="button" variant="outline" onClick={() => setConfirm(null)}>
                {t("no")}
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
            <Button
              type="submit"
              variant={status === "sent" || planning ? "default" : "outline"}
              disabled={pending}
            >
              {planning
                ? t("savePlanned")
                : status === "sent" || status === "planned"
                  ? t("saveChanges")
                  : t("saveDraft")}
            </Button>
            {status !== "sent" && !planning && (
              <Button type="button" disabled={pending} onClick={() => setConfirm("send")}>
                {status === "planned" ? t("sendAfter") : t("send")}
              </Button>
            )}
            {visitId && (
              <Button
                type="button"
                variant="ghost"
                disabled={pending}
                onClick={() => setConfirm("withdraw")}
              >
                {t("withdraw")}
              </Button>
            )}
          </div>
        )}
        <p className="text-muted-foreground text-xs">
          {status === "sent"
            ? t("sentHint")
            : status === "planned" || planning
              ? t("plannedHint")
              : t("draftHint")}
        </p>
        <p role="status" aria-live="polite" className="text-sm">
          {message}
        </p>
      </div>
    </form>
  );
}
