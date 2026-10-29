"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";

import { Button, Checkbox } from "@/components/sfz";

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
      <p className="footnote text-(--ink-muted)">{t("hint")}</p>
      <div className="grid gap-3 sm:grid-cols-2">
        {areas.map((area) => (
          <fieldset
            key={area}
            className="flex flex-col rounded-(--radius-sm) border border-(--hairline) px-3 pb-1"
          >
            <legend className="label px-1">
              {area}. {props.areaNames[area] ?? t("area", { area })}
            </legend>
            {props.options
              .filter((o) => o.area === area)
              .map((o) => {
                const id = `${o.area}.${o.key}`;
                return (
                  <Checkbox
                    key={id}
                    label={o.name}
                    description={o.status === "proposal" ? t("proposal") : undefined}
                    checked={chosen.has(id)}
                    onChange={() => toggle(id)}
                  />
                );
              })}
          </fieldset>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Button
          size="sm"
          icon="check"
          loading={pending}
          onClick={() =>
            startTransition(async () => {
              const res = await saveAreaRolesAction(props.clubId, [...chosen]);
              setMessage(res.status === "ok" ? "saved" : "error");
            })
          }
        >
          {t("save")}
        </Button>
        <span role="status" className="footnote">
          {message === "saved" && t("saved")}
          {message === "error" && <span className="text-(--danger)">{t("error")}</span>}
        </span>
      </div>
    </div>
  );
}
