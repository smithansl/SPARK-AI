import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowRight, Radar, Brain, Activity, Layers } from "lucide-react";
import SepangMap from "../components/SepangMap";
import api from "../lib/api";

const WORDS = ["Understand.", "Predict.", "Simulate.", "Plan."];

export default function Landing() {
  const [zones, setZones] = useState([]);
  useEffect(() => {
    api.get("/zones").then((r) => setZones(r.data)).catch(() => {});
  }, []);

  return (
    <div className="relative min-h-screen w-full overflow-hidden bg-[#020617] text-white">
      {/* Map background */}
      <div className="absolute inset-0 opacity-70">
        <SepangMap zones={zones} zoom={11} />
      </div>
      <div className="absolute inset-0 bg-gradient-to-b from-[#020617]/60 via-[#020617]/40 to-[#020617] pointer-events-none" />
      <div className="absolute inset-0 grid-bg opacity-30 pointer-events-none" />

      {/* Top bar */}
      <header className="relative z-20 flex items-center justify-between px-6 md:px-12 py-6">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 border border-cyan-400 flex items-center justify-center glow-teal">
            <Radar className="w-5 h-5 text-cyan-400" />
          </div>
          <div>
            <div className="font-display text-xl font-black tracking-tight leading-none">SPARK</div>
            <div className="font-mono-data text-[9px] uppercase tracking-[0.25em] text-slate-400">
              Spatial Planning AI
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Link
            data-testid="landing-login-link"
            to="/login"
            className="font-mono-data text-xs uppercase tracking-widest text-slate-300 hover:text-cyan-400 transition-colors px-4 py-2"
          >
            Sign In
          </Link>
          <Link
            data-testid="landing-enter-btn"
            to="/login"
            className="group font-mono-data text-xs uppercase tracking-widest border border-cyan-400 text-cyan-400 hover:bg-cyan-400 hover:text-slate-950 transition-colors px-5 py-2.5 flex items-center gap-2"
          >
            Enter Intelligence
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </header>

      {/* Hero */}
      <main className="relative z-20 flex flex-col items-start justify-center px-6 md:px-12 min-h-[calc(100vh-96px)] max-w-5xl">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7 }}
          className="font-mono-data text-xs uppercase tracking-[0.35em] text-cyan-400 mb-6"
        >
          Sepang, Selangor · Urban Intelligence
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.1 }}
          className="font-display text-4xl sm:text-6xl lg:text-7xl font-black leading-[0.95] tracking-tighter"
        >
          What should our cities
          <br />
          <span className="text-cyan-400 text-glow">prepare for next?</span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.7, delay: 0.3 }}
          className="mt-6 text-base md:text-lg text-slate-300 max-w-xl"
        >
          From waste data to spatial action. SPARK turns community signals into GIS
          intelligence, forecasts and AI-driven planning recommendations.
        </motion.p>

        <div className="mt-8 flex flex-wrap gap-6">
          {WORDS.map((w, i) => (
            <motion.span
              key={w}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 + i * 0.12 }}
              className="font-display text-xl md:text-2xl font-bold text-white/90"
            >
              {w}
            </motion.span>
          ))}
        </div>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1 }}
          className="mt-10 flex flex-wrap gap-4"
        >
          <Link
            data-testid="hero-enter-intelligence"
            to="/login"
            className="group bg-cyan-400 text-slate-950 font-mono-data text-sm uppercase tracking-widest px-7 py-4 flex items-center gap-3 hover:bg-cyan-300 transition-colors"
          >
            Enter SPARK Intelligence
            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </Link>
          <Link
            data-testid="hero-citizen-link"
            to="/register"
            className="glass font-mono-data text-sm uppercase tracking-widest px-7 py-4 text-slate-200 hover:border-cyan-400 transition-colors"
          >
            I'm a Citizen
          </Link>
        </motion.div>

        {/* Pillars */}
        <div className="mt-16 grid grid-cols-2 md:grid-cols-4 gap-px bg-slate-800 border border-slate-800 w-full max-w-3xl">
          {[
            { icon: Layers, label: "GIS Layers", v: "Spatial" },
            { icon: Brain, label: "AI Copilot", v: "Evidence" },
            { icon: Activity, label: "Forecast", v: "2026→2035" },
            { icon: Radar, label: "What-If Lab", v: "Simulate" },
          ].map((p) => (
            <div key={p.label} className="bg-[#020617]/90 p-4">
              <p.icon className="w-4 h-4 text-cyan-400 mb-2" />
              <div className="font-mono-data text-[10px] uppercase tracking-widest text-slate-500">
                {p.label}
              </div>
              <div className="font-display text-sm font-bold">{p.v}</div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
