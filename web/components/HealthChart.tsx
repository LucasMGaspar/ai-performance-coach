"use client";

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

export function HealthChart({ data }: { data: any[] }) {
  return (
    <div className="h-64 w-full pt-4">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          <XAxis dataKey="date" stroke="#475569" fontSize={10} />
          <YAxis hide domain={[0, 10]} />
          <Tooltip 
            contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '8px', borderStyle: 'none' }}
            itemStyle={{ fontSize: '10px' }}
          />
          <Line type="monotone" dataKey="sleep" stroke="#3b82f6" strokeWidth={2} dot={{ fill: '#3b82f6' }} name="Sono" />
          <Line type="monotone" dataKey="energy" stroke="#eab308" strokeWidth={2} dot={{ fill: '#eab308' }} name="Energia" />
          <Line type="monotone" dataKey="mood" stroke="#ec4899" strokeWidth={2} dot={{ fill: '#ec4899' }} name="Humor" />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
