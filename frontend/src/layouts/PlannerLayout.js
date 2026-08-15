import { NavLink, Outlet, useNavigate } from "react-router-dom";
import {
  Radar, LayoutGrid, Map, Brain, TrendingUp, Target, Truck,
  FlaskConical, FileText, Bell, LogOut, ChevronRight,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";

const NAV = [
  { n: "01", to: "/intelligence", end: true, label: "Overview", sub: "Spatial condition", icon: LayoutGrid },
  { n: "02", to: "/intelligence/spatial", label: "Spatial Intelligence", sub: "GIS + hotspots", icon: Map },
  { n: "03", to: "/intelligence/analytics", label: "AI Analytics", sub: "Planning copilot", icon: Brain },
  { n: "04", to: "/intelligence/forecast", label: "Forecasting", sub: "2026 → 2035", icon: TrendingUp },
  { n: "05", to: "/intelligence/sites", label: "Site Suitability", sub: "Facility siting", icon: Target },
  { n: "06", to: "/intelligence/logistics", label: "Logistics", sub: "Route network", icon: Truck },
  { n: "07", to: "/intelligence/simulator", label: "Planning Simulator", sub: "Future Lab", icon: FlaskConical, star: true },
  { n: "08", to: "/intelligence/reports", label: "Reports", sub: "Generate briefs", icon: FileText },
];

export default function PlannerLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-[#020617] text-white flex">
      {/* Sidebar */}
      <aside className="w-[264px] shrink-0 border-r border-slate-800 bg-[#040a1a] flex flex-col h-screen sticky top-0">
        <div className="p-5 border-b border-slate-800 flex items-center gap-3">
          <div className="w-9 h-9 border border-cyan-400 flex items-center justify-center glow-teal">
            <Radar className="w-5 h-5 text-cyan-400" />
          </div>
          <div>
            <div className="font-display text-lg font-black leading-none">SPARK</div>
            <div className="font-mono-data text-[8px] uppercase tracking-[0.2em] text-slate-500">Intelligence</div>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto py-3">
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              data-testid={`nav-${item.n}`}
              className={({ isActive }) =>
                `group flex items-center gap-3 px-5 py-2.5 border-l-2 transition-colors ${
                  isActive
                    ? "border-cyan-400 bg-cyan-400/10 text-white"
                    : "border-transparent text-slate-400 hover:text-white hover:bg-slate-800/40"
                }`
              }
            >
              <span className="font-mono-data text-[10px] text-slate-600 w-5">{item.n}</span>
              <item.icon className="w-4 h-4 shrink-0" />
              <span className="flex-1 min-w-0">
                <span className="flex items-center gap-1.5 font-medium text-sm leading-tight">
                  {item.label}
                  {item.star && <span className="text-cyan-400 text-[10px]">★</span>}
                </span>
                <span className="block font-mono-data text-[9px] uppercase tracking-wider text-slate-600">{item.sub}</span>
              </span>
            </NavLink>
          ))}
        </nav>

        <div className="p-4 border-t border-slate-800">
          <button
            data-testid="logout-btn"
            onClick={() => { logout(); navigate("/login"); }}
            className="w-full flex items-center gap-2 font-mono-data text-xs uppercase tracking-widest text-slate-400 hover:text-red-400 transition-colors py-2"
          >
            <LogOut className="w-4 h-4" /> Sign out
          </button>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-14 border-b border-slate-800 flex items-center justify-between px-6 bg-[#040a1a]/70 backdrop-blur-xl sticky top-0 z-30">
          <div className="flex items-center gap-2 font-mono-data text-[10px] uppercase tracking-widest text-slate-500">
            SPARK <ChevronRight className="w-3 h-3" /> <span className="text-cyan-400">Intelligence</span>
          </div>
          <div className="flex items-center gap-5">
            <button data-testid="notif-btn" className="relative text-slate-400 hover:text-cyan-400 transition-colors">
              <Bell className="w-4 h-4" />
              <span className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full" />
            </button>
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 bg-cyan-400 text-slate-950 flex items-center justify-center font-display font-black text-xs">
                {user?.name?.[0] || "P"}
              </div>
              <div className="hidden sm:block">
                <div className="text-xs font-medium leading-none">{user?.name}</div>
                <div className="font-mono-data text-[9px] uppercase tracking-widest text-cyan-400">Planner</div>
              </div>
            </div>
          </div>
        </header>

        <main className="flex-1 min-w-0">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
