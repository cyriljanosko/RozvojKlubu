"use client";

import { useState, useTransition } from "react";
import { Save } from "lucide-react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";

import { saveAreaRolesAction } from "./actions";

export interface RoleOption {
  area: number;
  key: string;
  name: string;
  status: "approved" | "proposal";
}

/** The user's own roles in the areas for one club (F6b). */
export function AreaRolesForm(props: {
  clubId: string;
  options: RoleOption[];
  chosen: string[];
  areaNames: Record<number, string>;
}) {
  const t = useTranslations("academy.roles");
  const [chosen, setChosen] = useState(() => new Set(props.chosen));
  const [message, setMessage] = useState<"saved" | "error" | null>(null);
  const [pending, startTransition] = useTransition();
  const areas = [...new Set(props.options.map((o) => o.area))].sort((a, b) => a - b);

  const toggle = (id: string) =>
    setChosen((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <div className="flex flex-col gap-3">
      <p className="text-muted-foreground text-sm">{t("hint")}</p>
      <div className="grid gap-3 sm:grid-cols-2">
        {areas.map((area) => (
          <fieldset key={area} className="flex flex-col gap-1 rounded-md border p-2">
            <legend className="px-1 text-xs font-semibold">
              {area}. {props.areaNames[area] ?? t("area", { area })}
            </legend>
            {props.options
              .filter((o) => o.area === area)
              .map((o) => {
                const id = `${o.area}.${o.key}`;
                return (
                  <label key={id} className="flex items-start gap-2 text-sm">
                    <input
                      type="checkbox"
                      className="mt-0.5 size-4 shrink-0"
                      checked={chosen.has(id)}
                      onChange={() => toggle(id)}
                    />
                    <span>
                      {o.name}
                      {o.status === "proposal" && (
                        <span className="text-muted-foreground text-xs"> · {t("proposal")}</span>
                      )}
                    </span>
                  </label>
                );
              })}
          </fieldset>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Button
          type="button"
          size="sm"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              const res = await saveAreaRolesAction(props.clubId, [...chosen]);
              setMessage(res.status === "ok" ? "saved" : "error");
            })
          }
        >
          <Save aria-hidden />
          {t("save")}
        </Button>
        <span role="status" className="text-xs">
          {message === "saved" && t("saved")}
          {message === "error" && <span className="text-destructive">{t("error")}</span>}
        </span>
      </div>
    </div>
  );
}
