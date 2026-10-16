import { beforeEach, describe, expect, it } from "vitest";

import { sampleSnapshot } from "./club-snapshot.fixture";
import type { ParsedSnapshot } from "./club-snapshot.service";
import { A, B, admin, alice, bob, memoryDeps } from "./clubs.fixture";
import {
  addClubMember,
  getClubOverview,
  importClubSnapshot,
  listClubMembers,
  listMyClubs,
  removeClubMember,
} from "./clubs.service";

describe("clubs service", () => {
  let deps: ReturnType<typeof memoryDeps>;

  beforeEach(() => {
    deps = memoryDeps();
  });

  it("admin sees all clubs, others only their own", async () => {
    expect((await listMyClubs(deps, admin)).map((c) => c.clubId)).toEqual([B, A]);
    expect(await listMyClubs(deps, alice)).toEqual([]);

    await addClubMember(deps, admin, A, { email: "alice@klub.sk", role: "management" });
    expect(await listMyClubs(deps, alice)).toEqual([
      { clubId: A, name: "TJ Test", union: "ObFZ Test", region: "VsFZ", roles: ["management"] },
    ]);
  });

  it("isolates tenants: a member of club A cannot open club B", async () => {
    await addClubMember(deps, admin, A, { email: "alice@klub.sk", role: "coach" });
    await expect(getClubOverview(deps, alice, A)).resolves.toMatchObject({ roles: ["coach"] });
    await expect(getClubOverview(deps, alice, B)).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(getClubOverview(deps, bob, A)).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(getClubOverview(deps, null, A)).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("ignores memberships from another season", async () => {
    await addClubMember(deps, admin, A, {
      email: "alice@klub.sk",
      role: "management",
      season: "2025/2026",
    });
    await expect(getClubOverview(deps, alice, A)).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("builds the overview without coach names", async () => {
    const overview = await getClubOverview(deps, admin, A);
    expect(overview.season).toBe("2026/2027");
    expect(overview.dataAsOf).toBe("2026-10-11");
    expect(overview.stats).toEqual({
      teams: 2,
      teamsInCompetition: 1,
      uniquePlayers: 31,
      girls: 9,
      coaches: 1,
    });
    expect(JSON.stringify(overview)).not.toContain("Testovací");
    await expect(getClubOverview(deps, admin, A, "2026")).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
    await expect(getClubOverview(deps, admin, "missing")).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });

  it("only admin manages members", async () => {
    await expect(
      addClubMember(deps, alice, A, { email: "bob@klub.sk", role: "coach" }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(listClubMembers(deps, alice, A)).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(removeClubMember(deps, alice, A, "m1")).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });

  it("validates new members", async () => {
    await expect(
      addClubMember(deps, admin, A, { email: "nobody@klub.sk", role: "coach" }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(
      addClubMember(deps, admin, "missing", { email: "bob@klub.sk", role: "coach" }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(
      addClubMember(deps, admin, A, { email: "bob@klub.sk", role: "owner" }),
    ).rejects.toThrow();
    await addClubMember(deps, admin, A, {
      email: " BOB@klub.sk ",
      role: "coach",
      ageGroups: ["U11"],
    });
    await expect(
      addClubMember(deps, admin, A, { email: "bob@klub.sk", role: "coach" }),
    ).rejects.toMatchObject({ code: "CONFLICT" });
    expect(deps.memberDocs[0]).toMatchObject({
      userId: "bob",
      clubId: A,
      role: "coach",
      season: "2026/2027",
      ageGroups: ["U11"],
      createdBy: "admin",
    });
  });

  it("lists and removes members within the club only", async () => {
    const created = await addClubMember(deps, admin, A, { email: "bob@klub.sk", role: "mentor" });
    expect(await listClubMembers(deps, admin, A)).toEqual([
      {
        id: created.id,
        userId: "bob",
        email: "bob@klub.sk",
        name: "Bob",
        role: "mentor",
        season: "2026/2027",
        ageGroups: [],
      },
    ]);
    await expect(removeClubMember(deps, admin, B, created.id)).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    await removeClubMember(deps, admin, A, created.id);
    expect(deps.memberDocs).toEqual([]);
  });

  it("imports a snapshot (admin only)", async () => {
    const saved: ParsedSnapshot[] = [];
    const store = {
      saveSnapshot: async (s: ParsedSnapshot) => {
        saved.push(s);
        return { clubs: s.clubs.length, seasons: s.seasons.length };
      },
    };
    await expect(importClubSnapshot(store, alice, sampleSnapshot)).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    await expect(importClubSnapshot(store, admin, sampleSnapshot)).resolves.toEqual({
      dataAsOf: "2026-10-11",
      clubs: 1,
      seasons: 1,
    });
    expect(saved).toHaveLength(1);
  });
});
