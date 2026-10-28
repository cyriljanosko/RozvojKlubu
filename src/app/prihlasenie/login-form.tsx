"use client";

import Image from "next/image";
import { useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";

import { Alert, Button, Input } from "@/components/sfz";
import { authClient } from "@/lib/auth-client";

type Status = "idle" | "sending" | "sent" | "error";

export function LoginForm({ sportnetEnabled }: { sportnetEnabled: boolean }) {
  const t = useTranslations("login");
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [redirecting, setRedirecting] = useState(false);

  async function signInWithSportnet() {
    setRedirecting(true);
    const { error } = await authClient.signIn.social({
      provider: "sportnet",
      callbackURL: "/moja-akademia",
    });
    if (error) {
      setRedirecting(false);
      setStatus("error");
    }
  }

  async function sendLink(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("sending");
    const { error } = await authClient.signIn.magicLink({ email, callbackURL: "/moja-akademia" });
    setStatus(error ? "error" : "sent");
  }

  if (status === "sent") {
    return (
      <div role="status" className="flex flex-col gap-3">
        <Alert tone="success" title={t("sentTitle")}>
          {t.rich("sentBody", {
            email,
            strong: (chunks) => <strong className="break-all">{chunks}</strong>,
          })}
        </Alert>
        <Button variant="tertiary" onClick={() => setStatus("idle")}>
          {t("useAnotherEmail")}
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {sportnetEnabled && (
        <>
          <Button size="lg" block onClick={signInWithSportnet} loading={redirecting}>
            {/* sportnet.online symbol from its own site (approved 26. 10. 2026) */}
            <Image
              src="/brand/sportnet-online-symbol.svg"
              alt=""
              width={22}
              height={24}
              className="mr-1 inline-block align-middle"
            />
            {t("sportnetButton")}
          </Button>
          <div className="footnote flex items-center gap-3 text-(--ink-muted)">
            <span className="h-px flex-1 bg-(--hairline)" />
            {t("or")}
            <span className="h-px flex-1 bg-(--hairline)" />
          </div>
        </>
      )}

      <form onSubmit={sendLink} className="flex flex-col gap-3">
        <Input
          label={t("emailLabel")}
          type="email"
          inputMode="email"
          autoComplete="email"
          required
          placeholder={t("emailPlaceholder")}
          hint={t("emailHint")}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <Button
          type="submit"
          size="lg"
          block
          variant={sportnetEnabled ? "secondary" : "primary"}
          loading={status === "sending"}
        >
          {t("sendLink")}
        </Button>
      </form>

      {status === "error" && <Alert tone="danger">{t("error")}</Alert>}
    </div>
  );
}
