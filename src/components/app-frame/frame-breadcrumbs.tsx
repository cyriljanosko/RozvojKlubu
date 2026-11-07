"use client";

import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";

import { Breadcrumbs } from "@/components/sfz";
import { breadcrumbs, type CrumbNames } from "@/lib/navigation";

/** The breadcrumb of the current page (ADR 0035): built from the address, names from the server. */
export function FrameBreadcrumbs({ signedIn, names }: { signedIn: boolean; names: CrumbNames }) {
  const pathname = usePathname();
  const t = useTranslations("nav");
  const items = breadcrumbs(pathname, signedIn, names).map((crumb) => ({
    label: crumb.labelKey ? t(crumb.labelKey, crumb.params) : (crumb.label ?? ""),
    href: crumb.href,
  }));
  return <Breadcrumbs items={items} label={t("breadcrumbLabel")} />;
}
