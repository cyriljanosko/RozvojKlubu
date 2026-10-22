import { readFileSync } from "node:fs";
import { join } from "node:path";

import { beforeEach, describe, expect, it } from "vitest";

import type { MentorVisitAction } from "@/server/db/types";

import { memoryPlanStore } from "./club-plan.fixture";
import { A, admin, alice, bob, memoryDeps } from "./clubs.fixture";
import { addClubMember } from "./clubs.service";
import { memoryContentStore, memoryRoleCatalogStore } from "./content.fixture";
import { seedContent } from "./content.service";
import { memoryAssessmentStore, memorySubmissionStore } from "./kompas.fixture";
import { memoryLicensingSubmissionStore } from "./licensing.fixture";
import { memoryVisitStore } from "./mentor-visit.fixture";
import type { StoredVisit } from "./mentor-visit.service";
import { academyGraph, areaLine, clubGraph, getNetwork, type NetworkDeps } from "./network.service";
import { roleCatalogSchema } from "./role-catalog.schema";
import { currentSeason } from "./season";
import { seedRoleCatalog } from "./role-catalog.service";
import type { CurrentUser } from "./users.service";

const file = JSON.parse(readFileSync(join(process.cwd(), "content/roly.json"), "utf8"));
const catalog = roleCatalogSchema.parse(file);
const areas = Array.from({ length: 11 }, (_, i) => ({ number: i + 1, name: `Oblasť ${i + 1}` }));

const action = (o: Partial<MentorVisitAction>): MentorVisitAction => ({
  id: "a1",
  text: "Zvolať výbor",
  area: 1,
  owner: "Alice",
  ownerId: "alice",
  dueDate: null,
  done: false,
  doneAt: null,
  doneBy: null,
  ...o,
});
const visit = (o: Partial<StoredVisit>): StoredVisit => ({
  id: "v1",
  clubId: A,
  season: "2026/2027",
  date: "2026-10-01",
  form: "onsite",
  participantIds: [],
  participants: "",
  summary: "",
  findings: [],
  actions: [],
  status: "sent",
  sentAt: new Date(),
  withdrawnAt: null,
  withdrawnBy: null,
  version: 1,
  createdBy: "mona",
  createdAt: new Date(),
  updatedAt: new Date(),
  updatedBy: "mona",
  ...o,
});

