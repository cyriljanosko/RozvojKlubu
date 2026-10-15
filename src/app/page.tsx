import { BookOpen, ClipboardCheck, MapPinned, UserRound } from "lucide-react";
import { useTranslations } from "next-intl";

import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const modules = [
  { key: "clubCard", icon: MapPinned },
  { key: "academy", icon: BookOpen },
  { key: "personDashboard", icon: UserRound },
  { key: "development", icon: ClipboardCheck },
] as const;

export default function Home() {
  const t = useTranslations("home");
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-10 px-4 py-16 sm:px-6">
      <header className="flex flex-col gap-3">
        <p className="text-muted-foreground text-sm font-medium">{t("eyebrow")}</p>
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">{t("title")}</h1>
        <p className="text-muted-foreground max-w-2xl">{t("intro")}</p>
      </header>

      <section className="grid gap-4 sm:grid-cols-2">
        {modules.map(({ key, icon: Icon }) => (
          <Card key={key}>
            <CardHeader>
              <Icon className="text-muted-foreground mb-2 size-6" aria-hidden />
              <CardTitle>{t(`modules.${key}.title`)}</CardTitle>
              <CardDescription>{t(`modules.${key}.description`)}</CardDescription>
            </CardHeader>
          </Card>
        ))}
      </section>
    </main>
  );
}
