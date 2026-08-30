import { useEffect, useState } from "react";
import { MapContainer, TileLayer, Marker, Tooltip, useMap } from "react-leaflet";
import L from "leaflet";
import { Clock, Phone, MapPin, Navigation } from "lucide-react";
import { motion } from "framer-motion";
import api from "../../lib/api";
import { CARTO_TILE_URL } from "../../lib/geo";

const TYPE_COLOR = {
  "Drop-Off Recycling Centre": "#10b981",
  "Recycling Centre": "#06b6d4",
  "Scrap Metal Dealer": "#f97316",
  "Used Cooking Oil Collection": "#eab308",
  "E-Waste (ERTH)": "#a855f7",
};
const typeColor = (t) => TYPE_COLOR[t] || "#94a3b8";

function centerIcon(color) {
  return L.divIcon({
    className: "",
    html: `<div style="width:18px;height:18px;border-radius:50%;border:3px solid ${color};background:#020617;box-shadow:0 0 10px ${color}"></div>`,
    iconSize: [18, 18], iconAnchor: [9, 9],
  });
}

function FitAll({ points }) {
  const map = useMap();
  useEffect(() => {
    if (points && points.length) {
      map.fitBounds(points.map((p) => [p.lat, p.lng]), { padding: [50, 50], maxZoom: 12 });
    }
  }, [points, map]);
  return null;
}

export default function LocatorView() {
  const [centers, setCenters] = useState([]);
  const [active, setActive] = useState(null);

  useEffect(() => {
    api.get("/recycling/centers").then((r) => { setCenters(r.data); setActive(r.data[0]); });
  }, []);

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto space-y-4">
      <div>
        <div className="font-mono-data text-xs uppercase tracking-[0.3em] text-emerald-400">Buy-Back Locator</div>
        <h1 className="font-display text-2xl sm:text-3xl font-black tracking-tight mt-1">Nearby Recycling Centres</h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        <div className="lg:col-span-3 border border-slate-800 h-[380px] relative">
          <MapContainer center={[2.76, 101.70]} zoom={10} scrollWheelZoom attributionControl={false} style={{ height: "100%", width: "100%" }}>
            <TileLayer url={CARTO_TILE_URL} attribution="" />
            <FitAll points={centers} />
            {centers.map((c) => (
              <Marker key={c.id} position={[c.lat, c.lng]} icon={centerIcon(typeColor(c.type))}
                eventHandlers={{ click: () => setActive(c) }}>
                <Tooltip><div style={{ fontFamily: "JetBrains Mono", fontSize: 11 }}>{c.name}<br />{c.hours}</div></Tooltip>
              </Marker>
            ))}
          </MapContainer>
          <div className="absolute bottom-3 left-3 z-[500] glass px-3 py-2 space-y-1">
            {Object.entries(TYPE_COLOR).filter(([t]) => centers.some((c) => c.type === t)).map(([t, c]) => (
              <div key={t} className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full" style={{ background: c }} />
                <span className="text-[10px] text-slate-300 font-mono-data">{t}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="lg:col-span-2 space-y-2 max-h-[380px] overflow-y-auto">
          {centers.map((c, i) => (
            <motion.button key={c.id} data-testid={`center-${c.id}`} onClick={() => setActive(c)}
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.05 }}
              className={`w-full text-left glass border p-3 transition-colors ${active?.id === c.id ? "border-emerald-400" : "border-slate-800 hover:border-slate-600"}`}>
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: typeColor(c.type) }} />
                <span className="font-display font-bold text-sm">{c.name}</span>
              </div>
              <div className="font-mono-data text-[10px] uppercase tracking-widest text-slate-500 mt-1">{c.type} · {c.area}</div>
              <div className="flex items-center gap-1.5 text-xs text-slate-300 mt-2"><Clock className="w-3 h-3 text-emerald-400" /> {c.hours}</div>
              <div className="flex items-center gap-1.5 text-xs text-slate-400 mt-1"><Phone className="w-3 h-3 text-slate-500" /> {c.phone}</div>
              <div className="flex flex-wrap gap-1 mt-2">
                {c.accepted.map((a) => (
                  <span key={a} className="font-mono-data text-[9px] uppercase tracking-wide border border-slate-700 text-slate-400 px-1.5 py-0.5">{a}</span>
                ))}
              </div>
            </motion.button>
          ))}
        </div>
      </div>

      {active && (
        <div className="glass border border-emerald-400/30 p-4 flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-2 text-sm">
            <MapPin className="w-4 h-4 text-emerald-400" />
            <span className="text-slate-300">Selected:</span>
            <span className="font-display font-bold">{active.name}</span>
          </div>
          <a data-testid="directions-btn" href={`https://www.google.com/maps/dir/?api=1&destination=${active.lat},${active.lng}`} target="_blank" rel="noreferrer"
            className="flex items-center gap-2 bg-emerald-500 text-slate-950 px-4 py-2 font-mono-data text-xs uppercase tracking-widest hover:bg-emerald-400 transition-colors">
            <Navigation className="w-4 h-4" /> Get Directions
          </a>
        </div>
      )}
    </div>
  );
}
