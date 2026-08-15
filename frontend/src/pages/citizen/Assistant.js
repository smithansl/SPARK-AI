import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Bot, Send, X, MapPin, Sparkles, Loader2, Navigation } from "lucide-react";
import { API } from "../../lib/api";

const SUGGESTED = [
  "Find the nearest recycling centre to me",
  "Where can I recycle e-waste?",
  "What are today's rates for aluminium cans?",
  "When is recyclables collection in my area?",
];

function render(text) {
  const withLinks = text.split(/(https?:\/\/[^\s]+)/g);
  return withLinks.map((seg, i) => {
    if (/^https?:\/\//.test(seg)) {
      return (
        <a key={i} href={seg} target="_blank" rel="noreferrer"
          className="inline-flex items-center gap-1 text-emerald-400 underline break-all">
          <Navigation className="w-3 h-3" /> Directions
        </a>
      );
    }
    const parts = seg.split(/(\*\*[^*]+\*\*)/g);
    return parts.map((p, j) =>
      /^\*\*[^*]+\*\*$/.test(p)
        ? <strong key={`${i}-${j}`} className="text-white">{p.replace(/\*\*/g, "")}</strong>
        : <span key={`${i}-${j}`} className="whitespace-pre-wrap">{p}</span>
    );
  });
}

export default function Assistant() {
  const [open, setOpen] = useState(false);
  const [sessionId] = useState(() => "cit-" + Math.random().toString(36).slice(2, 10));
  const [coords, setCoords] = useState(null);
  const [geoState, setGeoState] = useState("idle"); // idle | locating | on | denied
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const scrollRef = useRef(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, streaming, open]);

  const requestLocation = () => {
    if (!navigator.geolocation) { setGeoState("denied"); return; }
    setGeoState("locating");
    navigator.geolocation.getCurrentPosition(
      (pos) => { setCoords({ lat: +pos.coords.latitude.toFixed(5), lng: +pos.coords.longitude.toFixed(5) }); setGeoState("on"); },
      () => { setCoords({ lat: 2.69, lng: 101.75 }); setGeoState("denied"); }
    );
  };

  useEffect(() => { if (open && geoState === "idle") requestLocation(); }, [open]);

  const send = async (text) => {
    const q = (text ?? input).trim();
    if (!q || streaming) return;
    setInput("");
    setMessages((m) => [...m, { role: "user", content: q }, { role: "assistant", content: "" }]);
    setStreaming(true);
    try {
      const res = await fetch(`${API}/citizen/assistant`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${localStorage.getItem("spark_token")}` },
        body: JSON.stringify({ message: q, session_id: sessionId, lat: coords?.lat, lng: coords?.lng }),
      });
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let acc = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        acc += decoder.decode(value, { stream: true });
        setMessages((m) => { const c = [...m]; c[c.length - 1] = { role: "assistant", content: acc }; return c; });
      }
    } catch {
      setMessages((m) => { const c = [...m]; c[c.length - 1] = { role: "assistant", content: "Assistant unavailable, please retry." }; return c; });
    } finally {
      setStreaming(false);
    }
  };

  return (
    <>
      {/* Launcher */}
      <button data-testid="assistant-launcher" onClick={() => setOpen((o) => !o)}
        className="fixed bottom-24 md:bottom-6 right-4 sm:right-6 z-50 w-14 h-14 rounded-full bg-emerald-500 text-slate-950 flex items-center justify-center shadow-lg hover:bg-emerald-400 transition-colors glow-teal">
        {open ? <X className="w-6 h-6" /> : <Bot className="w-6 h-6" />}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 20, scale: 0.96 }}
            className="fixed bottom-40 md:bottom-24 right-4 sm:right-6 z-50 w-[92vw] max-w-sm h-[68vh] max-h-[560px] glass border border-emerald-400/40 flex flex-col overflow-hidden">
            {/* Header */}
            <div className="p-4 border-b border-slate-800 flex items-center gap-3 bg-[#04120c]/80">
              <div className="w-9 h-9 rounded-full bg-emerald-500 text-slate-950 flex items-center justify-center">
                <Bot className="w-5 h-5" />
              </div>
              <div className="flex-1">
                <div className="font-display font-bold text-sm">SPARK Assistant</div>
                <div className="font-mono-data text-[9px] uppercase tracking-widest text-emerald-400 flex items-center gap-1">
                  <Sparkles className="w-3 h-3" /> ChatGPT · GPT-5.4
                </div>
              </div>
              <button data-testid="assistant-geo"
                onClick={requestLocation}
                className={`flex items-center gap-1 border px-2 py-1 font-mono-data text-[9px] uppercase tracking-widest transition-colors ${
                  geoState === "on" ? "border-emerald-400 text-emerald-400" : "border-slate-600 text-slate-400 hover:border-emerald-400"}`}>
                {geoState === "locating" ? <Loader2 className="w-3 h-3 animate-spin" /> : <MapPin className="w-3 h-3" />}
                {geoState === "on" ? "Located" : geoState === "denied" ? "Approx" : "Locate"}
              </button>
            </div>

            {/* Messages */}
            <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3">
              {messages.length === 0 && (
                <div>
                  <p className="text-sm text-slate-300">Hi! I can find the nearest recycling centre, check buy-back rates, accepted items and collection days. Ask me anything 🌱</p>
                  <div className="mt-4 space-y-2">
                    {SUGGESTED.map((s, i) => (
                      <button key={s} data-testid={`assistant-suggest-${i}`} onClick={() => send(s)}
                        className="w-full text-left border border-slate-700 px-3 py-2 text-xs text-slate-200 hover:border-emerald-400 hover:text-emerald-400 transition-colors">
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {messages.map((m, i) => (
                <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div className={m.role === "user"
                    ? "bg-emerald-500 text-slate-950 px-3 py-2 max-w-[85%] text-sm font-medium"
                    : "glass border border-emerald-400/20 px-3 py-2 max-w-[90%] text-sm text-slate-200 leading-relaxed"}>
                    {m.role === "assistant"
                      ? (m.content ? render(m.content) : <span className="text-emerald-400 animate-pulse font-mono-data text-xs">thinking…</span>)
                      : m.content}
                  </div>
                </div>
              ))}
            </div>

            {/* Input */}
            <form onSubmit={(e) => { e.preventDefault(); send(); }} className="p-3 border-t border-slate-800 flex items-center gap-2">
              <input data-testid="assistant-input" value={input} onChange={(e) => setInput(e.target.value)}
                placeholder="Ask about centres, rates, pickups…"
                className="flex-1 bg-transparent text-sm py-2 focus:outline-none" />
              <button data-testid="assistant-send" disabled={streaming || !input.trim()}
                className="bg-emerald-500 text-slate-950 p-2 hover:bg-emerald-400 transition-colors disabled:opacity-40">
                <Send className="w-4 h-4" />
              </button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
