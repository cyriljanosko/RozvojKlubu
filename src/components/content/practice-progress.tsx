"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";

import { saveProgressAction } from "@/app/oblasti/[area]/actions";

/** Club progress in the Prax of an area (F6d): state in the browser, every change saved at once. */
export interface ProgressStep {
  stepId: string;
  option: number | null;
  done: boolean;
  doneAt: string | null;
}

interface ProgressState {
  tasks: string[];
  steps: ProgressStep[];
}

type SaveStatus = "idle" | "saving" | "saved" | "conflict" | "error";

interface ProgressContextValue {
  editable: boolean;
  state: ProgressState;
  status: SaveStatus;
  toggleTask: (id: string) => void;
  pickOption: (stepId: string, option: number) => void;
  toggleDone: (stepId: string) => void;
}

const ProgressContext = createContext<ProgressContextValue | null>(null);

export function ProgressProvider({
  clubId,
  area,
  editable,
  version,
  initial,
  children,
}: {
  clubId: string;
  area: number;
  editable: boolean;
  version: number;
  initial: ProgressState;
  children: ReactNode;
}) {
  const router = useRouter();
  const [state, setState] = useState(initial);
  // latest state outside React's updater (updaters may run twice in StrictMode – no side effects there)
  const stateRef = useRef(initial);
  const [status, setStatus] = useState<SaveStatus>("idle");
  const versionRef = useRef(version);
  const queue = useRef<Promise<void>>(Promise.resolve());

  const save = useCallback(
    (next: ProgressState) => {
      setStatus("saving");
      // saves run one after another so each one carries the version returned by the previous
      queue.current = queue.current.then(async () => {
        const result = await saveProgressAction(clubId, area, {
          tasks: next.tasks,
          steps: next.steps.map(({ stepId, option, done }) => ({ stepId, option, done })),
          expectedVersion: versionRef.current,
        });
        if (result.status === "ok") {
          versionRef.current = result.version;
          const doneAt = new Map(result.steps.map((s) => [s.stepId, s.doneAt]));
          const merged = {
            ...stateRef.current,
            steps: stateRef.current.steps.map((x) => ({
              ...x,
              doneAt: doneAt.get(x.stepId) ?? x.doneAt,
            })),
          };
          stateRef.current = merged;
          setState(merged);
          setStatus("saved");
        } else if (result.code === "CONFLICT") {
          setStatus("conflict");
          router.refresh();
        } else {
          setStatus("error");
        }
      });
    },
    [area, clubId, router],
  );

  const update = useCallback(
    (change: (s: ProgressState) => ProgressState) => {
      if (!editable) return;
      const next = change(stateRef.current);
      stateRef.current = next;
      setState(next);
      save(next);
    },
    [editable, save],
  );

  const setStep = (s: ProgressState, stepId: string, patch: Partial<ProgressStep>) => {
    const current = s.steps.find((x) => x.stepId === stepId) ?? {
      stepId,
      option: null,
      done: false,
      doneAt: null,
    };
    return {
      ...s,
      steps: [...s.steps.filter((x) => x.stepId !== stepId), { ...current, ...patch }],
    };
  };

  const value: ProgressContextValue = {
    editable,
    state,
    status,
    toggleTask: (id) =>
      update((s) => ({
        ...s,
        tasks: s.tasks.includes(id) ? s.tasks.filter((x) => x !== id) : [...s.tasks, id],
      })),
    pickOption: (stepId, option) =>
      update((s) => {
        const current = s.steps.find((x) => x.stepId === stepId);
        return setStep(s, stepId, { option: current?.option === option ? null : option });
      }),
    toggleDone: (stepId) =>
      update((s) => {
        const done = !s.steps.find((x) => x.stepId === stepId)?.done;
        return setStep(s, stepId, { done, doneAt: done ? new Date().toISOString() : null });
      }),
  };

  return <ProgressContext.Provider value={value}>{children}</ProgressContext.Provider>;
}

const useProgress = () => useContext(ProgressContext);

