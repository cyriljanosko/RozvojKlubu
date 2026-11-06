import { describe, expect, it } from "vitest";

import { BASE_ROLE_OF, isClubManager, isClubMember, isCoachLevel } from "./club-roles";

describe("club role levels (analysis 3.1)", () => {
  it("treats coach and team manager alike", () => {
    expect(isCoachLevel(["coach"])).toBe(true);
    expect(isCoachLevel(["team_manager"])).toBe(true);
    expect(isCoachLevel(["club_manager", "player", "member", "mentor"])).toBe(false);
  });

  it("counts every role in the club as membership, but not the mentor", () => {
    for (const r of ["club_manager", "coach", "team_manager", "player", "member"]) {
      expect(isClubMember([r])).toBe(true);
    }
    expect(isClubMember(["mentor"])).toBe(false);
    expect(isClubManager(["club_manager"])).toBe(true);
  });

  it("maps the club manager to the catalog base role management", () => {
    expect(BASE_ROLE_OF.club_manager).toBe("management");
    expect(BASE_ROLE_OF.team_manager).toBe("coach");
    expect(BASE_ROLE_OF.player).toBeUndefined();
  });
});
