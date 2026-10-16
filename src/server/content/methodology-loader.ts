import "server-only";

import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";

import { parseMethodologyFile, type MethodologyFile } from "@/server/services/methodology-file";

/**
 * Reads content/metodika/*.md (bundled with the server via outputFileTracingIncludes
 * in next.config.ts). Used only by the admin seed.
 */
export async function loadMethodologyFiles(): Promise<MethodologyFile[]> {
  const dir = join(process.cwd(), "content", "metodika");
  const names = (await readdir(dir)).filter((n) => n.endsWith(".md")).sort();
  return Promise.all(
    names.map(async (n) => parseMethodologyFile(await readFile(join(dir, n), "utf8"))),
  );
}
