export default function Legend({ layers, layerState }) {
  const visible = layers.filter((l) => layerState[l.id]?.visible);
  if (visible.length === 0) return null;

  return (
    <div className="space-y-3 max-h-[45vh] overflow-y-auto">
      {visible.map((l) => (
        <div key={l.id}>
          <div className="font-mono-data text-[10px] uppercase tracking-widest text-cyan-400 mb-1.5">{l.name}</div>
          <div className="space-y-1">
            {l.style.mode === "graduated" &&
              l.style.classes.map((c) => (
                <div key={c.label} className="flex items-center gap-2">
                  <span className="w-3.5 h-3.5 border border-slate-600 shrink-0" style={{ background: c.color, opacity: 0.85 }} />
                  <span className="text-[11px] text-slate-300">{c.label}</span>
                </div>
              ))}
            {l.style.mode === "categorized" &&
              l.style.categories.map((c) => (
                <div key={c.value} className="flex items-center gap-2">
                  <span className="w-3.5 h-3.5 shrink-0" style={{ background: c.color, border: `1px solid ${c.outline || "#475569"}` }} />
                  <span className="text-[11px] text-slate-300">{c.value}</span>
                </div>
              ))}
          </div>
        </div>
      ))}
    </div>
  );
}
