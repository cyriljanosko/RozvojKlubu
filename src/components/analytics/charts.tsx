"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

/** Recharts wrappers for the analysis panels (DA-b); colours follow the app's palette. */
const COLORS = ["#2563eb", "#d97706", "#16a34a", "#71717a"];

export function GroupedBars({
  data,
  series,
  max,
  height = 220,
  layout = "horizontal",
}: {
  data: Record<string, string | number | null>[];
  series: { key: string; label: string }[];
  max?: number;
  height?: number;
  layout?: "horizontal" | "vertical";
}) {
  const vertical = layout === "vertical";
  // small scales (club counts) get a tick per unit, larger ones five even steps
  const ticks = max !== undefined && max <= 10 ? max + 1 : 5;
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart
        data={data}
        layout={vertical ? "vertical" : "horizontal"}
        margin={{ left: 0, right: 8 }}
      >
        <CartesianGrid strokeDasharray="3 3" stroke="currentColor" strokeOpacity={0.1} />
        {vertical ? (
          <>
            <XAxis
              type="number"
              domain={[0, max ?? "auto"]}
              allowDecimals={false}
              tickCount={ticks}
              tick={{ fontSize: 11 }}
            />
            <YAxis type="category" dataKey="label" width={110} tick={{ fontSize: 11 }} />
          </>
        ) : (
          <>
            <XAxis dataKey="label" tick={{ fontSize: 11 }} interval={0} />
            <YAxis
              domain={[0, max ?? "auto"]}
              allowDecimals={false}
              tickCount={ticks}
              tick={{ fontSize: 11 }}
              width={28}
            />
          </>
        )}
        <Tooltip contentStyle={{ fontSize: 12 }} />
        {series.length > 1 && <Legend wrapperStyle={{ fontSize: 12 }} />}
        {series.map((s, i) => (
          <Bar
            key={s.key}
            dataKey={s.key}
            name={s.label}
            fill={COLORS[i % COLORS.length]}
            radius={3}
          />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}

export function TrendLines({
  data,
  series,
  height = 220,
}: {
  data: Record<string, string | number>[];
  /** `right` puts a series on its own axis, so a large count does not flatten the small ones */
  series: { key: string; label: string; right?: boolean }[];
  height?: number;
}) {
  const dual = series.some((s) => s.right);
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ left: 0, right: dual ? 0 : 8 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="currentColor" strokeOpacity={0.1} />
        <XAxis dataKey="season" tick={{ fontSize: 11 }} />
        <YAxis yAxisId="left" allowDecimals={false} tick={{ fontSize: 11 }} width={32} />
        {dual && (
          <YAxis
            yAxisId="right"
            orientation="right"
            allowDecimals={false}
            tick={{ fontSize: 11 }}
            width={36}
          />
        )}
        <Tooltip contentStyle={{ fontSize: 12 }} />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        {series.map((s, i) => (
          <Line
            key={s.key}
            yAxisId={s.right ? "right" : "left"}
            type="monotone"
            dataKey={s.key}
            name={s.label}
            stroke={COLORS[i % COLORS.length]}
            strokeWidth={2}
            dot={{ r: 3 }}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}
