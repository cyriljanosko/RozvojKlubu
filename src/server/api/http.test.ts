import { describe, expect, it, vi } from "vitest";
import { z } from "zod";

import { ApiError } from "./errors";
import { apiHandler, errorResponse, ok } from "./http";

describe("ok", () => {
  it("wraps data in an envelope", async () => {
    const res = ok({ a: 1 }, { meta: { page: 1 } });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ data: { a: 1 }, meta: { page: 1 } });
  });
});

describe("errorResponse", () => {
  it("maps ApiError to its status and code", async () => {
    const res = errorResponse(new ApiError("NOT_FOUND", "Club not found"));
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({
      error: { code: "NOT_FOUND", message: "Club not found" },
    });
  });

  it("maps ZodError to 400", async () => {
    const parsed = z.object({ id: z.string() }).safeParse({ id: 1 });
    const res = errorResponse(parsed.error);
    expect(res.status).toBe(400);
    expect((await res.json()).error.code).toBe("BAD_REQUEST");
  });

  it("hides internal error details", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const res = errorResponse(new Error("secret connection string"));
    expect(res.status).toBe(500);
    expect(JSON.stringify(await res.json())).not.toContain("secret");
  });
});

describe("apiHandler", () => {
  it("converts thrown errors into responses", async () => {
    const handler = apiHandler(async () => {
      throw new ApiError("FORBIDDEN", "Nope");
    });
    const res = await handler(new Request("http://localhost/api/v1/x"), {});
    expect(res.status).toBe(403);
  });
});
