"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { activeLinkId, Icon, type NavLink } from "@/components/sfz";

interface AdminSideMenuProps {
  items: readonly NavLink[];
  navLabel: string;
  title: string;
}

/** Side menu of the administration (R3.3): a grouped list from tokens, active item from the URL. */
export function AdminSideMenu({ items, navLabel, title }: AdminSideMenuProps) {
  const pathname = usePathname();
  const active = activeLinkId(pathname, items);
  return (
    <nav aria-label={navLabel} className="w-full flex-[1_1_220px] md:max-w-64 print:hidden">
      <p className="label mb-2 px-1 text-(--ink-muted) uppercase">{title}</p>
      <ul className="flex flex-col gap-0.5 rounded-(--radius-md) bg-(--surface-raised) p-2">
        {items.map((item) => (
          <li key={item.id}>
            <Link
              href={item.href}
              aria-current={item.id === active ? "page" : undefined}
              className={
                item.id === active
                  ? "flex min-h-(--touch-target) items-center gap-2.5 rounded-(--radius-sm) bg-(--brand-blue-tint) px-3 font-semibold text-(--brand-blue-ink) no-underline"
                  : "flex min-h-(--touch-target) items-center gap-2.5 rounded-(--radius-sm) px-3 text-(--ink) no-underline"
              }
            >
              {item.icon && <Icon name={item.icon} size={18} />}
              {item.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
