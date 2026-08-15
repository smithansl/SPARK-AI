import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Leaf, Home, MapPin, Calculator, Wallet, CalendarDays, AlertTriangle, LogOut } from "lucide-react";
import api from "../lib/api";
import { useAuth } from "../context/AuthContext";

import HomeView from "./citizen/HomeView";
import LocatorView from "./citizen/LocatorView";
import CalculatorView from "./citizen/CalculatorView";
import WalletView from "./citizen/WalletView";
import ScheduleView from "./citizen/ScheduleView";
import ReportView from "./citizen/ReportView";
import { WalletCtx } from "./citizen/walletContext";

const TABS = [
  { id: "home", label: "Home", icon: Home },
  { id: "locator", label: "Locator", icon: MapPin },
  { id: "calculator", label: "Estimate", icon: Calculator },
  { id: "wallet", label: "Wallet", icon: Wallet },
  { id: "schedule", label: "Schedule", icon: CalendarDays },
  { id: "report", label: "Report", icon: AlertTriangle },
];

export default function Citizen() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState("home");
  const [wallet, setWallet] = useState(null);
  const [txns, setTxns] = useState([]);

  const refreshWallet = () =>
    api.get("/wallet").then((r) => { setWallet(r.data.wallet); setTxns(r.data.transactions); }).catch(() => {});

  useEffect(() => { refreshWallet(); }, []);

  const go = (id) => setTab(id);

  return (
    <WalletCtx.Provider value={{ wallet, txns, refreshWallet, go }}>
      <div className="min-h-screen bg-[#020617] text-white flex flex-col">
        <header className="h-14 border-b border-slate-800 flex items-center justify-between px-4 sm:px-6 bg-[#04120c]/80 backdrop-blur-xl sticky top-0 z-30">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 border border-emerald-400 flex items-center justify-center">
              <Leaf className="w-4 h-4 text-emerald-400" />
            </div>
            <div>
              <div className="font-display text-lg font-black leading-none">SPARK <span className="text-emerald-400">Citizen</span></div>
              <div className="font-mono-data text-[8px] uppercase tracking-[0.2em] text-slate-500">Recycle · Earn · Report</div>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="hidden sm:flex flex-col items-end">
              <span className="font-mono-data text-sm font-bold text-emerald-400">RM {wallet?.balance?.toFixed(2) ?? "—"}</span>
              <span className="font-mono-data text-[9px] uppercase tracking-widest text-slate-500">{wallet?.points ?? 0} pts</span>
            </div>
            <button data-testid="citizen-logout" onClick={() => { logout(); navigate("/login"); }}
              className="text-slate-400 hover:text-red-400 transition-colors">
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </header>

        {/* Desktop tab rail */}
        <div className="hidden md:flex border-b border-slate-800 px-6 gap-1 bg-[#04120c]/40 sticky top-14 z-20">
          {TABS.map((t) => (
            <button key={t.id} data-testid={`tab-${t.id}`} onClick={() => setTab(t.id)}
              className={`flex items-center gap-2 px-4 py-3 border-b-2 font-mono-data text-xs uppercase tracking-widest transition-colors ${
                tab === t.id ? "border-emerald-400 text-emerald-400" : "border-transparent text-slate-400 hover:text-white"}`}>
              <t.icon className="w-4 h-4" /> {t.label}
            </button>
          ))}
        </div>

        <main className="flex-1 pb-20 md:pb-6">
          {tab === "home" && <HomeView user={user} />}
          {tab === "locator" && <LocatorView />}
          {tab === "calculator" && <CalculatorView />}
          {tab === "wallet" && <WalletView user={user} />}
          {tab === "schedule" && <ScheduleView />}
          {tab === "report" && <ReportView />}
        </main>

        {/* Mobile bottom nav */}
        <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-[#04120c]/95 backdrop-blur-xl border-t border-slate-800 grid grid-cols-6">
          {TABS.map((t) => (
            <button key={t.id} data-testid={`tabm-${t.id}`} onClick={() => setTab(t.id)}
              className={`flex flex-col items-center gap-0.5 py-2.5 transition-colors ${tab === t.id ? "text-emerald-400" : "text-slate-500"}`}>
              <t.icon className="w-4 h-4" />
              <span className="text-[9px] font-mono-data uppercase tracking-wide">{t.label}</span>
            </button>
          ))}
        </nav>
      </div>
    </WalletCtx.Provider>
  );
}
