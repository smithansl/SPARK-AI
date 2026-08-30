import { useEffect, useRef, useState } from "react";
import { Brain, Send, Sparkles, Map as MapIcon, FlaskConical, FileText, User, Plus } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import api, { API } from "../../lib/api";

const SUGGESTED = [
  "Where are future waste hotspots in Sepang?",
  "Where should a new recovery facility be located?",
  "What happens if population increases by 20%?",
  "Which areas have poor collection coverage?",
];

function renderContent(text) {
  // bold **HEADING** and preserve line breaks
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((p, i) => {
    if (/^\*\*[^*]+\*\*$/.test(p)) {
      return <span key={i} className="font-display font-bold text-cyan-400 block mt-3 mb-1 text-xs uppercase tracking-widest">{p.replace(/\*\*/g, "")}</span>;
    }
    return <span key={i} className="whitespace-pre-wrap">{p}</span>;
  });
}

export default function Analytics() {
  const navigate = useNavigate();
  const [sessionId, setSessionId] = useState(() => {
    let s = localStorage.getItem("spark_copilot_session");
    if (!s) { s = "copilot-" + Math.random().toString(36).slice(2, 10); localStorage.setItem("spark_copilot_session", s); }
    return s;
  });
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const scrollRef = useRef(null);

  useEffect(() => {
    api.get(`/ai/history/${sessionId}`).then((r) => {
      if (r.data && r.data.length) setMessages(r.data);
    }).catch(() => {});
  }, [sessionId]);

  const newChat = () => {
    const s = "copilot-" + Math.random().toString(36).slice(2, 10);
    localStorage.setItem("spark_copilot_session", s);
    setSessionId(s);
    setMessages([]);
  };

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, streaming]);

  const send = async (text) => {
    const q = (text ?? input).trim();
    if (!q || streaming) return;
    setInput("");
    setMessages((m) => [...m, { role: "user", content: q }, { role: "assistant", content: "" }]);
    setStreaming(true);
    try {
      const res = await fetch(`${API}/ai/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("spark_token")}`,
        },
        body: JSON.stringify({ message: q, session_id: sessionId }),
      });
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let acc = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        acc += decoder.decode(value, { stream: true });
        setMessages((m) => {
          const copy = [...m];
          copy[copy.length - 1] = { role: "assistant", content: acc };
          return copy;
        });
      }
    } catch (e) {
      setMessages((m) => {
        const copy = [...m];
        copy[copy.length - 1] = { role: "assistant", content: "The AI engine is temporarily unavailable. Please retry." };
        return copy;
      });
    } finally {
      setStreaming(false);
    }
  };

  const empty = messages.length === 0;

  return (
    <div className="flex flex-col h-[calc(100vh-56px)]">
      <div className="p-6 border-b border-slate-800 flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 font-mono-data text-xs uppercase tracking-[0.3em] text-cyan-400">
            <Brain className="w-4 h-4" /> SPARK Planning Intelligence
          </div>
          <h1 className="font-display text-2xl font-black tracking-tight mt-1">AI Planning Copilot</h1>
          <p className="text-sm text-slate-400">Ask SPARK about your spatial planning problem — answers come as Evidence → Analysis → Projection → Recommendation.</p>
        </div>
        <button data-testid="new-chat-btn" onClick={newChat}
          className="shrink-0 flex items-center gap-2 border border-slate-700 px-3 py-2 font-mono-data text-[10px] uppercase tracking-widest text-cyan-400 hover:border-cyan-400 transition-colors">
          <Plus className="w-3.5 h-3.5" /> New Chat
        </button>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto p-6">
        {empty ? (
          <div className="max-w-2xl">
            <div className="glass border border-slate-800 p-6">
              <div className="flex items-center gap-2 text-cyan-400 font-mono-data text-xs uppercase tracking-widest mb-4">
                <Sparkles className="w-4 h-4" /> Suggested questions
              </div>
              <div className="grid gap-2">
                {SUGGESTED.map((s) => (
                  <button
                    key={s}
                    data-testid={`suggested-${SUGGESTED.indexOf(s)}`}
                    onClick={() => send(s)}
                    className="text-left border border-slate-700 px-4 py-3 text-sm text-slate-200 hover:border-cyan-400 hover:text-cyan-400 transition-colors"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="max-w-3xl space-y-4">
            {messages.map((m, i) => (
              <motion.div key={i} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                className={`flex gap-3 ${m.role === "user" ? "justify-end" : ""}`}>
                {m.role === "assistant" && (
                  <div className="w-8 h-8 shrink-0 border border-cyan-400 flex items-center justify-center">
                    <Brain className="w-4 h-4 text-cyan-400" />
                  </div>
                )}
                <div className={m.role === "user"
                  ? "bg-white text-slate-950 px-4 py-3 max-w-lg text-sm font-medium"
                  : "glass border border-cyan-400/30 px-5 py-4 max-w-2xl text-sm text-slate-200 leading-relaxed"}>
                  {m.role === "assistant"
                    ? (m.content ? renderContent(m.content) : <span className="text-cyan-400 animate-pulse font-mono-data text-xs">analysing…</span>)
                    : m.content}
                  {m.role === "assistant" && m.content && !streaming && i === messages.length - 1 && (
                    <div className="flex flex-wrap gap-2 mt-4 pt-3 border-t border-slate-800">
                      <button data-testid="ai-view-map" onClick={() => navigate("/intelligence/spatial")} className="flex items-center gap-1.5 font-mono-data text-[10px] uppercase tracking-widest border border-slate-700 px-3 py-1.5 hover:border-cyan-400 text-cyan-400 transition-colors"><MapIcon className="w-3 h-3" /> View Map</button>
                      <button data-testid="ai-run-sim" onClick={() => navigate("/intelligence/simulator")} className="flex items-center gap-1.5 font-mono-data text-[10px] uppercase tracking-widest border border-slate-700 px-3 py-1.5 hover:border-cyan-400 text-cyan-400 transition-colors"><FlaskConical className="w-3 h-3" /> Run Simulation</button>
                      <button data-testid="ai-gen-report" onClick={() => navigate("/intelligence/reports")} className="flex items-center gap-1.5 font-mono-data text-[10px] uppercase tracking-widest border border-slate-700 px-3 py-1.5 hover:border-cyan-400 text-cyan-400 transition-colors"><FileText className="w-3 h-3" /> Generate Report</button>
                    </div>
                  )}
                </div>
                {m.role === "user" && (
                  <div className="w-8 h-8 shrink-0 bg-cyan-400 text-slate-950 flex items-center justify-center">
                    <User className="w-4 h-4" />
                  </div>
                )}
              </motion.div>
            ))}
          </div>
        )}
      </div>

      <div className="p-4 border-t border-slate-800">
        <form onSubmit={(e) => { e.preventDefault(); send(); }} className="max-w-3xl flex items-center gap-3 glass border border-slate-800 px-4 py-2">
          <input
            data-testid="copilot-input"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask SPARK about waste, hotspots, facilities, forecasts…"
            className="flex-1 bg-transparent py-2 text-sm focus:outline-none font-mono-data"
          />
          <button data-testid="copilot-send" disabled={streaming || !input.trim()}
            className="bg-cyan-400 text-slate-950 p-2.5 hover:bg-cyan-300 transition-colors disabled:opacity-40">
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  );
}
