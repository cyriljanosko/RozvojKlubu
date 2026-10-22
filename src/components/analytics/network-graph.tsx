"use client";

import type { Core, ElementDefinition } from "cytoscape";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";

import type { AreaLine, NetworkEdge, NetworkNode } from "@/server/services/network.service";

/** Line colours of the 1-4-3-3 (as on O Akadémii): violet, zinc, blue, amber (600). */
const LINE: Record<AreaLine, string> = {
  goalkeeper: "#7c3aed",
  defense: "#52525b",
  midfield: "#2563eb",
  attack: "#d97706",
};

/** Kompas bands as in the heat map (0–4, 5–8, 9–12, 13–16, 17–20); grey = not filled. */
function bandColor(points: number | null | undefined): string {
  if (points === null || points === undefined) return "#d4d4d8";
  if (points <= 4) return "#fca5a5";
  if (points <= 8) return "#fcd34d";
  if (points <= 12) return "#fef08a";
  if (points <= 16) return "#86efac";
  return "#16a34a";
}

const short = (text: string, max = 32) => (text.length > max ? `${text.slice(0, max - 1)}…` : text);

function elements(nodes: NetworkNode[], edges: NetworkEdge[], club: boolean): ElementDefinition[] {
  return [
    ...nodes.map((n) => ({
      data: {
        id: n.id,
        label:
          n.kind === "area" ? `${n.area} ${n.label}` : n.kind === "task" ? short(n.label) : n.label,
        kind: n.kind,
        color:
          n.kind === "area"
            ? club
              ? bandColor(n.points)
              : LINE[n.line]
            : n.kind === "role"
              ? "#bfdbfe"
              : n.kind === "person"
                ? "#e4e4e7"
                : "#ffffff",
      },
      classes: [
        n.kind,
        n.kind === "task" ? n.task : "",
        n.kind === "task" && n.done ? "done" : "",
        n.kind === "task" && n.overdue ? "overdue" : "",
        n.kind === "area" && !club ? "line" : "",
      ]
        .filter(Boolean)
        .join(" "),
    })),
    ...edges.map((e) => ({
      data: {
        id: `${e.source}->${e.target}`,
        source: e.source,
        target: e.target,
        width: e.weight ? Math.min(1 + e.weight, 6) : 1.5,
      },
      classes: e.priority ? "priority" : "",
    })),
  ];
}

/**
 * Network graph of the analysis (DA-d) with Cytoscape.js: tap a node to highlight its neighbours
 * and see its detail below; pan and pinch on touch screens. Cytoscape loads only with this panel.
 */
