import "server-only";

import { betterAuthUserDirectory } from "@/server/auth/session";
import { mongoClubStore, mongoMembershipStore } from "@/server/db/clubs.store";
import { mongoAreaRoleChoiceStore } from "@/server/db/academy.store";
import {
  mongoContentStore,
  mongoRoleCatalogStore,
  mongoSectionStore,
} from "@/server/db/content.store";
import { mongoAssessmentStore, mongoSubmissionStore } from "@/server/db/kompas.store";
import { mongoEvaluationStore, mongoLicensingSubmissionStore } from "@/server/db/licensing.store";
import { mongoPracticeStore } from "@/server/db/content.store";
import { mongoProgressStore } from "@/server/db/practice-progress.store";
import { mongoVisitStore } from "@/server/db/mentor-visit.store";
import { mongoPlanStore } from "@/server/db/club-plan.store";
import { mongoMentoringStore } from "@/server/db/club-mentoring.store";
import { mongoPreferencesStore } from "@/server/db/preferences.store";
import type { AcademyDeps } from "@/server/services/academy.service";
import type { ClubDeps } from "@/server/services/clubs.service";
import type { HubDeps } from "@/server/services/hub.service";
import type { SubmissionDeps } from "@/server/services/kompas-submission.service";
import type { LicensingDeps } from "@/server/services/licensing.service";
import type { AnalyticsDeps } from "@/server/services/analytics.service";
import type { ClubPlanDeps } from "@/server/services/club-plan.service";
import type { MentoringDeps } from "@/server/services/club-mentoring.service";
import type { MentorVisitDeps } from "@/server/services/mentor-visit.service";
import type { NetworkDeps } from "@/server/services/network.service";
import type { PreferencesDeps } from "@/server/services/preferences.service";
import type { PracticeProgressDeps } from "@/server/services/practice-progress.service";
import type { SearchDeps } from "@/server/services/search.service";
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
  visits: mongoVisitStore,
  plans: mongoPlanStore,
  mentoring: mongoMentoringStore,
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

export const searchDeps: SearchDeps = {
  ...clubDeps,
  content: mongoContentStore,
  sections: mongoSectionStore,
  practice: mongoPracticeStore,
  roleCatalog: mongoRoleCatalogStore,
};

export const visitDeps: MentorVisitDeps = {
  ...clubDeps,
  visits: mongoVisitStore,
  submissions: mongoSubmissionStore,
  plans: mongoPlanStore,
};

export const planDeps: ClubPlanDeps = {
  ...clubDeps,
  plans: mongoPlanStore,
  submissions: mongoSubmissionStore,
  kompas: kompasDeps,
};

export const analyticsDeps: AnalyticsDeps = {
  ...clubDeps,
  kompas: kompasDeps,
  submissions: mongoSubmissionStore,
  licensingSubmissions: mongoLicensingSubmissionStore,
  visits: mongoVisitStore,
  plans: mongoPlanStore,
};

export const networkDeps: NetworkDeps = {
  ...analyticsDeps,
  content: mongoContentStore,
  roleCatalog: mongoRoleCatalogStore,
};

export const preferencesDeps: PreferencesDeps = { preferences: mongoPreferencesStore };

export const mentoringDeps: MentoringDeps = { ...clubDeps, mentoring: mongoMentoringStore };
