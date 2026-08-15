import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Plus, Trash2, Coins, Wallet, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import api from "../../lib/api";
import { useWallet } from "../citizen/walletContext";

export default function CalculatorView() {
  const { refreshWallet, go } = useWallet();
  const [rates, setRates] = useState([]);
  const [rows, setRows] = useState([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => { api.get("/recycling/rates").then((r) => setRates(r.data)); }, []);

  const addRow = () => setRows([...rows, { key: Date.now(), id: rates[0]?.id, weight: 1 }]);
  const update = (key, patch) => setRows(rows.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  const remove = (key) => setRows(rows.filter((r) => r.key !== key));

  const rateOf = (id) => rates.find((r) => r.id === id);
  const totalRM = rows.reduce((a, r) => a + (rateOf(r.id)?.rate || 0) * (Number(r.weight) || 0), 0);
  const totalPts = rows.reduce((a, r) => a + (rateOf(r.id)?.points || 0) * (Number(r.weight) || 0), 0);

  const submit = async () => {
    if (rows.length === 0) return toast.error("Add at least one item");
    setBusy(true);
    try {
      const { data } = await api.post("/wallet/dropoff", {
        items: rows.map((r) => ({ id: r.id, item: rateOf(r.id)?.item || "", weight: Number(r.weight) })),
      });
      toast.success(`Credited RM ${data.credited_rm.toFixed(2)} + ${data.credited_points} pts`);
      setRows([]);
      refreshWallet();
    } catch {
      toast.error("Could not record drop-off");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="p-4 sm:p-6 max-w-4xl mx-auto space-y-5">
      <div>
        <div className="font-mono-data text-xs uppercase tracking-[0.3em] text-emerald-400">Value Estimator</div>
        <h1 className="font-display text-2xl sm:text-3xl font-black tracking-tight mt-1">Recycling Value Calculator</h1>
        <p className="text-sm text-slate-400">Add items and estimated weights to preview your buy-back payout.</p>
      </div>

      {/* Rate reference */}
      <div className="glass border border-slate-800 p-4">
        <div className="font-mono-data text-[10px] uppercase tracking-widest text-slate-500 mb-3">Current Buy-Back Rates (per kg)</div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {rates.map((r) => (
            <div key={r.id} className="flex items-center justify-between border border-slate-800 px-2.5 py-1.5">
              <span className="text-xs text-slate-300 truncate">{r.item}</span>
              <span className="font-mono-data text-xs font-bold text-emerald-400 shrink-0 ml-2">RM {r.rate.toFixed(2)}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Estimator rows */}
      <div className="glass border border-slate-800 p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="font-mono-data text-xs uppercase tracking-widest text-slate-400">Your Items</div>
          <button data-testid="calc-add" onClick={addRow} className="flex items-center gap-1.5 border border-emerald-400 text-emerald-400 px-3 py-1.5 font-mono-data text-xs uppercase tracking-widest hover:bg-emerald-400 hover:text-slate-950 transition-colors">
            <Plus className="w-3.5 h-3.5" /> Add Item
          </button>
        </div>

        {rows.length === 0 && <div className="text-sm text-slate-500 py-6 text-center">No items yet — tap "Add Item" to begin.</div>}

        {rows.map((row) => {
          const r = rateOf(row.id);
          const lineRM = (r?.rate || 0) * (Number(row.weight) || 0);
          return (
            <motion.div key={row.key} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
              className="flex items-center gap-2 border border-slate-800 p-2">
              <select data-testid="calc-item" value={row.id} onChange={(e) => update(row.key, { id: e.target.value })}
                className="flex-1 bg-[#020617] border border-slate-700 py-2 px-2 text-sm focus:border-emerald-400 focus:outline-none">
                {rates.map((rt) => <option key={rt.id} value={rt.id}>{rt.item}</option>)}
              </select>
              <input data-testid="calc-weight" type="number" min="0" step="0.1" value={row.weight}
                onChange={(e) => update(row.key, { weight: e.target.value })}
                className="w-20 bg-[#020617] border border-slate-700 py-2 px-2 text-sm font-mono-data focus:border-emerald-400 focus:outline-none" />
              <span className="font-mono-data text-[10px] text-slate-500">kg</span>
              <span className="w-20 text-right font-mono-data text-sm text-emerald-400">RM {lineRM.toFixed(2)}</span>
              <button data-testid="calc-remove" onClick={() => remove(row.key)} className="text-slate-600 hover:text-red-400 transition-colors"><Trash2 className="w-4 h-4" /></button>
            </motion.div>
          );
        })}
      </div>

      {/* Total + submit */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="glass border border-slate-800 p-4">
          <div className="flex items-center gap-2 font-mono-data text-[10px] uppercase tracking-widest text-slate-500"><Wallet className="w-3.5 h-3.5" /> Est. Cash</div>
          <div className="font-mono-data text-2xl font-bold text-emerald-400 mt-1" data-testid="calc-total-rm">RM {totalRM.toFixed(2)}</div>
        </div>
        <div className="glass border border-slate-800 p-4">
          <div className="flex items-center gap-2 font-mono-data text-[10px] uppercase tracking-widest text-slate-500"><Coins className="w-3.5 h-3.5" /> Est. Points</div>
          <div className="font-mono-data text-2xl font-bold text-amber-400 mt-1" data-testid="calc-total-pts">{Math.round(totalPts).toLocaleString()}</div>
        </div>
        <button data-testid="calc-submit" onClick={submit} disabled={busy || rows.length === 0}
          className="bg-emerald-500 text-slate-950 font-mono-data text-sm uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-emerald-400 transition-colors disabled:opacity-40">
          <CheckCircle2 className="w-4 h-4" /> {busy ? "Saving…" : "Add to Wallet"}
        </button>
      </div>
    </div>
  );
}
