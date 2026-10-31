"use client";

import { useTranslations } from "next-intl";

import { Checkbox, Input, Textarea } from "@/components/sfz";
import type { NewsKind, NewsSectionKey } from "@/server/db/types";

export interface NewsContent {
  title: string;
  areas: number[];
  sections: { key: NewsSectionKey; text: string }[];
}

const CLUB_KEYS: NewsSectionKey[] = ["start", "done", "result", "advice"];

/** Title, up to three areas and the guided parts of a post (club) or its text (academy news). */
export function NewsFields({
  kind,
  value,
  onChange,
  areas,
  disabled,
}: {
  kind: NewsKind;
  value: NewsContent;
  onChange: (next: NewsContent) => void;
  areas: { number: number; name: string }[];
  disabled?: boolean;
}) {
  const t = useTranslations("newsEditor");
  const keys: NewsSectionKey[] = kind === "academy" ? ["body"] : CLUB_KEYS;
  const text = (key: NewsSectionKey) => value.sections.find((s) => s.key === key)?.text ?? "";
  const setText = (key: NewsSectionKey, next: string) =>
    onChange({
      ...value,
      sections: keys.map((k) => ({ key: k, text: k === key ? next : text(k) })),
    });
  const toggleArea = (n: number, on: boolean) =>
    onChange({
      ...value,
      areas: on ? [...value.areas, n].sort((a, b) => a - b) : value.areas.filter((a) => a !== n),
    });

  return (
    <div className="flex flex-col gap-4">
      <Input
        label={t("title")}
        hint={t("titleHint")}
        value={value.title}
        maxLength={140}
        disabled={disabled}
        onChange={(e) => onChange({ ...value, title: e.target.value })}
      />
      <fieldset className="flex flex-col gap-2" disabled={disabled}>
        <legend className="label mb-1">{t("areas")}</legend>
        <p className="footnote text-(--ink-muted)">{t("areasHint")}</p>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {areas.map((a) => {
            const checked = value.areas.includes(a.number);
            return (
              <Checkbox
                key={a.number}
                label={`${a.number} · ${a.name}`}
                checked={checked}
                disabled={disabled || (!checked && value.areas.length >= 3)}
                onChange={(e) => toggleArea(a.number, e.target.checked)}
              />
            );
          })}
        </div>
      </fieldset>
      {keys.map((key) => (
        <Textarea
          key={key}
          label={t(`sections.${key}`)}
          hint={t(`hints.${key}`)}
          value={text(key)}
          rows={key === "body" ? 12 : 5}
          maxLength={20000}
          disabled={disabled}
          onChange={(e) => setText(key, e.target.value)}
        />
      ))}
    </div>
  );
}
