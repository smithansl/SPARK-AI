import { toPng } from "html-to-image";
import { layerDataUrl } from "./geo";

function saveBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

const slug = (s) => (s || "layer").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

export async function exportLayerGeoJSON(layer) {
  const token = localStorage.getItem("spark_token");
  const url = layerDataUrl(layer, token);
  const res = await fetch(url);
  if (!res.ok) throw new Error("fetch failed");
  const data = await res.json();
  saveBlob(new Blob([JSON.stringify(data)], { type: "application/geo+json" }), `${slug(layer.name)}.geojson`);
}

export async function exportMapImage(node, filename = "spark-map.png") {
  if (!node) throw new Error("no map node");
  const dataUrl = await toPng(node, {
    cacheBust: true,
    pixelRatio: 2,
    filter: (el) => !(el.classList && el.classList.contains("leaflet-control-zoom")),
  });
  const res = await fetch(dataUrl);
  saveBlob(await res.blob(), filename);
}
