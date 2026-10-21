"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { MentorVisitForm, MentorVisitStatus } from "@/server/db/types";

import { saveVisitAction, sendVisitAction, withdrawVisitAction } from "./actions";

export interface VisitFormValue {
  date: string;
  form: MentorVisitForm;
  participantIds: string[];
  participants: string;
  summary: string;
  findings: { area: number; text: string }[];
  actions: {
    id?: string;
    text: string;
    area: number | null;
    owner: string;
    dueDate: string | null;
  }[];
}

const FORMS: MentorVisitForm[] = ["onsite", "online", "phone"];
const field =
  "border-input bg-background focus-visible:ring-ring w-full rounded-md border px-3 py-2 text-sm focus-visible:ring-2 focus-visible:outline-none";

/** The mentor's visit form (MV-b): draft → sent to the club; edits allowed until withdrawn. */
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
      const input = {
        ...v,
        actions: v.actions.map((a) => ({ ...a, dueDate: a.dueDate || null })),
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

      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium">{t("summary")}</span>
        <textarea
          value={v.summary}
          onChange={(e) => set("summary", e.target.value)}
          placeholder={t("summaryPlaceholder")}
          rows={4}
          maxLength={5000}
          className={field}
        />
      </label>

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
            onClick={() => set("findings", [...v.findings, { area: freeArea.number, text: "" }])}
          >
            <Plus aria-hidden /> {t("addFinding")}
          </Button>
        )}
      </section>

      <section className="flex flex-col gap-3 rounded-xl border p-4">
        <h2 className="text-sm font-semibold">{t("actions")}</h2>
        <datalist id="visit-owners">
          {members.map((m) => (
            <option key={m.userId} value={m.name} />
          ))}
        </datalist>
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
                  onChange={(e) => update({ area: e.target.value ? Number(e.target.value) : null })}
                  className={field}
                >
                  <option value="">{t("noArea")}</option>
                  {areas.map((x) => (
                    <option key={x.number} value={x.number}>
                      {x.number} · {x.name}
                    </option>
                  ))}
                </select>
                <input
                  value={a.owner}
                  list="visit-owners"
                  onChange={(e) => update({ owner: e.target.value })}
                  placeholder={t("owner")}
                  aria-label={t("owner")}
                  maxLength={120}
                  className={field}
                />
              </div>
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
            set("actions", [...v.actions, { text: "", area: null, owner: "", dueDate: null }])
          }
        >
          <Plus aria-hidden /> {t("addAction")}
        </Button>
      </section>

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
              variant={status === "sent" ? "default" : "outline"}
              disabled={pending}
            >
              {status === "sent" ? t("saveChanges") : t("saveDraft")}
            </Button>
            {status !== "sent" && (
              <Button type="button" disabled={pending} onClick={() => setConfirm("send")}>
                {t("send")}
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
          {status === "sent" ? t("sentHint") : t("draftHint")}
        </p>
        <p role="status" aria-live="polite" className="text-sm">
          {message}
        </p>
      </div>
    </form>
  );
}
