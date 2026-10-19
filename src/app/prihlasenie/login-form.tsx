"use client";

import { useState, type FormEvent } from "react";
import { Loader2, Mail } from "lucide-react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
      <div role="status" className="flex flex-col gap-2 rounded-lg border p-4">
        <p className="font-medium">{t("sentTitle")}</p>
        <p className="text-muted-foreground text-sm">
          {t.rich("sentBody", {
            email,
            strong: (chunks) => <strong className="break-all">{chunks}</strong>,
          })}
        </p>
        <Button variant="link" className="self-start px-0" onClick={() => setStatus("idle")}>
          {t("useAnotherEmail")}
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {sportnetEnabled && (
        <>
          <Button size="lg" className="w-full" onClick={signInWithSportnet} disabled={redirecting}>
            {redirecting && <Loader2 className="animate-spin" aria-hidden />}
            {t("sportnetButton")}
          </Button>
          <div className="text-muted-foreground flex items-center gap-3 text-xs">
            <span className="bg-border h-px flex-1" />
            {t("or")}
            <span className="bg-border h-px flex-1" />
          </div>
        </>
      )}

      <form onSubmit={sendLink} className="flex flex-col gap-3">
        <Label htmlFor="email">{t("emailLabel")}</Label>
        <Input
          id="email"
          type="email"
          inputMode="email"
          autoComplete="email"
          required
          placeholder={t("emailPlaceholder")}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <Button
          type="submit"
          size="lg"
          variant={sportnetEnabled ? "outline" : "default"}
          className="w-full"
          disabled={status === "sending"}
        >
          {status === "sending" ? (
            <Loader2 className="animate-spin" aria-hidden />
          ) : (
            <Mail aria-hidden />
          )}
          {t("sendLink")}
        </Button>
      </form>

      {status === "error" && (
        <p role="alert" className="text-destructive text-sm">
          {t("error")}
        </p>
      )}
    </div>
  );
}
