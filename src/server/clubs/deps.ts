import "server-only";

import { betterAuthUserDirectory } from "@/server/auth/session";
import { mongoClubStore, mongoMembershipStore } from "@/server/db/clubs.store";
import { mongoAreaRoleChoiceStore } from "@/server/db/academy.store";
import { mongoContentStore, mongoRoleCatalogStore } from "@/server/db/content.store";
import { mongoAssessmentStore, mongoSubmissionStore } from "@/server/db/kompas.store";
import { mongoEvaluationStore, mongoLicensingSubmissionStore } from "@/server/db/licensing.store";
import { mongoPracticeStore } from "@/server/db/content.store";
import { mongoProgressStore } from "@/server/db/practice-progress.store";
import type { AcademyDeps } from "@/server/services/academy.service";
import type { ClubDeps } from "@/server/services/clubs.service";
import type { HubDeps } from "@/server/services/hub.service";
import type { SubmissionDeps } from "@/server/services/kompas-submission.service";
import type { LicensingDeps } from "@/server/services/licensing.service";
import type { PracticeProgressDeps } from "@/server/services/practice-progress.service";
import type { VizitkaDeps } from "@/server/services/vizitka.service";
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

export const vizitkaDeps: VizitkaDeps = {
  ...clubDeps,
  content: mongoContentStore,
  assessments: mongoAssessmentStore,
  submissions: mongoSubmissionStore,
  evaluations: mongoEvaluationStore,
  licensingSubmissions: mongoLicensingSubmissionStore,
};

export const academyDeps: AcademyDeps = {
  ...submissionDeps,
  content: mongoContentStore,
  evaluations: mongoEvaluationStore,
  licensingSubmissions: mongoLicensingSubmissionStore,
  roleCatalog: mongoRoleCatalogStore,
  choices: mongoAreaRoleChoiceStore,
  practice: mongoPracticeStore,
  progress: mongoProgressStore,
};

export const hubDeps: HubDeps = {
  ...clubDeps,
  content: mongoContentStore,
  roleCatalog: mongoRoleCatalogStore,
};

export const progressDeps: PracticeProgressDeps = {
  ...clubDeps,
  practice: mongoPracticeStore,
  progress: mongoProgressStore,
};
