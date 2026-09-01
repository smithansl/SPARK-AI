import { useEffect, useState } from "react";
import { Truck, Route as RouteIcon } from "lucide-react";
import { motion } from "framer-motion";
import api from "../../lib/api";
import SepangMap from "../../components/SepangMap";

export default function Logistics() {
  const [routes, setRoutes] = useState([]);
  const [zones, setZones] = useState([]);
  const [active, setActive] = useState(null);
  const [facilities, setFacilities] = useState([]);

  useEffect(() => {
    api.get("/routes").then((r) => setRoutes(r.data));
    api.get("/zones").then((r) => setZones(r.data));
    api.get("/facilities").then((r) => setFacilities(r.data));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const shown = active ? routes.filter((r) => r.id === active) : routes;

  return (
    <div className="p-6 space-y-6">
      <div>
        <div className="font-mono-data text-xs uppercase tracking-[0.3em] text-cyan-400">Network Optimisation</div>
        <h1 className="font-display text-3xl font-black tracking-tight mt-1">Collection Logistics</h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 border border-slate-800 h-[420px] relative">
          <SepangMap zones={zones} routes={shown} facilities={facilities} zoom={11} />
        </div>

        <div className="space-y-3">
          <button data-testid="route-all" onClick={() => setActive(null)}
            className={`w-full text-left border p-3 font-mono-data text-xs uppercase tracking-widest transition-colors ${!active ? "border-cyan-400 text-cyan-400 bg-cyan-400/10" : "border-slate-700 text-slate-400"}`}>
            All Corridors
          </button>
          {routes.map((r, i) => (
            <motion.button
              key={r.id}
              data-testid={`route-${r.id}`}
              initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.08 }}
              onClick={() => setActive(r.id)}
              className={`w-full text-left glass border p-4 transition-colors ${active === r.id ? "border-cyan-400" : "border-slate-800 hover:border-slate-600"}`}
            >
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full" style={{ background: r.color }} />
                <span className="font-display font-bold">{r.name}</span>
              </div>
              <div className="grid grid-cols-2 gap-2 mt-3">
                {[
                  ["Vehicles", r.vehicles],
                  ["Distance", `${r.distance_km} km`],
                  ["Load", `${r.load_tonnes} t`],
                  ["Efficiency", `${r.efficiency}%`],
                ].map(([k, v]) => (
                  <div key={k}>
                    <div className="font-mono-data text-[9px] uppercase tracking-widest text-slate-500">{k}</div>
                    <div className="font-mono-data text-sm font-bold text-cyan-400">{v}</div>
                  </div>
                ))}
              </div>
              <div className="mt-3 h-1.5 bg-slate-800">
                <div className="h-full" style={{ width: `${r.efficiency}%`, background: r.color }} />
              </div>
            </motion.button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { icon: Truck, label: "Active Vehicles", v: routes.reduce((a, r) => a + r.vehicles, 0) },
          { icon: RouteIcon, label: "Total Distance", v: `${routes.reduce((a, r) => a + r.distance_km, 0).toFixed(1)} km` },
          { icon: Truck, label: "Load Handled", v: `${routes.reduce((a, r) => a + r.load_tonnes, 0).toFixed(1)} t` },
          { icon: RouteIcon, label: "Avg Efficiency", v: routes.length ? `${Math.round(routes.reduce((a, r) => a + r.efficiency, 0) / routes.length)}%` : "—" },
        ].map((s) => (
          <div key={s.label} className="glass border border-slate-800 p-4">
            <s.icon className="w-4 h-4 text-cyan-400 mb-2" />
            <div className="font-mono-data text-2xl font-bold text-cyan-400">{s.v}</div>
            <div className="font-mono-data text-[10px] uppercase tracking-widest text-slate-500">{s.label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
