"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

import { activeLinkId, Drawer, Icon, IconButton, type NavLink } from "@/components/sfz";

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
 * Side menu of the administration (G5): a list from tokens next to the content from 768 px; below it a
 * bar with the menu button that opens the same list in a Drawer from the left. Active item from the URL.
 */
export function AdminSideMenu({ items, navLabel, title }: AdminSideMenuProps) {
  const pathname = usePathname();
  const active = activeLinkId(pathname, items);
  const [open, setOpen] = useState(false);

  const list = (mobile: boolean) => (
    <ul className="flex flex-col gap-0.5">
      {items.map((item) => (
        <li key={item.id}>
          <Link
            href={item.href}
            aria-current={item.id === active ? "page" : undefined}
            onClick={mobile ? () => setOpen(false) : undefined}
            className={`${ITEM} ${mobile ? "body min-h-12" : ""} ${
              item.id === active ? ITEM_ACTIVE : ITEM_IDLE
            }`}
          >
            {item.icon && <Icon name={item.icon} size={mobile ? 20 : 18} />}
            {item.label}
          </Link>
        </li>
      ))}
    </ul>
  );

  return (
    <>
      <div className="flex w-full items-center gap-2 border-b border-(--hairline) pb-2 md:hidden print:hidden">
        <IconButton
          icon="menu"
          label={navLabel}
          variant="tertiary"
          aria-expanded={open}
          onClick={() => setOpen(true)}
        />
        <span className="headline">{title}</span>
      </div>
      <Drawer open={open} onClose={() => setOpen(false)} title={title} side="left">
        <nav aria-label={navLabel}>{list(true)}</nav>
      </Drawer>
      <nav
        aria-label={navLabel}
        className="hidden w-full flex-[1_1_220px] md:block md:max-w-64 print:hidden"
      >
        <p className="label mb-2 px-1 text-(--ink-muted) uppercase">{title}</p>
        <div className="rounded-(--radius-md) bg-(--surface-raised) p-2">{list(false)}</div>
      </nav>
    </>
  );
}
