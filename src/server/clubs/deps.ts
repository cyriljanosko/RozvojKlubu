import "server-only";

import { betterAuthUserDirectory } from "@/server/auth/session";
import { mongoClubStore, mongoMembershipStore } from "@/server/db/clubs.store";
import { mongoContentStore } from "@/server/db/content.store";
import { mongoAssessmentStore, mongoSubmissionStore } from "@/server/db/kompas.store";
import { mongoEvaluationStore, mongoLicensingSubmissionStore } from "@/server/db/licensing.store";
import type { ClubDeps } from "@/server/services/clubs.service";
import type { SubmissionDeps } from "@/server/services/kompas-submission.service";
import type { LicensingDeps } from "@/server/services/licensing.service";
import type { KompasDeps } from "@/server/services/kompas.service";

/** Production wiring of the club services (route handlers, pages, server actions). */
export const clubDeps: ClubDeps = {
  clubs: mongoClubStore,
  memberships: mongoMembershipStore,
  users: betterAuthUserDirectory,
};

export const kompasDeps: KompasDeps = {
  ...clubDeps,
  content: mongoContentStore,
  assessments: mongoAssessmentStore,
};

export const submissionDeps: SubmissionDeps = { ...kompasDeps, submissions: mongoSubmissionStore };

export const licensingDeps: LicensingDeps = {
  ...clubDeps,
  evaluations: mongoEvaluationStore,
  licensingSubmissions: mongoLicensingSubmissionStore,
};
