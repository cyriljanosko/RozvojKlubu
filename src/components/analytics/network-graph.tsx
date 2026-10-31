"use client";

import type { Core, ElementDefinition } from "cytoscape";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";

import type { AreaLine, NetworkEdge, NetworkNode } from "@/server/services/network.service";

/**
 * Colours from the design-system tokens, resolved when the graph is drawn: Cytoscape paints on a
 * canvas and needs plain hex, not var() or the lab() colours browsers may return (NEXT, 26. 10.).
 */
const TOKENS = {
  ink: "--ink",
  muted: "--ink-muted",
  hairline: "--hairline",
  surface: "--surface",
  raised: "--surface-raised",
  blue: "--brand-blue",
  blueDeep: "--brand-blue-deep",
  blueTint: "--brand-blue-tint",
  blueInk: "--brand-blue-ink",
  role: "--chart-4",
  task: "--chart-3",
  success: "--success",
  danger: "--danger",
  start: "--danger-tint",
  rising: "--warning-tint",
  good: "--info-tint",
  model: "--success-tint",
} as const;
type Palette = Record<keyof typeof TOKENS, string>;

function readPalette(): Palette {
  const style = getComputedStyle(document.documentElement);
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 1;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  const rgb = (value: string) => {
    if (!ctx) return value;
    ctx.clearRect(0, 0, 1, 1);
    ctx.fillStyle = value;
    ctx.fillRect(0, 0, 1, 1);
    const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
    return `#${[r, g, b].map((x) => x.toString(16).padStart(2, "0")).join("")}`;
  };
  return Object.fromEntries(
    Object.entries(TOKENS).map(([key, name]) => [key, rgb(style.getPropertyValue(name).trim())]),
  ) as Palette;
}

/** Area colour by the line of the eleven, in SFZ blue shades as everywhere in the app. */
const lineColor = (line: AreaLine, c: Palette) =>
  ({ goalkeeper: c.blueDeep, defense: c.blue, midfield: c.blueTint, attack: c.raised })[line];

/** Kompas bands as in the heat map (0–4, 5–8, 9–12, 13–16, 17–20); raised surface = not filled. */
function bandColor(points: number | null | undefined, c: Palette): string {
  if (points === null || points === undefined) return c.raised;
  if (points <= 4) return c.start;
  if (points <= 8) return c.rising;
  if (points <= 12) return c.surface;
  if (points <= 16) return c.good;
  return c.model;
}

const short = (text: string, max = 32) => (text.length > max ? `${text.slice(0, max - 1)}…` : text);

function elements(
  nodes: NetworkNode[],
  edges: NetworkEdge[],
  club: boolean,
  c: Palette,
): ElementDefinition[] {
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
              ? bandColor(n.points, c)
              : lineColor(n.line, c)
            : n.kind === "role"
              ? c.blueTint
              : n.kind === "person"
                ? c.raised
                : c.surface,
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
      const c = readPalette();
      cy = cytoscape({
        container: box.current,
        elements: elements(nodes, edges, club, c),
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
              color: c.ink,
              "font-size": 10,
              "text-wrap": "wrap",
              "text-max-width": "90px",
              "text-valign": "bottom",
              "text-margin-y": 3,
              "border-width": 1,
              "border-color": c.muted,
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
              color: c.blueInk,
              width: (n: { data: (k: string) => string }) => n.data("label").length * 5 + 12,
              height: 20,
              "border-color": c.blue,
            },
          },
          { selector: "node.visit", style: { shape: "diamond", "border-color": c.blue } },
          { selector: "node.goal", style: { shape: "triangle", "border-color": c.success } },
          { selector: "node.done", style: { opacity: 0.4 } },
          { selector: "node.overdue", style: { "border-color": c.danger, "border-width": 3 } },
          { selector: "node.person", style: { width: 14, height: 14 } },
          {
            selector: "edge",
            style: {
              width: "data(width)",
              "line-color": c.muted,
              opacity: 0.6,
              "curve-style": "haystack",
            },
          },
          { selector: "edge.priority", style: { "line-color": c.blue, opacity: 0.9 } },
          { selector: ".faded", style: { opacity: 0.12 } },
          { selector: "node:selected", style: { "border-width": 3, "border-color": c.blue } },
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
        className="h-[420px] w-full touch-none rounded-(--radius-md) border border-(--hairline) bg-(--surface) sm:h-[480px] print:h-[520px]"
      />
      <p className="text-xs text-(--ink-muted)">{club ? t("legendClub") : t("legendAcademy")}</p>
      {node ? (
        <div className="rounded-(--radius-sm) bg-(--surface) p-3 text-sm" aria-live="polite">
          <p className="text-xs text-(--ink-muted)">{t(`kind.${node.kind}`)}</p>
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
              <span className="text-(--ink-muted)">{t("linked")} </span>
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
        <p className="text-xs text-(--ink-muted)">{t("tapHint")}</p>
      )}
      <details className="text-sm print:hidden">
        <summary className="cursor-pointer text-xs font-medium">{t("list")}</summary>
        <div className="mt-2 flex flex-col gap-2">
          {kinds.map((kind) => {
            const list = nodes.filter((n) => n.kind === kind);
            return list.length === 0 ? null : (
              <div key={kind}>
                <p className="text-xs text-(--ink-muted)">
                  {t(`kindPlural.${kind}`)} ({list.length})
                </p>
                <ul className="list-disc pl-5 text-xs">
                  {list.map((n) => (
                    <li key={n.id}>
                      {n.kind === "area" ? `${n.area} ${n.label}` : n.label}
                      <span className="text-(--ink-muted)">
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
