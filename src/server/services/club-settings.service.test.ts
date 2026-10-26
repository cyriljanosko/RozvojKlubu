import { beforeEach, describe, expect, it } from "vitest";

import { memoryClubSettingsStore } from "./club-settings.fixture";
import { getClubSettings, setRankingConsent, type ClubSettingsDeps } from "./club-settings.service";
import { A, B, admin, alice, bob, memoryDeps } from "./clubs.fixture";
import { addClubMember } from "./clubs.service";

describe("club settings – consent to the rankings (MR-a, ADR 0015)", () => {
  let deps: ClubSettingsDeps & { settings: ReturnType<typeof memoryClubSettingsStore> };
  beforeEach(async () => {
    deps = { ...memoryDeps(), settings: memoryClubSettingsStore() };
    await addClubMember(deps, admin, A, { email: "alice@klub.sk", role: "management" });
    await addClubMember(deps, admin, A, { email: "bob@klub.sk", role: "coach" });
  });

  it("nobody decided yet: no consent, management may change it", async () => {
    expect(await getClubSettings(deps, alice, A)).toEqual({
      clubId: A,
      rankingConsent: null,
      canEdit: true,
      version: 0,
    });
    expect((await getClubSettings(deps, bob, A)).canEdit).toBe(false);
    expect((await getClubSettings(deps, admin, A)).canEdit).toBe(false);
    expect(await deps.settings.listRankingConsents()).toEqual([]);
  });

  it("management gives and withdraws the consent, with optimistic versions", async () => {
    const given = await setRankingConsent(deps, alice, A, { given: true, expectedVersion: 0 });
    expect(given).toMatchObject({ rankingConsent: { given: true }, version: 1 });
    expect(await deps.settings.listRankingConsents()).toEqual([A]);
    await expect(
      setRankingConsent(deps, alice, A, { given: false, expectedVersion: 0 }),
    ).rejects.toMatchObject({ code: "CONFLICT" });
    const withdrawn = await setRankingConsent(deps, alice, A, { given: false, expectedVersion: 1 });
    expect(withdrawn).toMatchObject({ rankingConsent: { given: false }, version: 2 });
    expect(await deps.settings.listRankingConsents()).toEqual([]);
    expect(deps.settings.docs[0]).toMatchObject({ clubId: A, updatedBy: "alice" });
  });

  it("coaches, admin_sfz and other clubs cannot decide; strangers cannot read", async () => {
    for (const user of [bob, admin]) {
      await expect(
        setRankingConsent(deps, user, A, { given: true, expectedVersion: 0 }),
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
    }
    await expect(
      setRankingConsent(deps, alice, B, { given: true, expectedVersion: 0 }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(getClubSettings(deps, alice, B)).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(getClubSettings(deps, null, A)).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    await expect(
      setRankingConsent(deps, alice, A, { given: "yes", expectedVersion: 0 }),
    ).rejects.toThrow();
  });
});
