import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Radar, ArrowRight, User, Building2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "../context/AuthContext";
import { formatApiErrorDetail } from "../lib/api";

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: "", email: "", password: "", role: "citizen" });
  const [busy, setBusy] = useState(false);

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const user = await register(form);
      toast.success("Account created");
      navigate(user.role === "planner" ? "/intelligence" : "/citizen");
    } catch (err) {
      toast.error(formatApiErrorDetail(err.response?.data?.detail) || "Registration failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#020617] text-white flex items-center justify-center p-6 grid-bg">
      <form onSubmit={submit} className="w-full max-w-md glass p-8" data-testid="register-form">
        <Link to="/" className="flex items-center gap-3 mb-8">
          <div className="w-9 h-9 border border-cyan-400 flex items-center justify-center glow-teal">
            <Radar className="w-5 h-5 text-cyan-400" />
          </div>
          <span className="font-display text-xl font-black">SPARK</span>
        </Link>

        <h1 className="font-display text-3xl font-black tracking-tight mb-1">Create account</h1>
        <p className="text-sm text-slate-400 mb-8">Join the Sepang spatial intelligence network.</p>

        <div className="grid grid-cols-2 gap-3 mb-6">
          {[
            { v: "citizen", label: "Citizen", icon: User, desc: "Report & contribute" },
            { v: "planner", label: "Planner", icon: Building2, desc: "PBT / Intelligence" },
          ].map((r) => (
            <button
              type="button"
              key={r.v}
              data-testid={`role-${r.v}`}
              onClick={() => setForm({ ...form, role: r.v })}
              className={`border p-3 text-left transition-colors ${
                form.role === r.v ? "border-cyan-400 bg-cyan-400/10" : "border-slate-700 hover:border-slate-500"
              }`}
            >
              <r.icon className={`w-4 h-4 mb-2 ${form.role === r.v ? "text-cyan-400" : "text-slate-400"}`} />
              <div className="font-display text-sm font-bold">{r.label}</div>
              <div className="font-mono-data text-[9px] uppercase tracking-widest text-slate-500">{r.desc}</div>
            </button>
          ))}
        </div>

        <input data-testid="register-name" value={form.name} onChange={set("name")} required placeholder="Full name"
          className="w-full bg-transparent border-b border-slate-700 py-3 mb-5 font-mono-data text-sm focus:border-cyan-400 focus:outline-none transition-colors" />
        <input data-testid="register-email" type="email" value={form.email} onChange={set("email")} required placeholder="Email"
          className="w-full bg-transparent border-b border-slate-700 py-3 mb-5 font-mono-data text-sm focus:border-cyan-400 focus:outline-none transition-colors" />
        <input data-testid="register-password" type="password" value={form.password} onChange={set("password")} required minLength={6} placeholder="Password (min 6)"
          className="w-full bg-transparent border-b border-slate-700 py-3 mb-8 font-mono-data text-sm focus:border-cyan-400 focus:outline-none transition-colors" />

        <button data-testid="register-submit" disabled={busy}
          className="group w-full bg-cyan-400 text-slate-950 font-mono-data text-sm uppercase tracking-widest py-4 flex items-center justify-center gap-3 hover:bg-cyan-300 transition-colors disabled:opacity-50">
          {busy ? "Creating…" : "Create account"}
          <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
        </button>

        <p className="mt-6 text-center text-sm text-slate-500">
          Have an account? <Link to="/login" className="text-cyan-400 hover:underline">Sign in</Link>
        </p>
      </form>
    </div>
  );
}
