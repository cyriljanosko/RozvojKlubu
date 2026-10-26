import type { ClubSettingsDoc } from "@/server/db/types";

import type { ClubSettingsStore } from "./club-settings.service";

/** In-memory ClubSettingsStore with the same version semantics as the Mongo store. */
export function memoryClubSettingsStore(): ClubSettingsStore & { docs: ClubSettingsDoc[] } {
  const docs: ClubSettingsDoc[] = [];
  return {
    docs,
    findSettings: async (clubId) => {
      const d = docs.find((x) => x.clubId === clubId);
      return d ? structuredClone(d) : null;
    },
    async saveSettings(clubId, expectedVersion, changes) {
      const d = docs.find((x) => x.clubId === clubId);
      if (expectedVersion === 0) {
        if (d) return null;
        const doc = {
          clubId,
          ...structuredClone(changes),
          version: 1,
          createdAt: changes.updatedAt,
        };
        docs.push(doc);
        return structuredClone(doc);
      }
      if (!d || d.version !== expectedVersion) return null;
      Object.assign(d, structuredClone(changes), { version: d.version + 1 });
      return structuredClone(d);
    },
    listRankingConsents: async () =>
      docs.filter((d) => d.rankingConsent?.given).map((d) => d.clubId),
  };
}
