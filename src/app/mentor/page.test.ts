import type { ReactElement } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/server/api/errors";
import type { CurrentUser } from "@/server/services/users.service";

const mocks = vi.hoisted(() => ({
  user: null as CurrentUser | null,
  listMentorClubs: vi.fn(),
  redirect: vi.fn((to: string) => {
    throw new Error(`NEXT_REDIRECT ${to}`);
  }),
}));

vi.mock("next/headers", () => ({ headers: async () => new Headers() }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("next-intl/server", () => ({ getTranslations: async () => (key: string) => key }));
vi.mock("@/server/auth/session", () => ({ getCurrentUser: async () => mocks.user }));
vi.mock("@/server/clubs/deps", () => ({ submissionDeps: {} }));
vi.mock("@/server/services/kompas-submission.service", () => ({
  listMentorClubs: mocks.listMentorClubs,
}));

import MentorPage from "./page";

const mona: CurrentUser = { id: "mona", email: "mona@obfz.sk", name: "Mona", role: "public" };

/** Renders the page's inner server component (the one inside Suspense). */
async function render() {
  type Wrapper = ReactElement<{ children: ReactElement }>;
  const main = MentorPage() as ReactElement<{ children: Wrapper }>;
  const inner = main.props.children.props.children;
  return (inner.type as () => Promise<ReactElement>)();
}

describe("/mentor", () => {
  beforeEach(() => {
    mocks.user = null;
    mocks.listMentorClubs.mockReset();
    mocks.redirect.mockClear();
  });

  it("shows a mentor their clubs instead of redirecting them away", async () => {
    mocks.user = mona;
    mocks.listMentorClubs.mockResolvedValue([
      { clubId: "tj-test", name: "TJ Test", union: "ObFZ Test", latest: null },
    ]);
    const page = await render();
    expect(mocks.redirect).not.toHaveBeenCalled();
    expect(mocks.listMentorClubs).toHaveBeenCalledWith({}, mona);
    expect(JSON.stringify(page)).toContain("TJ Test");
  });

  it("sends anonymous users to sign in and tells non-mentors they are not a mentor", async () => {
    await expect(render()).rejects.toThrow("NEXT_REDIRECT /prihlasenie");

    mocks.user = { ...mona, id: "carl" };
    mocks.listMentorClubs.mockRejectedValue(new ApiError("FORBIDDEN", "Not a mentor"));
    expect(JSON.stringify(await render())).toContain("forbidden");
  });
});
