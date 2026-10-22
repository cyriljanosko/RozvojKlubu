import { getTranslations } from "next-intl/server";

import type { CurrentUser } from "@/server/services/users.service";

import { PinButton } from "./pin-button";
import { pinnedHrefs } from "./pins";

const PATH = { vizitka: "vizitka", plan: "plan", visits: "navstevy" } as const;

/** Star for a club page – Vizitka, plan or mentor visits (MD-c); nothing for visitors. */
export async function ClubPin({
  user,
  kind,
  clubId,
  clubName,
  className,
}: {
  user: CurrentUser | null;
  kind: keyof typeof PATH;
  clubId: string;
  clubName: string;
  className?: string;
}) {
  const pins = await pinnedHrefs(user);
  if (!pins) return null;
  const t = await getTranslations("favorites.labels");
  const href = `/klub/${encodeURIComponent(clubId)}/${PATH[kind]}`;
  return (
    <PinButton
      kind={kind}
      href={href}
      label={t(kind, { club: clubName })}
      pinned={pins.has(href)}
      className={className}
    />
  );
}
