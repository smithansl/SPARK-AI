import { useEffect, useState } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RTooltip, ResponsiveContainer } from "recharts";
import { TrendingUp, AlertTriangle } from "lucide-react";
import { motion } from "framer-motion";
import api from "../../lib/api";

export default function Forecast() {
  const [f, setF] = useState(null);
  useEffect(() => { api.get("/forecast").then((r) => setF(r.data)); }, []);
  if (!f) return null;

  const nodes = f.years.map((y, i) => ({ year: y, waste: f.waste_tonnes[i] }));

  const rows = [
    { label: "Population Index", vals: f.population_index, unit: "" },
    { label: "Waste Generation", vals: f.waste_tonnes, unit: " t/mo" },
    { label: "Recycling Demand", vals: f.recycling_demand_index, unit: "" },
    { label: "Facility Demand", vals: f.facility_demand, unit: " units" },
  ];

  return (
    <div className="p-6 space-y-6">
      <div>
        <div className="font-mono-data text-xs uppercase tracking-[0.3em] text-cyan-400">Predictive Planning</div>
        <h1 className="font-display text-3xl font-black tracking-tight mt-1">Waste Future Projection</h1>
      </div>

      {/* Timeline */}
      <div className="glass border border-slate-800 p-6">
        <div className="flex justify-between font-mono-data text-[10px] uppercase tracking-widest text-slate-500 mb-2">
          <span>Current</span><span>Future</span>
        </div>
        <div className="relative flex justify-between items-center py-6">
          <div className="absolute left-0 right-0 top-1/2 h-px bg-gradient-to-r from-cyan-400 to-orange-400" />
          {nodes.map((n, i) => (
            <motion.div key={n.year} initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: i * 0.12 }}
              className="relative flex flex-col items-center">
              <div className="w-4 h-4 rounded-full bg-cyan-400 glow-teal z-10" />
              <div className="font-mono-data text-lg font-bold mt-3">{n.waste} t</div>
              <div className="font-mono-data text-[10px] uppercase tracking-widest text-slate-500">{n.year}</div>
            </motion.div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 glass border border-slate-800 p-5">
          <div className="font-mono-data text-xs uppercase tracking-widest text-slate-400 flex items-center gap-2 mb-4">
            <TrendingUp className="w-4 h-4 text-cyan-400" /> Waste Generation Trajectory
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={f.trend_series}>
              <CartesianGrid stroke="#1e293b" vertical={false} />
              <XAxis dataKey="year" stroke="#475569" fontSize={11} tickLine={false} />
              <YAxis stroke="#475569" fontSize={11} tickLine={false} axisLine={false} />
              <RTooltip contentStyle={{ background: "#020617", border: "1px solid #1e293b", fontFamily: "JetBrains Mono", fontSize: 12 }} />
              <Line type="monotone" dataKey="waste" stroke="#00E5FF" strokeWidth={2.5} dot={{ r: 3, fill: "#00E5FF" }} />
              <Line type="monotone" dataKey="recovery" stroke="#10b981" strokeWidth={2} strokeDasharray="5 5" dot={false} />
            </LineChart>
          </ResponsiveContainer>
          <div className="flex gap-6 mt-2 font-mono-data text-[10px] uppercase tracking-widest">
            <span className="flex items-center gap-2"><span className="w-3 h-0.5 bg-cyan-400" /> Waste t/mo</span>
            <span className="flex items-center gap-2"><span className="w-3 h-0.5 bg-emerald-500" /> Recovery %</span>
          </div>
        </div>

        <div className="glass border border-slate-800 p-5">
          <div className="font-mono-data text-xs uppercase tracking-widest text-slate-400 mb-4">AI Projection</div>
          <table className="w-full text-sm">
            <thead>
              <tr className="font-mono-data text-[10px] uppercase tracking-widest text-slate-500">
                <th className="text-left pb-2">Indicator</th>
                {f.years.map((y) => <th key={y} className="text-right pb-2">{y}</th>)}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.label} className="border-t border-slate-800">
                  <td className="py-2 text-slate-300">{r.label}</td>
                  {r.vals.map((v, i) => (
                    <td key={i} className={`py-2 text-right font-mono-data ${i === 0 ? "text-slate-400" : "text-cyan-400"}`}>{v}{r.unit}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="border border-red-500/40 bg-red-500/5 p-5 flex items-start gap-3">
        <AlertTriangle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
        <div>
          <div className="font-mono-data text-xs uppercase tracking-widest text-red-400 mb-1">Planning Alert</div>
          <p className="text-sm text-slate-200">{f.alert}</p>
        </div>
      </div>
    </div>
  );
}
