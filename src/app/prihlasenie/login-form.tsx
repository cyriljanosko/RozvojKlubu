"use client";

import { useState, type FormEvent } from "react";
import { Loader2, Mail } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authClient } from "@/lib/auth-client";

type Status = "idle" | "sending" | "sent" | "error";

export function LoginForm({ sportnetEnabled }: { sportnetEnabled: boolean }) {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [redirecting, setRedirecting] = useState(false);

  async function signInWithSportnet() {
    setRedirecting(true);
    const { error } = await authClient.signIn.social({
      provider: "sportnet",
      callbackURL: "/ucet",
    });
    if (error) {
      setRedirecting(false);
      setStatus("error");
    }
  }

  async function sendLink(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("sending");
    const { error } = await authClient.signIn.magicLink({ email, callbackURL: "/ucet" });
    setStatus(error ? "error" : "sent");
  }

  if (status === "sent") {
    return (
      <div role="status" className="flex flex-col gap-2 rounded-lg border p-4">
        <p className="font-medium">Skontrolujte si e-mail</p>
        <p className="text-muted-foreground text-sm">
          Na adresu <strong className="break-all">{email}</strong> sme poslali prihlasovací odkaz.
          Platí 15 minút.
        </p>
        <Button variant="link" className="self-start px-0" onClick={() => setStatus("idle")}>
          Použiť inú adresu
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
            Prihlásiť sa cez Sportnet
          </Button>
          <div className="text-muted-foreground flex items-center gap-3 text-xs">
            <span className="bg-border h-px flex-1" />
            alebo
            <span className="bg-border h-px flex-1" />
          </div>
        </>
      )}

      <form onSubmit={sendLink} className="flex flex-col gap-3">
        <Label htmlFor="email">E-mail</Label>
        <Input
          id="email"
          type="email"
          inputMode="email"
          autoComplete="email"
          required
          placeholder="meno@klub.sk"
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
          Poslať prihlasovací odkaz
        </Button>
      </form>

      {status === "error" && (
        <p role="alert" className="text-destructive text-sm">
          Prihlásenie sa nepodarilo. Skúste to prosím znova.
        </p>
      )}
    </div>
  );
}
