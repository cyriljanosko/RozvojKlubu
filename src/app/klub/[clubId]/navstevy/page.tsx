import { redirect } from "next/navigation";
import { Suspense } from "react";

type Props = PageProps<"/klub/[clubId]/navstevy">;

async function ToMentoring({ params }: Props): Promise<null> {
  const { clubId } = await params;
  redirect(`/klub/${clubId}/mentoring#navstevy`);
  return null;
}

/**
 * The visits list moved into the mentoring page (step 3 of the season, decision 29. 10. 2026).
 * Old links and pins keep working through this redirect; detail and new visit stay here.
 */
export default function VisitsPage(props: Props) {
  return (
    <Suspense fallback={null}>
      <ToMentoring {...props} />
    </Suspense>
  );
}
