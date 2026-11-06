import { useEffect, useRef } from "react";
import { MapContainer, Marker, Polyline, TileLayer, useMap } from "react-leaflet";
import L from "leaflet";
import type { GeoPoint } from "@/lib/types";

const techIcon = L.divIcon({
  className: "tech-marker",
  iconSize: [44, 44],
  iconAnchor: [22, 22],
  html: `<div style="position:relative;width:44px;height:44px;display:grid;place-items:center">
    <span style="position:absolute;inset:6px;border-radius:9999px;background:rgba(56,189,248,.45)" class="animate-radar"></span>
    <span style="position:relative;width:20px;height:20px;border-radius:9999px;background:#0284C7;border:3px solid #fff;box-shadow:0 0 18px rgba(56,189,248,.9)"></span>
  </div>`,
});

const destIcon = L.divIcon({
  className: "tech-marker",
  iconSize: [30, 40],
  iconAnchor: [15, 38],
  html: `<svg width="30" height="40" viewBox="0 0 30 40" xmlns="http://www.w3.org/2000/svg">
    <path d="M15 0C6.7 0 0 6.7 0 15c0 11 15 25 15 25s15-14 15-25C30 6.7 23.3 0 15 0z" fill="#10B981" stroke="#fff" stroke-width="2"/>
    <circle cx="15" cy="15" r="5.5" fill="#fff"/>
  </svg>`,
});

function Follow({ point, destination }: { point: GeoPoint | null; destination: GeoPoint | null }) {
  const map = useMap();
  const framed = useRef(false);
  useEffect(() => {
    if (point && destination && !framed.current) {
      framed.current = true;
      map.fitBounds(L.latLngBounds([point.lat, point.lng], [destination.lat, destination.lng]), { padding: [70, 70], maxZoom: 16 });
    } else if (point && !destination) {
      map.setView([point.lat, point.lng], Math.max(map.getZoom(), 15), { animate: true });
    } else if (point && framed.current && !map.getBounds().pad(-0.1).contains([point.lat, point.lng])) {
      map.panTo([point.lat, point.lng], { animate: true });
    } else if (!point && destination) {
      map.setView([destination.lat, destination.lng], 15);
    }
  }, [map, point, destination]);
  return null;
}

export default function LiveMap({ location, trail, destination = null }: { location: GeoPoint | null; trail: GeoPoint[]; destination?: GeoPoint | null }) {
  const start = location ?? destination;
  const center: [number, number] = start ? [start.lat, start.lng] : [-23.5505, -46.6333];
  return (
    <MapContainer center={center} zoom={start ? 15 : 11} className="size-full" zoomControl={false} attributionControl data-testid="live-map">
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
        className="osm-dark-tiles"
      />
      {trail.length > 1 && (
        <Polyline positions={trail.map((p) => [p.lat, p.lng] as [number, number])} pathOptions={{ color: "#38BDF8", weight: 4, opacity: 0.7, dashArray: "6 8" }} />
      )}
      {location && destination && (
        <Polyline positions={[[location.lat, location.lng], [destination.lat, destination.lng]]} pathOptions={{ color: "#10B981", weight: 2, opacity: 0.5, dashArray: "2 8" }} />
      )}
      {destination && <Marker position={[destination.lat, destination.lng]} icon={destIcon} />}
      {location && <Marker position={[location.lat, location.lng]} icon={techIcon} />}
      <Follow point={location} destination={destination} />
    </MapContainer>
  );
}
