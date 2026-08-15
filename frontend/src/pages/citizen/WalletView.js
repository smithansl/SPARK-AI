import { useState } from "react";
import { motion } from "framer-motion";
import { Wallet, Coins, QrCode, ArrowUpRight, ArrowDownLeft, Gift, Banknote, X } from "lucide-react";
import { toast } from "sonner";
import api from "../../lib/api";
import { useWallet } from "../citizen/walletContext";

export default function WalletView({ user }) {
  const { wallet, txns, refreshWallet } = useWallet();
  const [showQR, setShowQR] = useState(false);
  const [convert, setConvert] = useState(null); // 'cash' | 'reward'
  const [pts, setPts] = useState(1000);
  const [busy, setBusy] = useState(false);

  const doConvert = async () => {
    setBusy(true);
    try {
      const { data } = await api.post("/wallet/convert", { points: Number(pts), mode: convert });
      toast.success(convert === "cash" ? `RM ${data.converted_rm.toFixed(2)} paid out` : "Reward redeemed!");
      setConvert(null);
      refreshWallet();
    } catch (e) {
      toast.error(e.response?.data?.detail || "Conversion failed");
    } finally {
      setBusy(false);
    }
  };

  const qrData = encodeURIComponent(`SPARK:${user?.id}:${user?.email}`);

  return (
    <div className="p-4 sm:p-6 max-w-4xl mx-auto space-y-5">
      <div>
        <div className="font-mono-data text-xs uppercase tracking-[0.3em] text-emerald-400">Cashless Wallet</div>
        <h1 className="font-display text-2xl sm:text-3xl font-black tracking-tight mt-1">Wallet & Rewards</h1>
      </div>

      {/* Balance card */}
      <div className="relative overflow-hidden border border-emerald-400/40 bg-gradient-to-br from-emerald-500/20 to-slate-900 p-6">
        <div className="grid-bg absolute inset-0 opacity-20" />
        <div className="relative flex items-start justify-between">
          <div>
            <div className="font-mono-data text-[10px] uppercase tracking-widest text-emerald-300">E-Wallet Balance</div>
            <div className="font-mono-data text-4xl font-bold text-white mt-1" data-testid="wallet-balance">RM {wallet?.balance?.toFixed(2) ?? "0.00"}</div>
            <div className="flex items-center gap-2 mt-3 text-amber-400">
              <Coins className="w-4 h-4" /> <span className="font-mono-data font-bold" data-testid="wallet-points">{wallet?.points?.toLocaleString() ?? 0}</span>
              <span className="font-mono-data text-[10px] uppercase tracking-widest text-slate-400">points</span>
            </div>
          </div>
          <button data-testid="wallet-qr-btn" onClick={() => setShowQR(true)}
            className="flex flex-col items-center gap-1 border border-emerald-400 text-emerald-400 px-4 py-3 hover:bg-emerald-400 hover:text-slate-950 transition-colors">
            <QrCode className="w-6 h-6" />
            <span className="font-mono-data text-[9px] uppercase tracking-widest">Check-in</span>
          </button>
        </div>
        <div className="relative grid grid-cols-2 gap-3 mt-5">
          <button data-testid="convert-cash" onClick={() => { setConvert("cash"); setPts(Math.min(1000, wallet?.points || 0)); }}
            className="flex items-center justify-center gap-2 bg-white text-slate-950 py-3 font-mono-data text-xs uppercase tracking-widest hover:bg-slate-100 transition-colors">
            <Banknote className="w-4 h-4" /> Cash Out
          </button>
          <button data-testid="convert-reward" onClick={() => { setConvert("reward"); setPts(Math.min(1000, wallet?.points || 0)); }}
            className="flex items-center justify-center gap-2 border border-emerald-400 text-emerald-400 py-3 font-mono-data text-xs uppercase tracking-widest hover:bg-emerald-400 hover:text-slate-950 transition-colors">
            <Gift className="w-4 h-4" /> Redeem Reward
          </button>
        </div>
      </div>

      {/* Transactions */}
      <div className="glass border border-slate-800 p-5">
        <div className="font-mono-data text-xs uppercase tracking-widest text-slate-400 mb-3">Transaction History</div>
        <div className="space-y-2">
          {(!txns || txns.length === 0) && <div className="text-sm text-slate-500 py-4">No transactions yet.</div>}
          {txns?.map((t, i) => (
            <motion.div key={i} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.03 }}
              className="flex items-center gap-3 border-b border-slate-800 pb-2">
              <div className={`w-8 h-8 flex items-center justify-center border ${t.type === "dropoff" ? "border-emerald-400/40 text-emerald-400" : "border-amber-400/40 text-amber-400"}`}>
                {t.type === "dropoff" ? <ArrowDownLeft className="w-4 h-4" /> : <ArrowUpRight className="w-4 h-4" />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm text-slate-200 truncate">{t.description}</div>
                <div className="font-mono-data text-[10px] uppercase tracking-widest text-slate-600">{t.type}</div>
              </div>
              <div className="text-right">
                <div className={`font-mono-data text-sm font-bold ${t.amount >= 0 ? "text-emerald-400" : "text-slate-400"}`}>
                  {t.amount >= 0 ? "+" : ""}RM {Math.abs(t.amount).toFixed(2)}
                </div>
                <div className={`font-mono-data text-[10px] ${t.points >= 0 ? "text-amber-400" : "text-slate-500"}`}>
                  {t.points >= 0 ? "+" : ""}{t.points} pts
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      {/* QR modal */}
      {showQR && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-6" onClick={() => setShowQR(false)}>
          <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
            className="glass border border-emerald-400/40 p-6 max-w-xs w-full text-center" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <span className="font-mono-data text-xs uppercase tracking-widest text-emerald-400">Counter Check-in</span>
              <button data-testid="qr-close" onClick={() => setShowQR(false)}><X className="w-4 h-4 text-slate-400" /></button>
            </div>
            <div className="bg-white p-3 inline-block">
              <img src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${qrData}`} alt="check-in QR" width={200} height={200} />
            </div>
            <p className="text-xs text-slate-400 mt-4">Show this QR at any Buy-Back Centre counter to check in and record your drop-off.</p>
          </motion.div>
        </div>
      )}

      {/* Convert modal */}
      {convert && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-6" onClick={() => setConvert(null)}>
          <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
            className="glass border border-slate-700 p-6 max-w-sm w-full" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <span className="font-mono-data text-xs uppercase tracking-widest text-emerald-400">{convert === "cash" ? "Cash Payout" : "Redeem Reward"}</span>
              <button onClick={() => setConvert(null)}><X className="w-4 h-4 text-slate-400" /></button>
            </div>
            <label className="font-mono-data text-[10px] uppercase tracking-widest text-slate-500">Points to convert (100 pts = RM1)</label>
            <input data-testid="convert-points" type="number" min="100" step="100" max={wallet?.points || 0} value={pts}
              onChange={(e) => setPts(e.target.value)}
              className="w-full bg-transparent border-b border-slate-700 py-3 mt-1 font-mono-data text-lg focus:border-emerald-400 focus:outline-none" />
            <div className="text-sm text-slate-400 mt-2">≈ RM {(Number(pts) / 100).toFixed(2)} {convert === "reward" ? "voucher" : "to bank"}</div>
            <button data-testid="convert-confirm" onClick={doConvert} disabled={busy}
              className="w-full mt-5 bg-emerald-500 text-slate-950 font-mono-data text-sm uppercase tracking-widest py-3 hover:bg-emerald-400 transition-colors disabled:opacity-50">
              {busy ? "Processing…" : "Confirm"}
            </button>
          </motion.div>
        </div>
      )}
    </div>
  );
}
