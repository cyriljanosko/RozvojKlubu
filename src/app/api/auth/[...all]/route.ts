import { getAuth } from "@/server/auth/auth";

// Better Auth handles /api/auth/* (magic link, OAuth callbacks, session, sign-out).
export const GET = (request: Request) => getAuth().handler(request);
export const POST = (request: Request) => getAuth().handler(request);
