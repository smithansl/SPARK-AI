import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Radar, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "../context/AuthContext";
import { formatApiErrorDetail } from "../lib/api";

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const user = await login(email, password);
      toast.success(`Welcome back, ${user.name}`);
      navigate(user.role === "planner" ? "/intelligence" : "/citizen");
    } catch (err) {
      toast.error(formatApiErrorDetail(err.response?.data?.detail) || "Login failed");
    } finally {
      setBusy(false);
    }
  };

  const quick = (em, pw) => { setEmail(em); setPassword(pw); };

  return (
    <div className="min-h-screen bg-[#020617] text-white flex">
      <div className="hidden lg:flex flex-col justify-between w-1/2 p-12 grid-bg border-r border-slate-800 relative">
        <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/5 to-transparent" />
        <Link to="/" className="relative flex items-center gap-3">
          <div className="w-9 h-9 border border-cyan-400 flex items-center justify-center glow-teal">
            <Radar className="w-5 h-5 text-cyan-400" />
          </div>
          <span className="font-display text-xl font-black">SPARK</span>
        </Link>
        <div className="relative">
          <h2 className="font-display text-4xl font-black leading-tight tracking-tighter">
            Spatial Planning AI<br />for Resource & Knowledge
          </h2>
          <p className="mt-4 text-slate-400 max-w-md">
            Community generates data → SPARK understands spatial patterns → AI projects future
            conditions → planners test scenarios → SPARK recommends interventions.
          </p>
        </div>
        <div className="relative font-mono-data text-[10px] uppercase tracking-widest text-slate-600">
          Sepang District · PBT Decision Support
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center p-6">
        <form onSubmit={submit} className="w-full max-w-sm" data-testid="login-form">
          <div className="font-mono-data text-xs uppercase tracking-[0.3em] text-cyan-400 mb-2">
            Access Terminal
          </div>
          <h1 className="font-display text-3xl font-black tracking-tight mb-8">Sign in to SPARK</h1>

          <label className="font-mono-data text-[10px] uppercase tracking-widest text-slate-500">Email</label>
          <input
            data-testid="login-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="w-full bg-transparent border-b border-slate-700 py-3 mb-6 font-mono-data text-sm focus:border-cyan-400 focus:outline-none transition-colors"
            placeholder="planner@spark.gov.my"
          />

          <label className="font-mono-data text-[10px] uppercase tracking-widest text-slate-500">Password</label>
          <input
            data-testid="login-password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="w-full bg-transparent border-b border-slate-700 py-3 mb-8 font-mono-data text-sm focus:border-cyan-400 focus:outline-none transition-colors"
            placeholder="••••••••"
          />

          <button
            data-testid="login-submit"
            disabled={busy}
            className="group w-full bg-cyan-400 text-slate-950 font-mono-data text-sm uppercase tracking-widest py-4 flex items-center justify-center gap-3 hover:bg-cyan-300 transition-colors disabled:opacity-50"
          >
            {busy ? "Authenticating…" : "Enter"}
            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </button>

          <div className="mt-8 border border-slate-800 p-4">
            <div className="font-mono-data text-[10px] uppercase tracking-widest text-slate-500 mb-3">
              Demo Accounts
            </div>
            <button type="button" data-testid="demo-planner" onClick={() => quick("planner@spark.gov.my", "Sepang2030")}
              className="w-full text-left font-mono-data text-xs text-slate-300 hover:text-cyan-400 py-1 transition-colors">
              → Planner · planner@spark.gov.my
            </button>
            <button type="button" data-testid="demo-citizen" onClick={() => quick("citizen@spark.my", "citizen123")}
              className="w-full text-left font-mono-data text-xs text-slate-300 hover:text-cyan-400 py-1 transition-colors">
              → Citizen · citizen@spark.my
            </button>
          </div>

          <p className="mt-6 text-center text-sm text-slate-500">
            No account?{" "}
            <Link to="/register" className="text-cyan-400 hover:underline">Register</Link>
          </p>
        </form>
      </div>
    </div>
  );
}
