import { headers } from "next/headers";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";

import { loadFrameUser, toLinks } from "@/components/app-frame/nav-data";
import { AdminSideMenu } from "@/components/app-frame/admin-side-menu";
import { adminMenu } from "@/lib/navigation";

/**
 * Administration frame (R3.3, analysis 4.2): side menu next to the admin pages; it stacks above
 * the content on phones. Only admins get the menu – pages keep their own access checks.
 */
export default function AdminLayout({ children }: LayoutProps<"/admin">) {
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-1 flex-wrap items-start gap-6 px-4 pt-4 md:pt-6">
      <Suspense fallback={null}>
        <AdminMenu />
      </Suspense>
      <div className="min-w-0 flex-[999_1_560px]">{children}</div>
    </div>
  );
}

async function AdminMenu() {
  const [t, frame] = await Promise.all([getTranslations("nav"), headers().then(loadFrameUser)]);
  if (!frame.context.isAdmin) return null;
  const links = await toLinks(adminMenu());
  return <AdminSideMenu items={links} navLabel={t("adminLabel")} title={t("admin")} />;
}
