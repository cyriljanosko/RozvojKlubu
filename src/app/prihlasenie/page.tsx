import type { Metadata } from "next";
import Image from "next/image";
import { connection } from "next/server";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";

import logoColour from "@slovensky-futbalovy-zvaz/design-system/brand/logos/Loga-SFZ/sfz-D-farebne.svg";
import logoWhite from "@slovensky-futbalovy-zvaz/design-system/brand/logos/Loga-SFZ/sfz-D-biele.svg";

import { Alert } from "@/components/sfz";
import { defaultMessages } from "@/i18n/config";
import { isSportnetLoginEnabled } from "@/server/auth/auth";

import { loginErrorKey } from "./login-error";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: defaultMessages.login.title };

type Props = PageProps<"/prihlasenie">;

async function LoginOptions({ searchParams }: Pick<Props, "searchParams">) {
  await connection(); // read configuration at request time
  const sportnetEnabled = isSportnetLoginEnabled();
  const [t, q] = await Promise.all([getTranslations("login"), searchParams]);
  // Better Auth sends failed sign-ins back here with ?error=<code> (errorCallbackURL).
  const errorKey = loginErrorKey(q.error);
  return (
    <>
      {errorKey === "sportnetNoEmail" && (
        <Alert tone="warning" title={t("sportnetNoEmailTitle")}>
          {t.rich("sportnetNoEmail", {
            link: (chunks) => (
              <a href="https://my.sportnet.online" className="underline">
                {chunks}
              </a>
            ),
          })}
        </Alert>
      )}
      {errorKey === "error" && <Alert tone="danger">{t("error")}</Alert>}
      <p className="body text-(--ink-muted)">
        {sportnetEnabled ? t("introWithSportnet") : t("introEmailOnly")}
      </p>
      <LoginForm sportnetEnabled={sportnetEnabled} />
    </>
  );
}

/** Sign-in on the SFZ Design System (R4 G1a): sportnet.online first, e-mail link as a fallback. */
export default async function LoginPage({ searchParams }: Props) {
  const [t, th] = await Promise.all([getTranslations("login"), getTranslations("header")]);
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 px-4 py-8 sm:py-16">
      <Image
        src={logoColour}
        alt={th("logoAlt")}
        width={116}
        height={56}
        unoptimized
        className="h-14 w-auto self-start dark:hidden"
      />
      <Image
        src={logoWhite}
        alt={th("logoAlt")}
        width={116}
        height={56}
        unoptimized
        className="hidden h-14 w-auto self-start dark:block"
      />
      <h1 className="large-title">{t("title")}</h1>
      <Suspense fallback={<div className="h-40" aria-hidden />}>
        <LoginOptions searchParams={searchParams} />
      </Suspense>
      <p className="footnote text-(--ink-muted)">{t("publicHint")}</p>
    </main>
  );
}
