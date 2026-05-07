"use client";

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

interface DataPoint {
  date: string;
  weight: number;
  volume: number;
}

export function ProgressChart({ data, metric }: { data: DataPoint[]; metric: "weight" | "volume" }) {
  const color = metric === "weight" ? "#22d3ee" : "#4ade80";
  const label = metric === "weight" ? "Carga (kg)" : "Volume (kg)";

  return (
    <ResponsiveContainer width="100%" height={180}>
      <LineChart data={data} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
        <XAxis dataKey="date" tick={{ fill: "#64748b", fontSize: 10 }} tickFormatter={(v) => v.slice(5)} />
        <YAxis tick={{ fill: "#64748b", fontSize: 10 }} />
        <Tooltip
          contentStyle={{ background: "#0f172a", border: "1px solid #1e293b", borderRadius: 8 }}
          labelStyle={{ color: "#94a3b8" }}
          itemStyle={{ color }}
        />
        <Line
          type="monotone" dataKey={metric}
          stroke={color} strokeWidth={2} dot={{ fill: color, r: 3 }}
          name={label}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
