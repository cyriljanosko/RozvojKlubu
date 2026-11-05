"use client";

import { useRouter } from "next/navigation";

import { Select, type SelectOption } from "@/components/sfz";

/** Area filter on Novinky: navigates to the same list with ?area= (kind kept). */
export function AreaFilter({
  label,
  options,
  value,
  kind,
}: {
  label: string;
  options: SelectOption[];
  value: string;
  kind: string | null;
}) {
  const router = useRouter();
  return (
    <Select
      label={label}
      options={options}
      value={value}
      onChange={(e) => {
        const q = new URLSearchParams();
        if (kind) q.set("kind", kind);
        if (e.target.value) q.set("area", e.target.value);
        const query = q.toString();
        router.push(query ? `/novinky?${query}` : "/novinky");
      }}
    />
  );
}
