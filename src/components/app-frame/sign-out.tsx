"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/sfz";
import { authClient } from "@/lib/auth-client";

/** Sign-out in the redesigned frame (design-system Button; replaces app/ucet/sign-out-button in R4). */
export function SignOut() {
  const t = useTranslations("account");
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function signOut() {
    setPending(true);
    await authClient.signOut();
    router.push("/");
    router.refresh();
  }

  return (
    <Button variant="tertiary" icon="log-out" block loading={pending} onClick={signOut}>
      {t("signOut")}
    </Button>
  );
}
