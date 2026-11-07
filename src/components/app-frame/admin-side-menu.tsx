"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { activeLinkId, Icon, type NavLink } from "@/components/sfz";

interface AdminSideMenuProps {
  items: readonly NavLink[];
  navLabel: string;
  title: string;
}

const ITEM =
  "flex items-center rounded-(--radius-sm) px-3 no-underline min-h-(--touch-target) gap-2.5";
const ITEM_ACTIVE = "bg-(--brand-blue-tint) font-semibold text-(--brand-blue-ink)";
const ITEM_IDLE = "text-(--ink)";

/**
 * Side menu of the administration (G5): a list from tokens next to the content from 768 px. On phones
 * the administration is reached through the "Správa" column of the menu sheet and the breadcrumb
 * (ADR 0035), so the earlier bar with a Drawer is gone. Active item from the URL.
 */
export function AdminSideMenu({ items, navLabel, title }: AdminSideMenuProps) {
  const pathname = usePathname();
  const active = activeLinkId(pathname, items);

  return (
    <nav
      aria-label={navLabel}
      className="hidden w-full flex-[1_1_220px] md:block md:max-w-64 print:hidden"
    >
      <p className="label mb-2 px-1 text-(--ink-muted) uppercase">{title}</p>
      <div className="rounded-(--radius-md) bg-(--surface-raised) p-2">
        <ul className="flex flex-col gap-0.5">
          {items.map((item) => (
            <li key={item.id}>
              <Link
                href={item.href}
                aria-current={item.id === active ? "page" : undefined}
                className={`${ITEM} ${item.id === active ? ITEM_ACTIVE : ITEM_IDLE}`}
              >
                {item.icon && <Icon name={item.icon} size={18} />}
                {item.label}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </nav>
  );
}
