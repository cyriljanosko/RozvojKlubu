"use client";

import { useState } from "react";

import { BottomSheet, Button, MenuPanel, type MenuSheetSection } from "@/components/sfz";

/** Opens the phone's bottom sheet with the menu, so the showcase can show it (ADR 0035). */
export function MenuSheetDemo({
  sections,
  open: openLabel,
  title,
  close,
}: {
  sections: MenuSheetSection[];
  open: string;
  title: string;
  close: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <div>
        <Button variant="secondary" icon="menu" onClick={() => setOpen(true)}>
          {openLabel}
        </Button>
      </div>
      <BottomSheet open={open} onClose={() => setOpen(false)} title={title} closeLabel={close}>
        <MenuPanel sections={sections} columns="two" onPick={() => setOpen(false)} />
      </BottomSheet>
    </>
  );
}
