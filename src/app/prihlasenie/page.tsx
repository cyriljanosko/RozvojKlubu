import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { isSportnetLoginEnabled } from "@/server/auth/auth";

import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Prihlásenie" };

async function LoginOptions() {
  await connection(); // read configuration at request time
  const sportnetEnabled = isSportnetLoginEnabled();
  return (
    <div className="flex flex-col gap-6">
      <p className="text-muted-foreground text-sm">
        {sportnetEnabled
          ? "Prihláste sa účtom Sportnet. Ak ho nemáte, pošleme vám prihlasovací odkaz e-mailom."
          : "Zadajte e-mail a pošleme vám prihlasovací odkaz."}
      </p>
      <LoginForm sportnetEnabled={sportnetEnabled} />
    </div>
  );
}

export default function LoginPage() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col px-4 py-10 sm:py-16">
      <Card>
        <CardHeader>
          <CardTitle className="text-xl">Prihlásenie</CardTitle>
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
