import { useState } from "react";
import { FlaskConical, Play, ArrowDown, AlertTriangle, Sparkles } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import api from "../../lib/api";

function Slider({ label, value, min, max, step, unit, onChange, testid }) {
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <div>
      <div className="flex justify-between mb-2">
        <span className="text-sm text-slate-300">{label}</span>
        <span className="font-mono-data text-sm font-bold text-cyan-400">{value}{unit}</span>
      </div>
      <input
        data-testid={testid}
        type="range" min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full appearance-none h-1.5 bg-slate-700 outline-none cursor-pointer accent-cyan-400"
        style={{ background: `linear-gradient(to right, #00E5FF ${pct}%, #334155 ${pct}%)` }}
      />
    </div>
  );
}

export default function Simulator() {
  const [pop, setPop] = useState(20);
  const [rec, setRec] = useState(20);
  const [housing, setHousing] = useState(500);
  const [commercial, setCommercial] = useState(false);
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);

  const run = async () => {
    setBusy(true);
    setResult(null);
    try {
      const { data } = await api.post("/simulate", {
        population_growth: pop, recycling_rate: rec, new_housing: housing, new_commercial: commercial,
      });
      setResult(data);
    } catch {
      toast.error("Simulation failed");
    } finally {
      setBusy(false);
    }
  };

  const cascade = result ? [
    { label: "Population", v: `+${pop}%`, c: "#00E5FF" },
    { label: "Waste Generation", v: `+${result.waste_increase_pct}%`, c: "#f97316" },
    { label: "Collection Demand", v: `+${result.collection_demand_pct}%`, c: "#eab308" },
    { label: "Facility Capacity Gap", v: `+${result.capacity_gap_hubs} HUB`, c: "#ef4444" },
    { label: "Traffic Impact", v: `+${result.traffic_impact_pct}%`, c: "#a855f7" },
  ] : [];

  return (
    <div className="p-6">
      <div className="mb-6">
        <div className="font-mono-data text-xs uppercase tracking-[0.3em] text-cyan-400 flex items-center gap-2">
          <FlaskConical className="w-4 h-4" /> SPARK Future Lab ★
        </div>
        <h1 className="font-display text-3xl font-black tracking-tight mt-1">What-If Planning Simulator</h1>
        <p className="text-sm text-slate-400">Change the future — adjust the drivers and let SPARK cascade the spatial impact.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Scenario builder */}
        <div className="glass border border-slate-800 p-6 space-y-6">
          <div className="font-mono-data text-xs uppercase tracking-widest text-slate-400">Scenario Builder — What happens if…</div>

          <Slider testid="sim-pop" label="Population Growth" value={pop} min={0} max={60} step={1} unit="%" onChange={setPop} />
          <Slider testid="sim-rec" label="Recycling Rate" value={rec} min={0} max={80} step={1} unit="%" onChange={setRec} />
          <Slider testid="sim-housing" label="New Housing" value={housing} min={0} max={3000} step={100} unit=" units" onChange={setHousing} />

          <div className="flex items-center justify-between">
            <span className="text-sm text-slate-300">New Commercial Area</span>
            <button
              data-testid="sim-commercial"
              onClick={() => setCommercial((c) => !c)}
              className={`font-mono-data text-xs uppercase tracking-widest border px-4 py-2 transition-colors ${commercial ? "border-cyan-400 text-cyan-400 bg-cyan-400/10" : "border-slate-600 text-slate-500"}`}
            >
              {commercial ? "ON" : "OFF"}
            </button>
          </div>

          <button
            data-testid="run-simulation"
            onClick={run}
            disabled={busy}
            className="w-full bg-cyan-400 text-slate-950 font-mono-data text-sm uppercase tracking-widest py-4 flex items-center justify-center gap-3 hover:bg-cyan-300 transition-colors disabled:opacity-50"
          >
            {busy ? <><Sparkles className="w-4 h-4 animate-pulse" /> Running AI Simulation…</> : <><Play className="w-4 h-4" /> Run AI Simulation</>}
          </button>
        </div>

        {/* Result */}
        <div className="glass border border-slate-800 p-6 min-h-[400px] flex flex-col">
          <div className="font-mono-data text-xs uppercase tracking-widest text-slate-400 mb-4">Simulation Result</div>

          <AnimatePresence mode="wait">
            {!result ? (
              <motion.div key="empty" exit={{ opacity: 0 }} className="flex-1 flex flex-col items-center justify-center text-center">
                <div
                  className="w-full h-40 border border-slate-800 mb-4 bg-cover bg-center opacity-60"
                  style={{ backgroundImage: "url(https://images.unsplash.com/photo-1760553120312-2821bf54e767?crop=entropy&cs=srgb&fm=jpg&q=85&w=800)" }}
                />
                <p className="font-mono-data text-xs uppercase tracking-widest text-slate-500">Adjust drivers and run to model the 2030 scenario</p>
              </motion.div>
            ) : (
              <motion.div key="result" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex-1">
                <div className="space-y-1">
                  {cascade.map((c, i) => (
                    <motion.div key={c.label} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.12 }}>
                      <div className="flex items-center justify-between border border-slate-800 px-4 py-3">
                        <span className="font-mono-data text-xs uppercase tracking-widest text-slate-400">{c.label}</span>
                        <span className="font-mono-data text-lg font-bold" style={{ color: c.c }}>{c.v}</span>
                      </div>
                      {i < cascade.length - 1 && <div className="flex justify-center py-0.5"><ArrowDown className="w-3 h-3 text-slate-600" /></div>}
                    </motion.div>
                  ))}
                </div>

                <div className="mt-4 grid grid-cols-2 gap-px bg-slate-800 border border-slate-800">
                  <div className="bg-[#020617] p-3">
                    <div className="font-mono-data text-[9px] uppercase tracking-widest text-slate-500">Projected waste</div>
                    <div className="font-mono-data text-lg font-bold text-cyan-400">{result.projected_waste} t/mo</div>
                  </div>
                  <div className="bg-[#020617] p-3">
                    <div className="font-mono-data text-[9px] uppercase tracking-widest text-slate-500">Net to landfill</div>
                    <div className="font-mono-data text-lg font-bold text-orange-400">{result.net_landfill_tonnes} t/mo</div>
                  </div>
                </div>

                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.7 }}
                  className="mt-4 border border-cyan-400/40 bg-cyan-400/5 p-4">
                  <div className="flex items-center gap-2 font-mono-data text-[10px] uppercase tracking-widest text-cyan-400 mb-2">
                    <Sparkles className="w-3.5 h-3.5" /> AI Recommendation
                  </div>
                  <p className="text-sm text-slate-100 leading-relaxed">{result.recommendation}</p>
                </motion.div>

                <div className="mt-3 border border-red-500/40 bg-red-500/5 p-3 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
                  <span className="text-sm text-slate-200">Service-capacity gap emerges in <strong className="text-red-400">{result.affected_zone}</strong>.</span>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
