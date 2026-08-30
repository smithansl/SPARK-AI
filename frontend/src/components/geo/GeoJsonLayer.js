import { useEffect, useRef, useState } from "react";
import { GeoJSON } from "react-leaflet";
import { styleFor, layerDataUrl } from "../../lib/geo";

const cache = new Map();

async function fetchGeo(url) {
  if (cache.has(url)) return cache.get(url);
  const res = await fetch(url);
  if (!res.ok) throw new Error("geo fetch failed");
  const data = await res.json();
  cache.set(url, data);
  return data;
}

export default function GeoJsonLayer({ layer, opacity }) {
  const [data, setData] = useState(null);
  const ref = useRef(null);
  const token = localStorage.getItem("spark_token");
  const url = layerDataUrl(layer, token);

  useEffect(() => {
    let alive = true;
    fetchGeo(url).then((d) => { if (alive) setData(d); }).catch(() => {});
    return () => { alive = false; };
  }, [url]);

  useEffect(() => {
    if (ref.current) ref.current.setStyle((f) => styleFor(f, layer.style, opacity));
  }, [opacity, layer.style]);

  if (!data) return null;

  const labelAttr = layer.style.labelAttr || layer.style.attribute;

  return (
    <GeoJSON
      ref={ref}
      data={data}
      style={(f) => styleFor(f, layer.style, opacity)}
      onEachFeature={(feature, lyr) => {
        const p = feature.properties || {};
        const label = p[labelAttr];
        const val = p[layer.style.attribute];
        lyr.bindTooltip(
          `<div style="font-family:JetBrains Mono,monospace;font-size:11px">
            <strong>${label ?? layer.name}</strong><br/>
            ${layer.style.attribute}: ${val ?? "—"}
          </div>`,
          { sticky: true }
        );
      }}
    />
  );
}
