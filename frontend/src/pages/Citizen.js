import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Radar, Send, LogOut, MapPin, Leaf, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { motion } from "framer-motion";
import api from "../lib/api";
import { useAuth } from "../context/AuthContext";
import SepangMap from "../components/SepangMap";

const WASTE_TYPES = ["Plastic", "Organic", "Paper", "Metal", "E-Waste", "Glass", "Other"];

export default function Citizen() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [zones, setZones] = useState([]);
  const [reports, setReports] = useState([]);
  const [form, setForm] = useState({ zone_id: "", waste_type: "Plastic", description: "", severity: "medium" });
  const [busy, setBusy] = useState(false);

  const load = () => api.get("/reports").then((r) => setReports(r.data)).catch(() => {});

  useEffect(() => {
    api.get("/zones").then((r) => { setZones(r.data); setForm((f) => ({ ...f, zone_id: r.data[0]?.id || "" })); });
    load();
  }, []);

  const submit = async (e) => {
    e.preventDefault();
    if (!form.description.trim()) return toast.error("Please describe the issue");
    setBusy(true);
    try {
      await api.post("/reports", form);
      toast.success("Report submitted — thank you for contributing!");
      setForm({ ...form, description: "" });
      load();
    } catch {
      toast.error("Could not submit report");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#020617] text-white">
      <header className="h-14 border-b border-slate-800 flex items-center justify-between px-6 bg-[#040a1a]/70 backdrop-blur-xl sticky top-0 z-30">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 border border-emerald-400 flex items-center justify-center">
            <Radar className="w-4 h-4 text-emerald-400" />
          </div>
          <div>
            <div className="font-display text-lg font-black leading-none">SPARK <span className="text-emerald-400">Citizen</span></div>
            <div className="font-mono-data text-[8px] uppercase tracking-[0.2em] text-slate-500">Community Data Network</div>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm text-slate-400 hidden sm:block">{user?.name}</span>
          <button data-testid="citizen-logout" onClick={() => { logout(); navigate("/login"); }}
            className="flex items-center gap-2 font-mono-data text-xs uppercase tracking-widest text-slate-400 hover:text-red-400 transition-colors">
            <LogOut className="w-4 h-4" /> Sign out
          </button>
        </div>
      </header>

      <div className="p-6 max-w-6xl mx-auto space-y-6">
        <div>
          <div className="font-mono-data text-xs uppercase tracking-[0.3em] text-emerald-400 flex items-center gap-2">
            <Leaf className="w-4 h-4" /> Report · Contribute · Improve
          </div>
          <h1 className="font-display text-3xl font-black tracking-tight mt-1">Help shape Sepang's spatial future</h1>
          <p className="text-sm text-slate-400">Your reports feed directly into the SPARK AI planning engine used by local authorities.</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Form */}
          <form onSubmit={submit} className="glass border border-slate-800 p-6 space-y-5" data-testid="report-form">
            <div className="font-mono-data text-xs uppercase tracking-widest text-slate-400">Submit a waste report</div>

            <div>
              <label className="font-mono-data text-[10px] uppercase tracking-widest text-slate-500">Area</label>
              <select data-testid="report-zone" value={form.zone_id} onChange={(e) => setForm({ ...form, zone_id: e.target.value })}
                className="w-full bg-[#020617] border border-slate-700 py-3 px-3 mt-1 text-sm focus:border-emerald-400 focus:outline-none">
                {zones.map((z) => <option key={z.id} value={z.id}>{z.name}</option>)}
              </select>
            </div>

            <div>
              <label className="font-mono-data text-[10px] uppercase tracking-widest text-slate-500 mb-2 block">Waste type</label>
              <div className="flex flex-wrap gap-2">
                {WASTE_TYPES.map((t) => (
                  <button key={t} type="button" data-testid={`wtype-${t}`} onClick={() => setForm({ ...form, waste_type: t })}
                    className={`font-mono-data text-xs px-3 py-1.5 border transition-colors ${form.waste_type === t ? "border-emerald-400 bg-emerald-400/10 text-emerald-400" : "border-slate-700 text-slate-400 hover:border-slate-500"}`}>
                    {t}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="font-mono-data text-[10px] uppercase tracking-widest text-slate-500">Description</label>
              <textarea data-testid="report-desc" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })}
                rows={3} placeholder="e.g. Illegal dumping near the market, overflowing bins…"
                className="w-full bg-transparent border-b border-slate-700 py-2 mt-1 text-sm focus:border-emerald-400 focus:outline-none resize-none" />
            </div>

            <div>
              <label className="font-mono-data text-[10px] uppercase tracking-widest text-slate-500 mb-2 block">Severity</label>
              <div className="flex gap-2">
                {["low", "medium", "high"].map((s) => (
                  <button key={s} type="button" data-testid={`sev-${s}`} onClick={() => setForm({ ...form, severity: s })}
                    className={`flex-1 font-mono-data text-xs uppercase py-2 border transition-colors ${form.severity === s ? "border-emerald-400 bg-emerald-400/10 text-emerald-400" : "border-slate-700 text-slate-400"}`}>
                    {s}
                  </button>
                ))}
              </div>
            </div>

            <button data-testid="report-submit" disabled={busy}
              className="w-full bg-emerald-500 text-slate-950 font-mono-data text-sm uppercase tracking-widest py-4 flex items-center justify-center gap-3 hover:bg-emerald-400 transition-colors disabled:opacity-50">
              <Send className="w-4 h-4" /> {busy ? "Submitting…" : "Submit Report"}
            </button>
          </form>

          {/* Map + reports */}
          <div className="space-y-4">
            <div className="border border-slate-800 h-[240px] relative">
              <SepangMap zones={zones} zoom={11} />
            </div>
            <div className="glass border border-slate-800 p-5">
              <div className="font-mono-data text-xs uppercase tracking-widest text-slate-400 mb-3">Your reports ({reports.length})</div>
              <div className="space-y-2 max-h-[220px] overflow-y-auto">
                {reports.length === 0 && <div className="text-sm text-slate-500">No reports yet. Submit your first above.</div>}
                {reports.map((r) => (
                  <motion.div key={r.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                    className="flex items-start gap-3 border border-slate-800 p-3">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono-data text-xs text-emerald-400">{r.waste_type}</span>
                        <span className="font-mono-data text-[9px] uppercase tracking-widest text-slate-500 flex items-center gap-1"><MapPin className="w-3 h-3" />{zones.find((z) => z.id === r.zone_id)?.name || r.zone_id}</span>
                      </div>
                      <div className="text-sm text-slate-300 truncate">{r.description}</div>
                    </div>
                    <span className="font-mono-data text-[9px] uppercase text-slate-500">{r.severity}</span>
                  </motion.div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
