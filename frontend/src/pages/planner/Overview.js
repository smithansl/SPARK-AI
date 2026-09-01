import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AreaChart, Area, XAxis, YAxis, ResponsiveContainer, Tooltip as RTooltip, CartesianGrid } from "recharts";
import { AlertTriangle, ArrowUpRight, TrendingUp, Recycle, MapPin, Trash2, ArrowRight } from "lucide-react";
import { motion } from "framer-motion";
import api from "../../lib/api";
import SepangMap from "../../components/SepangMap";

function KpiCard({ value, unit, label, sub, tone = "dark", delay = 0 }) {
  const white = tone === "white";
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
      className={`p-5 border ${white ? "bg-white text-slate-950 border-white" : "glass border-slate-800"}`}
      data-testid={`kpi-${label.toLowerCase().replace(/\s/g, "-")}`}
    >
      <div className="flex items-baseline gap-1">
        <span className={`font-mono-data text-3xl font-bold ${white ? "text-slate-950" : "text-cyan-400"}`}>{value}</span>
        {unit && <span className={`font-mono-data text-sm ${white ? "text-slate-500" : "text-slate-400"}`}>{unit}</span>}
      </div>
      <div className={`font-display text-sm font-bold mt-2 ${white ? "text-slate-900" : "text-white"}`}>{label}</div>
      <div className={`font-mono-data text-[10px] uppercase tracking-widest mt-0.5 ${white ? "text-slate-500" : "text-slate-500"}`}>{sub}</div>
    </motion.div>
  );
}

export default function Overview() {
  const navigate = useNavigate();
  const [kpis, setKpis] = useState(null);
  const [zones, setZones] = useState([]);
  const [forecast, setForecast] = useState(null);
  const [corr, setCorr] = useState(null);
  const [facilities, setFacilities] = useState([]);

  useEffect(() => {
    api.get("/kpis").then((r) => setKpis(r.data));
    api.get("/zones").then((r) => setZones(r.data));
    api.get("/forecast").then((r) => setForecast(r.data));
    api.get("/correlation").then((r) => setCorr(r.data));
    api.get("/facilities").then((r) => setFacilities(r.data));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const hour = new Date().getHours();
  const greet = hour < 12 ? "GOOD MORNING" : hour < 18 ? "GOOD AFTERNOON" : "GOOD EVENING";

  return (
    <div className="p-6 space-y-6">
      <div>
        <div className="font-mono-data text-xs uppercase tracking-[0.3em] text-cyan-400">{greet}, PLANNER</div>
        <h1 className="font-display text-3xl font-black tracking-tight mt-1">Sepang Spatial Intelligence Overview</h1>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard tone="white" value={kpis?.total_waste_tonnes ?? "—"} unit="t/mo" label="Waste Generated" sub="District total" delay={0} />
        <KpiCard value={`+${kpis?.growth_2030 ?? "—"}%`} label="Growth 2030" sub="Projected rise" delay={0.08} />
        <KpiCard value={`${kpis?.recovery_rate ?? "—"}%`} label="Recovery Rate" sub="Population weighted" delay={0.16} />
        <KpiCard value={String(kpis?.critical_hotspots ?? "—").padStart(2, "0")} label="Hotspots" sub="Critical / high" delay={0.24} />
      </div>

      {/* Map + AI insight */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 border border-slate-800 relative h-[380px] overflow-hidden">
          <div className="absolute top-3 left-3 z-[500] glass px-3 py-1.5 font-mono-data text-[10px] uppercase tracking-widest text-cyan-400">
            ● Live GIS Map · Sepang
          </div>
          <SepangMap zones={zones} facilities={facilities} onZoneClick={() => navigate("/intelligence/spatial")} />
        </div>

        <div className="glass border border-slate-800 p-5 flex flex-col">
          <div className="flex items-center gap-2 text-orange-400 font-mono-data text-xs uppercase tracking-widest">
            <AlertTriangle className="w-4 h-4" /> AI Insight
          </div>
          <div className="mt-4 flex-1">
            <div className="font-display text-lg font-bold leading-snug">
              Emerging waste hotspot detected in Labu Lanjut East
            </div>
            <p className="text-sm text-slate-400 mt-3">
              Plastic generation is up <span className="text-cyan-400 font-mono-data">+23%</span> against
              baseline, concentrated around commercial land use.
            </p>
            {corr && (
              <div className="mt-4 border border-slate-800 p-3">
                <div className="font-mono-data text-[10px] uppercase tracking-widest text-slate-500 mb-1">Layer correlation</div>
                <div className="text-sm text-white">{corr.statement}</div>
              </div>
            )}
          </div>
          <button
            data-testid="view-analysis-btn"
            onClick={() => navigate("/intelligence/spatial")}
            className="mt-4 group flex items-center justify-between border border-slate-700 px-4 py-3 hover:border-cyan-400 transition-colors"
          >
            <span className="font-mono-data text-xs uppercase tracking-widest text-cyan-400">View Analysis</span>
            <ArrowRight className="w-4 h-4 text-cyan-400 group-hover:translate-x-1 transition-transform" />
          </button>
        </div>
      </div>

      {/* Trend + Development impact */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 glass border border-slate-800 p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="font-mono-data text-xs uppercase tracking-widest text-slate-400 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-cyan-400" /> Waste Trend · 2026 → 2035
            </div>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={forecast?.trend_series || []}>
              <defs>
                <linearGradient id="g1" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#00E5FF" stopOpacity={0.5} />
                  <stop offset="100%" stopColor="#00E5FF" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="#1e293b" vertical={false} />
              <XAxis dataKey="year" stroke="#475569" fontSize={11} tickLine={false} />
              <YAxis stroke="#475569" fontSize={11} tickLine={false} axisLine={false} />
              <RTooltip contentStyle={{ background: "#020617", border: "1px solid #1e293b", fontFamily: "JetBrains Mono", fontSize: 12 }} />
              <Area type="monotone" dataKey="waste" stroke="#00E5FF" strokeWidth={2} fill="url(#g1)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="glass border border-slate-800 p-5 flex flex-col">
          <div className="font-mono-data text-xs uppercase tracking-widest text-slate-400 mb-4">Development Impact</div>
          <div className="space-y-3 flex-1">
            {[
              { icon: Trash2, label: "New development", v: "Waste +24%", c: "text-orange-400" },
              { icon: Truck2, label: "Collection", v: "Demand +19%", c: "text-cyan-400" },
              { icon: Recycle, label: "Recovery gap", v: "-5% by 2030", c: "text-red-400" },
            ].map((d, i) => (
              <div key={i} className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2 text-slate-300 text-sm">
                  <d.icon className="w-4 h-4 text-slate-500" /> {d.label}
                </div>
                <span className={`font-mono-data text-sm font-bold ${d.c}`}>{d.v}</span>
              </div>
            ))}
          </div>
          <button
            data-testid="view-projection-btn"
            onClick={() => navigate("/intelligence/forecast")}
            className="mt-4 group flex items-center justify-between border border-slate-700 px-4 py-3 hover:border-cyan-400 transition-colors"
          >
            <span className="font-mono-data text-xs uppercase tracking-widest text-cyan-400">View Projection</span>
            <ArrowUpRight className="w-4 h-4 text-cyan-400 group-hover:translate-x-1 transition-transform" />
          </button>
        </div>
      </div>
    </div>
  );
}

// small inline icon alias (lucide Truck used already imported? use MapPin fallback)
function Truck2(props) { return <MapPin {...props} />; }
