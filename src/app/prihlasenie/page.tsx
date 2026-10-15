import type { Metadata } from "next";
import { connection } from "next/server";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { defaultMessages } from "@/i18n/config";
import { isSportnetLoginEnabled } from "@/server/auth/auth";

import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: defaultMessages.login.title };

async function LoginOptions() {
  await connection(); // read configuration at request time
  const sportnetEnabled = isSportnetLoginEnabled();
  const t = await getTranslations("login");
  return (
    <div className="flex flex-col gap-6">
      <p className="text-muted-foreground text-sm">
        {sportnetEnabled ? t("introWithSportnet") : t("introEmailOnly")}
      </p>
      <LoginForm sportnetEnabled={sportnetEnabled} />
    </div>
  );
}

export default async function LoginPage() {
  const t = await getTranslations("login");
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col px-4 py-10 sm:py-16">
      <Card>
        <CardHeader>
          <CardTitle className="text-xl">{t("title")}</CardTitle>
        </CardHeader>
        <CardContent>
          <Suspense fallback={<div className="h-40" aria-hidden />}>
            <LoginOptions />
          </Suspense>
        </CardContent>
      </Card>
    </main>
  );
}
