import { useEffect, useState } from "react";
import { Target, Check, TriangleAlert, MapPin, GitCompare } from "lucide-react";
import { motion } from "framer-motion";
import api from "../../lib/api";
import SepangMap from "../../components/SepangMap";

const FACILITY_TYPES = [
  "Recycling Hub",
  "Material Recovery Facility",
  "Transfer Station",
  "Community Circular Economy Hub",
];

export default function Sites() {
  const [sites, setSites] = useState([]);
  const [facType, setFacType] = useState(FACILITY_TYPES[3]);
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    api.get("/sites").then((r) => { setSites(r.data); setSelected(r.data[0]); });
  }, []);

  const scoreColor = (s) => (s >= 80 ? "#10b981" : s >= 65 ? "#eab308" : "#ef4444");

  return (
    <div className="p-6 space-y-6">
      <div>
        <div className="font-mono-data text-xs uppercase tracking-[0.3em] text-cyan-400">Facility Siting</div>
        <h1 className="font-display text-3xl font-black tracking-tight mt-1">Site Suitability Analysis</h1>
      </div>

      <div className="glass border border-slate-800 p-5">
        <div className="font-mono-data text-xs uppercase tracking-widest text-slate-400 mb-3">What facility do you want to locate?</div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {FACILITY_TYPES.map((t) => (
            <button key={t} data-testid={`factype-${FACILITY_TYPES.indexOf(t)}`} onClick={() => setFacType(t)}
              className={`border p-3 text-left text-sm transition-colors ${facType === t ? "border-cyan-400 bg-cyan-400/10 text-white" : "border-slate-700 text-slate-400 hover:border-slate-500"}`}>
              {t}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Suitability bars */}
        <div className="glass border border-slate-800 p-5">
          <div className="font-mono-data text-xs uppercase tracking-widest text-slate-400 mb-4">AI Site Analysis · Suitability</div>
          <div className="space-y-5">
            {sites.map((s, i) => (
              <button key={s.id} data-testid={`site-bar-${s.id}`} onClick={() => setSelected(s)} className="w-full text-left group">
                <div className="flex justify-between mb-1.5">
                  <span className={`font-display font-bold ${selected?.id === s.id ? "text-cyan-400" : "text-white"}`}>{s.name}</span>
                  <span className="font-mono-data font-bold" style={{ color: scoreColor(s.score) }}>{s.score}%</span>
                </div>
                <div className="h-3 bg-slate-800">
                  <motion.div initial={{ width: 0 }} animate={{ width: `${s.score}%` }} transition={{ delay: i * 0.1, duration: 0.7 }}
                    className="h-full" style={{ background: scoreColor(s.score) }} />
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Map */}
        <div className="border border-slate-800 h-[320px] relative">
          <SepangMap sites={sites} flyTarget={selected} zoom={11} />
        </div>
      </div>

      {/* Selected detail */}
      {selected && (
        <motion.div key={selected.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="glass border border-slate-800 p-6">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <div className="font-display text-2xl font-black">{selected.name}</div>
              <div className="font-mono-data text-[10px] uppercase tracking-widest text-slate-500">Service population ~{selected.service_population.toLocaleString()}</div>
            </div>
            <div className="text-right">
              <div className="font-mono-data text-4xl font-bold" style={{ color: scoreColor(selected.score) }}>{selected.score}%</div>
              <div className="font-mono-data text-[10px] uppercase tracking-widest text-slate-500">Suitability</div>
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-6 mt-6">
            <div>
              <div className="font-mono-data text-[10px] uppercase tracking-widest text-emerald-400 mb-3">Why suitable</div>
              {selected.pros.map((p) => (
                <div key={p} className="flex items-center gap-2 text-sm text-slate-200 py-1.5">
                  <Check className="w-4 h-4 text-emerald-400 shrink-0" /> {p}
                </div>
              ))}
            </div>
            <div>
              <div className="font-mono-data text-[10px] uppercase tracking-widest text-orange-400 mb-3">Constraints</div>
              {selected.constraints.map((c) => (
                <div key={c} className="flex items-center gap-2 text-sm text-slate-200 py-1.5">
                  <TriangleAlert className="w-4 h-4 text-orange-400 shrink-0" /> {c}
                </div>
              ))}
            </div>
          </div>

          <div className="mt-6 border border-cyan-400/40 bg-cyan-400/5 p-4">
            <div className="font-mono-data text-[10px] uppercase tracking-widest text-cyan-400 mb-1">AI Recommendation</div>
            <div className="font-display text-lg font-bold">{selected.recommendation}</div>
          </div>

          <div className="flex flex-wrap gap-3 mt-5">
            <button data-testid="site-view-map" className="flex items-center gap-2 border border-slate-700 px-4 py-2.5 font-mono-data text-xs uppercase tracking-widest text-cyan-400 hover:border-cyan-400 transition-colors"><MapPin className="w-4 h-4" /> View on Map</button>
            <button data-testid="site-compare" className="flex items-center gap-2 border border-slate-700 px-4 py-2.5 font-mono-data text-xs uppercase tracking-widest text-cyan-400 hover:border-cyan-400 transition-colors"><GitCompare className="w-4 h-4" /> Compare Sites</button>
            <button data-testid="site-conflict" className="flex items-center gap-2 border border-slate-700 px-4 py-2.5 font-mono-data text-xs uppercase tracking-widest text-cyan-400 hover:border-cyan-400 transition-colors"><Target className="w-4 h-4" /> Run Conflict Analysis</button>
          </div>
        </motion.div>
      )}
    </div>
  );
}
