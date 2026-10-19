import Link from "next/link";
import { Search } from "lucide-react";
import { getTranslations } from "next-intl/server";

/** Search field (H6): a plain GET form to /hladat, works without JavaScript. */
export async function SearchForm({
  defaultValue = "",
  tips = false,
  size = "large",
}: {
  defaultValue?: string;
  tips?: boolean;
  size?: "large" | "compact";
}) {
  const t = await getTranslations("search");
  const large = size === "large";
  return (
    <div className="flex flex-col gap-2">
      <form action="/hladat" method="get" role="search" className="flex gap-2">
        <label className="relative min-w-0 flex-1">
          <span className="sr-only">{t("label")}</span>
          <Search
            aria-hidden
            className={`text-muted-foreground pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 ${large ? "size-5" : "size-4"}`}
          />
          <input
            type="search"
            name="q"
            defaultValue={defaultValue}
            placeholder={t("placeholder")}
            maxLength={100}
            enterKeyHint="search"
            className={`bg-background focus-visible:ring-ring w-full rounded-lg border focus-visible:ring-2 focus-visible:outline-none ${large ? "h-12 pr-3 pl-10 text-base" : "h-9 pr-2 pl-9 text-sm"}`}
          />
        </label>
        {large && (
          <button
            type="submit"
            className="bg-primary text-primary-foreground hover:bg-primary/90 h-12 shrink-0 rounded-lg px-4 text-sm font-medium"
          >
            {t("button")}
          </button>
        )}
      </form>
      {tips && (
        <p className="flex flex-wrap items-center gap-1.5 text-sm">
          <span className="text-muted-foreground">{t("tipsTitle")}</span>
          {(t.raw("tips") as string[]).map((tip) => (
            <Link
              key={tip}
              href={`/hladat?q=${encodeURIComponent(tip)}`}
              className="hover:bg-muted rounded-full border px-2.5 py-0.5"
            >
              {tip}
            </Link>
          ))}
        </p>
      )}
    </div>
  );
}
