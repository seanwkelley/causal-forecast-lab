"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
  Cell,
} from "recharts";
import type { ProbeResult } from "@/lib/types";
import { probeTypeLabel } from "@/lib/utils";

export function DeltaBarChart({
  results,
  initialProbability,
}: {
  results: ProbeResult[];
  initialProbability: number;
}) {
  const data = results
    .filter((r) => r.updated_probability != null)
    .map((r) => ({
      name: `${probeTypeLabel(r.probe_type)} — ${r.target_id.replace(/_/g, " ")}`,
      shortName: r.target_id.length > 15 ? r.target_id.slice(0, 14) + "…" : r.target_id,
      delta: (r.updated_probability! - initialProbability) * 100,
      type: r.probe_category,
      absShift: (r.absolute_shift ?? 0) * 100,
    }))
    .sort((a, b) => a.delta - b.delta);

  return (
    <div className="w-full h-[300px]">
      <ResponsiveContainer>
        <BarChart data={data} margin={{ top: 10, right: 10, left: 10, bottom: 60 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
          <XAxis
            dataKey="shortName"
            tick={{ fontSize: 9, fill: "#a1a1aa" }}
            angle={-45}
            textAnchor="end"
            height={80}
          />
          <YAxis
            tick={{ fontSize: 10, fill: "#a1a1aa" }}
            tickFormatter={(v: number) => `${v > 0 ? "+" : ""}${v.toFixed(0)}pp`}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "#18181b",
              border: "1px solid #27272a",
              borderRadius: "8px",
              fontSize: 12,
            }}
            formatter={(value: number) => [
              `${value > 0 ? "+" : ""}${value.toFixed(1)}pp`,
              "Δ Probability",
            ]}
            labelFormatter={(_label: string, payload: Array<{ payload?: { name?: string } }>) =>
              payload?.[0]?.payload?.name ?? _label
            }
          />
          <ReferenceLine y={0} stroke="#a1a1aa" strokeWidth={1} />
          <Bar dataKey="delta" radius={[2, 2, 0, 0]}>
            {data.map((entry, i) => (
              <Cell
                key={i}
                fill={entry.delta >= 0 ? "#22c55e" : "#ef4444"}
                fillOpacity={0.8}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

