import type { UserPreferencesDoc } from "@/server/db/types";

import type { PreferencesStore } from "./preferences.service";

/** In-memory PreferencesStore with the same version semantics as the Mongo store. */
export function memoryPreferencesStore(): PreferencesStore & { docs: UserPreferencesDoc[] } {
  const docs: UserPreferencesDoc[] = [];
  return {
    docs,
    findPreferences: async (userId) => {
      const d = docs.find((x) => x.userId === userId);
      return d ? structuredClone(d) : null;
    },
    async savePreferences(userId, expectedVersion, changes) {
      const d = docs.find((x) => x.userId === userId);
      if (expectedVersion === 0) {
        if (d) return null;
        const doc = {
          userId,
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
  };
}
