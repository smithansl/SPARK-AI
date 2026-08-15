import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Recycle, Coins, Wallet, MapPin, Calculator, AlertTriangle, Leaf, Megaphone, ArrowRight, TrendingUp } from "lucide-react";
import api from "../../lib/api";
import { useWallet } from "../citizen/walletContext";

export default function HomeView({ user }) {
  const { wallet, go } = useWallet();
  const [ann, setAnn] = useState([]);
  useEffect(() => { api.get("/announcements").then((r) => setAnn(r.data)); }, []);

  const co2 = wallet ? (wallet.total_kg * 1.8).toFixed(0) : "—";

  const stats = [
    { icon: Recycle, label: "Recycled", value: wallet ? `${wallet.total_kg.toFixed(1)} kg` : "—", tone: "emerald" },
    { icon: Coins, label: "Reward Points", value: wallet?.points?.toLocaleString() ?? "—", tone: "amber" },
    { icon: Wallet, label: "E-Wallet", value: wallet ? `RM ${wallet.balance.toFixed(2)}` : "—", tone: "cyan" },
    { icon: TrendingUp, label: "CO₂ Saved", value: `${co2} kg`, tone: "green" },
  ];

  const actions = [
    { id: "locator", icon: MapPin, label: "Find Center", desc: "Nearest drop-off" },
    { id: "calculator", icon: Calculator, label: "Estimate Value", desc: "Check buy-back rates" },
    { id: "report", icon: AlertTriangle, label: "Report Issue", desc: "Dumping / bins" },
  ];

  const toneMap = {
    emerald: "text-emerald-400", amber: "text-amber-400", cyan: "text-cyan-400", green: "text-green-400",
  };

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto space-y-6">
      <div>
        <div className="font-mono-data text-xs uppercase tracking-[0.3em] text-emerald-400 flex items-center gap-2">
          <Leaf className="w-4 h-4" /> Selamat datang
        </div>
        <h1 className="font-display text-2xl sm:text-3xl font-black tracking-tight mt-1">Hi {user?.name?.split(" ")[0]}, keep Sepang green</h1>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {stats.map((s, i) => (
          <motion.div key={s.label} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.07 }}
            data-testid={`home-stat-${s.label.toLowerCase().replace(/[^a-z]/g, "")}`}
            className="glass border border-slate-800 p-4">
            <s.icon className={`w-4 h-4 mb-2 ${toneMap[s.tone]}`} />
            <div className={`font-mono-data text-xl font-bold ${toneMap[s.tone]}`}>{s.value}</div>
            <div className="font-mono-data text-[10px] uppercase tracking-widest text-slate-500">{s.label}</div>
          </motion.div>
        ))}
      </div>

      {/* Quick actions */}
      <div>
        <div className="font-mono-data text-xs uppercase tracking-widest text-slate-400 mb-3">Quick Actions</div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {actions.map((a) => (
            <button key={a.id} data-testid={`quick-${a.id}`} onClick={() => go(a.id)}
              className="group glass border border-slate-800 p-4 text-left hover:border-emerald-400 transition-colors flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 border border-emerald-400/40 bg-emerald-400/10 flex items-center justify-center">
                  <a.icon className="w-5 h-5 text-emerald-400" />
                </div>
                <div>
                  <div className="font-display font-bold">{a.label}</div>
                  <div className="font-mono-data text-[10px] uppercase tracking-widest text-slate-500">{a.desc}</div>
                </div>
              </div>
              <ArrowRight className="w-4 h-4 text-slate-600 group-hover:text-emerald-400 group-hover:translate-x-1 transition-all" />
            </button>
          ))}
        </div>
      </div>

      {/* Announcements */}
      <div>
        <div className="font-mono-data text-xs uppercase tracking-widest text-slate-400 mb-3 flex items-center gap-2">
          <Megaphone className="w-4 h-4 text-emerald-400" /> Community & Campaigns
        </div>
        <div className="space-y-3">
          {ann.map((a, i) => (
            <motion.div key={a.id} initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.08 }}
              className="border border-emerald-400/30 bg-gradient-to-r from-emerald-400/10 to-transparent p-4 flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-mono-data text-[9px] uppercase tracking-widest bg-emerald-400 text-slate-950 px-2 py-0.5">{a.tag}</span>
                  <span className="font-mono-data text-[10px] uppercase tracking-widest text-slate-500">{a.date}</span>
                </div>
                <div className="font-display font-bold">{a.title}</div>
                <div className="text-sm text-slate-300 mt-0.5">{a.body}</div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}