/** Checkbox of a first-step task; plain number marker without progress. */
export function TaskCheck({ taskId, label }: { taskId: string; label: string }) {
  const p = useProgress();
  if (!p) return null;
  const checked = p.state.tasks.includes(taskId);
  return (
    <input
      type="checkbox"
      className="accent-primary mt-0.5 size-4 shrink-0"
      checked={checked}
      disabled={!p.editable}
      onChange={() => p.toggleTask(taskId)}
      aria-label={label}
    />
  );
}

/** "Choose this option" control on an option card of a step. */
export function OptionPick({ stepId, option }: { stepId: string; option: number }) {
  const t = useTranslations("practice.progress");
  const p = useProgress();
  if (!p) return null;
  const chosen = p.state.steps.find((s) => s.stepId === stepId)?.option === option;
  if (!p.editable) {
    return chosen ? (
      <span className="bg-primary text-primary-foreground self-start rounded-full px-2 py-0.5 text-xs">
        {t("chosen")}
      </span>
    ) : null;
  }
  return (
    <button
      type="button"
      onClick={() => p.pickOption(stepId, option)}
      aria-pressed={chosen}
      className="aria-pressed:bg-primary aria-pressed:text-primary-foreground hover:bg-muted mt-1 self-start rounded-md border px-2.5 py-1 text-xs font-medium"
    >
      {chosen ? `✓ ${t("chosen")}` : t("choose")}
    </button>
  );
}

/** Done toggle of a step with the date it was done. */
export function StepDone({ stepId }: { stepId: string }) {
  const t = useTranslations("practice.progress");
  const p = useProgress();
  if (!p) return null;
  const step = p.state.steps.find((s) => s.stepId === stepId);
  const date = step?.doneAt
    ? new Date(step.doneAt).toLocaleDateString("sk", { timeZone: "Europe/Bratislava" })
    : "";
  if (!p.editable) {
    return step?.done ? (
      <p className="text-sm font-medium text-green-700 dark:text-green-500">
        ✓ {t("doneOn", { date })}
      </p>
    ) : null;
  }
  return (
    <button
      type="button"
      onClick={() => p.toggleDone(stepId)}
      aria-pressed={step?.done ?? false}
      className="hover:bg-muted self-start rounded-md border px-3 py-1.5 text-sm font-medium aria-pressed:border-green-700 aria-pressed:text-green-700 dark:aria-pressed:border-green-500 dark:aria-pressed:text-green-500"
    >
      {step?.done ? `✓ ${t("doneOn", { date })}` : t("markDone")}
    </button>
  );
}

/** Progress of the shown role: first-step tasks and path steps, with the save status. */
export function RoleProgressBar({
  clubName,
  taskIds,
  stepIds,
}: {
  clubName: string;
  taskIds: string[];
  stepIds: string[];
}) {
  const t = useTranslations("practice.progress");
  const p = useProgress();
  if (!p) return null;
  const tasks = taskIds.filter((id) => p.state.tasks.includes(id)).length;
  const steps = stepIds.filter((id) => p.state.steps.some((s) => s.stepId === id && s.done)).length;
  const share = Math.round(((tasks + steps) / Math.max(1, taskIds.length + stepIds.length)) * 100);
  return (
    <div className="flex flex-col gap-2 rounded-xl border p-4 text-sm">
      <p className="font-semibold break-words">{t("title", { club: clubName })}</p>
      <div className="bg-muted h-2 overflow-hidden rounded-full" aria-hidden>
        <div className="bg-primary h-full" style={{ width: `${share}%` }} />
      </div>
      <p className="text-muted-foreground text-xs">
        {t("summary", {
          tasks,
          tasksTotal: taskIds.length,
          steps,
          stepsTotal: stepIds.length,
        })}
        {!p.editable && ` · ${t("readOnly")}`}
      </p>
      <p className="text-xs" role="status" aria-live="polite">
        {p.status === "saving" && t("saving")}
        {p.status === "saved" && t("saved")}
        {p.status === "conflict" && <span className="text-destructive">{t("conflict")}</span>}
        {p.status === "error" && <span className="text-destructive">{t("error")}</span>}
      </p>
    </div>
  );
}
