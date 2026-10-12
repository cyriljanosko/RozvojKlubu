import { BookOpen, ClipboardCheck, MapPinned, UserRound } from "lucide-react";

import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const modules = [
  {
    title: "Vizitka klubu a mapa",
    description: "Profil klubu napojený na dáta zo Sportnetu a mapa klubov v obciach a mestách.",
    icon: MapPinned,
  },
  {
    title: "Akadémia vzdelávania",
    description: "Vzdelávanie pre manažéra klubu, mentora klubu a dobrovoľníka.",
    icon: BookOpen,
  },
  {
    title: "Dashboard osoby",
    description: "Osobný prehľad, vekové značky a pokrok vo vzdelávaní.",
    icon: UserRound,
  },
  {
    title: "10 oblastí rozvoja a licencie",
    description: "Hodnotenie rozvoja klubu a licenčný systém grassroots klubov.",
    icon: ClipboardCheck,
  },
] as const;

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-10 px-4 py-16 sm:px-6">
      <header className="flex flex-col gap-3">
        <p className="text-muted-foreground text-sm font-medium">Slovenský futbalový zväz</p>
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          Rozvoj klubu – Akadémia vzdelávania
        </h1>
        <p className="text-muted-foreground max-w-2xl">
          Aplikácia je vo vývoji. Nižšie sú moduly prvej verzie.
        </p>
      </header>

      <section className="grid gap-4 sm:grid-cols-2">
        {modules.map(({ title, description, icon: Icon }) => (
          <Card key={title}>
            <CardHeader>
              <Icon className="text-muted-foreground mb-2 size-6" aria-hidden />
              <CardTitle>{title}</CardTitle>
              <CardDescription>{description}</CardDescription>
            </CardHeader>
          </Card>
        ))}
      </section>
    </main>
  );
}
