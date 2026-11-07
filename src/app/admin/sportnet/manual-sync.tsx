"use client";

import { useRouter } from "next/navigation";
import { useFormatter, useTranslations } from "next-intl";
import { useState } from "react";

import {
  Alert,
  Badge,
  Button,
  Card,
  Icon,
  Modal,
  Skeleton,
  Stepper,
  Toast,
  type ToastItem,
  type Tone,
} from "@/components/sfz";
import type { ManualSyncResult } from "@/server/services/sync-runs.service";

import { durationParts } from "./format";

type Phase =
  | { name: "idle" }
  | { name: "dry" }
  | { name: "dryDone"; result: ManualSyncResult; durationMs: number }
  | { name: "error"; forbidden: boolean }
  | { name: "applying"; result: ManualSyncResult }
  | { name: "done" };

const BADGE: Record<Phase["name"], Tone> = {
  idle: "neutral",
  dry: "info",
  dryDone: "brand",
  error: "danger",
  applying: "info",
  done: "success",
};

const STEP: Record<Phase["name"], number> = {
  idle: 0,
  dry: 0,
  error: 0,
  dryDone: 1,
  applying: 2,
  done: 3,
};

const COUNTS = ["sportnetClubs", "created", "updated", "skipped", "checked", "failed"] as const;

class SyncError extends Error {
  constructor(readonly code: string) {
    super(code);
  }
}

/** POST /api/v1/admin/sportnet/sync (ADR 0030); takes about two minutes. */
async function runSync(apply: boolean): Promise<ManualSyncResult> {
  let response: Response;
  try {
    response = await fetch("/api/v1/admin/sportnet/sync", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ apply }),
    });
  } catch {
    throw new SyncError("NETWORK");
  }
  const body = (await response.json().catch(() => null)) as {
    data?: ManualSyncResult;
    error?: { code?: string };
  } | null;
  if (!response.ok || !body?.data) throw new SyncError(body?.error?.code ?? "INTERNAL");
  return body.data;
}

/**
 * Manual run of the club sync (G5 Sportnet): dry-run → check → write after a confirmation Modal.
 * The "running" state lives only in this browser; the run on the server finishes either way.
 */
export function ManualSync() {
  const t = useTranslations("adminSportnet.manual");
  const tSync = useTranslations("adminSportnet");
  const format = useFormatter();
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>({ name: "idle" });
  const [confirming, setConfirming] = useState(false);
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const fail = (error: unknown) =>
    setPhase({
      name: "error",
      forbidden: error instanceof SyncError && ["UNAUTHORIZED", "FORBIDDEN"].includes(error.code),
    });

  async function startDry() {
    setPhase({ name: "dry" });
    const started = Date.now();
    try {
      const result = await runSync(false);
      setPhase({ name: "dryDone", result, durationMs: Date.now() - started });
    } catch (error) {
      fail(error);
    }
  }

  async function apply(preview: ManualSyncResult) {
    setConfirming(false);
    setPhase({ name: "applying", result: preview });
    try {
      const result = await runSync(true);
      setPhase({ name: "done" });
      setToasts([
        {
          id: Date.now(),
          tone: "success",
          message: t("toast", {
            created: result.created,
            updated: result.updated,
            failed: result.failed,
          }),
        },
      ]);
      router.refresh();
    } catch (error) {
      fail(error);
    }
  }

  const running = (title: string) => (
    <div role="status" aria-live="polite" className="flex flex-col gap-3">
      <p className="headline flex items-center gap-2">
        <Icon name="loader" size={20} className="animate-spin" />
        {title}
      </p>
      <p className="callout text-(--ink-muted)">{t("runningHint")}</p>
      <Skeleton shape="text" lines={3} />
    </div>
  );

  return (
    <Card
      title={t("title")}
      action={<Badge tone={BADGE[phase.name]}>{t(`badge.${phase.name}`)}</Badge>}
    >
      <div className="flex flex-col gap-4">
        <Stepper
          current={STEP[phase.name]}
          steps={[
            { label: t("steps.dry"), description: t("steps.dryHint") },
            { label: t("steps.check"), description: t("steps.checkHint") },
            { label: t("steps.apply"), description: t("steps.applyHint") },
          ]}
        />

        {phase.name === "idle" && (
          <div className="flex flex-col items-start gap-3">
            <p className="callout">
              <span className="md:hidden">{t("idleTextMobile")}</span>
              <span className="hidden md:inline">{t("idleText")}</span>
            </p>
            <Button icon="search" onClick={startDry} className="max-md:w-full">
              {t("startDry")}
            </Button>
          </div>
        )}

        {phase.name === "dry" && running(t("dryRunning"))}
        {phase.name === "applying" && running(t("applyRunning"))}

        {phase.name === "dryDone" && (
          <div className="flex flex-col gap-4">
            <Alert
              tone="info"
              title={t("dryDoneTitle", {
                duration: tSync("duration", durationParts(phase.durationMs)),
              })}
            >
              {t("dryDoneText")}
            </Alert>
            <dl className="grid grid-cols-[repeat(auto-fill,minmax(140px,1fr))] gap-3">
              {COUNTS.map((key) => (
                <div key={key} className="flex flex-col gap-0.5">
                  <dt className="footnote text-(--ink-muted)">{t(`counts.${key}`)}</dt>
                  <dd className="title-3 tabular-nums">{format.number(phase.result[key])}</dd>
                </div>
              ))}
            </dl>
            <div className="flex flex-col gap-2 md:flex-row">
              <Button onClick={() => setConfirming(true)}>{t("apply")}</Button>
              <Button variant="secondary" onClick={() => setPhase({ name: "idle" })}>
                {t("cancel")}
              </Button>
            </div>
            <Modal
              open={confirming}
              onClose={() => setConfirming(false)}
              title={t("confirmTitle")}
              size="sm"
              footer={
                <>
                  <Button variant="secondary" onClick={() => setConfirming(false)}>
                    {t("cancel")}
                  </Button>
                  <Button onClick={() => apply(phase.result)}>{t("confirm")}</Button>
                </>
              }
            >
              <div className="flex flex-col gap-2">
                <p className="callout">
                  {t("confirmText", {
                    created: phase.result.created,
                    updated: phase.result.updated,
                    checked: phase.result.checked,
                  })}
                </p>
                <p className="footnote text-(--ink-muted)">{t("confirmNote")}</p>
              </div>
            </Modal>
          </div>
        )}

        {phase.name === "error" && (
          <Alert
            tone="danger"
            title={phase.forbidden ? t("badge.error") : t("errorTitle")}
            action={
              phase.forbidden ? undefined : (
                <Button variant="secondary" size="sm" onClick={startDry}>
                  {t("retry")}
                </Button>
              )
            }
          >
            {phase.forbidden ? t("forbiddenText") : t("errorText")}
          </Alert>
        )}

        {phase.name === "done" && (
          <Alert
            tone="success"
            title={t("doneTitle")}
            action={
              <Button variant="secondary" size="sm" onClick={startDry}>
                {t("newDry")}
              </Button>
            }
          >
            {t("doneText")}
          </Alert>
        )}
      </div>
      <Toast
        items={toasts}
        onDismiss={(id) => setToasts((items) => items.filter((item) => item.id !== id))}
      />
    </Card>
  );
}
