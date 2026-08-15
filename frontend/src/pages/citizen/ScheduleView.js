import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { CalendarDays, Bell, BellOff, Clock } from "lucide-react";
import { toast } from "sonner";
import api from "../../lib/api";

export default function ScheduleView() {
  const [schedule, setSchedule] = useState([]);
  const [reminders, setReminders] = useState({});

  useEffect(() => {
    api.get("/recycling/schedule").then((r) => {
      setSchedule(r.data);
      const init = {};
      r.data.forEach((s) => (init[s.id] = s.type === "Recyclables (3R)" || s.type === "General Waste"));
      setReminders(init);
    });
  }, []);

  const toggle = (id, type) => {
    setReminders((r) => ({ ...r, [id]: !r[id] }));
    toast.success(!reminders[id] ? `Reminder ON for ${type}` : `Reminder OFF for ${type}`);
  };

  return (
    <div className="p-4 sm:p-6 max-w-3xl mx-auto space-y-5">
      <div>
        <div className="font-mono-data text-xs uppercase tracking-[0.3em] text-emerald-400">Collection Calendar</div>
        <h1 className="font-display text-2xl sm:text-3xl font-black tracking-tight mt-1">Schedule & Reminders</h1>
        <p className="text-sm text-slate-400">Municipal collection days for your area. Toggle push reminders.</p>
      </div>

      <div className="space-y-3">
        {schedule.map((s, i) => (
          <motion.div key={s.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}
            className="glass border border-slate-800 p-4 flex items-center gap-4">
            <div className="w-11 h-11 flex items-center justify-center border shrink-0" style={{ borderColor: s.color, color: s.color }}>
              <CalendarDays className="w-5 h-5" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-display font-bold">{s.type}</div>
              <div className="font-mono-data text-[10px] uppercase tracking-widest text-slate-500">{s.days} · {s.area}</div>
              <div className="flex items-center gap-1.5 text-xs mt-1" style={{ color: s.color }}>
                <Clock className="w-3 h-3" /> Next: {s.next}
              </div>
            </div>
            <button data-testid={`reminder-${s.id}`} onClick={() => toggle(s.id, s.type)}
              className={`flex items-center gap-1.5 border px-3 py-2 font-mono-data text-[10px] uppercase tracking-widest transition-colors ${
                reminders[s.id] ? "border-emerald-400 text-emerald-400 bg-emerald-400/10" : "border-slate-600 text-slate-500"}`}>
              {reminders[s.id] ? <Bell className="w-3.5 h-3.5" /> : <BellOff className="w-3.5 h-3.5" />}
              {reminders[s.id] ? "On" : "Off"}
            </button>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
