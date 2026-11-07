import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { EmptyState, LinkButton } from "@/components/sfz";
import { defaultMessages } from "@/i18n/config";

export const metadata: Metadata = { title: defaultMessages.forbidden.title };

/** 403 for signed-in people without access – pages call forbidden() (G5 states, authInterrupts). */
export default async function Forbidden() {
  const t = await getTranslations("forbidden");
  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col justify-center px-4 py-10">
      <EmptyState
        icon="alert-triangle"
        title={t("title")}
        description={t("text")}
        action={<LinkButton href="/">{t("home")}</LinkButton>}
      />
    </main>
  );
}
