import { useState } from "react";
import { X, Upload, Loader2, Palette } from "lucide-react";
import { toast } from "sonner";
import api from "../../lib/api";
import { computeClasses, uniqueValues, CAT_PALETTE } from "../../lib/geo";

export default function AddLayerModal({ onClose, onCreated }) {
  const [geojson, setGeojson] = useState(null);
  const [name, setName] = useState("");
  const [attrKeys, setAttrKeys] = useState([]);
  const [attribute, setAttribute] = useState("");
  const [mode, setMode] = useState("graduated");
  const [opacity, setOpacity] = useState(0.6);
  const [classes, setClasses] = useState([]);
  const [categories, setCategories] = useState([]);
  const [busy, setBusy] = useState(false);

  const onFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const gj = JSON.parse(text);
      if (!gj.features || !gj.features.length) return toast.error("No features found");
      setGeojson(gj);
      setName(file.name.replace(/\.(geo)?json$/i, ""));
      const props = gj.features[0].properties || {};
      const keys = Object.keys(props);
      setAttrKeys(keys);
      const firstNum = keys.find((k) => typeof props[k] === "number");
      const attr = firstNum || keys[0];
      setAttribute(attr);
      configure(gj, attr, firstNum ? "graduated" : "categorized");
    } catch {
      toast.error("Invalid GeoJSON file");
    }
  };

  const configure = (gj, attr, m) => {
    setMode(m);
    if (m === "graduated") {
      setClasses(computeClasses(gj.features.map((f) => f.properties?.[attr])));
    } else {
      const vals = uniqueValues(gj.features, attr);
      setCategories(vals.map((v, i) => ({ value: v, color: CAT_PALETTE[i % CAT_PALETTE.length] })));
    }
  };

  const onAttr = (attr) => { setAttribute(attr); if (geojson) configure(geojson, attr, mode); };
  const onMode = (m) => { if (geojson) configure(geojson, attribute, m); };

  const save = async () => {
    if (!geojson || !name.trim() || !attribute) return toast.error("Complete the configuration");
    setBusy(true);
    try {
      const style = {
        mode, attribute, opacity: Number(opacity), stroke: "#334155", strokeWidth: 0.6,
        ...(mode === "graduated" ? { classes } : { categories }),
      };
      const { data } = await api.post("/geo/layers", { name, style, geojson });
      toast.success("Layer added");
      onCreated(data);
      onClose();
    } catch (e) {
      toast.error(e.response?.data?.detail || "Could not save layer");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[1000] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <div className="glass border border-cyan-400/40 w-full max-w-lg max-h-[88vh] overflow-y-auto p-6" onClick={(e) => e.stopPropagation()} data-testid="add-layer-modal">
        <div className="flex items-center justify-between mb-4">
          <div className="font-mono-data text-xs uppercase tracking-widest text-cyan-400 flex items-center gap-2"><Palette className="w-4 h-4" /> Add GeoJSON Layer</div>
          <button data-testid="add-layer-close" onClick={onClose}><X className="w-4 h-4 text-slate-400" /></button>
        </div>

        {!geojson ? (
          <label className="flex flex-col items-center justify-center gap-2 border border-dashed border-slate-600 py-12 cursor-pointer hover:border-cyan-400 transition-colors">
            <Upload className="w-6 h-6 text-cyan-400" />
            <span className="font-mono-data text-xs uppercase tracking-widest text-slate-300">Upload .geojson file</span>
            <input data-testid="add-layer-file" type="file" accept=".geojson,.json,application/geo+json,application/json" className="hidden" onChange={onFile} />
          </label>
        ) : (
          <div className="space-y-4">
            <div>
              <label className="font-mono-data text-[10px] uppercase tracking-widest text-slate-500">Layer name</label>
              <input data-testid="add-layer-name" value={name} onChange={(e) => setName(e.target.value)}
                className="w-full bg-transparent border-b border-slate-700 py-2 mt-1 text-sm focus:border-cyan-400 focus:outline-none" />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="font-mono-data text-[10px] uppercase tracking-widest text-slate-500">Attribute</label>
                <select data-testid="add-layer-attr" value={attribute} onChange={(e) => onAttr(e.target.value)}
                  className="w-full bg-[#020617] border border-slate-700 py-2 px-2 mt-1 text-sm focus:border-cyan-400 focus:outline-none">
                  {attrKeys.map((k) => <option key={k} value={k}>{k}</option>)}
                </select>
              </div>
              <div>
                <label className="font-mono-data text-[10px] uppercase tracking-widest text-slate-500">Style mode</label>
                <select data-testid="add-layer-mode" value={mode} onChange={(e) => onMode(e.target.value)}
                  className="w-full bg-[#020617] border border-slate-700 py-2 px-2 mt-1 text-sm focus:border-cyan-400 focus:outline-none">
                  <option value="graduated">Graduated (numeric)</option>
                  <option value="categorized">Categorized (values)</option>
                </select>
              </div>
            </div>

            <div>
              <div className="flex justify-between mb-1">
                <label className="font-mono-data text-[10px] uppercase tracking-widest text-slate-500">Opacity</label>
                <span className="font-mono-data text-xs text-cyan-400">{Math.round(opacity * 100)}%</span>
              </div>
              <input data-testid="add-layer-opacity" type="range" min="0.1" max="1" step="0.05" value={opacity}
                onChange={(e) => setOpacity(e.target.value)} className="w-full accent-cyan-400" />
            </div>

            <div className="border border-slate-800 p-3 max-h-56 overflow-y-auto">
              <div className="font-mono-data text-[10px] uppercase tracking-widest text-slate-500 mb-2">Colours ({mode})</div>
              {mode === "graduated" && classes.map((c, i) => (
                <div key={i} className="flex items-center gap-2 mb-1.5">
                  <input type="color" value={c.color} onChange={(e) => { const n = [...classes]; n[i] = { ...c, color: e.target.value }; setClasses(n); }} className="w-6 h-6 bg-transparent border border-slate-700 cursor-pointer" />
                  <span className="text-xs text-slate-300">{c.label}</span>
                </div>
              ))}
              {mode === "categorized" && categories.map((c, i) => (
                <div key={i} className="flex items-center gap-2 mb-1.5">
                  <input type="color" value={c.color} onChange={(e) => { const n = [...categories]; n[i] = { ...c, color: e.target.value }; setCategories(n); }} className="w-6 h-6 bg-transparent border border-slate-700 cursor-pointer" />
                  <span className="text-xs text-slate-300 truncate">{String(c.value)}</span>
                </div>
              ))}
            </div>

            <button data-testid="add-layer-save" onClick={save} disabled={busy}
              className="w-full bg-cyan-400 text-slate-950 font-mono-data text-sm uppercase tracking-widest py-3 flex items-center justify-center gap-2 hover:bg-cyan-300 transition-colors disabled:opacity-50">
              {busy ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving…</> : "Add Layer to Map"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
