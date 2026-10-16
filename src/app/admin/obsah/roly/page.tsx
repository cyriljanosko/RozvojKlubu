import type { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getFormatter, getTranslations } from "next-intl/server";
import { Suspense } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { defaultMessages } from "@/i18n/config";
import { getCurrentUser } from "@/server/auth/session";
import { mongoContentStore, mongoRoleCatalogStore } from "@/server/db/content.store";
import { isAdmin } from "@/server/services/club-access";
import { getRoleCatalog, listRoleCatalogRevisions } from "@/server/services/role-catalog.service";

import { revertRoleCatalogAction } from "../actions";
import { RoleCatalogForm } from "./role-catalog-form";

export const metadata: Metadata = { title: defaultMessages.admin.content.roles.title };

async function RoleCatalogEditor() {
  const user = await getCurrentUser(await headers());
  if (!user) redirect("/prihlasenie");
  const t = await getTranslations("admin.content");
  if (!isAdmin(user)) {
    const tClub = await getTranslations("club");
    return <p className="text-sm">{tClub("forbidden")}</p>;
  }
  const catalog = await getRoleCatalog(mongoRoleCatalogStore, user);
  if (!catalog) return <p className="text-sm">{t("roles.missing")}</p>;
  const history = await listRoleCatalogRevisions(mongoContentStore, user);
  const format = await getFormatter();
  const c = catalog.content;

  return (
    <div className="flex flex-col gap-4">
      <header className="flex flex-col gap-1">
        <Link
          href="/admin/obsah"
          className="text-muted-foreground text-sm underline underline-offset-4"
        >
          {t("areas")}
        </Link>
        <h1 className="text-xl font-semibold">{t("roles.title")}</h1>
        <p className="text-sm">{t("roles.intro")}</p>
        <p className="text-muted-foreground text-xs">
          {t("question.version", { version: catalog.version })} ·{" "}
          {t("roles.source", { source: c.source })}
        </p>
      </header>
      <section className="flex flex-col gap-1 text-sm">
        <p>{t("roles.summaryBase", { list: c.baseRoles.map((b) => b.name).join(", ") })}</p>
        <ul className="text-muted-foreground grid gap-0.5 text-xs sm:grid-cols-2">
          {c.areas.map((a) => (
            <li key={a.area}>
              {t("roles.summaryArea", {
                area: a.area,
                count: a.roles.length,
                status: t(`roles.status.${a.status}`),
              })}
            </li>
          ))}
        </ul>
      </section>
      <Card>
        <CardContent>
          <RoleCatalogForm
            key={catalog.version}
            json={JSON.stringify(c, null, 2)}
            version={catalog.version}
          />
        </CardContent>
      </Card>
      <details className="text-xs">
        <summary className="text-muted-foreground cursor-pointer">
          {t("question.history")} ({history.length})
        </summary>
        {history.length === 0 ? (
          <p className="text-muted-foreground mt-2">{t("question.noHistory")}</p>
        ) : (
          <ul className="mt-2 flex flex-col gap-2">
            {history.map((rev) => (
              <li key={rev.id} className="flex flex-wrap items-center gap-2 rounded-md border p-2">
                <span className="text-muted-foreground">
                  {t("question.version", { version: rev.version })} ·{" "}
                  {format.dateTime(new Date(rev.changedAt), {
                    dateStyle: "short",
                    timeStyle: "short",
                  })}
                </span>
                <form action={revertRoleCatalogAction.bind(null, rev.id)}>
                  <Button type="submit" size="sm" variant="outline">
                    {t("question.revert")}
                  </Button>
                </form>
              </li>
            ))}
          </ul>
        )}
      </details>
    </div>
  );
}

export default function RoleCatalogPage() {
  return (
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col px-4 py-10 sm:py-16">
      <Suspense fallback={<div className="h-64" aria-hidden />}>
        <RoleCatalogEditor />
      </Suspense>
    </main>
  );
}
