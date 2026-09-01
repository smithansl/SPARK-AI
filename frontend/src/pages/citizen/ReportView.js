import { useCallback, useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Camera, MapPin, Send, CheckCircle2, Trash2, Loader2, Crosshair } from "lucide-react";
import { toast } from "sonner";
import api, { API } from "../../lib/api";

const CATEGORIES = ["Uncollected Garbage", "Illegal Dumping", "Overflowing Bin", "Damaged Bin", "Other"];

export default function ReportView() {
  const fileRef = useRef(null);
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [description, setDescription] = useState("");
  const [coords, setCoords] = useState(null);
  const [photoPath, setPhotoPath] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [complaints, setComplaints] = useState([]);

  const token = localStorage.getItem("spark_token");
  const load = useCallback(() => api.get("/complaints").then((r) => setComplaints(r.data)).catch(() => {}), []);
  useEffect(() => { load(); }, [load]);

  const getLocation = () => {
    if (!navigator.geolocation) return toast.error("Geolocation not supported");
    navigator.geolocation.getCurrentPosition(
      (pos) => { setCoords({ lat: +pos.coords.latitude.toFixed(5), lng: +pos.coords.longitude.toFixed(5) }); toast.success("Location tagged"); },
      () => { setCoords({ lat: 2.72, lng: 101.72 }); toast.message("Using Sepang district centre (permission denied)"); }
    );
  };

  const onPhoto = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const { data } = await api.post("/upload", fd, { headers: { "Content-Type": "multipart/form-data" } });
      setPhotoPath(data.path);
      toast.success("Photo attached");
    } catch {
      toast.error("Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!description.trim()) return toast.error("Please describe the issue");
    setBusy(true);
    try {
      await api.post("/complaints", {
        category, description,
        lat: coords?.lat, lng: coords?.lng,
        address: coords ? `${coords.lat}, ${coords.lng}` : null,
        photo_path: photoPath,
      });
      toast.success("Report submitted to Alam Flora — thank you!");
      setDescription(""); setPhotoPath(null); setCoords(null);
      load();
    } catch {
      toast.error("Could not submit report");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="p-4 sm:p-6 max-w-4xl mx-auto space-y-5">
      <div>
        <div className="font-mono-data text-xs uppercase tracking-[0.3em] text-emerald-400">Public Reporting</div>
        <h1 className="font-display text-2xl sm:text-3xl font-black tracking-tight mt-1">Report an Issue</h1>
        <p className="text-sm text-slate-400">Uncollected garbage, illegal dumping or overflowing bins — reported directly to Alam Flora.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <form onSubmit={submit} className="glass border border-slate-800 p-5 space-y-5" data-testid="complaint-form">
          <div>
            <label className="font-mono-data text-[10px] uppercase tracking-widest text-slate-500 mb-2 block">Category</label>
            <div className="flex flex-wrap gap-2">
              {CATEGORIES.map((c) => (
                <button key={c} type="button" data-testid={`cat-${CATEGORIES.indexOf(c)}`} onClick={() => setCategory(c)}
                  className={`font-mono-data text-xs px-3 py-1.5 border transition-colors ${category === c ? "border-emerald-400 bg-emerald-400/10 text-emerald-400" : "border-slate-700 text-slate-400 hover:border-slate-500"}`}>
                  {c}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="font-mono-data text-[10px] uppercase tracking-widest text-slate-500">Description</label>
            <textarea data-testid="complaint-desc" value={description} onChange={(e) => setDescription(e.target.value)}
              rows={3} placeholder="Describe what you see, and where…"
              className="w-full bg-transparent border-b border-slate-700 py-2 mt-1 text-sm focus:border-emerald-400 focus:outline-none resize-none" />
          </div>

          {/* Photo */}
          <div>
            <label className="font-mono-data text-[10px] uppercase tracking-widest text-slate-500 mb-2 block">Photo Evidence</label>
            <input ref={fileRef} type="file" accept="image/*" capture="environment" onChange={onPhoto} className="hidden" data-testid="complaint-photo-input" />
            {photoPath ? (
              <div className="relative inline-block">
                <img src={`${API}/files/${photoPath}?auth=${token}`} alt="evidence" className="h-28 border border-slate-700 object-cover" />
                <button type="button" data-testid="photo-remove" onClick={() => setPhotoPath(null)}
                  className="absolute -top-2 -right-2 bg-red-500 text-white p-1"><Trash2 className="w-3 h-3" /></button>
              </div>
            ) : (
              <button type="button" data-testid="complaint-photo-btn" onClick={() => fileRef.current?.click()} disabled={uploading}
                className="flex items-center gap-2 border border-dashed border-slate-600 px-4 py-6 w-full justify-center text-slate-400 hover:border-emerald-400 hover:text-emerald-400 transition-colors">
                {uploading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Camera className="w-5 h-5" />}
                <span className="font-mono-data text-xs uppercase tracking-widest">{uploading ? "Uploading…" : "Take / Upload Photo"}</span>
              </button>
            )}
          </div>

          {/* Location */}
          <div>
            <label className="font-mono-data text-[10px] uppercase tracking-widest text-slate-500 mb-2 block">Location Tag</label>
            <button type="button" data-testid="complaint-geo" onClick={getLocation}
              className={`flex items-center gap-2 border px-4 py-2.5 w-full font-mono-data text-xs uppercase tracking-widest transition-colors ${coords ? "border-emerald-400 text-emerald-400" : "border-slate-600 text-slate-400 hover:border-emerald-400"}`}>
              {coords ? <MapPin className="w-4 h-4" /> : <Crosshair className="w-4 h-4" />}
              {coords ? `${coords.lat}, ${coords.lng}` : "Tag my current location"}
            </button>
          </div>

          <button data-testid="complaint-submit" disabled={busy}
            className="w-full bg-emerald-500 text-slate-950 font-mono-data text-sm uppercase tracking-widest py-4 flex items-center justify-center gap-3 hover:bg-emerald-400 transition-colors disabled:opacity-50">
            <Send className="w-4 h-4" /> {busy ? "Submitting…" : "Submit Report"}
          </button>
        </form>

        {/* My complaints */}
        <div className="glass border border-slate-800 p-5">
          <div className="font-mono-data text-xs uppercase tracking-widest text-slate-400 mb-3">My Reports ({complaints.length})</div>
          <div className="space-y-2 max-h-[440px] overflow-y-auto">
            {complaints.length === 0 && <div className="text-sm text-slate-500">No reports yet.</div>}
            {complaints.map((c) => (
              <motion.div key={c.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-start gap-3 border border-slate-800 p-3">
                {c.photo_path ? (
                  <img src={`${API}/files/${c.photo_path}?auth=${token}`} alt="" className="w-12 h-12 object-cover border border-slate-700 shrink-0" />
                ) : (
                  <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                )}
                <div className="flex-1 min-w-0">
                  <div className="font-mono-data text-xs text-emerald-400">{c.category}</div>
                  <div className="text-sm text-slate-300 truncate">{c.description}</div>
                  {c.address && <div className="font-mono-data text-[9px] uppercase tracking-widest text-slate-600 flex items-center gap-1 mt-0.5"><MapPin className="w-3 h-3" />{c.address}</div>}
                </div>
                <span className="font-mono-data text-[9px] uppercase tracking-widest border border-slate-700 text-slate-400 px-2 py-0.5 shrink-0">{c.status}</span>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
