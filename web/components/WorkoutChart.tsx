"use client";

import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";

export function WorkoutChart({ data }: { data: any[] }) {
  return (
    <div className="h-24 w-full mt-2">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          <Line type="monotone" dataKey="weight" stroke="#22d3ee" strokeWidth={2} dot={false} />
          <Tooltip 
            contentStyle={{ backgroundColor: '#0f172a', border: 'none', borderRadius: '8px', fontSize: '10px' }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
