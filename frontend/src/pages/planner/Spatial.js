import { useEffect, useState } from "react";
import { Layers, AlertTriangle, Search, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import api from "../../lib/api";
import SepangMap, { SEVERITY_COLOR } from "../../components/SepangMap";

const LAYERS = [
  { id: "waste", label: "Waste Generation", on: true },
  { id: "landuse", label: "Land Use", on: true },
  { id: "population", label: "Population Density", on: true },
  { id: "roads", label: "Road Network", on: true },
  { id: "flood", label: "Flood Risk", on: false },
  { id: "esa", label: "Environmentally Sensitive Area", on: false },
  { id: "facilities", label: "Existing Waste Facilities", on: false },
];

export default function Spatial() {
  const [zones, setZones] = useState([]);
  const [facilities, setFacilities] = useState([]);
  const [routes, setRoutes] = useState([]);
  const [corr, setCorr] = useState(null);
  const [layers, setLayers] = useState(LAYERS);
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    api.get("/zones").then((r) => { setZones(r.data); setSelected(r.data.find((z) => z.severity === "critical") || r.data[0]); });
    api.get("/facilities").then((r) => setFacilities(r.data));
    api.get("/routes").then((r) => setRoutes(r.data));
    api.get("/correlation").then((r) => setCorr(r.data));
  }, []);

  const isOn = (id) => layers.find((l) => l.id === id)?.on;
  const toggle = (id) => setLayers(layers.map((l) => (l.id === id ? { ...l, on: !l.on } : l)));

  const shownZones = isOn("waste") || isOn("landuse") || isOn("population") ? zones : [];
  const activeLayerCount = layers.filter((l) => l.on).length;

  return (
    <div className="relative h-[calc(100vh-56px)] w-full">
      {/* Fullscreen map */}
      <div className="absolute inset-0">
        <SepangMap
          zones={shownZones}
          facilities={isOn("facilities") ? facilities : []}
          routes={isOn("roads") ? routes : []}
          flyTarget={selected}
          onZoneClick={setSelected}
        />
      </div>

      {/* Header strip */}
      <div className="absolute top-3 left-3 right-3 z-[500] flex items-center justify-between pointer-events-none">
        <div className="glass px-4 py-2 pointer-events-auto">
          <div className="font-mono-data text-[10px] uppercase tracking-[0.3em] text-cyan-400">Spatial Intelligence</div>
          <div className="font-display text-sm font-bold">Sepang GIS · {activeLayerCount} layers active</div>
        </div>
      </div>

      {/* Layers panel (left) */}
      <motion.div
        initial={{ x: -30, opacity: 0 }} animate={{ x: 0, opacity: 1 }}
        className="absolute top-20 left-3 z-[500] w-64 glass p-4"
      >
        <div className="flex items-center gap-2 font-mono-data text-xs uppercase tracking-widest text-slate-300 mb-3">
          <Layers className="w-4 h-4 text-cyan-400" /> Layers
        </div>
        <div className="space-y-1">
          {layers.map((l) => (
            <button
              key={l.id}
              data-testid={`layer-${l.id}`}
              onClick={() => toggle(l.id)}
              className="w-full flex items-center gap-3 py-1.5 group"
            >
              <span className={`w-4 h-4 border flex items-center justify-center transition-colors ${l.on ? "bg-cyan-400 border-cyan-400" : "border-slate-600"}`}>
                {l.on && <span className="w-1.5 h-1.5 bg-slate-950" />}
              </span>
              <span className={`text-sm text-left flex-1 transition-colors ${l.on ? "text-white" : "text-slate-500"}`}>{l.label}</span>
            </button>
          ))}
        </div>

        <div className="mt-4 pt-4 border-t border-slate-800">
          <div className="font-mono-data text-[10px] uppercase tracking-widest text-slate-500 mb-2">Severity</div>
          {Object.entries(SEVERITY_COLOR).map(([k, c]) => (
            <div key={k} className="flex items-center gap-2 py-0.5">
              <span className="w-2.5 h-2.5 rounded-full" style={{ background: c }} />
              <span className="text-xs text-slate-400 capitalize">{k}</span>
            </div>
          ))}
        </div>
      </motion.div>

      {/* AI Analysis panel (right) */}
      <motion.div
        initial={{ x: 30, opacity: 0 }} animate={{ x: 0, opacity: 1 }}
        className="absolute top-20 right-3 bottom-3 z-[500] w-80 glass p-5 flex flex-col overflow-y-auto"
      >
        <div className="flex items-center gap-2 font-mono-data text-xs uppercase tracking-widest text-slate-300 mb-4">
          <AlertTriangle className="w-4 h-4 text-red-400" /> AI Analysis
        </div>

        {selected && (
          <AnimatePresence mode="wait">
            <motion.div key={selected.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full" style={{ background: SEVERITY_COLOR[selected.severity] }} />
                <span className="font-mono-data text-[10px] uppercase tracking-widest capitalize" style={{ color: SEVERITY_COLOR[selected.severity] }}>
                  {selected.severity}
                </span>
              </div>
              <div className="font-display text-xl font-black mt-1">{selected.name}</div>
              <div className="font-mono-data text-[10px] uppercase tracking-widest text-slate-500">{selected.land_use}</div>

              <div className="grid grid-cols-2 gap-px bg-slate-800 border border-slate-800 mt-4">
                {[
                  ["Waste", `${selected.waste_tonnes} t/mo`],
                  ["Growth", `+${selected.growth}%`],
                  ["Recovery", `${selected.recovery_rate}%`],
                  ["Coverage", `${selected.collection_coverage}%`],
                ].map(([k, v]) => (
                  <div key={k} className="bg-[#020617] p-3">
                    <div className="font-mono-data text-[9px] uppercase tracking-widest text-slate-500">{k}</div>
                    <div className="font-mono-data text-lg font-bold text-cyan-400">{v}</div>
                  </div>
                ))}
              </div>

              <div className="mt-4">
                <div className="font-mono-data text-[10px] uppercase tracking-widest text-slate-500 mb-2">Waste Composition</div>
                {Object.entries(selected.waste_types).map(([t, p]) => (
                  <div key={t} className="mb-2">
                    <div className="flex justify-between text-xs text-slate-300 mb-1">
                      <span>{t}</span><span className="font-mono-data">{p}%</span>
                    </div>
                    <div className="h-1.5 bg-slate-800">
                      <div className="h-full bg-cyan-400" style={{ width: `${p}%` }} />
                    </div>
                  </div>
                ))}
              </div>

              {corr && (isOn("landuse") && isOn("waste")) && (
                <div className="mt-4 border border-cyan-400/40 bg-cyan-400/5 p-3">
                  <div className="font-mono-data text-[10px] uppercase tracking-widest text-cyan-400 mb-1">Combined-layer insight</div>
                  <div className="text-sm text-white">{corr.statement}</div>
                </div>
              )}

              <div className="mt-4 border border-orange-400/40 bg-orange-400/5 p-3">
                <div className="font-mono-data text-[10px] uppercase tracking-widest text-orange-400 mb-1">Planning implication</div>
                <div className="text-sm text-white">Service gap {selected.service_gap_km} km · additional recovery capacity may be required.</div>
              </div>

              <button
                data-testid="investigate-btn"
                onClick={() => setSelected({ ...selected })}
                className="mt-4 w-full bg-cyan-400 text-slate-950 font-mono-data text-xs uppercase tracking-widest py-3 flex items-center justify-center gap-2 hover:bg-cyan-300 transition-colors"
              >
                <Search className="w-4 h-4" /> Investigate Zone
              </button>
            </motion.div>
          </AnimatePresence>
        )}
      </motion.div>
    </div>
  );
}
