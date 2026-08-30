import { MapContainer, TileLayer, CircleMarker, Tooltip, Polyline, useMap, Marker } from "react-leaflet";
import L from "leaflet";
import { useEffect } from "react";
import { CARTO_TILE_URL } from "../lib/geo";

export const SEVERITY_COLOR = {
  critical: "#ef4444",
  high: "#f97316",
  medium: "#eab308",
  low: "#10b981",
};

const SEPANG_CENTER = [2.72, 101.72];

function FlyTo({ target }) {
  const map = useMap();
  useEffect(() => {
    if (target) map.flyTo([target.lat, target.lng], 13, { duration: 1.1 });
  }, [target, map]);
  return null;
}

function facilityIcon(color = "#00E5FF") {
  return L.divIcon({
    className: "",
    html: `<div style="width:16px;height:16px;border:2px solid ${color};background:#020617;transform:rotate(45deg);box-shadow:0 0 10px ${color}"></div>`,
    iconSize: [16, 16],
    iconAnchor: [8, 8],
  });
}

export default function SepangMap({
  zones = [],
  facilities = [],
  routes = [],
  sites = [],
  flyTarget = null,
  onZoneClick,
  zoom = 11,
  waterHeat = true,
}) {
  return (
    <MapContainer
      center={SEPANG_CENTER}
      zoom={zoom}
      scrollWheelZoom
      style={{ height: "100%", width: "100%" }}
      zoomControl={true}
      attributionControl={false}
    >
      <TileLayer attribution="" url={CARTO_TILE_URL} />
      <FlyTo target={flyTarget} />

      {routes.map((r) =>
        r.stop_coords && r.stop_coords.length > 1 ? (
          <Polyline
            key={r.id}
            positions={r.stop_coords.map((s) => [s.lat, s.lng])}
            pathOptions={{ color: r.color, weight: 3, opacity: 0.85, dashArray: "6 8" }}
          />
        ) : null
      )}

      {zones.map((z) => {
        const color = SEVERITY_COLOR[z.severity] || "#00E5FF";
        const radius = 8 + z.waste_tonnes * 1.4;
        return (
          <CircleMarker
            key={z.id}
            center={[z.lat, z.lng]}
            radius={radius}
            pathOptions={{ color, fillColor: color, fillOpacity: 0.35, weight: 2 }}
            eventHandlers={{ click: () => onZoneClick && onZoneClick(z) }}
          >
            <Tooltip direction="top" offset={[0, -6]} opacity={1}>
              <div style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 11 }}>
                <strong>{z.name}</strong>
                <br />
                {z.waste_tonnes} t/mo · {z.land_use}
                <br />
                Recovery {z.recovery_rate}% · +{z.growth}%
              </div>
            </Tooltip>
          </CircleMarker>
        );
      })}

      {sites.map((s) => (
        <CircleMarker
          key={s.id}
          center={[s.lat, s.lng]}
          radius={10}
          pathOptions={{
            color: s.score >= 80 ? "#10b981" : s.score >= 65 ? "#eab308" : "#ef4444",
            fillOpacity: 0.15,
            weight: 2,
            dashArray: "3 3",
          }}
        >
          <Tooltip direction="top" opacity={1}>
            <div style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 11 }}>
              {s.name} — {s.score}%
            </div>
          </Tooltip>
        </CircleMarker>
      ))}

      {facilities.map((f) => (
        <Marker key={f.id} position={[f.lat, f.lng]} icon={facilityIcon()}>
          <Tooltip direction="top" opacity={1}>
            <div style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 11 }}>
              {f.name}
              <br />
              {f.type}{f.capacity ? ` · ${f.capacity} t/mo` : f.address ? ` · ${f.address}` : ""}
            </div>
          </Tooltip>
        </Marker>
      ))}
    </MapContainer>
  );
}
