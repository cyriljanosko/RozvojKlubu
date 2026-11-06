// One-off migration for S2-b stage 2 (ADR 0021, ADR 0027): club role `management` -> `club_manager`.
//
//   node --env-file=.env.local scripts/migrate-club-roles.mjs          # dry-run, writes nothing
//   node --env-file=.env.local scripts/migrate-club-roles.mjs --apply  # writes
//
// Changes:
//   1. club_memberships: role "management" -> "club_manager"
//   2. club_memberships: source "app" where it is missing (links given in the app before S2-b)
//   3. role_catalog: baseRoles[].clubRole "management" -> "club_manager" (base key stays "management")
//
// Idempotent: a second run finds nothing to change. The app reads the old values too (clubs.store,
// role-catalog.schema), so deploy order does not matter. Prints only counts, no personal data.
import { MongoClient } from "mongodb";

const apply = process.argv.includes("--apply");
const uri = process.env.MONGODB_URI;
const dbName = process.env.MONGODB_DB;
if (!uri || !dbName) {
  console.error("MONGODB_URI and MONGODB_DB are required (node --env-file=.env.local …)");
  process.exit(1);
}

const client = new MongoClient(uri);
try {
  await client.connect();
  const db = client.db(dbName);
  const memberships = db.collection("club_memberships");
  const catalog = db.collection("role_catalog");

  const total = await memberships.countDocuments({});
  const byRole = await memberships
    .aggregate([{ $group: { _id: { role: "$role", source: "$source" }, count: { $sum: 1 } } }])
    .toArray();
  const legacyRole = await memberships.countDocuments({ role: "management" });
  const withoutSource = await memberships.countDocuments({ source: { $exists: false } });
  const catalogDocs = await catalog.countDocuments({ "content.baseRoles.clubRole": "management" });

  console.log(`database ${dbName} – ${apply ? "APPLY" : "dry-run"}`);
  console.log(`club_memberships total ${total}`);
  for (const g of byRole.sort((a, b) => b.count - a.count)) {
    console.log(`  role ${g._id.role} · source ${g._id.source ?? "(missing)"}: ${g.count}`);
  }
  console.log(`to change: role management -> club_manager: ${legacyRole}`);
  console.log(`to change: source missing -> app: ${withoutSource}`);
  console.log(`to change: role_catalog documents with clubRole management: ${catalogDocs}`);

  // Unique index club_season_user_role: a person with both codes in one club and season would block
  // the rename halfway. Stop before writing.
  const [conflicts] = await memberships
    .aggregate([
      { $match: { role: { $in: ["management", "club_manager"] } } },
      { $group: { _id: { c: "$clubId", s: "$season", u: "$userId" }, n: { $sum: 1 } } },
      { $match: { n: { $gt: 1 } } },
      { $count: "count" },
    ])
    .toArray();
  console.log(`conflicts (both codes in one club and season): ${conflicts?.count ?? 0}`);
  if (apply && conflicts?.count) {
    console.error("stopped: resolve the conflicts first, nothing written");
    process.exitCode = 1;
  }

  if (process.exitCode) {
    // conflicts reported above
  } else if (!apply) {
    console.log("dry-run: nothing written (add --apply to write)");
  } else {
    const r1 = await memberships.updateMany(
      { role: "management" },
      { $set: { role: "club_manager" } },
    );
    const r2 = await memberships.updateMany(
      { source: { $exists: false } },
      { $set: { source: "app" } },
    );
    const r3 = await catalog.updateMany(
      { "content.baseRoles.clubRole": "management" },
      { $set: { "content.baseRoles.$[r].clubRole": "club_manager" } },
      { arrayFilters: [{ "r.clubRole": "management" }] },
    );
    console.log(
      `written: roles ${r1.modifiedCount}, sources ${r2.modifiedCount}, catalog ${r3.modifiedCount}`,
    );
  }
} finally {
  await client.close();
}
