import { unstable_rethrow } from "next/navigation";
import { z } from "zod";

import { ApiError } from "./errors";

/**
 * Uniform JSON envelope for every /api/v1 response:
 *   success: { data, meta? }
 *   error:   { error: { code, message, details? } }
 * The same shapes will be reused by the MCP server.
 */
export function ok<T>(data: T, init?: ResponseInit & { meta?: Record<string, unknown> }) {
  const { meta, ...rest } = init ?? {};
  return Response.json(meta ? { data, meta } : { data }, rest);
}

export function errorResponse(error: unknown): Response {
  if (error instanceof ApiError) {
    return Response.json(
      { error: { code: error.code, message: error.message, details: error.details } },
      { status: error.status },
    );
  }
  if (error instanceof z.ZodError) {
    return Response.json(
      {
        error: {
          code: "BAD_REQUEST",
          message: "Invalid request",
          details: z.flattenError(error),
        },
      },
      { status: 400 },
    );
  }
  console.error("[api] unhandled error", error);
  return Response.json(
    { error: { code: "INTERNAL", message: "Internal server error" } },
    { status: 500 },
  );
}

type Handler<Ctx> = (request: Request, context: Ctx) => Promise<Response>;

/**
 * Wraps a route handler with uniform error handling.
 * Auth, RBAC and rate limiting will be added here in F1 (auth step).
 */
export function apiHandler<Ctx = unknown>(handler: Handler<Ctx>): Handler<Ctx> {
  return async (request, context) => {
    try {
      return await handler(request, context);
    } catch (error) {
      unstable_rethrow(error); // let Next.js internal control-flow errors through
      return errorResponse(error);
    }
  };
}
