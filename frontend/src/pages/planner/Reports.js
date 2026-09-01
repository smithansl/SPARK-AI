import { useEffect, useState } from "react";
import { FileText, Download, AlertTriangle, MapPin } from "lucide-react";
import { motion } from "framer-motion";
import api from "../../lib/api";

export default function Reports() {
  const [zones, setZones] = useState([]);
  const [kpis, setKpis] = useState(null);
  const [corr, setCorr] = useState(null);

  useEffect(() => {
    api.get("/zones").then((r) => setZones(r.data));
    api.get("/kpis").then((r) => setKpis(r.data));
    api.get("/correlation").then((r) => setCorr(r.data));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const worst = [...zones].sort((a, b) => a.recovery_rate - b.recovery_rate)[0];
  const today = new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" });

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <div className="font-mono-data text-xs uppercase tracking-[0.3em] text-cyan-400">Decision Support</div>
          <h1 className="font-display text-3xl font-black tracking-tight mt-1">Planning Reports</h1>
        </div>
        <button data-testid="export-report" onClick={() => window.print()}
          className="flex items-center gap-2 border border-cyan-400 text-cyan-400 px-5 py-3 font-mono-data text-xs uppercase tracking-widest hover:bg-cyan-400 hover:text-slate-950 transition-colors">
          <Download className="w-4 h-4" /> Export Brief
        </button>
      </div>

      {/* Priority Intervention */}
      {worst && (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
          className="border border-red-500/40 bg-red-500/5 p-6">
          <div className="flex items-center gap-2 font-mono-data text-xs uppercase tracking-widest text-red-400 mb-4">
            <AlertTriangle className="w-4 h-4" /> Priority Intervention
          </div>
          <div className="grid md:grid-cols-4 gap-6">
            <div>
              <div className="font-display text-2xl font-black">{worst.name}</div>
              <div className="font-mono-data text-[10px] uppercase tracking-widest text-slate-500">Highest need zone</div>
            </div>
            {[
              ["Projected growth", `+${worst.growth}%`],
              ["Recovery capacity", `${worst.recovery_rate}%`],
              ["Service gap", `${worst.service_gap_km} km`],
            ].map(([k, v]) => (
              <div key={k}>
                <div className="font-mono-data text-[10px] uppercase tracking-widest text-slate-500">{k}</div>
                <div className="font-mono-data text-2xl font-bold text-cyan-400">{v}</div>
              </div>
            ))}
          </div>
          <div className="mt-5 border-t border-slate-800 pt-4 flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="font-mono-data text-[10px] uppercase tracking-widest text-slate-500">Recommended Action</div>
              <div className="font-display text-lg font-bold">Develop 1 Community Circular Economy Hub</div>
              <div className="text-sm text-slate-400">Estimated service population: {worst.population.toLocaleString()}</div>
            </div>
            <div className="flex items-center gap-3">
              <span className="font-mono-data text-xs uppercase tracking-widest border border-red-500 text-red-400 px-3 py-1.5">Priority: HIGH</span>
              <button data-testid="view-sites-link" className="flex items-center gap-2 border border-slate-700 px-4 py-2 font-mono-data text-xs uppercase tracking-widest text-cyan-400 hover:border-cyan-400 transition-colors"><MapPin className="w-4 h-4" /> View Suitable Sites</button>
            </div>
          </div>
        </motion.div>
      )}

      {/* Report body */}
      <div className="glass border border-slate-800 p-8">
        <div className="flex items-center gap-2 font-mono-data text-xs uppercase tracking-widest text-slate-500 mb-2">
          <FileText className="w-4 h-4 text-cyan-400" /> SPARK Planning Brief · Sepang District
        </div>
        <div className="font-mono-data text-[10px] uppercase tracking-widest text-slate-600 mb-6">Generated {today}</div>

        {kpis && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-px bg-slate-800 border border-slate-800 mb-6">
            {[
              ["Total waste", `${kpis.total_waste_tonnes} t/mo`],
              ["Recovery", `${kpis.recovery_rate}%`],
              ["Hotspots", kpis.critical_hotspots],
              ["Population", kpis.population.toLocaleString()],
            ].map(([k, v]) => (
              <div key={k} className="bg-[#020617] p-4">
                <div className="font-mono-data text-[9px] uppercase tracking-widest text-slate-500">{k}</div>
                <div className="font-mono-data text-xl font-bold text-cyan-400">{v}</div>
              </div>
            ))}
          </div>
        )}

        <h3 className="font-display text-lg font-bold mb-2">Executive Summary</h3>
        <p className="text-sm text-slate-300 leading-relaxed mb-4">
          Sepang district generates approximately {kpis?.total_waste_tonnes} tonnes of waste per month across {zones.length} monitored
          zones, with a population-weighted recovery rate of {kpis?.recovery_rate}%. Spatial analysis identifies {kpis?.critical_hotspots} critical
          or high-severity hotspots. {corr?.statement} Without intervention, recovery capacity is projected to fall short by 2030.
        </p>

        <h3 className="font-display text-lg font-bold mb-2">Zone Status</h3>
        <table className="w-full text-sm">
          <thead>
            <tr className="font-mono-data text-[10px] uppercase tracking-widest text-slate-500 border-b border-slate-800">
              <th className="text-left py-2">Zone</th>
              <th className="text-left py-2">Land Use</th>
              <th className="text-right py-2">Waste</th>
              <th className="text-right py-2">Recovery</th>
              <th className="text-right py-2">Severity</th>
            </tr>
          </thead>
          <tbody>
            {zones.map((z) => (
              <tr key={z.id} className="border-b border-slate-800/60">
                <td className="py-2 text-slate-200">{z.name}</td>
                <td className="py-2 text-slate-400">{z.land_use}</td>
                <td className="py-2 text-right font-mono-data text-cyan-400">{z.waste_tonnes} t</td>
                <td className="py-2 text-right font-mono-data text-slate-300">{z.recovery_rate}%</td>
                <td className="py-2 text-right font-mono-data uppercase text-xs" style={{ color: z.severity === "critical" ? "#ef4444" : z.severity === "high" ? "#f97316" : z.severity === "medium" ? "#eab308" : "#10b981" }}>{z.severity}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
