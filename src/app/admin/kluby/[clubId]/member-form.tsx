"use client";

import { useActionState } from "react";
import { UserPlus } from "lucide-react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CLUB_ROLES } from "@/server/db/types";

import { addMemberAction, type ActionState } from "../actions";

const ERROR_KEYS = ["NOT_FOUND", "CONFLICT", "BAD_REQUEST"] as const;

export function MemberForm({ clubId }: { clubId: string }) {
  const t = useTranslations("admin.members");
  const tClubRoles = useTranslations("clubRoles");
  const [state, action, pending] = useActionState<ActionState, FormData>(
    addMemberAction.bind(null, clubId),
    { status: "idle" },
  );
  const errorKey =
    state.status === "error" ? (ERROR_KEYS.find((k) => k === state.code) ?? "default") : null;

  return (
    <form action={action} className="flex flex-col gap-3">
      <div className="flex flex-col gap-2">
        <Label htmlFor="member-email">{t("email")}</Label>
        <Input id="member-email" name="email" type="email" required autoComplete="off" />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="member-role">{t("role")}</Label>
        <select
          id="member-role"
          name="role"
          className="border-input bg-background h-9 rounded-md border px-3 text-sm"
          defaultValue="management"
        >
          {CLUB_ROLES.map((role) => (
            <option key={role} value={role}>
              {tClubRoles(role)}
            </option>
          ))}
        </select>
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="member-ages">{t("ageGroups")}</Label>
        <Input id="member-ages" name="ageGroups" placeholder="U11, U13" autoComplete="off" />
      </div>
      <p className="text-muted-foreground text-xs">{t("hint")}</p>
      <Button type="submit" disabled={pending} className="w-full sm:w-auto">
        <UserPlus aria-hidden />
        {t("add")}
      </Button>
      <p role="status" className="text-destructive text-sm">
        {errorKey && t(`errors.${errorKey}`)}
      </p>
    </form>
  );
}
