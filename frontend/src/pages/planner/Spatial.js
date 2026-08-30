import { useEffect, useRef, useState } from "react";
import { Layers, Plus, Trash2, Eye, EyeOff, Download, Image as ImageIcon, Loader2 } from "lucide-react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import api from "../../lib/api";
import GeoLayerMap from "../../components/geo/GeoLayerMap";
import Legend from "../../components/geo/Legend";
import AddLayerModal from "../../components/geo/AddLayerModal";
import { exportLayerGeoJSON, exportMapImage } from "../../lib/exportUtils";

export default function Spatial() {
  const [layers, setLayers] = useState([]);
  const [layerState, setLayerState] = useState({});
  const [showAdd, setShowAdd] = useState(false);
  const [exportingImg, setExportingImg] = useState(false);
  const mapRef = useRef(null);

  const initState = (list) => {
    setLayerState((prev) => {
      const next = { ...prev };
      list.forEach((l, i) => {
        if (!next[l.id]) next[l.id] = { visible: i === 0, opacity: l.style.opacity ?? 0.6 };
      });
      return next;
    });
  };

  const loadLayers = () =>
    api.get("/geo/layers").then((r) => { setLayers(r.data); initState(r.data); });

  useEffect(() => { loadLayers(); }, []);

  useEffect(() => {
    const active = Object.entries(layerState).filter(([, s]) => s.visible).map(([id]) => id);
    localStorage.setItem("spark_active_layers", JSON.stringify(active));
  }, [layerState]);

  const toggle = (id) => setLayerState((s) => ({ ...s, [id]: { ...s[id], visible: !s[id]?.visible } }));
  const setOpacity = (id, v) => setLayerState((s) => ({ ...s, [id]: { ...s[id], opacity: Number(v) } }));

  const removeLayer = async (id) => {
    try {
      await api.delete(`/geo/layers/${id}`);
      setLayers((l) => l.filter((x) => x.id !== id));
      toast.success("Layer removed");
    } catch (e) {
      toast.error(e.response?.data?.detail || "Cannot delete layer");
    }
  };

  const onCreated = (layer) => {
    setLayers((l) => [...l, layer]);
    setLayerState((s) => ({ ...s, [layer.id]: { visible: true, opacity: layer.style.opacity ?? 0.6 } }));
  };

  const exportGeoJSON = async (layer) => {
    try { await exportLayerGeoJSON(layer); toast.success(`Exported ${layer.name}.geojson`); }
    catch { toast.error("Export failed"); }
  };

  const exportImage = async () => {
    setExportingImg(true);
    try { await exportMapImage(mapRef.current, "sepang-spatial-intelligence.png"); toast.success("Map image exported"); }
    catch { toast.error("Image export failed"); }
    finally { setExportingImg(false); }
  };

  const activeCount = Object.values(layerState).filter((s) => s.visible).length;

  return (
    <div className="relative h-[calc(100vh-56px)] w-full">
      <div className="absolute inset-0" ref={mapRef}>
        <GeoLayerMap layers={layers} layerState={layerState} />
      </div>

      {/* Header */}
      <div className="absolute top-3 left-3 z-[500] glass px-4 py-2 pointer-events-auto">
        <div className="font-mono-data text-[10px] uppercase tracking-[0.3em] text-cyan-400">Spatial Intelligence</div>
        <div className="font-display text-sm font-bold">Sepang GIS · {activeCount} layer{activeCount !== 1 ? "s" : ""} active</div>
      </div>

      {/* Export map image */}
      <button data-testid="export-map-image" onClick={exportImage} disabled={exportingImg}
        className="absolute top-3 right-3 z-[500] glass flex items-center gap-2 px-4 py-2.5 font-mono-data text-[10px] uppercase tracking-widest text-cyan-400 hover:border-cyan-400 transition-colors disabled:opacity-60">
        {exportingImg ? <Loader2 className="w-4 h-4 animate-spin" /> : <ImageIcon className="w-4 h-4" />}
        {exportingImg ? "Rendering…" : "Export Image"}
      </button>

      {/* Layer manager */}
      <motion.div initial={{ x: -30, opacity: 0 }} animate={{ x: 0, opacity: 1 }}
        className="absolute top-20 left-3 z-[500] w-72 glass p-4 max-h-[calc(100vh-120px)] overflow-y-auto">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2 font-mono-data text-xs uppercase tracking-widest text-slate-300">
            <Layers className="w-4 h-4 text-cyan-400" /> Layers
          </div>
          <button data-testid="add-layer-btn" onClick={() => setShowAdd(true)}
            className="flex items-center gap-1 border border-cyan-400 text-cyan-400 px-2 py-1 font-mono-data text-[10px] uppercase tracking-widest hover:bg-cyan-400 hover:text-slate-950 transition-colors">
            <Plus className="w-3 h-3" /> Add
          </button>
        </div>

        <div className="space-y-3">
          {layers.map((l) => {
            const st = layerState[l.id] || { visible: false, opacity: 0.6 };
            return (
              <div key={l.id} className={`border p-3 transition-colors ${st.visible ? "border-cyan-400/50" : "border-slate-800"}`}>
                <div className="flex items-start justify-between gap-2">
                  <button data-testid={`layer-toggle-${l.id}`} onClick={() => toggle(l.id)} className="flex items-start gap-2 text-left flex-1 min-w-0">
                    {st.visible ? <Eye className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" /> : <EyeOff className="w-4 h-4 text-slate-600 shrink-0 mt-0.5" />}
                    <span className="min-w-0">
                      <span className={`block text-sm font-medium leading-tight ${st.visible ? "text-white" : "text-slate-400"}`}>{l.name}</span>
                      <span className="block font-mono-data text-[9px] uppercase tracking-wider text-slate-600">{l.style.mode} · {l.feature_count ?? "—"} feats</span>
                    </span>
                  </button>
                  {!l.builtin && (
                    <button data-testid={`layer-delete-${l.id}`} onClick={() => removeLayer(l.id)} className="text-slate-600 hover:text-red-400 transition-colors shrink-0">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                  <button data-testid={`layer-export-${l.id}`} onClick={() => exportGeoJSON(l)} title="Export GeoJSON" className="text-slate-600 hover:text-cyan-400 transition-colors shrink-0">
                    <Download className="w-3.5 h-3.5" />
                  </button>
                </div>
                {st.visible && (
                  <div className="mt-2">
                    <div className="flex justify-between mb-1">
                      <span className="font-mono-data text-[9px] uppercase tracking-widest text-slate-500">Transparency</span>
                      <span className="font-mono-data text-[10px] text-cyan-400">{Math.round(st.opacity * 100)}%</span>
                    </div>
                    <input data-testid={`layer-opacity-${l.id}`} type="range" min="0" max="1" step="0.05" value={st.opacity}
                      onChange={(e) => setOpacity(l.id, e.target.value)} className="w-full accent-cyan-400" />
                  </div>
                )}
              </div>
            );
          })}
          {layers.length === 0 && <div className="text-sm text-slate-500">Loading layers…</div>}
        </div>
      </motion.div>

      {/* Legend */}
      <motion.div initial={{ x: 30, opacity: 0 }} animate={{ x: 0, opacity: 1 }}
        className="absolute bottom-3 right-3 z-[500] w-64 glass p-4">
        <div className="font-mono-data text-xs uppercase tracking-widest text-slate-300 mb-3">Legend</div>
        <Legend layers={layers} layerState={layerState} />
      </motion.div>

      {showAdd && <AddLayerModal onClose={() => setShowAdd(false)} onCreated={onCreated} />}
    </div>
  );
}