describe("network – pure", () => {
  it("places areas on the 1-4-3-3 lines", () => {
    expect([1, 2, 4, 5, 7, 8, 11].map(areaLine)).toEqual([
      "goalkeeper",
      "midfield",
      "midfield",
      "attack",
      "attack",
      "defense",
      "defense",
    ]);
  });

  it("the Academy map links roles to their areas, without the fan and with the mentor only when allowed", () => {
    const graph = academyGraph(catalog, areas, false);
    const roles = graph.nodes.filter((n) => n.kind === "role").map((n) => n.id);
    expect(roles).toContain("role:management");
    expect(roles).not.toContain("role:fan");
    expect(roles).not.toContain("role:mentor");
    expect(graph.edges.some((e) => e.source === "role:mentor")).toBe(false);
    // management: areas 1, 2, 8 first on the Hub; area 8 has five management roles
    const m8 = graph.edges.find((e) => e.source === "role:management" && e.target === "area:8");
    expect(m8).toMatchObject({ priority: true, weight: 5 });
    expect(
      graph.edges.find((e) => e.source === "role:management" && e.target === "area:11")?.priority,
    ).toBe(false);
    expect(academyGraph(catalog, areas, true).nodes.map((n) => n.id)).toContain("role:mentor");
  });

  it("the club map shows sent tasks (done too) on their areas and people only when allowed", () => {
    const input = {
      clubId: A,
      catalog,
      areas,
      kompas: [9, ...Array(10).fill(null)],
      visits: [
        visit({
          actions: [
            action({}),
            action({ id: "a2", area: null, done: true, ownerId: null, owner: "výbor" }),
            action({ id: "a3", dueDate: "2026-09-01" }),
          ],
        }),
        visit({ id: "v2", status: "draft", actions: [action({ id: "x" })] }),
        visit({ id: "v3", status: "withdrawn", actions: [action({ id: "y" })] }),
      ],
      plan: {
        clubId: A,
        season: "2026/2027",
        goals: [
          {
            id: "g1",
            area: 3,
            title: "Dvaja noví tréneri",
            publicText: "",
            indicator: "",
            owner: "Bob",
            ownerId: "bob",
            dueDate: null,
            status: "done" as const,
            doneAt: new Date(),
          },
        ],
        confirmedAt: null,
        confirmedBy: null,
        editedAt: null,
        version: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
        updatedBy: "alice",
      },
      members: [
        { userId: "alice", name: "Alice", roles: ["management"] },
        { userId: "bob", name: "Bob", roles: ["coach"] },
        { userId: "mona", name: "Mona", roles: ["mentor"] },
      ],
      people: true,
      withMentor: false,
      today: "2026-10-22",
    };
    const graph = clubGraph(input);
    const tasks = graph.nodes.filter((n) => n.kind === "task");
    expect(tasks.map((t) => t.id)).toEqual([
      "visit:v1:a1",
      "visit:v1:a2",
      "visit:v1:a3",
      "goal:g1",
    ]);
    expect(tasks.find((t) => t.id === "visit:v1:a3")).toMatchObject({ overdue: true, done: false });
    expect(tasks.find((t) => t.id === "goal:g1")).toMatchObject({ done: true, overdue: false });
    expect(graph.nodes.find((n) => n.id === "area:1")).toMatchObject({ points: 9 });
    expect(graph.edges).toContainEqual({ source: "visit:v1:a1", target: "area:1" });
    expect(graph.edges.some((e) => e.source === "visit:v1:a2")).toBe(false); // no area
    expect(graph.edges).toContainEqual({ source: "person:alice", target: "visit:v1:a1" });
    expect(graph.edges).toContainEqual({ source: "person:bob", target: "role:coach" });
    // the union mentor stays in the background
    expect(graph.nodes.map((n) => n.id)).not.toContain("person:mona");
    expect(graph.nodes.map((n) => n.id)).not.toContain("role:mentor");

    const anonymous = clubGraph({ ...input, people: false });
    expect(anonymous.nodes.some((n) => n.kind === "person")).toBe(false);
    expect(JSON.stringify(anonymous)).not.toContain("Alice");
  });
});

describe("network – access", () => {
  let deps: NetworkDeps;
  beforeEach(async () => {
    const base = memoryDeps();
    const content = memoryContentStore();
    await seedContent(content, admin);
    const roleCatalog = memoryRoleCatalogStore(memoryContentStore());
    await seedRoleCatalog(roleCatalog, admin, file);
    const visits = memoryVisitStore();
    deps = {
      ...base,
      content,
      roleCatalog,
      kompas: { ...base, content, assessments: memoryAssessmentStore() },
      submissions: memorySubmissionStore(),
      licensingSubmissions: memoryLicensingSubmissionStore(),
      visits,
      plans: memoryPlanStore(),
    };
    await addClubMember(deps, admin, A, { email: "alice@klub.sk", role: "management" });
    await addClubMember(deps, admin, A, { email: "bob@klub.sk", role: "coach" });
    visits.docs.push(visit({ season: currentSeason(), actions: [action({})] }));
  });

  it("management sees people, coaches see the club without names", async () => {
    const own = await getNetwork(deps, alice, { map: "club" });
    expect(own).toMatchObject({ map: "club", people: true, club: { clubId: A } });
    expect(own.nodes.some((n) => n.kind === "person")).toBe(true);
    const coach = await getNetwork(deps, bob, { map: "club" });
    expect(coach.people).toBe(false);
    expect(coach.nodes.some((n) => n.kind === "person")).toBe(false);
  });

  it("admin picks a club; the Academy map is for every signed-in user; others are refused", async () => {
    expect((await getNetwork(deps, admin, { map: "club", clubId: A })).people).toBe(true);
    await expect(getNetwork(deps, admin, { map: "club" })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    const nobody: CurrentUser = { id: "x", email: "x@x.sk", name: "X", role: "public" };
    expect((await getNetwork(deps, nobody, { map: "academy" })).nodes).toHaveLength(
      11 + 5, // areas + management, coach, parent, volunteer, player
    );
    await expect(getNetwork(deps, nobody, { map: "club", clubId: A })).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    await expect(getNetwork(deps, null, { map: "academy" })).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
  });
});
