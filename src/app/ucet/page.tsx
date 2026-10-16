import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { defaultMessages } from "@/i18n/config";
import { getCurrentUser } from "@/server/auth/session";

import { SignOutButton } from "./sign-out-button";

export const metadata: Metadata = { title: defaultMessages.account.title };

async function Account() {
  const user = await getCurrentUser(await headers());
  if (!user) redirect("/prihlasenie");
  const t = await getTranslations("account");
  const tRoles = await getTranslations("roles");

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl break-words">{user.name}</CardTitle>
        <CardDescription className="break-all">{user.email}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <dl className="grid gap-3 text-sm">
          <div className="flex flex-col gap-0.5 sm:flex-row sm:justify-between">
            <dt className="text-muted-foreground">{t("role")}</dt>
            <dd className="font-medium">{tRoles(user.role)}</dd>
          </div>
          <div className="flex flex-col gap-0.5 sm:flex-row sm:justify-between">
            <dt className="text-muted-foreground">{t("sportnetAccount")}</dt>
            <dd className="font-medium">
              {user.sportnetId ? t("sportnetLinked") : t("sportnetNotLinked")}
            </dd>
          </div>
        </dl>
        {user.role === "public" && (
          <p className="text-muted-foreground rounded-md border p-3 text-sm">{t("roleHint")}</p>
        )}
        <SignOutButton />
      </CardContent>
    </Card>
  );
}

export default function AccountPage() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col px-4 py-10 sm:py-16">
      <Suspense fallback={<div className="h-64" aria-hidden />}>
        <Account />
      </Suspense>
    </main>
  );
}
