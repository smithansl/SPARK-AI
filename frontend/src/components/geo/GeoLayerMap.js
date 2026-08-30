import { MapContainer, TileLayer } from "react-leaflet";
import { CARTO_TILE_URL } from "../../lib/geo";
import GeoJsonLayer from "./GeoJsonLayer";

export default function GeoLayerMap({ layers, layerState, center = [2.74, 101.72], zoom = 11 }) {
  return (
    <MapContainer
      center={center}
      zoom={zoom}
      scrollWheelZoom
      preferCanvas
      attributionControl={false}
      style={{ height: "100%", width: "100%" }}
    >
      <TileLayer url={CARTO_TILE_URL} attribution="" crossOrigin="anonymous" />
      {layers
        .filter((l) => layerState[l.id]?.visible)
        .map((l) => (
          <GeoJsonLayer key={l.id} layer={l} opacity={layerState[l.id]?.opacity ?? l.style.opacity ?? 0.6} />
        ))}
    </MapContainer>
  );
}
