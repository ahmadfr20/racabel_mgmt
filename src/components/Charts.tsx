"use client";

import {
  Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart,
  PolarAngleAxis, PolarGrid, Pie, PieChart,
  Radar, RadarChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";

const tooltipStyle = {
  borderRadius: 12,
  border: "1px solid #e2e8f0",
  fontSize: 12,
  boxShadow: "0 4px 16px rgba(0,0,0,0.08)",
};

export function AttendanceTrendChart({
  data,
}: {
  data: { day: string; tepat: number; terlambat: number }[];
}) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={data} barGap={4}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eef2f7" />
        <XAxis dataKey="day" tickLine={false} axisLine={false} fontSize={12} stroke="#94a3b8" />
        <YAxis tickLine={false} axisLine={false} fontSize={12} stroke="#94a3b8" allowDecimals={false} />
        <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "#f1f5f9" }} />
        <Legend iconType="circle" wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
        <Bar dataKey="tepat" name="Tepat Waktu" fill="#10b981" radius={[6, 6, 0, 0]} maxBarSize={28} />
        <Bar dataKey="terlambat" name="Terlambat" fill="#f43f5e" radius={[6, 6, 0, 0]} maxBarSize={28} />
      </BarChart>
    </ResponsiveContainer>
  );
}

const DEPT_COLORS = ["#6366f1", "#10b981", "#f59e0b", "#ef4444", "#06b6d4", "#8b5cf6"];

export function PerformanceByDeptChart({
  data,
}: {
  data: { name: string; score: number }[];
}) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={data} layout="vertical" margin={{ left: 8, right: 16 }}>
        <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#eef2f7" />
        <XAxis type="number" domain={[0, 100]} tickLine={false} axisLine={false} fontSize={12} stroke="#94a3b8" />
        <YAxis type="category" dataKey="name" tickLine={false} axisLine={false} fontSize={12} stroke="#64748b" width={90} />
        <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "#f1f5f9" }} formatter={(v) => [`${v}`, "Skor"]} />
        <Bar dataKey="score" radius={[0, 6, 6, 0]} maxBarSize={26}>
          {data.map((_, i) => (
            <Cell key={i} fill={DEPT_COLORS[i % DEPT_COLORS.length]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

export function KpiRadarChart({ data }: { data: { metric: string; score: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={280}>
      <RadarChart data={data} outerRadius="72%">
        <PolarGrid stroke="#e2e8f0" />
        <PolarAngleAxis dataKey="metric" fontSize={12} stroke="#64748b" />
        <Radar dataKey="score" stroke="#6366f1" fill="#6366f1" fillOpacity={0.35} />
        <Tooltip contentStyle={tooltipStyle} />
      </RadarChart>
    </ResponsiveContainer>
  );
}

export function RevenueTrendChart({
  data,
}: {
  data: { date: string; revenue: number; orders: number }[];
}) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <LineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eef2f7" />
        <XAxis
          dataKey="date"
          tickLine={false}
          axisLine={false}
          fontSize={12}
          stroke="#94a3b8"
          tickFormatter={(v: string) => v.slice(5)}
        />
        <YAxis
          tickLine={false}
          axisLine={false}
          fontSize={12}
          stroke="#94a3b8"
          tickFormatter={(v: number) => `${(v / 1_000_000).toFixed(0)}jt`}
        />
        <Tooltip
          contentStyle={tooltipStyle}
          formatter={(v: number) => [`Rp ${v.toLocaleString("id-ID")}`, "Revenue"]}
        />
        <Line dataKey="revenue" name="Revenue" stroke="#6366f1" strokeWidth={2} dot={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}

export function TopProductsChart({
  data,
}: {
  data: { name: string; revenue: number }[];
}) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={data} layout="vertical" margin={{ left: 8, right: 16 }}>
        <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#eef2f7" />
        <XAxis
          type="number"
          tickLine={false}
          axisLine={false}
          fontSize={12}
          stroke="#94a3b8"
          tickFormatter={(v: number) => `${(v / 1_000_000).toFixed(0)}jt`}
        />
        <YAxis
          type="category"
          dataKey="name"
          tickLine={false}
          axisLine={false}
          fontSize={11}
          stroke="#64748b"
          width={120}
        />
        <Tooltip
          contentStyle={tooltipStyle}
          formatter={(v: number) => [`Rp ${v.toLocaleString("id-ID")}`, "Revenue"]}
        />
        <Bar dataKey="revenue" radius={[0, 6, 6, 0]} maxBarSize={24}>
          {data.map((_, i) => (
            <Cell key={i} fill={DEPT_COLORS[i % DEPT_COLORS.length]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

const DONUT_COLORS = ["#6366f1", "#10b981", "#f59e0b", "#ef4444", "#06b6d4"];

export function RevenueDonutChart({
  data,
}: {
  data: { name: string; revenue: number }[];
}) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <PieChart>
        <Pie
          data={data}
          dataKey="revenue"
          nameKey="name"
          cx="50%"
          cy="50%"
          innerRadius={55}
          outerRadius={85}
        >
          {data.map((_, i) => (
            <Cell key={i} fill={DONUT_COLORS[i % DONUT_COLORS.length]} />
          ))}
        </Pie>
        <Tooltip
          contentStyle={tooltipStyle}
          formatter={(v: number) => [`Rp ${v.toLocaleString("id-ID")}`, "Revenue"]}
        />
        <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
      </PieChart>
    </ResponsiveContainer>
  );
}