export function NetworkGraph({
  nodes,
  edges,
  club,
}: {
  nodes: NetworkNode[];
  edges: NetworkEdge[];
  /** club map – areas coloured by Kompas instead of the formation lines */
  club: boolean;
}) {
  const t = useTranslations("analytics.network");
  const box = useRef<HTMLDivElement>(null);
  const [selected, setSelected] = useState<string | null>(null);

  // Cytoscape draws into the DOM, so it is set up after mount (not data loading)
  useEffect(() => {
    let cy: Core | null = null;
    let cancelled = false;
    void import("cytoscape").then(({ default: cytoscape }) => {
      if (cancelled || !box.current) return;
      const ink = getComputedStyle(box.current).color;
      cy = cytoscape({
        container: box.current,
        elements: elements(nodes, edges, club),
        // Academy: roles in the middle, areas around; club: force-directed
        layout: club
          ? { name: "cose", animate: false, padding: 16, nodeRepulsion: () => 9000 }
          : {
              name: "concentric",
              animate: false,
              padding: 16,
              minNodeSpacing: 18,
              concentric: (n) => (n.data("kind") === "role" ? 2 : 1),
              levelWidth: () => 1,
            },
        minZoom: 0.3,
        maxZoom: 3,
        wheelSensitivity: 0.3,
        style: [
          {
            selector: "node",
            style: {
              label: "data(label)",
              "background-color": "data(color)",
              color: ink,
              "font-size": 10,
              "text-wrap": "wrap",
              "text-max-width": "90px",
              "text-valign": "bottom",
              "text-margin-y": 3,
              "border-width": 1,
              "border-color": "#a1a1aa",
              width: 18,
              height: 18,
            },
          },
          { selector: "node.area", style: { width: 30, height: 30, "font-weight": "bold" } },
          { selector: "node.line", style: { "border-width": 0 } },
          {
            selector: "node.role",
            style: {
              shape: "round-rectangle",
              "text-valign": "center",
              "text-margin-y": 0,
              "font-size": 9,
              color: "#1e3a8a",
              width: (n: { data: (k: string) => string }) => n.data("label").length * 5 + 12,
              height: 20,
              "border-color": "#2563eb",
            },
          },
          { selector: "node.visit", style: { shape: "diamond", "border-color": "#2563eb" } },
          { selector: "node.goal", style: { shape: "triangle", "border-color": "#16a34a" } },
          { selector: "node.done", style: { opacity: 0.4 } },
          { selector: "node.overdue", style: { "border-color": "#dc2626", "border-width": 3 } },
          { selector: "node.person", style: { width: 14, height: 14 } },
          {
            selector: "edge",
            style: {
              width: "data(width)",
              "line-color": "#a1a1aa",
              opacity: 0.6,
              "curve-style": "haystack",
            },
          },
          { selector: "edge.priority", style: { "line-color": "#2563eb", opacity: 0.9 } },
          { selector: ".faded", style: { opacity: 0.12 } },
          { selector: "node:selected", style: { "border-width": 3, "border-color": "#2563eb" } },
        ],
      });
      cy.on("tap", "node", (event) => {
        const node = event.target;
        cy!.elements().addClass("faded");
        node.closedNeighborhood().removeClass("faded");
        setSelected(node.id());
      });
      cy.on("tap", (event) => {
        if (event.target === cy) {
          cy!.elements().removeClass("faded");
          setSelected(null);
        }
      });
    });
    return () => {
      cancelled = true;
      cy?.destroy();
    };
  }, [nodes, edges, club]);

  const byId = new Map(nodes.map((n) => [n.id, n]));
  const neighbours = (id: string) =>
    edges
      .flatMap((e) => (e.source === id ? [e.target] : e.target === id ? [e.source] : []))
      .map((n) => byId.get(n))
      .filter((n) => n !== undefined);
  const node = selected ? byId.get(selected) : undefined;
  const kinds = ["area", "role", "task", "person"] as const;

  return (
    <div className="flex flex-col gap-3">
      <div
        ref={box}
        role="img"
        aria-label={t("graphLabel", { nodes: nodes.length, edges: edges.length })}
        className="bg-muted/30 h-[420px] w-full touch-none rounded-lg border sm:h-[480px] print:h-[520px]"
      />
      <p className="text-muted-foreground text-xs">{club ? t("legendClub") : t("legendAcademy")}</p>
      {node ? (
        <div className="bg-muted/40 rounded-lg p-3 text-sm" aria-live="polite">
          <p className="text-muted-foreground text-xs">{t(`kind.${node.kind}`)}</p>
          <p className="font-semibold">
            {node.kind === "area" ? `${node.area} · ${node.label}` : node.label}
          </p>
          {node.kind === "area" && club && (
            <p className="text-xs">
              {node.points === null || node.points === undefined
                ? t("notFilled")
                : t("points", { points: node.points })}
            </p>
          )}
          {node.kind === "task" && (
            <p className="text-xs">
              {[
                t(`task.${node.task}`),
                node.owner || null,
                node.dueDate ? t("due", { date: node.dueDate }) : null,
                node.done ? t("done") : node.overdue ? t("overdue") : t("open"),
              ]
                .filter(Boolean)
                .join(" · ")}
            </p>
          )}
          {neighbours(node.id).length > 0 && (
            <p className="mt-1 text-xs">
              <span className="text-muted-foreground">{t("linked")} </span>
              {neighbours(node.id)
                .map((n) => (n.kind === "area" ? `${n.area} ${n.label}` : short(n.label, 40)))
                .join(" · ")}
            </p>
          )}
          {(node.kind === "area" || node.kind === "task") && (
            <Link
              href={node.kind === "area" ? `/oblasti/${node.area}` : node.href}
              className="mt-2 inline-block text-xs underline underline-offset-4"
            >
              {node.kind === "area" ? t("openArea") : t("openTask")}
            </Link>
          )}
        </div>
      ) : (
        <p className="text-muted-foreground text-xs">{t("tapHint")}</p>
      )}
      <details className="text-sm print:hidden">
        <summary className="cursor-pointer text-xs font-medium">{t("list")}</summary>
        <div className="mt-2 flex flex-col gap-2">
          {kinds.map((kind) => {
            const list = nodes.filter((n) => n.kind === kind);
            return list.length === 0 ? null : (
              <div key={kind}>
                <p className="text-muted-foreground text-xs">
                  {t(`kindPlural.${kind}`)} ({list.length})
                </p>
                <ul className="list-disc pl-5 text-xs">
                  {list.map((n) => (
                    <li key={n.id}>
                      {n.kind === "area" ? `${n.area} ${n.label}` : n.label}
                      <span className="text-muted-foreground">
                        {" "}
                        – {neighbours(n.id).length} {t("links")}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      </details>
    </div>
  );
}
