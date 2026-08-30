import { API } from "./api";

export const CARTO_TILE_URL =
  "https://basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png?key=cb1_2d2a_1_8c993e1ca8f310c438d5a765";

export const RAMP = ["#1a9850", "#a6d96a", "#fee08b", "#fc8d59", "#d73027"];
export const CAT_PALETTE = [
  "#2878E8", "#F4A582", "#8EEA00", "#A875C8", "#12D9E5", "#FFF200",
  "#F08080", "#168B2C", "#A6D785", "#808000", "#A9DFF0", "#fb923c",
  "#e11d48", "#14b8a6", "#a3e635", "#f472b6",
];

export function graduatedColor(val, classes) {
  if (val == null || isNaN(val)) return null;
  for (let i = 0; i < classes.length; i++) {
    const c = classes[i];
    if (i === classes.length - 1) return c.color;
    if (val <= c.max) return c.color;
  }
  return classes[classes.length - 1]?.color;
}

export function categorizedEntry(val, categories) {
  return categories.find((c) => c.value === val) || null;
}

export function styleFor(feature, style, opacity) {
  const val = feature?.properties?.[style.attribute];
  let fill = "#64748b";
  let outline = style.stroke || "#334155";
  let fillOpacity = opacity;
  if (style.mode === "graduated") {
    const c = graduatedColor(typeof val === "string" ? parseFloat(val) : val, style.classes || []);
    if (c) fill = c;
    else fillOpacity = 0;
  } else if (style.mode === "categorized") {
    const cat = categorizedEntry(val, style.categories || []);
    if (cat) { fill = cat.color; if (cat.outline) outline = cat.outline; }
    else fillOpacity = 0;
  }
  return {
    fillColor: fill,
    color: outline,
    weight: style.strokeWidth ?? 0.6,
    fillOpacity,
    opacity: Math.min(1, opacity + 0.35),
  };
}

// Compute 5 quantile class breaks for graduated styling of uploaded layers.
export function computeClasses(values) {
  const nums = values.map((v) => (typeof v === "string" ? parseFloat(v) : v)).filter((v) => v != null && !isNaN(v)).sort((a, b) => a - b);
  if (nums.length === 0) return [];
  const q = (p) => nums[Math.min(nums.length - 1, Math.floor(p * (nums.length - 1)))];
  const breaks = [nums[0], q(0.2), q(0.4), q(0.6), q(0.8), nums[nums.length - 1]];
  const fmt = (n) => (Math.abs(n) >= 100 ? n.toFixed(0) : n.toFixed(2));
  const labels = ["Very Low", "Low", "Moderate", "High", "Critical"];
  return RAMP.map((color, i) => ({
    label: `${labels[i]} · ${fmt(breaks[i])}–${fmt(breaks[i + 1])}`,
    min: breaks[i], max: breaks[i + 1], color,
  }));
}

export function uniqueValues(features, attr, limit = 40) {
  const set = [];
  for (const f of features) {
    const v = f.properties?.[attr];
    if (v != null && !set.includes(v)) set.push(v);
    if (set.length >= limit) break;
  }
  return set;
}

export function layerDataUrl(layer, token) {
  if (layer.source === "builtin" && layer.url) return layer.url;
  return `${API}/geo/data/${layer.id}?auth=${token}`;
}
